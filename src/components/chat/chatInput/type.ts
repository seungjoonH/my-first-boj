export type ChatInputProps = {
  onSend: (text: string) => void;
  onInteraction: () => void;
  sendCooldownRemainingMs: number;
  sendCooldownRemainingSec: number;
  sendCooldownRatio: number;
  warnCount: number;
};
