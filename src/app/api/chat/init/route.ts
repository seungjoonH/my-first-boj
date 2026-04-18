import {
  chatRedis,
  getOrCreateSalt,
  msgKey,
  kwKey,
  kwSeqKey,
  nickRlKey,
  getUserSalt,
  getUserCompanion,
  getUserWarnCount,
  setUserCompanion,
  parseMsg,
  getNickRlTtlSec,
} from '@/lib/chatRedis';
import { CHAT_MESSAGES_REDIS_MAX } from '@/lib/chatConstants';
import { isReservedChatUuid, getAdminUuid } from '@/lib/chatAdmin';
import type { ChatInitResponse, ChatMessage } from '@/types/chat';
import { parseKeywordValue } from '@/lib/chatKeyword';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CHAT_UUID_COOKIE = 'chat-uuid';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 10;

// ── HMAC 유틸 (Web Crypto API, Edge 호환) ────────────────────────────────────

async function computeProof(uuid: string): Promise<string> {
  const secret = process.env.CHAT_PROOF_SECRET;
  if (!secret) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(uuid));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyProof(uuid: string, proof: string): Promise<boolean> {
  // dev 모드 체크 먼저: CHAT_PROOF_SECRET 미설정이면 증명 불필요 → 항상 통과
  const expected = await computeProof(uuid);
  if (!expected) return true;
  // production: proof가 없거나 길이 불일치 → 거부
  if (!proof || expected.length !== proof.length) return false;
  // XOR 상수시간 비교 (타이밍 공격 방지)
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ proof.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── 헤더 추출 헬퍼 ────────────────────────────────────────────────────────────

function getUuid(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  return cookie.match(/(?:^|;\s*)chat-uuid=([^;]+)/)?.[1]?.trim() ?? null;
}

function getCompanion(req: Request): string | null {
  const v = req.headers.get('X-Chat-Companion')?.trim() ?? '';
  return v.length > 0 && v.length <= 64 ? v : null;
}

function getRestore(req: Request): string | null {
  const v = req.headers.get('X-Chat-Restore')?.trim() ?? '';
  return v.length > 0 && v.length <= 64 ? v : null;
}

function getRestoreProof(req: Request): string {
  const v = req.headers.get('X-Chat-Restore-Proof')?.trim() ?? '';
  // 64자 hex(production) 또는 빈 문자열(dev 모드, secret 미설정)을 허용
  return v.length === 64 ? v : '';
}

function getHeal(req: Request): boolean {
  return req.headers.get('X-Chat-Heal') === '1';
}

function isVisibleMessage(message: ChatMessage, viewerUuid: string): boolean {
  if (message.isDm !== true) return true;
  if (!message.dmToUuid) return false;
  if (message.dmToUuid === viewerUuid) return true;
  if (message.clientUuid === viewerUuid) return true;
  return false;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const cookieUuid = getUuid(req);
  const existingUuid = cookieUuid && !isReservedChatUuid(cookieUuid) ? cookieUuid : null;

  // 쿠키가 없을 때만 restore 헤더 처리. proof 검증 통과해야만 수락.
  let restoreUuid: string | null = null;
  if (!existingUuid) {
    const restoreCandidate = getRestore(req);
    if (restoreCandidate && !isReservedChatUuid(restoreCandidate)) {
      const restoreProof = getRestoreProof(req);
      const proofOk = await verifyProof(restoreCandidate, restoreProof);
      if (proofOk) restoreUuid = restoreCandidate;
      // proof 불일치(production) → restoreUuid = null → 신규 UUID 발급
    }
  }

  const uuid = existingUuid ?? restoreUuid ?? crypto.randomUUID();
  const isNewUuid = !existingUuid;

  const incomingCompanion = getCompanion(req);

  // companion은 최초 1회만 저장한다.
  // 이미 Redis에 존재하면 기존 값을 사용 (sessionStorage 삭제 후 복원 시나리오).
  // 없으면 클라이언트가 보낸 값을 저장.
  let companion: string;
  if (chatRedis) {
    const existing = await getUserCompanion(uuid);
    if (existing) {
      companion = existing;
    }
    else if (incomingCompanion) {
      await setUserCompanion(uuid, incomingCompanion);
      companion = incomingCompanion;
    }
    else {
      companion = '';
    }
  }
  else {
    companion = incomingCompanion ?? '';
  }

  const rawSalt = await getOrCreateSalt(uuid);
  const mySalt = companion ? `${companion}:${rawSalt}` : rawSalt;

  const [rawMsgs, rawKeywords, rawCount, rawNickRl, warnCount, proof] = await Promise.all([
    chatRedis?.lrange(msgKey(), 0, CHAT_MESSAGES_REDIS_MAX - 1) ?? [],
    chatRedis?.lrange(kwKey(), 0, 499) ?? [],
    chatRedis?.get(kwSeqKey()),
    chatRedis?.get(nickRlKey(uuid)),
    getUserWarnCount(uuid),
    computeProof(uuid),
  ]);

  const messages = (rawMsgs as unknown[])
    .map(parseMsg)
    .filter((m): m is ChatMessage => m !== null)
    .filter((m) => isVisibleMessage(m, uuid));

  const keywordUuids = (rawKeywords as unknown[])
    .filter((k): k is string => typeof k === 'string')
    .map((k) => parseKeywordValue(k).clientUuid)
    .filter((u): u is string => Boolean(u));

  const uniqueUuids = [...new Set([...messages.map((m) => m!.clientUuid), ...keywordUuids])]
    .filter((u) => u !== uuid);

  const saltEntries = await Promise.all(
    uniqueUuids.map(async (u) => {
      const [s, c] = await Promise.all([getUserSalt(u), getUserCompanion(u)]);
      return [u, c ? `${c}:${s}` : s] as [string, string];
    }),
  );

  const saltMap: Record<string, string> = Object.fromEntries(saltEntries);
  saltMap[uuid] = mySalt;

  let nickCooldownRemaining = 0;
  if (rawNickRl) {
    const ttl = await chatRedis?.ttl(nickRlKey(uuid));
    nickCooldownRemaining = typeof ttl === 'number' && ttl > 0 ? ttl : 0;
  }

  const nickCooldownTtlSec = await getNickRlTtlSec();

  const body: ChatInitResponse = {
    messages,
    messageCount: messages.length,
    saltMap,
    keywords: (rawKeywords as unknown[]).filter((k) => typeof k === 'string') as string[],
    mentionCount: rawCount ? Number(rawCount) : 0,
    myUuid: uuid,
    adminUuid: getAdminUuid(),
    nickCooldownRemaining,
    nickCooldownTtlSec,
    companion,
    warnCount,
    proof,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 신규 UUID 발급 시 또는 heal 요청 시 Set-Cookie (Max-Age 갱신 포함)
  const isHealRequest = getHeal(req);
  if (isNewUuid || isHealRequest) {
    headers['Set-Cookie'] =
      `${CHAT_UUID_COOKIE}=${uuid}; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SEC}; Path=/`;
  }

  return new Response(JSON.stringify(body), { headers });
}
