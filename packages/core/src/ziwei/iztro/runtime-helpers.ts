import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import type FunctionalHoroscope from 'iztro/lib/astro/FunctionalHoroscope';
import type { Config } from 'iztro/lib/data/types';
import { LunarDay, SolarDay } from 'tyme4ts';
import type { ChartInput } from '../../types/chart';
import { daysInSolarMonth } from '../../calendar/date-validation';
import { TimeManager } from '../../calendar/timeManager';

export function normalizeChartInput(input: ChartInput): ChartInput {
  return {
    ...input,
    name: input.name?.trim() ?? '',
    birthDate: input.birthDate.trim(),
    fixLeap: input.fixLeap ?? true,
  };
}

export function buildIztroConfig(input: ChartInput): Config {
  return {
    algorithm: input.algorithm,
    yearDivide: input.yearDivide,
    horoscopeDivide: input.horoscopeDivide,
    ageDivide: input.ageDivide,
    dayDivide: input.dayDivide,
  };
}

function timeToIndex(hour: number) {
  if (hour === 0) {
    return 0;
  }

  if (hour === 23) {
    return 12;
  }

  return Math.floor((hour + 1) / 2);
}

export async function buildAstrolabeFromInput(input: ChartInput): Promise<FunctionalAstrolabe> {
  const normalized = normalizeChartInput(input);
  const { astro } = await import('iztro');

  return astro.withOptions({
    type: normalized.dateType,
    dateStr: normalized.birthDate,
    timeIndex: normalized.birthTimeIndex,
    gender: normalized.gender,
    isLeapMonth: normalized.isLeapMonth,
    fixLeap: normalized.fixLeap,
    language: 'zh-CN',
    config: buildIztroConfig(normalized),
  }) as FunctionalAstrolabe;
}

export function formatLocalDate(date: Date): string {
  const parts = TimeManager.getWallClockParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getDefaultHoroscopeContext(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('当前时间不是有效日期。');
  }
  const parts = TimeManager.getWallClockParts(now);
  return {
    dateStr: formatLocalDate(now),
    hourIndex: timeToIndex(parts.hour),
  };
}

export function buildHoroscope(
  astrolabe: FunctionalAstrolabe,
  dateStr: string,
  hourIndex: number,
): FunctionalHoroscope {
  return astrolabe.horoscope(dateStr, hourIndex) as FunctionalHoroscope;
}

export function shiftLocalDate(
  dateStr: string,
  amount: number,
  unit: 'year' | 'month' | 'day',
): string {
  const { year, month, day } = parseSolarDateKey(dateStr);
  if (!Number.isInteger(amount)) {
    throw new Error('日期位移量必须是整数。');
  }

  let date: Date;

  // 注意：以下使用本地时区构造 Date(year, month-1, day)，在 DST 跳过午夜的时区可能
  // 返回前一日 23:00 或次日 01:00。中国大陆 1992 年后无 DST，主要部署场景不触发。
  // 如需支持有 DST 的时区，应改用 UTC 构造或 TimeManager.getWallClockParts。
  if (unit === 'year') {
    const targetYear = year + amount;
    const targetDay = Math.min(day, daysInGregorianMonth(targetYear, month));
    date = new Date(targetYear, month - 1, targetDay);
  } else if (unit === 'month') {
    const totalMonthIndex = year * 12 + (month - 1) + amount;
    const targetYear = Math.floor(totalMonthIndex / 12);
    const targetMonth = (totalMonthIndex % 12) + 1;
    const targetDay = Math.min(day, daysInGregorianMonth(targetYear, targetMonth));
    date = new Date(targetYear, targetMonth - 1, targetDay);
  } else {
    date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + amount);
  }

  return formatLocalDate(date);
}

/**
 * 按农历年位移日期：返回出生日对应农历日期在目标农历年中的公历日期。
 *
 * 虚岁按农历年（正月初一）递增；公历直移会让春节前出生者（公历 1 月至春节间）
 * 的"虚岁 N 岁"落入相邻农历年，导致大限/流年时间轴取到错误的年干支。
 * 闰月出生回退到同名普通月，三十日出生遇目标月小月回退到廿九。
 */
export function shiftLunarYear(dateStr: string, amount: number): string {
  const { year, month, day } = parseSolarDateKey(dateStr);
  if (!Number.isInteger(amount)) {
    throw new Error('日期位移量必须是整数。');
  }

  const lunarBirth = SolarDay.fromYmd(year, month, day).getLunarDay();
  const lunarMonth = lunarBirth.getLunarMonth();
  const targetYear = lunarMonth.getYear() + amount;
  const monthWithLeap = lunarMonth.getMonthWithLeap();
  const monthCandidates =
    monthWithLeap < 0 ? [monthWithLeap, Math.abs(monthWithLeap)] : [monthWithLeap];

  for (const targetMonth of monthCandidates) {
    for (const targetDay of [lunarBirth.getDay(), 29]) {
      try {
        const solar = LunarDay.fromYmd(targetYear, targetMonth, targetDay).getSolarDay();
        return formatLocalDate(new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay()));
      } catch {
        // 目标年无此闰月或该月无三十日，按候选顺序回退
      }
    }
  }

  throw new Error('无法按农历年位移出生日期。');
}

function parseSolarDateKey(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error('日期格式需为 YYYY-MM-DD。');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error('年份需在 1900-2100 之间。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }

  const maxDay = daysInSolarMonth(year, month);
  if (!Number.isInteger(day) || day < 1) {
    throw new Error('日期不能小于 1。');
  }
  if (day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间。`);
  }

  return { year, month, day };
}

function daysInGregorianMonth(year: number, month: number) {
  if (!Number.isInteger(year)) {
    throw new Error('年份必须是整数。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
