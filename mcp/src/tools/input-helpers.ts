import {
  daysInSolarMonth,
  getBirthDateValidationMessage,
  isValidIsoDateTime,
} from '../../../src/lib/date-validation.js';

import { MingyuCoreError } from 'mingyu-core/result';

type JsonRecord = Record<string, unknown>;

function invalidInput(field: string, message: string): never {
  throw new MingyuCoreError({
    code: 'INPUT_VALIDATION_FAILED',
    category: 'validation',
    field,
    message,
    recoverable: true,
  });
}

export function readMcpCustomDate(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !isValidIsoDateTime(value, date)) {
    invalidInput('customDate', 'customDate 不是有效时间。');
  }
  return date;
}

export function readMcpPositiveInteger(value: number | undefined, key: string) {
  if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) {
    invalidInput(key, `${key} 必须是正整数。`);
  }
  return value;
}

export function assertMcpRecord(value: unknown, key: string): asserts value is JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalidInput(key, `${key} 必须是对象。`);
  }
}

export function readMcpOptionalEnum<const T extends readonly string[]>(
  value: unknown,
  key: string,
  values: T,
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' && values.includes(value)) {
    return value;
  }
  invalidInput(key, `${key} 必须是以下值之一：${values.join('、')}。`);
}

export function readMcpIntegerLike(value: string | number | undefined, key: string) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      invalidInput(key, `${key} 必须是整数。`);
    }
    return value;
  }
  if (typeof value !== 'string' || !value.trim() || !/^\d+$/.test(value.trim())) {
    invalidInput(key, `${key} 必须是整数。`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    invalidInput(key, `${key} 必须是整数。`);
  }
  return parsed;
}

export function readMcpIntegerLikeInRange(
  value: string | number | undefined,
  key: string,
  min: number,
  max: number,
) {
  const parsed = readMcpIntegerLike(value, key);
  if (parsed < min) {
    invalidInput(key, `${key} 不能小于 ${min}。`);
  }
  if (parsed > max) {
    invalidInput(key, `${key} 不能大于 ${max}。`);
  }
  return parsed;
}

export function readMcpNumberLikeInRange(
  value: string | number | undefined,
  key: string,
  min: number,
  max: number,
) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    invalidInput(key, `${key} 必须是数字。`);
  }
  if (parsed < min) {
    invalidInput(key, `${key} 不能小于 ${min}。`);
  }
  if (parsed > max) {
    invalidInput(key, `${key} 不能大于 ${max}。`);
  }
  return parsed;
}

export function assertMcpBirthDate(params: {
  year: string | number;
  month: string | number;
  day: string | number;
  dateType: 'solar' | 'lunar';
  isLeapMonth?: boolean;
}) {
  const year = readMcpIntegerLike(params.year, 'year');
  const month = readMcpIntegerLike(params.month, 'month');
  const day = readMcpIntegerLike(params.day, 'day');

  if (year < 1900 || year > 2100) {
    invalidInput('year', 'year 不能小于 1900 或大于 2100。');
  }
  if (month < 1 || month > 12) {
    invalidInput('month', 'month 不能小于 1 或大于 12。');
  }
  if (day < 1) {
    invalidInput('day', 'day 不能小于 1。');
  }

  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType: params.dateType,
    isLeapMonth: params.isLeapMonth,
  });
  if (validationMessage) {
    invalidInput('day', validationMessage);
  }
}

export function assertMcpSolarBirthDate(params: {
  year: string | number;
  month: string | number;
  day: string | number;
}) {
  const year = readMcpIntegerLike(params.year, 'year');
  const month = readMcpIntegerLike(params.month, 'month');
  const day = readMcpIntegerLike(params.day, 'day');

  if (year < 1900 || year > 2100) {
    invalidInput('year', 'year 不能小于 1900 或大于 2100。');
  }
  if (month < 1 || month > 12) {
    invalidInput('month', 'month 不能小于 1 或大于 12。');
  }
  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    invalidInput('day', `日期需在 1-${maxDay} 之间。`);
  }
}

export function readMcpDateOnly(value: string, key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    invalidInput(key, `${key} 需要使用 YYYY-MM-DD 格式。`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) {
    invalidInput(key, `${key} 年份需在 1900-2100 之间。`);
  }
  if (month < 1 || month > 12) {
    invalidInput(key, `${key} 不是有效日期。`);
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    invalidInput(key, `${key} 不是有效日期。`);
  }

  return {
    value,
    date: new Date(Date.UTC(year, month - 1, day)),
  };
}

export function readMcpDateRange(startDate: string, endDate: string) {
  const start = readMcpDateOnly(startDate, 'startDate');
  const end = readMcpDateOnly(endDate, 'endDate');
  const diffDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);

  if (diffDays < 0) {
    invalidInput('endDate', 'endDate 不能早于 startDate。');
  }
  if (diffDays > 30) {
    throw new Error('黄历择日一次最多比较 31 天，请缩小日期范围。');
  }

  return {
    startDate: start.value,
    endDate: end.value,
  };
}
