import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHuangjiJingshi,
  calculateHuangjiSixDayCycleFromDate,
  parseHuangjiSixDayDateTime,
} from '@core/huangji-jingshi';

const MODEL = 'six-day-explicit-epoch' as const;

function parseSixDay(target: string, epoch: string, timezone?: number, timeZoneId?: string) {
  return parseHuangjiSixDayDateTime(target, timezone, timeZoneId, MODEL, epoch);
}

test('六日逐爻使用显式子半历元直接进入三百六十日坐标', () => {
  const result = calculateHuangjiSixDayCycleFromDate(
    parseSixDay('2025-01-01T23:03:05+08:00', '2025-01-01T00:00:00+08:00'),
  );

  assert.equal(result.model, '书绪言六日逐爻·显式历元');
  assert.equal(result.anchor.kind, 'explicit-epoch');
  assert.equal(result.anchor.dateTime, '2025-01-01T00:00:00+08:00');
  assert.equal(result.anchor.utcDateTime, '2024-12-31T16:00:00.000Z');
  assert.equal(result.anchor.dayBoundary, '当地子半');
  assert.equal(result.civilTime.utcDateTime, '2025-01-01T15:03:05.000Z');
  assert.equal(result.calendar.model, MODEL);
  assert.equal(result.calendar.mapping, 'explicit-epoch-civil-days');
  assert.equal(result.calendar.targetYear, 2025);
  assert.equal(result.calendar.actualElapsedDays, 0);
  assert.equal(result.calendar.logicalElapsedDays, 0);
  assert.equal(result.calendar.logicalDayFraction, 0);
  assert.equal(result.calendar.coordinateSpanDays, 360);
  assert.equal(result.calendar.cycleDay, 1);
  assert.equal(result.elapsedDays, 0);
  assert.equal(result.dayOfCycle, 1);
  assert.equal(result.hour, 23);
  assert.equal(result.hourRange, '20:00—24:00');
});

test('显式历元按当地日期差覆盖起点、六日交界和最后一个已定义日', () => {
  const epoch = '2025-01-01T00:00:00+08:00';
  const first = calculateHuangjiSixDayCycleFromDate(parseSixDay(epoch, epoch));
  const nextJing = calculateHuangjiSixDayCycleFromDate(
    parseSixDay('2025-01-07T00:00:00+08:00', epoch),
  );
  const last = calculateHuangjiSixDayCycleFromDate(parseSixDay('2025-12-26T23:59:59+08:00', epoch));

  assert.equal(first.elapsedDays, 0);
  assert.equal(first.dayLine, 1);
  assert.equal(nextJing.elapsedDays, 6);
  assert.equal(nextJing.jingIndex, 2);
  assert.equal(nextJing.dayLine, 1);
  assert.equal(last.calendar.actualElapsedDays, 359);
  assert.equal(last.dayOfCycle, 360);
});

test('IANA 夏令时只影响真实瞬时，不改变显式历元的当地日期坐标', () => {
  const result = calculateHuangjiSixDayCycleFromDate(
    parseSixDay('2026-03-09T00:00:00', '2026-03-07T00:00:00', undefined, 'America/New_York'),
  );

  assert.equal(result.civilTime.timezone, -4);
  assert.equal(result.anchor.timezone, -5);
  assert.equal(result.calendar.actualElapsedDays, 2);
  assert.equal(result.elapsedDays, 2);
  assert.equal(result.calendar.actualElapsedSeconds, 169200);
});

test('六日逐爻公历入口拒绝未经校定的模型、历元和坐标范围', () => {
  assert.throws(
    () =>
      parseHuangjiSixDayDateTime(
        '2025-01-01T00:00:00+08:00',
        undefined,
        undefined,
        'six-day-seven-part' as never,
        '2025-01-01T00:00:00+08:00',
      ),
    /six-day-explicit-epoch/,
  );
  assert.throws(
    () => parseHuangjiSixDayDateTime('2025-01-01T00:00:00+08:00', undefined, undefined, MODEL),
    /sixDayEpochDateTime/,
  );
  assert.throws(
    () => parseSixDay('2025-01-02T00:00:00', '2025-01-01T00:00:00'),
    /timezone 与 timeZoneId 至少需要提供一项/,
  );
  assert.throws(
    () => parseSixDay('2025-01-02T00:00:00+08:00', '2025-01-01T01:00:00+08:00'),
    /当地子半/,
  );
  assert.throws(
    () => parseSixDay('2025-01-02T00:00:00+08:00', '2025-01-01T00:00:00+09:00'),
    /时区偏移必须一致/,
  );
  assert.throws(
    () =>
      calculateHuangjiSixDayCycleFromDate(
        parseSixDay('2024-12-31T23:59:59+08:00', '2025-01-01T00:00:00+08:00'),
      ),
    /超出显式历元后0至359日/,
  );
  assert.throws(
    () =>
      calculateHuangjiSixDayCycleFromDate(
        parseSixDay('2025-12-27T00:00:00+08:00', '2025-01-01T00:00:00+08:00'),
      ),
    /超出显式历元后0至359日/,
  );
});

test('六日逐爻公历结果与提示词保留显式历元事实', () => {
  const result = calculateHuangjiJingshi({
    sixDayDate: parseSixDay('2025-01-02T05:03:05+14:00', '2025-01-01T00:00:00+14:00'),
    question: '此时的主要变化是什么？',
  });

  assert.equal(result.input.mode, '六日逐爻公历');
  assert.equal(result.sixDayCycle?.civilTime.timezone, 14);
  assert.match(result.prompt, /显式历元：2025-01-01T00:00:00\+14:00/);
  assert.match(result.prompt, /每六日一经卦、每日一爻、每四小时一爻/);
  assert.doesNotMatch(result.prompt, /冬至定位依据|太阳年|日干支/);
  assert.match(result.prompt, /【问题】\n此时的主要变化是什么？/);
});
