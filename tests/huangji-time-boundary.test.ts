import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiJingshi } from '@core/huangji-jingshi';
import { TimeManager } from '../packages/core/src/calendar/timeManager';
import { formatHuangjiInfo } from '../packages/core/src/prompt/divination-enhanced';
import { buildDivinationPrompt as buildCorePrompt } from '../packages/core/src/prompt/divination';
import { buildDivinationPrompt as buildAppPrompt } from '../src/lib/divination/engine';

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

test('皇极真太阳时跨冬至按实际瞬时定节气和年，仍按校正钟表定时段', () => {
  const actual = new Date('2025-12-21T23:03:04+08:00');
  const corrected = new Date('2025-12-22T00:03:06+08:00');
  const result = calculateHuangjiJingshi({
    date: corrected,
    termReferenceDate: actual,
  });
  const dateTime = result.dateTimeForecast!;
  assert.equal(dateTime.civilTime.dateTime, '2025-12-22 00:03:06');
  assert.equal(dateTime.civilTime.termReferenceDateTime, '2025-12-21 23:03:04');
  assert.equal(dateTime.calendar.forecastYear, 2025);
  assert.equal(dateTime.calendar.hourSegment, 1);
  assert.equal(
    dateTime.calendar.activeSolarTerm,
    calculateHuangjiJingshi({ date: actual }).dateTimeForecast?.calendar.activeSolarTerm,
  );
  assert.equal(result.input.year, 2025);
  assert.match(result.prompt, /节气与皇极年参照实际占时：2025-12-21 23:03:04/);
  for (const prompt of [
    formatHuangjiInfo(result),
    buildCorePrompt({
      method: 'huangji',
      data: result,
      question: '解读当前时点的时势。',
      currentTime: new Date('2026-10-03T12:00:00+08:00'),
    }),
    buildAppPrompt('huangji', '解读当前时点的时势。', result, undefined, {
      omitCurrentTime: true,
    }),
  ]) {
    assert.ok(prompt.includes('起盘时间：2025-12-22 00:03:06（北京时间（UTC+8））'));
    assert.equal(prompt.split('节气与皇极年参照实际占时：2025-12-21 23:03:04').length - 1, 1);
    assert.ok(prompt.includes('目标年份：公元2025年'));
  }
  assert.notEqual(calculateHuangjiJingshi({ date: corrected }).input.year, result.input.year);
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

test('皇极年月日时只查目标所需节气，避免历表边界预取越界', () => {
  const firstAvailable = calculateHuangjiJingshi({ date: new Date('0001-01-07T00:00:00Z') });
  assert.equal(firstAvailable.dateTimeForecast?.calendar.activeSolarTerm, '小寒');
  assert.equal(firstAvailable.dateTimeForecast?.calendar.forecastYear, 1);

  const lastYear = calculateHuangjiJingshi({ date: new Date('9999-12-31T00:00:00Z') });
  assert.equal(lastYear.dateTimeForecast?.calendar.activeSolarTerm, '冬至');
  assert.equal(lastYear.dateTimeForecast?.calendar.forecastYear, 10000);

  assert.throws(
    () => calculateHuangjiJingshi({ date: new Date('0001-01-01T00:00:00Z') }),
    /无法定位起盘时间所属的皇极节气/,
  );
});

test('皇极实际占时跨公历年界时只格式化参照时刻', () => {
  const result = calculateHuangjiJingshi({
    date: new Date('9999-12-31T15:30:00.000Z'),
    termReferenceDate: new Date('9999-12-31T16:30:00.000Z'),
  });
  const dateTime = result.dateTimeForecast!;

  assert.equal(dateTime.civilTime.dateTime, '9999-12-31 23:30:00');
  assert.equal(dateTime.civilTime.termReferenceDateTime, '10000-01-01 00:30:00');
  assert.equal(dateTime.calendar.forecastYear, 10000);
  assert.equal(dateTime.calendar.activeSolarTerm, '小寒');
  assert.equal(result.input.year, 10000);
});
