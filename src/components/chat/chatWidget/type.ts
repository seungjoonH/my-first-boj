import type { ChatMessage } from '@/types/chat';

export type ChatWidgetProps = {
  messages: ChatMessage[];
  saltMap: Record<string, string>;
  myUuid: string;
  adminUuid: string;
  nickCooldownRemaining: number;
  nickCooldownTtlSec: number;
  keywordMentionCount: number;
  highlightedKeywordBubbleId: string | null;
  jumpTargetBubbleId: string | null;
  jumpRequestKey: number;
  sendCooldownRemainingMs: number;
  sendCooldownRemainingSec: number;
  sendCooldownRatio: number;
  warnCount: number;
  onlineCount: number | null;
  isLoaded: boolean;
  isClosing: boolean;
  onSend: (text: string) => void;
  onChangeNickname: () => void;
  onClose: () => void;
  onInteraction: () => void;
  onKeywordHover: (keyword: string | null) => void;
};
