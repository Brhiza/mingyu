import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveZiweiTrueSolarBirth } from '../src/lib/ziwei/true-solar-input';
import {
  calculateEquationOfTimeMinutes,
  calculateTrueSolarTime,
} from '../src/utils/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';

test('紫微真太阳时排盘应改用修正后的公历日期与时辰', () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 1990,
      month: 4,
      day: 15,
      hour: 1,
      minute: 20,
    },
    73.5,
  ).correctedTime;

  const result = resolveZiweiTrueSolarBirth({
    dateType: 'solar',
    year: '1990',
    month: '04',
    day: '15',
    isLeapMonth: false,
    birthHour: '1',
    birthMinute: '20',
    birthLongitude: '73.5',
  });

  assert.equal(
    result.birthDate,
    `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')}`,
  );
  assert.equal(result.birthTimeIndex, getTimeIndexFromClock(corrected.hour, corrected.minute));
});

test('紫微真太阳时缺少经度时应直接报错', () => {
  assert.throws(
    () =>
      resolveZiweiTrueSolarBirth({
        dateType: 'solar',
        year: '1990',
        month: '04',
        day: '15',
        isLeapMonth: false,
        birthHour: '1',
        birthMinute: '20',
        birthLongitude: '',
      }),
    /真太阳时缺少精准时间或经度/,
  );
});

test('紫微真太阳时应先拒绝无效出生日期和时空参数', () => {
  const baseInput = {
    dateType: 'solar' as const,
    year: '1990',
    month: '04',
    day: '15',
    isLeapMonth: false,
    birthHour: '1',
    birthMinute: '20',
    birthLongitude: '73.5',
  };
  const invalidCases: Array<[Partial<typeof baseInput>, RegExp]> = [
    [{ year: '0000' }, /出生年份需在 1900-2100 之间/],
    [{ year: '9999' }, /出生年份需在 1900-2100 之间/],
    [{ month: '13' }, /出生月份需在 1-12 之间/],
    [{ day: '31', month: '02' }, /日期需在 1-28 之间/],
    [{ birthHour: '24' }, /出生小时需在 0-23 之间/],
    [{ birthMinute: '60' }, /出生分钟需在 0-59 之间/],
    [{ birthLongitude: '181' }, /出生经度需在 -180 到 180 之间/],
  ];

  for (const [overrides, messagePattern] of invalidCases) {
    assert.throws(() => resolveZiweiTrueSolarBirth({ ...baseInput, ...overrides }), messagePattern);
  }
});

test('真太阳时计算应拒绝无效日期和时空参数', () => {
  const baseTime = {
    year: 2026,
    month: 2,
    day: 28,
    hour: 1,
    minute: 20,
  };
  const invalidCases: Array<[Parameters<typeof calculateTrueSolarTime>[0], number, RegExp]> = [
    [{ ...baseTime, year: 1899 }, 73.5, /年份需在 1900-2100 之间/],
    [{ ...baseTime, month: 13 }, 73.5, /月份需在 1-12 之间/],
    [{ ...baseTime, day: 31 }, 73.5, /日期需在 1-28 之间/],
    [{ ...baseTime, hour: 24 }, 73.5, /小时需在 0-23 之间/],
    [{ ...baseTime, minute: 60 }, 73.5, /分钟需在 0-59 之间/],
    [baseTime, 181, /经度需在 -180 到 180 之间/],
  ];

  for (const [standardTime, longitude, messagePattern] of invalidCases) {
    assert.throws(() => calculateTrueSolarTime(standardTime, longitude), messagePattern);
  }
});

test('均时差计算应拒绝无效日期', () => {
  assert.throws(() => calculateEquationOfTimeMinutes(2026, 2, 31), /日期需在 1-28 之间/);
});
