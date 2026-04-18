'use client';

import { buildCls } from '@/lib/buildCls';
import styles from './NicknameChangeButton.module.css';

export type NicknameChangeButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function NicknameChangeButton({ onClick, disabled, className }: NicknameChangeButtonProps) {
  return (
    <button
      type="button"
      className={buildCls(styles.root, className)}
      onClick={onClick}
      disabled={disabled}
    >
      닉네임 변경
    </button>
  );
}
