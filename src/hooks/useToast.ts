'use client';

import { useCallback, useRef, useState } from 'react';

const TOAST_DURATION_MS = 1000;

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, durationMs: number = TOAST_DURATION_MS) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => setMessage(null), durationMs);
  }, []);

  return { message, showToast };
}
