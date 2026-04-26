/** GET `/api/chat/nickname-table` 및 Redis 스냅샷 공통 스키마 */
export type NicknameTableSnapshot = {
  version: number;
  generatedAt: number;
  /** `occupancy[flatIndex][bIndex]` — 관리자 제외 스캔 기준 현재 인원 */
  occupancy: number[][];
  /** 해금 = 과거 SET ∪ 현재 점유 */
  unlocked: boolean[][];
  totalUnlockedCount: number;
};

export type NicknameTableApiResponse = NicknameTableSnapshot & {
  myCell: { flatIndex: number; bIndex: number } | null;
};
