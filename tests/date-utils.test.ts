import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHICHEN_PERIODS,
  daysInSolarMonth,
  getDaysInMonth,
  getShichenByIndex,
  getShichenFromClock,
  getTimeIndexFromClock,
} from 'mingyu-core/calendar';
import { getFoundationCapabilities } from 'mingyu-core/foundation';

test('时辰索引工具应拒绝非法小时或分钟', () => {
  const initialFoundation = getFoundationCapabilities();
  const initialShichen = SHICHEN_PERIODS.map((period) => ({ ...period }));
  assert.equal(getTimeIndexFromClock(1, 30), 1);
  assert.equal(getTimeIndexFromClock(23, 0), 12);
  assert.equal(getTimeIndexFromClock(24, 0), 12);
  assert.equal(getTimeIndexFromClock(24, 1), -1);
  assert.equal(getTimeIndexFromClock(-1, 0), -1);
  assert.equal(getTimeIndexFromClock(12, 60), -1);
  assert.equal(getTimeIndexFromClock(12, -1), -1);
  assert.equal(SHICHEN_PERIODS.length, 13);
  assert.deepEqual(
    SHICHEN_PERIODS.map((period) => [period.name, period.hour, period.minute]),
    [
      ['早子时', 0, 30],
      ['丑时', 2, 0],
      ['寅时', 4, 0],
      ['卯时', 6, 0],
      ['辰时', 8, 0],
      ['巳时', 10, 0],
      ['午时', 12, 0],
      ['未时', 14, 0],
      ['申时', 16, 0],
      ['酉时', 18, 0],
      ['戌时', 20, 0],
      ['亥时', 22, 0],
      ['晚子时', 23, 30],
    ],
  );
  assert.equal(getShichenFromClock(23, 30)?.name, '晚子时');
  assert.equal(getShichenFromClock(3, 0)?.branch, '寅');
  assert.equal(getShichenByIndex(0)?.name, '早子时');
  assert.equal(getShichenByIndex(13), null);

  const earlyZi = {
    index: 0,
    branch: '子',
    name: '早子时',
    range: '00:00-01:00',
    hour: 0,
    minute: 30,
  };
  const indexed = getShichenByIndex(0)!;
  Object.assign(indexed, { index: 12, branch: '午', name: '本次备注', hour: 12, minute: 0 });
  assert.deepEqual(getShichenByIndex(0), earlyZi);
  assert.deepEqual(getShichenFromClock(0, 0), earlyZi);
  assert.deepEqual(SHICHEN_PERIODS[0], earlyZi);

  const lateZi = getShichenFromClock(23, 0)!;
  lateZi.name = '另一次备注';
  assert.deepEqual(getShichenByIndex(12), {
    index: 12,
    branch: '子',
    name: '晚子时',
    range: '23:00-24:00',
    hour: 23,
    minute: 30,
  });
  assert.equal(getShichenFromClock(24, 0)?.name, '晚子时');

  assert.equal(Object.isFrozen(SHICHEN_PERIODS), true);
  assert.equal(Reflect.set(SHICHEN_PERIODS, '0', SHICHEN_PERIODS[12]), false);
  assert.throws(() => (SHICHEN_PERIODS as unknown as unknown[]).reverse(), TypeError);
  for (const period of SHICHEN_PERIODS) {
    assert.equal(Object.isFrozen(period), true);
    assert.equal(Reflect.set(period, 'hour', period.hour + 1), false);
    assert.deepEqual(
      initialShichen.map((_, index) => getShichenByIndex(index)),
      initialShichen,
    );
    assert.deepEqual(getFoundationCapabilities(), initialFoundation);
  }
  const publicCopy = getFoundationCapabilities();
  publicCopy.constants.shichenPeriods.reverse();
  publicCopy.constants.shichenPeriods[0].hour = 12;
  assert.deepEqual(getFoundationCapabilities(), initialFoundation);
});

test('月份天数工具应拒绝无效年月', () => {
  assert.equal(getDaysInMonth, daysInSolarMonth);
  assert.equal(getDaysInMonth(2024, 2), 29);
  assert.equal(getDaysInMonth(2026, 2), 28);
  assert.throws(() => getDaysInMonth(1899, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => getDaysInMonth(2101, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => getDaysInMonth(2026, 0), /月份需在 1-12 之间/);
  assert.throws(() => getDaysInMonth(2026, 13), /月份需在 1-12 之间/);
});
