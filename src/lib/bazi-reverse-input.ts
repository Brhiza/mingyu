import type { BaziReverseCandidate, BaziReversePillars } from 'mingyu-core/calendar';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';

export type BaziReverseSource = {
  pillars: BaziReversePillars;
  intervalStart: string;
  intervalEnd: string;
  /** 新生成来源的机器可消费区间；旧历史来源可能没有这些字段。 */
  startTimestamp?: number;
  endTimestamp?: number;
  endExclusive?: true;
  timezone?: 'Asia/Shanghai';
  offsetHours?: 8;
};

const BAZI_REVERSE_TIMEZONE = 'Asia/Shanghai' as const;
const BAZI_REVERSE_OFFSET_HOURS = 8 as const;

/**
 * 通用日期输入使用的四柱候选资料。
 *
 * 反推核心会保留秒级边界，回填使用候选区间起点作为“区间代表时刻”，
 * 并同时保留标准北京时间的时、分、秒。这个代表时刻用于复核四柱，不
 * 把它表述成用户真实记录的出生秒数。
 */
export type BaziReverseResolvedInput = {
  year: string;
  month: string;
  day: string;
  timeIndex: number;
  representativeHour: number;
  representativeMinute: number;
  representativeSecond: number;
  source: BaziReverseSource;
};

function fromBeijingTimestamp(timestamp: number) {
  const date = new Date(timestamp + BAZI_REVERSE_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function parseBeijingDateTimeText(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    year < 100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  const timestamp =
    Date.UTC(year, month - 1, day, hour, minute, second) -
    BAZI_REVERSE_OFFSET_HOURS * 60 * 60 * 1000;
  const parts = fromBeijingTimestamp(timestamp);
  return parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute &&
    new Date(timestamp).getUTCSeconds() === second
    ? timestamp
    : null;
}

function hasNonEmptyPillars(source: BaziReverseSource) {
  return Object.values(source.pillars).every((value) => value.length > 0);
}

/**
 * 规范化来源对象。
 *
 * 没有机器区间字段的对象是旧历史格式，继续按原有文本格式接受；一旦对象
 * 携带任一新字段，就要求完整的固定东八区政策和文本/时间戳一致，避免半新
 * 来源被当作可靠范围继续消费。
 */
export function normalizeBaziReverseSource(value: unknown): BaziReverseSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as {
    pillars?: Partial<BaziReversePillars>;
    intervalStart?: unknown;
    intervalEnd?: unknown;
    startTimestamp?: unknown;
    endTimestamp?: unknown;
    endExclusive?: unknown;
    timezone?: unknown;
    offsetHours?: unknown;
  };
  const pillars = source.pillars;
  if (
    !pillars ||
    typeof pillars.year !== 'string' ||
    typeof pillars.month !== 'string' ||
    typeof pillars.day !== 'string' ||
    typeof pillars.hour !== 'string' ||
    typeof source.intervalStart !== 'string' ||
    typeof source.intervalEnd !== 'string'
  ) {
    return null;
  }

  const normalized: BaziReverseSource = {
    pillars: {
      year: pillars.year,
      month: pillars.month,
      day: pillars.day,
      hour: pillars.hour,
    },
    intervalStart: source.intervalStart,
    intervalEnd: source.intervalEnd,
  };
  const machineKeys = [
    'startTimestamp',
    'endTimestamp',
    'endExclusive',
    'timezone',
    'offsetHours',
  ] as const;
  const hasMachineFields = machineKeys.some((key) => source[key] !== undefined);
  if (!hasMachineFields) return normalized;
  const startTimestamp = source.startTimestamp;
  const endTimestamp = source.endTimestamp;
  if (
    typeof startTimestamp !== 'number' ||
    typeof endTimestamp !== 'number' ||
    !Number.isSafeInteger(startTimestamp) ||
    !Number.isSafeInteger(endTimestamp) ||
    startTimestamp >= endTimestamp ||
    source.endExclusive !== true ||
    source.timezone !== BAZI_REVERSE_TIMEZONE ||
    source.offsetHours !== BAZI_REVERSE_OFFSET_HOURS
  ) {
    return null;
  }
  const textStart = parseBeijingDateTimeText(source.intervalStart);
  const textEnd = parseBeijingDateTimeText(source.intervalEnd);
  if (textStart !== startTimestamp || textEnd !== endTimestamp) {
    return null;
  }
  return {
    ...normalized,
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    timezone: BAZI_REVERSE_TIMEZONE,
    offsetHours: BAZI_REVERSE_OFFSET_HOURS,
  };
}

export function isValidBaziReverseSource(value: unknown): value is BaziReverseSource {
  const source = normalizeBaziReverseSource(value);
  return Boolean(
    source &&
    hasNonEmptyPillars(source) &&
    source.intervalStart.length > 0 &&
    source.intervalEnd.length > 0,
  );
}

/**
 * 将候选区间的起点回填为精确标准北京时间，并保留秒级边界。
 *
 * 候选四柱是否由核心正向算法成立，仍由 bazi-reverse 的候选契约和核心回归
 * 负责；本层只核验候选时间文本、时间戳、半开区间和回填时刻的一致性。
 */
export function resolveBaziReverseCandidate(
  candidate: BaziReverseCandidate,
): BaziReverseResolvedInput | null {
  const start = candidate.startTimestamp;
  const end = candidate.endTimestamp;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= end ||
    candidate.endExclusive !== true ||
    !hasNonEmptyPillars({
      pillars: candidate.pillars,
      intervalStart: candidate.start.text,
      intervalEnd: candidate.end.text,
    })
  ) {
    return null;
  }
  if (
    parseBeijingDateTimeText(candidate.start.text) !== start ||
    parseBeijingDateTimeText(candidate.end.text) !== end
  ) {
    return null;
  }
  const representative = fromBeijingTimestamp(start);
  const timeIndex = getTimeIndexFromClock(representative.hour, representative.minute);
  if (timeIndex < 0) return null;
  return {
    year: String(representative.year),
    month: String(representative.month),
    day: String(representative.day),
    timeIndex,
    representativeHour: representative.hour,
    representativeMinute: representative.minute,
    representativeSecond: new Date(start).getUTCSeconds(),
    source: {
      pillars: candidate.pillars,
      intervalStart: candidate.start.text,
      intervalEnd: candidate.end.text,
      startTimestamp: start,
      endTimestamp: end,
      endExclusive: true,
      timezone: BAZI_REVERSE_TIMEZONE,
      offsetHours: BAZI_REVERSE_OFFSET_HOURS,
    },
  };
}

export function serializeBaziReverseSource(source: BaziReverseSource) {
  return JSON.stringify(source);
}

export function parseBaziReverseSource(value: string | undefined): BaziReverseSource | null {
  if (!value) return null;
  try {
    return normalizeBaziReverseSource(JSON.parse(value));
  } catch {
    return null;
  }
}

/** 将日期区间作为盘面事实传给结果页和解读任务。 */
export function formatBirthTimeInterval(source: BaziReverseSource, label = '出生时间') {
  return `${label}范围（北京时间）：${source.intervalStart} 至 ${source.intervalEnd}（起点含、终点不含）；当前盘面采用区间起点作为代表时刻。涉及区间内时间变化的结论需结合具体时刻复核。`;
}
