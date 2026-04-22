import type { ReactNode } from 'react';
import type { ChatMessage } from '@/types/chat';

export type ChatInputProps = {
  onSend: (text: string, replyToMessageId?: string) => void;
  selectedReplyMessage: ChatMessage | null;
  selectedReplyTarget: ReactNode | null;
  onClearReply: () => void;
  onInteraction: () => void;
  sendCooldownRemainingMs: number;
  sendCooldownRemainingSec: number;
  sendCooldownRatio: number;
  warnCount: number;
};
