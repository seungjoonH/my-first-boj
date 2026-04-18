import { getTierIconPath, getTierLabelKo } from '@/lib/chatNickname';
import type { TierIconProps } from './type';
import styles from './tierIcon.module.css';

export function TierIcon({ tier }: TierIconProps) {
  const src = getTierIconPath(tier);
  const alt = `${getTierLabelKo(tier)} 티어`;

  return (
    <span className={styles.root}>
      <img className={styles.img} src={src} alt={alt} />
    </span>
  );
}
