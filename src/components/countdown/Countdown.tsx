'use client';

import { memo, useEffect, useState } from 'react';
import { formatDurationMs } from '@/lib/formatDate';
import { SERVICE_END_MS } from '@/lib/constants';
import styles from './countdown.module.css';

const COUNTDOWN_INTERVAL_MS = 500;

export const Countdown = memo(function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), COUNTDOWN_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const remainingMs = now === null ? null : Math.max(0, SERVICE_END_MS - now);

  return (
    <div className={styles.root}>
      <span className={styles.label}>백준과 앞으로 함께할 수 있는 시간</span>
      {remainingMs === null ? null : remainingMs === 0 ? (
        <span className={styles.valueMono}>undefined</span>
      ) : (
        <span className={styles.value}>{formatDurationMs(remainingMs)}</span>
      )}
    </div>
  );
});
