import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHuangjiJingshi,
  calculateHuangjiSixDayCycleFromDate,
  parseHuangjiSixDayDateTime,
} from '@core/huangji-jingshi';

test('六日逐爻以冬至真实瞬时建立公历锚点并保留旧坐标字段', () => {
  const result = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2025-12-21T23:03:05+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );

  assert.equal(result.model, '书绪言六日逐爻·公历定位');
  assert.equal(result.anchor.forecastYear, 2026);
  assert.equal(result.anchor.dateTime, '2025-12-21T23:03:05+08:00');
  assert.equal(result.anchor.utcDateTime, '2025-12-21T15:03:05.000Z');
  assert.equal(result.anchor.dayStartDateTime, '2025-12-21T00:00:00+08:00');
  assert.equal(result.anchor.dayStartUtcDateTime, '2025-12-20T16:00:00.000Z');
  assert.equal(result.anchor.dayBoundary, '当地子半');
  assert.equal(result.civilTime.utcDateTime, '2025-12-21T15:03:05.000Z');
  assert.equal(result.calendar.actualElapsedDays, 0);
  assert.equal(result.calendar.model, 'six-day-seven-part');
  assert.equal(result.calendar.mapping, 'solar-year-proportional');
  assert.equal(
    result.calendar.logicalElapsedDays,
    (result.elapsedDays - result.anchor.dayIndex + 360) % 360,
  );
  assert.equal(result.calendar.cycleDay, result.elapsedDays + 1);
  assert.equal(result.elapsedDays, result.anchor.dayIndex);
  assert.equal(result.dayOfCycle, result.elapsedDays + 1);
  assert.equal(result.hour, 23);
  assert.equal(result.hourRange, '20:00—24:00');
});

test('六日逐爻跨固定时区、IANA 夏令时与 UTC+14 保留真实瞬时及当地子半口径', () => {
  const beijing = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime('2026-07-01T16:00:00Z', undefined, undefined, 'six-day-seven-part'),
  );
  const newYork = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2026-07-01T12:00:00',
      undefined,
      'America/New_York',
      'six-day-seven-part',
    ),
  );
  const utcPlus14 = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2026-07-02T06:00:00+14:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );

  assert.equal(newYork.civilTime.timezone, -4);
  assert.equal(newYork.civilTime.utcDateTime, beijing.civilTime.utcDateTime);
  assert.equal(utcPlus14.civilTime.utcDateTime, beijing.civilTime.utcDateTime);
  assert.equal(newYork.calendar.mapping, 'solar-year-proportional');
  assert.equal(utcPlus14.calendar.mapping, 'solar-year-proportional');
  assert.equal(newYork.anchor.dayBoundary, '当地子半');
  assert.equal(utcPlus14.anchor.dayBoundary, '当地子半');
  assert.notEqual(newYork.civilTime.hour, beijing.civilTime.hour);
  assert.notEqual(utcPlus14.civilTime.day, beijing.civilTime.day);
});

test('六日七分按冬至子半至下一冬至子半实岁比例承载余分', () => {
  const leapDay = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2026-02-19T23:03:05+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );
  const nextLogicalDay = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2026-02-20T23:03:05+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );

  assert.equal(leapDay.calendar.actualElapsedDays, 60);
  assert.equal(
    leapDay.calendar.logicalElapsedDays,
    (leapDay.elapsedDays - leapDay.anchor.dayIndex + 360) % 360,
  );
  assert.ok(leapDay.calendar.yearLengthDays > 365 && leapDay.calendar.yearLengthDays < 367);
  assert.ok(leapDay.calendar.logicalDayFraction >= 0);
  assert.ok(leapDay.calendar.logicalDayFraction < 1);
  assert.equal(nextLogicalDay.calendar.actualElapsedDays, 61);
  assert.ok(nextLogicalDay.elapsedDays >= leapDay.elapsedDays);

  const springStart = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2026-03-22T23:03:05+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );
  assert.equal(springStart.calendar.actualElapsedDays, 91);
  assert.equal(
    springStart.calendar.cardinalSeason,
    ['冬', '春', '夏', '秋'][Math.floor(springStart.calendar.logicalElapsedDays / 90)],
  );
  assert.equal(
    springStart.calendar.cardinalDay,
    (springStart.calendar.logicalElapsedDays % 90) + 1,
  );
});

test('公历冬至换年后重新从新一轮六日逐爻坐标起算', () => {
  const before = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2026-12-21T12:00:00+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );
  const after = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2026-12-23T12:00:00+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );

  assert.equal(before.anchor.forecastYear, 2026);
  assert.equal(after.anchor.forecastYear, 2027);
  assert.ok(after.calendar.actualElapsedDays >= 0 && after.calendar.actualElapsedDays <= 2);
  assert.equal(
    after.calendar.logicalElapsedDays,
    (after.elapsedDays - after.anchor.dayIndex + 360) % 360,
  );
  assert.equal(after.dayOfCycle, after.elapsedDays + 1);
});

test('冬至当地日期内按真实节气瞬时切换皇极年，子半只负责公历日界', () => {
  const beforeTerm = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2025-12-21T12:00:00+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );
  const afterTerm = calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(
      '2025-12-22T00:00:00+08:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
  );

  assert.equal(beforeTerm.anchor.forecastYear, 2025);
  assert.equal(afterTerm.anchor.forecastYear, 2026);
  assert.equal(beforeTerm.anchor.dayStartDateTime, '2024-12-21T00:00:00+08:00');
  assert.equal(afterTerm.anchor.dayStartDateTime, '2025-12-21T00:00:00+08:00');
  assert.equal(beforeTerm.anchor.dayGanZhi, '己未');
  assert.equal(beforeTerm.anchor.dayIndex, 55);
});

test('六日逐爻公历输入进入皇极结果与自包含提示词', () => {
  const result = calculateHuangjiJingshi({
    sixDayDate: parseHuangjiSixDayDateTime(
      '2025-12-22T05:03:05+14:00',
      undefined,
      undefined,
      'six-day-seven-part',
    ),
    question: '此时的主要变化是什么？',
  });

  assert.equal(result.input.mode, '六日逐爻公历');
  assert.equal(result.sixDayCycle?.civilTime.timezone, 14);
  assert.match(result.prompt, /六日逐爻公历时间：2025-12-22T05:03:05\+14:00/);
  assert.match(result.prompt, /每六日一经卦、每日一爻、每四小时一爻/);
  assert.match(result.prompt, /【问题】\n此时的主要变化是什么？/);
});

test('六日逐爻拒绝没有时区依据或互相矛盾的公历输入', () => {
  assert.throws(
    () =>
      calculateHuangjiSixDayCycleFromDate(
        parseHuangjiSixDayDateTime(
          '2025-12-21T23:03:05',
          undefined,
          undefined,
          'six-day-seven-part',
        ),
      ),
    /timezone 与 timeZoneId 至少需要提供一项/,
  );
  assert.throws(
    () =>
      parseHuangjiSixDayDateTime('2025-12-21T23:03:05+08:00', 9, undefined, 'six-day-seven-part'),
    /时区偏移与 timezone 不一致/,
  );
  assert.throws(
    () =>
      calculateHuangjiJingshi({
        sixDayDate: parseHuangjiSixDayDateTime(
          '2025-12-21T23:03:05+08:00',
          undefined,
          undefined,
          'six-day-seven-part',
        ),
        year: 2026,
      }),
    /不得同时提供/,
  );
});
