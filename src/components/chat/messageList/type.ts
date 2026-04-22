import type { ChatMessage } from '@/types/chat';

export type MessageListProps = {
  messages: ChatMessage[];
  saltMap: Record<string, string>;
  myUuid: string;
  adminUuid: string;
  selectedReplyMessageId: string | null;
  highlightedKeywordBubbleId: string | null;
  jumpTargetBubbleId: string | null;
  jumpRequestKey: number;
  onReplyToMessage: (messageId: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onInteraction: () => void;
  onKeywordHover: (keywordBubbleId: string | null) => void;
};
