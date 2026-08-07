/**
 * @file 民用时间统一解析
 * @description 统一处理当地钟表时间、固定 UTC 偏移与 IANA 历史时区，供真太阳时、星盘和天文时间共用。
 */

import { daysInGregorianMonth, isValidClockTime } from './date-validation';
import { resolveHistoricalTimezone, type HistoricalTimezoneEvidence } from './historical-timezone';

export const MIN_FIXED_TIMEZONE_HOURS = -12;
export const MAX_FIXED_TIMEZONE_HOURS = 14;
export const DEFAULT_CHINA_TIMEZONE_HOURS = 8;
export const DEFAULT_CHINA_TIME_ZONE_ID = 'Asia/Shanghai';

export interface CivilDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface CivilTimeZoneInput {
  /** 已确认的法定 UTC 偏移；有 IANA 时区时仅用于重复时刻消歧和一致性核验。 */
  timezone?: number;
  /** IANA 历史时区，例如 Asia/Shanghai、America/New_York。 */
  timeZoneId?: string;
}

export interface CivilTimeResolutionInput extends CivilDateTimeParts, CivilTimeZoneInput {}

export interface CivilTimeResolutionOptions {
  /** 没有提供任何时区时使用的固定偏移；省略表示必须显式提供时区。 */
  defaultTimezone?: number;
}

export interface CivilTimeResolution {
  localTime: CivilDateTimeParts;
  localDateTime: string;
  timezone: number;
  timeZoneId?: string;
  timezoneEvidence?: HistoricalTimezoneEvidence;
  timezoneSource: 'default-fixed-offset' | 'fixed-offset' | 'iana-time-zone';
  utcTimestamp: number;
  utcDateTime: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatCivilDateTime(value: CivilDateTimeParts): string {
  return `${String(value.year).padStart(4, '0')}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}`;
}

/** 将固定 UTC 偏移格式化为 ISO 8601 后缀，保留历史时区可能出现的秒级偏移。 */
export function formatFixedTimezoneOffset(timezone: number): string {
  assertFixedTimezoneHours(timezone);
  const totalSeconds = Math.round(Math.abs(timezone) * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const sign = timezone >= 0 ? '+' : '-';
  return `${sign}${pad(hours)}:${pad(minutes)}${seconds ? `:${pad(seconds)}` : ''}`;
}

export function assertFixedTimezoneHours(value: number, label = 'timezone'): void {
  if (
    !Number.isFinite(value) ||
    value < MIN_FIXED_TIMEZONE_HOURS ||
    value > MAX_FIXED_TIMEZONE_HOURS
  ) {
    throw new Error(
      `${label} 需在 UTC${MIN_FIXED_TIMEZONE_HOURS} 到 UTC+${MAX_FIXED_TIMEZONE_HOURS} 之间。`,
    );
  }
}

function validateCivilDateTime(input: CivilDateTimeParts): void {
  const maxDay = daysInGregorianMonth(input.year, input.month);
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > maxDay) {
    throw new Error(`${input.year}年${input.month}月不存在第${input.day}日。`);
  }
  if (!isValidClockTime(input.hour, input.minute, input.second)) {
    throw new Error('当地钟表时间需使用有效的 24 小时时分秒。');
  }
}

function normalizeTimeZoneId(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('timeZoneId 必须是 IANA 时区名称。');
  }
  const normalized = value.trim();
  if (!normalized) throw new Error('IANA 时区名不能为空。');
  return normalized;
}

/**
 * 将当地钟表时间解析为唯一 UTC 时刻。
 *
 * 统一口径：IANA 时区优先；同时提供 timezone 时只用于回拨消歧和一致性核验；
 * 不存在的当地时刻、未消解的重复时刻及固定偏移冲突都拒绝继续计算。
 */
export function resolveCivilTime(
  input: CivilTimeResolutionInput,
  options: CivilTimeResolutionOptions = {},
): CivilTimeResolution {
  const localTime: CivilDateTimeParts = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second,
  };
  validateCivilDateTime(localTime);
  if (input.timezone !== undefined) assertFixedTimezoneHours(input.timezone);
  if (options.defaultTimezone !== undefined) {
    assertFixedTimezoneHours(options.defaultTimezone, '默认 timezone');
  }

  const timeZoneId = normalizeTimeZoneId(input.timeZoneId);
  const timezoneEvidence = timeZoneId
    ? resolveHistoricalTimezone({
        ...localTime,
        timeZoneId,
        fixedOffsetHours: input.timezone,
      })
    : undefined;

  if (timezoneEvidence?.status === 'ambiguous' && input.timezone === undefined) {
    throw new Error(
      `${timeZoneId} 的当地钟表时间 ${formatCivilDateTime(localTime)} 存在夏令时回拨歧义，请同时提供与原始记录一致的 timezone 固定偏移。`,
    );
  }
  if (timezoneEvidence?.offsetConflict) {
    throw new Error(
      `timezone 固定偏移 UTC${input.timezone! >= 0 ? '+' : ''}${input.timezone} 与 ${timeZoneId} 在该当地时刻的历史偏移不一致。`,
    );
  }

  const timezone =
    timezoneEvidence?.resolvedOffsetHours ?? input.timezone ?? options.defaultTimezone;
  if (timezone === undefined) {
    throw new Error('timezone 与 timeZoneId 至少需要提供一项。');
  }
  const wallTimestamp = Date.UTC(
    localTime.year,
    localTime.month - 1,
    localTime.day,
    localTime.hour,
    localTime.minute,
    localTime.second,
  );
  const utcTimestamp = timezoneEvidence?.selectedUtcTimestamp ?? wallTimestamp - timezone * 3600000;

  return {
    localTime,
    localDateTime: formatCivilDateTime(localTime),
    timezone,
    ...(timeZoneId ? { timeZoneId } : {}),
    ...(timezoneEvidence ? { timezoneEvidence } : {}),
    timezoneSource: timeZoneId
      ? 'iana-time-zone'
      : input.timezone !== undefined
        ? 'fixed-offset'
        : 'default-fixed-offset',
    utcTimestamp,
    utcDateTime: new Date(utcTimestamp).toISOString(),
  };
}
