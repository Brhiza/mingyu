import {
  daysInSolarMonth,
  getBirthDateValidationMessage,
  isValidClockTime,
} from './date-validation';

export type ValidationResult = { ok: true } | { ok: false; field: string; message: string };

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function clampNumericField(
  key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute',
  value: string,
): string {
  if (value === '') return '';
  if (!/^\d*$/.test(value)) return value;

  switch (key) {
    case 'year':
      return value.slice(0, 4);
    case 'month':
    case 'day':
    case 'birthHour':
    case 'birthMinute':
      return value.slice(0, 2);
    default:
      return value;
  }
}

export interface BirthInputFields {
  year: string;
  month: string;
  day: string;
  isLeapMonth?: boolean;
  dateType?: 'solar' | 'lunar';
  useTrueSolarTime?: boolean;
  birthHour?: string;
  birthMinute?: string;
  birthLongitude?: string;
}

export function validateBirthInput(
  fields: BirthInputFields,
  personLabel: string,
): ValidationResult {
  const yearNum = Number(fields.year);
  const monthNum = Number(fields.month);
  const dayNum = Number(fields.day);

  if (!Number.isInteger(yearNum) || yearNum < MIN_YEAR || yearNum > MAX_YEAR) {
    return {
      ok: false,
      field: 'year',
      message: `${personLabel}年份需在 ${MIN_YEAR}-${MAX_YEAR} 之间`,
    };
  }

  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    return {
      ok: false,
      field: 'month',
      message: `${personLabel}月份需在 1-12 之间`,
    };
  }

  if (fields.dateType === 'lunar') {
    const validationMessage = getBirthDateValidationMessage({
      year: yearNum,
      month: monthNum,
      day: dayNum,
      dateType: 'lunar',
      isLeapMonth: fields.isLeapMonth,
    });

    if (validationMessage) {
      return {
        ok: false,
        field: 'day',
        message: `${personLabel}${validationMessage.replace(/。$/, '')}`,
      };
    }
  } else {
    const maxDay = daysInSolarMonth(yearNum, monthNum);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > maxDay) {
      return {
        ok: false,
        field: 'day',
        message: `${personLabel}日期需在 1-${maxDay} 之间`,
      };
    }
  }

  if (fields.useTrueSolarTime) {
    const hourNum = Number(fields.birthHour);
    const minuteNum = Number(fields.birthMinute);

    if (
      fields.birthHour !== undefined &&
      fields.birthHour !== '' &&
      (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23)
    ) {
      return {
        ok: false,
        field: 'birthHour',
        message: `${personLabel}小时需在 0-23 之间`,
      };
    }

    if (
      fields.birthMinute !== undefined &&
      fields.birthMinute !== '' &&
      (!Number.isInteger(minuteNum) || minuteNum < 0 || minuteNum > 59)
    ) {
      return {
        ok: false,
        field: 'birthMinute',
        message: `${personLabel}分钟需在 0-59 之间`,
      };
    }

    if (fields.birthLongitude !== undefined && fields.birthLongitude !== '') {
      const longitudeNum = Number(fields.birthLongitude);
      if (!Number.isFinite(longitudeNum) || longitudeNum < -180 || longitudeNum > 180) {
        return {
          ok: false,
          field: 'birthLongitude',
          message: `${personLabel}经度需在 -180 到 180 之间`,
        };
      }
    }
  }

  return { ok: true };
}

export function isValidHourMinute(hour: number, minute: number): boolean {
  return isValidClockTime(hour, minute);
}
