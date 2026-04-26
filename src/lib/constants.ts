export const SERVICE_END_MS = new Date('2026-04-28T00:00:00+09:00').getTime();

/** 게시판 공지 게시 시각 (KST) — 상대 시간 표기 기준 */
export const BOJ_SCRAPING_NOTICE_POSTED_AT_MS = new Date('2026-04-19T16:55:05+09:00').getTime();

/** 탐색 전략 개선 공지 — 상대 시간·레지스트리 sortKey 기준 (KST, 참고 글 시각에 맞춤) */
export const SEARCH_STRATEGY_UPDATE_NOTICE_POSTED_AT_MS = new Date('2026-04-26T21:45:33+09:00').getTime();

export const BOJ_BASE = 'https://www.acmicpc.net';

/** 영문자·숫자·언더스코어, 1~99자 */
export const BOJ_ID_REGEX = /^[a-zA-Z0-9_]{1,99}$/;

export const SEARCH_STRATEGY_CONFIG_KEY = 'search:strategy';
export const DEFAULT_SEARCH_STRATEGY: 'binary' | 'ternary' | 'top1_prev' = 'top1_prev';

/** [docs/search-concurrency.md] BOJ 동시 탐색 — 코드 기본값 */
export const SEARCH_BOJ_GENERAL_SLOTS = 2;
export const SEARCH_BOJ_PRIORITY_SLOTS = 1;
export const SEARCH_BOJ_FAILURE_THRESHOLD = 3;

/** Redis 오버라이드 — 미설정 시 위 코드 기본값 (`scripts/admin.ts` /search -cg|-cp|-cf) */
export const SEARCH_BOJ_CONC_GENERAL_CONFIG_KEY = 'search:conc:config:general';
export const SEARCH_BOJ_CONC_PRIORITY_CONFIG_KEY = 'search:conc:config:priority';
export const SEARCH_BOJ_CONC_FAILURE_THRESHOLD_CONFIG_KEY = 'search:conc:config:failure_threshold';
/** 동시 요청 제한 토스트에서 "여전히 혼잡" 문구로 전환하는 실패 횟수 기준 */
export const SEARCH_CONCURRENCY_RETRY_NOTICE_THRESHOLD = 2;

/** 제출 기록 탐색이 Redis(원격 저장소)에 어떻게 의존하는지 */
export type SearchExploreMode = 'redis_only' | 'redis_and_boj';

/**
 * - `redis_only`: BOJ(백준) HTTP 요청 없음. Redis에 저장된 조회 결과 캐시만 반환; 없으면 에러.
 * - `redis_and_boj`: 캐시 없을 때 BOJ status 페이지를 호출해 탐색.
 */
export const SEARCH_EXPLORE_MODE: SearchExploreMode = 'redis_and_boj';
