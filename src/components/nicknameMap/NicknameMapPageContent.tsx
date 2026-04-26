'use client';

import { useEffect, useRef, useState } from 'react';
import type { NicknameMapGridHandle } from './type';
import { LoadingEllipsisLabel } from '@/components/loadingEllipsis/LoadingEllipsisLabel';
import { Toast } from '@/components/toast/Toast';
import { useToast } from '@/hooks/useToast';
import { NICKNAME_GRID_CELL_TOTAL } from '@/lib/chatNickname';
import type { NicknameTableApiResponse } from '@/types/chatNicknameTable';
import { NicknameMapGrid } from './NicknameMapGrid';
import { NicknameMapMinimapControl } from './NicknameMapMinimapControl';
import styles from './NicknameMapPageContent.module.css';

const NICKNAME_TABLE_API = '/api/chat/nickname-table';
const LOAD_ERROR_TOAST_MS = 5200;

export function NicknameMapPageContent() {
  const gridRef = useRef<NicknameMapGridHandle | null>(null);
  const { message: toastMessage, showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [data, setData] = useState<NicknameTableApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(NICKNAME_TABLE_API, { credentials: 'include' });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }
        const json = (await res.json()) as NicknameTableApiResponse;
        if (!cancelled) {
          setData(json);
        }
      }
      catch (e) {
        if (!cancelled) {
          setFailed(true);
          setData(null);
          const detail = e instanceof Error ? e.message : 'load_failed';
          showToastRef.current(`데이터를 불러오지 못했습니다. (${detail})`, LOAD_ERROR_TOAST_MS);
        }
      }
      finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <>
        <div className={styles.loadingArea} role="status" aria-live="polite">
          <div className={styles.loadingLineWrap}>
            <LoadingEllipsisLabel className={styles.loadingText} />
          </div>
        </div>
        <Toast message={toastMessage} />
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <div className={styles.root}>
          <section className={styles.hero} aria-labelledby="nick-map-heading">
            <h1 id="nick-map-heading" className={styles.title}>
              채팅 닉네임 전체 도감
            </h1>
            {failed && (
              <p className={styles.retryHint}>잠시 후 페이지를 새로고침해 주세요.</p>
            )}
          </section>
        </div>
        <Toast message={toastMessage} />
      </>
    );
  }

  const totalCells = NICKNAME_GRID_CELL_TOTAL;
  const pct = totalCells > 0 ? (data.totalUnlockedCount / totalCells) * 100 : 0;

  return (
    <>
    <div className={styles.root}>
      <section className={styles.hero} aria-labelledby="nick-map-heading">
        <div className={styles.heroRow}>
          <div className={styles.heroMain}>
            <h1 id="nick-map-heading" className={styles.title}>
              닉네임 도감
            </h1>
            <p className={styles.lead}>
              해금된 칸 <strong>{data.totalUnlockedCount}</strong> / {totalCells} (
              {pct.toFixed(2)}%)
            </p>
          </div>
          <NicknameMapMinimapControl snapshot={data} myCell={data.myCell} gridRef={gridRef} />
        </div>
      </section>
      <NicknameMapGrid ref={gridRef} snapshot={data} myCell={data.myCell} />
    </div>
    <Toast message={toastMessage} />
    </>
  );
}
