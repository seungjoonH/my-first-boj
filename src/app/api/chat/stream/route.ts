import { chatRedis, msgKey, kwKey, getUserSalt, getUserCompanion, parseMsg } from '@/lib/chatRedis';
import { CHAT_MESSAGES_REDIS_MAX, SSE_POLL_BASE_MS, SSE_HEARTBEAT_MS } from '@/lib/chatConstants';
import type { ChatSseEvent, ChatMessage } from '@/types/chat';
import { parseKeywordValue } from '@/lib/chatKeyword';

/** 장시간 SSE는 Edge 제한(실행 시간)에 걸리기 쉬움 — Node 런타임 + maxDuration 사용 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') ?? '0');
  const lastKwIdx = Number(url.searchParams.get('lastKwIdx') ?? '0');
  const viewerUuid = getUuid(req);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: ChatSseEvent): void {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        catch {
          // enqueue 실패(클라이언트 종료 등) 시 루프는 signal 로 정리됨
        }
      }

      let lastTimestamp = since;
      let lastKwIndex = lastKwIdx;
      let pollMs = SSE_POLL_BASE_MS;
      let lastHeartbeat = Date.now();

      try {
        while (!req.signal.aborted) {
          try {
            const [rawMsgs, rawKws] = await Promise.all([
              chatRedis?.lrange(msgKey(), 0, CHAT_MESSAGES_REDIS_MAX - 1) ?? [],
              chatRedis?.lrange(kwKey(), -20, -1) ?? [],
            ]);

            const newMsgs = (rawMsgs as unknown[])
              .map(parseMsg)
              .filter((m): m is ChatMessage => m !== null && m.timestamp > lastTimestamp);

            for (const msg of newMsgs) {
              lastTimestamp = Math.max(lastTimestamp, msg.timestamp);
              if (!isVisibleMessage(msg, viewerUuid)) continue;
              let effectiveSalt = '';
              if (msg.isAdmin === true) {
                // 관리자 메시지는 UI에서 ADMIN 뱃지만 쓰고 salt 불필요 — Redis 조회 생략
              }
              else {
                // 일반 사용자: salt는 항상 Redis 최신값 (닉네임 변경 직후 stale 방지)
                const [s, c] = await Promise.all([
                  getUserSalt(msg.clientUuid),
                  getUserCompanion(msg.clientUuid),
                ]);
                effectiveSalt = c ? `${c}:${s}` : s;
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

            if (Date.now() - lastHeartbeat > SSE_HEARTBEAT_MS) {
              send({ type: 'ping' });
              lastHeartbeat = Date.now();
            }
          }
          catch {
            pollMs = SSE_POLL_BASE_MS;
          }
          await sleepAbortable(pollMs, req.signal);
        }
      }
      finally {
        try {
          controller.close();
        }
        catch {
          // no-op
        }
      }
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
