import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import type FunctionalHoroscope from 'iztro/lib/astro/FunctionalHoroscope';
import type { Config } from 'iztro/lib/data/types';
import { LunarDay, SolarDay } from 'tyme4ts';
import type { ChartInput } from '../../types/chart';
import { daysInSolarMonth } from '../../calendar/date-validation';
import { getTimeIndexFromClock } from '../../calendar/dateUtils';
import { TimeManager } from '../../calendar/timeManager';

const VALID_GENDERS = ['男', '女'] as const;
const VALID_ALGORITHMS = ['default', 'zhongzhou'] as const;
const VALID_YEAR_DIVIDES = ['normal', 'exact'] as const;
const VALID_HOROSCOPE_DIVIDES = ['normal', 'exact'] as const;
const VALID_AGE_DIVIDES = ['normal', 'birthday'] as const;
const VALID_DAY_DIVIDES = ['current', 'forward'] as const;

function normalizeTextField(value: unknown, label: string, fallback = ''): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label}必须是文本。`);
  }
  return value.trim();
}

export function normalizeChartInput(input: ChartInput): ChartInput {
  return {
    ...input,
    name: normalizeTextField(input.name, '姓名'),
    birthDate: normalizeTextField(input.birthDate, '出生日期'),
    fixLeap: input.fixLeap ?? true,
    algorithm: input.algorithm ?? 'default',
    yearDivide: input.yearDivide ?? 'normal',
    horoscopeDivide: input.horoscopeDivide ?? 'normal',
    ageDivide: input.ageDivide ?? 'normal',
    dayDivide: input.dayDivide ?? 'forward',
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

export async function buildAstrolabeFromInput(input: ChartInput): Promise<FunctionalAstrolabe> {
  const normalized = normalizeChartInput(input);
  assertValidChartInput(normalized);
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

function assertValidChartInput(input: ChartInput) {
  if (input.isLeapMonth !== undefined && typeof input.isLeapMonth !== 'boolean') {
    throw new Error('闰月标志必须是布尔值。');
  }
  if (typeof input.fixLeap !== 'boolean') {
    throw new Error('闰月修正配置必须是布尔值。');
  }
  if (input.dateType !== 'solar' && input.dateType !== 'lunar') {
    throw new Error('出生日期类型必须是公历或农历。');
  }

  assertOneOf(input.gender, VALID_GENDERS, '性别必须是男或女。');
  assertOneOf(input.algorithm, VALID_ALGORITHMS, '紫微排盘算法必须是 default 或 zhongzhou。');
  assertOneOf(input.yearDivide, VALID_YEAR_DIVIDES, '紫微年分界必须是 normal 或 exact。');
  assertOneOf(
    input.horoscopeDivide,
    VALID_HOROSCOPE_DIVIDES,
    '紫微行运分界必须是 normal 或 exact。',
  );
  assertOneOf(input.ageDivide, VALID_AGE_DIVIDES, '紫微年龄分界必须是 normal 或 birthday。');
  assertOneOf(input.dayDivide, VALID_DAY_DIVIDES, '紫微日期分界必须是 current 或 forward。');

  if (
    !Number.isInteger(input.birthTimeIndex) ||
    input.birthTimeIndex < 0 ||
    input.birthTimeIndex > 12
  ) {
    throw new Error('出生时辰需在 0-12 之间。');
  }

  const { year, month, day } = parseBirthDateKey(input.birthDate);
  if (input.dateType === 'solar') {
    const maxDay = daysInSolarMonth(year, month);
    if (day > maxDay) {
      throw new Error(`日期需在 1-${maxDay} 之间。`);
    }
    return;
  }

  if (day > 30) {
    throw new Error('农历日期需在 1-30 之间。');
  }

  try {
    LunarDay.fromYmd(year, input.isLeapMonth ? -Math.abs(month) : month, day);
  } catch {
    throw new Error('农历日期不存在，请检查月份、日期和闰月设置。');
  }
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
  const hourIndex = getTimeIndexFromClock(parts.hour, parts.minute);
  if (hourIndex < 0) {
    throw new Error('当前时间无法换算为有效时辰。');
  }

  return {
    dateStr: formatLocalDate(now),
    hourIndex,
  };
}

export function buildHoroscope(
  astrolabe: FunctionalAstrolabe,
  dateStr: string,
  hourIndex: number,
): FunctionalHoroscope {
  assertValidHoroscopeInput(dateStr, hourIndex);
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

  if (unit === 'year') {
    const targetYear = year + amount;
    const targetDay = Math.min(day, daysInGregorianMonth(targetYear, month));
    return formatSolarDateKey(targetYear, month, targetDay);
  } else if (unit === 'month') {
    const totalMonthIndex = year * 12 + (month - 1) + amount;
    const targetYear = Math.floor(totalMonthIndex / 12);
    const targetMonth = (((totalMonthIndex % 12) + 12) % 12) + 1;
    const targetDay = Math.min(day, daysInGregorianMonth(targetYear, targetMonth));
    return formatSolarDateKey(targetYear, targetMonth, targetDay);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return formatSolarDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
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
        return formatSolarDateKey(solar.getYear(), solar.getMonth(), solar.getDay());
      } catch {
        // 目标年无此闰月或该月无三十日，按候选顺序回退
      }
    }
  }

  throw new Error('无法按农历年位移出生日期。');
}

function parseSolarDateKey(dateStr: unknown): { year: number; month: number; day: number } {
  if (typeof dateStr !== 'string') {
    throw new Error('日期格式需为 YYYY-MM-DD。');
  }
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

function assertOneOf<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  message: string,
): asserts value is T[number] {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new Error(message);
  }
}

function assertValidHoroscopeInput(dateStr: unknown, hourIndex: number) {
  if (typeof dateStr !== 'string') {
    throw new Error('行运日期格式需为 YYYY-MM-DD。');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error('行运日期格式需为 YYYY-MM-DD。');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || year < 1900) {
    throw new Error('行运日期年份不能早于 1900。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('行运日期月份需在 1-12 之间。');
  }

  const maxDay = daysInGregorianMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new Error(`行运日期需在 1-${maxDay} 之间。`);
  }

  if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex > 12) {
    throw new Error('行运时辰需在 0-12 之间。');
  }
}

function formatSolarDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

function parseBirthDateKey(dateStr: unknown): { year: number; month: number; day: number } {
  if (typeof dateStr !== 'string') {
    throw new Error('出生日期格式需为 YYYY-MM-DD。');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error('出生日期格式需为 YYYY-MM-DD。');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error('出生年份需在 1900-2100 之间。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('出生月份需在 1-12 之间。');
  }
  if (!Number.isInteger(day) || day < 1) {
    throw new Error('出生日期不能小于 1。');
  }

  return { year, month, day };
}
