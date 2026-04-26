'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HistoryEntry, SearchMode } from '@/types/search';
import { Header } from '@/components/header/Header';
import { NicknameMapPageContent } from '@/components/nicknameMap/NicknameMapPageContent';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { clearCache } from '@/lib/cache';
import { clearProgress } from '@/lib/searchProgress';
import {
  loadHistory,
  clearHistory,
  setPendingHistoryNavigation,
} from '@/lib/searchHistory';
import homeStyles from '../page.module.css';

export default function NicknameMapPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    const mq = window.matchMedia('(max-width: 560px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleSelectEntry = useCallback(
    (entry: HistoryEntry) => {
      setPendingHistoryNavigation(entry);
      setIsSidebarOpen(false);
      router.push('/');
    },
    [router],
  );

  const handleDeleteEntry = useCallback((uid: string, mode: SearchMode) => {
    clearCache(uid, mode);
    clearProgress(uid, mode);
    setHistory(loadHistory());
  }, []);

  const handleClearAll = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  return (
    <div className={homeStyles.app}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        history={history}
        onSelectEntry={handleSelectEntry}
        onDeleteEntry={handleDeleteEntry}
        onClearAll={handleClearAll}
        isMobile={isMobile}
      />
      <div className={homeStyles.shell}>
        <Header onToggleSidebar={() => setIsSidebarOpen((v) => !v)} />
        <main className={homeStyles.main}>
          <NicknameMapPageContent />
        </main>
      </div>
    </div>
  );
}
