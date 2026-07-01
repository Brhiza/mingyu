import test from 'node:test';
import assert from 'node:assert/strict';

import { getDaysInMonth, getTimeIndexFromClock } from 'mingyu-core/calendar';

test('时辰索引工具应拒绝非法小时或分钟', () => {
  assert.equal(getTimeIndexFromClock(1, 30), 1);
  assert.equal(getTimeIndexFromClock(23, 0), 12);
  assert.equal(getTimeIndexFromClock(24, 0), 12);
  assert.equal(getTimeIndexFromClock(24, 1), -1);
  assert.equal(getTimeIndexFromClock(-1, 0), -1);
  assert.equal(getTimeIndexFromClock(12, 60), -1);
  assert.equal(getTimeIndexFromClock(12, -1), -1);
});

test('月份天数工具应拒绝无效年月', () => {
  assert.equal(getDaysInMonth(2024, 2), 29);
  assert.equal(getDaysInMonth(2026, 2), 28);
  assert.throws(() => getDaysInMonth(1899, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => getDaysInMonth(2101, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => getDaysInMonth(2026, 0), /月份需在 1-12 之间/);
  assert.throws(() => getDaysInMonth(2026, 13), /月份需在 1-12 之间/);
});
