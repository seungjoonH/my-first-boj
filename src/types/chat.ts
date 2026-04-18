export type ChatMessage = {
  id: string;
  clientUuid: string;
  message: string;
  timestamp: number;
  banned?: boolean;
  isAdmin?: boolean;
  isDm?: boolean;
  dmToUuid?: string;
};

export type ChatInitResponse = {
  messages: ChatMessage[];
  messageCount: number;
  saltMap: Record<string, string>;
  keywords: string[];
  mentionCount: number;
  myUuid: string;
  adminUuid: string;
  nickCooldownRemaining: number;
  /** 닉네임 변경 직후 적용되는 재설정 대기 TTL(초). Redis `chat:config:nick_rl_ttl_sec` 등 */
  nickCooldownTtlSec: number;
  companion: string;
  warnCount: number;
  proof: string;
};

export type ChatSseEvent =
  | ({ type: 'message' } & ChatMessage & { salt: string })
  | { type: 'keyword'; value: string }
  | { type: 'ping' };
