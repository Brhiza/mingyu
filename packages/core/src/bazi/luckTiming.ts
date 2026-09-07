import type { LocalTimeRange, LuckCycle, SolarDateTimeInfo } from './baziTypes';

function getLastDayOfMonth(year: number, month: number) {
  assertSolarYear(year);
  assertSolarMonth(month);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysInMonth[month - 1];
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function assertSolarYear(year: number) {
  if (!Number.isInteger(year)) {
    throw new Error('年份需为整数。');
  }
}

function assertSolarMonth(month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }
}

function assertTimePart(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间。`);
  }
}

function assertValidDate(date: Date, label: string) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`${label}不是有效日期。`);
  }
}

function assertSolarDateTimeInfo(time: SolarDateTimeInfo) {
  assertSolarYear(time.year);
  assertSolarMonth(time.month);

  const maxDay = getLastDayOfMonth(time.year, time.month);
  if (!Number.isInteger(time.day) || time.day < 1 || time.day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间。`);
  }

  assertTimePart(time.hour, 0, 23, '小时');
  assertTimePart(time.minute, 0, 59, '分钟');
  assertTimePart(time.second, 0, 59, '秒');
}

export function toNativeDate(time: SolarDateTimeInfo | Date): Date {
  if (time instanceof Date) {
    assertValidDate(time, '时间');
    return new Date(time.getTime());
  }

  assertSolarDateTimeInfo(time);
  return new Date(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
}

export function fromNativeDate(time: Date): SolarDateTimeInfo {
  assertValidDate(time, '时间');
  return {
    year: time.getFullYear(),
    month: time.getMonth() + 1,
    day: time.getDate(),
    hour: time.getHours(),
    minute: time.getMinutes(),
    second: time.getSeconds(),
  };
}

export function createLocalTimeRange(start: Date, end: Date): LocalTimeRange {
  assertValidDate(start, '开始时间');
  assertValidDate(end, '结束时间');
  if (start.getTime() >= end.getTime()) {
    throw new Error('时间范围的结束时间必须晚于开始时间。');
  }
  return {
    start: fromNativeDate(start),
    end: fromNativeDate(end),
    startTimestamp: start.getTime(),
    endTimestamp: end.getTime(),
    endExclusive: true,
  };
}

export function getLuckCycleTimeRange(cycle: LuckCycle): LocalTimeRange {
  const start = cycle.startSolarTime
    ? toNativeDate(cycle.startSolarTime)
    : new Date(cycle.year, 0, 1, 0, 0, 0);
  const end = cycle.endSolarTime ? toNativeDate(cycle.endSolarTime) : getFallbackCycleEnd(cycle);
  return createLocalTimeRange(start, end);
}

export function intersectLocalTimeRanges(
  left: LocalTimeRange,
  right: LocalTimeRange,
): LocalTimeRange | null {
  const start = Math.max(left.startTimestamp, right.startTimestamp);
  const end = Math.min(left.endTimestamp, right.endTimestamp);
  return start < end ? createLocalTimeRange(new Date(start), new Date(end)) : null;
}

export function toSolarDateTimeInfo(time: {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
  getSecond(): number;
}): SolarDateTimeInfo {
  const result = {
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond(),
  };

  assertSolarDateTimeInfo(result);
  return result;
}

export function shiftSolarDateTimeYears(time: SolarDateTimeInfo, years: number): SolarDateTimeInfo {
  assertSolarDateTimeInfo(time);
  if (!Number.isInteger(years)) {
    throw new Error('位移年份需为整数。');
  }

  const nextYear = time.year + years;
  assertSolarYear(nextYear);
  const lastDayOfTargetMonth = getLastDayOfMonth(nextYear, time.month);

  return {
    ...time,
    year: nextYear,
    day: Math.min(time.day, lastDayOfTargetMonth),
  };
}

function getFallbackCycleEnd(cycle: LuckCycle): Date {
  assertSolarYear(cycle.year);
  if (cycle.isXiaoyun) {
    return new Date(cycle.year + Math.max(cycle.years.length, 1), 0, 1, 0, 0, 0);
  }

  return new Date(cycle.year + 10, 0, 1, 0, 0, 0);
}

export function isDateWithinLuckCycle(cycle: LuckCycle, referenceDate: Date = new Date()): boolean {
  assertValidDate(referenceDate, '参考时间');
  const range = getLuckCycleTimeRange(cycle);

  return (
    referenceDate.getTime() >= range.startTimestamp && referenceDate.getTime() < range.endTimestamp
  );
}

export function getLuckCycleForDate(
  cycles: LuckCycle[],
  referenceDate: Date = new Date(),
): LuckCycle | null {
  assertValidDate(referenceDate, '参考时间');
  if (!cycles.length) {
    return null;
  }

  const exactMatch = cycles.find((cycle) => isDateWithinLuckCycle(cycle, referenceDate));
  return exactMatch ?? null;
}

export function formatSolarDateTime(time: SolarDateTimeInfo, withYear = false): string {
  assertSolarDateTimeInfo(time);
  const datePart = withYear
    ? `${time.year}年${time.month}月${time.day}日`
    : `${time.month}月${time.day}日`;
  const timePart = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  return `${datePart} ${timePart}`;
}
