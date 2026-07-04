import test from 'node:test';
import assert from 'node:assert/strict';

import type { LuckCycle, SolarDateTimeInfo } from '@core/bazi/baziTypes';
import {
  formatSolarDateTime,
  getLuckCycleForDate,
  isDateWithinLuckCycle,
  shiftSolarDateTimeYears,
  toNativeDate,
} from '@core/bazi/luckTiming';

const validSolarTime: SolarDateTimeInfo = {
  year: 2026,
  month: 2,
  day: 28,
  hour: 12,
  minute: 30,
  second: 0,
};

const validCycle: LuckCycle = {
  age: 1,
  year: 2026,
  ganZhi: '甲子',
  isXiaoyun: false,
  type: '大运',
  startSolarTime: {
    year: 2026,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  },
  endSolarTime: {
    year: 2036,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  },
  years: [],
};

test('大运时间转换应拒绝无效 Date 和不存在的公历日期', () => {
  assert.throws(() => toNativeDate(new Date(Number.NaN)), /时间不是有效日期/);
  assert.throws(() => toNativeDate({ ...validSolarTime, day: 31 }), /日期需在 1-28 之间/);
  assert.throws(() => toNativeDate({ ...validSolarTime, month: 13 }), /月份需在 1-12 之间/);
});

test('大运年份平移应先校验日期并正确夹紧闰年月底', () => {
  assert.deepEqual(
    shiftSolarDateTimeYears({ year: 2024, month: 2, day: 29, hour: 12, minute: 0, second: 0 }, 1),
    { year: 2025, month: 2, day: 28, hour: 12, minute: 0, second: 0 },
  );

  assert.throws(
    () => shiftSolarDateTimeYears({ ...validSolarTime, day: 31 }, 1),
    /日期需在 1-28 之间/,
  );
  assert.throws(() => shiftSolarDateTimeYears(validSolarTime, Number.NaN), /位移年份需为整数/);
});

test('大运周期匹配应拒绝无效参考时间', () => {
  const invalidDate = new Date(Number.NaN);

  assert.throws(() => isDateWithinLuckCycle(validCycle, invalidDate), /参考时间不是有效日期/);
  assert.throws(() => getLuckCycleForDate([validCycle], invalidDate), /参考时间不是有效日期/);
});

test('大运时间格式化应拒绝无效时间字段', () => {
  assert.equal(formatSolarDateTime(validSolarTime, true), '2026年2月28日 12:30');
  assert.throws(
    () => formatSolarDateTime({ ...validSolarTime, month: 13 }, true),
    /月份需在 1-12 之间/,
  );
  assert.throws(
    () => formatSolarDateTime({ ...validSolarTime, hour: 24 }, true),
    /小时需在 0-23 之间/,
  );
});
