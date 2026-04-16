'use client';

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { SearchMode } from '@/types/search';
import { Header } from '@/components/header/Header';
import { Tabs } from '@/components/tabs/Tabs';
import { Countdown } from '@/components/countdown/Countdown';
import { InputArea } from '@/components/inputArea/InputArea';
import { ResultCard } from '@/components/resultCard/ResultCard';
import { Toast } from '@/components/toast/Toast';
import { useSearch } from '@/hooks/useSearch';
import { useRateLimit } from '@/hooks/useRateLimit';
import { useToast } from '@/hooks/useToast';
import { cleanInvalidCaches, loadCache } from '@/lib/cache';
import { BOJ_ID_REGEX } from '@/lib/constants';
import styles from './page.module.css';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<SearchMode>('first');
  const [userId, setUserId] = useState('');

  const { message: toastMessage, showToast } = useToast();
  const { isLimited, remainingSeconds, recordClick } = useRateLimit();
  const { state, progress, result, handleSearch, handleReset } = useSearch(showToast);

  const handleTabChange = useCallback(
    (mode: SearchMode) => {
      if (state !== 'idle') handleReset();
      setActiveTab(mode);
    },
    [state, handleReset],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = userId.trim();
    if (!trimmed) return;

    if (!BOJ_ID_REGEX.test(trimmed)) {
      cleanInvalidCaches(BOJ_ID_REGEX);
      showToast('아이디 형식이 맞지 않습니다');
      return;
    }

    const hasCachedResult = loadCache(trimmed, activeTab) !== null;

    if (!hasCachedResult && isLimited()) {
      showToast(`${remainingSeconds()}초 후에 다시 시도해주세요`);
      return;
    }

    if (!hasCachedResult) recordClick();
    handleSearch(trimmed, activeTab);
  }, [userId, activeTab, isLimited, remainingSeconds, recordClick, handleSearch, showToast]);

  const handleResetWithUser = useCallback(() => {
    handleReset();
    setUserId('');
  }, [handleReset]);

  const isResultState = state === 'result' && result !== null;

  let content: ReactNode;

  switch (state) {
    case 'idle':
    case 'loading':
      content = (
        <InputArea
          value={userId}
          onChange={setUserId}
          onSubmit={handleSubmit}
          disabled={state === 'loading'}
          isLoading={state === 'loading'}
          progress={progress}
        />
      );
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
    <>
      <Header />
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
      <Toast message={toastMessage} />
    </>
  );
}
