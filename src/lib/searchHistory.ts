import type { HistoryEntry, SearchMode, SubmissionResult } from '@/types/search';
import { BOJ_ID_REGEX } from '@/lib/constants';

const KEY_PREFIX = 'boj-first';
const LEGACY_HISTORY_KEY = `${KEY_PREFIX}:history`;
const MAX_HISTORY_ENTRIES = 20;

const SEARCH_MODES: SearchMode[] = ['first', 'correct', 'wrong'];

function isSearchMode(value: string): value is SearchMode {
  return SEARCH_MODES.includes(value as SearchMode);
}

/** boj-first:{userId}:{mode} 결과 캐시 키만 인정 (progress·history 제외) */
function parseResultKey(key: string): { userId: string; mode: SearchMode } | null {
  if (!key.startsWith(`${KEY_PREFIX}:`)) return null;
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  const [, userId, mode] = parts;
  if (!userId || !BOJ_ID_REGEX.test(userId) || !isSearchMode(mode)) return null;
  return { userId, mode };
}

/** boj-first:progress:{userId}:{mode} */
function parseProgressKey(key: string): { userId: string; mode: SearchMode } | null {
  const parts = key.split(':');
  if (parts.length !== 4) return null;
  if (parts[0] !== KEY_PREFIX || parts[1] !== 'progress') return null;
  const userId = parts[2];
  const mode = parts[3];
  if (!userId || !BOJ_ID_REGEX.test(userId) || !isSearchMode(mode)) return null;
  return { userId, mode };
}

/** 최근순 정렬용 (제출 ID가 클수록 최근일 가능성이 높음) */
function submissionRecencyMs(r: SubmissionResult): number {
  const id = Number(r.submissionId);
  if (Number.isFinite(id) && id > 0) return id;
  const t = Date.parse(r.submittedAt.replace(' ', 'T'));
  return Number.isFinite(t) ? t : 0;
}

/**
 * 검색 기록은 `boj-first:{userId}:{mode}` 결과 캐시와
 * `boj-first:progress:{userId}:{mode}`(미완료)만으로 구성합니다.
 * 레거시 `boj-first:history`는 읽지 않으며, 로드 시 제거합니다.
 */
export function loadHistory(): HistoryEntry[] {
  try {
    localStorage.removeItem(LEGACY_HISTORY_KEY);
  }
  catch {
    /* ignore */
  }

  const entries: HistoryEntry[] = [];
  const seenResult = new Set<string>();

  try {
    for (const key of Object.keys(localStorage)) {
      const parsed = parseResultKey(key);
      if (!parsed) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let data: SubmissionResult;
      try {
        data = JSON.parse(raw) as SubmissionResult;
      }
      catch {
        continue;
      }
      if (!data?.submissionId) continue;

      seenResult.add(`${parsed.userId}:${parsed.mode}`);
      entries.push({
        userId: parsed.userId,
        mode: parsed.mode,
        percent: 100,
        completedAt: submissionRecencyMs(data),
      });
    }

    for (const key of Object.keys(localStorage)) {
      const parsed = parseProgressKey(key);
      if (!parsed) continue;
      if (seenResult.has(`${parsed.userId}:${parsed.mode}`)) continue;

      const raw = localStorage.getItem(key);
      const pct = raw !== null ? Number(raw) : NaN;
      if (!Number.isFinite(pct) || pct <= 0) continue;

      entries.push({
        userId: parsed.userId,
        mode: parsed.mode,
        percent: Math.round(pct),
        completedAt: null,
      });
    }
  }
  catch {
    return [];
  }

  entries.sort((a, b) => {
    if (a.completedAt === null && b.completedAt !== null) return -1;
    if (a.completedAt !== null && b.completedAt === null) return 1;
    if (a.completedAt === null && b.completedAt === null) return b.percent - a.percent;
    return (b.completedAt ?? 0) - (a.completedAt ?? 0);
  });

  if (entries.length > MAX_HISTORY_ENTRIES) {
    entries.length = MAX_HISTORY_ENTRIES;
  }

  return entries;
}

/** 전체 삭제: `boj-first:` 로 시작하는 키를 모두 제거합니다. */
export function clearHistory(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${KEY_PREFIX}:`)) localStorage.removeItem(key);
    }
  }
  catch {
    /* ignore */
  }
}
