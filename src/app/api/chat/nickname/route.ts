import { chatRedis, nickRlKey, setUserSalt, getUserCompanion, getNickRlTtlSec } from '@/lib/chatRedis';
import { isReservedChatUuid } from '@/lib/chatAdmin';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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

  const rateLimited = await chatRedis?.get(nickRlKey(uuid));
  if (rateLimited) {
    const ttl = await chatRedis?.ttl(nickRlKey(uuid));
    const remainingSeconds = typeof ttl === 'number' && ttl > 0 ? ttl : 0;
    return Response.json({ ok: false, error: 'rate_limit', remainingSeconds });
  }

  const newSalt = crypto.randomUUID();
  await setUserSalt(uuid, newSalt);
  const nickCooldownSeconds = await getNickRlTtlSec();
  await chatRedis?.set(nickRlKey(uuid), '1', { ex: nickCooldownSeconds });

  // companion prefix를 포함한 effective salt 반환
  // (init 응답의 saltMap[uuid]와 동일한 형식이어야 클라이언트가 올바른 닉네임을 즉시 표시 가능)
  const companion = await getUserCompanion(uuid);
  const effectiveSalt = companion ? `${companion}:${newSalt}` : newSalt;

  return Response.json({ ok: true, newSalt: effectiveSalt, nickCooldownSeconds });
}
