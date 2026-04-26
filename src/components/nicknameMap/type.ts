export type NicknameMapCellProps = {
  flatIndex: number;
  bIndex: number;
  count: number;
  unlocked: boolean;
  isMine: boolean;
  /** `td`에 추가 (섹션 접기 높이 애니메이션 등) */
  className?: string;
};

export type NicknameMapScrollToCellOptions = {
  /** 미니맵 점프 등 — 채팅 말풍선과 유사한 좌우 흔들림 */
  shake?: boolean;
};

export type NicknameMapGridHandle = {
  scrollToCell: (
    flatIndex: number,
    bIndex: number,
    options?: NicknameMapScrollToCellOptions,
  ) => void;
};
