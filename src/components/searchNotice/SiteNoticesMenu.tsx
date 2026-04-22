'use client';

import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import { CloseButton } from '@/components/closeButton/CloseButton';
import { IconButton } from '@/components/iconButton/IconButton';
import { getVisibleSearchNoticesOrdered } from '@/notices/searchNoticesRegistry';
import type { SearchNoticeDef } from '@/notices/type';
import noticeStyles from './SearchNotice.module.css';
import styles from './SiteNoticesMenu.module.css';

const DIALOG_TITLE_ID = 'site-notice-dialog-title';

export function SiteNoticesMenu() {
  const labelId = useId();
  const listId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeNotice, setActiveNotice] = useState<SearchNoticeDef | null>(null);
  const visibleNotices = getVisibleSearchNoticesOrdered();

  const closeDropdown = useCallback((): void => {
    setDropdownOpen(false);
  }, []);

  const openNotice = useCallback((entry: SearchNoticeDef): void => {
    setActiveNotice(entry);
    setDropdownOpen(false);
  }, []);

  const closeDialog = useCallback((): void => {
    setActiveNotice(null);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (e: PointerEvent): void => {
      const el = menuRef.current;
      const btn = buttonRef.current;
      if (!el || !btn) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (el.contains(t) || btn.contains(t)) return;
      setDropdownOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (activeNotice) {
      if (!el.open) el.showModal();
      document.body.style.overflow = 'hidden';
    }
    else {
      if (el.open) el.close();
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeNotice]);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) {
      dialogRef.current?.close();
      closeDialog();
    }
  };

  const handleDialogClose = useCallback((): void => {
    setActiveNotice(null);
  }, []);

  const handleToggleDropdown = (): void => {
    setDropdownOpen((prev) => !prev);
  };

  const Content = activeNotice?.Content ?? null;

  return (
    <div className={styles.root} ref={menuRef}>
      <IconButton
        ref={buttonRef}
        variant="notice"
        onClick={handleToggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
        aria-controls={dropdownOpen ? listId : undefined}
        id={labelId}
        aria-label="공지 목록 열기"
      />
      <div className={styles.panel} id={listId} role="listbox" aria-labelledby={labelId} hidden={!dropdownOpen}>
        {visibleNotices.length === 0
          ? <div className={styles.empty}>표시할 공지가 없습니다</div>
          : visibleNotices.map((entry) => {
            return (
              <button
                key={entry.id}
                type="button"
                role="option"
                className={styles.item}
                onClick={() => {
                  openNotice(entry);
                }}
              >
                {entry.title}
              </button>
            );
          })}
      </div>

      <dialog
        className={noticeStyles.dialog}
        ref={dialogRef}
        onClick={handleDialogClick}
        onClose={handleDialogClose}
        aria-labelledby={DIALOG_TITLE_ID}
      >
        {activeNotice && Content && (
          <div className={noticeStyles.shell} onClick={(e) => e.stopPropagation()}>
            <div className={noticeStyles.headRow}>
              <h2 id={DIALOG_TITLE_ID} className={noticeStyles.title}>
                {activeNotice.title}
              </h2>
              <CloseButton
                onClick={(e) => {
                  e.stopPropagation();
                  dialogRef.current?.close();
                  closeDialog();
                }}
                aria-label="닫기"
              />
            </div>
            <Fragment key={activeNotice.id}>
              <Content />
            </Fragment>
          </div>
        )}
      </dialog>
    </div>
  );
}
