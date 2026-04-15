export function formatAbsolute(raw: string): string {
  // Parse as KST
  const date = new Date(raw.replace(' ', 'T') + '+09:00');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const period = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minuteStr = String(minutes).padStart(2, '0');

  return `${year}년 ${month}월 ${day}일 ${period} ${hour12}:${minuteStr}`;
}

export type DurationTotals = {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function calcDiff(raw: string, now: number): DurationTotals {
  const date = new Date(raw.replace(' ', 'T') + '+09:00');
  const diffMs = Math.max(0, now - date.getTime());
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  return { years, months, days, hours, minutes, seconds };
}

export function formatRelative(raw: string, now: number = Date.now()): string {
  const { years, months, days, hours, minutes, seconds } = calcDiff(raw, now);

  if (seconds < 1) return '방금';

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  const remMonths = months - years * 12;
  if (remMonths > 0) parts.push(`${remMonths}개월`);
  const remDays = days - months * 30;
  if (remDays > 0) parts.push(`${remDays}일`);
  const remHours = hours - days * 24;
  if (remHours > 0) parts.push(`${remHours}시간`);
  const remMins = minutes - hours * 60;
  if (remMins > 0) parts.push(`${remMins}분`);
  const remSecs = seconds - minutes * 60;
  if (remSecs > 0) parts.push(`${remSecs}초`);

  return parts.length > 0 ? parts.join(' ') : '방금';
}

export function getDurationTotals(raw: string, now: number = Date.now()): DurationTotals {
  return calcDiff(raw, now);
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return '0초';
  const totalSecs = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  const remMonths = months - years * 12;
  if (remMonths > 0) parts.push(`${remMonths}개월`);
  const remDays = days - months * 30;
  if (remDays > 0) parts.push(`${remDays}일`);
  const remHours = hours - days * 24;
  if (remHours > 0) parts.push(`${remHours}시간`);
  const remMins = minutes - hours * 60;
  if (remMins > 0) parts.push(`${remMins}분`);
  const remSecs = totalSecs - minutes * 60;
  if (remSecs > 0 || parts.length === 0) parts.push(`${remSecs}초`);

  return parts.join(' ');
}
