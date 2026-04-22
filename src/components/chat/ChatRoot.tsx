'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { useKeywordAnimation } from '@/hooks/useKeywordAnimation';
import { CHAT_MESSAGES_REDIS_MAX, KEYWORD_ID_PREFIX } from '@/lib/chatConstants';
import { normalizeKeywordToken, parseKeywordValue, KEYWORD_REGEX } from '@/lib/chatKeyword';
import { ChatButton } from './chatButton/ChatButton';
import { ChatWidget } from './chatWidget/ChatWidget';
import { KeywordBackground } from './keywordBackground/KeywordBackground';
import { Toast } from '@/components/toast/Toast';

const WIDGET_FADE_OUT_MS = 200;

function extractMessageIdFromBubbleKeywordId(bubbleKeywordId: string): string | null {
  if (!bubbleKeywordId.startsWith(KEYWORD_ID_PREFIX)) return null;
  const raw = bubbleKeywordId.slice(KEYWORD_ID_PREFIX.length);
  const match = raw.match(/^(.*)-\d+$/);
  return match ? match[1] : raw;
}

export function ChatRoot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hoveredKeywordBubbleId, setHoveredKeywordBubbleId] = useState<string | null>(null);
  const [hoveredBackgroundKeywordId, setHoveredBackgroundKeywordId] = useState<string | null>(null);
  const [jumpTargetBubbleId, setJumpTargetBubbleId] = useState<string | null>(null);
  const [jumpRequestKey, setJumpRequestKey] = useState(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = () => {
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, WIDGET_FADE_OUT_MS);
  };

  const {
    messages,
    messageCount,
    saltMap,
    myUuid,
    adminUuid,
    mentionCount,
    keywords,
    nickCooldownRemaining,
    nickCooldownTtlSec,
    warnCount,
    onlineCount,
    sendCooldownRemainingMs,
    sendCooldownRemainingSec,
    sendCooldownRatio,
    isLoaded,
    updateLastInteraction,
    sendMessage,
    changeNickname,
    pendingKeywordAnimations,
    clearPendingKeywordAnimations,
    commitAnimatedKeyword,
    bubbleKeywordToKeywordIdMap,
    toast,
  } = useChat(isOpen, handleClose);

  const { scheduleAnimation } = useKeywordAnimation((keywordId) => {
    commitAnimatedKeyword(keywordId);
  });

  const inferredBubbleKeywordMap = useMemo(() => {
    const queueByWord = new Map<string, string[]>();
    for (const keywordId of keywords) {
      const parsed = parseKeywordValue(keywordId);
      if (parsed.globalIndex === null) continue;
      const word = parsed.word;
      const queue = queueByWord.get(word) ?? [];
      queue.push(keywordId);
      queueByWord.set(word, queue);
    }

    const map: Record<string, string> = {};

    for (const msg of messages) {
      const matches = Array.from(msg.message.matchAll(KEYWORD_REGEX));
      if (matches.length === 0) continue;

      const wordToKeywordId = new Map<string, string>();
      for (const match of matches) {
        const word = match[0] ? normalizeKeywordToken(match[0]) : '';
        if (!word || wordToKeywordId.has(word)) continue;
        const queue = queueByWord.get(word);
        const picked = queue?.shift();
        if (picked) wordToKeywordId.set(word, picked);
      }

      matches.forEach((match, matchIdx) => {
        const word = match[0] ? normalizeKeywordToken(match[0]) : '';
        const keywordId = wordToKeywordId.get(word);
        if (!keywordId) return;
        const bubbleKeywordId = `${KEYWORD_ID_PREFIX}${msg.id}-${matchIdx}`;
        map[bubbleKeywordId] = keywordId;
      });
    }

    return map;
  }, [messages, keywords]);

  const bubbleToKeywordIdMap = useMemo(
    () => ({ ...inferredBubbleKeywordMap, ...bubbleKeywordToKeywordIdMap }),
    [inferredBubbleKeywordMap, bubbleKeywordToKeywordIdMap],
  );

  const keywordToBubbleIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(bubbleToKeywordIdMap).forEach(([bubbleKeywordId, keywordId]) => {
      if (!map[keywordId]) map[keywordId] = bubbleKeywordId;
    });
    return map;
  }, [bubbleToKeywordIdMap]);

  const highlightedKeywordId = hoveredKeywordBubbleId
    ? (bubbleToKeywordIdMap[hoveredKeywordBubbleId] ?? null)
    : hoveredBackgroundKeywordId;

  const highlightedKeywordBubbleId = hoveredBackgroundKeywordId
    ? (keywordToBubbleIdMap[hoveredBackgroundKeywordId] ?? hoveredKeywordBubbleId)
    : hoveredKeywordBubbleId;

  const handleOpen = () => {
    setIsOpen(true);
    updateLastInteraction();
  };

  const handleJumpToMessage = (messageId: string): void => {
    setJumpTargetBubbleId((prev) => (prev === messageId ? prev : messageId));
    setJumpRequestKey((prev) => prev + 1);
    updateLastInteraction();
  };

  const handleBackgroundKeywordClick = (keywordId: string): void => {
    const bubbleKeywordId = keywordToBubbleIdMap[keywordId];
    if (!bubbleKeywordId) return;
    const messageId = extractMessageIdFromBubbleKeywordId(bubbleKeywordId);
    if (!messageId) return;
    setHoveredBackgroundKeywordId(null);
    setHoveredKeywordBubbleId(null);
    handleJumpToMessage(messageId);
  };

  const handleToggle = () => {
    if (isOpen) {
      setHoveredKeywordBubbleId(null);
      setHoveredBackgroundKeywordId(null);
      handleClose();
    } else {
      // 닫히는 도중에 다시 열면 타이머 취소 후 즉시 열기
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
        setIsClosing(false);
      }
      handleOpen();
    }
  };

  useEffect(() => {
    if (pendingKeywordAnimations.length === 0) return;
    pendingKeywordAnimations.forEach(({ word, globalIndex, sourceBubbleId, keywordId }) => {
      scheduleAnimation(word, globalIndex, sourceBubbleId, keywordId);
    });
    clearPendingKeywordAnimations();
  }, [pendingKeywordAnimations, scheduleAnimation, clearPendingKeywordAnimations, commitAnimatedKeyword]);

  return (
    <>
      <KeywordBackground
        keywords={keywords}
        saltMap={saltMap}
        adminUuid={adminUuid}
        isVisible={isOpen && !isClosing}
        highlightedKeywordId={highlightedKeywordId}
        onKeywordHover={setHoveredBackgroundKeywordId}
        onKeywordClick={handleBackgroundKeywordClick}
      />
      <ChatButton
        messageCount={messageCount}
        isCountMaxed={messageCount >= CHAT_MESSAGES_REDIS_MAX}
        isOpen={isOpen}
        onClick={handleToggle}
      />
      {isOpen && (
        <ChatWidget
          messages={messages}
          saltMap={saltMap}
          myUuid={myUuid}
          adminUuid={adminUuid}
          nickCooldownRemaining={nickCooldownRemaining}
          nickCooldownTtlSec={nickCooldownTtlSec}
          warnCount={warnCount}
          onlineCount={onlineCount}
          keywordMentionCount={mentionCount}
          highlightedKeywordBubbleId={highlightedKeywordBubbleId}
          jumpTargetBubbleId={jumpTargetBubbleId}
          jumpRequestKey={jumpRequestKey}
          sendCooldownRemainingMs={sendCooldownRemainingMs}
          sendCooldownRemainingSec={sendCooldownRemainingSec}
          sendCooldownRatio={sendCooldownRatio}
          isLoaded={isLoaded}
          isClosing={isClosing}
          onSend={sendMessage}
          onChangeNickname={changeNickname}
          onClose={handleClose}
          onInteraction={updateLastInteraction}
          onJumpToMessage={handleJumpToMessage}
          onKeywordHover={setHoveredKeywordBubbleId}
        />
      )}
      <Toast message={toast.message} />
    </>
  );
}
