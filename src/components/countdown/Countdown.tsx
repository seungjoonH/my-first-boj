'use client';

import { memo, useMemo } from 'react';
import { formatServiceEndCountdownOmitZero } from '@/lib/serviceEndCountdownFormat';
import { useServiceEndNow } from '@/hooks/useServiceEndNow';
import { useServiceEndMs } from '@/context/ServiceEndMsContext';
import styles from './countdown.module.css';

export const Countdown = memo(function Countdown() {
  const now = useServiceEndNow();
  const endMs = useServiceEndMs();
  const { label, afterEnd } = useMemo(
    () => formatServiceEndCountdownOmitZero(now, endMs),
    [now, endMs],
  );

  return (
    <div className={styles.root}>
      <span className={styles.label}>백준과 앞으로 함께할 수 있는 시간</span>
      {afterEnd ? (
        <span className={styles.valueMono}>undefined</span>
      ) : (
        <span className={styles.value}>{label}</span>
      )}
    </div>
  );
});
