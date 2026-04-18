export const KEYWORD_REGEX = /boj|백준|baekjoon/gi;

export type ParsedKeywordValue = {
  word: string;
  globalIndex: number | null;
  clientUuid: string | null;
};

export function normalizeKeywordToken(raw: string): string {
  if (raw === '백준') return '백준';
  const lower = raw.toLowerCase();
  if (lower === 'baekjoon') return 'baekjoon';
  return 'BOJ';
}

export function buildKeywordValue(word: string, globalIndex: number, clientUuid: string): string {
  return `${word}:${globalIndex}:${clientUuid}`;
}

export function parseKeywordValue(value: string): ParsedKeywordValue {
  const parts = value.split(':');
  if (parts.length < 2) {
    return { word: normalizeKeywordToken(value), globalIndex: null, clientUuid: null };
  }

  const word = normalizeKeywordToken(parts[0] ?? '');
  const globalIndex = Number(parts[1]);
  const clientUuid = parts.length >= 3 ? parts.slice(2).join(':') : null;

  return {
    word,
    globalIndex: Number.isFinite(globalIndex) ? globalIndex : null,
    clientUuid: clientUuid && clientUuid.length > 0 ? clientUuid : null,
  };
}
