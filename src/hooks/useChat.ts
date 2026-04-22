'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatInitResponse, ChatSseEvent } from '@/types/chat';
import {
  CHAT_MESSAGES_REDIS_MAX,
  WIDGET_INACTIVITY_MS,
  NICK_RL_TTL_SEC,
  KEYWORD_ID_PREFIX,
  CHAT_SESSION_STORAGE_KEY,
  CHAT_LOCAL_STORAGE_KEY,
  HEAL_LOCAL_INTERVAL_MS,
  HEAL_COOKIE_INTERVAL_MS,
  HEAL_COOKIE_COOLDOWN_MS,
} from '@/lib/chatConstants';
import { normalizeKeywordToken, parseKeywordValue, KEYWORD_REGEX } from '@/lib/chatKeyword';
import { useChatRateLimit } from './useChatRateLimit';
import { useToast } from './useToast';

type ChatState = {
  messages: ChatMessage[];
  messageCount: number;
  saltMap: Record<string, string>;
  keywords: string[];
  mentionCount: number;
  myUuid: string;
  adminUuid: string;
  isLoaded: boolean;
  isConnected: boolean;
  warnCount: number;
  nickCooldownTtlSec: number;
  onlineCount: number | null;
};

type PendingKeywordAnimation = {
  word: string;
  globalIndex: number;
  sourceBubbleId: string;
  keywordId: string;
};

const INITIAL_STATE: ChatState = {
  messages: [],
  messageCount: 0,
  saltMap: {},
  keywords: [],
  mentionCount: 0,
  myUuid: '',
  adminUuid: '',
  isLoaded: false,
  isConnected: false,
  warnCount: 0,
  nickCooldownTtlSec: NICK_RL_TTL_SEC,
  onlineCount: null,
};

const NICK_COOLDOWN_UI_TICK_MS = 500;
const INACTIVITY_CHECK_INTERVAL_MS = 10_000;
type SendMessageResponse = { ok: boolean; error?: string; keywordsAdded?: string[] };

let chatMessageCountBootstrapRequested = false;

type ChatSession = {
  b: string; // companion UUID (쿠키 UUID와 다른 세션 전용 값)
  a: string; // 쿠키 UUID 백업
};

function readChatSession(): ChatSession | null {
  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatSession>;
    return typeof parsed.b === 'string' && parsed.b ? (parsed as ChatSession) : null;
  } catch {
    return null;
  }
}

function writeChatSession(session: ChatSession): void {
  try {
    sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 쿼타 초과 또는 private browsing 제한 — 무시
  }
}

// ── localStorage 복구 앵커 ─────────────────────────────────────────────────────
type ChatLocalEntry = {
  u: string; // uuid
  p: string; // HMAC-SHA256 proof (hex 64자) 또는 '' (dev 모드)
};

function readChatLocal(): ChatLocalEntry | null {
  try {
    const raw = localStorage.getItem(CHAT_LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatLocalEntry>;
    return typeof parsed.u === 'string' && parsed.u && typeof parsed.p === 'string'
      ? (parsed as ChatLocalEntry)
      : null;
  } catch {
    return null;
  }
}

function writeChatLocal(entry: ChatLocalEntry): void {
  try {
    localStorage.setItem(CHAT_LOCAL_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // 쿼타 초과 또는 private browsing 제한 — 무시
  }
}

// proof가 구조적으로 유효한지 확인 (64자 hex 또는 '' — dev 모드)
function isStructurallyValidProof(p: string): boolean {
  return p === '' || (p.length === 64 && /^[0-9a-f]+$/.test(p));
}

// ── 세션 초기화 (mismatch 조정 포함) ──────────────────────────────────────────
function getOrInitSession(): ChatSession {
  const existing = readChatSession();
  const local = readChatLocal();

  if (existing && local) {
    if (existing.a && local.u && existing.a !== local.u) {
      // 불일치: proof 구조가 유효한 localStorage를 우선, 아니면 sessionStorage
      const resolvedUuid = isStructurallyValidProof(local.p) ? local.u : existing.a;
      const resolved: ChatSession = { b: existing.b, a: resolvedUuid };
      writeChatSession(resolved);
      return resolved;
    }
    return existing;
  }

  if (existing) return existing;

  if (local) {
    // sessionStorage 소실 (브라우저 재시작 등) + localStorage 생존
    const restored: ChatSession = { b: crypto.randomUUID(), a: local.u };
    writeChatSession(restored);
    return restored;
  }

  // 완전 신규
  const fresh: ChatSession = { b: crypto.randomUUID(), a: '' };
  writeChatSession(fresh);
  return fresh;
}

// ── 요청 헤더 구성 ─────────────────────────────────────────────────────────────
function buildInitHeaders(
  session: ChatSession,
  opts?: { heal?: boolean },
): Record<string, string> {
  const headers: Record<string, string> = { 'X-Chat-Companion': session.b };
  if (session.a) {
    headers['X-Chat-Restore'] = session.a;
    // proof가 있고 uuid가 일치하면 전송 (서버가 restore를 수락하기 위해 필요)
    const local = readChatLocal();
    if (local && local.u === session.a && isStructurallyValidProof(local.p)) {
      headers['X-Chat-Restore-Proof'] = local.p;
    }
  }
  if (opts?.heal) headers['X-Chat-Heal'] = '1';
  return headers;
}

// ── 훅 ────────────────────────────────────────────────────────────────────────

export function useChat(isOpen: boolean, onClose: () => void) {
  const [state, setState] = useState<ChatState>(INITIAL_STATE);
  const [pendingKeywordAnimations, setPendingKeywordAnimations] = useState<PendingKeywordAnimation[]>([]);
  const [bubbleKeywordToKeywordIdMap, setBubbleKeywordToKeywordIdMap] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const pendingKeywordIdsRef = useRef<Set<string>>(new Set());
  const sendingRef = useRef(false);
  const lastInteractionRef = useRef<number>(Date.now());
  // identity healing refs — 인터벌 내에서 stale closure 없이 최신값 읽기 위해 ref 사용
  const myUuidRef = useRef<string>('');
  const myProofRef = useRef<string>('');
  const lastCookieHealRef = useRef<number>(0);
  /** SSE 재연결 시 `since` / `lastKwIdx` — 스트림 루프와 동기화 */
  const sseSinceRef = useRef(0);
  const sseLastKwIdxRef = useRef(0);
  const rateLimit = useChatRateLimit();
  const toast = useToast();
  const [nickCooldownEndsAt, setNickCooldownEndsAt] = useState<number | null>(null);
  const [, nickCooldownTick] = useState(0);

  const nickCooldownRemaining =
    nickCooldownEndsAt === null
      ? 0
      : Math.max(0, Math.ceil((nickCooldownEndsAt - Date.now()) / 1000));

  // ── 최초 진입 시 1회: 플로팅 버튼 숫자만 서버와 동기화 (채팅창을 열기 전에도 표시) ──
  useEffect(() => {
    if (chatMessageCountBootstrapRequested) return;
    chatMessageCountBootstrapRequested = true;
    const session = getOrInitSession();
    void (async (): Promise<void> => {
      try {
        const res = await fetch('/api/chat/count', { headers: buildInitHeaders(session) });
        if (!res.ok) return;
        const data = (await res.json()) as { messageCount?: unknown };
        if (typeof data.messageCount !== 'number' || !Number.isFinite(data.messageCount)) return;
        const next = Math.min(
          CHAT_MESSAGES_REDIS_MAX,
          Math.max(0, Math.floor(data.messageCount)),
        );
        setState((prev) => {
          if (prev.isLoaded) return prev;
          return { ...prev, messageCount: next };
        });
      } catch {
        // 네트워크 오류 등 — 무시
      }
    })();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setNickCooldownEndsAt(null);
      return;
    }
    if (nickCooldownEndsAt === null) return;
    if (Date.now() >= nickCooldownEndsAt) {
      setNickCooldownEndsAt(null);
      return;
    }
    const id = window.setInterval(() => {
      nickCooldownTick((n) => n + 1);
      setNickCooldownEndsAt((end) => {
        if (end === null || Date.now() < end) return end;
        return null;
      });
    }, NICK_COOLDOWN_UI_TICK_MS);
    return () => window.clearInterval(id);
  }, [isOpen, nickCooldownEndsAt]);

  const updateLastInteraction = (): void => {
    lastInteractionRef.current = Date.now();
  };

  const clearPendingKeywordAnimations = (): void => {
    setPendingKeywordAnimations([]);
  };

  const commitAnimatedKeyword = (keywordId: string): void => {
    pendingKeywordIdsRef.current.delete(keywordId);
    setState((prev) => {
      if (prev.keywords.includes(keywordId)) return prev;
      return { ...prev, keywords: [...prev.keywords, keywordId] };
    });
  };

  // ── SSE 연결 (끊기면 since/lastKwIdx 기준으로 자동 재연결) ─────────────────────
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const sseReconnectDelayMs = 1500;

    const runSse = async (): Promise<void> => {
      const session = getOrInitSession();
      const initRes = await fetch('/api/chat/init', { headers: buildInitHeaders(session) });
      if (!initRes.ok || cancelled) return;

      const init = (await initRes.json()) as ChatInitResponse;
      writeChatSession({ b: init.companion || session.b, a: init.myUuid });
      writeChatLocal({ u: init.myUuid, p: init.proof });
      myUuidRef.current = init.myUuid;
      myProofRef.current = init.proof;
      let since = Math.max(...init.messages.map((m) => m.timestamp), 0);
      let lastKwIdx = init.keywords.reduce((max, kw) => {
        const parsed = parseKeywordValue(kw);
        if (parsed.globalIndex === null) return max;
        return Math.max(max, parsed.globalIndex);
      }, 0);
      sseSinceRef.current = since;
      sseLastKwIdxRef.current = lastKwIdx;

      setNickCooldownEndsAt(
        init.nickCooldownRemaining > 0 ? Date.now() + init.nickCooldownRemaining * 1000 : null,
      );
      setState({
        messages: init.messages,
        messageCount: init.messageCount,
        saltMap: init.saltMap,
        keywords: init.keywords,
        mentionCount: init.mentionCount,
        myUuid: init.myUuid,
        adminUuid: init.adminUuid,
        isLoaded: true,
        isConnected: false,
        warnCount: init.warnCount ?? 0,
        nickCooldownTtlSec: init.nickCooldownTtlSec ?? NICK_RL_TTL_SEC,
        onlineCount: null,
      });

      while (!cancelled) {
        const controller = new AbortController();
        abortRef.current = controller;
        const streamConnectionId = crypto.randomUUID();

        try {
          const res = await fetch(
            `/api/chat/stream?since=${since}&lastKwIdx=${lastKwIdx}&cid=${streamConnectionId}`,
            { signal: controller.signal },
          );

          if (!res.ok || !res.body) {
            setState((prev) => ({ ...prev, isConnected: false }));
            await new Promise((r) => window.setTimeout(r, sseReconnectDelayMs));
            if (cancelled) return;
            since = sseSinceRef.current;
            lastKwIdx = sseLastKwIdxRef.current;
            continue;
          }

          setState((prev) => ({ ...prev, isConnected: true }));

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice('data: '.length).trim();
              if (!raw) continue;

              let event: ChatSseEvent;
              try {
                event = JSON.parse(raw) as ChatSseEvent;
              } catch {
                continue;
              }

              switch (event.type) {
                case 'message': {
                  const { salt, ...msg } = event;
                  setState((prev) => {
                    const existingIdx = prev.messages.findIndex((m) => m.id === msg.id);
                    const nextMessages =
                      existingIdx >= 0
                        ? prev.messages.map((m, idx) => (idx === existingIdx ? msg : m))
                        : [...prev.messages, msg];
                    const nextMessageCount = existingIdx >= 0
                      ? prev.messageCount
                      : Math.min(CHAT_MESSAGES_REDIS_MAX, prev.messageCount + 1);
                    const saltMap = msg.clientUuid === prev.myUuid
                      ? prev.saltMap
                      : { ...prev.saltMap, [msg.clientUuid]: salt };
                    return {
                      ...prev,
                      messages: nextMessages,
                      messageCount: nextMessageCount,
                      saltMap,
                    };
                  });
                  since = Math.max(since, msg.timestamp);
                  sseSinceRef.current = since;
                  break;
                }
                case 'keyword': {
                  const parsed = parseKeywordValue(event.value);
                  if (parsed.globalIndex !== null && parsed.globalIndex > lastKwIdx) {
                    lastKwIdx = parsed.globalIndex;
                  }
                  sseLastKwIdxRef.current = lastKwIdx;
                  setState((prev) => {
                    if (pendingKeywordIdsRef.current.has(event.value)) return prev;
                    if (prev.keywords.includes(event.value)) return prev;
                    return {
                      ...prev,
                      keywords: [...prev.keywords, event.value],
                      mentionCount:
                        parsed.globalIndex === null
                          ? prev.mentionCount
                          : Math.max(prev.mentionCount, parsed.globalIndex),
                    };
                  });
                  break;
                }
                case 'online':
                  setState((prev) => ({ ...prev, onlineCount: event.count }));
                  break;
                case 'ping':
                  break;
              }
            }
          }
        } catch (err) {
          if (cancelled) return;
          // AbortError(탭 전환·cleanup) 포함 — 재연결은 cancelled 가 아닐 때만
        }

        if (cancelled) return;

        setState((prev) => ({ ...prev, isConnected: false }));
        await new Promise((r) => window.setTimeout(r, sseReconnectDelayMs));
        if (cancelled) return;

        since = sseSinceRef.current;
        lastKwIdx = sseLastKwIdxRef.current;
      }
    };

    void runSse();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
      setNickCooldownEndsAt(null);
      setBubbleKeywordToKeywordIdMap({});
      pendingKeywordIdsRef.current.clear();
      setState((prev) => ({
        ...INITIAL_STATE,
        messageCount: prev.messageCount,
        mentionCount: prev.mentionCount,
        myUuid: prev.myUuid,
        saltMap: prev.myUuid && prev.saltMap[prev.myUuid]
          ? { [prev.myUuid]: prev.saltMap[prev.myUuid] }
          : {},
      }));
    };
  }, [isOpen]);

  // ── 탭 비활성 감지 + 포커스 복귀 시 즉시 heal ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibility = () => {
      if (document.hidden) {
        abortRef.current?.abort();
        abortRef.current = null;
        setState((prev) => ({ ...prev, isConnected: false }));
      } else {
        // 탭 포커스 복귀 시 즉시 heal
        const uuid = myUuidRef.current;
        const proof = myProofRef.current;
        if (uuid) {
          if (!readChatLocal()?.u) writeChatLocal({ u: uuid, p: proof });
          const session = readChatSession();
          if (!session?.a) writeChatSession({ b: session?.b ?? crypto.randomUUID(), a: uuid });
          // cookie heal (쿨다운 적용)
          const now = Date.now();
          if (now - lastCookieHealRef.current >= HEAL_COOKIE_COOLDOWN_MS) {
            lastCookieHealRef.current = now;
            const currentSession = readChatSession();
            if (currentSession) {
              void fetch('/api/chat/init', {
                headers: buildInitHeaders(currentSession, { heal: true }),
              }).catch(() => {});
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isOpen]);

  // ── 비활성 타이머 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const id = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > WIDGET_INACTIVITY_MS) {
        onClose();
      }
    }, INACTIVITY_CHECK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isOpen, onClose]);

  // ── 주기 storage self-heal (API 없음) ────────────────────────────────────────
  useEffect(() => {
    const localHealId = window.setInterval(() => {
      const uuid = myUuidRef.current;
      const proof = myProofRef.current;
      if (!uuid) return;

      if (!readChatLocal()?.u) writeChatLocal({ u: uuid, p: proof });

      const session = readChatSession();
      if (!session?.a) {
        writeChatSession({ b: session?.b ?? crypto.randomUUID(), a: uuid });
      }
    }, HEAL_LOCAL_INTERVAL_MS);

    return () => {
      window.clearInterval(localHealId);
    };
  }, []);

  // ── cookie 재발급 heal: 채팅창이 열려 있을 때만 (닫혀 있으면 init 요청 안 함)
  useEffect(() => {
    if (!isOpen) return;

    const cookieHealId = window.setInterval(() => {
      if (document.hidden) return;
      if (!myUuidRef.current) return;
      const now = Date.now();
      if (now - lastCookieHealRef.current < HEAL_COOKIE_COOLDOWN_MS) return;
      lastCookieHealRef.current = now;
      const session = readChatSession();
      if (!session) return;
      void fetch('/api/chat/init', {
        headers: buildInitHeaders(session, { heal: true }),
      }).catch(() => {});
    }, HEAL_COOKIE_INTERVAL_MS);

    return () => {
      window.clearInterval(cookieHealId);
    };
  }, [isOpen]);

  // ── 메시지 전송 ───────────────────────────────────────────────────────────────
  const sendMessage = async (text: string, replyToMessageId?: string): Promise<void> => {
    if (!state.myUuid) return;
    if (sendingRef.current) return;

    if (rateLimit.isLimited()) {
      const sec = rateLimit.remainingSeconds();
      toast.showToast(`${sec}초 후에 보낼 수 있습니다`);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      clientUuid: state.myUuid,
      message: trimmed,
      timestamp: Date.now(),
      replyToMessageId,
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, optimistic],
      messageCount: Math.min(CHAT_MESSAGES_REDIS_MAX, prev.messageCount + 1),
    }));
    rateLimit.recordSend();
    updateLastInteraction();
    sendingRef.current = true;

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, messageId: optimistic.id, replyToMessageId }),
      });
      const data = (await res.json()) as SendMessageResponse;

      if (!res.ok || !data.ok) {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== optimistic.id),
          messageCount: Math.max(0, prev.messageCount - 1),
        }));
        toast.showToast(data.error === 'banned' ? '더 이상 채팅할 수 없습니다' : '전송에 실패했습니다');
        return;
      }

      if (data.keywordsAdded && data.keywordsAdded.length > 0) {
        const latestKeywordIndex = data.keywordsAdded.reduce((max, value) => {
          const parsed = parseKeywordValue(value);
          if (parsed.globalIndex === null) return max;
          return Math.max(max, parsed.globalIndex);
        }, 0);
        if (latestKeywordIndex > 0) {
          setState((prev) => ({
            ...prev,
            mentionCount: Math.max(prev.mentionCount, latestKeywordIndex),
          }));
        }

        const matches = Array.from(trimmed.matchAll(KEYWORD_REGEX));
        const wordToMatchIndex = new Map<string, number>();
        matches.forEach((match, idx) => {
          const normalized = match[0] ? normalizeKeywordToken(match[0]) : '';
          if (!normalized || wordToMatchIndex.has(normalized)) return;
          wordToMatchIndex.set(normalized, idx);
        });

        const animationQueue: PendingKeywordAnimation[] = [];
        const nextKeywordMap: Record<string, string> = {};
        const immediateKeywordAdds: string[] = [];
        data.keywordsAdded.forEach((value) => {
          const parsed = parseKeywordValue(value);
          if (parsed.globalIndex === null) {
            immediateKeywordAdds.push(value);
            return;
          }
          const word = parsed.word;
          const globalIndex = parsed.globalIndex;
          const matchIndex = wordToMatchIndex.get(word);
          if (!Number.isFinite(globalIndex) || matchIndex === undefined) {
            immediateKeywordAdds.push(value);
            return;
          }
          const sourceBubbleId = `${KEYWORD_ID_PREFIX}${optimistic.id}-${matchIndex}`;
          animationQueue.push({ word, globalIndex, sourceBubbleId, keywordId: value });
          nextKeywordMap[sourceBubbleId] = value;
          pendingKeywordIdsRef.current.add(value);
        });

        if (immediateKeywordAdds.length > 0) {
          setState((prev) => {
            const added = immediateKeywordAdds.filter((value) => !prev.keywords.includes(value));
            if (added.length === 0) return prev;
            return { ...prev, keywords: [...prev.keywords, ...added] };
          });
        }

        if (animationQueue.length > 0) {
          setPendingKeywordAnimations((prev) => [...prev, ...animationQueue]);
          setBubbleKeywordToKeywordIdMap((prev) => ({ ...prev, ...nextKeywordMap }));
        }
      }
    } catch {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m.id !== optimistic.id),
        messageCount: Math.max(0, prev.messageCount - 1),
      }));
      toast.showToast('전송에 실패했습니다');
    } finally {
      sendingRef.current = false;
    }
  };

  // ── 닉네임 변경 ───────────────────────────────────────────────────────────────
  const changeNickname = async (): Promise<void> => {
    if (nickCooldownRemaining > 0) return;
    updateLastInteraction();

    try {
      const res = await fetch('/api/chat/nickname', { method: 'POST' });
      const data = (await res.json()) as {
        ok: boolean;
        newSalt?: string;
        remainingSeconds?: number;
        nickCooldownSeconds?: number;
      };

      if (data.ok && data.newSalt) {
        const sec = data.nickCooldownSeconds ?? NICK_RL_TTL_SEC;
        setNickCooldownEndsAt(Date.now() + sec * 1000);
        setState((prev) => ({
          ...prev,
          saltMap: { ...prev.saltMap, [prev.myUuid]: data.newSalt! },
          nickCooldownTtlSec: data.nickCooldownSeconds ?? prev.nickCooldownTtlSec,
        }));
      } else if (!data.ok && data.remainingSeconds) {
        setNickCooldownEndsAt(Date.now() + data.remainingSeconds * 1000);
      }
    } catch {
      // silent
    }
  };

  return {
    ...state,
    nickCooldownRemaining,
    sendCooldownRemainingMs: rateLimit.remainingMs,
    sendCooldownRemainingSec: rateLimit.remainingSeconds(),
    sendCooldownRatio: rateLimit.cooldownRatio,
    updateLastInteraction,
    sendMessage,
    changeNickname,
    pendingKeywordAnimations,
    clearPendingKeywordAnimations,
    commitAnimatedKeyword,
    bubbleKeywordToKeywordIdMap,
    toast,
  };
}
