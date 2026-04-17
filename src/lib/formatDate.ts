export function formatAbsolute(raw: string): string {
  const date = parseKstDate(raw);
  const { year, month, day, hours, minutes } = getKstParts(date.getTime());

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

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const RAW_DATE_REGEX = /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/;

type KstDateParts = {
  year: number;
  month: number; // 1~12
  day: number; // 1~31
  hours: number;
  minutes: number;
  seconds: number;
};

type DurationParts = {
  years: number;
  months: number; // 0~11
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function parseKstDate(raw: string): Date {
  const matched = RAW_DATE_REGEX.exec(raw);
  if (matched) {
    const [, y, m, d, hh, mm, ss] = matched;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const hours = Number(hh);
    const minutes = Number(mm);
    const seconds = Number(ss);
    const utcMs = Date.UTC(year, month - 1, day, hours - 9, minutes, seconds);
    return new Date(utcMs);
  }
  return new Date(raw.replace(' ', 'T') + '+09:00');
}

function getKstParts(ms: number): KstDateParts {
  const shifted = new Date(ms + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function calcCalendarDiff(raw: string, now: number): DurationParts {
  const startMs = parseKstDate(raw).getTime();
  if (now <= startMs) {
    return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const start = getKstParts(startMs);
  const end = getKstParts(now);
  const cursor: KstDateParts = { ...end };

  if (cursor.seconds < start.seconds) {
    cursor.seconds += 60;
    cursor.minutes -= 1;
  }
  const seconds = cursor.seconds - start.seconds;

  if (cursor.minutes < start.minutes) {
    cursor.minutes += 60;
    cursor.hours -= 1;
  }
  const minutes = cursor.minutes - start.minutes;

  if (cursor.hours < start.hours) {
    cursor.hours += 24;
    cursor.day -= 1;
  }
  const hours = cursor.hours - start.hours;

  if (cursor.day < start.day) {
    cursor.month -= 1;
    if (cursor.month < 1) {
      cursor.month = 12;
      cursor.year -= 1;
    }
    cursor.day += daysInMonth(cursor.year, cursor.month);
  }
  const days = cursor.day - start.day;

  if (cursor.month < start.month) {
    cursor.month += 12;
    cursor.year -= 1;
  }
  const months = cursor.month - start.month;
  const years = cursor.year - start.year;

  return { years, months, days, hours, minutes, seconds };
}

function calcDiff(raw: string, now: number): DurationTotals {
  const date = parseKstDate(raw);
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
  const { years, months, days, hours, minutes, seconds } = calcCalendarDiff(raw, now);

  if (seconds < 1) return '방금';

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  if (months > 0) parts.push(`${months}개월`);
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (seconds > 0) parts.push(`${seconds}초`);

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
