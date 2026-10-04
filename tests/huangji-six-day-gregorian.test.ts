import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHuangjiJingshi,
  calculateHuangjiSixDayCycleFromDate,
  parseHuangjiSixDayDateTime,
} from '@core/huangji-jingshi';
import { formatHuangjiInfo } from '../packages/core/src/prompt/divination-enhanced.ts';

const MODEL = 'six-day-explicit-epoch' as const;
const PROPORTIONAL_MODEL = 'six-day-seven-part' as const;

function parseSixDay(target: string, epoch: string, timezone?: number, timeZoneId?: string) {
  return parseHuangjiSixDayDateTime(target, timezone, timeZoneId, MODEL, epoch);
}

function parseProportionalSixDay(target: string, timezone?: number, timeZoneId?: string) {
  return parseHuangjiSixDayDateTime(target, timezone, timeZoneId, PROPORTIONAL_MODEL);
}

test('冬至甲子日向在线任务书只呈现干支，不展示内部索引', () => {
  const result = calculateHuangjiJingshi({
    sixDayDate: parseProportionalSixDay('2025-12-25T12:00:00+08:00'),
  });
  assert.equal(result.sixDayCycle?.anchor.kind, 'winter-solstice-civil-midnight');
  if (result.sixDayCycle?.anchor.kind !== 'winter-solstice-civil-midnight') return;
  assert.equal(result.sixDayCycle.anchor.dayGanZhi, '甲子');
  assert.equal(result.sixDayCycle.anchor.dayIndex, 0);
  assert.match(result.prompt, /冬至所在当地公历日干支：甲子；/);
  assert.match(result.sixDayCycle.calculationChain.join('；'), /对应的甲子接续六日逐爻周期/);
  assert.doesNotMatch(result.prompt, /六十甲子序号|零基偏移/);
});

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

test('IANA 回拨重复小时以目标偏移消歧，显式历元保留自身历史偏移', () => {
  const epoch = '2026-03-07T00:00:00-05:00';
  const earlier = calculateHuangjiSixDayCycleFromDate(
    parseSixDay('2026-11-01T01:30:00-04:00', epoch, undefined, 'America/New_York'),
  );
  const later = calculateHuangjiSixDayCycleFromDate(
    parseSixDay('2026-11-01T01:30:00-05:00', epoch, undefined, 'America/New_York'),
  );

  assert.equal(earlier.anchor.timezone, -5);
  assert.equal(earlier.civilTime.timezone, -4);
  assert.equal(earlier.civilTime.utcDateTime, '2026-11-01T05:30:00.000Z');
  assert.equal(later.civilTime.utcDateTime, '2026-11-01T06:30:00.000Z');
  assert.equal(earlier.calendar.actualElapsedDays, later.calendar.actualElapsedDays);
  assert.equal(later.calendar.actualElapsedSeconds - earlier.calendar.actualElapsedSeconds, 3600);
  assert.throws(
    () => parseSixDay('2026-11-01T01:30:00-04:00', epoch, -5, 'America/New_York'),
    /sixDayDateTime 的时区偏移与 timezone 不一致/,
  );
});

test('显式历元晚于同一当地日期的目标瞬时时拒绝，起点及之后仍按当地日序', () => {
  const epoch = '2016-11-06T00:00:00-05:00';
  const parseHavana = (target: string) => parseSixDay(target, epoch, undefined, 'America/Havana');

  for (const target of ['2016-11-06T00:30:00-04:00', '2016-11-06T00:59:59.999-04:00']) {
    assert.throws(
      () => calculateHuangjiSixDayCycleFromDate(parseHavana(target)),
      /目标真实瞬时不能早于显式历元起点/,
    );
  }

  const atEpoch = calculateHuangjiSixDayCycleFromDate(parseHavana(epoch));
  const firstMillisecond = calculateHuangjiSixDayCycleFromDate(
    parseHavana('2016-11-06T00:00:00.001-05:00'),
  );
  const afterEpoch = calculateHuangjiSixDayCycleFromDate(parseHavana('2016-11-06T00:30:00-05:00'));

  assert.equal(atEpoch.anchor.utcDateTime, '2016-11-06T05:00:00.000Z');
  assert.equal(atEpoch.civilTime.utcDateTime, atEpoch.anchor.utcDateTime);
  assert.equal(atEpoch.calendar.actualElapsedSeconds, 0);
  assert.equal(firstMillisecond.civilTime.utcDateTime, '2016-11-06T05:00:00.001Z');
  assert.equal(firstMillisecond.calendar.actualElapsedSeconds, 0);
  assert.equal(afterEpoch.calendar.actualElapsedSeconds, 1800);
  for (const result of [atEpoch, firstMillisecond, afterEpoch]) {
    assert.equal(result.calendar.actualElapsedDays, 0);
    assert.equal(result.calendar.cycleDay, 1);
  }
});

test('IANA 回拨重复小时的比例模型也可用时间字符串偏移消歧', () => {
  const earlier = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2026-11-01T01:30:00-04:00', undefined, 'America/New_York'),
  );
  const later = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2026-11-01T01:30:00-05:00', undefined, 'America/New_York'),
  );

  assert.equal(earlier.civilTime.utcDateTime, '2026-11-01T05:30:00.000Z');
  assert.equal(later.civilTime.utcDateTime, '2026-11-01T06:30:00.000Z');
  assert.equal(later.calendar.actualElapsedSeconds - earlier.calendar.actualElapsedSeconds, 3600);
});

test('历史秒级时区偏移可从盘面回填并保持真实瞬时与日序', () => {
  const original = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('1900-01-02T12:00:00', undefined, 'Asia/Shanghai'),
  );
  assert.equal(original.civilTime.dateTime, '1900-01-02T12:00:00+08:05:43');
  assert.equal(original.civilTime.utcDateTime, '1900-01-02T03:54:17.000Z');

  const restored = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay(original.civilTime.dateTime, undefined, 'Asia/Shanghai'),
  );
  assert.equal(restored.civilTime.utcDateTime, original.civilTime.utcDateTime);
  assert.equal(restored.calendar.logicalElapsedDays, original.calendar.logicalElapsedDays);
  assert.equal(restored.hexagrams.hourly.id, original.hexagrams.hourly.id);

  const epoch = '1900-01-01T00:00:00+08:05:43';
  const explicit = calculateHuangjiSixDayCycleFromDate(
    parseSixDay(original.civilTime.dateTime, epoch, undefined, 'Asia/Shanghai'),
  );
  assert.equal(explicit.civilTime.utcDateTime, original.civilTime.utcDateTime);
  assert.equal(explicit.calendar.actualElapsedDays, 1);
  const result = calculateHuangjiJingshi({
    sixDayDate: parseProportionalSixDay(original.civilTime.dateTime, undefined, 'Asia/Shanghai'),
  });
  assert.match(result.prompt, /UTC\+08:05:43，Asia\/Shanghai/u);
  assert.doesNotMatch(result.prompt, /8\.095277/u);
  assert.match(formatHuangjiInfo(result), /UTC\+08:05:43/u);
  assert.throws(() => parseProportionalSixDay('1900-01-02T12:00:00+08:05:60'), /时区偏移无效/u);
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
  const cycle = result.sixDayCycle;
  assert.ok(cycle);
  const formatted = formatHuangjiInfo(result);
  assert.ok(formatted.includes(cycle.civilTime.dateTime));
  assert.ok(formatted.includes(cycle.anchor.dateTime));
  assert.ok(formatted.includes(`三百六十日周期第${cycle.dayOfCycle}日`));
  assert.ok(formatted.includes(`六日经卦${cycle.hexagrams.jing.name}`));
  assert.ok(formatted.includes(`时变卦${cycle.hexagrams.hourly.name}`));
  assert.doesNotMatch(formatted, /目标年份以【.*】值年承接大局气数/);
});

test('六日逐爻现代冬至岁周换算在网页盘面写明比例历元', () => {
  const result = calculateHuangjiJingshi({
    sixDayDate: parseProportionalSixDay('2025-12-21T23:03:05+08:00'),
  });
  const cycle = result.sixDayCycle;
  assert.ok(cycle);
  assert.ok(cycle.model === '书绪言六日逐爻·现代冬至岁周换算');
  const formatted = formatHuangjiInfo(result);
  assert.ok(formatted.includes(cycle.anchor.dayStartDateTime));
  assert.match(formatted, /按冬至岁周实际跨度映射三百六十逻辑日/);
  assert.ok(formatted.includes(`六日时变卦辞：${cycle.hexagrams.hourly.judgment}`));
});

test('显式六日历元跨冬至时仅保留六日坐标，值年背景随真实瞬时换年', () => {
  const epoch = '2025-12-21T00:00:00+08:00';
  const before = calculateHuangjiJingshi({
    sixDayDate: parseSixDay('2025-12-21T23:03:04+08:00', epoch),
  });
  const atTerm = calculateHuangjiJingshi({
    sixDayDate: parseSixDay('2025-12-21T23:03:05+08:00', epoch),
  });
  const proportional = calculateHuangjiSixDayCycleFromDate(
    parseProportionalSixDay('2025-12-21T23:03:05+08:00'),
  );

  assert.equal(before.sixDayCycle?.elapsedDays, 0);
  assert.equal(atTerm.sixDayCycle?.elapsedDays, 0);
  assert.equal(before.input.year, 2025);
  assert.equal(atTerm.input.year, 2026);
  assert.equal(atTerm.sixDayCycle?.calendar.targetYear, 2026);
  assert.equal(atTerm.input.year, proportional.calendar.targetYear);
  assert.equal(atTerm.forecast?.hexagrams.annual.shortName, '同人');
  assert.match(atTerm.prompt, /值年背景：目标真实瞬时按北京时间冬至换年，取公元2026年/);
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
  assert.equal(beforeTerm.anchor.winterSolsticeGregorianYear, 2024);
  assert.equal(beforeTerm.calendar.targetYear, 2025);
  assert.equal(beforeTerm.anchor.dayStartDateTime, '2024-12-21T00:00:00+08:00');
  assert.equal(atTerm.anchor.winterSolsticeGregorianYear, 2025);
  assert.equal(atTerm.calendar.targetYear, 2026);
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
  assert.match(result.limitations.join('；'), /不宣称是古籍唯一算法/);
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

test('冬至所在 IANA 当地日午夜跳时时以该民用日首个实际时刻为锚点', () => {
  const input = parseProportionalSixDay('1974-12-22T12:00:00', undefined, 'America/Montevideo');
  const result = calculateHuangjiSixDayCycleFromDate(input);

  assert.equal(result.anchor.winterSolsticeGregorianYear, 1974);
  assert.equal(result.anchor.localDateTime, '1974-12-22T03:55:56-02:00');
  assert.equal(result.anchor.dayBoundary, '当地日首个实际时刻');
  assert.equal(result.anchor.dayStartDateTime, '1974-12-22T01:00:00-02:00');
  assert.equal(result.anchor.dayStartUtcDateTime, '1974-12-22T03:00:00.000Z');

  const reading = calculateHuangjiJingshi({ sixDayDate: input });
  const prompt = reading.prompt;
  assert.match(prompt, /当地日首个实际时刻锚点：1974-12-22T01:00:00-02:00/);
  assert.doesNotMatch(prompt, /当地子半锚点：1974-12-22/);
  assert.match(
    formatHuangjiInfo(reading),
    /六日逐爻历元：以1974-12-22T01:00:00-02:00当地日首个实际时刻为起点/u,
  );
});

test('现代比例模型提示词将冬至锚点与比例口径列入排盘资料', () => {
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
  const traditionalBasis = result.prompt.split('【传统依据】\n')[1]?.split('\n\n【排盘资料】')[0];
  assert.ok(traditionalBasis);
  assert.doesNotMatch(traditionalBasis, /现代冬至岁周换算|实际跨度|比例映射/u);
  assert.match(result.prompt, /【排盘资料】\n六日逐爻公历时间：[\s\S]*现代冬至岁周换算模型：/u);
  assert.match(result.prompt, /【问题】\n此时的主要变化是什么？/);
});

test('下一冬至当地日首点先于交节时提示词写明上一岁周逻辑日封顶', () => {
  const beforeTerm = calculateHuangjiJingshi({
    sixDayDate: parseProportionalSixDay('2025-12-21T12:00:00+08:00'),
  });
  assert.equal(beforeTerm.sixDayCycle?.calendar.targetYear, 2025);
  assert.equal(beforeTerm.sixDayCycle?.calendar.endpointClamped, true);
  assert.match(beforeTerm.prompt, /下一冬至当地日首点已到、冬至真实瞬时尚未到/);
  assert.match(beforeTerm.prompt, /当前仍属上一岁周，逻辑位置暂封顶于第360个逻辑日/);

  const atTerm = calculateHuangjiJingshi({
    sixDayDate: parseProportionalSixDay('2025-12-21T23:03:05+08:00'),
  });
  assert.equal(atTerm.sixDayCycle?.calendar.targetYear, 2026);
  assert.equal(atTerm.sixDayCycle?.calendar.endpointClamped, false);
  assert.doesNotMatch(atTerm.prompt, /逻辑位置暂封顶/);
});
