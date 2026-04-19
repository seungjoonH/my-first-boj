import {
  chatRedis,
  getOrCreateSalt,
  msgKey,
  kwKey,
  kwSeqKey,
  nickRlKey,
  getUserSalt,
  getUserCompanion,
  getUserWarnCount,
  parseMsg,
  getNickRlTtlSec,
} from '@/lib/chatRedis';
import { CHAT_MESSAGES_REDIS_MAX } from '@/lib/chatConstants';
import { getAdminUuid } from '@/lib/chatAdmin';
import type { ChatInitResponse, ChatMessage } from '@/types/chat';
import { parseKeywordValue } from '@/lib/chatKeyword';
import {
  resolveChatViewerContext,
  buildChatUuidSetCookieHeader,
  isVisibleChatMessage,
} from '@/lib/chatIdentityRequest';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ── HMAC 유틸 (Web Crypto API, Edge 호환) ────────────────────────────────────

async function computeProof(uuid: string): Promise<string> {
  const secret = process.env.CHAT_PROOF_SECRET;
  if (!secret) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(uuid));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const { uuid, isNewUuid, companion, isHealRequest } = await resolveChatViewerContext(req);

  const rawSalt = await getOrCreateSalt(uuid);
  const mySalt = companion ? `${companion}:${rawSalt}` : rawSalt;

  const [rawMsgs, rawKeywords, rawCount, rawNickRl, warnCount, proof] = await Promise.all([
    chatRedis?.lrange(msgKey(), 0, CHAT_MESSAGES_REDIS_MAX - 1) ?? [],
    chatRedis?.lrange(kwKey(), 0, 499) ?? [],
    chatRedis?.get(kwSeqKey()),
    chatRedis?.get(nickRlKey(uuid)),
    getUserWarnCount(uuid),
    computeProof(uuid),
  ]);

  const messages = (rawMsgs as unknown[])
    .map(parseMsg)
    .filter((m): m is ChatMessage => m !== null)
    .filter((m) => isVisibleChatMessage(m, uuid));

  const keywordUuids = (rawKeywords as unknown[])
    .filter((k): k is string => typeof k === 'string')
    .map((k) => parseKeywordValue(k).clientUuid)
    .filter((u): u is string => Boolean(u));

  const uniqueUuids = [...new Set([...messages.map((m) => m!.clientUuid), ...keywordUuids])]
    .filter((u) => u !== uuid);

  const saltEntries = await Promise.all(
    uniqueUuids.map(async (u) => {
      const [s, c] = await Promise.all([getUserSalt(u), getUserCompanion(u)]);
      return [u, c ? `${c}:${s}` : s] as [string, string];
    }),
  );

  const saltMap: Record<string, string> = Object.fromEntries(saltEntries);
  saltMap[uuid] = mySalt;

  let nickCooldownRemaining = 0;
  if (rawNickRl) {
    const ttl = await chatRedis?.ttl(nickRlKey(uuid));
    nickCooldownRemaining = typeof ttl === 'number' && ttl > 0 ? ttl : 0;
  }

  const nickCooldownTtlSec = await getNickRlTtlSec();

  const body: ChatInitResponse = {
    messages,
    messageCount: messages.length,
    saltMap,
    keywords: (rawKeywords as unknown[]).filter((k) => typeof k === 'string') as string[],
    mentionCount: rawCount ? Number(rawCount) : 0,
    myUuid: uuid,
    adminUuid: getAdminUuid(),
    nickCooldownRemaining,
    nickCooldownTtlSec,
    companion,
    warnCount,
    proof,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isNewUuid || isHealRequest) {
    headers['Set-Cookie'] = buildChatUuidSetCookieHeader(uuid);
  }

  return new Response(JSON.stringify(body), { headers });
}
