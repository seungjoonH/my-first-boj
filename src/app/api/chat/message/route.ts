import { chatRedis, msgKey, kwKey, kwSeqKey, msgRlKey, getUserWarnCount, isUserBanned, setUserBanned } from '@/lib/chatRedis';
import { MESSAGE_MAX_LEN, KEYWORD_REDIS_MAX, MSG_RL_TTL_SEC, CHAT_MESSAGES_REDIS_MAX, MAX_WARN_COUNT } from '@/lib/chatConstants';
import { isReservedChatUuid } from '@/lib/chatAdmin';
import { SERVICE_END_MS } from '@/lib/constants';
import { buildKeywordValue, normalizeKeywordToken, KEYWORD_REGEX } from '@/lib/chatKeyword';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
const MESSAGE_IDEMPOTENCY_TTL_SEC = 30;

function getUuid(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  return cookie.match(/(?:^|;\s*)chat-uuid=([^;]+)/)?.[1] ?? null;
}

export async function POST(req: Request): Promise<Response> {
  const uuid = getUuid(req);
  if (!uuid) {
    return Response.json({ ok: false, error: 'uuid missing' }, { status: 400 });
  }
  if (isReservedChatUuid(uuid)) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  if (Date.now() >= SERVICE_END_MS) {
    return Response.json({ ok: false, error: 'ended' });
  }

  const [banned, warnCount] = await Promise.all([
    isUserBanned(uuid),
    getUserWarnCount(uuid),
  ]);
  if (banned) {
    return Response.json({ ok: false, error: 'banned' });
  }
  if (warnCount >= MAX_WARN_COUNT) {
    await setUserBanned(uuid);
    return Response.json({ ok: false, error: 'banned' });
  }

  let body: { message?: unknown; messageId?: unknown };
  try { body = (await req.json()) as { message?: unknown; messageId?: unknown }; }
  catch { return Response.json({ ok: false, error: 'invalid body' }, { status: 400 }); }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return Response.json({ ok: false, error: 'empty' });
  }
  if (message.length > MESSAGE_MAX_LEN) {
    return Response.json({ ok: false, error: 'too_long' });
  }

  const messageIdRaw = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const messageId = messageIdRaw && messageIdRaw.length <= 64 ? messageIdRaw : crypto.randomUUID();

  if (chatRedis) {
    const idemKey = `chat:idem:msg:${uuid}:${messageId}`;
    const firstSeen = await chatRedis.set(idemKey, '1', { ex: MESSAGE_IDEMPOTENCY_TTL_SEC, nx: true });
    if (!firstSeen) {
      return Response.json({ ok: true, keywordsAdded: [] });
    }
  }

  const rateLimited = await chatRedis?.get(msgRlKey(uuid));
  if (rateLimited) {
    return Response.json({ ok: false, error: 'rate_limit' });
  }

  await chatRedis?.set(msgRlKey(uuid), '1', { ex: MSG_RL_TTL_SEC });

  const chatMessage = JSON.stringify({
    id: messageId,
    clientUuid: uuid,
    message,
    timestamp: Date.now(),
  });

  await chatRedis?.rpush(msgKey(), chatMessage);
  await chatRedis?.ltrim(msgKey(), -CHAT_MESSAGES_REDIS_MAX, -1);

  const keywordsAdded: string[] = [];
  const matches = message.match(KEYWORD_REGEX);
  if (matches && matches.length > 0) {
    // 한 메시지당 키워드는 첫 매치 1개만 반영한다.
    const firstKeyword = normalizeKeywordToken(matches[0]);
    const globalIndex = await chatRedis?.incr(kwSeqKey());
    const value = buildKeywordValue(firstKeyword, Number(globalIndex), uuid);
    keywordsAdded.push(value);
    await chatRedis?.rpush(kwKey(), value);
    await chatRedis?.ltrim(kwKey(), -KEYWORD_REDIS_MAX, -1);
  }

  return Response.json({ ok: true, keywordsAdded });
}
