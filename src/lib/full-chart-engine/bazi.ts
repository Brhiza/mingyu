import { baziCalculator } from '@core/bazi/baziCalculator';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { Person } from '@/composables/useFormState';

function readInteger(value: string | number, label: string) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`${label}必须是整数。`);
    }
    return value;
  }

  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}必须是整数。`);
  }
  return Number(text);
}

function readIntegerInRange(value: string | number, label: string, min: number, max: number) {
  const parsed = readInteger(value, label);
  if (parsed < min || parsed > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间。`);
  }
  return parsed;
}

function readLongitude(value: string) {
  const text = value.trim();
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error('出生经度必须是数字。');
  }

  const parsed = Number(text);
  if (parsed < -180 || parsed > 180) {
    throw new Error('出生经度需在 -180 到 180 之间。');
  }
  return parsed;
}

export function buildPersonFromInput(input: {
  gender: 'male' | 'female';
  year: string;
  month: string;
  day: string;
  timeIndex: number | '';
  dateType: 'solar' | 'lunar';
  isLeapMonth: boolean;
  useTrueSolarTime: boolean;
  birthHour: string;
  birthMinute: string;
  birthPlace: string;
  birthLongitude: string;
}): Person {
  const year = readInteger(input.year, '出生年份');
  const month = readInteger(input.month, '出生月份');
  const day = readInteger(input.day, '出生日期');

  if (!input.useTrueSolarTime && input.timeIndex === '') {
    throw new Error('请选择出生时辰。');
  }

  const timeIndex = input.useTrueSolarTime
    ? 0
    : readIntegerInRange(input.timeIndex, '出生时辰', 0, 12);
  const birthHour = input.useTrueSolarTime
    ? readIntegerInRange(input.birthHour, '出生小时', 0, 23)
    : undefined;
  const birthMinute = input.useTrueSolarTime
    ? readIntegerInRange(input.birthMinute, '出生分钟', 0, 59)
    : undefined;
  const birthLongitude = input.useTrueSolarTime ? readLongitude(input.birthLongitude) : undefined;

  return {
    name: '',
    gender: input.gender,
    year,
    month,
    day,
    timeIndex,
    isLunar: input.dateType === 'lunar',
    isLeapMonth: input.isLeapMonth,
    useTrueSolarTime: input.useTrueSolarTime,
    birthHour,
    birthMinute,
    birthPlace: input.useTrueSolarTime ? input.birthPlace : '',
    birthLongitude,
  };
}

export function calculateFullBaziChart(person: Person): BaziChartResult {
  return baziCalculator.calculateBazi({
    year: Number(person.year),
    month: Number(person.month),
    day: Number(person.day),
    timeIndex: person.timeIndex,
    gender: person.gender,
    isLunar: person.isLunar,
    isLeapMonth: person.isLeapMonth,
    useTrueSolarTime: person.useTrueSolarTime,
    birthHour: person.birthHour,
    birthMinute: person.birthMinute,
    birthPlace: person.birthPlace,
    birthLongitude: person.birthLongitude,
  });
}
