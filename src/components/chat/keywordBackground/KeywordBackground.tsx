'use client';

import { useEffect, useRef, useState } from 'react';
import { generateNickname, getKeywordPosition } from '@/lib/chatNickname';
import { B_BADGE_VARIANT_MAP, KEYWORD_DISPLAY_MAX, KEYWORD_PARALLAX_FACTOR, KW_ENTER_DELAY_STEP_MS, TOOLTIP_Y_OFFSET_PX } from '@/lib/chatConstants';
import { parseKeywordValue } from '@/lib/chatKeyword';
import { buildCls } from '@/lib/buildCls';
import type { KeywordBackgroundProps } from './type';
import styles from './KeywordBackground.module.css';

function getOpacityByStage(stage: number): number {
  if (stage <= 1) return 1;
  return Math.max(0, 1 - (stage - 1) / (KEYWORD_DISPLAY_MAX - 1));
}

export function KeywordBackground({
  keywords,
  saltMap,
  adminUuid,
  isVisible,
  highlightedKeywordId,
  onKeywordHover,
  onKeywordClick,
}: KeywordBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const keywordRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  type TooltipState = {
    keywordId: string;
    aBadge: string;
    bBadge: string;
    bVariant: string;
    isAdmin: boolean;
    x: number;
    y: number;
  };
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const setTooltipByKeywordId = (keywordId: string): void => {
    const el = keywordRefs.current[keywordId];
    if (!el) return;
    const parsed = parseKeywordValue(keywordId);
    const isAdminOwner = Boolean(parsed.clientUuid && adminUuid && parsed.clientUuid === adminUuid);
    const ownerSalt = parsed.clientUuid ? (saltMap[parsed.clientUuid] ?? '') : '';
    const ownerNickname = parsed.clientUuid && ownerSalt
      ? generateNickname(parsed.clientUuid, ownerSalt)
      : null;
    const payload = isAdminOwner
      ? {
          aBadge: 'ADMIN',
          bBadge: '',
          bVariant: 'muted',
          isAdmin: true,
        }
      : ownerNickname
      ? {
          aBadge: ownerNickname.aBadge,
          bBadge: ownerNickname.bBadge,
          bVariant: B_BADGE_VARIANT_MAP[ownerNickname.bBadge] ?? 'muted',
          isAdmin: false,
        }
      : {
          aBadge: '닉네임 정보',
          bBadge: '없음',
          bVariant: 'muted',
          isAdmin: false,
        };
    const rect = el.getBoundingClientRect();
    setTooltip({
      keywordId,
      ...payload,
      x: rect.left + rect.width / 2,
      y: rect.top - TOOLTIP_Y_OFFSET_PX,
    });
  };

  useEffect(() => {
    if (!isVisible) return;

    const handleScroll = () => {
      if (!rootRef.current) return;
      const offset = window.scrollY * KEYWORD_PARALLAX_FACTOR;
      rootRef.current.style.transform = `translateY(${offset}px)`;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isVisible]);

  useEffect(() => {
    if (isVisible) return;
    setTooltip(null);
    onKeywordHover(null);
  }, [isVisible, onKeywordHover]);

  useEffect(() => {
    if (!isVisible) return;
    if (!highlightedKeywordId) {
      setTooltip(null);
      return;
    }
    setTooltipByKeywordId(highlightedKeywordId);
  }, [isVisible, highlightedKeywordId, keywords, saltMap]);

  const displayed = keywords.slice(-KEYWORD_DISPLAY_MAX);

  const rootCls = buildCls(styles.root, !isVisible && styles['root--hidden']);
  const tooltipBBadgeCls = tooltip
    ? buildCls(styles.tooltipBBadge, styles[`tooltipBBadge--${tooltip.bVariant}`])
    : styles.tooltipBBadge;

  return (
    <div ref={rootRef} className={rootCls} aria-hidden="true">
      {displayed.map((kw, arrayIndex) => {
        const parsed = parseKeywordValue(kw);
        const word = parsed.word;
        const globalIndex = parsed.globalIndex ?? arrayIndex;
        const pos = getKeywordPosition(globalIndex);
        const stage = displayed.length - arrayIndex;
        const opacity = getOpacityByStage(stage);
        const isMatched = highlightedKeywordId !== null && kw === highlightedKeywordId;
        const keywordCls = buildCls(
          styles.keyword,
          isVisible && styles['keyword--enter'],
          highlightedKeywordId && (isMatched ? styles['keyword--highlighted'] : styles['keyword--dimmed']),
        );

        return (
          <span
            key={`${globalIndex}-${arrayIndex}`}
            ref={(el) => {
              keywordRefs.current[kw] = el;
            }}
            data-keyword-id={kw}
            className={keywordCls}
            onMouseEnter={() => {
              onKeywordHover(kw);
              setTooltipByKeywordId(kw);
            }}
            onMouseMove={() => {
              setTooltipByKeywordId(kw);
            }}
            onMouseLeave={() => {
              setTooltip(null);
              onKeywordHover(null);
            }}
            onClick={() => {
              onKeywordClick(kw);
            }}
            style={
              {
                '--kw-opacity': opacity,
                '--kw-x': `${pos.x}%`,
                '--kw-y': `${pos.y}%`,
                '--kw-rotation': `${pos.rotation}deg`,
                '--kw-font-size': `${pos.fontSize}px`,
                '--kw-enter-delay': `${arrayIndex * KW_ENTER_DELAY_STEP_MS}ms`,
              } as React.CSSProperties
            }
          >
            {word}
          </span>
        );
      })}
      {tooltip && (
        <span
          className={styles.tooltip}
          style={
            {
              '--tooltip-x': `${tooltip.x}px`,
              '--tooltip-y': `${tooltip.y}px`,
            } as React.CSSProperties
          }
        >
          {tooltip.isAdmin ? (
            <span className={styles.tooltipAdmin}>{tooltip.aBadge}</span>
          ) : (
            <>
              <span className={styles.tooltipABadge}>{tooltip.aBadge}</span>
              <span className={styles.tooltipSeparator}>의</span>
              <span className={tooltipBBadgeCls}>
                {tooltip.bBadge}
              </span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
