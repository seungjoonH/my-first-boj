import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChatMessage } from '@/types/chat';
import { generateNickname, getFinalChatTier } from '@/lib/chatNickname';
import { B_BADGE_VARIANT_MAP } from '@/lib/chatConstants';
import { NicknameBar } from '../nicknameBar/NicknameBar';
import { MessageList } from '../messageList/MessageList';
import { ChatInput } from '../chatInput/ChatInput';
import { CloseButton } from '@/components/closeButton/CloseButton';
import { LoadingEllipsisLabel } from '@/components/loadingEllipsis/LoadingEllipsisLabel';
import { AdminBadge, NicknameBadgeBase } from '../nicknameBadge/NicknameBadge';
import { TierIcon } from '../tierIcon/TierIcon';
import type { ChatWidgetProps } from './type';
import styles from './ChatWidget.module.css';

export function ChatWidget({
  messages,
  saltMap,
  myUuid,
  adminUuid,
  nickCooldownRemaining,
  nickCooldownTtlSec,
  keywordMentionCount,
  highlightedKeywordBubbleId,
  jumpTargetBubbleId,
  jumpRequestKey,
  sendCooldownRemainingMs,
  sendCooldownRemainingSec,
  sendCooldownRatio,
  warnCount,
  onlineCount,
  isLoaded,
  isClosing,
  onSend,
  onChangeNickname,
  onClose,
  onInteraction,
  onJumpToMessage,
  onKeywordHover,
}: ChatWidgetProps) {
  const [selectedReplyMessageId, setSelectedReplyMessageId] = useState<string | null>(null);
  const salt = saltMap[myUuid] ?? '';
  const rootCls = `${styles.root}${isClosing ? ` ${styles['root--closing']}` : ''}`;
  const selectedReplyMessage = useMemo<ChatMessage | null>(() => {
    if (!selectedReplyMessageId) return null;
    const picked = messages.find((message) => message.id === selectedReplyMessageId) ?? null;
    if (!picked) return null;
    if (picked.banned) return null;
    if (picked.isDm) return null;
    return picked;
  }, [messages, selectedReplyMessageId]);
  const selectedReplyTarget = useMemo<ReactNode | null>(() => {
    if (!selectedReplyMessage) return null;
    if (selectedReplyMessage.isAdmin) return <AdminBadge />;
    const replyTargetSalt = saltMap[selectedReplyMessage.clientUuid] ?? '';
    const { aBadge, bBadge } = generateNickname(selectedReplyMessage.clientUuid, replyTargetSalt);
    const bVariant = B_BADGE_VARIANT_MAP[bBadge] ?? 'muted';
    const tier =
      selectedReplyMessage.clientUuid !== adminUuid
        ? getFinalChatTier(selectedReplyMessage.clientUuid, replyTargetSalt)
        : null;
    return (
      <>
        {tier !== null && <TierIcon tier={tier} />}
        <NicknameBadgeBase aBadge={aBadge} bBadge={bBadge} bVariant={bVariant} />
      </>
    );
  }, [selectedReplyMessage, saltMap, adminUuid]);
  const selectedReplyId = selectedReplyMessage?.id ?? null;

  const handleReplyToMessage = (messageId: string): void => {
    const target = messages.find((message) => message.id === messageId);
    if (!target) return;
    if (target.banned) return;
    if (target.isDm) return;
    setSelectedReplyMessageId(messageId);
    onInteraction();
  };

  const handleClearReply = (): void => {
    setSelectedReplyMessageId(null);
    onInteraction();
  };

  const handleSend = (text: string, replyToMessageId?: string): void => {
    const replyTargetId = replyToMessageId ?? selectedReplyMessage?.id;
    onSend(text, replyTargetId);
    setSelectedReplyMessageId(null);
  };

  return (
    <div className={rootCls}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionHeadInner}>
          <NicknameBar
            myUuid={myUuid}
            salt={salt}
            adminUuid={adminUuid}
            nickCooldownRemaining={nickCooldownRemaining}
            nickCooldownTtlSec={nickCooldownTtlSec}
            isLoaded={isLoaded}
            onChangeNickname={onChangeNickname}
            onInteraction={onInteraction}
          />
          <CloseButton type="button" onClick={onClose} aria-label="채팅 닫기" />
        </div>
      </div>
      <div className={styles.sectionMeta}>
        <span>
          {keywordMentionCount > 0
            ? <>대화에서 백준이 <strong>{keywordMentionCount.toLocaleString()}</strong>번 언급되었습니다</>
            : '메시지를 보내어 이스터에그를 찾아보세요'}
        </span>
        {onlineCount && (
          <span className={styles.onlineCount}>
            <span className={styles.onlineDot} aria-hidden />
            {onlineCount.toLocaleString()}명
          </span>
        )}
      </div>
 
      {isLoaded ? (
        <div className={styles.sectionBody}>
          <MessageList
            messages={messages}
            saltMap={saltMap}
            myUuid={myUuid}
            adminUuid={adminUuid}
            selectedReplyMessageId={selectedReplyId}
            highlightedKeywordBubbleId={highlightedKeywordBubbleId}
            jumpTargetBubbleId={jumpTargetBubbleId}
            jumpRequestKey={jumpRequestKey}
            onReplyToMessage={handleReplyToMessage}
            onJumpToMessage={onJumpToMessage}
            onInteraction={onInteraction}
            onKeywordHover={onKeywordHover}
          />
        </div>
      ) : (
        <div className={styles.loading}>
          <div className={styles.loadingLineWrap}>
            <LoadingEllipsisLabel className={styles.loadingEllipsis} />
          </div>
        </div>
      )}
      <div className={styles.sectionFoot}>
        <ChatInput
          onSend={handleSend}
          selectedReplyMessage={selectedReplyMessage}
          selectedReplyTarget={selectedReplyTarget}
          onClearReply={handleClearReply}
          onInteraction={onInteraction}
          sendCooldownRemainingMs={sendCooldownRemainingMs}
          sendCooldownRemainingSec={sendCooldownRemainingSec}
          sendCooldownRatio={sendCooldownRatio}
          warnCount={warnCount}
        />
      </div>
    </div>
  );
}
