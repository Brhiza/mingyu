import { SolarDay } from 'tyme4ts';
import { getSolarYmdHmsPillars } from '../calendar';
import { getYearSixtyCycle } from '../ganzhi-foundation';
import { EARTHLY_BRANCHES, HEAVENLY_STEMS, TIGER_RULE } from './constants';
import type {
  ChineseDatePillars,
  DivideMode,
  EarthlyBranch,
  HeavenlyStem,
  LeapMonthMode,
  LunarDateParts,
} from './types';

const LUNAR_DIGITS = [...'〇一二三四五六七八九'];
const LUNAR_MONTH_NAMES = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_NAMES = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

export interface SimpleSolarDate {
  year: number;
  month: number;
  day: number;
}

export interface SimpleClockTime {
  hour: number;
  minute: number;
  second: number;
}

export function fixIndex(index: number, max = 12): number {
  const modded = ((index % max) + max) % max;
  return modded === 0 ? 0 : modded;
}

export function formatSolarDate(date: SimpleSolarDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function parseSolarDate(dateStr: string): SimpleSolarDate {
  const parts = dateStr.trim().split(/[-/.]/).map((item) => Number(item));
  if (parts.length < 3 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`非法公历日期：${dateStr}`);
  }
  return { year: parts[0], month: parts[1], day: parts[2] };
}

export function formatChineseLunarYear(year: number): string {
  return String(year).split('').map((d) => LUNAR_DIGITS[Number(d)] ?? d).join('');
}

export function solarToLunarInfo(date: SimpleSolarDate): LunarDateParts {
  const solar = SolarDay.fromYmd(date.year, date.month, date.day);
  const lunar = solar.getLunarDay();
  const lunarYear = lunar.getYear();
  const rawMonth = lunar.getMonth();
  const lunarMonth = Math.abs(rawMonth);
  const lunarDay = lunar.getDay();
  const isLeap = rawMonth < 0;
  const maxDaysInMonth = lunar.getLunarMonth().getDayCount();

  return {
    lunarYear,
    lunarMonth,
    lunarDay,
    isLeap,
    maxDaysInMonth,
    toString(chinese = false) {
      if (!chinese) {
        return `${lunarYear}-${lunarMonth}-${lunarDay}`;
      }
      return `${formatChineseLunarYear(lunarYear)}年${isLeap ? '闰' : ''}${LUNAR_MONTH_NAMES[lunarMonth]}月${LUNAR_DAY_NAMES[lunarDay]}`;
    },
  };
}

export function getSolarSign(date: SimpleSolarDate): string {
  return `${SolarDay.fromYmd(date.year, date.month, date.day).getConstellation().getName()}座`;
}

function splitGanZhi(name: string): [HeavenlyStem, EarthlyBranch] {
  return [name[0] as HeavenlyStem, name[1] as EarthlyBranch];
}

export function resolveLeapMonthOffset(
  lunar: Pick<LunarDateParts, 'isLeap' | 'lunarDay'>,
  timeIndex: number,
  leapMonthMode: LeapMonthMode,
): number {
  if (!lunar.isLeap) return 0;
  if (leapMonthMode === 'same') return 0;
  if (leapMonthMode === 'next') return 1;
  return lunar.lunarDay > 15 && timeIndex !== 12 ? 1 : 0;
}

export function getStemBranchSet(
  date: SimpleSolarDate,
  timeIndex: number,
  options: {
    yearDivide: DivideMode;
    monthDivide: DivideMode;
    leapMonthMode?: LeapMonthMode;
    solarTermMoment?: SimpleSolarDate & SimpleClockTime;
  },
): ChineseDatePillars {
  const clampedTimeIndex = Math.max(0, Math.min(12, Math.trunc(timeIndex)));
  const repHour = Math.max(clampedTimeIndex * 2 - 1, 0);
  const moment = options.solarTermMoment;
  const lunar = SolarDay.fromYmd(date.year, date.month, date.day).getLunarDay();
  const termPillars = moment
    ? getSolarYmdHmsPillars(moment.year, moment.month, moment.day, moment.hour, moment.minute, moment.second)
    : getSolarYmdHmsPillars(date.year, date.month, date.day, repHour, 30, 0);
  const repPillars = getSolarYmdHmsPillars(date.year, date.month, date.day, repHour, 30, 0);

  const yearly = options.yearDivide === 'exact'
    ? splitGanZhi(termPillars.year)
    : splitGanZhi(getYearSixtyCycle(lunar.getYear()));

  let monthly: [HeavenlyStem, EarthlyBranch];
  if (options.monthDivide === 'exact') {
    monthly = splitGanZhi(termPillars.month);
  } else {
    const rawMonth = lunar.getMonth();
    const leapMode = options.leapMonthMode ?? 'split-15';
    const fixLeapOffset = rawMonth < 0
      ? (leapMode === 'next' ? 1 : leapMode === 'split-15' && lunar.getDay() > 15 ? 1 : 0)
      : 0;
    const monthOffset = Math.abs(rawMonth) - 1 + fixLeapOffset;
    const startStem = TIGER_RULE[yearly[0]];
    const stem = HEAVENLY_STEMS[fixIndex(HEAVENLY_STEMS.indexOf(startStem) + monthOffset, 10)];
    const branch = EARTHLY_BRANCHES[fixIndex(2 + monthOffset)];
    monthly = [stem, branch];
  }

  const daily = splitGanZhi(repPillars.day);
  const hourly = splitGanZhi(repPillars.hour);

  return { yearly, monthly, daily, hourly };
}

/** 宫位索引以寅宫为 0（丑宫为 11）。 */
export function earthlyBranchToPalaceIndex(branch: EarthlyBranch): number {
  return fixIndex(EARTHLY_BRANCHES.indexOf(branch) - EARTHLY_BRANCHES.indexOf('寅'));
}

/** 调整后的农历生月在十二宫的索引（正月在寅，即 0）。 */
export function fixLunarMonthIndex(
  date: SimpleSolarDate,
  timeIndex: number,
  leapMonthMode: LeapMonthMode | boolean,
): number {
  const mode: LeapMonthMode = typeof leapMonthMode === 'boolean' ? (leapMonthMode ? 'split-15' : 'same') : leapMonthMode;
  const lunar = solarToLunarInfo(date);
  const offset = resolveLeapMonthOffset(lunar, timeIndex, mode);
  return fixIndex(lunar.lunarMonth - 1 + offset);
}
