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

test('大运周期只按精确起止时刻定位，不按年份回退且重叠时失败关闭', () => {
  const secondCycle: LuckCycle = {
    ...validCycle,
    age: 11,
    year: 2036,
    startSolarTime: { ...validCycle.endSolarTime! },
    endSolarTime: { ...validCycle.endSolarTime!, year: 2046 },
  };

  for (let year = 2026; year < 2046; year += 1) {
    const expected = year < 2036 ? validCycle : secondCycle;
    for (let month = 0; month < 12; month += 1) {
      assert.equal(
        getLuckCycleForDate([validCycle, secondCycle], new Date(year, month, 15)),
        expected,
      );
    }
  }

  const gapCycle = {
    ...validCycle,
    startSolarTime: { ...validCycle.startSolarTime!, month: 2 },
  };
  const cycleWithoutStart: LuckCycle = { ...validCycle };
  delete cycleWithoutStart.startSolarTime;
  assert.equal(getLuckCycleForDate([gapCycle], new Date(2026, 0, 15)), null);
  assert.throws(
    () => isDateWithinLuckCycle(cycleWithoutStart, new Date(2026, 0, 1)),
    /缺少精确起止时刻/,
  );
  assert.throws(
    () => getLuckCycleForDate([validCycle, { ...validCycle, age: 2 }], new Date(2027, 0, 1)),
    /互相重叠/,
  );
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
