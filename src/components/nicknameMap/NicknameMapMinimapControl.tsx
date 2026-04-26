'use client';

import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { NicknameBadgeBase } from '@/components/chat/nicknameBadge/NicknameBadge';
import { TierIcon } from '@/components/chat/tierIcon/TierIcon';
import {
  B_BADGE_VARIANT_MAP,
  NICKNAME_B_COL_COUNT,
  TOOLTIP_Y_OFFSET_PX,
} from '@/lib/chatConstants';
import { buildCls } from '@/lib/buildCls';
import {
  A_BADGE_FLAT_TOTAL,
  getNicknameGridCellDisplay,
} from '@/lib/chatNickname';
import type { NicknameTableSnapshot } from '@/types/chatNicknameTable';
import type { NicknameMapGridHandle } from './type';
import cellStyles from './NicknameMapCell.module.css';
import styles from './NicknameMapMinimapControl.module.css';

const MINIMAP_ICON_SRC = '/icons/nickname-map-minimap.svg';
/** 호버 모드에서 `mouseleave` 직후 바로 닫히지 않도록 */
const MINIMAP_HOVER_CLOSE_DELAY_MS = 280;
/** `popover` 페이드 CSS와 맞춤 — `transitionend` 미발화 시 언마운트 */
const MINIMAP_POPOVER_UNMOUNT_FAILSAFE_MS = 400;

type MinimapInteractionMode = 'hover_zone' | 'toggle_button';

function readMinimapInteractionMode(): MinimapInteractionMode {
  if (typeof window === 'undefined') return 'toggle_button';
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ? 'hover_zone'
    : 'toggle_button';
}

type TooltipTarget = {
  flatIndex: number;
  bIndex: number;
  anchorX: number;
  anchorY: number;
};

type NicknameMapMinimapControlProps = {
  snapshot: NicknameTableSnapshot;
  myCell: { flatIndex: number; bIndex: number } | null;
  gridRef: RefObject<NicknameMapGridHandle | null>;
};

export function NicknameMapMinimapControl({
  snapshot,
  myCell,
  gridRef,
}: NicknameMapMinimapControlProps) {
  const { unlocked } = snapshot;
  const rootRef = useRef<HTMLDivElement>(null);
  const gridSurfaceRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const [interactionMode, setInteractionMode] = useState<MinimapInteractionMode>(readMinimapInteractionMode);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverMounted, setPopoverMounted] = useState(false);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [tooltipTarget, setTooltipTarget] = useState<TooltipTarget | null>(null);
  const popoverEnterFramesRef = useRef<{ outer?: number; inner?: number }>({});

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const fn = () => setInteractionMode(mq.matches ? 'hover_zone' : 'toggle_button');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || interactionMode === 'hover_zone') return undefined;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (rootRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [isOpen, interactionMode]);

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current === null) return;
    window.clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setTooltipTarget(null);
      clearHoverCloseTimer();
    }
  }, [isOpen, clearHoverCloseTimer]);

  useEffect(() => () => clearHoverCloseTimer(), [clearHoverCloseTimer]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    setPopoverMounted(true);
    setPopoverVisible(false);
    popoverEnterFramesRef.current.outer = window.requestAnimationFrame(() => {
      popoverEnterFramesRef.current.inner = window.requestAnimationFrame(() => {
        popoverEnterFramesRef.current.inner = undefined;
        setPopoverVisible(true);
      });
    });
    return () => {
      if (popoverEnterFramesRef.current.outer !== undefined) {
        window.cancelAnimationFrame(popoverEnterFramesRef.current.outer);
      }
      if (popoverEnterFramesRef.current.inner !== undefined) {
        window.cancelAnimationFrame(popoverEnterFramesRef.current.inner);
      }
      popoverEnterFramesRef.current = {};
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setPopoverVisible(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen || !popoverMounted) return undefined;
    const id = window.setTimeout(() => {
      setPopoverMounted(false);
    }, MINIMAP_POPOVER_UNMOUNT_FAILSAFE_MS);
    return () => window.clearTimeout(id);
  }, [isOpen, popoverMounted]);

  const handlePopoverTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'opacity') return;
      if (isOpen) return;
      setPopoverMounted(false);
    },
    [isOpen],
  );

  const handleHoverZoneEnter = useCallback(() => {
    clearHoverCloseTimer();
    if (interactionMode !== 'hover_zone') return;
    setIsOpen(true);
  }, [interactionMode, clearHoverCloseTimer]);

  const handleHoverZoneLeave = useCallback(
    (e: React.MouseEvent) => {
      if (interactionMode !== 'hover_zone') return;
      const next = e.relatedTarget;
      if (next instanceof Node && rootRef.current?.contains(next)) return;
      clearHoverCloseTimer();
      hoverCloseTimerRef.current = window.setTimeout(() => {
        hoverCloseTimerRef.current = null;
        setIsOpen(false);
      }, MINIMAP_HOVER_CLOSE_DELAY_MS);
    },
    [interactionMode, clearHoverCloseTimer],
  );

  const handleButtonClick = useCallback(() => {
    if (interactionMode === 'toggle_button') setIsOpen((v) => !v);
  }, [interactionMode]);

  const handleButtonFocus = useCallback(() => {
    if (interactionMode === 'hover_zone') setIsOpen(true);
  }, [interactionMode]);

  const handleButtonBlur = useCallback(() => {
    if (interactionMode !== 'hover_zone') return;
    window.requestAnimationFrame(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      setIsOpen(false);
    });
  }, [interactionMode]);

  const handleGridPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const grid = gridSurfaceRef.current;
    if (!grid) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit?.closest('[data-minimap-cell]');
    if (!cell || !grid.contains(cell)) {
      setTooltipTarget(null);
      return;
    }
    const flatRaw = cell.getAttribute('data-flat-index');
    const bRaw = cell.getAttribute('data-b-index');
    const flatIndex = flatRaw == null ? NaN : Number(flatRaw);
    const bIndex = bRaw == null ? NaN : Number(bRaw);
    if (!Number.isFinite(flatIndex) || !Number.isFinite(bIndex)) {
      setTooltipTarget(null);
      return;
    }
    const rect = cell.getBoundingClientRect();
    setTooltipTarget({
      flatIndex,
      bIndex,
      anchorX: rect.left + rect.width / 2,
      anchorY: rect.top,
    });
  }, []);

  const handleGridPointerLeave = useCallback(() => {
    setTooltipTarget(null);
  }, []);

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const cell = (e.target as HTMLElement).closest('[data-minimap-cell]');
      if (!cell) return;
      const flatRaw = cell.getAttribute('data-flat-index');
      const bRaw = cell.getAttribute('data-b-index');
      const flatIndex = flatRaw == null ? NaN : Number(flatRaw);
      const bIndex = bRaw == null ? NaN : Number(bRaw);
      if (!Number.isFinite(flatIndex) || !Number.isFinite(bIndex)) return;
      gridRef.current?.scrollToCell(flatIndex, bIndex, { shake: true });
      if (interactionMode === 'toggle_button') setIsOpen(false);
    },
    [gridRef, interactionMode],
  );

  const minimapCells = useMemo(() => {
    const items: ReactElement[] = [];
    for (let f = 0; f < A_BADGE_FLAT_TOTAL; f++) {
      for (let b = 0; b < NICKNAME_B_COL_COUNT; b++) {
        const isUnlocked = unlocked[f]?.[b] ?? false;
        const isMine = myCell !== null && myCell.flatIndex === f && myCell.bIndex === b;
        let cellToneClass: string;
        if (isMine) {
          cellToneClass = styles['minimapCell--mine'];
        }
        else if (isUnlocked) {
          cellToneClass = styles['minimapCell--unlocked'];
        }
        else {
          cellToneClass = styles['minimapCell--locked'];
        }
        const cellClassName = buildCls(styles.minimapCell, cellToneClass);
        items.push(
          <div
            key={`${f}-${b}`}
            className={cellClassName}
            data-minimap-cell
            data-flat-index={f}
            data-b-index={b}
          />,
        );
      }
    }
    return items;
  }, [unlocked, myCell]);

  let tooltipPortal: ReactNode = null;
  if (popoverVisible && tooltipTarget !== null && typeof document !== 'undefined') {
    const { aBadge, bBadge, tier } = getNicknameGridCellDisplay(
      tooltipTarget.flatIndex,
      tooltipTarget.bIndex,
    );
    const bVariant = B_BADGE_VARIANT_MAP[bBadge] ?? 'muted';
    const tooltipStyle = {
      '--tooltip-x': `${tooltipTarget.anchorX}px`,
      '--tooltip-y': `${tooltipTarget.anchorY - TOOLTIP_Y_OFFSET_PX}px`,
    } as CSSProperties;
    const tooltipClassName = styles.minimapTooltip;
    tooltipPortal = createPortal(
      <span className={tooltipClassName} role="tooltip" style={tooltipStyle}>
        <span className={cellStyles.tooltipStack}>
          <span className={cellStyles.tooltipBadgeRow}>
            <span className={cellStyles.tooltipTierWrap}>
              <TierIcon tier={tier} />
            </span>
            <NicknameBadgeBase aBadge={aBadge} bBadge={bBadge} bVariant={bVariant} />
          </span>
        </span>
      </span>,
      document.body,
    );
  }

  const popoverId = 'nickname-map-minimap-popover';
  const buttonClassName = styles.iconButton;
  const popoverClassName = buildCls(styles.popover, popoverVisible && styles.popoverVisible);
  const gridClassName = styles.minimapGrid;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onMouseEnter={handleHoverZoneEnter}
      onMouseLeave={handleHoverZoneLeave}
    >
      <button
        type="button"
        className={buttonClassName}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={popoverId}
        aria-label="전체 닉네임 격자 미니맵"
        onClick={handleButtonClick}
        onFocus={handleButtonFocus}
        onBlur={handleButtonBlur}
      >
        <img className={styles.iconImg} src={MINIMAP_ICON_SRC} alt="" draggable={false} />
      </button>
      {popoverMounted && (
        <div
          id={popoverId}
          className={popoverClassName}
          role="region"
          aria-label="591행 9열 격자 미리보기"
          aria-hidden={!popoverVisible}
          onTransitionEnd={handlePopoverTransitionEnd}
        >
          <div
            ref={gridSurfaceRef}
            className={gridClassName}
            aria-hidden
            onPointerMove={handleGridPointerMove}
            onPointerLeave={handleGridPointerLeave}
            onClick={handleGridClick}
          >
            {minimapCells}
          </div>
        </div>
      )}
      {tooltipPortal}
    </div>
  );
}
