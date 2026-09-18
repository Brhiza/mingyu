import { getCivilDateTimeAtFixedOffset } from '../calendar/civil-time';
import { normalizeBirthProfile, type BirthProfile } from './index';

const CHINA_TIME_ZONE = 'Asia/Shanghai' as const;
const CHINA_OFFSET_HOURS = 8 as const;
const MILLISECONDS_PER_SECOND = 1_000;
const MAX_RANGE_SECONDS = 2 * 60 * 60;
const MAX_RANGE_MILLISECONDS = MAX_RANGE_SECONDS * MILLISECONDS_PER_SECOND;
const MAX_BATCH_SIZE = 60;

/** 固定北京时间的出生时间半开区间，起点含、终点不含。 */
export interface BirthProfileTimeRange {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: typeof CHINA_TIME_ZONE;
  offsetHours: typeof CHINA_OFFSET_HOURS;
}

/** 有界逐秒读取的游标参数。 */
export interface BirthRangeBatchOptions {
  startIndex?: number;
  limit?: number;
}

/** 一页逐秒读取的边界；nextIndex 为 null 表示已经到达终点。 */
export interface BirthRangeBatch {
  startIndex: number;
  endIndexExclusive: number;
  limit: number;
  nextIndex: number | null;
  totalSamples: number;
}

function isValidTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value % MILLISECONDS_PER_SECOND === 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function assertTimestamp(value: unknown, label: string): asserts value is number {
  if (!isValidTimestamp(value)) {
    throw new RangeError(`出生时间范围${label}必须是整秒 UTC epoch 毫秒时间戳。`);
  }
}

function assertRangePolicy(range: BirthProfileTimeRange): number {
  if (!range || typeof range !== 'object' || Array.isArray(range)) {
    throw new TypeError('出生时间范围必须提供固定北京时间的起止时间戳。');
  }
  assertTimestamp(range.startTimestamp, '起点');
  assertTimestamp(range.endTimestamp, '终点');
  if (range.endExclusive !== true) {
    throw new RangeError('出生时间范围必须是起点含、终点不含的半开区间。');
  }
  if (range.timezone !== CHINA_TIME_ZONE || range.offsetHours !== CHINA_OFFSET_HOURS) {
    throw new RangeError('出生时间范围必须固定使用 Asia/Shanghai（UTC+8）北京时间。');
  }
  if (range.startTimestamp >= range.endTimestamp) {
    throw new RangeError('出生时间范围必须是正时长的半开区间。');
  }

  const duration = range.endTimestamp - range.startTimestamp;
  if (duration > MAX_RANGE_MILLISECONDS) {
    throw new RangeError('出生时间范围不得超过两小时。');
  }
  if (duration % MILLISECONDS_PER_SECOND !== 0) {
    throw new RangeError('出生时间范围长度必须是整秒。');
  }
  return duration / MILLISECONDS_PER_SECOND;
}

function assertStandardBirthProfile(profile: BirthProfile): void {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new TypeError('出生档案时间范围输入必须是对象。');
  }
  if (profile.calendarType !== 'solar') {
    throw new RangeError('出生时间范围起点必须使用公历输入。');
  }
  if (profile.useTrueSolarTime === true) {
    throw new RangeError('出生时间范围固定使用标准北京时间，不接受真太阳时。');
  }
  if (profile.applyChinaDst === true) {
    throw new RangeError('出生时间范围固定使用标准北京时间，不接受中国夏令时。');
  }
  if (
    profile.location?.timezone !== undefined &&
    profile.location.timezone !== CHINA_OFFSET_HOURS
  ) {
    throw new RangeError('出生时间范围的出生地点 timezone 必须为 8。');
  }
  if (profile.location?.timeZoneId !== undefined) {
    throw new RangeError('出生时间范围固定使用 UTC+8，不接受 IANA timeZoneId。');
  }
}

function assertProfileMatchesStart(profile: BirthProfile, startTimestamp: number): void {
  const start = getCivilDateTimeAtFixedOffset(new Date(startTimestamp), CHINA_OFFSET_HOURS);
  const normalized = normalizeBirthProfile(profile);
  const clock = normalized.solarClockTime;
  if (
    clock.year !== start.year ||
    clock.month !== start.month ||
    clock.day !== start.day ||
    clock.hour !== start.hour ||
    clock.minute !== start.minute ||
    clock.second !== start.second
  ) {
    throw new RangeError('出生档案时间字段必须等于范围起点北京时间墙钟字段。');
  }
}

/**
 * 校验出生档案与逐秒出生区间，并返回可安全传递给下游的固定政策 source。
 *
 * 仅允许公历标准北京时间；日期合法性和已有 BirthProfile 输入契约统一由
 * normalizeBirthProfile 复核，避免在这里复制农历或历法规则。
 */
export function validateBirthProfileTimeRange(
  profile: BirthProfile,
  range: BirthProfileTimeRange,
): BirthProfileTimeRange {
  assertStandardBirthProfile(profile);
  const totalSamples = assertRangePolicy(range);

  // normalizeBirthProfile 只接受不带范围元数据的单点档案，避免新字段形成
  // 递归校验；范围本身仍由本函数按固定政策完整核对。
  const { birthTimeRange: _birthTimeRange, ...pointProfile } = profile;
  assertProfileMatchesStart(pointProfile, range.startTimestamp);

  if (!Number.isSafeInteger(totalSamples) || totalSamples < 1) {
    throw new RangeError('出生时间范围必须至少包含一个整秒样本。');
  }
  return {
    startTimestamp: range.startTimestamp,
    endTimestamp: range.endTimestamp,
    endExclusive: true,
    timezone: CHINA_TIME_ZONE,
    offsetHours: CHINA_OFFSET_HOURS,
  };
}

function assertSampleTimestamp(range: BirthProfileTimeRange, timestamp: number): void {
  assertRangePolicy(range);
  assertTimestamp(timestamp, '样本');
  if (timestamp < range.startTimestamp || timestamp >= range.endTimestamp) {
    throw new RangeError('出生时间范围样本必须位于起点含、终点不含的区间内。');
  }
  if ((timestamp - range.startTimestamp) % MILLISECONDS_PER_SECOND !== 0) {
    throw new RangeError('出生时间范围样本必须按起点逐秒递增。');
  }
}

/** 从已校验的出生区间取一个完整的标准北京时间 BirthProfile。 */
export function birthProfileAtRangeTimestamp(
  profile: BirthProfile,
  range: BirthProfileTimeRange,
  timestamp: number,
): BirthProfile {
  assertStandardBirthProfile(profile);
  assertSampleTimestamp(range, timestamp);
  const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), CHINA_OFFSET_HOURS);
  const {
    birthTimeRange: _birthTimeRange,
    timeIndex: _timeIndex,
    year: _year,
    month: _month,
    day: _day,
    hour: _hour,
    minute: _minute,
    second: _second,
    ...lockedProfile
  } = profile;
  return {
    ...lockedProfile,
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
    second: local.second,
  };
}

/**
 * 为单人范围或多主体笛卡尔积统一计算有界批次游标。
 * limit 默认 1，超过 60 时收敛到 60；最后一页的 nextIndex 为 null。
 */
export function resolveBirthRangeBatch(
  totalSamples: number,
  options: BirthRangeBatchOptions = {},
): BirthRangeBatch {
  if (!Number.isSafeInteger(totalSamples) || totalSamples < 0) {
    throw new RangeError('出生范围 totalSamples 必须是非负安全整数。');
  }
  const startIndex = options.startIndex ?? 0;
  if (!Number.isSafeInteger(startIndex) || startIndex < 0 || startIndex > totalSamples) {
    throw new RangeError('出生范围 startIndex 必须位于 0 到 totalSamples 之间。');
  }

  const requestedLimit = options.limit ?? 1;
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    throw new RangeError('出生范围 limit 必须是正整数。');
  }
  const limit = Math.min(requestedLimit, MAX_BATCH_SIZE, totalSamples - startIndex);
  const endIndexExclusive = startIndex + limit;
  return {
    startIndex,
    endIndexExclusive,
    limit,
    nextIndex: endIndexExclusive < totalSamples ? endIndexExclusive : null,
    totalSamples,
  };
}
