'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NICKNAME_B_COL_COUNT } from '@/lib/chatConstants';
import { buildCls } from '@/lib/buildCls';
import { observeNicknameMapLazyRow } from './nicknameMapLazyRowObserver';
import { NicknameMapCell } from './NicknameMapCell';
import cellStyles from './NicknameMapCell.module.css';
import styles from './NicknameMapGrid.module.css';

export type NicknameMapSectionRowVisual =
  | 'idle'
  /** 섹션 펼친 안정 상태: 높이만 고정(transition 없음) — 닫을 때 max-height 수축 애니메이션 기준 */
  | 'idle_layout'
  | 'expand_collapsed'
  | 'expand_expanded'
  | 'fade_in'
  | 'fade_out'
  | 'collapse_hidden';

type NicknameMapDataRowProps = {
  flatIndex: number;
  /** 뷰포트 기준 한 화면 row×2 만큼까지 즉시 무거운 셀 렌더 */
  eagerFlatIndexMax: number;
  counts: readonly number[];
  unlockedRow: readonly boolean[];
  myCell: { flatIndex: number; bIndex: number } | null;
  /** 접이식 섹션 행 애니메이션 (루비 등 비접이식은 기본 idle) */
  sectionRowVisual?: NicknameMapSectionRowVisual;
  /** 섹션 펼침 fade-in 직전에만 true — lazy 유지 시 깜빡임 방지용 */
  forceEagerForSectionFade?: boolean;
};

function rowTrClass(visual: NicknameMapSectionRowVisual): string | undefined {
  if (visual === 'idle') return undefined;
  if (visual === 'idle_layout') return styles.sectionRowOpenHeight;
  const base = styles.sectionAnimRow;
  switch (visual) {
    case 'expand_collapsed':
    case 'collapse_hidden':
      return buildCls(base, styles.sectionAnimRowCollapsed);
    case 'expand_expanded':
    case 'fade_in':
    case 'fade_out':
      return buildCls(base, styles.sectionAnimRowExpanded);
    default:
      return undefined;
  }
}

function rowTdFadeClass(visual: NicknameMapSectionRowVisual): string | undefined {
  if (visual === 'fade_in') return styles.sectionCellFadeIn;
  if (visual === 'fade_out' || visual === 'collapse_hidden') return styles.sectionCellFadeOut;
  return undefined;
}

export function NicknameMapDataRow({
  flatIndex,
  eagerFlatIndexMax,
  counts,
  unlockedRow,
  myCell,
  sectionRowVisual = 'idle',
  forceEagerForSectionFade = false,
}: NicknameMapDataRowProps) {
  const trRef = useRef<HTMLTableRowElement>(null);
  const prevForceFadeRef = useRef(false);
  /** 펼침 1·2단계: 높이만 늘리고 실제 셀은 그리지 않음(eager/IO로도 무시) */
  const expandPlaceholderOnly =
    sectionRowVisual === 'expand_collapsed' || sectionRowVisual === 'expand_expanded';
  const sectionFadeHydratedRef = useRef(false);

  const forceEagerBase =
    flatIndex <= eagerFlatIndexMax
    || (myCell !== null && myCell.flatIndex === flatIndex);
  const [lazyHeavy, setLazyHeavy] = useState(false);
  const heavy =
    !expandPlaceholderOnly && (forceEagerBase || lazyHeavy || forceEagerForSectionFade);

  useLayoutEffect(() => {
    if (forceEagerForSectionFade) sectionFadeHydratedRef.current = true;
  }, [forceEagerForSectionFade]);

  useLayoutEffect(() => {
    if (prevForceFadeRef.current && !forceEagerForSectionFade) {
      setLazyHeavy(true);
    }
    prevForceFadeRef.current = forceEagerForSectionFade;
  }, [forceEagerForSectionFade]);

  useEffect(() => {
    if (heavy || expandPlaceholderOnly) return;
    const el = trRef.current;
    if (!el) return;
    return observeNicknameMapLazyRow(el, () => setLazyHeavy(true));
  }, [heavy, expandPlaceholderOnly, flatIndex]);

  const renderHeavy = heavy;
  /** 펼침 중 ‘빈 줄’만: 행 높이를 실제 셀 목표(--nick-map-data-row-px)에 맞춤 */
  const sectionRowStandin =
    expandPlaceholderOnly && sectionRowVisual === 'expand_expanded';
  const trClass = buildCls(
    renderHeavy
      && !forceEagerBase
      && !forceEagerForSectionFade
      && !sectionFadeHydratedRef.current
      && styles.rowLazyHydrated,
    sectionRowStandin && styles.sectionRowStandin,
    rowTrClass(sectionRowVisual),
  );
  const tdFade = rowTdFadeClass(sectionRowVisual);
  const tdTight =
    sectionRowVisual === 'expand_collapsed'
    || sectionRowVisual === 'collapse_hidden'
    || sectionRowVisual === 'fade_out';
  const tdClass = buildCls(tdFade, tdTight && cellStyles.rootCollapseTight);

  return (
    <tr ref={trRef} className={trClass || undefined} data-nickname-map-row={flatIndex}>
      {renderHeavy
        ? Array.from({ length: NICKNAME_B_COL_COUNT }, (_, bIndex) => {
            const count = counts[bIndex] ?? 0;
            const isUnlocked = unlockedRow[bIndex] ?? false;
            const isMine = Boolean(
              myCell !== null && myCell.flatIndex === flatIndex && myCell.bIndex === bIndex,
            );
            return (
              <NicknameMapCell
                key={bIndex}
                flatIndex={flatIndex}
                bIndex={bIndex}
                count={count}
                unlocked={isUnlocked}
                isMine={isMine}
                className={tdClass}
              />
            );
          })
        : Array.from({ length: NICKNAME_B_COL_COUNT }, (_, bIndex) => (
            <td
              key={bIndex}
              className={buildCls(styles.lazyPlaceholderTd, tdFade, tdTight && styles.sectionPlaceholderTight)}
              aria-hidden
            />
          ))}
    </tr>
  );
}
