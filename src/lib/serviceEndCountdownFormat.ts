/**
 * 0이면 단위 생략. 예: 2시간 3초, 2시간 12분, 3분 20초, 5초
 * 잔여 1초 미만이면 1초로 표기
 */
export function formatServiceEndCountdownOmitZero(
  now: number,
  endMs: number,
): { label: string; afterEnd: boolean } {
  if (now >= endMs) {
    return { label: '', afterEnd: true };
  }
  const left = endMs - now;
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  if (s > 0) parts.push(`${s}초`);
  if (parts.length === 0) {
    parts.push(`${Math.max(1, Math.ceil(left / 1000))}초`);
  }
  return { label: parts.join(' '), afterEnd: false };
}
