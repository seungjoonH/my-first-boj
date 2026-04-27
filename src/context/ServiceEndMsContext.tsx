'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SERVICE_END_MS_DEFAULT } from '@/lib/constants';

type Ctx = {
  endMs: number;
  ready: boolean;
  refresh: () => void;
};

const ServiceEndMsContext = createContext<Ctx | null>(null);

const REFETCH_MS = 60_000;

export function ServiceEndMsProvider({ children }: { children: ReactNode }): React.ReactNode {
  const [endMs, setEndMs] = useState(SERVICE_END_MS_DEFAULT);
  const [ready, setReady] = useState(false);

  const pull = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/config/service-end', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { endMs?: unknown };
      const n = Number(data.endMs);
      if (Number.isFinite(n) && n > 0) {
        setEndMs(Math.floor(n));
      }
    }
    catch {
      // 기본값 유지
    }
    finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void pull();
    const id = window.setInterval(() => { void pull(); }, REFETCH_MS);
    return () => window.clearInterval(id);
  }, [pull]);

  const value = useMemo(
    () => ({ endMs, ready, refresh: () => { void pull(); } }),
    [endMs, ready, pull],
  );

  return (
    <ServiceEndMsContext.Provider value={value}>
      {children}
    </ServiceEndMsContext.Provider>
  );
}

export function useServiceEndMs(): number {
  const ctx = useContext(ServiceEndMsContext);
  if (ctx) return ctx.endMs;
  return SERVICE_END_MS_DEFAULT;
}

export function useServiceEndMsState(): Ctx {
  const ctx = useContext(ServiceEndMsContext);
  if (ctx) return ctx;
  return { endMs: SERVICE_END_MS_DEFAULT, ready: true, refresh: () => {} };
}
