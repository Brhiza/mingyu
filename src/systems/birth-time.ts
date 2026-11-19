import { LunarHour } from 'tyme4ts';
import {
  formatCivilDateTime,
  getCivilDateTimeAtFixedOffset,
  resolveCivilTime,
  type CivilDateTimeParts,
} from './huangji/civil-time';

export interface BirthClock extends CivilDateTimeParts {
  calendar?: 'solar' | 'lunar';
  leapMonth?: boolean;
  timezone?: number;
  timeZoneId?: string;
  timeStandard?: 'civil' | 'true-solar';
  longitude?: number;
  applyChinaDst?: boolean;
}

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

type DstBoundary = readonly [year: number, month: number, day: number, hour: number];

export const CHINA_DST_YEARS = [1986, 1987, 1988, 1989, 1990, 1991] as const;

/** 中国历史夏令时（1986–1991）钟表时刻区间 [start, end)。 */
export const CHINA_DST_RANGES: ReadonlyArray<{ readonly start: DstBoundary; readonly end: DstBoundary }> = [
  { start: [1986, 5, 4, 3], end: [1986, 9, 14, 2] },
  { start: [1987, 4, 12, 3], end: [1987, 9, 13, 2] },
  { start: [1988, 4, 17, 3], end: [1988, 9, 11, 2] },
  { start: [1989, 4, 16, 3], end: [1989, 9, 17, 2] },
  { start: [1990, 4, 15, 3], end: [1990, 9, 16, 2] },
  { start: [1991, 4, 14, 3], end: [1991, 9, 15, 2] },
];

const HOUR_MS = 3_600_000;

/** 检测某个中国历史钟表时刻是否处于 1986–1991 年夏令时期间。 */
export function checkChinaDst(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): ChinaDstCheckResult {
  const none: ChinaDstCheckResult = { inDst: false, offsetMinutes: 0, ambiguous: false, nonexistent: false };
  if (!(CHINA_DST_YEARS as readonly number[]).includes(year)) return none;

  const t = Date.UTC(year, month - 1, day, hour, minute);
  for (const { start, end } of CHINA_DST_RANGES) {
    if (start[0] !== year) continue;
    const startMs = Date.UTC(start[0], start[1] - 1, start[2], start[3], 0);
    const endMs = Date.UTC(end[0], end[1] - 1, end[2], end[3], 0);

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

export const lunar2057Warning = '2057 年 9 月 28 日至 10 月 27 日的农历日期在当前历表与香港天文台预测中相差一天；新月接近午夜，相关排盘需按历表口径另行核对。';
export const lunar2097Warning = '2097 年 8 月 7 日至 9 月 4 日的农历日期因朔日新月贴近东八区午夜（仅约 15 秒差值），不同历表对初一所属公历日可能相差一天；相关排盘需按历表口径另行核对。';
export function isLunarDateDiscrepancyWarning(text: string): boolean {
  return text === lunar2057Warning || text === lunar2097Warning;
}
export function lunarDateDiscrepancy(date: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'>) {
  if (date.year === 2057 && ((date.month === 9 && date.day >= 28) || (date.month === 10 && date.day <= 27))) {
    return lunar2057Warning;
  }
  if (date.year === 2097 && ((date.month === 8 && date.day >= 7) || (date.month === 9 && date.day <= 4))) {
    return lunar2097Warning;
  }
}
export function beijingLunarDateDiscrepancy(timestamp: number) {
  return lunarDateDiscrepancy(getCivilDateTimeAtFixedOffset(new Date(timestamp), 8));
}

/** 农历日期按当前历表转为公历；存在已知一日分歧时要求明确公历。 */
export function lunarToCivilDate(year: number, month: number, day: number, leapMonth?: boolean) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('农历月份须在 1 至 12 之间。');
  // 香港天文台指出 2057 年 9 月新月接近午夜；其历表和当前 tyme4ts 相差一日。
  if (year === 2057 && !leapMonth && ((month === 8 && day === 30) || month === 9)) {
    throw new Error('2057 年农历八月三十或九月的日期在不同历表中相差一天；请核对出生记录并使用公历日期。');
  }
  const solar = LunarHour.fromYmdHms(year, leapMonth ? -month : month, day, 12, 0, 0).getSolarTime();
  return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
}

/** 将公历或农历出生钟表解析为真实瞬时；冲突和夏令时歧义不作猜测。 */
export function resolveBirthClock(birth: BirthClock) {
  if (!birth || !['solar', 'lunar'].includes(birth.calendar ?? 'solar')) throw new Error('出生历法须为公历或农历。');
  if (!['civil', 'true-solar'].includes(birth.timeStandard ?? 'civil')) throw new Error('未知出生时间标准。');
  if (birth.calendar !== 'lunar' && birth.leapMonth !== undefined) throw new Error('只有农历可指定闰月。');
  if (birth.timeStandard === 'true-solar' ? birth.longitude === undefined : birth.longitude !== undefined) throw new Error('真太阳时必须提供经度；民用时间不接受经度。');
  if (birth.applyChinaDst) {
    if (birth.timeZoneId) throw new Error('timeZoneId 已包含历史夏令时规则，不能同时启用 applyChinaDst。');
    if (birth.timezone !== undefined && birth.timezone !== 8) throw new Error('中国历史夏令时校正仅适用于东八区钟表时间。');
  }
  let civil: CivilDateTimeParts = { year: birth.year, month: birth.month, day: birth.day, hour: birth.hour, minute: birth.minute, second: birth.second };
  if (birth.calendar === 'lunar') {
    civil = { ...lunarToCivilDate(birth.year, birth.month, birth.day, birth.leapMonth), hour: birth.hour, minute: birth.minute, second: birth.second };
  }
  const resolved = resolveCivilTime({ ...civil, timezone: birth.timezone ?? (birth.timeZoneId ? undefined : 8), timeZoneId: birth.timeZoneId });
  if (!Number.isInteger(resolved.timezone * 60)) throw new Error('当前排盘仅支持整分钟 UTC 偏移。');
  if (!birth.applyChinaDst) return resolved;

  const dst = checkChinaDst(civil.year, civil.month, civil.day, civil.hour, civil.minute);
  if (dst.nonexistent) throw new Error('该中国历史钟表时间处于夏令时跳时缺口，实际并不存在。');
  if (dst.ambiguous) throw new Error('该中国历史钟表时间处于夏令时回拨重复时段，无法唯一定时。');
  if (!dst.inDst) return { ...resolved, usedChinaDstCorrection: false };

  const utcTimestamp = resolved.utcTimestamp - HOUR_MS;
  const localTime = getCivilDateTimeAtFixedOffset(new Date(utcTimestamp), 8);
  return {
    ...resolved,
    localTime,
    localDateTime: formatCivilDateTime(localTime),
    utcTimestamp,
    utcDateTime: new Date(utcTimestamp).toISOString(),
    usedChinaDstCorrection: true,
  };
}

/** 真太阳时用于日时钟表；不改变真实出生瞬时或年月节气基准。 */
export async function correctBirthClock(birth: BirthClock, resolved: ReturnType<typeof resolveBirthClock>) {
  if (birth.timeStandard !== 'true-solar') return { timestamp: resolved.utcTimestamp, correction: undefined };
  const { trueSolarTime } = await import('./astronomy/true-solar');
  const solar = trueSolarTime(new Date(resolved.utcTimestamp), birth.longitude!);
  const longitudeCorrectionMinutes = solar.longitudeCorrectionMinutes + 480 - resolved.timezone * 60;
  return {
    timestamp: solar.effectiveTimestamp + (480 - resolved.timezone * 60) * 60_000,
    correction: { longitude: solar.longitude, longitudeCorrectionMinutes, equationOfTimeMinutes: solar.equationOfTimeMinutes, totalCorrectionMinutes: longitudeCorrectionMinutes + solar.equationOfTimeMinutes },
  };
}
