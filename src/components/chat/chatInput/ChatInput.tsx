'use client';

import { useRef } from 'react';
import { CloseButton } from '@/components/closeButton/CloseButton';
import { MESSAGE_MAX_LEN, MAX_WARN_COUNT } from '@/lib/chatConstants';
import type { ChatInputProps } from './type';
import styles from './ChatInput.module.css';

const IME_KEYCODE = 229;

export function ChatInput({
  onSend,
  selectedReplyMessage,
  selectedReplyTarget,
  onClearReply,
  onInteraction,
  sendCooldownRemainingMs,
  sendCooldownRemainingSec,
  sendCooldownRatio,
  warnCount,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const safeWarnCount = Number.isFinite(warnCount) ? Math.max(0, warnCount) : 0;
  const isWarnLimited = safeWarnCount >= MAX_WARN_COUNT;
  const isCooldown = sendCooldownRemainingMs > 0;
  const isSendDisabled = isCooldown || isWarnLimited;
  const warnClassName =
    isWarnLimited
      ? `${styles.warnBadge} ${styles['warnBadge--danger']}`
      : `${styles.warnBadge} ${styles['warnBadge--warning']}`;
  const cooldownRatio = Math.max(0, Math.min(1, sendCooldownRatio));
  const cooldownStyle = { '--cooldown-ratio': cooldownRatio } as React.CSSProperties;
  const replyPreviewText = selectedReplyMessage?.message ?? '';

  const handleSend = (): void => {
    if (isSendDisabled) return;
    const value = textareaRef.current?.value.trim() ?? '';
    if (!value) return;
    onSend(value, selectedReplyMessage?.id);
    if (textareaRef.current) textareaRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const nativeEvent = e.nativeEvent as KeyboardEvent;
    // 한글 IME 조합 중 Enter는 확정 동작이므로 전송으로 처리하지 않는다.
    if (nativeEvent.isComposing || isComposingRef.current || nativeEvent.keyCode === IME_KEYCODE) {
      onInteraction();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    onInteraction();
  };

  return (
    <div className={styles.root}>
      {selectedReplyMessage && (
        <div className={styles.replyBox}>
          <div className={styles.replyMeta}>
            <span className={styles.replyTitle}>
              {selectedReplyTarget}
              <span className={styles.replyTitleSuffix}>에게 답장</span>
            </span>
            <span className={styles.replyText}>{replyPreviewText}</span>
          </div>
          <CloseButton type="button" onClick={onClearReply} aria-label="답장 취소" />
        </div>
      )}
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={isWarnLimited ? '채팅이 제한되었습니다' : '메시지를 입력하세요'}
          maxLength={MESSAGE_MAX_LEN}
          rows={1}
          onKeyDown={handleKeyDown}
          onChange={onInteraction}
          disabled={isWarnLimited}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
        />
        {safeWarnCount > 0 && (
          <span className={warnClassName}>
            경고 {safeWarnCount}/{MAX_WARN_COUNT}
            <span className={styles.warnTooltip}>
              {isWarnLimited
                ? `경고 ${MAX_WARN_COUNT}회 누적으로 채팅이 제한되었습니다`
                : `경고 ${MAX_WARN_COUNT}회 누적 시 서비스가 제한될 수 있습니다`}
            </span>
          </span>
        )}
        <button className={styles.sendButton} onClick={handleSend} type="button" disabled={isSendDisabled}>
          {isCooldown ? (
            <span className={styles.cooldown} style={cooldownStyle}>
              <span className={styles.cooldownTrackRing} aria-hidden="true" />
              <span className={styles.cooldownProgressRing} aria-hidden="true" />
              <span className={styles.cooldownValue}>{sendCooldownRemainingSec}</span>
            </span>
          ) : (
            '전송'
          )}
        </button>
      </div>
    </div>
  );
}
