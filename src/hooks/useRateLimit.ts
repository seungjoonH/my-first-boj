'use client';

import { useCallback, useRef } from 'react';

const WINDOW_MS = 30_000;
const MAX_CLICKS = 2;

export function useRateLimit() {
  const timestampsRef = useRef<number[]>([]);

  const getRecentTimestamps = useCallback(() => {
    const now = Date.now();
    return timestampsRef.current.filter((timestamp) => now - timestamp < WINDOW_MS);
  }, []);

  const isLimited = (): boolean => {
    const recentTimestamps = getRecentTimestamps();
    return recentTimestamps.length >= MAX_CLICKS;
  };

  const remainingSeconds = (): number => {
    const now = Date.now();
    const recentTimestamps = getRecentTimestamps();
    if (recentTimestamps.length < MAX_CLICKS) return 0;

    const oldestTimestamp = recentTimestamps[0];
    return Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000);
  };

  const recordClick = useCallback(() => {
    const now = Date.now();
    const recentTimestamps = getRecentTimestamps();
    recentTimestamps.push(now);
    timestampsRef.current = recentTimestamps.slice(-MAX_CLICKS);
  }, [getRecentTimestamps]);

  return { isLimited, remainingSeconds, recordClick };
}
