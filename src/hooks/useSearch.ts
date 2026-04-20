'use client';

import { useCallback, useRef, useState } from 'react';
import type { SearchMode, SubmissionResult, SseEvent } from '@/types/search';
import {
  SEARCH_CONCURRENCY_RETRY_NOTICE_THRESHOLD,
  SEARCH_EXPLORE_MODE,
} from '@/lib/constants';
import { loadCache, saveCache } from '@/lib/cache';
import { saveProgress, clearProgress } from '@/lib/searchProgress';

type SearchState = 'idle' | 'loading' | 'result' | 'empty' | 'ended';
const RESULT_TRANSITION_DELAY_MS = 1000;

const FAKE_TICK_MS = 200;
const FAKE_INCREMENT_INITIAL = 0.4;
const FAKE_INCREMENT_MIN = 0.05;
const FAKE_PROGRESS_CAP = 95;

function saveDerivedCaches(userId: string, mode: SearchMode, submissionResult: SubmissionResult) {
  if (mode !== 'first') return;

  switch (submissionResult.resultColor) {
    case 'ac':
      saveCache(userId, 'correct', submissionResult);
      return;
    default:
      saveCache(userId, 'wrong', submissionResult);
  }
}

export function useSearch(
  onError: (message: string) => void,
  onHistoryChange: () => void,
) {
  const [state, setState] = useState<SearchState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const fakeProgressRef = useRef(0);
  const incrementRef = useRef(FAKE_INCREMENT_INITIAL);
  const fakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeUserIdRef = useRef('');
  const activeModeRef = useRef<SearchMode>('first');

  const clearFakeTicker = useCallback(() => {
    if (fakeIntervalRef.current !== null) {
      clearInterval(fakeIntervalRef.current);
      fakeIntervalRef.current = null;
    }
  }, []);

  const startFakeTicker = useCallback(() => {
    clearFakeTicker();
    fakeProgressRef.current = 0;
    incrementRef.current = FAKE_INCREMENT_INITIAL;
    fakeIntervalRef.current = setInterval(() => {
      const current = fakeProgressRef.current;
      if (current >= FAKE_PROGRESS_CAP) return;
      const next = Math.min(
        FAKE_PROGRESS_CAP,
        current + incrementRef.current * (0.8 + Math.random() * 0.4),
      );
      fakeProgressRef.current = next;
      setProgress(next);
    }, FAKE_TICK_MS);
  }, [clearFakeTicker]);

  const handleSearch = useCallback(
    async (userId: string, mode: SearchMode) => {
      const cached = loadCache(userId, mode);
      if (cached) {
        setResult(cached);
        setState('result');
        return;
      }

      if (SEARCH_EXPLORE_MODE === 'redis_only') {
        try {
          const statusRes = await fetch('/api/search/redis-config');
          const data = (await statusRes.json()) as { redisConfigured?: boolean };
          if (!statusRes.ok || !data.redisConfigured) {
            onError('Redis에 연결할 수 없어 제출 기록 탐색을 시작할 수 없습니다.');
            return;
          }
        }
        catch {
          onError('잠시 후 다시 시도해주세요');
          return;
        }
      }

      activeUserIdRef.current = userId;
      activeModeRef.current = mode;

      setState('loading');
      setProgress(0);
      startFakeTicker();

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, mode }),
        });

        if (!res.ok || !res.body) {
          clearFakeTicker();
          onError('잠시 후 다시 시도해주세요');
          setState('idle');
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice('data: '.length).trim();
            if (!raw) continue;

            let event: SseEvent;
            try { event = JSON.parse(raw) as SseEvent; }
            catch { continue; }

            const uid = activeUserIdRef.current;
            const md = activeModeRef.current;

            switch (event.type) {
              case 'progress': {
                const sseValue = event.percent;
                if (sseValue > fakeProgressRef.current) {
                  fakeProgressRef.current = sseValue;
                  setProgress(sseValue);
                }
                else if (sseValue < fakeProgressRef.current) {
                  incrementRef.current = Math.max(
                    FAKE_INCREMENT_MIN,
                    incrementRef.current * 0.5,
                  );
                }
                saveProgress(uid, md, fakeProgressRef.current);
                onHistoryChange();
                break;
              }

              case 'result': {
                clearFakeTicker();
                fakeProgressRef.current = 100;
                setProgress(100);

                const submissionResult: SubmissionResult = {
                  submissionId: event.submissionId,
                  problemId: event.problemId,
                  problemTitle: event.problemTitle,
                  submittedAt: event.submittedAt,
                  language: event.language,
                  result: event.result,
                  resultColor: event.resultColor,
                };
                saveCache(uid, md, submissionResult);
                saveDerivedCaches(uid, md, submissionResult);
                clearProgress(uid, md);

                await new Promise((resolve) => setTimeout(resolve, RESULT_TRANSITION_DELAY_MS));

                onHistoryChange();

                setResult(submissionResult);
                setState('result');
                break;
              }

              case 'empty':
                clearFakeTicker();
                clearProgress(uid, md);
                setState('empty');
                break;

              case 'ended':
                clearFakeTicker();
                clearProgress(uid, md);
                setState('ended');
                break;

              case 'rate_limit':
                clearFakeTicker();
                setState('idle');
                onError(`${event.remainingSeconds}초 후에 다시 시도해주세요`);
                break;

              case 'concurrency_limit': {
                clearFakeTicker();
                setState('idle');
                const busy =
                  event.failureCount >= SEARCH_CONCURRENCY_RETRY_NOTICE_THRESHOLD
                    ? '여전히 요청이 많아 처리가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
                    : '현재 요청이 많아 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
                onError(busy);
                break;
              }

              case 'error':
                clearFakeTicker();
                onError(event.message);
                setState('idle');
                break;
            }
          }
        }
      }
      catch {
        clearFakeTicker();
        onError('잠시 후 다시 시도해주세요');
        setState('idle');
      }
    },
    [onError, onHistoryChange, startFakeTicker, clearFakeTicker],
  );

  const handleReset = useCallback(() => {
    clearFakeTicker();
    setState('idle');
    setResult(null);
    setProgress(0);
  }, [clearFakeTicker]);

  return { state, progress, result, handleSearch, handleReset };
}
