export const SERVICE_END_MS = new Date('2026-04-28T00:00:00+09:00').getTime();

/** 게시판 공지 게시 시각 (KST) — 상대 시간 표기 기준 */
export const BOJ_SCRAPING_NOTICE_POSTED_AT_MS = new Date('2026-04-19T16:55:05+09:00').getTime();

export const BOJ_BASE = 'https://www.acmicpc.net';

/** 영문자·숫자·언더스코어, 1~99자 */
export const BOJ_ID_REGEX = /^[a-zA-Z0-9_]{1,99}$/;

export const SEARCH_STRATEGY_CONFIG_KEY = 'search:strategy';
export const DEFAULT_SEARCH_STRATEGY: 'binary' | 'ternary' = 'ternary';
