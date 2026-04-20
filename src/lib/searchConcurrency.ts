import type { Redis } from '@upstash/redis';
import {
  SEARCH_BOJ_CONC_FAILURE_THRESHOLD_CONFIG_KEY,
  SEARCH_BOJ_CONC_GENERAL_CONFIG_KEY,
  SEARCH_BOJ_CONC_PRIORITY_CONFIG_KEY,
  SEARCH_BOJ_FAILURE_THRESHOLD,
  SEARCH_BOJ_GENERAL_SLOTS,
  SEARCH_BOJ_PRIORITY_SLOTS,
} from '@/lib/constants';

const SECONDS_PER_HOUR = 3600;
const SEARCH_BOJ_FAILURE_KEY_TTL_SEC = SECONDS_PER_HOUR;
const BOJ_SEARCH_REQUEST_DEADLINE_MS = 110_000;
/** 슬롯 키 자동 복구용 TTL — 탐색 최대 시간 + 여유 */
export const SEARCH_BOJ_SLOT_KEY_TTL_SEC = Math.ceil(BOJ_SEARCH_REQUEST_DEADLINE_MS / 1000) + 60;

const GENERAL_SLOTS_MIN = 1;
const GENERAL_SLOTS_MAX = 64;
const PRIORITY_SLOTS_MIN = 0;
const PRIORITY_SLOTS_MAX = 32;
const FAILURE_THRESHOLD_MIN = 1;
const FAILURE_THRESHOLD_MAX = 64;

export type BojConcurrencyResolved = {
  generalSlots: number;
  prioritySlots: number;
  failureThreshold: number;
};

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  if (n < min || n > max) return fallback;
  return n;
}

function parseConfigInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (raw == null || raw === '') return fallback;
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  return clampInt(n, min, max, fallback);
}

/**
 * Redis 오버라이드와 코드 기본값을 합친 BOJ 동시성 파라미터.
 * API·관리자 CLI에서 동일하게 사용한다.
 */
export async function getResolvedBojConcurrencyConfig(redis: Redis | null): Promise<BojConcurrencyResolved> {
  if (!redis) {
    return {
      generalSlots: SEARCH_BOJ_GENERAL_SLOTS,
      prioritySlots: SEARCH_BOJ_PRIORITY_SLOTS,
      failureThreshold: SEARCH_BOJ_FAILURE_THRESHOLD,
    };
  }
  try {
    const [gRaw, pRaw, fRaw] = await Promise.all([
      redis.get(SEARCH_BOJ_CONC_GENERAL_CONFIG_KEY),
      redis.get(SEARCH_BOJ_CONC_PRIORITY_CONFIG_KEY),
      redis.get(SEARCH_BOJ_CONC_FAILURE_THRESHOLD_CONFIG_KEY),
    ]);
    return {
      generalSlots: parseConfigInt(gRaw, SEARCH_BOJ_GENERAL_SLOTS, GENERAL_SLOTS_MIN, GENERAL_SLOTS_MAX),
      prioritySlots: parseConfigInt(pRaw, SEARCH_BOJ_PRIORITY_SLOTS, PRIORITY_SLOTS_MIN, PRIORITY_SLOTS_MAX),
      failureThreshold: parseConfigInt(
        fRaw,
        SEARCH_BOJ_FAILURE_THRESHOLD,
        FAILURE_THRESHOLD_MIN,
        FAILURE_THRESHOLD_MAX,
      ),
    };
  }
  catch (e) {
    console.error('[search:conc] config GET failed — 코드 기본값 사용', e);
    return {
      generalSlots: SEARCH_BOJ_GENERAL_SLOTS,
      prioritySlots: SEARCH_BOJ_PRIORITY_SLOTS,
      failureThreshold: SEARCH_BOJ_FAILURE_THRESHOLD,
    };
  }
}

const KEY_GENERAL = 'search:conc:general';
const KEY_PRIORITY = 'search:conc:priority';

function failureKey(uuid: string): string {
  return `search:failure:${uuid}`;
}

export type BojSearchSlotReleaseKind = 'general' | 'priority' | 'none';

export type TryAcquireBojSearchSlotResult =
  | { granted: true; releaseKind: BojSearchSlotReleaseKind }
  | { granted: false; failureCount: number };

/**
 * 일반 → 우선 슬롯 시도(추적 유저) 또는 일반만(익명).
 * 반환 배열: { granted 0|1, slot 1=general 2=priority 0=none, failureCount }
 */
const ACQUIRE_LUA = `
local mode = ARGV[1]
local slot_ttl = tonumber(ARGV[2])
local gen_max = tonumber(ARGV[3])
local pri_max = tonumber(ARGV[4])
local fail_ttl = tonumber(ARGV[5])

local g = redis.call('INCR', KEYS[1])
if g <= gen_max then
  redis.call('EXPIRE', KEYS[1], slot_ttl)
  return {1, 1, 0}
end
redis.call('DECR', KEYS[1])

if mode == '0' then
  return {0, 0, 0}
end

local p = redis.call('INCR', KEYS[2])
if p > pri_max then
  redis.call('DECR', KEYS[2])
  local f = redis.call('INCR', KEYS[3])
  redis.call('EXPIRE', KEYS[3], fail_ttl)
  return {0, 0, f}
end

local fc = redis.call('GET', KEYS[3])
local fcnum = tonumber(fc) or 0
if fcnum < 1 then
  redis.call('DECR', KEYS[2])
  local f = redis.call('INCR', KEYS[3])
  redis.call('EXPIRE', KEYS[3], fail_ttl)
  return {0, 0, f}
end

redis.call('EXPIRE', KEYS[2], slot_ttl)
return {1, 2, 0}
`;

function parseAcquireResult(raw: unknown): { granted: boolean; slot: number; failureCount: number } {
  if (!Array.isArray(raw) || raw.length < 3) {
    return { granted: false, slot: 0, failureCount: 0 };
  }
  const granted = Number(raw[0]) === 1;
  const slot = Number(raw[1]);
  const failureCount = Number(raw[2]);
  return {
    granted,
    slot: Number.isFinite(slot) ? slot : 0,
    failureCount: Number.isFinite(failureCount) ? failureCount : 0,
  };
}

export async function tryAcquireBojSearchSlot(
  redis: Redis | null,
  uuid: string | null,
): Promise<TryAcquireBojSearchSlotResult> {
  if (!redis) {
    console.warn('[search:conc] Redis 없음 — BOJ 동시성 제한 생략');
    return { granted: true, releaseKind: 'none' };
  }

  const { generalSlots, prioritySlots, failureThreshold } = await getResolvedBojConcurrencyConfig(redis);

  if (uuid) {
    try {
      const fcRaw = await redis.get(failureKey(uuid));
      const fc = typeof fcRaw === 'string' ? Number.parseInt(fcRaw, 10) : Number(fcRaw);
      const failureSoFar = Number.isFinite(fc) ? fc : 0;
      if (failureSoFar >= failureThreshold) {
        return { granted: true, releaseKind: 'none' };
      }
    }
    catch (e) {
      console.error('[search:conc] failure GET failed — 슬롯 경로로 진행', e);
    }
  }

  const modeFlag = uuid ? '1' : '0';
  const keys = uuid ? [KEY_GENERAL, KEY_PRIORITY, failureKey(uuid)] : [KEY_GENERAL];

  try {
    const raw = await redis.eval(
      ACQUIRE_LUA,
      keys,
      [
        modeFlag,
        String(SEARCH_BOJ_SLOT_KEY_TTL_SEC),
        String(generalSlots),
        String(prioritySlots),
        String(SEARCH_BOJ_FAILURE_KEY_TTL_SEC),
      ],
    );
    const parsed = parseAcquireResult(raw);
    if (parsed.granted) {
      if (parsed.slot === 1) return { granted: true, releaseKind: 'general' };
      if (parsed.slot === 2) return { granted: true, releaseKind: 'priority' };
      return { granted: true, releaseKind: 'none' };
    }
    return { granted: false, failureCount: Math.max(1, parsed.failureCount) };
  }
  catch (e) {
    console.error('[search:conc] eval failed', e);
    return { granted: false, failureCount: 1 };
  }
}

export async function releaseBojSearchSlot(redis: Redis | null, releaseKind: BojSearchSlotReleaseKind): Promise<void> {
  if (!redis) return;
  try {
    switch (releaseKind) {
      case 'general':
        await redis.decr(KEY_GENERAL);
        break;
      case 'priority':
        await redis.decr(KEY_PRIORITY);
        break;
      case 'none':
        break;
    }
  }
  catch (e) {
    console.error('[search:conc] release failed', { releaseKind, error: e });
  }
}

export async function resetSearchFailureCount(redis: Redis | null, uuid: string | null): Promise<void> {
  if (!redis || !uuid) return;
  try {
    await redis.del(failureKey(uuid));
  }
  catch (e) {
    console.error('[search:conc] failure DEL failed', e);
  }
}
