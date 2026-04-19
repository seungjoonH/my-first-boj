'use client';

import { useEffect, useState } from 'react';
import { buildCls } from '@/lib/buildCls';
import type { InputAreaProps } from './type';
import styles from './inputArea.module.css';

const DOT_INTERVAL_MS = 400;
const PHASE_INTERVAL_MS = 500;
const PHASE_MESSAGES = ['찾는 중', '오래 걸릴 수 있어요', '조금만 더 기다려주세요', '완료!'] as const;
const PERCENT_THRESHOLDS = [40, 70] as const;
const TIME_THRESHOLDS_MS = [20_000, 40_000] as const;

function getTimeBasedPhase(elapsedMs: number): 0 | 1 | 2 {
  if (elapsedMs >= TIME_THRESHOLDS_MS[1]) return 2;
  if (elapsedMs >= TIME_THRESHOLDS_MS[0]) return 1;
  return 0;
}

function getProgressBasedPhase(progress: number): 0 | 1 | 2 | 3 {
  if (progress >= 100) return 3;
  if (progress >= PERCENT_THRESHOLDS[1]) return 2;
  if (progress >= PERCENT_THRESHOLDS[0]) return 1;
  return 0;
}

export function InputArea({
  value,
  onChange,
  onSubmit,
  disabled,
  isLoading = false,
  progress = 0,
  savedProgress,
}: InputAreaProps) {
  const [dotCount, setDotCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    const startedAt = Date.now();

    const dotId = setInterval(() => setDotCount((n) => (n + 1) % 4), DOT_INTERVAL_MS);
    const clockId = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, PHASE_INTERVAL_MS);

    return () => {
      clearInterval(dotId);
      clearInterval(clockId);
    };
  }, [isLoading]);

  const effectiveElapsedMs = isLoading && progress > 0 ? elapsedMs : 0;
  const phase = isLoading
    ? Math.max(getTimeBasedPhase(effectiveElapsedMs), getProgressBasedPhase(progress))
    : 0;
  const isDone = phase === 3;
  const dots = isDone ? '' : '.'.repeat(dotCount);
  const isSubmitDisabled = disabled || value.trim() === '';
  const buttonClassName = buildCls(styles.button, isLoading && styles.loading);

  const progressPct = isLoading
    ? `${progress}%`
    : savedProgress != null && savedProgress > 0
      ? `${savedProgress}%`
      : '100%';

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !isSubmitDisabled) onSubmit();
  }

  const idleLabel =
    savedProgress != null && savedProgress > 0
      ? `찾아보기 (${savedProgress}%)`
      : '찾아보기';

  return (
    <div className={styles.root}>
      <input
        className={styles.input}
        type="text"
        placeholder="백준 아이디를 입력하세요"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        className={buttonClassName}
        onClick={onSubmit}
        disabled={isSubmitDisabled}
        style={{ '--progress-pct': progressPct } as React.CSSProperties}
      >
        {isLoading ? (
          <span>
            <span className={styles.messageText}>{PHASE_MESSAGES[phase]}</span>
            <span className={styles.dots}>{dots}</span>
            <span className={styles.percent}> ({Math.round(progress)}%)</span>
          </span>
        ) : (
          idleLabel
        )}
      </button>
    </div>
  );
}
