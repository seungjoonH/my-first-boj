'use client';

import { useEffect, useState } from 'react';
import { MSG_CLIENT_RL_MS } from '@/lib/chatConstants';

export function useChatRateLimit() {
  const [lastSentAtMs, setLastSentAtMs] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(0);

  const remainingMs = lastSentAtMs > 0
    ? Math.max(0, MSG_CLIENT_RL_MS - (nowMs - lastSentAtMs))
    : 0;
  const cooldownRatio = MSG_CLIENT_RL_MS > 0 ? remainingMs / MSG_CLIENT_RL_MS : 0;

  useEffect(() => {
    // 쿨다운 중일 때만 tick을 발생시켜 불필요한 전체 리렌더를 줄인다.
    if (lastSentAtMs <= 0 || remainingMs <= 0) return;
    const id = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 100);
    return () => window.clearTimeout(id);
  }, [lastSentAtMs, remainingMs]);

  const isLimited = (): boolean => {
    return remainingMs > 0;
  };

  const remainingSeconds = (): number => {
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  };

  const recordSend = (): void => {
    const now = Date.now();
    setLastSentAtMs(now);
    setNowMs(now);
  };

  return { isLimited, remainingSeconds, recordSend, remainingMs, cooldownRatio };
}
