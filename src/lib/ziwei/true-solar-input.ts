import { calculateTrueSolarTime } from '../../utils/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { getBirthDateValidationMessage } from '../date-validation';
import { LunarHour, SolarTime } from 'tyme4ts';

export type ZiweiTrueSolarInput = {
  dateType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  isLeapMonth: boolean;
  birthHour: string;
  birthMinute: string;
  birthLongitude: string;
};

function formatZiweiBirthDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function readIntegerText(value: string, label: string) {
  const text = value.trim();
  if (!text || !/^\d+$/.test(text)) {
    throw new Error(`${label}必须是整数。`);
  }
  return Number(text);
}

function readNumberText(value: string, label: string) {
  const text = value.trim();
  if (!text || !/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error(`${label}必须是数字。`);
  }
  return Number(text);
}

export function resolveZiweiTrueSolarBirth(input: ZiweiTrueSolarInput) {
  if (
    !input.year.trim() ||
    !input.month.trim() ||
    !input.day.trim() ||
    !input.birthHour.trim() ||
    !input.birthMinute.trim() ||
    !input.birthLongitude.trim()
  ) {
    throw new Error('真太阳时缺少精准时间或经度。');
  }

  const year = readIntegerText(input.year, '出生年份');
  const month = readIntegerText(input.month, '出生月份');
  const day = readIntegerText(input.day, '出生日期');
  const birthHour = readIntegerText(input.birthHour, '出生小时');
  const birthMinute = readIntegerText(input.birthMinute, '出生分钟');
  const birthLongitude = readNumberText(input.birthLongitude, '出生经度');

  if (year < 1900 || year > 2100) {
    throw new Error('出生年份需在 1900-2100 之间。');
  }
  if (month < 1 || month > 12) {
    throw new Error('出生月份需在 1-12 之间。');
  }
  if (day < 1) {
    throw new Error('出生日期不能小于 1。');
  }
  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType: input.dateType,
    isLeapMonth: input.isLeapMonth,
  });
  if (validationMessage) {
    throw new Error(validationMessage);
  }
  if (birthHour < 0 || birthHour > 23) {
    throw new Error('出生小时需在 0-23 之间。');
  }
  if (birthMinute < 0 || birthMinute > 59) {
    throw new Error('出生分钟需在 0-59 之间。');
  }
  if (birthLongitude < -180 || birthLongitude > 180) {
    throw new Error('出生经度需在 -180 到 180 之间。');
  }

  const solarTime =
    input.dateType === 'lunar'
      ? LunarHour.fromYmdHms(
          year,
          input.isLeapMonth ? -Math.abs(month) : month,
          day,
          birthHour,
          birthMinute,
          0,
        ).getSolarTime()
      : SolarTime.fromYmdHms(year, month, day, birthHour, birthMinute, 0);

  const corrected = calculateTrueSolarTime(
    {
      year: solarTime.getYear(),
      month: solarTime.getMonth(),
      day: solarTime.getDay(),
      hour: solarTime.getHour(),
      minute: solarTime.getMinute(),
    },
    birthLongitude,
  ).correctedTime;

  const birthTimeIndex = getTimeIndexFromClock(corrected.hour, corrected.minute);
  if (birthTimeIndex < 0) {
    throw new Error('无法根据真太阳时确定时辰。');
  }

  return {
    birthDate: formatZiweiBirthDate(corrected.year, corrected.month, corrected.day),
    birthTimeIndex,
  };
}
