'use client';

import type { CSSProperties } from 'react';
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildCls } from '@/lib/buildCls';
import { TOOLTIP_Y_OFFSET_PX } from '@/lib/chatConstants';
import type { FixedHoverTooltipProps } from './type';
import styles from './fixedHoverTooltip.module.css';

export function FixedHoverTooltip({ children, content, anchorClassName }: FixedHoverTooltipProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleEnter = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.top - TOOLTIP_Y_OFFSET_PX,
    });
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <div
      ref={anchorRef}
      className={buildCls(styles.anchor, anchorClassName)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {open
        && typeof document !== 'undefined'
        && createPortal(
          <span
            className={styles.tooltip}
            role="tooltip"
            style={
              {
                '--tooltip-x': `${pos.x}px`,
                '--tooltip-y': `${pos.y}px`,
              } as CSSProperties
            }
          >
            {content}
          </span>,
          document.body,
        )}
    </div>
  );
}
