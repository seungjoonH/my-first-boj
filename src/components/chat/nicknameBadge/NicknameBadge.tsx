import { buildCls } from '@/lib/buildCls';
import type { BBadgeVariant } from '@/lib/chatConstants';
import { splitMemoryByteSuffix } from '@/lib/chatNickname';
import type { NicknameBadgeBaseProps } from './type';
import styles from './NicknameBadge.module.css';

const B_VARIANT_CLASS: Record<BBadgeVariant, string> = {
  ac: styles['badgeB--ac'],
  wa: styles['badgeB--wa'],
  tle: styles['badgeB--tle'],
  ce: styles['badgeB--ce'],
  rte: styles['badgeB--rte'],
  muted: styles['badgeB--muted'],
};

function isJudging(aBadge: string): boolean {
  return aBadge.startsWith('채점 중');
}

function isTime(aBadge: string): boolean {
  return aBadge.endsWith('전');
}

export function AdminBadge() {
  return (
    <span className={styles.adminRoot}>
      <span className={styles.adminBadge}>ADMIN</span>
    </span>
  );
}

export function NicknameBadgeBase({ aBadge, bBadge, bVariant, layout = 'default' }: NicknameBadgeBaseProps) {
  const aCls = buildCls(
    styles.badge,
    isJudging(aBadge) ? styles['badgeA--judging'] : isTime(aBadge) ? styles['badgeA--time'] : styles.badgeA,
  );
  const bCls = buildCls(styles.badge, B_VARIANT_CLASS[bVariant]);
  const aParts = splitMemoryByteSuffix(aBadge);

  return (
    <span className={buildCls(styles.root, layout === 'mapCell' && styles['root--mapCell'])}>
      <span className={aCls}>
        {aParts.unitPart !== undefined ? (
          <>
            {aParts.valuePart}
            <span className={styles.badgeAByte}>{aParts.unitPart}</span>
          </>
        ) : (
          aBadge
        )}
      </span>
      <span className={styles.separator}>{isJudging(aBadge) ? '후' : '의'}</span>
      <span className={bCls}>{bBadge}</span>
    </span>
  );
}
