import type { BaziReverseCandidate, BaziReversePillars } from 'mingyu-core/calendar';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';

export type BaziReverseSource = {
  pillars: BaziReversePillars;
  intervalStart: string;
  intervalEnd: string;
};

/**
 * 现有八字输入页能表达的反推回填资料。
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
  const date = new Date(timestamp + 8 * 60 * 60 * 1000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

/** 将候选区间的起点回填为精确标准北京时间，并保留秒级边界。 */
export function resolveBaziReverseCandidate(
  candidate: BaziReverseCandidate,
): BaziReverseResolvedInput | null {
  const start = candidate.startTimestamp;
  const end = candidate.endTimestamp;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
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
    },
  };
}

export function serializeBaziReverseSource(source: BaziReverseSource) {
  return JSON.stringify(source);
}

export function parseBaziReverseSource(value: string | undefined): BaziReverseSource | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const source = parsed as {
      pillars?: Partial<BaziReversePillars>;
      intervalStart?: unknown;
      intervalEnd?: unknown;
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
    return {
      pillars: {
        year: pillars.year,
        month: pillars.month,
        day: pillars.day,
        hour: pillars.hour,
      },
      intervalStart: source.intervalStart,
      intervalEnd: source.intervalEnd,
    };
  } catch {
    return null;
  }
}
