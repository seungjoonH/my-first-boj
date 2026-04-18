import { NicknameBar } from '../nicknameBar/NicknameBar';
import { MessageList } from '../messageList/MessageList';
import { ChatInput } from '../chatInput/ChatInput';
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
  isLoaded,
  isClosing,
  onSend,
  onChangeNickname,
  onClose,
  onInteraction,
  onKeywordHover,
}: ChatWidgetProps) {
  const salt = saltMap[myUuid] ?? '';
  const rootCls = `${styles.root}${isClosing ? ` ${styles['root--closing']}` : ''}`;

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
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="채팅 닫기">
            <svg
              className={styles.closeIcon}
              viewBox="0 0 24 24"
              width="24"
              height="24"
              aria-hidden
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                d="M7 7l10 10M17 7L7 17"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className={styles.sectionMeta}>
        {keywordMentionCount > 0 
          ? <>대화에서 백준이 <strong>{keywordMentionCount.toLocaleString()}</strong>번 언급되었습니다</>
          : '메시지를 보내어 이스터에그를 찾아보세요'}
      </div>
 
      {isLoaded ? (
        <div className={styles.sectionBody}>
          <MessageList
            messages={messages}
            saltMap={saltMap}
            myUuid={myUuid}
            adminUuid={adminUuid}
            highlightedKeywordBubbleId={highlightedKeywordBubbleId}
            jumpTargetBubbleId={jumpTargetBubbleId}
            jumpRequestKey={jumpRequestKey}
            onInteraction={onInteraction}
            onKeywordHover={onKeywordHover}
          />
        </div>
      ) : (
        <div className={styles.loading}>불러오는 중...</div>
      )}
      <div className={styles.sectionFoot}>
        <ChatInput
          onSend={onSend}
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
