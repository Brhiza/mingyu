import { LunarHour } from 'tyme4ts';

const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isValidIsoDateTime(value: string, date: Date) {
  if (typeof value !== 'string' || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }
  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const offsetMatch = /(Z|[+-]\d{2}:\d{2})$/.exec(value);
  const target = offsetMatch ? getDatePartsInOffset(date, offsetMatch[1]) : getLocalDateParts(date);

  return (
    target.year === Number(match[1]) &&
    target.month === Number(match[2]) &&
    target.day === Number(match[3])
  );
}

function getLocalDateParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function getDatePartsInOffset(date: Date, offsetText: string) {
  const offsetMinutes = parseOffsetMinutes(offsetText);
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseOffsetMinutes(offsetText: string) {
  if (offsetText === 'Z') {
    return 0;
  }

  const sign = offsetText.startsWith('-') ? -1 : 1;
  const [hour, minute] = offsetText.slice(1).split(':').map(Number);
  return sign * (hour * 60 + minute);
}

export function daysInSolarMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error('年份需在 1900-2100 之间。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }

  return daysInGregorianMonth(year, month);
}

/** 公历月份天数基础能力；供需要更宽年份范围的历法算法复用。 */
export function daysInGregorianMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new Error('公历年份需在 1-9999 之间。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 校验 24 小时制时分秒，适合表单、排盘和 API 共用。 */
export function isValidClockTime(hour: number, minute: number, second: number = 0): boolean {
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    Number.isInteger(second) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59
  );
}

export function getBirthDateValidationMessage(params: {
  year: number;
  month: number;
  day: number;
  dateType: 'solar' | 'lunar';
  isLeapMonth?: boolean;
}) {
  if (params.dateType !== 'solar' && params.dateType !== 'lunar') {
    return '日期类型必须是 solar 或 lunar。';
  }
  if (params.isLeapMonth !== undefined && typeof params.isLeapMonth !== 'boolean') {
    return '闰月标志必须是布尔值。';
  }
  if (!Number.isInteger(params.year) || params.year < 1900 || params.year > 2100) {
    return '年份需在 1900-2100 之间。';
  }
  if (!Number.isInteger(params.month) || params.month < 1 || params.month > 12) {
    return '月份需在 1-12 之间。';
  }

  if (params.dateType === 'lunar') {
    if (!Number.isInteger(params.day) || params.day < 1 || params.day > 30) {
      return '农历日期需在 1-30 之间。';
    }
    try {
      LunarHour.fromYmdHms(
        params.year,
        params.isLeapMonth ? -Math.abs(params.month) : params.month,
        params.day,
        0,
        0,
        0,
      );
    } catch {
      return '农历日期不存在，请检查月份、日期和闰月设置。';
    }
    return undefined;
  }

  const maxDay = daysInSolarMonth(params.year, params.month);
  if (!Number.isInteger(params.day) || params.day < 1 || params.day > maxDay) {
    return `日期需在 1-${maxDay} 之间。`;
  }

  return undefined;
}
