import type { SearchMode } from '@/types/search';

const KEY_PREFIX = 'boj-first';

function getProgressKey(userId: string, mode: SearchMode): string {
  return `${KEY_PREFIX}:progress:${userId}:${mode}`;
}

export function loadProgress(userId: string, mode: SearchMode): number | null {
  try {
    const raw = localStorage.getItem(getProgressKey(userId, mode));
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  catch {
    return null;
  }
}

export function saveProgress(userId: string, mode: SearchMode, percent: number): void {
  try {
    localStorage.setItem(getProgressKey(userId, mode), String(percent));
  }
  catch {
    /* ignore */
  }
}

export function clearProgress(userId: string, mode: SearchMode): void {
  try {
    localStorage.removeItem(getProgressKey(userId, mode));
  }
  catch {
    /* ignore */
  }
}
