import { buildCls } from '@/lib/buildCls';
import type { ChatButtonProps } from './type';
import styles from './ChatButton.module.css';

export function ChatButton({ messageCount, isCountMaxed, isOpen, onClick }: ChatButtonProps) {
  const rootCls = buildCls(styles.root, isOpen && styles['root--open']);
  const iconCls = buildCls(styles.icon, isOpen && styles['icon--open']);
  const countText = isCountMaxed ? `${messageCount.toLocaleString()}+` : messageCount.toLocaleString();

  return (
    <button
      className={rootCls}
      onClick={onClick}
      type="button"
      aria-label={isOpen ? '채팅 닫기' : '채팅 열기'}
    >
      <img src="/icons/chat.svg" alt="" className={iconCls} />
      <span className={styles.count}>{countText}</span>
    </button>
  );
}
