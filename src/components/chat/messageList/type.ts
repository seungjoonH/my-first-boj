import type { ChatMessage } from '@/types/chat';

export type MessageListProps = {
  messages: ChatMessage[];
  saltMap: Record<string, string>;
  myUuid: string;
  adminUuid: string;
  highlightedKeywordBubbleId: string | null;
  jumpTargetBubbleId: string | null;
  jumpRequestKey: number;
  onInteraction: () => void;
  onKeywordHover: (keywordBubbleId: string | null) => void;
};
