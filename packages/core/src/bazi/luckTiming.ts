import type { LuckCycle, SolarDateTimeInfo } from './baziTypes';

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

export function isDateWithinLuckCycle(cycle: LuckCycle, referenceDate: Date): boolean {
  assertValidDate(referenceDate, '参考时间');
  if (!cycle.startSolarTime || !cycle.endSolarTime) {
    throw new Error('大运周期缺少精确起止时刻，禁止按年份静默补齐。');
  }
  const cycleStart = toNativeDate(cycle.startSolarTime);
  const cycleEnd = toNativeDate(cycle.endSolarTime);
  if (cycleEnd <= cycleStart) {
    throw new Error('大运周期结束时刻必须晚于开始时刻。');
  }

  return referenceDate >= cycleStart && referenceDate < cycleEnd;
}

export function getLuckCycleForDate(cycles: LuckCycle[], referenceDate: Date): LuckCycle | null {
  assertValidDate(referenceDate, '参考时间');
  if (!cycles.length) {
    return null;
  }

  const exactMatches = cycles.filter((cycle) => isDateWithinLuckCycle(cycle, referenceDate));
  if (exactMatches.length > 1) {
    throw new Error('大运周期精确起止时刻互相重叠，无法唯一定位。');
  }
  return exactMatches[0] ?? null;
}

export function formatSolarDateTime(time: SolarDateTimeInfo, withYear = false): string {
  assertSolarDateTimeInfo(time);
  const datePart = withYear
    ? `${time.year}年${time.month}月${time.day}日`
    : `${time.month}月${time.day}日`;
  const timePart = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  return `${datePart} ${timePart}`;
}
