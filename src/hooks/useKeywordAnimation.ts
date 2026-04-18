'use client';

import { useRef } from 'react';
import { getKeywordPosition } from '@/lib/chatNickname';
import { KEYWORD_PARALLAX_FACTOR } from '@/lib/chatConstants';

type PendingAnimation = {
  word: string;
  globalIndex: number;
  sourceBubbleId: string;
  keywordId: string;
};

const ANIMATION_START_DELAY_MIN_MS = 300;
const ANIMATION_START_DELAY_MAX_MS = 500;
const ANIMATION_DURATION_MS = 900;
const ANIMATION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ANIMATION_END_OPACITY = 0.08;

export function useKeywordAnimation(onAnimationComplete: (keywordId: string) => void) {
  const pendingRef = useRef<PendingAnimation[]>([]);

  const scheduleAnimation = (word: string, globalIndex: number, sourceBubbleId: string, keywordId: string): void => {
    pendingRef.current.push({ word, globalIndex, sourceBubbleId, keywordId });
    const delay =
      ANIMATION_START_DELAY_MIN_MS +
      Math.random() * (ANIMATION_START_DELAY_MAX_MS - ANIMATION_START_DELAY_MIN_MS);

    setTimeout(() => {
      runAnimation(word, globalIndex, sourceBubbleId, keywordId);
    }, delay);
  };

  const runAnimation = (word: string, globalIndex: number, sourceBubbleId: string, keywordId: string): void => {
    const sourceEl = document.querySelector(`[data-keyword-id="${sourceBubbleId}"]`);
    if (!sourceEl) {
      onAnimationComplete(keywordId);
      return;
    }

    const sourceRect = sourceEl.getBoundingClientRect();
    const pos = getKeywordPosition(globalIndex);
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const targetX = (pos.x / 100) * window.innerWidth;
    const parallaxOffsetY = window.scrollY * KEYWORD_PARALLAX_FACTOR;
    const targetY = (pos.y / 100) * window.innerHeight + parallaxOffsetY;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    const el = document.createElement('span');
    el.textContent = word;
    el.style.cssText = [
      'position: fixed',
      `left: ${startX}px`,
      `top: ${startY}px`,
      'transform: translate(-50%, -50%) translate3d(0px, 0px, 0px) scale(1)',
      `font-size: ${pos.fontSize}px`,
      'font-weight: 700',
      'color: var(--color-accent)',
      'pointer-events: none',
      'z-index: 9999',
      'opacity: 1',
      'will-change: transform, opacity',
    ].join('; ');

    document.body.appendChild(el);

    const animation = el.animate(
      [
        {
          transform: 'translate(-50%, -50%) translate3d(0px, 0px, 0px) scale(1)',
          opacity: 1,
        },
        {
          transform: `translate(-50%, -50%) translate3d(${deltaX}px, ${deltaY}px, 0px) scale(0.94)`,
          opacity: ANIMATION_END_OPACITY,
        },
      ],
      {
        duration: ANIMATION_DURATION_MS,
        easing: ANIMATION_EASING,
        fill: 'forwards',
      },
    );

    const cleanup = () => {
      el.remove();
      pendingRef.current = pendingRef.current.filter(
        (p) => !(p.word === word && p.globalIndex === globalIndex && p.sourceBubbleId === sourceBubbleId && p.keywordId === keywordId),
      );
      onAnimationComplete(keywordId);
    };

    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  };

  return { scheduleAnimation };
}
