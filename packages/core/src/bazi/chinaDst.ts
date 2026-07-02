/**
 * @file 中国夏令时（1986-1991）检测与校正
 * @description
 * 1986-1991 年中国实行夏令时：当年 4 月中旬第一个星期日 02:00（标准时）
 * 将钟表拨快 1 小时，至 9 月中旬第一个星期日 02:00（夏令时钟表时刻）拨回。
 * 该期间出生记录的"钟表时间"比北京标准时间快 1 小时，排盘前需先减 1 小时，
 * 否则时柱（乃至日柱）可能整体偏移一个时辰。
 *
 * 区间依据国务院历年通知：
 * 1986-05-04 ~ 1986-09-14（首年自 5 月 4 日起）
 * 1987-04-12 ~ 1987-09-13
 * 1988-04-10 ~ 1988-09-11
 * 1989-04-16 ~ 1989-09-17
 * 1990-04-15 ~ 1990-09-16
 * 1991-04-14 ~ 1991-09-15
 */

export interface ChinaDstCheckResult {
  /** 输入的钟表时刻是否处于夏令时期间 */
  inDst: boolean;
  /** 应施加的分钟修正（夏令时内为 -60，否则 0） */
  offsetMinutes: number;
  /** 是否落在重复时段（结束日 01:00-02:00 钟表出现两次，无法唯一确定） */
  ambiguous: boolean;
  /** 是否落在不存在时段（开始日 02:00-03:00 被直接跳过，记录可能有误） */
  nonexistent: boolean;
}

type DstBoundary = [year: number, month: number, day: number, hour: number];

/**
 * 钟表时刻区间 [start, end)。
 * 开始日 02:00（标准时）直接跳到 03:00（夏令时），故夏令钟表区间自开始日 03:00 起；
 * 结束日 02:00（夏令时）回拨至 01:00（标准时），故夏令钟表区间至结束日 02:00 止。
 */
const CHINA_DST_RANGES: Array<{ start: DstBoundary; end: DstBoundary }> = [
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

/**
 * 检测某"钟表时刻"（北京时间墙上时钟）是否处于中国夏令时期间。
 */
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
  if (year < 1986 || year > 1991) {
    return none;
  }

  const t = toUtcMs(year, month, day, hour, minute);
  for (const { start, end } of CHINA_DST_RANGES) {
    if (start[0] !== year) {
      continue;
    }
    const startMs = toUtcMs(...start);
    const endMs = toUtcMs(...end);

    // 不存在时段：开始日 02:00-03:00 的钟表时刻被跳过
    if (t >= startMs - HOUR_MS && t < startMs) {
      return { inDst: true, offsetMinutes: -60, ambiguous: false, nonexistent: true };
    }
    if (t >= startMs && t < endMs) {
      // 重复时段：结束日 01:00-02:00 的钟表时刻出现两次
      const ambiguous = t >= endMs - HOUR_MS;
      return { inDst: true, offsetMinutes: -60, ambiguous, nonexistent: false };
    }
  }
  return none;
}

/**
 * 按"日"粒度判断日期是否与夏令时区间有交集。
 * 用于仅有时辰精度（无法安全做 -1 小时校正）时给出提示。
 */
export function isDateInChinaDstRange(year: number, month: number, day: number): boolean {
  if (year < 1986 || year > 1991) {
    return false;
  }
  const dayStart = toUtcMs(year, month, day, 0);
  const dayEnd = dayStart + 24 * HOUR_MS;
  return CHINA_DST_RANGES.some(({ start, end }) => {
    if (start[0] !== year) {
      return false;
    }
    // 区间起点取开始日 02:00（跳变时刻），保证开始日当天也能命中提示
    const startMs = toUtcMs(start[0], start[1], start[2], 2);
    const endMs = toUtcMs(...end);
    return dayStart < endMs && dayEnd > startMs;
  });
}
