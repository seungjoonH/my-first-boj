'use client';

import { useCallback, useState } from 'react';
import type { SearchMode, SubmissionResult, SseEvent } from '@/types/search';
import { loadCache, saveCache } from '@/lib/cache';

type SearchState = 'idle' | 'loading' | 'result' | 'empty';
const RESULT_TRANSITION_DELAY_MS = 1000;

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

export function useSearch(onError: (message: string) => void) {
  const [state, setState] = useState<SearchState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const handleSearch = useCallback(
    async (userId: string, mode: SearchMode) => {
      const cached = loadCache(userId, mode);
      if (cached) {
        setResult(cached);
        setState('result');
        return;
      }

      setState('loading');
      setProgress(0);

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, mode }),
        });

        if (!res.ok || !res.body) {
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
            try {
              event = JSON.parse(raw) as SseEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case 'progress':
                setProgress(event.percent);
                break;

              case 'result': {
                const submissionResult: SubmissionResult = {
                  submissionId: event.submissionId,
                  problemId: event.problemId,
                  problemTitle: event.problemTitle,
                  submittedAt: event.submittedAt,
                  language: event.language,
                  result: event.result,
                  resultColor: event.resultColor,
                };
                saveCache(userId, mode, submissionResult);
                saveDerivedCaches(userId, mode, submissionResult);
                setProgress(100);
                await new Promise((resolve) => setTimeout(resolve, RESULT_TRANSITION_DELAY_MS));
                setResult(submissionResult);
                setState('result');
                break;
              }

              case 'empty':
                setState('empty');
                break;

              case 'error':
                onError(event.message);
                setState('idle');
                break;
            }
          }
        }
      } catch {
        onError('잠시 후 다시 시도해주세요');
        setState('idle');
      }
    },
    [onError],
  );

  const handleReset = useCallback(() => {
    setState('idle');
    setResult(null);
    setProgress(0);
  }, []);

  return { state, progress, result, handleSearch, handleReset };
}
