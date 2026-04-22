import { Redis } from '@upstash/redis';
import type { ChatMessage } from '@/types/chat';
import { NICK_RL_TTL_CONFIG_KEY, NICK_RL_TTL_SEC } from '@/lib/chatConstants';

export const chatRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export function msgKey(): string {
  return 'chat:messages';
}

export function kwKey(): string {
  return 'chat:keywords';
}

export function kwSeqKey(): string {
  return 'chat:keyword_seq';
}

export function userSaltHashKey(): string {
  return 'chat:user:salt';
}

export function userCompanionHashKey(): string {
  return 'chat:user:companion';
}

export function userWarnHashKey(): string {
  return 'chat:user:warn';
}

export function userBanSetKey(): string {
  return 'chat:user:banned';
}

export function onlineSetKey(): string {
  return 'chat:online:conn';
}

export function msgRlKey(scopeKey: string): string {
  return `chat:rl:msg:${scopeKey}`;
}

export function nickRlKey(uuid: string): string {
  return `chat:rl:nick:${uuid}`;
}

const NICK_RL_TTL_MIN = 1;
const NICK_RL_TTL_MAX = 86400 * 366;

/** 닉네임 변경 API에 적용할 쿨다운 TTL(초). Redis 전역 설정이 없으면 코드 기본값 사용 */
export async function getNickRlTtlSec(): Promise<number> {
  if (!chatRedis) return NICK_RL_TTL_SEC;
  const raw = await chatRedis.get(NICK_RL_TTL_CONFIG_KEY);
  if (raw == null) return NICK_RL_TTL_SEC;
  const n = Number(typeof raw === 'string' ? raw : String(raw));
  if (!Number.isFinite(n) || n < NICK_RL_TTL_MIN || n > NICK_RL_TTL_MAX) return NICK_RL_TTL_SEC;
  return Math.floor(n);
}

export async function getUserSalt(uuid: string): Promise<string> {
  if (!chatRedis) return '';
  const raw = await chatRedis.hget(userSaltHashKey(), uuid);
  return raw ? String(raw) : '';
}

export async function setUserSalt(uuid: string, salt: string): Promise<void> {
  await chatRedis?.hset(userSaltHashKey(), { [uuid]: salt });
}

export async function getUserCompanion(uuid: string): Promise<string> {
  if (!chatRedis) return '';
  const raw = await chatRedis.hget(userCompanionHashKey(), uuid);
  return raw ? String(raw) : '';
}

export async function setUserCompanion(uuid: string, companion: string): Promise<void> {
  await chatRedis?.hset(userCompanionHashKey(), { [uuid]: companion });
}

export async function getUserWarnCount(uuid: string): Promise<number> {
  if (!chatRedis) return 0;
  const raw = await chatRedis.hget(userWarnHashKey(), uuid);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function setUserWarnCount(uuid: string, warnCount: number): Promise<void> {
  const normalized = Math.max(0, Math.floor(warnCount));
  await chatRedis?.hset(userWarnHashKey(), { [uuid]: String(normalized) });
}

export async function incrUserWarnCount(uuid: string): Promise<number> {
  if (!chatRedis) return 0;
  return Number(await chatRedis.hincrby(userWarnHashKey(), uuid, 1));
}

export async function isUserBanned(uuid: string): Promise<boolean> {
  if (!chatRedis) return false;
  const raw = await chatRedis.sismember(userBanSetKey(), uuid);
  return Boolean(raw);
}

export async function setUserBanned(uuid: string): Promise<void> {
  await chatRedis?.sadd(userBanSetKey(), uuid);
}

export async function unsetUserBanned(uuid: string): Promise<void> {
  await chatRedis?.srem(userBanSetKey(), uuid);
}

export async function getEffectiveSalt(uuid: string): Promise<string> {
  if (!chatRedis) return '';
  const [s, c] = await Promise.all([getUserSalt(uuid), getUserCompanion(uuid)]);
  return c ? `${c}:${s}` : s;
}

export async function getOrCreateSalt(uuid: string): Promise<string> {
  if (!chatRedis) return 'default';

  const existing = await getUserSalt(uuid);
  if (existing) return existing;

  const newSalt = crypto.randomUUID();
  await setUserSalt(uuid, newSalt);
  return newSalt;
}

export function parseMsg(raw: unknown): ChatMessage | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as ChatMessage) : (raw as ChatMessage);
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.clientUuid === 'string' &&
      typeof parsed.message === 'string' &&
      typeof parsed.timestamp === 'number'
    ) {
      const hasNoReplyTarget = parsed.replyToMessageId === undefined;
      const hasValidReplyTarget = typeof parsed.replyToMessageId === 'string';
      if (hasNoReplyTarget || hasValidReplyTarget) return parsed;
      const { replyToMessageId, ...rest } = parsed;
      void replyToMessageId;
      return rest;
    }
    return null;
  }
  catch {
    return null;
  }
}
