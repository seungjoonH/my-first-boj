/**
 * 과거 시각 `postedMs`로부터의 경과를 한국어 상대 표기로 반환합니다. (예: 2시간 전, 3일 전)
 */
export function formatRelativePastKo(postedMs: number, nowMs: number): string {
  const diff = nowMs - postedMs;
  if (diff < 0) return '방금 전';
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}개월 전`;
  const year = Math.floor(day / 365);
  return `${Math.max(1, year)}년 전`;
}
