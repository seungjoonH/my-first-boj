'use client';

import { AboutSiteDialog } from '@/components/about/AboutSiteDialog';
import { IconButton } from '@/components/iconButton/IconButton';
import { SiteNoticesMenu } from '@/components/searchNotice/SiteNoticesMenu';
import styles from './header.module.css';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className={styles.root}>
      <IconButton
        variant="history"
        type="button"
        onClick={onToggleSidebar}
        aria-label="검색 기록 열기"
      />
      <div className={styles.brand}>
        <img className={styles.logoIcon} src="/logo.svg" alt="" aria-hidden="true" />
        <span className={styles.logo}>MY FIRST BOJ</span>
      </div>
      <div className={styles.actions}>
        <SiteNoticesMenu />
        <AboutSiteDialog />
      </div>
    </header>
  );
}
