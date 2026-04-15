import { load } from 'cheerio';
import { Redis } from '@upstash/redis';
import type { ResultColor, SearchMode, SubmissionResult, SseEvent } from '@/types/search';
import { BOJ_BASE } from '@/lib/constants';

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

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const USER_AGENTS: string[] = JSON.parse(process.env.BOJ_USER_AGENTS!);
const ACCEPT_LANGUAGE = process.env.BOJ_ACCEPT_LANGUAGE!;
const ACCEPT = process.env.BOJ_ACCEPT!;

function getRandomHeaders(): Record<string, string> {
  const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
  const ua = USER_AGENTS[randomIndex]!;
  return {
    'User-Agent': ua,
    'Accept-Language': ACCEPT_LANGUAGE,
    Accept: ACCEPT,
  };
}

const DELAY_MIN_MS = 500;
const DELAY_MAX_MS = 1500;
const PAGE_SIZE = 20;
const MAX_BINARY_SEARCH_ITERATIONS = 6;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBoj(url: string): Promise<string> {
  await sleep(DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
  const res = await fetch(url, { headers: getRandomHeaders() });
  if (!res.ok) throw new Error(`BOJ 응답 오류: ${res.status}`);
  return res.text();
}

async function fetchProblemTitle(problemId: string): Promise<string> {
  try {
    const res = await fetch(`${BOJ_BASE}/problem/${problemId}`, { headers: getRandomHeaders() });
    if (!res.ok) return '';
    const $ = load(await res.text());
    return $('#problem_title').text().trim();
  } catch {
    return '';
  }
}

type ParsedPage = {
  rowCount: number;
  firstSubmissionId: string | null;
  lastRow: SubmissionResult | null;
  lastNonAcRow: SubmissionResult | null;
  hasNonAc: boolean;
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
  const problemId = row.find('td a[href^="/problem/"]').text().trim();
  const problemTitle = '';
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

export async function POST(req: Request): Promise<Response> {
  const { userId, mode } = (await req.json()) as { userId: string; mode: SearchMode };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SseEvent): void {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        // 최신 제출 ID 확인 (top 파라미터 없이)
        const initHtml = await fetchBoj(buildStatusUrl(userId, null, mode));
        const initParsed = parsePage(initHtml);

        if (initParsed.rowCount === 0 || !initParsed.firstSubmissionId) {
          send({ type: 'empty' });
          controller.close();
          return;
        }

        const latestId = Number(initParsed.firstSubmissionId);
        let lo = 1;
        let hi = latestId;
        let iteration = 0;

        while (lo < hi) {
          send({ type: 'progress', percent: Math.round((iteration / MAX_BINARY_SEARCH_ITERATIONS) * 100) });
          iteration++;

          const mid = Math.floor((lo + hi) / 2);
          const html = await fetchBoj(buildStatusUrl(userId, mid, mode));
          const { rowCount, lastRow, hasNonAc } = parsePage(html);

          if (rowCount === 0) {
            lo = mid + 1;
            continue;
          }

          if (rowCount >= PAGE_SIZE) {
            hi = mid;
            continue;
          }

          switch (mode) {
            case 'first':
            case 'correct':
              if (!lastRow) {
                send({ type: 'empty' });
              } else {
                const problemTitle = await fetchProblemTitle(lastRow.problemId);
                trackSearch();
                send({ type: 'result', ...lastRow, problemTitle });
              }
              controller.close();
              return;
            case 'wrong':
              if (!hasNonAc) {
                lo = mid + 1;
                continue;
              }
              hi = mid;
              continue;
            default:
              lo = mid + 1;
          }
        }

        // 루프 종료: top=lo 페이지에서 최종 추출
        const finalHtml = await fetchBoj(buildStatusUrl(userId, lo, mode));
        const finalParsed = parsePage(finalHtml);

        send({ type: 'progress', percent: 100 });

        if (finalParsed.rowCount === 0) {
          send({ type: 'empty' });
        } else {
          switch (mode) {
            case 'wrong': {
              if (!finalParsed.lastNonAcRow) {
                send({ type: 'empty' });
                break;
              }
              const titleWrong = await fetchProblemTitle(finalParsed.lastNonAcRow.problemId);
              trackSearch();
              send({ type: 'result', ...finalParsed.lastNonAcRow, problemTitle: titleWrong });
              break;
            }
            case 'first':
            case 'correct':
            default: {
              if (!finalParsed.lastRow) {
                send({ type: 'empty' });
                break;
              }
              const titleFirst = await fetchProblemTitle(finalParsed.lastRow.problemId);
              trackSearch();
              send({ type: 'result', ...finalParsed.lastRow, problemTitle: titleFirst });
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '잠시 후 다시 시도해주세요';
        send({ type: 'error', message: message.includes('BOJ') ? '잠시 후 다시 시도해주세요' : message });
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
