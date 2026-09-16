import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiJingshi } from '@core/huangji-jingshi';
import { TimeManager } from '../packages/core/src/calendar/timeManager';

test('皇极公共整秒节气边界应按实际毫秒切换并计算满24小时日序', () => {
  const fixtures = [
    {
      at: '2025-12-21T23:03:05+08:00',
      term: '冬至',
      year: 2026,
      dayOfYear: 1,
    },
    {
      at: '2026-06-21T16:24:30+08:00',
      term: '夏至',
      year: 2026,
      dayOfYear: 181,
    },
    {
      at: '2024-02-19T12:13:12+08:00',
      term: '雨水',
      year: 2024,
      dayOfYear: 61,
    },
  ];

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  for (const fixture of fixtures) {
    const termDate = new Date(fixture.at);
    const before = calculateHuangjiJingshi({
      date: new Date(termDate.getTime() - 1),
    });
    const exact = calculateHuangjiJingshi({ date: termDate });
    const after = calculateHuangjiJingshi({
      date: new Date(termDate.getTime() + 1),
    });
    const beforeDayBoundary = calculateHuangjiJingshi({
      date: new Date(termDate.getTime() + millisecondsPerDay - 1),
    });
    const exactDayBoundary = calculateHuangjiJingshi({
      date: new Date(termDate.getTime() + millisecondsPerDay),
    });
    const afterDayBoundary = calculateHuangjiJingshi({
      date: new Date(termDate.getTime() + millisecondsPerDay + 1),
    });

    const exactCalendar = exact.dateTimeForecast!.calendar;
    const afterCalendar = after.dateTimeForecast!.calendar;
    assert.notEqual(before.dateTimeForecast!.calendar.activeSolarTerm, fixture.term);
    assert.equal(exactCalendar.activeSolarTerm, fixture.term);
    assert.equal(afterCalendar.activeSolarTerm, fixture.term);
    assert.equal(exactCalendar.actualDayInSolarTerm, 1);
    assert.equal(afterCalendar.actualDayInSolarTerm, 1);
    assert.equal(beforeDayBoundary.dateTimeForecast!.calendar.actualDayInSolarTerm, 1);
    assert.equal(exactDayBoundary.dateTimeForecast!.calendar.actualDayInSolarTerm, 2);
    assert.equal(afterDayBoundary.dateTimeForecast!.calendar.actualDayInSolarTerm, 2);
    assert.equal(exactCalendar.dayOfYear, fixture.dayOfYear);
    assert.equal(exactCalendar.forecastYear, fixture.year);
  }
});

test('皇极年月日时盘的时经卦按北京时间四小时段切换', () => {
  const before = calculateHuangjiJingshi({
    date: new Date('2026-06-21T15:59:59.999+08:00'),
  }).dateTimeForecast!.calendar;
  const at = calculateHuangjiJingshi({
    date: new Date('2026-06-21T16:00:00+08:00'),
  }).dateTimeForecast!.calendar;

  assert.equal(before.hourSegment, 4);
  assert.equal(before.hourRange, '12:00—16:00');
  assert.equal(at.hourSegment, 5);
  assert.equal(at.hourRange, '16:00—20:00');
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
