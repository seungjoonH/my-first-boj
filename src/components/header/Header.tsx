import { AboutSiteDialog } from '@/components/about/AboutSiteDialog';
import styles from './header.module.css';

export function Header() {
  return (
    <header className={styles.root}>
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
