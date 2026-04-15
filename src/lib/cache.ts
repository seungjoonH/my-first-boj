import type { SearchMode, SubmissionResult } from '@/types/search';

const KEY_PREFIX = 'boj-first';

function getCacheKey(userId: string, mode: SearchMode): string {
  return `${KEY_PREFIX}:${userId}:${mode}`;
}

export function loadCache(userId: string, mode: SearchMode): SubmissionResult | null {
  try {
    const raw = localStorage.getItem(getCacheKey(userId, mode));
    return raw ? (JSON.parse(raw) as SubmissionResult) : null;
  } catch (error) {
    console.error('[cache] load failed', error);
    return null;
  }
}

export function saveCache(userId: string, mode: SearchMode, result: SubmissionResult): void {
  try {
    localStorage.setItem(getCacheKey(userId, mode), JSON.stringify(result));
  } catch (error) {
    console.error('[cache] save failed', error);
  }
}
