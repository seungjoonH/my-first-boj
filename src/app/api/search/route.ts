import { load } from 'cheerio';
import { Redis } from '@upstash/redis';
import type { ResultColor, SearchMode, SubmissionResult, SseEvent } from '@/types/search';
import { BOJ_BASE } from '@/lib/constants';

const DEFAULT_USER_AGENT = 'Mozilla/5.0';
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

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
  } catch (error) {
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

const DELAY_MIN_MS = 100;
const DELAY_MAX_MS = 300;
const PAGE_SIZE = 20;
const MAX_BINARY_SEARCH_STEPS = 27;
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

async function fetchBoj(url: string, startedAtMs: number): Promise<string> {
  ensureWithinDeadline(startedAtMs);
  await sleep(DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
  ensureWithinDeadline(startedAtMs);

  const response = await fetch(url, { headers: getRandomHeaders() });
  if (!response.ok) throw new Error(`BOJ 응답 오류: ${response.status}`);
  return response.text();
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

async function loadCachedResult(userId: string, mode: SearchMode): Promise<SubmissionResult | null> {
  if (!redis) return null;

  try {
    const raw = await redis.get(getResultCacheKey(userId, mode));
    return parseRedisJsonValue<SubmissionResult>(raw);
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error('[cache] failed to save search checkpoint', error);
  }
}

async function clearCheckpoint(userId: string, mode: SearchMode): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(getCheckpointKey(userId, mode));
  } catch (error) {
    console.error('[cache] failed to clear search checkpoint', error);
  }
}

type SearchBounds = {
  latestId: number;
  lo: number;
  hi: number;
  iteration: number;
};

function resolveSearchBounds(latestId: number, checkpoint: SearchCheckpoint | null): SearchBounds {
  if (!checkpoint || checkpoint.latestId !== latestId) {
    return { latestId, lo: 1, hi: latestId, iteration: 0 };
  }

  const lo = Math.max(1, Math.min(checkpoint.lo, latestId));
  const hi = Math.max(lo, Math.min(checkpoint.hi, latestId));
  const iteration = Math.max(0, Math.min(checkpoint.iteration, MAX_BINARY_SEARCH_STEPS));
  return { latestId, lo, hi, iteration };
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

function parseRedisJsonValue<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'string') return JSON.parse(raw) as T;
  if (typeof raw === 'object') return raw as T;
  return null;
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
  const startedAtMs = Date.now();

  const cachedResult = await loadCachedResult(searchUserId, mode);
  if (cachedResult) {
    return createSseResponse([
      { type: 'progress', percent: 100 },
      { type: 'result', ...cachedResult },
    ]);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SseEvent): void {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      async function clearAndSendEmpty(): Promise<void> {
        await clearCheckpoint(searchUserId, mode);
        send({ type: 'empty' });
      }

      async function sendResult(result: SubmissionResult): Promise<void> {
        await saveRelatedResultCaches(searchUserId, mode, result);
        await clearCheckpoint(searchUserId, mode);
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
        const checkpoint = await loadCheckpoint(searchUserId, mode);
        const hasStaleCheckpoint = checkpoint !== null && checkpoint.latestId !== latestId;
        if (hasStaleCheckpoint) {
          await clearCheckpoint(searchUserId, mode);
        }

        const bounds = resolveSearchBounds(latestId, checkpoint);

        while (bounds.lo < bounds.hi && bounds.iteration < MAX_BINARY_SEARCH_STEPS) {
          send({ type: 'progress', percent: Math.round((bounds.iteration / MAX_BINARY_SEARCH_STEPS) * 100) });
          bounds.iteration += 1;

          const mid = Math.floor((bounds.lo + bounds.hi) / 2);
          const html = await fetchBoj(buildStatusUrl(searchUserId, mid, mode), startedAtMs);
          const { rowCount, lastRow, hasNonAc } = parsePage(html);

          if (rowCount === 0) {
            bounds.lo = mid + 1;
            await saveSearchBounds(searchUserId, mode, bounds);
            continue;
          }

          if (rowCount >= PAGE_SIZE) {
            bounds.hi = mid;
            await saveSearchBounds(searchUserId, mode, bounds);
            continue;
          }

          switch (mode) {
            case 'first':
            case 'correct':
              if (!lastRow) {
                await clearAndSendEmpty();
              } else {
                await sendResult(lastRow);
              }
              controller.close();
              return;
            case 'wrong':
              if (!hasNonAc) {
                bounds.lo = mid + 1;
                await saveSearchBounds(searchUserId, mode, bounds);
                continue;
              }
              bounds.hi = mid;
              await saveSearchBounds(searchUserId, mode, bounds);
              continue;
            default:
              bounds.lo = mid + 1;
              await saveSearchBounds(searchUserId, mode, bounds);
          }
        }

        // 루프 종료: top=lo 페이지에서 최종 추출
        const finalHtml = await fetchBoj(buildStatusUrl(searchUserId, bounds.lo, mode), startedAtMs);
        const finalParsed = parsePage(finalHtml);

        send({ type: 'progress', percent: 100 });

        const finalResult = selectFinalResult(mode, finalParsed);
        if (!finalResult) {
          await clearAndSendEmpty();
        } else {
          await sendResult(finalResult);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '잠시 후 다시 시도해주세요';
        const isAbortError = err instanceof DOMException && err.name === 'AbortError';
        const isTimeoutError = isAbortError || message.includes('초과');
        console.error('[search] request failed', { userId: searchUserId, mode, message, isAbortError, isTimeoutError });
        send({ type: 'error', message: isTimeoutError || message.includes('BOJ') ? '잠시 후 다시 시도해주세요' : message });
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
