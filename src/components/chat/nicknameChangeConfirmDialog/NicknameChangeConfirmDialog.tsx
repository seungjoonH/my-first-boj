'use client';

import { useCallback, useEffect, useRef } from 'react';
import { NICK_RL_TTL_SEC } from '@/lib/chatConstants';
import styles from './NicknameChangeConfirmDialog.module.css';

/** 서버 TTL(초)을 한국어 구간 문자열로 */
export function formatNickResetWaitDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '알 수 없음';
  let rest = Math.floor(seconds);
  const days = Math.floor(rest / 86400);
  rest %= 86400;
  const hours = Math.floor(rest / 3600);
  rest %= 3600;
  const minutes = Math.floor(rest / 60);
  const secs = rest % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (secs > 0) parts.push(`${secs}초`);
  return parts.join(' ') || '0초';
}

export type NicknameChangeConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** `/api/chat/init`의 `nickCooldownTtlSec` — Redis 전역 설정 반영 */
  nickCooldownTtlSec: number;
};

export function NicknameChangeConfirmDialog({
  open,
  onClose,
  onConfirm,
  nickCooldownTtlSec,
}: NicknameChangeConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const ttl = Number.isFinite(nickCooldownTtlSec) && nickCooldownTtlSec > 0 ? nickCooldownTtlSec : NICK_RL_TTL_SEC;
  const waitLabel = formatNickResetWaitDuration(ttl);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    }
    else if (el.open) {
      el.close();
    }
  }, [open]);

  const handleBackdropMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      aria-labelledby="nick-change-confirm-title"
    >
      <div className={styles.inner}>
        <h2 id="nick-change-confirm-title" className={styles.title}>
          닉네임 변경
        </h2>
        <p className={styles.p}>
          닉네임이 랜덤으로 바뀝니다. <br />변경 후에는 <strong className={styles.strong}>{waitLabel}</strong>의 재설정 대기 시간이 적용됩니다.
        </p>
        <p className={`${styles.p} ${styles.pMuted}`}>(추후 변경될 수 있습니다.)</p>
        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            취소
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleConfirm}>
            확인
          </button>
        </div>
      </div>
    </dialog>
  );
}
