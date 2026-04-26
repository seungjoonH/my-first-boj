'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { NICKNAME_B_COL_COUNT } from '@/lib/chatConstants';
import { buildCls } from '@/lib/buildCls';
import type { NicknameFlatSectionMeta } from '@/lib/chatNickname';
import { NICKNAME_MAP_DATA_ROW_PX } from '@/lib/nicknameMapLayout';
import type { NicknameTableSnapshot } from '@/types/chatNicknameTable';
import { NicknameMapDataRow, type NicknameMapSectionRowVisual } from './NicknameMapDataRow';
import styles from './NicknameMapGrid.module.css';

/** 펼침: 빈 영역(행 높이) 확장 → 잠시 유지 → 셀 fade-in. 접힘: 셀 fade-out → 높이 수축 */
const EXPAND_MS = 340;
/** 높이만 확장된 빈 줄이 보인 뒤, 실제 셀 fade-in 전에 유지하는 시간 */
const HOLD_EMPTY_AFTER_EXPAND_MS = 160;
const FADE_OUT_MS = 220;
/** `sectionAnimRow` max-height transition(360ms) + 여유 */
const COLLAPSE_MS = 400;
const FADE_IN_MS = 280;

type SectionBodyAnim =
  | 'closed'
  | 'opening_expand'
  | 'opening_expand_ui'
  | 'opening_fade'
  | 'open'
  | 'closing_fade'
  | 'closing_collapse';

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = () => setReduce(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduce;
}

function sectionFlatRows(section: NicknameFlatSectionMeta): number[] {
  if (section.flatIndices !== undefined && section.flatIndices.length > 0) {
    return [...section.flatIndices];
  }
  const out: number[] = [];
  for (let f = section.flatStart; f <= section.flatEnd; f++) out.push(f);
  return out;
}

function mapAnimToRowVisual(anim: SectionBodyAnim): NicknameMapSectionRowVisual {
  switch (anim) {
    case 'opening_expand':
      return 'expand_collapsed';
    case 'opening_expand_ui':
      return 'expand_expanded';
    case 'opening_fade':
      return 'fade_in';
    case 'open':
      return 'idle_layout';
    case 'closing_fade':
      return 'fade_out';
    case 'closing_collapse':
      return 'collapse_hidden';
    case 'closed':
      return 'idle';
    default:
      return 'idle';
  }
}

export function NicknameMapCollapsibleSection({
  section,
  isOpen,
  onToggle,
  eagerFlatIndexMax,
  snapshot,
  myCell,
}: {
  section: NicknameFlatSectionMeta;
  isOpen: boolean;
  onToggle: () => void;
  eagerFlatIndexMax: number;
  snapshot: NicknameTableSnapshot;
  myCell: { flatIndex: number; bIndex: number } | null;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const { occupancy, unlocked } = snapshot;
  const flatRows = sectionFlatRows(section);
  const prevOpenRef = useRef(isOpen);
  const animGenRef = useRef(0);
  const timeoutIdsRef = useRef<number[]>([]);

  const [bodyAnim, setBodyAnim] = useState<SectionBodyAnim>(() =>
    isOpen ? 'open' : 'closed',
  );

  const clearTimers = useCallback(() => {
    for (const id of timeoutIdsRef.current) window.clearTimeout(id);
    timeoutIdsRef.current = [];
  }, []);

  const pushTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutIdsRef.current.push(id);
    return id;
  }, []);

  useLayoutEffect(() => {
    if (reduceMotion) {
      clearTimers();
      setBodyAnim(isOpen ? 'open' : 'closed');
      prevOpenRef.current = isOpen;
      return;
    }

    const prev = prevOpenRef.current;
    if (prev === isOpen) return;

    animGenRef.current += 1;
    const gen = animGenRef.current;
    clearTimers();

    if (!isOpen && prev) {
      setBodyAnim('closing_fade');
      pushTimeout(() => {
        if (animGenRef.current !== gen) return;
        /* tr max-height 전환이 적용되도록 fade 적용 후 레이아웃 한 틱 양보 */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (animGenRef.current !== gen) return;
            setBodyAnim('closing_collapse');
          });
        });
      }, FADE_OUT_MS);
      pushTimeout(() => {
        if (animGenRef.current !== gen) return;
        setBodyAnim('closed');
      }, FADE_OUT_MS + COLLAPSE_MS);
    } else if (isOpen && !prev) {
      setBodyAnim('opening_expand');
    }

    prevOpenRef.current = isOpen;
  }, [isOpen, reduceMotion, clearTimers, pushTimeout]);

  useLayoutEffect(() => {
    if (reduceMotion || bodyAnim !== 'opening_expand') return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setBodyAnim((a) => (a === 'opening_expand' ? 'opening_expand_ui' : a));
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [bodyAnim, reduceMotion]);

  useLayoutEffect(() => {
    if (reduceMotion || bodyAnim !== 'opening_expand_ui') return;
    const gen = animGenRef.current;
    const t1 = window.setTimeout(() => {
      if (animGenRef.current !== gen) return;
      setBodyAnim('opening_fade');
    }, EXPAND_MS + HOLD_EMPTY_AFTER_EXPAND_MS);
    return () => window.clearTimeout(t1);
  }, [bodyAnim, reduceMotion]);

  useLayoutEffect(() => {
    if (reduceMotion || bodyAnim !== 'opening_fade') return;
    const gen = animGenRef.current;
    const t = window.setTimeout(() => {
      if (animGenRef.current !== gen) return;
      setBodyAnim('open');
    }, FADE_IN_MS);
    return () => window.clearTimeout(t);
  }, [bodyAnim, reduceMotion]);

  const rowVisual = mapAnimToRowVisual(bodyAnim);
  const forceEagerForFade = bodyAnim === 'opening_fade';
  const toggleClassName = buildCls(styles.sectionToggle, !isOpen && styles['sectionToggle--collapsed']);
  const showRows = bodyAnim !== 'closed';
  /** N행 전체 높이를 한 덩어리로 펼침(테이블에서 tr별 max-height가 누적되지 않는 문제 회피) */
  const showOpeningShell =
    !reduceMotion
    && flatRows.length > 0
    && (bodyAnim === 'opening_expand' || bodyAnim === 'opening_expand_ui');
  const showDataRows = showRows && !showOpeningShell;
  const shellTotalPx = flatRows.length * NICKNAME_MAP_DATA_ROW_PX;
  const shellHeightPx = bodyAnim === 'opening_expand_ui' ? shellTotalPx : 0;

  return (
    <>
      <tr className={styles.sectionHeadRow}>
        <td colSpan={NICKNAME_B_COL_COUNT} className={styles.sectionHeadCell}>
          <button
            type="button"
            className={toggleClassName}
            aria-expanded={isOpen}
            aria-label={`${section.titleKo}, ${section.rowCount}행`}
            onClick={onToggle}
          >
            <span className={styles.sectionChevron} aria-hidden>
              {isOpen ? '▼' : '▶'}
            </span>
            <span className={styles.sectionTitle}>
              {section.titleLangTierIcon !== undefined ? (
                <span className={styles.sectionTitleTierLang}>
                  <img
                    className={styles.sectionTitleTierIcon}
                    src={`/icons/tier-${section.titleLangTierIcon}.svg`}
                    alt=""
                    draggable={false}
                    aria-hidden
                  />
                  <span>언어</span>
                </span>
              ) : (
                section.titleKo
              )}
            </span>
            <span className={styles.sectionMeta} aria-hidden>
              {section.rowCount}행
            </span>
          </button>
        </td>
      </tr>
      {showOpeningShell && (
        <tr aria-hidden className={styles.sectionOpenShellRow}>
          <td colSpan={NICKNAME_B_COL_COUNT} className={styles.sectionOpenShellCell}>
            <div
              className={styles.sectionOpenShellInner}
              style={{ height: shellHeightPx }}
            />
          </td>
        </tr>
      )}
      {showDataRows
        && flatRows.map((flatIndex) => (
          <NicknameMapDataRow
            key={flatIndex}
            flatIndex={flatIndex}
            eagerFlatIndexMax={eagerFlatIndexMax}
            counts={occupancy[flatIndex] ?? []}
            unlockedRow={unlocked[flatIndex] ?? []}
            myCell={myCell}
            sectionRowVisual={rowVisual}
            forceEagerForSectionFade={forceEagerForFade}
          />
        ))}
    </>
  );
}
