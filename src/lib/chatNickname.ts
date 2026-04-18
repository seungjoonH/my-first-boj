import {
  B_BADGES,
  CHAT_DIAMOND_LANGUAGES,
  LANGUAGES,
} from './chatConstants';

/** `fnv32(base) % FLAT_TOTAL` — 메모리 구간은 0B~256B(257슬롯)로 상위 티어 비중 확대. 도움말 UI와 동일 값 */
export const A_BADGE_FLAT_TOTAL = 591;
const FLAT_TOTAL = A_BADGE_FLAT_TOTAL;
const FLAT_INDEX_LANG_START = 1;
const FLAT_INDEX_LANG_END = 75;
const FLAT_INDEX_REL_START = 76;
const FLAT_INDEX_REL_END = 232;
const FLAT_INDEX_JUDGE_START = 233;
const FLAT_INDEX_JUDGE_END = 333;
const FLAT_INDEX_MEM_START = 334;
/** 334 + (0..256) → 메모리 0B~256B */
const FLAT_INDEX_MEM_END = 590;

const B_WEIGHTS = [4, 8, 6, 6, 6, 20, 20, 15, 15] as const;
const B_BADGE_TIERS = [1, 2, 3, 3, 3, 4, 4, 5, 5] as const;

const DIAMOND_SET = new Set<string>(CHAT_DIAMOND_LANGUAGES);

export type ChatTier = 0 | 1 | 2 | 3 | 4 | 5;

const TIER_ICON_SLUG: Record<ChatTier, string> = {
  0: 'ruby',
  1: 'diamond',
  2: 'platinum',
  3: 'gold',
  4: 'silver',
  5: 'bronze',
};

const TIER_LABEL_KO: Record<ChatTier, string> = {
  0: '루비',
  1: '다이아',
  2: '플래티넘',
  3: '골드',
  4: '실버',
  5: '브론즈',
};

export function fnv32(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return hash;
}

export function splitMemoryByteSuffix(aBadge: string): { valuePart: string; unitPart?: string } {
  const m = aBadge.match(/^(\d+)\s*(B)$/i);
  if (!m) return { valuePart: aBadge };
  return { valuePart: m[1], unitPart: `\u00A0${m[2]}` };
}

function resolveRelativeTimeLabel(valueIndex: number): string {
  if (valueIndex <= 58) return `${valueIndex + 1}초 전`;
  if (valueIndex <= 117) return `${valueIndex - 58}분 전`;
  if (valueIndex <= 140) return `${valueIndex - 117}시간 전`;
  return `${valueIndex - 140}년 전`;
}

function getFlatIndex(base: string): number {
  return fnv32(base) % FLAT_TOTAL;
}

function getATierFromFlatIndex(flatIndex: number): ChatTier {
  if (flatIndex === 0) return 0;
  if (flatIndex >= FLAT_INDEX_LANG_START && flatIndex <= FLAT_INDEX_LANG_END) {
    const lang = LANGUAGES[flatIndex - 1];
    return DIAMOND_SET.has(lang) ? 1 : 2;
  }
  if (flatIndex >= FLAT_INDEX_REL_START && flatIndex <= FLAT_INDEX_REL_END) return 4;
  if (flatIndex >= FLAT_INDEX_JUDGE_START && flatIndex <= FLAT_INDEX_JUDGE_END) return 3;
  if (flatIndex >= FLAT_INDEX_MEM_START && flatIndex <= FLAT_INDEX_MEM_END) return 5;
  return 5;
}

function getABadgeTextFromFlatIndex(flatIndex: number): string {
  if (flatIndex === 0) return '524288 B';
  if (flatIndex >= FLAT_INDEX_LANG_START && flatIndex <= FLAT_INDEX_LANG_END) {
    return LANGUAGES[flatIndex - 1] ?? LANGUAGES[0];
  }
  if (flatIndex >= FLAT_INDEX_REL_START && flatIndex <= FLAT_INDEX_REL_END) {
    return resolveRelativeTimeLabel(flatIndex - FLAT_INDEX_REL_START);
  }
  if (flatIndex >= FLAT_INDEX_JUDGE_START && flatIndex <= FLAT_INDEX_JUDGE_END) {
    return `채점 중 (${flatIndex - FLAT_INDEX_JUDGE_START}%)`;
  }
  if (flatIndex >= FLAT_INDEX_MEM_START && flatIndex <= FLAT_INDEX_MEM_END) {
    return `${flatIndex - FLAT_INDEX_MEM_START} B`;
  }
  return '0 B';
}

function pickBIndex(base: string): number {
  const roll = fnv32(`${base}B`) % 100;
  let acc = 0;
  for (let i = 0; i < B_WEIGHTS.length; i++) {
    acc += B_WEIGHTS[i];
    if (roll < acc) return i;
  }
  return B_WEIGHTS.length - 1;
}

function getBTierFromIndex(bIndex: number): ChatTier {
  const t = B_BADGE_TIERS[bIndex];
  return (t ?? 5) as ChatTier;
}

export function getATierFromBadge(aBadge: string): ChatTier {
  if (aBadge === '524288 B') return 0;
  if (DIAMOND_SET.has(aBadge)) return 1;
  const langIndex = LANGUAGES.indexOf(aBadge);
  if (langIndex >= 0 && langIndex < 75) return 2;
  if (/^채점 중 \(/.test(aBadge)) return 3;
  if (/^\d+ B$/.test(aBadge)) return 5;
  return 4; // relative time labels
}

export function getBBadgeTier(bBadge: string): ChatTier {
  const idx = B_BADGES.indexOf(bBadge);
  return (B_BADGE_TIERS[idx] ?? 5) as ChatTier;
}

export function combineTiers(aTier: ChatTier, bTier: ChatTier): ChatTier {
  if (aTier === bTier) return Math.max(0, aTier - 1) as ChatTier;
  return Math.min(aTier, bTier) as ChatTier;
}

export function getFinalChatTier(uuid: string, salt: string): ChatTier {
  const base = uuid + salt;
  const flatIndex = getFlatIndex(base);
  const aTier = getATierFromFlatIndex(flatIndex);
  const bIndex = pickBIndex(base);
  const bTier = getBTierFromIndex(bIndex);
  return combineTiers(aTier, bTier);
}

export function getTierIconPath(tier: ChatTier): string {
  return `/icons/tier-${TIER_ICON_SLUG[tier]}.svg`;
}

export function getTierLabelKo(tier: ChatTier): string {
  return TIER_LABEL_KO[tier];
}

/** 도움말 팝업 조합표: [a=0..5][bIndex 0..4] = b 티어 1..5 */
export function getNicknameTierCombinationMatrix(): ChatTier[][] {
  const rows: ChatTier[][] = [];
  for (let a = 0; a <= 5; a++) {
    const row: ChatTier[] = [];
    for (let b = 1; b <= 5; b++) {
      row.push(combineTiers(a as ChatTier, b as ChatTier));
    }
    rows.push(row);
  }
  return rows;
}

type NicknameParts = {
  aBadge: string;
  bBadge: string;
};

export function generateNickname(uuid: string, salt: string): NicknameParts {
  const base = uuid + salt;
  const flatIndex = getFlatIndex(base);
  const aBadge = getABadgeTextFromFlatIndex(flatIndex);
  const bIndex = pickBIndex(base);
  const bBadge = B_BADGES[bIndex] ?? B_BADGES[0];

  return { aBadge, bBadge };
}

type KeywordPosition = {
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
};

function hashUnit(input: string): number {
  return fnv32(input) / 0xffffffff;
}

function centerBiasedPercent(seed: string): number {
  const samples = [
    hashUnit(`${seed}:1`),
    hashUnit(`${seed}:2`),
    hashUnit(`${seed}:3`),
    hashUnit(`${seed}:4`),
    hashUnit(`${seed}:5`),
  ];
  const mean = samples.reduce((acc, cur) => acc + cur, 0) / samples.length;
  const distance = mean - 0.5;
  const compressed = Math.sign(distance) * Math.pow(Math.abs(distance), 1.9);
  const centered = 0.5 + compressed;
  return Math.round(Math.max(0, Math.min(1, centered)) * 10000) / 100;
}

export function getKeywordPosition(globalIndex: number): KeywordPosition {
  const x = centerBiasedPercent(`x:${globalIndex}`);
  const y = centerBiasedPercent(`y:${globalIndex}`);
  const rotation = (fnv32(String(globalIndex + 2)) % 31) - 15;
  const fontSize = (fnv32(String(globalIndex + 3)) % 13) + 12;
  return { x, y, rotation, fontSize };
}
