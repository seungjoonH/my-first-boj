'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { generateNickname, getFinalChatTier } from '@/lib/chatNickname';
import { B_BADGE_VARIANT_MAP, KEYWORD_ID_PREFIX } from '@/lib/chatConstants';
import { KEYWORD_REGEX } from '@/lib/chatKeyword';
import { buildCls } from '@/lib/buildCls';
import { SERVICE_END_MS } from '@/lib/constants';
import { NicknameBadgeBase, AdminBadge } from '../nicknameBadge/NicknameBadge';
import { TierIcon } from '../tierIcon/TierIcon';
import type { MessageListProps } from './type';
import styles from './MessageList.module.css';

const AT_BOTTOM_THRESHOLD_PX = 40;
const BUBBLE_SHAKE_DURATION_MS = 520;
const SCROLL_SETTLE_DELAY_MS = 110;
const SCROLL_SETTLE_FORCE_MS = 1200;
const REPLY_LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_THRESHOLD_PX = 10;

const KST_TIME_ZONE = 'Asia/Seoul';
const DAY_MS = 24 * 60 * 60 * 1000;
const datePartFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timePartFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function getKstDayKey(ms: number): string {
  return datePartFormatter.format(ms);
}

function formatMessageTime(ms: number): string {
  return timePartFormatter.format(ms);
}

function formatDateMarker(ms: number): string {
  const [yyyy, mm, dd] = getKstDayKey(ms).split('-');
  const dayStart = new Date(`${yyyy}-${mm}-${dd}T00:00:00+09:00`).getTime();
  const end = new Date(SERVICE_END_MS);
  const endY = end.toLocaleString('en-CA', { timeZone: KST_TIME_ZONE, year: 'numeric' });
  const endM = end.toLocaleString('en-CA', { timeZone: KST_TIME_ZONE, month: '2-digit' });
  const endD = end.toLocaleString('en-CA', { timeZone: KST_TIME_ZONE, day: '2-digit' });
  const endDayStart = new Date(`${endY}-${endM}-${endD}T00:00:00+09:00`).getTime();
  const dDay = Math.max(0, Math.floor((endDayStart - dayStart) / DAY_MS));
  return `D-${dDay} (${yyyy}.${mm}.${dd})`;
}

function renderMessageText(
  message: string,
  bubbleId: string,
  highlightedKeywordBubbleId: string | null,
  onKeywordHover: (keywordBubbleId: string | null) => void,
): React.ReactNode[] {
  const parts = message.split(KEYWORD_REGEX);
  const matches = Array.from(message.matchAll(KEYWORD_REGEX));

  if (matches.length === 0) return [message];

  const nodes: React.ReactNode[] = [];
  let matchIdx = 0;
  let highlightedOnce = false;

  for (const part of parts) {
    if (part) nodes.push(part);
    if (matchIdx < matches.length) {
      const match = matches[matchIdx];
      if (!highlightedOnce) {
        const kwId = `${bubbleId}-${matchIdx}`;
        const bubbleKeywordId = `${KEYWORD_ID_PREFIX}${kwId}`;
        const keywordCls = buildCls(
          styles.keyword,
          highlightedKeywordBubbleId === bubbleKeywordId && styles['keyword--active'],
        );
        nodes.push(
          <span
            key={kwId}
            className={keywordCls}
            data-keyword-id={bubbleKeywordId}
            onMouseEnter={() => {
              onKeywordHover(bubbleKeywordId);
            }}
            onMouseLeave={() => {
              onKeywordHover(null);
            }}
          >
            {match[0]}
          </span>,
        );
        highlightedOnce = true;
      }
      else {
        nodes.push(match[0]);
      }
      matchIdx++;
    }
  }

  return nodes;
}

export function MessageList({
  messages,
  saltMap,
  myUuid,
  adminUuid,
  selectedReplyMessageId,
  highlightedKeywordBubbleId,
  jumpTargetBubbleId,
  jumpRequestKey,
  onReplyToMessage,
  onJumpToMessage,
  onInteraction,
  onKeywordHover,
}: MessageListProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollSettleForceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearScrollWatcherRef = useRef<(() => void) | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);
  const onInteractionRef = useRef(onInteraction);
  const prevMessageIdsRef = useRef<Set<string>>(new Set(messages.map((m) => m.id)));
  const initialSyncDoneRef = useRef(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [shakenBubbleId, setShakenBubbleId] = useState<string | null>(null);
  const [activeReplyBubbleId, setActiveReplyBubbleId] = useState<string | null>(null);
  const visibleMessageById = useMemo(
    () => Object.fromEntries(messages.map((message) => [message.id, message])),
    [messages],
  );

  const clearLongPressTimer = (): void => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const resetLongPressState = (): void => {
    clearLongPressTimer();
    touchStartPointRef.current = null;
    didLongPressRef.current = false;
  };

  const isAtBottom = (): boolean => {
    const el = rootRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_THRESHOLD_PX;
  };

  const scrollToBottom = (): void => {
    rootRef.current?.scrollTo({ top: rootRef.current.scrollHeight, behavior: 'smooth' });
    setNewMsgCount(0);
  };

  // 위젯 오픈 후 init 데이터 렌더가 완료되면 초기 위치를 항상 최하단으로 맞춘다.
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
  }, []);

  useEffect(() => {
    onInteractionRef.current = onInteraction;
  }, [onInteraction]);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
      if (scrollSettleForceTimerRef.current) clearTimeout(scrollSettleForceTimerRef.current);
      clearScrollWatcherRef.current?.();
      clearScrollWatcherRef.current = null;
      resetLongPressState();
    };
  }, []);

  useEffect(() => {
    if (!jumpTargetBubbleId) return;
    const target = bubbleRefs.current[jumpTargetBubbleId];
    if (!target) return;

    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
    if (scrollSettleForceTimerRef.current) clearTimeout(scrollSettleForceTimerRef.current);
    clearScrollWatcherRef.current?.();
    clearScrollWatcherRef.current = null;

    const triggerShake = () => {
      if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
      if (scrollSettleForceTimerRef.current) clearTimeout(scrollSettleForceTimerRef.current);
      clearScrollWatcherRef.current?.();
      clearScrollWatcherRef.current = null;
      setShakenBubbleId(null);
      requestAnimationFrame(() => {
        setShakenBubbleId(jumpTargetBubbleId);
      });
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => {
        setShakenBubbleId((prev) => (prev === jumpTargetBubbleId ? null : prev));
      }, BUBBLE_SHAKE_DURATION_MS);
    };

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const scroller = rootRef.current;
    if (!scroller) {
      triggerShake();
      onInteractionRef.current();
      return;
    }

    const onScrollSettled = () => {
      triggerShake();
    };

    const armSettleTimer = () => {
      if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = setTimeout(onScrollSettled, SCROLL_SETTLE_DELAY_MS);
    };

    const handleScroll = () => {
      armSettleTimer();
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });
    clearScrollWatcherRef.current = () => {
      scroller.removeEventListener('scroll', handleScroll);
    };

    armSettleTimer();
    scrollSettleForceTimerRef.current = setTimeout(onScrollSettled, SCROLL_SETTLE_FORCE_MS);
    onInteractionRef.current();
  }, [jumpTargetBubbleId, jumpRequestKey]);

  useEffect(() => {
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      prevMessageIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }

    const prevIds = prevMessageIdsRef.current;
    const incoming = messages.filter((m) => !prevIds.has(m.id));
    prevMessageIdsRef.current = new Set(messages.map((m) => m.id));
    if (incoming.length === 0) return;

    const incomingFromMe = incoming.some((m) => m.clientUuid === myUuid);
    const incomingFromOthersCount = incoming.filter((m) => m.clientUuid !== myUuid).length;

    if (incomingFromMe || isAtBottom()) {
      scrollToBottom();
    }
    else if (incomingFromOthersCount > 0) {
      setNewMsgCount((prev) => prev + incomingFromOthersCount);
    }

  }, [messages, myUuid]);

  const handleScroll = (): void => {
    onInteraction();
    resetLongPressState();
    setActiveReplyBubbleId(null);
    if (isAtBottom()) setNewMsgCount(0);
  };

  const handleRowMouseEnter = (bubbleId: string, canReply: boolean): void => {
    if (!canReply) return;
    setActiveReplyBubbleId(bubbleId);
  };

  const handleRowMouseLeave = (bubbleId: string): void => {
    setActiveReplyBubbleId((prev) => (prev === bubbleId ? null : prev));
  };

  const handleRowPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    bubbleId: string,
    canReply: boolean,
  ): void => {
    if (e.pointerType === 'mouse') return;
    if (!canReply) return;
    onInteraction();
    resetLongPressState();
    touchStartPointRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setActiveReplyBubbleId(bubbleId);
    }, REPLY_LONG_PRESS_MS);
  };

  const handleRowPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!touchStartPointRef.current) return;
    const deltaX = e.clientX - touchStartPointRef.current.x;
    const deltaY = e.clientY - touchStartPointRef.current.y;
    const movedDistance = Math.hypot(deltaX, deltaY);
    if (movedDistance <= LONG_PRESS_MOVE_THRESHOLD_PX) return;
    resetLongPressState();
  };

  const handleRowPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    clearLongPressTimer();
    touchStartPointRef.current = null;
    if (!didLongPressRef.current) return;
    e.preventDefault();
    didLongPressRef.current = false;
  };

  const handleRowPointerCancel = (): void => {
    resetLongPressState();
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onScroll={handleScroll}
      onMouseLeave={() => {
        onKeywordHover(null);
        setActiveReplyBubbleId(null);
      }}
    >
      {messages.map((msg, index) => {
        const isAdmin = msg.isAdmin === true;
        const isMine = !isAdmin && msg.clientUuid === myUuid;
        const isDm = msg.isDm === true;
        const canReply = !msg.banned && !isDm;
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const isSameSenderAsPrev = prevMsg?.clientUuid === msg.clientUuid;
        const isFirstMessageOfDay =
          !prevMsg || getKstDayKey(prevMsg.timestamp) !== getKstDayKey(msg.timestamp);
        const salt = saltMap[msg.clientUuid] ?? '';
        const { aBadge, bBadge } = generateNickname(msg.clientUuid, salt);
        const bVariant = B_BADGE_VARIANT_MAP[bBadge] ?? 'muted';
        const tierForSender =
          !isAdmin && msg.clientUuid !== adminUuid ? getFinalChatTier(msg.clientUuid, salt) : null;
        const isNewSender = !isSameSenderAsPrev && !isFirstMessageOfDay;
        const rowCls = buildCls(
          styles.row,
          isAdmin ? styles['row--admin'] : (isMine ? styles['row--mine'] : styles['row--theirs']),
          isNewSender && styles['row--newSender'],
        );
        const bubbleCls = buildCls(
          styles.bubble,
          isAdmin ? styles['bubble--admin'] : (isMine ? styles['bubble--mine'] : styles['bubble--theirs']),
          isDm && styles['bubble--dm'],
          selectedReplyMessageId === msg.id && styles['bubble--replySelected'],
          shakenBubbleId === msg.id && styles['bubble--shake'],
          msg.banned && styles['bubble--banned'],
        );
        const shouldShowReplyAction = activeReplyBubbleId === msg.id && canReply;
        const replyActionCls = buildCls(
          styles.replyActionButton,
          shouldShowReplyAction && styles['replyActionButton--visible'],
        );
        const replyTargetMessage = msg.replyToMessageId
          ? (visibleMessageById[msg.replyToMessageId] ?? null)
          : null;
        const shouldRenderReplyPreview = Boolean(replyTargetMessage && !replyTargetMessage.banned);
        const replyPreviewText = shouldRenderReplyPreview ? (replyTargetMessage?.message ?? '') : '';
        const bubbleLineCls = buildCls(
          styles.bubbleLine,
          isMine ? styles['bubbleLine--mine'] : styles['bubbleLine--theirs'],
        );
        const timeCls = buildCls(styles.time, isMine ? styles['time--mine'] : styles['time--theirs']);
        const timeText = formatMessageTime(msg.timestamp);

        return (
          <div
            key={msg.id}
            className={rowCls}
            onMouseEnter={() => {
              handleRowMouseEnter(msg.id, canReply);
            }}
            onMouseLeave={() => {
              handleRowMouseLeave(msg.id);
            }}
            onPointerDown={(e) => {
              handleRowPointerDown(e, msg.id, canReply);
            }}
            onPointerMove={handleRowPointerMove}
            onPointerUp={handleRowPointerUp}
            onPointerCancel={handleRowPointerCancel}
          >
            {isFirstMessageOfDay && (
              <div className={styles.dateMarker}>
                {formatDateMarker(msg.timestamp)}
              </div>
            )}
            {!isMine && !isSameSenderAsPrev && (
              <span className={styles.nickname}>
                {isAdmin
                  ? <AdminBadge />
                  : (
                      <>
                        {tierForSender !== null && <TierIcon tier={tierForSender} />}
                        <NicknameBadgeBase aBadge={aBadge} bBadge={bBadge} bVariant={bVariant} />
                      </>
                    )
                }
              </span>
            )}
            <div className={bubbleLineCls}>
              <div
                className={bubbleCls}
                ref={(el) => {
                  bubbleRefs.current[msg.id] = el;
                }}
              >
                {shouldRenderReplyPreview && (
                  <button
                    type="button"
                    className={styles.replyPreview}
                    onClick={() => {
                      if (!replyTargetMessage) return;
                      onJumpToMessage(replyTargetMessage.id);
                    }}
                  >
                    <span className={styles.replyPreviewLabel}>답장</span>
                    <span className={styles.replyPreviewText}>{replyPreviewText}</span>
                  </button>
                )}
                {msg.banned
                  ? <span className={styles.bannedText}>삭제된 메시지</span>
                  : (
                      <>
                        {isDm && <span className={styles.dmTag}>[DM]</span>}
                        {isDm && ' '}
                        {renderMessageText(
                          msg.message,
                          msg.id,
                          highlightedKeywordBubbleId,
                          onKeywordHover,
                        )}
                        {isDm && <span className={styles.dmTooltip}>나만 볼 수 있는 메시지 입니다</span>}
                      </>
                    )
                }
                {canReply && (
                  <button
                    type="button"
                    className={replyActionCls}
                    aria-label="이 메시지에 답장"
                    onClick={() => {
                      onReplyToMessage(msg.id);
                    }}
                  >
                    ↪
                  </button>
                )}
              </div>
              <span className={timeCls}>{timeText}</span>
            </div>
            {isDm && isAdmin && !msg.banned && (
              <div className={styles.dmHint}>이 DM 에 대답하면 전체 채팅으로 전송됩니다</div>
            )}
          </div>
        );
      })}
      {newMsgCount > 0 && (
        <button className={styles.newMsgBanner} onClick={scrollToBottom} type="button">
          새 메시지 {newMsgCount}개
        </button>
      )}
    </div>
  );
}
