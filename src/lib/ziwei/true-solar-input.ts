import { calculateTrueSolarTime } from '../../utils/bazi/trueSolarTime';
import { getTimeIndexFromClock } from '../../utils/dateUtils';
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

  const year = Number(input.year);
  const month = Number(input.month);
  const day = Number(input.day);
  const birthHour = Number(input.birthHour);
  const birthMinute = Number(input.birthMinute);
  const birthLongitude = Number(input.birthLongitude);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(birthHour) ||
    Number.isNaN(birthMinute) ||
    Number.isNaN(birthLongitude)
  ) {
    throw new Error('真太阳时缺少精准时间或经度。');
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
