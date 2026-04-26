'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { HistoryEntry, SearchMode } from '@/types/search';
import { Header } from '@/components/header/Header';
import { Tabs } from '@/components/tabs/Tabs';
import { Countdown } from '@/components/countdown/Countdown';
import { InputArea } from '@/components/inputArea/InputArea';
import { ResultCard } from '@/components/resultCard/ResultCard';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { Toast } from '@/components/toast/Toast';
import { useSearch } from '@/hooks/useSearch';
import { useToast } from '@/hooks/useToast';
import { cleanInvalidCaches, clearCache, loadCache } from '@/lib/cache';
import { clearProgress, loadProgress } from '@/lib/searchProgress';
import {
  loadHistory,
  clearHistory,
  consumePendingHistoryNavigation,
} from '@/lib/searchHistory';
import { BOJ_ID_REGEX } from '@/lib/constants';
import styles from './page.module.css';

const CACHE_KEY_PREFIX = 'boj-first:';
const SEARCH_MODES: SearchMode[] = ['first', 'correct', 'wrong'];

function isSearchMode(value: string): value is SearchMode {
  return SEARCH_MODES.includes(value as SearchMode);
}

function findCachedUserIdForMode(mode: SearchMode): string {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(CACHE_KEY_PREFIX)) continue;
      const [, userId, keyMode] = key.split(':');
      if (!userId || !keyMode || !isSearchMode(keyMode)) continue;
      if (keyMode !== mode) continue;
      if (!BOJ_ID_REGEX.test(userId)) continue;
      if (loadCache(userId, mode) === null) continue;
      return userId;
    }
  }
  catch {
    return '';
  }
  return '';
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<SearchMode>('first');
  const [userId, setUserId] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedProgress, setSavedProgress] = useState<number | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);
  const restoredRef = useRef(false);
  const userIdRef = useRef('');

  const { message: toastMessage, showToast } = useToast();

  const handleHistoryChange = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  const { state, progress, result, handleSearch, handleReset } = useSearch(showToast, handleHistoryChange);

  // 마운트 시 초기화
  useEffect(() => {
    setHistory(loadHistory());
    const mq = window.matchMedia('(max-width: 560px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // userId / activeTab 변경 시 저장된 진행률 로드
  useEffect(() => {
    const trimmed = userId.trim();
    if (!trimmed) {
      setSavedProgress(undefined);
      return;
    }
    setSavedProgress(loadProgress(trimmed, activeTab) ?? undefined);
  }, [userId, activeTab]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const pending = consumePendingHistoryNavigation();
    if (pending) {
      setUserId(pending.userId);
      setActiveTab(pending.mode);
      if (pending.completedAt !== null) {
        void handleSearch(pending.userId, pending.mode);
        setIsInputVisible(false);
      }
      else {
        handleReset();
        setIsInputVisible(true);
      }
      return;
    }
    const savedUserId = findCachedUserIdForMode(activeTab);
    if (!savedUserId) return;
    setUserId(savedUserId);
    setIsInputVisible(false);
    void handleSearch(savedUserId, activeTab);
  }, [activeTab, handleSearch, handleReset]);

  useEffect(() => {
    if (state !== 'result') return;
    setIsInputVisible(false);
  }, [state]);

  useEffect(() => {
    if (state !== 'idle') return;
    if (!isInputVisible) setIsInputVisible(true);
  }, [state, isInputVisible]);

  const handleTabChange = useCallback(
    (mode: SearchMode) => {
      setActiveTab(mode);
      const trimmed = userIdRef.current.trim();
      if (!trimmed || loadCache(trimmed, mode) === null) {
        handleReset();
        setIsInputVisible(true);
        return;
      }
      setUserId(trimmed);
      setIsInputVisible(false);
      void handleSearch(trimmed, mode);
    },
    [handleSearch, handleReset],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = userId.trim();
    if (!trimmed) return;

    if (!BOJ_ID_REGEX.test(trimmed)) {
      cleanInvalidCaches(BOJ_ID_REGEX);
      showToast('아이디 형식이 맞지 않습니다');
      return;
    }

    void handleSearch(trimmed, activeTab);
  }, [userId, activeTab, handleSearch, showToast]);

  const handleResetWithUser = useCallback(() => {
    handleReset();
    setIsInputVisible(true);
  }, [handleReset]);

  const handleSelectEntry = useCallback(
    (entry: HistoryEntry) => {
      setUserId(entry.userId);
      setActiveTab(entry.mode);
      if (entry.completedAt !== null) {
        void handleSearch(entry.userId, entry.mode);
        setIsInputVisible(false);
      }
      else {
        handleReset();
        setIsInputVisible(true);
      }
    },
    [handleSearch, handleReset],
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

  const isResultState = state === 'result' && result !== null;

  let content: ReactNode;

  switch (state) {
    case 'idle':
    case 'loading':
      content = isInputVisible ? (
        <InputArea
          value={userId}
          onChange={setUserId}
          onSubmit={handleSubmit}
          disabled={state === 'loading'}
          isLoading={state === 'loading'}
          progress={progress}
          savedProgress={state === 'idle' ? savedProgress : undefined}
        />
      ) : null;
      break;
    case 'result':
      content = isResultState ? <ResultCard result={result} mode={activeTab} userId={userId.trim()} /> : null;
      break;
    case 'empty':
      content = (
        <div className={styles.empty}>
          <p>제출 내역이 없습니다.</p>
          <button className={styles.resetButton} onClick={handleResetWithUser}>
            다시 찾아보기
          </button>
        </div>
      );
      break;
    case 'ended':
      content = (
        <div className={styles.empty}>
          <p>더 이상 확인할 수 없습니다.</p>
          <button className={styles.resetButton} onClick={handleResetWithUser}>
            다시 찾아보기
          </button>
        </div>
      );
      break;
    default:
      content = null;
  }

  return (
    <div className={styles.app}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        history={history}
        onSelectEntry={handleSelectEntry}
        onDeleteEntry={handleDeleteEntry}
        onClearAll={handleClearAll}
        isMobile={isMobile}
      />
      <div className={styles.shell}>
        <Header onToggleSidebar={() => setIsSidebarOpen((v) => !v)} />
        <main className={styles.main}>
          <div className={styles.content}>
            <div className={styles.headline}>
              <h1 className={styles.title}>나의 첫 백준은?</h1>
              <p className={styles.subtitle}>나의 첫 제출 내역을 확인해보세요.</p>
            </div>
            <Countdown />
            <div className={styles.tabsRow}>
              <Tabs active={activeTab} onChange={handleTabChange} />
              {isResultState && (
                <button className={styles.tabsResetButton} onClick={handleResetWithUser}>
                  다시 찾아보기
                </button>
              )}
            </div>
            <div>{content}</div>
          </div>
        </main>
      </div>
      <Toast message={toastMessage} />
    </div>
  );
}
