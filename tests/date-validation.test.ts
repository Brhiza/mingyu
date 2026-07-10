import test from 'node:test';
import assert from 'node:assert/strict';

import {
  daysInGregorianMonth,
  daysInSolarMonth,
  getBirthDateValidationMessage,
  isValidIsoDateTime,
} from '../src/lib/date-validation';

test('公历月份天数工具应拒绝越界年月', () => {
  assert.equal(daysInSolarMonth(2024, 2), 29);
  assert.equal(daysInSolarMonth(2026, 2), 28);
  assert.throws(() => daysInSolarMonth(1899, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => daysInSolarMonth(2101, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => daysInSolarMonth(2026, 0), /月份需在 1-12 之间/);
  assert.throws(() => daysInSolarMonth(2026, 13), /月份需在 1-12 之间/);
});

test('公历月份天数底层能力应支持七政等更宽年份范围', () => {
  assert.equal(daysInGregorianMonth(2200, 2), 28);
  assert.equal(daysInGregorianMonth(2000, 2), 29);
  assert.throws(() => daysInGregorianMonth(0, 1), /公历年份需在 1-9999 之间/);
});

test('出生日期校验文案应覆盖年月日基础边界', () => {
  assert.equal(
    getBirthDateValidationMessage({
      year: 2026,
      month: 1,
      day: 1,
      dateType: 'gregorian' as never,
    }),
    '日期类型必须是 solar 或 lunar。',
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 2026,
      month: 1,
      day: 1,
      dateType: 'lunar',
      isLeapMonth: 'false' as never,
    }),
    '闰月标志必须是布尔值。',
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 1899,
      month: 1,
      day: 1,
      dateType: 'solar',
    }),
    '年份需在 1900-2100 之间。',
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 2026,
      month: 13,
      day: 1,
      dateType: 'solar',
    }),
    '月份需在 1-12 之间。',
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 2026,
      month: 2,
      day: 0,
      dateType: 'solar',
    }),
    '日期需在 1-28 之间。',
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 2026,
      month: 1,
      day: 0,
      dateType: 'lunar',
    }),
    '农历日期需在 1-30 之间。',
  );
});

test('ISO 时间校验应拒绝非字符串和无效 Date，不应被隐式转换污染', () => {
  assert.equal(isValidIsoDateTime(20260201 as never, new Date('2026-02-01T00:00:00+08:00')), false);
  assert.equal(isValidIsoDateTime('2026-02-01T00:00:00+08:00', new Date(Number.NaN)), false);
});

test('出生日期校验应拒绝不存在的农历闰月和小月三十', () => {
  assert.equal(
    getBirthDateValidationMessage({
      year: 2023,
      month: 2,
      day: 1,
      dateType: 'lunar',
      isLeapMonth: true,
    }),
    undefined,
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 2024,
      month: 2,
      day: 1,
      dateType: 'lunar',
      isLeapMonth: true,
    }),
    '农历日期不存在，请检查月份、日期和闰月设置。',
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 2024,
      month: 1,
      day: 30,
      dateType: 'lunar',
    }),
    '农历日期不存在，请检查月份、日期和闰月设置。',
  );
  assert.equal(
    getBirthDateValidationMessage({
      year: 2024,
      month: 2,
      day: 30,
      dateType: 'lunar',
    }),
    undefined,
  );
});
