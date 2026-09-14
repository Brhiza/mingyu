import { getBirthDateValidationMessage } from '../calendar/date-validation';
import { getTimeIndexFromClock } from '../calendar/dateUtils';
import { baziCalculator } from './baziCalculator';
import type { BaziChartResult, Person } from './baziTypes';
import type { ShenShaScope } from './baziShenSha/scope';

export type BaziInputText = string | number;

/** 面向 JSON、表单和服务端请求的八字出生资料草稿。 */
export interface BaziChartInputDraft {
  gender: 'male' | 'female' | '';
  year: BaziInputText;
  month: BaziInputText;
  day: BaziInputText;
  timeIndex: number | '';
  dateType?: 'solar' | 'lunar';
  isLeapMonth?: boolean;
  useTrueSolarTime?: boolean;
  birthHour?: BaziInputText;
  birthMinute?: BaziInputText;
  /** useTrueSolarTime=false 时可用来表达精确到秒的标准北京时间。 */
  birthSecond?: BaziInputText;
  birthPlace?: string;
  birthLongitude?: BaziInputText;
  timezone?: number;
  timeZoneId?: string;
  applyChinaDst?: boolean;
  age?: number;
  shenShaScope?: ShenShaScope;
}

function readInteger(value: BaziInputText | undefined, label: string): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`${label}必须是整数。`);
    return value;
  }
  const text = value?.trim() ?? '';
  if (!/^\d+$/.test(text)) throw new Error(`${label}必须是整数。`);
  return Number(text);
}

function readIntegerInRange(
  value: BaziInputText | undefined,
  label: string,
  min: number,
  max: number,
) {
  const parsed = readInteger(value, label);
  if (parsed < min || parsed > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间。`);
  }
  return parsed;
}

function readLongitude(value: BaziInputText | undefined) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < -180 || value > 180) {
      throw new Error('出生经度需在 -180 到 180 之间。');
    }
    return value;
  }
  const text = value?.trim() ?? '';
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error('出生经度必须是数字。');
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
    throw new Error('出生经度需在 -180 到 180 之间。');
  }
  return parsed;
}

/** 将普通 JSON 或页面表单值转换为严格的八字 Person 输入。 */
export function buildBaziPersonInput(input: BaziChartInputDraft): Person {
  const year = readInteger(input.year, '出生年份');
  const month = readInteger(input.month, '出生月份');
  const day = readInteger(input.day, '出生日期');
  const dateType = input.dateType ?? 'solar';
  const isLeapMonth = input.isLeapMonth ?? false;
  const useTrueSolarTime = input.useTrueSolarTime ?? false;

  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType,
    isLeapMonth,
  });
  if (validationMessage) throw new Error(validationMessage);

  const hasPreciseStandardTime =
    !useTrueSolarTime && input.birthSecond !== undefined && input.birthSecond !== '';
  if (!useTrueSolarTime && input.timeIndex === '' && !hasPreciseStandardTime) {
    throw new Error('请选择出生时辰。');
  }

  const birthHour =
    useTrueSolarTime || hasPreciseStandardTime
      ? readIntegerInRange(input.birthHour, '出生小时', 0, 23)
      : undefined;
  const birthMinute =
    useTrueSolarTime || hasPreciseStandardTime
      ? readIntegerInRange(input.birthMinute, '出生分钟', 0, 59)
      : undefined;
  const birthSecond =
    input.birthSecond === undefined || input.birthSecond === ''
      ? undefined
      : readIntegerInRange(input.birthSecond, '出生秒数', 0, 59);
  const timeIndex = useTrueSolarTime
    ? 0
    : hasPreciseStandardTime
      ? getTimeIndexFromClock(birthHour!, birthMinute!)
      : input.timeIndex !== ''
        ? readIntegerInRange(input.timeIndex, '出生时辰', 0, 12)
        : getTimeIndexFromClock(birthHour!, birthMinute!);
  if (!useTrueSolarTime && timeIndex < 0) {
    throw new Error('标准北京时间无法换算为有效时辰。');
  }
  const birthLongitude = useTrueSolarTime ? readLongitude(input.birthLongitude) : undefined;

  return {
    year,
    month,
    day,
    timeIndex,
    gender: input.gender,
    isLunar: dateType === 'lunar',
    isLeapMonth,
    useTrueSolarTime,
    birthHour,
    birthMinute,
    ...(birthSecond === undefined ? {} : { birthSecond }),
    birthPlace: input.birthPlace?.trim() || undefined,
    birthLongitude,
    timezone: input.timezone,
    ...(input.timeZoneId ? { timeZoneId: input.timeZoneId } : {}),
    applyChinaDst: input.applyChinaDst,
    age: input.age,
    ...(input.shenShaScope ? { shenShaScope: input.shenShaScope } : {}),
  };
}

/** 直接从普通 JSON/表单输入完成八字排盘。 */
export function calculateBaziChartFromInput(input: BaziChartInputDraft): BaziChartResult {
  return baziCalculator.calculateBazi(buildBaziPersonInput(input));
}
