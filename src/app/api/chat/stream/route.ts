import {
  batchGetEffectiveSalts,
  chatRedis,
  msgKey,
  kwKey,
  parseMsg,
  onlineRefHashKey,
  onlineSetKey,
  onlineUniqSetKey,
} from '@/lib/chatRedis';
import {
  CHAT_MESSAGES_REDIS_MAX,
  SSE_POLL_BASE_MS,
  SSE_HEARTBEAT_MS,
  SSE_STREAM_MSG_TAIL,
  SSE_ONLINE_TOUCH_INTERVAL_MS,
} from '@/lib/chatConstants';
import type { ChatSseEvent, ChatMessage } from '@/types/chat';
import { parseKeywordValue } from '@/lib/chatKeyword';

/** 장시간 SSE는 Edge 제한(실행 시간)에 걸리기 쉬움 — Node 런타임 + maxDuration 사용 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const ONLINE_STALE_MS = SSE_HEARTBEAT_MS * 2;

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
  });
}

function getUuid(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  return cookie.match(/(?:^|;\s*)chat-uuid=([^;]+)/)?.[1]?.trim() ?? null;
}

function isVisibleMessage(message: ChatMessage, viewerUuid: string | null): boolean {
  if (message.isDm !== true) return true;
  if (!viewerUuid) return false;
  if (!message.dmToUuid) return false;
  if (message.dmToUuid === viewerUuid) return true;
  if (message.clientUuid === viewerUuid) return true;
  return false;
}

/**
 * 접속 인원 1 = 브라우저에서 `chat-uuid`로 식별된 사용자(또는 쿠키 수립 전 `X-Chat-Companion` 세션) 1.
 * `uuid:랜덤cid`는 재연결마다 키가 늘어나 배포(프록시) 환경에서 누적이 나므로 쓰지 않는다.
 */
function resolveOnlineMember(req: Request, legacyCid: string | null): string | null {
  const cookieUuid = getUuid(req);
  if (cookieUuid) {
    return cookieUuid;
  }
  const companion = req.headers.get('X-Chat-Companion')?.trim() ?? '';
  if (companion.length > 0 && companion.length <= 64) {
    return `anon:${companion}`;
  }
  if (legacyCid && legacyCid.length > 0) {
    return `pre:${legacyCid}`;
  }
  return null;
}

function anonKeyFromCompanion(companion: string): string {
  return `anon:${companion}`;
}

/**
 * 이 HTTP SSE 연결 1회 open — 동일 `member`로 n탭/재시도 시 ref만 n, uniq(고유 1)는 첫 1에만 SADD.
 * @returns `release` 호출해도 될지 — acquire 가 반(hincr) 성공한 경우만 true.
 */
async function acquireOnlineStream(member: string | null, req: Request): Promise<boolean> {
  if (!chatRedis || !member) return false;
  try {
    const cookieUuid = getUuid(req);
    const comp = req.headers.get('X-Chat-Companion')?.trim() ?? '';
    if (cookieUuid && comp.length > 0 && comp.length <= 64 && member === cookieUuid) {
      await chatRedis.zrem(onlineSetKey(), anonKeyFromCompanion(comp)).catch(() => {});
    }
    const hkey = onlineRefHashKey();
    const ukey = onlineUniqSetKey();
    const n = await chatRedis.hincrby(hkey, member, 1);
    if (n === 1) {
      await chatRedis.sadd(ukey, member);
    }
    return true;
  }
  catch {
    return false;
  }
}

/**
 * `chat:online:conn` zset은 heartbeat(유령 `zremrange` 보조). **표시 인원 = `onlineUniq` SCARD.**
 * `acquire` 실패 시 zadd 는 생략(ref/ uniq 와 엇갈리지 않게).
 */
async function touchOnlineHeartbeat(
  member: string | null,
  slotHeld: boolean,
): Promise<number> {
  if (!chatRedis) return 0;
  if (!member) return Number(await chatRedis.scard(onlineUniqSetKey()) ?? 0);
  if (slotHeld) {
    const now = Date.now();
    const staleBefore = now - ONLINE_STALE_MS;
    const zkey = onlineSetKey();
    await Promise.all([
      chatRedis.zadd(zkey, { score: now, member }),
      chatRedis.zremrangebyscore(zkey, 0, staleBefore),
    ]);
  }
  return Number(await chatRedis.scard(onlineUniqSetKey()) ?? 0);
}

/** `acquire` 쌍. ref=0이면 uniq·zset(출석)에서 제거. */
async function releaseOnlineStream(member: string | null, req: Request): Promise<void> {
  if (!chatRedis || !member) return;
  const hkey = onlineRefHashKey();
  const ukey = onlineUniqSetKey();
  const zkey = onlineSetKey();
  const after = await chatRedis.hincrby(hkey, member, -1);
  if (after < 0) {
    await chatRedis.hset(hkey, { [member]: 0 });
    await chatRedis.srem(ukey, member);
    await chatRedis.zrem(zkey, member);
  }
  else if (after === 0) {
    await chatRedis.srem(ukey, member);
    await chatRedis.zrem(zkey, member);
  }
  const cookieUuid = getUuid(req);
  const comp = req.headers.get('X-Chat-Companion')?.trim() ?? '';
  if (cookieUuid && comp.length > 0 && comp.length <= 64 && member === cookieUuid) {
    await chatRedis.zrem(zkey, anonKeyFromCompanion(comp)).catch(() => {});
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') ?? '0');
  const lastKwIdx = Number(url.searchParams.get('lastKwIdx') ?? '0');
  const viewerUuid = getUuid(req);
  const legacyCid = url.searchParams.get('cid')?.trim() ?? null;
  const onlineMember = resolveOnlineMember(req, legacyCid);

  const encoder = new TextEncoder();

  // req.signal 만으로는 클라이언트가 fetch를 abort했을 때 즉시 발화하지 않는 경우가 있어
  // ReadableStream cancel() 콜백을 통해 내부 abort를 보장한다.
  const streamAbort = new AbortController();
  req.signal.addEventListener('abort', () => streamAbort.abort(), { once: true });

  const stream = new ReadableStream({
    async start(controller) {
      const tookOnlineSlot = await acquireOnlineStream(onlineMember, req);
      function send(event: ChatSseEvent): void {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        catch {
          // enqueue 실패(클라이언트 종료 등) 시 루프는 signal 로 정리됨
        }
      }

      let lastOnlineCount = -1;
      async function refreshOnlineCount(): Promise<void> {
        try {
          const count = await touchOnlineHeartbeat(onlineMember, tookOnlineSlot);
          if (count === lastOnlineCount) return;
          send({ type: 'online', count });
          lastOnlineCount = count;
        }
        catch {
          send({ type: 'ping' });
        }
      }
      // 연결 직후 현재 접속자 수 전송
      try {
        await refreshOnlineCount();
      }
      catch { /* ignore */ }

      let lastTimestamp = since;
      let lastKwIndex = lastKwIdx;
      let pollMs = SSE_POLL_BASE_MS;
      let lastHeartbeat = Date.now();
      let lastOnlineTouchAt = Date.now();

      try {
        while (!streamAbort.signal.aborted) {
          try {
            const tail = SSE_STREAM_MSG_TAIL;
            const [rawTailMsgs, rawKws] = await Promise.all([
              chatRedis?.lrange(msgKey(), -tail, -1) ?? [],
              chatRedis?.lrange(kwKey(), -20, -1) ?? [],
            ]);
            let rawMsgs = rawTailMsgs;
            const parsedForTail = (rawMsgs as unknown[])
              .map(parseMsg)
              .filter((m): m is ChatMessage => m !== null);
            let newMsgs = parsedForTail.filter((m) => m.timestamp > lastTimestamp);
            if (
              rawMsgs.length === tail
              && newMsgs.length === tail
              && parsedForTail.length === tail
            ) {
              rawMsgs = (await chatRedis?.lrange(msgKey(), 0, CHAT_MESSAGES_REDIS_MAX - 1)) ?? [];
              newMsgs = (rawMsgs as unknown[])
                .map(parseMsg)
                .filter((m): m is ChatMessage => m !== null && m.timestamp > lastTimestamp);
            }

            for (const msg of newMsgs) {
              lastTimestamp = Math.max(lastTimestamp, msg.timestamp);
            }

            const saltUuids = [
              ...new Set(
                newMsgs
                  .filter((m) => isVisibleMessage(m, viewerUuid) && m.isAdmin !== true)
                  .map((m) => m.clientUuid),
              ),
            ];
            const saltByUuid =
              saltUuids.length > 0 && chatRedis ? await batchGetEffectiveSalts(saltUuids) : new Map();

            for (const msg of newMsgs) {
              if (!isVisibleMessage(msg, viewerUuid)) continue;
              let effectiveSalt = '';
              if (msg.isAdmin === true) {
                // 관리자 메시지는 UI에서 ADMIN 뱃지만 쓰고 salt 불필요 — Redis 조회 생략
              }
              else {
                effectiveSalt = saltByUuid.get(msg.clientUuid) ?? '';
              }
              send({
                type: 'message',
                ...msg,
                salt: effectiveSalt,
              });
            }

            const newKws = (rawKws as unknown[]).filter((kw): kw is string => {
              if (typeof kw !== 'string') return false;
              const parsed = parseKeywordValue(kw);
              if (parsed.globalIndex === null) return false;
              return parsed.globalIndex > lastKwIndex;
            });

            for (const kw of newKws) {
              send({ type: 'keyword', value: kw });
              const parsed = parseKeywordValue(kw);
              if (parsed.globalIndex !== null && parsed.globalIndex > lastKwIndex) {
                lastKwIndex = parsed.globalIndex;
              }
            }

            const nowTick = Date.now();
            if (nowTick - lastOnlineTouchAt >= SSE_ONLINE_TOUCH_INTERVAL_MS) {
              lastOnlineTouchAt = nowTick;
              await refreshOnlineCount();
            }

            if (Date.now() - lastHeartbeat > SSE_HEARTBEAT_MS) {
              send({ type: 'ping' });
              lastHeartbeat = Date.now();
            }
          }
          catch {
            pollMs = SSE_POLL_BASE_MS;
          }
          await sleepAbortable(pollMs, streamAbort.signal);
        }
      }
      finally {
        if (tookOnlineSlot) {
          await releaseOnlineStream(onlineMember, req).catch(() => {});
        }
        try {
          controller.close();
        }
        catch {
          // no-op
        }
      }
    },
    cancel() {
      // 클라이언트가 스트림을 끊으면 루프를 즉시 중단해 releaseOnlineStream 이 돌게 한다
      streamAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
