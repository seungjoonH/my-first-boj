export type NicknameBarProps = {
  myUuid: string;
  salt: string;
  adminUuid: string;
  nickCooldownRemaining: number;
  nickCooldownTtlSec: number;
  isLoaded: boolean;
  onChangeNickname: () => void;
  onInteraction: () => void;
};
