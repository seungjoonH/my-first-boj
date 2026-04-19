'use client';

import { AboutSiteDialog } from '@/components/about/AboutSiteDialog';
import styles from './header.module.css';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className={styles.root}>
      <button
        className={styles.menuButton}
        onClick={onToggleSidebar}
        type="button"
        aria-label="검색 기록 열기"
      >
        <img src="/icons/menu.svg" alt="" aria-hidden="true" className={styles.menuIcon} />
      </button>
      <div className={styles.brand}>
        <img className={styles.logoIcon} src="/logo.svg" alt="" aria-hidden="true" />
        <span className={styles.logo}>MY FIRST BOJ</span>
      </div>
      <div className={styles.actions}>
        <AboutSiteDialog />
      </div>
    </header>
  );
}
