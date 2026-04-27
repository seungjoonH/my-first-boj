/**
 * 공지 목록 정렬 키. 큰 값이 더 최신.
 * vA.B.C → A*1e6 + B*1e3 + C
 */
export function noticeVer(major: number, minor: number, patch: number): number {
  return major * 1_000_000 + minor * 1_000 + patch;
}
