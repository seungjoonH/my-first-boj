'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AboutSiteDialog } from '@/components/about/AboutSiteDialog';
import { IconButton } from '@/components/iconButton/IconButton';
import { SiteNoticesMenu } from '@/components/searchNotice/SiteNoticesMenu';
import styles from './header.module.css';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const onNicknameMap = pathname === '/nickname-map';

  return (
    <header className={styles.root}>
      <IconButton
        variant="history"
        type="button"
        onClick={onToggleSidebar}
        aria-label="검색 기록 열기"
      />
      <Link href="/" className={styles.brandLink} aria-label="홈으로">
        <span className={styles.brand}>
          <img className={styles.logoIcon} src="/logo.svg" alt="" aria-hidden="true" />
          <span className={styles.logo}>MY FIRST BOJ</span>
        </span>
      </Link>
      <div className={styles.actions}>
        <Link
          className={styles.mapIconLink}
          href={onNicknameMap ? '/' : '/nickname-map'}
          aria-label={onNicknameMap ? '홈으로' : '닉네임 도감'}
        >
          <span
            className={onNicknameMap ? styles.mapHomeGlyph : styles.mapBooksGlyph}
            aria-hidden="true"
          />
        </Link>
        <SiteNoticesMenu />
        <AboutSiteDialog />
      </div>
    </header>
  );
}
