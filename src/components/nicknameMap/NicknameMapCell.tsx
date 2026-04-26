import { B_BADGE_VARIANT_MAP } from '@/lib/chatConstants';
import { buildCls } from '@/lib/buildCls';
import { FixedHoverTooltip } from '@/components/fixedHoverTooltip/FixedHoverTooltip';
import { NicknameBadgeBase } from '@/components/chat/nicknameBadge/NicknameBadge';
import { TierIcon } from '@/components/chat/tierIcon/TierIcon';
import {
  getNicknameCellAcquisitionPercentForTooltip,
  getNicknameCellSameTierAcquisitionPercentForTooltip,
  getNicknameGridCellDisplay,
} from '@/lib/chatNickname';
import type { NicknameMapCellProps } from './type';
import styles from './NicknameMapCell.module.css';

export function NicknameMapCell({
  flatIndex,
  bIndex,
  count,
  unlocked,
  isMine,
  className,
}: NicknameMapCellProps) {
  const { aBadge, bBadge, tier } = getNicknameGridCellDisplay(flatIndex, bIndex);
  const bVariant = B_BADGE_VARIANT_MAP[bBadge] ?? 'muted';
  const isLocked = !unlocked;
  const isActive = count >= 1;
  const showCountBadge = count >= 1;

  const acquisitionPct = getNicknameCellAcquisitionPercentForTooltip(bIndex);
  const sameTierPct = getNicknameCellSameTierAcquisitionPercentForTooltip(flatIndex, bIndex);
  const tooltipContent = (
    <span className={styles.tooltipStack}>
      <span className={styles.tooltipBadgeRow}>
        <span className={styles.tooltipTierWrap}>
          <TierIcon tier={tier} />
        </span>
        <NicknameBadgeBase aBadge={aBadge} bBadge={bBadge} bVariant={bVariant} />
      </span>
      <span className={styles.tooltipProbRows}>
        <span className={styles.tooltipProb}>
          획득 확률{' '}
          <span className={styles.tooltipProbValue}>{acquisitionPct.toFixed(6)}%</span>
        </span>
        <span className={styles.tooltipProb}>
          동일 티어 확률{' '}
          <span className={styles.tooltipProbValue}>{sameTierPct.toFixed(6)}%</span>
        </span>
      </span>
    </span>
  );

  const rootClassName = buildCls(
    styles.root,
    isLocked && styles['root--locked'],
    isActive && styles['root--active'],
    isMine && styles['root--mine'],
    showCountBadge && styles['root--hasCount'],
  );

  return (
    <td
      className={buildCls(rootClassName, className)}
      data-nickname-map-col={bIndex}
    >
      <FixedHoverTooltip
        content={tooltipContent}
        anchorClassName={buildCls(
          styles.mapCellTooltipAnchor,
          isLocked && styles.anchorUnderLockVeil,
        )}
      >
        <div className={styles.inner}>
          <span className={styles.badgeRow}>
            <span className={styles.tierWrap}>
              <TierIcon tier={tier} />
            </span>
            <NicknameBadgeBase
              aBadge={aBadge}
              bBadge={bBadge}
              bVariant={bVariant}
              layout="mapCell"
            />
          </span>
        </div>
      </FixedHoverTooltip>
      {showCountBadge && <span className={styles.countBadge}>{count}</span>}
      {isLocked && (
        <div className={styles.lockWrap} aria-hidden>
          <img className={styles.lockImg} src="/icons/lock.svg" alt="" />
        </div>
      )}
    </td>
  );
}
