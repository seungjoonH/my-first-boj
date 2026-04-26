import { load } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { ParsedPage, ResultColor, SearchMode, SubmissionResult } from '@/types/search';

/** `top1_prev` 전략에서 `#prev_page` 체인 최대 횟수 (무한 루프·비정상 HTML 방지) */
export const TOP1_PREV_MAX_PREV_HOPS = 50_000;

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

function parseStatusRow($: ReturnType<typeof load>, el: AnyNode): SubmissionResult {
  const row = $(el);
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

export function extractPrevPageAbsoluteUrl(html: string, base: string): string | null {
  const $ = load(html);
  const href = $('#prev_page').attr('href');
  if (!href) return null;
  try {
    return new URL(href, base).href;
  }
  catch {
    return null;
  }
}

/**
 * 동질 페이지에서만 `prev_page`로 더 거슬러 올라간다.
 * - correct: 한 줄도 AC가 없음(전부 오답·PE 등)
 * - wrong: 모든 행이 AC뿐
 */
export function shouldChainPrevForHomogeneousPage(mode: SearchMode, parsed: ParsedPage): boolean {
  if (parsed.rowCount === 0) return false;
  switch (mode) {
    case 'first': return false;
    case 'correct': return !parsed.hasAc;
    case 'wrong': return parsed.hasAc && !parsed.hasNonAc;
    default: return false;
  }
}

/** correct: 아래→위 첫 AC / wrong: 아래→위 첫 non-AC */
export function scanTop1PrevSubmissionForMode(html: string, mode: SearchMode): SubmissionResult | null {
  if (mode === 'first') return null;
  const $ = load(html);
  const rows = $('#status-table tbody tr');
  const n = rows.length;
  if (n === 0) return null;

  for (let i = n - 1; i >= 0; i--) {
    const el = rows.get(i);
    if (!el) continue;
    const dataColor = $(el).find('span.result-text').attr('data-color');
    switch (mode) {
      case 'correct':
        if (dataColor === 'ac') return parseStatusRow($, el as AnyNode);
        break;
      case 'wrong':
        if (dataColor && dataColor !== 'ac') return parseStatusRow($, el as AnyNode);
        break;
      default:
        break;
    }
  }
  return null;
}
