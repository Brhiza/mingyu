import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type FunctionalHoroscope from 'iztro/lib/astro/FunctionalHoroscope';
import type { Config } from 'iztro/lib/data/types';
import { LunarDay, SolarDay } from 'tyme4ts';
import type { ChartInput } from '../../types/chart';
import type { ZiweiCalculationConfig } from '../../types/analysis';
import { daysInSolarMonth } from '../../calendar/date-validation';
import { getTimeIndexFromClock } from '../../calendar/dateUtils';
import { TimeManager } from '../../calendar/timeManager';
import { MingyuCoreError } from '../../shared/result';

const VALID_GENDERS = ['男', '女'] as const;
const VALID_ALGORITHMS = ['default', 'zhongzhou'] as const;
const VALID_YEAR_DIVIDES = ['normal', 'exact'] as const;
const VALID_HOROSCOPE_DIVIDES = ['normal', 'exact'] as const;
const VALID_AGE_DIVIDES = ['normal', 'birthday'] as const;
const VALID_DAY_DIVIDES = ['current', 'forward'] as const;

type IztroAstro = typeof import('iztro').astro;
type HoroscopeTools = [
  typeof import('iztro/lib/astro/index.js'),
  typeof import('iztro/lib/star/index.js'),
  typeof import('iztro/lib/utils/index.js'),
];
type IztroModuleShape = {
  astro?: IztroAstro;
  default?:
    | IztroAstro
    | {
        astro?: IztroAstro;
        default?: IztroAstro | { astro?: IztroAstro };
      };
};

function isIztroAstro(value: unknown): value is IztroAstro {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { withOptions?: unknown }).withOptions === 'function' &&
    typeof (value as { config?: unknown }).config === 'function'
  );
}

/**
 * 兼容 iztro 的 CommonJS 导出在 Node、Vite 和 Webpack 中的不同包装方式。
 */
export function resolveIztroAstro(moduleValue: unknown): IztroAstro {
  const moduleShape = moduleValue as IztroModuleShape;
  const defaultValue = moduleShape?.default;
  const nestedDefault =
    typeof defaultValue === 'object' && defaultValue !== null && 'default' in defaultValue
      ? defaultValue.default
      : undefined;
  const candidates = [
    moduleShape?.astro,
    defaultValue,
    typeof defaultValue === 'object' && defaultValue !== null && 'astro' in defaultValue
      ? defaultValue.astro
      : undefined,
    nestedDefault,
    typeof nestedDefault === 'object' && nestedDefault !== null && 'astro' in nestedDefault
      ? nestedDefault.astro
      : undefined,
  ];

  const astro = candidates.find(isIztroAstro);
  if (!astro) {
    throw new MingyuCoreError({
      code: 'IZTRO_EXPORT_INVALID',
      category: 'dependency',
      message: '当前 iztro 包未提供可用的紫微排盘入口。',
      recoverable: true,
      context: { dependency: 'iztro', expected: 'astro.withOptions' },
    });
  }
  return astro;
}

async function loadIztroAstro(): Promise<IztroAstro> {
  try {
    return resolveIztroAstro(await import('iztro'));
  } catch (cause) {
    if (cause instanceof MingyuCoreError) throw cause;
    throw new MingyuCoreError({
      code: 'IZTRO_DEPENDENCY_REQUIRED',
      category: 'dependency',
      message: '紫微斗数能力需要安装可选依赖 iztro。',
      recoverable: true,
      context: { dependency: 'iztro', install: 'pnpm add iztro' },
      cause,
    });
  }
}

async function loadIztroHoroscopeTools(): Promise<HoroscopeTools> {
  return Promise.all([
    import('iztro/lib/astro/index.js'),
    import('iztro/lib/star/index.js'),
    import('iztro/lib/utils/index.js'),
  ]);
}

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
    ...(input.birthTime ? { birthTime: { ...input.birthTime } } : {}),
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

export function buildZiweiCalculationConfig(input: ChartInput): ZiweiCalculationConfig {
  const normalized = normalizeChartInput(input);
  return {
    engine: 'iztro',
    algorithm: normalized.algorithm!,
    algorithm_basis:
      normalized.algorithm === 'zhongzhou'
        ? 'iztro 中州派安星法'
        : 'iztro 以《紫微斗数全书》为基础的默认安星法',
    fix_leap: normalized.fixLeap!,
    leap_month_rule: normalized.fixLeap
      ? '闰月十五日及以前按同名月，十六日起按下月；晚子时另按本次日期分界口径处理'
      : '闰月全月沿用同名月序',
    year_divide: normalized.yearDivide!,
    year_divide_rule: normalized.yearDivide === 'exact' ? '以立春分年' : '以农历正月初一分年',
    horoscope_divide: normalized.horoscopeDivide!,
    horoscope_divide_rule:
      normalized.horoscopeDivide === 'exact'
        ? '运限流年以立春、流月以节气分界'
        : '运限流年以农历年、流月以农历月分界',
    age_divide: normalized.ageDivide!,
    age_divide_rule:
      normalized.ageDivide === 'birthday' ? '小限年龄以生日分界' : '小限年龄只按年份计算',
    day_divide: normalized.dayDivide!,
    late_zi_rule:
      normalized.dayDivide === 'forward'
        ? '晚子时按次日干支及次日安星日数排盘'
        : '晚子时仍按当日干支及当日安星日数排盘',
    limitation:
      '这些字段记录本次实际传给 iztro 的基础排盘口径；提示词中的三合、飞星或四化流派选项只改变解读侧重点，不改变这里的安星算法',
  };
}

export const DEFAULT_ZIWEI_CALCULATION_CONFIG: ZiweiCalculationConfig = buildZiweiCalculationConfig(
  {
    name: '',
    dateType: 'solar',
    birthDate: '',
    birthTimeIndex: 0,
    gender: '男',
  },
);

export async function buildAstrolabeFromInput(input: ChartInput): Promise<FunctionalAstrolabe> {
  const normalized = normalizeChartInput(input);
  assertValidChartInput(normalized);
  const astro = await loadIztroAstro();
  const horoscopeTools = await loadIztroHoroscopeTools();
  let effectiveBirthSolarDate: string | undefined;

  const options = {
    type: normalized.dateType,
    dateStr: normalized.birthDate,
    timeIndex: normalized.birthTimeIndex,
    gender: normalized.gender,
    isLeapMonth: normalized.isLeapMonth,
    fixLeap: normalized.fixLeap,
    language: 'zh-CN',
    config: buildIztroConfig(normalized),
  };
  let astrolabe = astro.withOptions(options) as FunctionalAstrolabe;

  if (normalized.dayDivide === 'forward' && normalized.birthTimeIndex === 12) {
    // iztro 只对晚子时部分日数计算做次日处理；改用次日早子时统一计算完整盘面，
    // 否则闰月月序、宫位和依赖日期的星曜仍会落在原日口径。
    const originalBirth = astrolabe;
    const effectiveDate = getNextSolarBirthDate(normalized);
    effectiveBirthSolarDate = effectiveDate;
    const effectiveAstrolabe = astro.withOptions({
      ...options,
      type: 'solar',
      dateStr: effectiveDate,
      timeIndex: 0,
    }) as FunctionalAstrolabe;

    // rawDates 和盘面保留次日计算口径；展示字段仍保留实际出生日期、时刻与星座。
    effectiveAstrolabe.solarDate = originalBirth.solarDate;
    effectiveAstrolabe.lunarDate = originalBirth.lunarDate;
    effectiveAstrolabe.time = originalBirth.time;
    effectiveAstrolabe.timeRange = originalBirth.timeRange;
    effectiveAstrolabe.sign = originalBirth.sign;
    effectiveAstrolabe.zodiac = originalBirth.zodiac;
    astrolabe = effectiveAstrolabe;
  }

  // iztro 的运限计算读取全局配置；星盘构造后若又创建其他口径的盘，
  // 这张盘的同步 horoscope 调用也必须恢复自己的分界口径。
  const calculateHoroscope = astrolabe.horoscope.bind(astrolabe);
  const calculationConfig = buildIztroConfig(normalized);
  astrolabe.horoscope = (dateStr, hourIndex) => {
    astro.config(calculationConfig);
    // iztro 2.5.8 的运限查询未使用 dayDivide；当天口径的晚子时须按当日早子时取干支。
    const effectiveHourIndex =
      normalized.dayDivide === 'current' && hourIndex === 12 ? 0 : hourIndex;
    const displayBirthSolarDate = astrolabe.solarDate;
    if (effectiveBirthSolarDate) astrolabe.solarDate = effectiveBirthSolarDate;
    try {
      let horoscope = calculateHoroscope(dateStr, effectiveHourIndex) as FunctionalHoroscope;
      // 带钟表日期的显式早子时及当天口径晚子时，按实际公历日取同日子时干支。
      if (
        (effectiveHourIndex === 0 ||
          (normalized.dayDivide === 'current' &&
            hourIndex === undefined &&
            horoscope.hourly.earthlyBranch === '子')) &&
        (typeof dateStr !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr))
      ) {
        horoscope = calculateHoroscope(horoscope.solarDate, 0) as FunctionalHoroscope;
      }
      return normalized.ageDivide === 'birthday'
        ? applyBirthdayAgeBoundary(
            astrolabe,
            horoscope,
            horoscope.solarDate,
            normalized,
            horoscopeTools,
          )
        : applyAgePalaceCycle(astrolabe, horoscope, horoscope.age.nominalAge, horoscopeTools);
    } finally {
      if (effectiveBirthSolarDate) astrolabe.solarDate = displayBirthSolarDate;
    }
  };

  // 盘内星名已经按同一语言生成，精确名称无需逐星反查全部翻译词条。
  // 别名与其他语言仍交给引擎处理；遍历当前星表，保留引擎的末项匹配语义。
  const findTranslatedStar = astrolabe.star.bind(astrolabe);
  astrolabe.star = (starName) => {
    let matched: ReturnType<FunctionalAstrolabe['star']> | undefined;
    for (const palace of astrolabe.palaces) {
      for (const stars of [palace.majorStars, palace.minorStars, palace.adjectiveStars]) {
        for (const star of stars) {
          if (star.name === starName) {
            star.setPalace(palace);
            star.setAstrolabe(astrolabe);
            matched = star;
          }
        }
      }
    }
    return matched ?? findTranslatedStar(starName);
  };
  return astrolabe;
}

function getNextSolarBirthDate(input: ChartInput): string {
  const { year, month, day } = parseBirthDateKey(input.birthDate);
  const solarDay =
    input.dateType === 'solar'
      ? SolarDay.fromYmd(year, month, day)
      : LunarDay.fromYmd(year, input.isLeapMonth ? -month : month, day).getSolarDay();
  const nextDay = solarDay.next(1);
  return formatSolarDateKey(nextDay.getYear(), nextDay.getMonth(), nextDay.getDay());
}

/** 运限沿用安星实际出生日；晚子跨日时展示日期仍为原始出生日期。 */
export function getZiweiFortuneBirthSolarDate(
  astrolabe: IFunctionalAstrolabe,
  input: ChartInput,
): string {
  return (input.dayDivide ?? 'forward') === 'forward' && input.birthTimeIndex === 12
    ? getNextSolarBirthDate(input)
    : astrolabe.solarDate;
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
  if (input.dateType === 'solar' && input.isLeapMonth === true) {
    throw new Error('公历日期不能设置农历闰月。');
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
  if (
    input.birthTime !== undefined &&
    (!input.birthTime ||
      !Number.isInteger(input.birthTime.hour) ||
      input.birthTime.hour < 0 ||
      input.birthTime.hour > 23 ||
      !Number.isInteger(input.birthTime.minute) ||
      input.birthTime.minute < 0 ||
      input.birthTime.minute > 59 ||
      (input.birthTime.second !== undefined &&
        (!Number.isInteger(input.birthTime.second) ||
          input.birthTime.second < 0 ||
          input.birthTime.second > 59)) ||
      getTimeIndexFromClock(input.birthTime.hour, input.birthTime.minute) !== input.birthTimeIndex)
  ) {
    throw new Error('紫微四柱展示时分与出生时辰不一致。');
  }
  if (
    input.birthTime?.second !== undefined &&
    (!Number.isInteger(input.birthTime.second) ||
      input.birthTime.second < 0 ||
      input.birthTime.second > 59)
  ) {
    throw new Error('紫微四柱展示秒数必须在 0-59 之间。');
  }
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
  astrolabe: IFunctionalAstrolabe,
  dateStr: string,
  hourIndex: number,
): FunctionalHoroscope {
  assertValidHoroscopeInput(dateStr, hourIndex);
  return astrolabe.horoscope(dateStr, hourIndex) as FunctionalHoroscope;
}

export async function buildHoroscopeFromInput(
  astrolabe: IFunctionalAstrolabe,
  input: ChartInput,
  dateStr: string,
  hourIndex: number,
): Promise<FunctionalHoroscope> {
  const normalized = normalizeChartInput(input);
  assertValidChartInput(normalized);
  assertValidHoroscopeInput(dateStr, hourIndex);
  const astro = await loadIztroAstro();

  // iztro 的配置是全局状态；每次取运限前恢复本盘配置，避免不同口径串盘。
  // 可选依赖只在调用紫微能力时加载，并在恢复配置前完成异步导入。
  const horoscopeTools = await loadIztroHoroscopeTools();
  astro.config(buildIztroConfig(normalized));
  const horoscope = astrolabe.horoscope(dateStr, hourIndex) as FunctionalHoroscope;
  return normalized.ageDivide === 'birthday'
    ? applyBirthdayAgeBoundary(astrolabe, horoscope, dateStr, normalized, horoscopeTools)
    : applyAgePalaceCycle(astrolabe, horoscope, horoscope.age.nominalAge, horoscopeTools);
}

type LunarBirthdayParts = {
  year: number;
};

function parseSolarDateParts(dateStr: string): [number, number, number] {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr.trim());
  if (!match) throw new Error('紫微运限日期格式需为 YYYY-MM-DD。');
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function getLunarBirthdayParts(dateStr: string): LunarBirthdayParts {
  const lunarDay = SolarDay.fromYmd(...parseSolarDateParts(dateStr)).getLunarDay();
  const lunarMonth = lunarDay.getLunarMonth();
  return {
    year: lunarMonth.getYear(),
  };
}

function normalizeSolarDateKey(dateStr: string): string {
  const [year, month, day] = parseSolarDateParts(dateStr);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function compareLunarBirthday(
  targetDateStr: string,
  birthDateStr: string,
  targetLunarYear: number,
  birthLunarYear: number,
): number {
  const elapsedLunarYears = targetLunarYear - birthLunarYear;
  const anniversaryDate =
    elapsedLunarYears > 0 ? shiftLunarYear(birthDateStr, elapsedLunarYears) : birthDateStr;
  const targetDate = normalizeSolarDateKey(targetDateStr);
  const anniversary = normalizeSolarDateKey(anniversaryDate);
  return targetDate < anniversary ? -1 : targetDate > anniversary ? 1 : 0;
}

/**
 * iztro 2.5.8 的 birthday 规则只在目标日期与出生日期同一农历年时比较月日，
 * 导致跨年同月生日被推迟到下一个农历月。这里在适配层按出生农历周年的实际公历代表日重算，
 * 并把依赖年龄驱动的童限、大限和小限对象一起切换到正确宫位。
 */
function applyBirthdayAgeBoundary(
  astrolabe: IFunctionalAstrolabe,
  horoscope: FunctionalHoroscope,
  targetDateStr: string,
  input: ChartInput,
  horoscopeTools: HoroscopeTools,
): FunctionalHoroscope {
  const birthDateStr = normalizeSolarDateKey(getZiweiFortuneBirthSolarDate(astrolabe, input));
  const birth = getLunarBirthdayParts(birthDateStr);
  const target = getLunarBirthdayParts(targetDateStr);
  const birthdayComparison = compareLunarBirthday(
    targetDateStr,
    birthDateStr,
    target.year,
    birth.year,
  );
  const nominalAge = Math.max(1, target.year - birth.year + (birthdayComparison >= 0 ? 1 : 0));
  return applyAgePalaceCycle(astrolabe, horoscope, nominalAge, horoscopeTools);
}

/** 小限每十二岁同宫，大限从五行局起限后每十年一宫，十二宫后循原宫序续行。 */
function applyAgePalaceCycle(
  astrolabe: IFunctionalAstrolabe,
  horoscope: FunctionalHoroscope,
  nominalAge: number,
  [{ getPalaceNames }, { getHoroscopeStar }, { getMutagensByHeavenlyStem }]: HoroscopeTools,
): FunctionalHoroscope {
  if (
    horoscope.age.nominalAge === nominalAge &&
    (nominalAge <= 120 || (horoscope.age.index >= 0 && horoscope.decadal.index >= 0))
  ) {
    return horoscope;
  }

  const ageInFirstCycle = ((nominalAge - 1) % 12) + 1;
  const agePalace = astrolabe.palaces.find((palace) => palace.ages.includes(ageInFirstCycle))!;
  const decadalStartAge = Math.min(...astrolabe.palaces.map((palace) => palace.decadal.range[0]));
  // 起限之前仍按童限；起限之后以首限年龄为原点，避免将末限的 121 岁误归首限。
  const ageInDecadalCycle =
    nominalAge < decadalStartAge
      ? nominalAge
      : decadalStartAge + ((nominalAge - decadalStartAge) % 120);
  const regularDecadalPalace = astrolabe.palaces.find(
    (palace) =>
      ageInDecadalCycle >= palace.decadal.range[0] && ageInDecadalCycle <= palace.decadal.range[1],
  );
  const childhoodPalaceName = ['命宫', '财帛', '疾厄', '夫妻', '福德', '官禄'][nominalAge - 1];
  const childhoodPalace = childhoodPalaceName
    ? astrolabe.palaces.find((palace) => palace.name === childhoodPalaceName)
    : undefined;
  const decadalPalace = regularDecadalPalace ?? childhoodPalace;
  const isChildhood = !regularDecadalPalace && !!childhoodPalace;

  horoscope.age = {
    ...horoscope.age,
    index: agePalace.index,
    nominalAge,
    heavenlyStem: agePalace.heavenlyStem,
    earthlyBranch: agePalace.earthlyBranch,
    palaceNames: getPalaceNames(agePalace.index),
    mutagen: getMutagensByHeavenlyStem(agePalace.heavenlyStem),
  };

  if (decadalPalace) {
    horoscope.decadal = {
      ...horoscope.decadal,
      index: decadalPalace.index,
      name: isChildhood ? '童限' : '大限',
      heavenlyStem: decadalPalace.heavenlyStem,
      earthlyBranch: decadalPalace.earthlyBranch,
      palaceNames: getPalaceNames(decadalPalace.index),
      mutagen: getMutagensByHeavenlyStem(decadalPalace.heavenlyStem),
      stars: getHoroscopeStar(decadalPalace.heavenlyStem, decadalPalace.earthlyBranch, 'decadal'),
    };
  }

  return horoscope;
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

export function assertValidHoroscopeInput(dateStr: unknown, hourIndex: number) {
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
