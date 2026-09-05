import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiJingshi } from '@core/huangji-jingshi';
import { TimeManager } from '../packages/core/src/calendar/timeManager';

test('皇极冬至和夏至交节秒应切换节气及相应皇极日序', () => {
  const fixtures = [
    {
      before: '2025-12-21T23:03:04+08:00',
      after: '2025-12-21T23:03:06+08:00',
      term: '冬至',
      year: 2026,
      day: 1,
    },
    {
      before: '2026-06-21T16:24:29+08:00',
      after: '2026-06-21T16:24:31+08:00',
      term: '夏至',
      year: 2026,
      day: 181,
    },
  ];
  for (const fixture of fixtures) {
    const before = calculateHuangjiJingshi({ date: new Date(fixture.before) });
    const after = calculateHuangjiJingshi({ date: new Date(fixture.after) });
    assert.notEqual(before.dateTimeForecast!.calendar.activeSolarTerm, fixture.term);
    assert.equal(after.dateTimeForecast!.calendar.activeSolarTerm, fixture.term);
    assert.equal(after.dateTimeForecast!.calendar.dayOfYear, fixture.day);
    assert.equal(after.dateTimeForecast!.calendar.forecastYear, fixture.year);
  }
});

test('皇极固定北京时间口径不随全局占卜时区覆盖改变', () => {
  const date = new Date('2025-12-21T23:03:06+08:00');
  const expected = calculateHuangjiJingshi({ date }).dateTimeForecast;
  try {
    TimeManager.setTimezoneOffsetMinutesOverride(0);
    assert.deepEqual(calculateHuangjiJingshi({ date }).dateTimeForecast, expected);
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});
