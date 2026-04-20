import { load } from 'cheerio';
import type { ResultColor, SearchMode, SearchStrategy, SubmissionResult, SseEvent } from '@/types/search';
import { chatRedis as redis } from '@/lib/chatRedis';
import {
  BOJ_BASE,
  BOJ_ID_REGEX,
  DEFAULT_SEARCH_STRATEGY,
  SEARCH_EXPLORE_MODE,
  SEARCH_STRATEGY_CONFIG_KEY,
  SERVICE_END_MS,
} from '@/lib/constants';
import type { BojSearchSlotReleaseKind } from '@/lib/searchConcurrency';
import {
  releaseBojSearchSlot,
  resetSearchFailureCount,
  tryAcquireBojSearchSlot,
} from '@/lib/searchConcurrency';

const DEFAULT_USER_AGENT = 'Mozilla/5.0';
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

function trackSearch() {
  void redis?.incr('search_count').catch((error) => {
    console.error('[search_count] increment failed', error);
  });
}

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function parseUserAgents(rawValue: string): string[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }
  catch (error) {
    console.error('[headers] invalid BOJ_USER_AGENTS format', error);
    return [];
  }
}

const USER_AGENTS = parseUserAgents(process.env.BOJ_USER_AGENTS ?? '[]');
const ACCEPT_LANGUAGE = process.env.BOJ_ACCEPT_LANGUAGE ?? '';
const ACCEPT = process.env.BOJ_ACCEPT ?? '';

function getRandomHeaders(): Record<string, string> {
  const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
  const ua = USER_AGENTS[randomIndex] ?? DEFAULT_USER_AGENT;
  return {
    'User-Agent': ua,
    'Accept-Language': ACCEPT_LANGUAGE,
    Accept: ACCEPT,
  };
}

/** BOJ로 가는 각 fetch 직전 대기. 과거 100–300ms 대비 상향(부하 완화). */
const DELAY_MIN_MS = 350;
const DELAY_MAX_MS = 750;
const PAGE_SIZE = 20;
const BINARY_MAX_STEPS = 27;
const TERNARY_MAX_STEPS = 18;
const SEARCH_START_SUBMISSION_ID = 22_958;
const REQUEST_DEADLINE_MS = 110_000;
const SEARCH_RESULT_CACHE_TTL_SEC = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR * 2;
const SEARCH_CHECKPOINT_TTL_SEC = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * 15;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureWithinDeadline(startedAtMs: number): void {
  if (Date.now() - startedAtMs > REQUEST_DEADLINE_MS) {
    throw new Error('요청 시간이 초과되었습니다');
  }
}

async function sleepBeforeRequest(startedAtMs: number): Promise<void> {
  ensureWithinDeadline(startedAtMs);
  await sleep(DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
  ensureWithinDeadline(startedAtMs);
}

async function fetchBojPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: getRandomHeaders() });
  if (!response.ok) throw new Error(`BOJ 응답 오류: ${response.status}`);
  return response.text();
}

async function fetchBoj(url: string, startedAtMs: number): Promise<string> {
  await sleepBeforeRequest(startedAtMs);
  return fetchBojPage(url);
}

type ParsedPage = {
  rowCount: number;
  firstSubmissionId: string | null;
  lastRow: SubmissionResult | null;
  lastNonAcRow: SubmissionResult | null;
  hasNonAc: boolean;
};

type SearchCheckpoint = {
  latestId: number;
  lo: number;
  hi: number;
  iteration: number;
};

type SearchBounds = {
  latestId: number;
  lo: number;
  hi: number;
  iteration: number;
};

type Direction = 'left' | 'right' | 'found';

type StepOutcome =
  | { kind: 'continue'; bounds: SearchBounds }
  | { kind: 'found'; result: SubmissionResult | null };

function normalizeResultColor(rawColor: string): ResultColor {
  const normalizedColor = rawColor.trim().toLowerCase();

  switch (normalizedColor) {
    case 'ac':
    case 'pe':
    case 'wa':
    case 'tle':
    case 'mle':
    case 'ole':
    case 'rte':
    case 'ce':
    case 're':
      return normalizedColor;
    default:
      return 'wa';
  }
}

function parseRow($: ReturnType<typeof load>, row: ReturnType<typeof load.prototype.find>): SubmissionResult {
  const submissionId = row.find('td:first-child').text().trim();
  const problemLink = row.find('td a[href^="/problem/"]').first();
  const problemId = problemLink.text().trim();
  const problemTitle = problemLink.attr('title')?.trim() ?? '';
  const resultSpan = row.find('span.result-text');
  const result = resultSpan.text().trim();
  const resultColor = normalizeResultColor(resultSpan.attr('data-color') ?? '');
  const language = row.find('td:nth-child(7)').text().trim();
  const submittedAt = row.find('a[data-timestamp]').attr('title') ?? '';
  return { submissionId, problemId, problemTitle, result, resultColor, language, submittedAt };
}

function parsePage(html: string): ParsedPage {
  const $ = load(html);
  const rows = $('#status-table tbody tr');
  const rowCount = rows.length;

  if (rowCount === 0) {
    return { rowCount: 0, firstSubmissionId: null, lastRow: null, lastNonAcRow: null, hasNonAc: false };
  }

  const firstSubmissionId = $(rows.get(0)).find('td:first-child').text().trim();
  const lastRow = parseRow($, rows.last());

  let lastNonAcRow: SubmissionResult | null = null;
  let hasNonAc = false;

  const rowArray = rows.toArray();
  for (const el of rowArray) {
    const color = $(el).find('span.result-text').attr('data-color');
    if (color && color !== 'ac') {
      hasNonAc = true;
      lastNonAcRow = parseRow($, $(el));
    }
  }

  return { rowCount, firstSubmissionId, lastRow, lastNonAcRow, hasNonAc };
}

function classifyPage(mode: SearchMode, parsed: ParsedPage): Direction {
  if (parsed.rowCount === 0) return 'right';
  if (parsed.rowCount >= PAGE_SIZE) return 'left';
  switch (mode) {
    case 'first':
    case 'correct': return 'found';
    case 'wrong':   return parsed.hasNonAc ? 'left' : 'right';
  }
}

function buildStatusUrl(userId: string, top: number | null, mode: SearchMode): string {
  const params = new URLSearchParams({ user_id: userId });
  if (top !== null) params.set('top', String(top));
  if (mode === 'correct') params.set('result_id', '4');
  return `${BOJ_BASE}/status?${params}`;
}

function getResultCacheKey(userId: string, mode: SearchMode): string {
  return `search:result:${mode}:${userId}`;
}

function getCheckpointKey(userId: string, mode: SearchMode): string {
  return `search:checkpoint:${mode}:${userId}`;
}

function extractUuid(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  return /(?:^|;\s*)chat-uuid=([^;]+)/.exec(cookieHeader)?.[1]?.trim() ?? null;
}

function parseRedisJsonValue<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'string') return JSON.parse(raw) as T;
  if (typeof raw === 'object') return raw as T;
  return null;
}

async function loadCachedResult(userId: string, mode: SearchMode): Promise<SubmissionResult | null> {
  if (!redis) return null;

  try {
    const raw = await redis.get(getResultCacheKey(userId, mode));
    return parseRedisJsonValue<SubmissionResult>(raw);
  }
  catch (error) {
    console.error('[cache] failed to load result cache', error);
    return null;
  }
}

async function saveCachedResult(userId: string, mode: SearchMode, result: SubmissionResult): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(
      getResultCacheKey(userId, mode),
      JSON.stringify(result),
      { ex: SEARCH_RESULT_CACHE_TTL_SEC },
    );
  }
  catch (error) {
    console.error('[cache] failed to save result cache', error);
  }
}

async function saveRelatedResultCaches(userId: string, mode: SearchMode, result: SubmissionResult): Promise<void> {
  await saveCachedResult(userId, mode, result);
  if (mode !== 'first') return;

  switch (result.resultColor) {
    case 'ac':
      await saveCachedResult(userId, 'correct', result);
      break;
    default:
      await saveCachedResult(userId, 'wrong', result);
  }
}

async function loadCheckpoint(userId: string, mode: SearchMode): Promise<SearchCheckpoint | null> {
  if (!redis) return null;

  try {
    const raw = await redis.get(getCheckpointKey(userId, mode));
    return parseRedisJsonValue<SearchCheckpoint>(raw);
  }
  catch (error) {
    console.error('[cache] failed to load search checkpoint', error);
    return null;
  }
}

async function saveCheckpoint(userId: string, mode: SearchMode, checkpoint: SearchCheckpoint): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(
      getCheckpointKey(userId, mode),
      JSON.stringify(checkpoint),
      { ex: SEARCH_CHECKPOINT_TTL_SEC },
    );
  }
  catch (error) {
    console.error('[cache] failed to save search checkpoint', error);
  }
}

async function clearCheckpoint(userId: string, mode: SearchMode): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(getCheckpointKey(userId, mode));
  }
  catch (error) {
    console.error('[cache] failed to clear search checkpoint', error);
  }
}

function resolveSearchBounds(latestId: number, checkpoint: SearchCheckpoint | null, maxSteps: number): SearchBounds {
  const fresh = (): SearchBounds => {
    const lo = Math.min(SEARCH_START_SUBMISSION_ID, latestId);
    return { latestId, lo, hi: latestId, iteration: 0 };
  };

  if (!checkpoint || checkpoint.latestId !== latestId) return fresh();

  // Checkpoint was saved with a different strategy (e.g. binary→ternary) that has
  // fewer maxSteps. Clamping iteration to maxSteps would cause the loop to exit
  // immediately with unconverged bounds → spurious empty result.
  if (checkpoint.iteration >= maxSteps) return fresh();

  const lo = Math.max(1, Math.min(checkpoint.lo, latestId));
  const hi = Math.max(lo, Math.min(checkpoint.hi, latestId));
  return { latestId, lo, hi, iteration: checkpoint.iteration };
}

async function saveSearchBounds(userId: string, mode: SearchMode, bounds: SearchBounds): Promise<void> {
  await saveCheckpoint(userId, mode, {
    latestId: bounds.latestId,
    lo: bounds.lo,
    hi: bounds.hi,
    iteration: bounds.iteration,
  });
}

function selectFinalResult(mode: SearchMode, parsed: ParsedPage): SubmissionResult | null {
  switch (mode) {
    case 'wrong':
      return parsed.lastNonAcRow;
    case 'first':
    case 'correct':
    default:
      return parsed.lastRow;
  }
}

async function loadSearchStrategy(): Promise<SearchStrategy> {
  if (!redis) return DEFAULT_SEARCH_STRATEGY;
  try {
    const raw = await redis.get(SEARCH_STRATEGY_CONFIG_KEY);
    if (raw === 'binary' || raw === 'ternary') return raw;
    return DEFAULT_SEARCH_STRATEGY;
  }
  catch (error) {
    console.error('[strategy] failed to load search strategy', error);
    return DEFAULT_SEARCH_STRATEGY;
  }
}

async function binaryStep(
  userId: string,
  mode: SearchMode,
  startedAtMs: number,
  bounds: SearchBounds,
): Promise<StepOutcome> {
  const mid = Math.floor((bounds.lo + bounds.hi) / 2);
  const html = await fetchBoj(buildStatusUrl(userId, mid, mode), startedAtMs);
  const parsed = parsePage(html);
  const direction = classifyPage(mode, parsed);

  if (direction === 'found') return { kind: 'found', result: parsed.lastRow };
  if (direction === 'left') return { kind: 'continue', bounds: { ...bounds, hi: mid } };
  return { kind: 'continue', bounds: { ...bounds, lo: mid + 1 } };
}

async function ternaryStep(
  userId: string,
  mode: SearchMode,
  startedAtMs: number,
  bounds: SearchBounds,
): Promise<StepOutcome> {
  const t1 = bounds.lo + Math.floor((bounds.hi - bounds.lo) / 3);
  const t2 = bounds.lo + Math.floor(2 * (bounds.hi - bounds.lo) / 3);

  // 이진과 동일하게 요청마다 sleepBeforeRequest 적용. 병렬이 아니라 순차로 두어
  // 같은 순간에 백준으로 두 연결이 동시에 열리지 않게 한다.
  const html1 = await fetchBoj(buildStatusUrl(userId, t1, mode), startedAtMs);
  const r1 = parsePage(html1);
  const d1 = classifyPage(mode, r1);

  if (d1 === 'found') return { kind: 'found', result: r1.lastRow };
  if (d1 === 'left') return { kind: 'continue', bounds: { ...bounds, hi: t1 } };

  const html2 = await fetchBoj(buildStatusUrl(userId, t2, mode), startedAtMs);
  const r2 = parsePage(html2);
  const d2 = classifyPage(mode, r2);

  if (d2 === 'found') return { kind: 'found', result: r2.lastRow };
  if (d2 === 'left') return { kind: 'continue', bounds: { ...bounds, lo: t1 + 1, hi: t2 } };
  return { kind: 'continue', bounds: { ...bounds, lo: t2 + 1 } };
}

function createSseResponse(events: SseEvent[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  const { userId, mode } = (await req.json()) as { userId: string; mode: SearchMode };
  const searchUserId = userId.trim();

  if (!BOJ_ID_REGEX.test(searchUserId)) {
    return createSseResponse([{ type: 'error', message: '아이디 형식이 맞지 않습니다' }]);
  }

  const startedAtMs = Date.now();

  const cachedResult = await loadCachedResult(searchUserId, mode);
  if (cachedResult) {
    return createSseResponse([
      { type: 'progress', percent: 100 },
      { type: 'result', ...cachedResult },
    ]);
  }

  /* redis_only: BOJ로 나가는 fetch 전부 금지 — Redis 캐시 히트만 위에서 처리 */
  if (SEARCH_EXPLORE_MODE === 'redis_only') {
    if (!redis) {
      return createSseResponse([
        {
          type: 'error',
          message: 'Redis에 연결할 수 없어 제출 기록 탐색을 시작할 수 없습니다.',
        },
      ]);
    }
    return createSseResponse([
      { type: 'error', message: '해당 서비스를 사용할 수 없습니다.' },
    ]);
  }

  const uuid = extractUuid(req.headers.get('cookie'));
  if (uuid) {
    const rlKey = `search:rl:${uuid}:${mode}`;
    const existing = await redis?.get(rlKey);
    if (existing) {
      const ttl = (await redis?.ttl(rlKey)) ?? 30;
      return createSseResponse([{ type: 'rate_limit', remainingSeconds: Math.max(1, ttl) }]);
    }
    void redis?.set(rlKey, '1', { ex: 30 }).catch((e) => console.error('[rl] set failed', e));
  }

  if (Date.now() >= SERVICE_END_MS) {
    return createSseResponse([{ type: 'ended' }]);
  }

  const conc = await tryAcquireBojSearchSlot(redis, uuid);
  if (!conc.granted) {
    return createSseResponse([{ type: 'concurrency_limit', failureCount: conc.failureCount }]);
  }

  const slotReleaseKind: BojSearchSlotReleaseKind = conc.releaseKind;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SseEvent): void {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      async function clearAndSendEmpty(): Promise<void> {
        await resetSearchFailureCount(redis, uuid);
        await clearCheckpoint(searchUserId, mode);
        send({ type: 'empty' });
      }

      async function sendResult(result: SubmissionResult): Promise<void> {
        await saveRelatedResultCaches(searchUserId, mode, result);
        await clearCheckpoint(searchUserId, mode);
        await resetSearchFailureCount(redis, uuid);
        trackSearch();
        send({ type: 'result', ...result });
      }

      try {
        // 최신 제출 ID 확인 (top 파라미터 없이)
        const initHtml = await fetchBoj(buildStatusUrl(searchUserId, null, mode), startedAtMs);
        const initParsed = parsePage(initHtml);

        if (initParsed.rowCount === 0 || !initParsed.firstSubmissionId) {
          await clearAndSendEmpty();
          controller.close();
          return;
        }

        const latestId = Number(initParsed.firstSubmissionId);
        const [checkpoint, strategy] = await Promise.all([
          loadCheckpoint(searchUserId, mode),
          loadSearchStrategy(),
        ]);

        const hasStaleCheckpoint = checkpoint !== null && checkpoint.latestId !== latestId;
        if (hasStaleCheckpoint) {
          await clearCheckpoint(searchUserId, mode);
        }

        const maxSteps = strategy === 'ternary' ? TERNARY_MAX_STEPS : BINARY_MAX_STEPS;
        const searchStep = strategy === 'ternary' ? ternaryStep : binaryStep;
        let bounds = resolveSearchBounds(latestId, checkpoint, maxSteps);

        while (bounds.lo < bounds.hi && bounds.iteration < maxSteps) {
          send({ type: 'progress', percent: Math.round((bounds.iteration / maxSteps) * 100) });
          bounds = { ...bounds, iteration: bounds.iteration + 1 };

          const outcome = await searchStep(searchUserId, mode, startedAtMs, bounds);
          if (outcome.kind === 'found') {
            if (!outcome.result) {
              await clearAndSendEmpty();
            }
            else {
              await sendResult(outcome.result);
            }
            controller.close();
            return;
          }

          bounds = outcome.bounds;
          await saveSearchBounds(searchUserId, mode, bounds);
        }

        // 루프 종료: top=lo 페이지에서 최종 추출
        const finalHtml = await fetchBoj(buildStatusUrl(searchUserId, bounds.lo, mode), startedAtMs);
        const finalParsed = parsePage(finalHtml);

        send({ type: 'progress', percent: 100 });

        const finalResult = selectFinalResult(mode, finalParsed);
        if (!finalResult) {
          await clearAndSendEmpty();
        }
        else {
          await sendResult(finalResult);
        }
      }
      catch (err) {
        const message = err instanceof Error ? err.message : '잠시 후 다시 시도해주세요';
        const isAbortError = err instanceof DOMException && err.name === 'AbortError';
        const isTimeoutError = isAbortError || message.includes('초과');
        console.error('[search] request failed', { userId: searchUserId, mode, message, isAbortError, isTimeoutError });
        send({ type: 'error', message: isTimeoutError || message.includes('BOJ') ? '잠시 후 다시 시도해주세요' : message });
      }
      finally {
        await releaseBojSearchSlot(redis, slotReleaseKind);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
