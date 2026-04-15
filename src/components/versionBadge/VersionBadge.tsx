import packageJson from '../../../package.json';
import styles from './versionBadge.module.css';

const APP_VERSION = packageJson.version;

export function VersionBadge() {
  return (
    <small className={styles.badge} aria-label="애플리케이션 버전">
      v{APP_VERSION}
    </small>
  );
}
