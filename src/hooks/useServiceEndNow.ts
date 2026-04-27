'use client';

import { useEffect, useState } from 'react';

/** 메인 화면 카운트다운·공지 등에서 동일 시각을 쓰기 위한 공용 틱 (ms) */
const SERVICE_END_TICK_MS = 500;

const listeners = new Set<(t: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function emitTick(t: number): void {
  for (const l of listeners) {
    l(t);
  }
}

function ensureInterval(): void {
  if (intervalId !== null) return;
  const tick = (): void => {
    emitTick(Date.now());
  };
  tick();
  intervalId = setInterval(tick, SERVICE_END_TICK_MS);
}

function stopIfIdle(): void {
  if (listeners.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * `SERVICE_END_MS` 기준 남은 시간을 쓰는 컴포넌트가 같은 시각·같은 틱에 맞춰
 * 리렌더되도록 구독한다. 구독자 0이면 interval 을 멈춘다.
 * 나중에 마운트한 컴포넌트도 `Date.now()` 한 번으로 곧바로 맞춘다.
 */
export function subscribeServiceEndNow(onTick: (now: number) => void): () => void {
  listeners.add(onTick);
  ensureInterval();
  emitTick(Date.now());
  return () => {
    listeners.delete(onTick);
    stopIfIdle();
  };
}

/**
 * 백준 서비스 종료 시각까지의 표시에 쓰는, 공용 `Date.now()` 훅.
 * `Countdown`·`SearchLoadMitigationNotice202604272` 등이 동시에 갱신된다.
 */
export function useServiceEndNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribeServiceEndNow((t) => { setNow(t); }), []);
  return now;
}
