import type { BBadgeVariant } from '@/lib/chatConstants';
import type { ChatTier } from '@/lib/chatNickname';

export type ChatNicknameTierHelpDialogProps = {
  open: boolean;
  onClose: () => void;
  aBadge: string;
  bBadge: string;
  bVariant: BBadgeVariant;
  finalTier: ChatTier;
  nickCooldownRemaining: number;
  onChangeNickname: () => void;
};
