'use client';

import { useCallback, useState } from 'react';
import { generateNickname, getFinalChatTier } from '@/lib/chatNickname';
import { B_BADGE_VARIANT_MAP } from '@/lib/chatConstants';
import { NicknameBadgeBase } from '../nicknameBadge/NicknameBadge';
import { TierIcon } from '../tierIcon/TierIcon';
import { ChatNicknameTierHelpDialog } from '../nicknameTierHelpDialog/ChatNicknameTierHelpDialog';
import { NicknameChangeButton } from '../nicknameChangeButton/NicknameChangeButton';
import { NicknameChangeConfirmDialog } from '../nicknameChangeConfirmDialog/NicknameChangeConfirmDialog';
import type { NicknameBarProps } from './type';
import styles from './NicknameBar.module.css';

function formatCooldown(seconds: number): string {
  if (seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}시간 후 변경 가능`;
  if (minutes > 0) return `${minutes}분 후 변경 가능`;
  return `${secs}초 후 변경 가능`;
}

export function NicknameBar({
  myUuid,
  salt,
  adminUuid,
  nickCooldownRemaining,
  nickCooldownTtlSec,
  isLoaded,
  onChangeNickname,
  onInteraction,
}: NicknameBarProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isChangeConfirmOpen, setIsChangeConfirmOpen] = useState(false);
  const { aBadge, bBadge } = generateNickname(myUuid, salt);
  const bVariant = B_BADGE_VARIANT_MAP[bBadge] ?? 'muted';
  const isCoolingDown = nickCooldownRemaining > 0;
  const isAdminUser = myUuid === adminUuid;
  const finalTier = getFinalChatTier(myUuid, salt);

  const openChangeConfirm = useCallback((): void => {
    onInteraction();
    setIsChangeConfirmOpen(true);
  }, [onInteraction]);

  const closeChangeConfirm = useCallback((): void => {
    setIsChangeConfirmOpen(false);
  }, []);

  const confirmChangeNickname = useCallback((): void => {
    setIsChangeConfirmOpen(false);
    onChangeNickname();
  }, [onChangeNickname]);

  const handleHelpOpen = (): void => {
    onInteraction();
    setIsHelpOpen(true);
  };

  const handleHelpClose = (): void => {
    setIsHelpOpen(false);
  };

  return (
    <>
      <div className={styles.root}>
        <div className={styles.nicknameRow}>
          {!isAdminUser && <TierIcon tier={finalTier} />}
          <div className={styles.nickname}>
            <NicknameBadgeBase aBadge={aBadge} bBadge={bBadge} bVariant={bVariant} />
          </div>
          {!isAdminUser && (
            <button
              className={styles.helpButton}
              type="button"
              onClick={handleHelpOpen}
              aria-label="닉네임 티어 도움말"
            >
              <img className={styles.helpIcon} src="/icons/help-circle.svg" alt="" aria-hidden />
            </button>
          )}
        </div>
        {isLoaded && (isCoolingDown ? (
          <span className={styles.cooldown}>{formatCooldown(nickCooldownRemaining)}</span>
        ) : (
          <NicknameChangeButton onClick={openChangeConfirm} />
        ))}
      </div>
      <ChatNicknameTierHelpDialog
        open={isHelpOpen}
        onClose={handleHelpClose}
        aBadge={aBadge}
        bBadge={bBadge}
        bVariant={bVariant}
        finalTier={finalTier}
        nickCooldownRemaining={nickCooldownRemaining}
        onChangeNickname={openChangeConfirm}
      />
      <NicknameChangeConfirmDialog
        open={isChangeConfirmOpen}
        onClose={closeChangeConfirm}
        onConfirm={confirmChangeNickname}
        nickCooldownTtlSec={nickCooldownTtlSec}
      />
    </>
  );
}
