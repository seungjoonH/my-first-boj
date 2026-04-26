import {
  B_BADGES,
  B_BADGE_TIERS,
  B_NICKNAME_WEIGHTS,
  CHAT_DIAMOND_LANGUAGES,
  LANGUAGES,
  NICKNAME_B_COL_COUNT,
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

/** 591×9 격자 전체 칸 수 */
export const NICKNAME_GRID_CELL_TOTAL = A_BADGE_FLAT_TOTAL * NICKNAME_B_COL_COUNT;

/** 닉네임 맵 섹션 제목: `tier-{slug}.svg` + "언어" 표기용 */
export type NicknameSectionLangTierIconSlug = 'diamond' | 'platinum';

export type NicknameFlatSectionMeta = {
  id: string;
  titleKo: string;
  flatStart: number;
  flatEnd: number;
  rowCount: number;
  /** 설정 시 `flatStart`~`flatEnd` 대신 이 순서로 행을 렌더 (언어 다이아/플래 분리 등) */
  flatIndices?: readonly number[];
  /** 설정 시 접힘 행 제목은 티어 SVG + "언어" (`titleKo`는 접근성·aria용 전체 문구 유지) */
  titleLangTierIcon?: NicknameSectionLangTierIconSlug;
};

const DIAMOND_SET = new Set<string>(CHAT_DIAMOND_LANGUAGES);

function buildLanguageFlatIndicesByTier(): {
  diamondFlatIndices: readonly number[];
  platinumFlatIndices: readonly number[];
} {
  const diamond: number[] = [];
  const platinum: number[] = [];
  for (let f = FLAT_INDEX_LANG_START; f <= FLAT_INDEX_LANG_END; f++) {
    const lang = LANGUAGES[f - 1];
    if (lang === undefined) continue;
    (DIAMOND_SET.has(lang) ? diamond : platinum).push(f);
  }
  return {
    diamondFlatIndices: diamond,
    platinumFlatIndices: platinum,
  };
}

const { diamondFlatIndices, platinumFlatIndices } = buildLanguageFlatIndicesByTier();

/** flatIndex 구간 — [`A_BADGE_FLAT_TOTAL`](./chatNickname.ts) 및 내부 FLAT_* 상수와 동기화 */
export const NICKNAME_FLAT_SECTIONS: readonly NicknameFlatSectionMeta[] = [
  { id: 'ruby', titleKo: '루비', flatStart: 0, flatEnd: 0, rowCount: 1 },
  {
    id: 'lang_diamond',
    titleKo: '다이아 언어',
    titleLangTierIcon: 'diamond',
    flatStart: FLAT_INDEX_LANG_START,
    flatEnd: FLAT_INDEX_LANG_END,
    rowCount: diamondFlatIndices.length,
    flatIndices: diamondFlatIndices,
  },
  {
    id: 'lang_platinum',
    titleKo: '플래티넘 언어',
    titleLangTierIcon: 'platinum',
    flatStart: FLAT_INDEX_LANG_START,
    flatEnd: FLAT_INDEX_LANG_END,
    rowCount: platinumFlatIndices.length,
    flatIndices: platinumFlatIndices,
  },
  { id: 'rel', titleKo: '제출 시각', flatStart: 76, flatEnd: 232, rowCount: 157 },
  { id: 'judge', titleKo: '채점 중 (%)', flatStart: 233, flatEnd: 333, rowCount: 101 },
  { id: 'mem', titleKo: '메모리 (B)', flatStart: 334, flatEnd: 590, rowCount: 257 },
] as const;

/** `NicknameMapGrid`·접이식 섹션과 동일한 flat 행 목록(내비·미니맵용) */
export function getNicknameMapFlatIndicesForSection(section: NicknameFlatSectionMeta): readonly number[] {
  if (section.flatIndices !== undefined && section.flatIndices.length > 0) {
    return section.flatIndices;
  }
  const out: number[] = [];
  for (let f = section.flatStart; f <= section.flatEnd; f++) out.push(f);
  return out;
}

/** 해당 `flatIndex`가 속한 접이식 섹션 id(루비만 `ruby`) */
export function getNicknameMapSectionIdForFlatIndex(flatIndex: number): string {
  for (const section of NICKNAME_FLAT_SECTIONS) {
    const rows = getNicknameMapFlatIndicesForSection(section);
    if (rows.includes(flatIndex)) return section.id;
  }
  return 'ruby';
}

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
  for (let i = 0; i < B_NICKNAME_WEIGHTS.length; i++) {
    acc += B_NICKNAME_WEIGHTS[i];
    if (roll < acc) return i;
  }
  return B_NICKNAME_WEIGHTS.length - 1;
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

/** init/saltMap과 동일: `uuid + effectiveSalt`(companion 접두 포함 가능) */
export function computeNicknameGridCoords(
  uuid: string,
  effectiveSalt: string,
): { flatIndex: number; bIndex: number } {
  const base = uuid + effectiveSalt;
  return { flatIndex: getFlatIndex(base), bIndex: pickBIndex(base) };
}

export type NicknameGridCellDisplay = {
  aBadge: string;
  bBadge: string;
  tier: ChatTier;
};

/** 격자 (flat, 열) 한 칸의 A/B 문구 및 티어 아이콘용 최종 티어 */
export function getNicknameGridCellDisplay(flatIndex: number, bIndex: number): NicknameGridCellDisplay {
  const aBadge = getABadgeTextFromFlatIndex(flatIndex);
  const bBadge = B_BADGES[bIndex] ?? B_BADGES[0];
  const aTier = getATierFromFlatIndex(flatIndex);
  const bTier = getBTierFromIndex(bIndex);
  return { aBadge, bBadge, tier: combineTiers(aTier, bTier) };
}

/** 격자 툴팁 등 — `NicknameBadgeBase`와 동일한 A·구분자·B 한 줄 문구 */
export function getNicknameGridCellPlainLabel(aBadge: string, bBadge: string): string {
  const aParts = splitMemoryByteSuffix(aBadge);
  const aCore =
    aParts.unitPart !== undefined ? `${aParts.valuePart}${aParts.unitPart}` : aBadge;
  const sep = aBadge.startsWith('채점 중') ? '후' : '의';
  return `${aCore}${sep}${bBadge}`;
}

/**
 * 격자 툴팁용 획득 확률(% 수치). `A_BADGE_FLAT_TOTAL` 슬롯 균등 × `B_NICKNAME_WEIGHTS` 열 비율.
 * 표기: `획득 확률 ${값.toFixed(6)}%` — 값은 100×(1/A)×(w/100) = w/A.
 */
export function getNicknameCellAcquisitionPercentForTooltip(bIndex: number): number {
  const w = B_NICKNAME_WEIGHTS[bIndex];
  if (w === undefined) return 0;
  return w / A_BADGE_FLAT_TOTAL;
}

function flatIndicesInNicknameSection(section: NicknameFlatSectionMeta): readonly number[] {
  if (section.flatIndices !== undefined && section.flatIndices.length > 0) {
    return section.flatIndices;
  }
  const out: number[] = [];
  for (let f = section.flatStart; f <= section.flatEnd; f++) {
    out.push(f);
  }
  return out;
}

function findNicknameFlatSectionForFlatIndex(flatIndex: number): NicknameFlatSectionMeta | undefined {
  for (const section of NICKNAME_FLAT_SECTIONS) {
    for (const f of flatIndicesInNicknameSection(section)) {
      if (f === flatIndex) return section;
    }
  }
  return undefined;
}

/**
 * 같은 격자 구간(`NICKNAME_FLAT_SECTIONS` 접기 섹션) 안에서, 현재 칸과 동일한 최종 티어가 되는
 * 모든 (flatIndex, 열) 조합의 획득 확률 합.
 *
 * 예: 메모리 구간에서 A가 `2 B`든 `100 B`든 A측 티어가 같고 B·조합 규칙이 같으면 최종 티어가 같아
 * 한 묶음으로 합산됨(획득 확률은 열마다 w/A이므로 동일 티어 칸 수만큼 가산).
 */
export function getNicknameCellSameTierAcquisitionPercentForTooltip(
  flatIndex: number,
  bIndex: number,
): number {
  const targetTier = getNicknameGridCellDisplay(flatIndex, bIndex).tier;
  const section = findNicknameFlatSectionForFlatIndex(flatIndex);
  if (section === undefined) return 0;

  const flats = flatIndicesInNicknameSection(section);
  let sum = 0;
  for (const f of flats) {
    for (let b = 0; b < NICKNAME_B_COL_COUNT; b++) {
      if (getNicknameGridCellDisplay(f, b).tier === targetTier) {
        sum += getNicknameCellAcquisitionPercentForTooltip(b);
      }
    }
  }
  return sum;
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
