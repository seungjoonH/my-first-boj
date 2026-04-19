import {
  chatRedis,
  getUserCompanion,
  msgKey,
  parseMsg,
  setUserCompanion,
} from '@/lib/chatRedis';
import { CHAT_MESSAGES_REDIS_MAX } from '@/lib/chatConstants';
import { isReservedChatUuid } from '@/lib/chatAdmin';
import type { ChatMessage } from '@/types/chat';

export const CHAT_UUID_COOKIE = 'chat-uuid';
export const CHAT_UUID_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 10;

export type ResolvedChatViewerContext = {
  uuid: string;
  isNewUuid: boolean;
  companion: string;
  isHealRequest: boolean;
};

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

async function verifyProof(uuid: string, proof: string): Promise<boolean> {
  const expected = await computeProof(uuid);
  if (!expected) return true;
  if (!proof || expected.length !== proof.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ proof.charCodeAt(i);
  }
  return mismatch === 0;
}

function getUuid(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  return cookie.match(/(?:^|;\s*)chat-uuid=([^;]+)/)?.[1]?.trim() ?? null;
}

function getCompanion(req: Request): string | null {
  const v = req.headers.get('X-Chat-Companion')?.trim() ?? '';
  return v.length > 0 && v.length <= 64 ? v : null;
}

function getRestore(req: Request): string | null {
  const v = req.headers.get('X-Chat-Restore')?.trim() ?? '';
  return v.length > 0 && v.length <= 64 ? v : null;
}

function getRestoreProof(req: Request): string {
  const v = req.headers.get('X-Chat-Restore-Proof')?.trim() ?? '';
  return v.length === 64 ? v : '';
}

function getHeal(req: Request): boolean {
  return req.headers.get('X-Chat-Heal') === '1';
}

/** init 응답의 messages / messageCount와 동일한 가시성 규칙 */
export function isVisibleChatMessage(message: ChatMessage, viewerUuid: string): boolean {
  if (message.isDm !== true) return true;
  if (!message.dmToUuid) return false;
  if (message.dmToUuid === viewerUuid) return true;
  if (message.clientUuid === viewerUuid) return true;
  return false;
}

/** 쿠키·restore·companion을 init과 동일하게 해석해 viewer UUID를 정한다. */
export async function resolveChatViewerContext(req: Request): Promise<ResolvedChatViewerContext> {
  const cookieUuid = getUuid(req);
  const existingUuid = cookieUuid && !isReservedChatUuid(cookieUuid) ? cookieUuid : null;

  let restoreUuid: string | null = null;
  if (!existingUuid) {
    const restoreCandidate = getRestore(req);
    if (restoreCandidate && !isReservedChatUuid(restoreCandidate)) {
      const restoreProof = getRestoreProof(req);
      const proofOk = await verifyProof(restoreCandidate, restoreProof);
      if (proofOk) restoreUuid = restoreCandidate;
    }
  }

  const uuid = existingUuid ?? restoreUuid ?? crypto.randomUUID();
  const isNewUuid = !existingUuid;

  const incomingCompanion = getCompanion(req);

  let companion: string;
  if (chatRedis) {
    const existing = await getUserCompanion(uuid);
    if (existing) {
      companion = existing;
    }
    else if (incomingCompanion) {
      await setUserCompanion(uuid, incomingCompanion);
      companion = incomingCompanion;
    }
    else {
      companion = '';
    }
  }
  else {
    companion = incomingCompanion ?? '';
  }

  return {
    uuid,
    isNewUuid,
    companion,
    isHealRequest: getHeal(req),
  };
}

/** init의 messageCount와 동일: viewer 기준으로 보이는 메시지 개수 */
export async function countVisibleChatMessages(viewerUuid: string): Promise<number> {
  const rawMsgs = (await chatRedis?.lrange(msgKey(), 0, CHAT_MESSAGES_REDIS_MAX - 1)) ?? [];
  const messages = (rawMsgs as unknown[])
    .map(parseMsg)
    .filter((m): m is ChatMessage => m !== null)
    .filter((m) => isVisibleChatMessage(m, viewerUuid));
  return messages.length;
}

export function buildChatUuidSetCookieHeader(uuid: string): string {
  return `${CHAT_UUID_COOKIE}=${uuid}; HttpOnly; SameSite=Lax; Max-Age=${CHAT_UUID_COOKIE_MAX_AGE_SEC}; Path=/`;
}
