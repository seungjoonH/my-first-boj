'use client';

import { useEffect, useState } from 'react';
import type { HistoryEntry, SearchMode } from '@/types/search';
import styles from './sidebar.module.css';

const MODE_LABELS: Record<SearchMode, string> = {
  first: '첫 제출',
  correct: '첫 정답',
  wrong: '첫 오답',
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  onDeleteEntry: (userId: string, mode: SearchMode) => void;
  onClearAll: () => void;
  isMobile: boolean;
}

export function Sidebar({
  isOpen,
  onClose,
  history,
  onSelectEntry,
  onDeleteEntry,
  onClearAll,
  isMobile,
}: SidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setIsClosing(false);
    }
    else if (mounted) {
      setIsClosing(true);
      const id = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(id);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  function handleSelect(entry: HistoryEntry) {
    onSelectEntry(entry);
    if (isMobile) onClose();
  }

  const rootClass = `${styles.root}${isClosing ? ` ${styles['root--closing']}` : ''}`;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={rootClass} aria-label="검색 기록">
        <div className={styles.header}>
          <span className={styles.title}>검색 기록</span>
          {history.length > 0 && (
            <button className={styles.clearAllButton} onClick={onClearAll} type="button">
              전체 삭제
            </button>
          )}
        </div>
        <ul className={styles.list}>
          {history.length === 0 ? (
            <li className={styles.empty}>검색 기록이 없습니다</li>
          ) : (
            history.map((entry) => (
              <li key={`${entry.userId}:${entry.mode}`} className={styles.item}>
                <button
                  className={styles.itemButton}
                  onClick={() => handleSelect(entry)}
                  type="button"
                >
                  <span className={styles.itemUserId}>{entry.userId}</span>
                  <span className={styles.itemMeta}>
                    <span className={styles.itemMode}>{MODE_LABELS[entry.mode]}</span>
                    <span className={styles.itemPercent}>
                      {entry.completedAt !== null ? '완료' : `${entry.percent}%`}
                    </span>
                  </span>
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => onDeleteEntry(entry.userId, entry.mode)}
                  type="button"
                  aria-label={`${entry.userId} ${MODE_LABELS[entry.mode]} 삭제`}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
    </>
  );
}
