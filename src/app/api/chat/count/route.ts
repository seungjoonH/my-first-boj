import {
  resolveChatViewerContext,
  countVisibleChatMessages,
  buildChatUuidSetCookieHeader,
} from '@/lib/chatIdentityRequest';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/** 플로팅 버튼용: viewer 기준 보이는 메시지 개수만 반환 (init과 동일한 messageCount 의미) */
export async function GET(req: Request): Promise<Response> {
  const { uuid, isNewUuid, isHealRequest } = await resolveChatViewerContext(req);
  const messageCount = await countVisibleChatMessages(uuid);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isNewUuid || isHealRequest) {
    headers['Set-Cookie'] = buildChatUuidSetCookieHeader(uuid);
  }

  return new Response(JSON.stringify({ messageCount }), { headers });
}
