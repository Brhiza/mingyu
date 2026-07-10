import { daysInSolarMonth } from './date-validation';
import { getShichenFromClock } from './dateUtils';
import { checkChinaDst, type ChinaDstCheckResult } from './china-dst';

export interface SolarDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TrueSolarTimeResult {
  correctedTime: SolarDateTimeParts;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalCorrectionMinutes: number;
}

export interface TrueSolarTimeConversionInput {
  /** 不带时区偏移的当地钟表时间，如 1990-05-15T10:30:00。 */
  localDateTime: string;
  /** 出生地或观测地经度，东经为正、西经为负。 */
  longitude: number;
  /** 当地标准时区，默认 UTC+8；支持小数时区。 */
  timezone?: number;
  /** 是否按中国 1986-1991 历史规则自动还原夏令时，默认 false。 */
  applyChinaDst?: boolean;
}

export interface TrueSolarTimeConversionResult extends TrueSolarTimeResult {
  clockTime: SolarDateTimeParts;
  clockDateTime: string;
  standardTime: SolarDateTimeParts;
  standardDateTime: string;
  correctedDateTime: string;
  longitude: number;
  timezone: number;
  standardMeridian: number;
  crossesDate: boolean;
  chinaDst: ChinaDstCheckResult & {
    requested: boolean;
    applied: boolean;
  };
  shichen: {
    index: number;
    branch: string;
    name: string;
  };
}

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

function getDayOfYear(year: number, month: number, day: number): number {
  const current = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(Date.UTC(year, 0, 1));
  return Math.floor((current.getTime() - start.getTime()) / 86400000) + 1;
}

function assertIntegerInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间。`);
  }
}

function assertNumberInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min} 到 ${max} 之间。`);
  }
}

function validateSolarDate(year: number, month: number, day: number): void {
  assertIntegerInRange(year, '年份', 1900, 2100);
  assertIntegerInRange(month, '月份', 1, 12);
  if (!Number.isInteger(day) || day < 1) {
    throw new Error('日期不能小于 1。');
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间。`);
  }
}

function validateTimePart(hour: number, minute: number, second: number): void {
  assertIntegerInRange(hour, '小时', 0, 23);
  assertIntegerInRange(minute, '分钟', 0, 59);
  assertIntegerInRange(second, '秒', 0, 59);
}

function toDateTimeParts(date: Date): SolarDateTimeParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function shiftDateTime(value: SolarDateTimeParts, offsetMinutes: number): SolarDateTimeParts {
  const date = new Date(
    Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second),
  );
  date.setUTCMinutes(date.getUTCMinutes() + offsetMinutes);
  return toDateTimeParts(date);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatSolarDateTimeParts(value: SolarDateTimeParts): string {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}`;
}

export function parseLocalDateTime(value: string): SolarDateTimeParts {
  if (typeof value !== 'string') {
    throw new Error('localDateTime 必须是字符串。');
  }
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(
      'localDateTime 需使用 YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss 格式，且不要附带时区偏移。',
    );
  }

  const result: SolarDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  validateSolarDate(result.year, result.month, result.day);
  validateTimePart(result.hour, result.minute, result.second);
  return result;
}

export function calculateEquationOfTimeMinutes(year: number, month: number, day: number): number {
  validateSolarDate(year, month, day);
  const dayOfYear = getDayOfYear(year, month, day);
  const angle = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * angle) - 7.53 * Math.cos(angle) - 1.5 * Math.sin(angle);
}

export function calculateTrueSolarTime(
  standardTime: Pick<SolarDateTimeParts, 'year' | 'month' | 'day' | 'hour' | 'minute'> &
    Partial<Pick<SolarDateTimeParts, 'second'>>,
  longitude: number,
  standardMeridian = 120,
): TrueSolarTimeResult {
  const second = standardTime.second ?? 0;
  validateSolarDate(standardTime.year, standardTime.month, standardTime.day);
  validateTimePart(standardTime.hour, standardTime.minute, second);
  assertNumberInRange(longitude, '经度', -180, 180);
  assertNumberInRange(standardMeridian, '标准经线', -180, 210);

  const equationOfTimeMinutes = calculateEquationOfTimeMinutes(
    standardTime.year,
    standardTime.month,
    standardTime.day,
  );
  const longitudeCorrectionMinutes = (longitude - standardMeridian) * 4;
  const totalCorrectionMinutes = equationOfTimeMinutes + longitudeCorrectionMinutes;

  const correctedDate = new Date(
    Date.UTC(
      standardTime.year,
      standardTime.month - 1,
      standardTime.day,
      standardTime.hour,
      standardTime.minute,
      second,
    ),
  );
  correctedDate.setTime(correctedDate.getTime() + totalCorrectionMinutes * 60000);

  return {
    correctedTime: toDateTimeParts(correctedDate),
    longitudeCorrectionMinutes,
    equationOfTimeMinutes,
    totalCorrectionMinutes,
  };
}

/**
 * 面向 API/MCP 的便捷真太阳时换算入口。
 * localDateTime 表示当地钟表时间，不应包含 Z 或 +08:00 等时区后缀；夏令时需先还原为标准时间。
 */
export function convertTrueSolarTime(
  input: TrueSolarTimeConversionInput,
): TrueSolarTimeConversionResult {
  const clockTime = parseLocalDateTime(input.localDateTime);
  const timezone = input.timezone ?? 8;
  assertNumberInRange(timezone, 'timezone', -12, 14);
  if (input.applyChinaDst !== undefined && typeof input.applyChinaDst !== 'boolean') {
    throw new Error('applyChinaDst 必须是布尔值。');
  }
  const requestedChinaDst = input.applyChinaDst ?? false;
  const chinaDstCheck = requestedChinaDst
    ? checkChinaDst(
        clockTime.year,
        clockTime.month,
        clockTime.day,
        clockTime.hour,
        clockTime.minute,
      )
    : { inDst: false, offsetMinutes: 0, ambiguous: false, nonexistent: false };
  const chinaDstApplied = requestedChinaDst && chinaDstCheck.inDst;
  const standardTime = chinaDstApplied
    ? shiftDateTime(clockTime, chinaDstCheck.offsetMinutes)
    : clockTime;
  const standardMeridian = timezone * 15;
  const result = calculateTrueSolarTime(standardTime, input.longitude, standardMeridian);
  const shichen = getShichenFromClock(result.correctedTime.hour, result.correctedTime.minute);
  if (!shichen) {
    throw new Error('无法根据校正后的真太阳时确定时辰。');
  }

  return {
    ...result,
    clockTime,
    clockDateTime: formatSolarDateTimeParts(clockTime),
    standardTime,
    standardDateTime: formatSolarDateTimeParts(standardTime),
    correctedDateTime: formatSolarDateTimeParts(result.correctedTime),
    longitude: input.longitude,
    timezone,
    standardMeridian,
    chinaDst: {
      ...chinaDstCheck,
      requested: requestedChinaDst,
      applied: chinaDstApplied,
    },
    crossesDate:
      clockTime.year !== result.correctedTime.year ||
      clockTime.month !== result.correctedTime.month ||
      clockTime.day !== result.correctedTime.day,
    shichen: {
      index: shichen.index,
      branch: shichen.branch,
      name: shichen.name,
    },
  };
}
