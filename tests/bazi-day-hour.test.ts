import assert from 'node:assert/strict';
import test from 'node:test';
import { civilDayHour } from '../src/systems/bazi/civil-day-hour';
import { getDivinationTime } from '../src/systems/calendar';
import { getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';

test('1900—2100 年各月及早晚子时的日、时干支与历法入口一致', () => {
  for (let year = 1900; year <= 2100; year++) for (let month = 1; month <= 12; month++) for (const hour of [0, 1, 12, 22, 23]) {
    const timestamp = Date.UTC(year, month - 1, 15, hour, 42, 30);
    const wall = getCivilDateTimeAtFixedOffset(new Date(timestamp), 0);
    const expected = getDivinationTime(new Date(timestamp), 0).ganzhi;
    assert.deepEqual(civilDayHour(wall), { day: expected.day, hour: expected.hour }, `${year}/${month}/${hour}`);
  }
});

test('跨日与非整小时时区沿用当地钟表，晚子与次日早子一致', () => {
  for (const timestamp of [Date.parse('2024-02-04T15:59:59Z'), Date.parse('2024-12-31T23:59:59Z')]) {
    for (const minutes of [-720, -300, 0, 345, 840]) {
      const wall = getCivilDateTimeAtFixedOffset(new Date(timestamp), minutes / 60);
      const expected = getDivinationTime(new Date(timestamp), minutes).ganzhi;
      assert.deepEqual(civilDayHour(wall), { day: expected.day, hour: expected.hour }, `${timestamp}/${minutes}`);
    }
  }
  assert.deepEqual(civilDayHour({ year: 2024, month: 12, day: 31, hour: 23 }), civilDayHour({ year: 2025, month: 1, day: 1, hour: 0 }));
});
