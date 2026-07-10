/**
 * @file 中国夏令时（1986-1991）检测与校正
 * @description 中国历史钟表时间修正属于公共日历能力，供八字、紫微、真太阳时等统一复用。
 */

export interface ChinaDstCheckResult {
  /** 输入的钟表时刻是否处于夏令时期间。 */
  inDst: boolean;
  /** 应施加的分钟修正（夏令时内为 -60，否则 0）。 */
  offsetMinutes: number;
  /** 是否落在结束日 01:00-02:00 的重复时段。 */
  ambiguous: boolean;
  /** 是否落在开始日 02:00-03:00 的不存在时段。 */
  nonexistent: boolean;
}

type DstBoundary = [year: number, month: number, day: number, hour: number];

export const CHINA_DST_YEARS = [1986, 1987, 1988, 1989, 1990, 1991] as const;

/** 钟表时刻区间 [start, end)。 */
const CHINA_DST_RANGES: ReadonlyArray<{ start: DstBoundary; end: DstBoundary }> = [
  { start: [1986, 5, 4, 3], end: [1986, 9, 14, 2] },
  { start: [1987, 4, 12, 3], end: [1987, 9, 13, 2] },
  { start: [1988, 4, 10, 3], end: [1988, 9, 11, 2] },
  { start: [1989, 4, 16, 3], end: [1989, 9, 17, 2] },
  { start: [1990, 4, 15, 3], end: [1990, 9, 16, 2] },
  { start: [1991, 4, 14, 3], end: [1991, 9, 15, 2] },
];

const HOUR_MS = 3600000;

function toUtcMs(year: number, month: number, day: number, hour: number, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute);
}

/** 检测某个中国历史钟表时刻是否处于夏令时期间。 */
export function checkChinaDst(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): ChinaDstCheckResult {
  const none: ChinaDstCheckResult = {
    inDst: false,
    offsetMinutes: 0,
    ambiguous: false,
    nonexistent: false,
  };
  if (!(CHINA_DST_YEARS as readonly number[]).includes(year)) {
    return none;
  }

  const t = toUtcMs(year, month, day, hour, minute);
  for (const { start, end } of CHINA_DST_RANGES) {
    if (start[0] !== year) continue;
    const startMs = toUtcMs(...start);
    const endMs = toUtcMs(...end);

    if (t >= startMs - HOUR_MS && t < startMs) {
      return { inDst: true, offsetMinutes: -60, ambiguous: false, nonexistent: true };
    }
    if (t >= startMs && t < endMs) {
      return {
        inDst: true,
        offsetMinutes: -60,
        ambiguous: t >= endMs - HOUR_MS,
        nonexistent: false,
      };
    }
  }
  return none;
}

/** 按日判断日期是否与中国历史夏令时区间有交集。 */
export function isDateInChinaDstRange(year: number, month: number, day: number): boolean {
  if (!(CHINA_DST_YEARS as readonly number[]).includes(year)) {
    return false;
  }
  const dayStart = toUtcMs(year, month, day, 0);
  const dayEnd = dayStart + 24 * HOUR_MS;
  return CHINA_DST_RANGES.some(({ start, end }) => {
    if (start[0] !== year) return false;
    const startMs = toUtcMs(start[0], start[1], start[2], 2);
    const endMs = toUtcMs(...end);
    return dayStart < endMs && dayEnd > startMs;
  });
}
