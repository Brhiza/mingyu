import { daysInSolarMonth, getBirthDateValidationMessage, isValidClockTime } from '../calendar';

export type BirthInputText = string | number | undefined;

export interface BirthInputFields {
  year: BirthInputText;
  month: BirthInputText;
  day: BirthInputText;
  isLeapMonth?: boolean;
  dateType?: 'solar' | 'lunar';
  useTrueSolarTime?: boolean;
  birthHour?: BirthInputText;
  birthMinute?: BirthInputText;
  birthLongitude?: BirthInputText;
}

export type BirthInputValidationResult =
  { ok: true } | { ok: false; field: keyof BirthInputFields | string; message: string };

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function toNumber(value: BirthInputText) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
}

/** 表单使用的纯数字字段截断规则；不会修改原字符串，也不负责 UI 状态。 */
export function clampNumericField(
  key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute',
  value: string,
) {
  if (value === '' || !/^\d*$/.test(value)) return value;
  return key === 'year' ? value.slice(0, 4) : value.slice(0, 2);
}

function invalid(field: string, message: string): BirthInputValidationResult {
  return { ok: false, field, message };
}

/**
 * 校验可来自 JSON 或表单的出生日期资料。
 * 该函数只返回首个字段错误，不依赖 React，也不改变传入对象。
 */
export function validateBirthInput(
  fields: BirthInputFields,
  personLabel = '出生资料',
): BirthInputValidationResult {
  const year = toNumber(fields.year);
  const month = toNumber(fields.month);
  const day = toNumber(fields.day);
  const dateType = fields.dateType ?? 'solar';

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return invalid('year', `${personLabel}年份需在 ${MIN_YEAR}-${MAX_YEAR} 之间`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return invalid('month', `${personLabel}月份需在 1-12 之间`);
  }

  if (dateType === 'lunar') {
    const message = getBirthDateValidationMessage({
      year,
      month,
      day,
      dateType,
      isLeapMonth: fields.isLeapMonth,
    });
    if (message) return invalid('day', `${personLabel}${message.replace(/。$/, '')}`);
  } else {
    const maxDay = daysInSolarMonth(year, month);
    if (!Number.isInteger(day) || day < 1 || day > maxDay) {
      return invalid('day', `${personLabel}日期需在 1-${maxDay} 之间`);
    }
  }

  if (fields.useTrueSolarTime) {
    const hour = toNumber(fields.birthHour);
    const minute = toNumber(fields.birthMinute);
    if (fields.birthHour !== undefined && fields.birthHour !== '') {
      if (!Number.isInteger(hour)) {
        return invalid('birthHour', `${personLabel}小时需为整数`);
      }
      if (hour < 0 || hour > 23) {
        return invalid('birthHour', `${personLabel}小时需在 0-23 之间`);
      }
    }
    if (fields.birthMinute !== undefined && fields.birthMinute !== '') {
      if (!Number.isInteger(minute)) {
        return invalid('birthMinute', `${personLabel}分钟需为整数`);
      }
      if (minute < 0 || minute > 59) {
        return invalid('birthMinute', `${personLabel}分钟需在 0-59 之间`);
      }
    }
    if (
      fields.birthHour !== undefined &&
      fields.birthHour !== '' &&
      fields.birthMinute !== undefined &&
      fields.birthMinute !== '' &&
      !isValidClockTime(hour, minute)
    ) {
      return invalid('birthHour', `${personLabel}时间需在 00:00-23:59 之间`);
    }
    if (fields.birthLongitude !== undefined && fields.birthLongitude !== '') {
      const longitude = toNumber(fields.birthLongitude);
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return invalid('birthLongitude', `${personLabel}经度需在 -180 到 180 之间`);
      }
    }
  }

  return { ok: true };
}
