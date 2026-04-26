'use client';

import {
  Fragment,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  B_BADGES,
  B_BADGE_VARIANT_MAP,
  type BBadgeVariant,
} from '@/lib/chatConstants';
import { buildCls } from '@/lib/buildCls';
import {
  A_BADGE_FLAT_TOTAL,
  getNicknameMapSectionIdForFlatIndex,
  NICKNAME_FLAT_SECTIONS,
} from '@/lib/chatNickname';
import { NICKNAME_MAP_DATA_ROW_PX } from '@/lib/nicknameMapLayout';
import type { NicknameTableSnapshot } from '@/types/chatNicknameTable';
import type { NicknameMapGridHandle, NicknameMapScrollToCellOptions } from './type';
import cellStyles from './NicknameMapCell.module.css';
import { NicknameMapCollapsibleSection } from './NicknameMapCollapsibleSection';
import { NicknameMapDataRow } from './NicknameMapDataRow';
import styles from './NicknameMapGrid.module.css';


const SCROLL_TO_CELL_MAX_ATTEMPTS = 80;
const SCROLL_TO_CELL_ATTEMPT_MS = 50;
const NICKNAME_MAP_SCROLL_SETTLE_DELAY_MS = 1200;
const NICKNAME_MAP_SCROLL_SETTLE_FORCE_MS = 2600;
const NICKNAME_MAP_POST_SCROLL_PAUSE_BEFORE_SHAKE_MS = 380;
const NICKNAME_MAP_CELL_SHAKE_CLASS_CLEAR_MS = 520;
const NICKNAME_MAP_SHAKE_TD_MAX_ATTEMPTS = 50;
const NICKNAME_MAP_SHAKE_TD_ATTEMPT_MS = 45;

function countUnlockedRowsForColumnAll(unlocked: boolean[][], bIndex: number): number {
  let n = 0;
  for (let f = 0; f < A_BADGE_FLAT_TOTAL; f++) {
    if (unlocked[f][bIndex]) n += 1;
  }
  return n;
}

function thVariantClass(variant: BBadgeVariant): string {
  switch (variant) {
    case 'ac': return styles['thB--ac'];
    case 'wa': return styles['thB--wa'];
    case 'tle': return styles['thB--tle'];
    case 'ce': return styles['thB--ce'];
    case 'rte': return styles['thB--rte'];
    case 'muted': return styles['thB--muted'];
    default: return styles['thB--muted'];
  }
}

/** 초기에 열어 둘 접이식 섹션 id(없으면 전부 접힘) */
const DEFAULT_EXPANDED_SECTION_ID =
  NICKNAME_FLAT_SECTIONS.find((s) => s.id !== 'ruby')?.id ?? null;

function createInitialExpandedSectionIds(): Set<string> {
  const next = new Set<string>();
  if (DEFAULT_EXPANDED_SECTION_ID !== null) next.add(DEFAULT_EXPANDED_SECTION_ID);
  return next;
}

function flatIndicesForSection(flatStart: number, flatEnd: number): number[] {
  const out: number[] = [];
  for (let f = flatStart; f <= flatEnd; f++) out.push(f);
  return out;
}

function sectionFlatRows(section: { flatStart: number; flatEnd: number; flatIndices?: readonly number[] }): number[] {
  if (section.flatIndices !== undefined && section.flatIndices.length > 0) {
    return [...section.flatIndices];
  }
  return flatIndicesForSection(section.flatStart, section.flatEnd);
}

/** 데이터 행 한 줄 높이 — `nicknameMapLayout`·`--nick-map-data-row-px`와 동기 */
const NICKNAME_MAP_ROW_EST_PX = NICKNAME_MAP_DATA_ROW_PX;
/** thead + 구간 헤더 한 줄 등 스크롤 영역에서 빼는 여유 */
/** thead + 구간 헤더 등 — 데이터 행이 낮아지면 한 화면에 더 많이 들어가므로 여유만 소폭 축소 */
const NICKNAME_MAP_TABLE_CHROME_PX = 88;

function computeEagerFlatIndexMax(scrollAreaHeightPx: number): number {
  const h = scrollAreaHeightPx > 48 ? scrollAreaHeightPx : (typeof window !== 'undefined' ? window.innerHeight : 520);
  const dataH = Math.max(h - NICKNAME_MAP_TABLE_CHROME_PX, 90);
  const rowsOneScreen = Math.max(Math.ceil(dataH / NICKNAME_MAP_ROW_EST_PX), 4);
  const eagerRows = rowsOneScreen * 2;
  return Math.min(Math.max(eagerRows - 1, 11), A_BADGE_FLAT_TOTAL - 1);
}

type NicknameMapGridProps = {
  snapshot: NicknameTableSnapshot;
  myCell: { flatIndex: number; bIndex: number } | null;
};

export const NicknameMapGrid = forwardRef<NicknameMapGridHandle, NicknameMapGridProps>(
  function NicknameMapGrid({ snapshot, myCell }, ref) {
    const { occupancy, unlocked } = snapshot;
    const [expandedSectionIds, setExpandedSectionIds] = useState(createInitialExpandedSectionIds);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [eagerFlatIndexMax, setEagerFlatIndexMax] = useState(() =>
      typeof window !== 'undefined' ? computeEagerFlatIndexMax(window.innerHeight) : 24,
    );

    useLayoutEffect(() => {
      const el = tableScrollRef.current;
      const run = () => {
        const h = el?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 520);
        setEagerFlatIndexMax(computeEagerFlatIndexMax(h));
      };
      run();
      if (!el) return undefined;
      const ro = new ResizeObserver(run);
      ro.observe(el);
      window.addEventListener('resize', run);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', run);
      };
    }, []);

    const handleSectionToggle = useCallback((sectionId: string) => {
      setExpandedSectionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) next.delete(sectionId);
        else next.add(sectionId);
        return next;
      });
    }, []);

    const scrollToCell = useCallback(
      (flatIndex: number, bIndex: number, opts?: NicknameMapScrollToCellOptions) => {
        const wantShake = opts?.shake === true;
        const sectionId = getNicknameMapSectionIdForFlatIndex(flatIndex);
        setEagerFlatIndexMax((prev) => Math.max(prev, flatIndex));
        if (sectionId !== 'ruby') {
          setExpandedSectionIds((prev) => {
            const next = new Set(prev);
            next.add(sectionId);
            return next;
          });
        }
        let attempt = 0;
        const tryAfter = (delayMs: number) => {
          window.setTimeout(() => {
            const root = tableScrollRef.current;
            const row = root?.querySelector(`[data-nickname-map-row="${flatIndex}"]`);
            if (row instanceof HTMLElement) {
              row.scrollIntoView({ block: 'center', behavior: 'smooth' });
              if (wantShake) {
                const flatIdx = flatIndex;
                const bIdx = bIndex;
                const applyShakeToTargetCell = () => {
                  let shakeAttempt = 0;
                  const tryShake = () => {
                    const container = tableScrollRef.current;
                    if (!container) return;
                    const td = container.querySelector(
                      `[data-nickname-map-row="${flatIdx}"] td[data-nickname-map-col="${bIdx}"]`,
                    );
                    if (td instanceof HTMLElement) {
                      td.classList.remove(cellStyles['root--shakeJump']);
                      requestAnimationFrame(() => {
                        td.classList.add(cellStyles['root--shakeJump']);
                        window.setTimeout(() => {
                          td.classList.remove(cellStyles['root--shakeJump']);
                        }, NICKNAME_MAP_CELL_SHAKE_CLASS_CLEAR_MS);
                      });
                      return;
                    }
                    shakeAttempt += 1;
                    if (shakeAttempt >= NICKNAME_MAP_SHAKE_TD_MAX_ATTEMPTS) return;
                    window.setTimeout(tryShake, NICKNAME_MAP_SHAKE_TD_ATTEMPT_MS);
                  };
                  tryShake();
                };
                const scroller = tableScrollRef.current;
                let settleTimer: number | null = null;
                let forceTimer: number | null = null;
                let shakeScheduled = false;
                const clearTimers = () => {
                  if (settleTimer !== null) {
                    window.clearTimeout(settleTimer);
                    settleTimer = null;
                  }
                  if (forceTimer !== null) {
                    window.clearTimeout(forceTimer);
                    forceTimer = null;
                  }
                };
                const detachScroll = () => {
                  if (!scroller) return;
                  scroller.removeEventListener('scroll', onScroll);
                };
                const runShakeOnce = () => {
                  if (shakeScheduled) return;
                  shakeScheduled = true;
                  clearTimers();
                  detachScroll();
                  window.setTimeout(applyShakeToTargetCell, NICKNAME_MAP_POST_SCROLL_PAUSE_BEFORE_SHAKE_MS);
                };
                const armSettleTimer = () => {
                  if (settleTimer !== null) window.clearTimeout(settleTimer);
                  settleTimer = window.setTimeout(runShakeOnce, NICKNAME_MAP_SCROLL_SETTLE_DELAY_MS);
                };
                const onScroll = () => {
                  armSettleTimer();
                };
                if (!scroller) {
                  window.setTimeout(runShakeOnce, 0);
                }
                else {
                  scroller.addEventListener('scroll', onScroll, { passive: true });
                  armSettleTimer();
                  forceTimer = window.setTimeout(runShakeOnce, NICKNAME_MAP_SCROLL_SETTLE_FORCE_MS);
                }
              }
              return;
            }
            attempt += 1;
            if (attempt >= SCROLL_TO_CELL_MAX_ATTEMPTS) return;
            tryAfter(SCROLL_TO_CELL_ATTEMPT_MS);
          }, delayMs);
        };
        tryAfter(0);
      },
      [],
    );

    useImperativeHandle(ref, () => ({ scrollToCell }), [scrollToCell]);

    return (
      <div ref={tableScrollRef} className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {B_BADGES.map((badgeLabel, bIndex) => {
                const variant = B_BADGE_VARIANT_MAP[badgeLabel] ?? 'muted';
                const unlockedRows = countUnlockedRowsForColumnAll(unlocked, bIndex);
                const ratioLabel = `${unlockedRows}/${A_BADGE_FLAT_TOTAL}`;
                const thClassName = buildCls(styles.thB, thVariantClass(variant));
                return (
                  <th key={badgeLabel} className={thClassName} scope="col">
                    <span className={styles.bHead}>{badgeLabel}</span>
                    <span className={styles.ratio}>{ratioLabel}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {NICKNAME_FLAT_SECTIONS.map((section) => {
              if (section.id === 'ruby') {
                const flatRows = sectionFlatRows(section);
                return (
                  <Fragment key={section.id}>
                    {flatRows.map((flatIndex) => (
                      <NicknameMapDataRow
                        key={flatIndex}
                        flatIndex={flatIndex}
                        eagerFlatIndexMax={eagerFlatIndexMax}
                        counts={occupancy[flatIndex] ?? []}
                        unlockedRow={unlocked[flatIndex] ?? []}
                        myCell={myCell}
                      />
                    ))}
                  </Fragment>
                );
              }
              const isOpen = expandedSectionIds.has(section.id);
              return (
                <NicknameMapCollapsibleSection
                  key={section.id}
                  section={section}
                  isOpen={isOpen}
                  onToggle={() => handleSectionToggle(section.id)}
                  eagerFlatIndexMax={eagerFlatIndexMax}
                  snapshot={snapshot}
                  myCell={myCell}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
);

NicknameMapGrid.displayName = 'NicknameMapGrid';
