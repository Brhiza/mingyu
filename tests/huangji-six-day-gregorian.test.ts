import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHuangjiJingshi,
  calculateHuangjiSixDayCycleFromDate,
  parseHuangjiSixDayDateTime,
} from '@core/huangji-jingshi';

const MODEL = 'six-day-explicit-epoch' as const;
const PROPORTIONAL_MODEL = 'six-day-seven-part' as const;

function parseSixDay(target: string, epoch: string, timezone?: number, timeZoneId?: string) {
  return parseHuangjiSixDayDateTime(target, timezone, timeZoneId, MODEL, epoch);
}

function parseProportionalSixDay(target: string, timezone?: number, timeZoneId?: string) {
  return parseHuangjiSixDayDateTime(target, timezone, timeZoneId, PROPORTIONAL_MODEL);
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
        'unknown-model' as never,
        '2025-01-01T00:00:00+08:00',
      ),
    /six-day-explicit-epoch.*six-day-seven-part/,
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

test('现代比例模型以实际冬至瞬时确定岁周并以当地冬至日子半为锚点', () => {
  const beforeTerm = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2025-12-21T12:00:00+08:00'),
  );
  const atTerm = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2025-12-21T23:03:05+08:00'),
  );

  assert.equal(beforeTerm.model, '书绪言六日逐爻·现代冬至岁周换算');
  assert.equal(beforeTerm.anchor.kind, 'winter-solstice-civil-midnight');
  assert.equal(beforeTerm.anchor.winterSolsticeYear, 2025);
  assert.equal(beforeTerm.anchor.dayStartDateTime, '2024-12-21T00:00:00+08:00');
  assert.equal(atTerm.anchor.winterSolsticeYear, 2026);
  assert.equal(atTerm.anchor.dateTime, '2025-12-21T23:03:05+08:00');
  assert.equal(atTerm.anchor.utcDateTime, '2025-12-21T15:03:05.000Z');
  assert.equal(atTerm.anchor.dayStartDateTime, '2025-12-21T00:00:00+08:00');
  assert.equal(atTerm.anchor.dayBoundary, '当地子半');
  assert.equal(atTerm.calendar.model, PROPORTIONAL_MODEL);
  assert.equal(atTerm.calendar.mapping, 'winter-solstice-proportional-360');
  assert.equal(atTerm.calendar.actualElapsedDays, 0);
  assert.equal(atTerm.calendar.coordinateSpanDays, 360);
  assert.equal(atTerm.elapsedDays, atTerm.anchor.dayIndex);
});

test('现代比例模型按冬至子半至下一冬至子半的实际跨度映射逻辑日并保留四小时一爻', () => {
  const result = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2026-02-19T23:03:05+08:00'),
  );
  const { calendar } = result;

  assert.equal(calendar.actualElapsedDays, 60);
  assert.ok(calendar.yearLengthDays > 365 && calendar.yearLengthDays < 367);
  assert.equal(
    calendar.logicalPosition,
    (calendar.actualElapsedMilliseconds / calendar.yearLengthMilliseconds) * 360,
  );
  assert.equal(calendar.logicalElapsedDays, Math.floor(calendar.logicalPosition));
  assert.equal(calendar.logicalDayFraction, calendar.logicalPosition - calendar.logicalElapsedDays);
  assert.equal(result.hourLine, 6);
  assert.equal(result.hourRange, '20:00—24:00');
  assert.match(result.limitations.join('；'), /现代比例换算/);
  assert.match(result.limitations.join('；'), /不宣称古籍唯一算法/);
});

test('现代比例模型支持固定时区与 IANA，并分别保留真实瞬时和当地子半', () => {
  const fixed = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2026-07-01T16:00:00Z'),
  );
  const iana = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2026-07-01T12:00:00', undefined, 'America/New_York'),
  );

  assert.equal(fixed.civilTime.utcDateTime, iana.civilTime.utcDateTime);
  assert.equal(iana.civilTime.timezone, -4);
  assert.equal(iana.civilTime.timeZoneId, 'America/New_York');
  assert.equal(iana.anchor.kind, 'winter-solstice-civil-midnight');
  assert.match(iana.anchor.dayStartDateTime, /-05:00$/u);
  assert.equal(iana.calendar.model, PROPORTIONAL_MODEL);
  assert.ok(iana.calendar.yearLengthSeconds > 364 * 86400);
});

test('现代比例模型提示词回显冬至锚点、实际岁周与限制说明', () => {
  const result = calculateHuangjiJingshi({
    sixDayDate: parseProportionalSixDay('2025-12-22T05:03:05+08:00'),
    question: '此时的主要变化是什么？',
  });

  assert.equal(result.sixDayCycle?.calendar.model, PROPORTIONAL_MODEL);
  assert.match(result.prompt, /现代冬至岁周换算/);
  assert.match(result.prompt, /冬至真实瞬时/);
  assert.match(result.prompt, /当地子半/);
  assert.match(result.prompt, /实际跨度/);
  assert.match(result.prompt, /逻辑位置/);
  assert.match(result.prompt, /不宣称是古籍唯一算法/);
  assert.match(result.prompt, /【问题】\n此时的主要变化是什么？/);
});
