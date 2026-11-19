import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm, SolarTime } from 'tyme4ts';
import { calculateUnknownBaziTime, type UnknownBaziBirth } from '../src/systems/bazi/unknown-time';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';
import { determineUsefulGod } from '../src/systems/bazi/useful-god';
import { getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';

const keys = ['year', 'month', 'day', 'hour'] as const;
async function verifySegments(input: UnknownBaziBirth, result: Awaited<ReturnType<typeof calculateUnknownBaziTime>>) {
  for (const segment of result.segments) {
    assert.ok(segment.startTimestamp < segment.endTimestamp);
    const middle = segment.startTimestamp + Math.floor((segment.endTimestamp - segment.startTimestamp) / 2000) * 1000;
    for (const timestamp of [segment.startTimestamp, middle, segment.endTimestamp - 1000]) {
      const civil = getCivilDateTimeAtFixedOffset(new Date(timestamp), segment.timezone);
      const exact = await calculateBaziPillars({ ...civil, clock: { kind: 'exact', hour: civil.hour, minute: civil.minute, second: civil.second }, timezone: segment.timezone, ...(input.timeZoneId ? { timeZoneId: input.timeZoneId } : {}), ...(input.timeStandard === 'true-solar' ? { timeStandard: 'true-solar', longitude: input.longitude } : {}) });
      for (const key of keys) assert.deepEqual(segment.pillars[key], exact.pillars[key], `${timestamp}/${key}`);
      assert.deepEqual(segment.natalFacts, exact.natalFacts, `${timestamp}/本命事实`);
      assert.deepEqual(segment.shensha, exact.shensha, `${timestamp}/神煞`);
      assert.deepEqual(segment.strength, exact.strength, `${timestamp}/旺衰条件`);
      assert.deepEqual(segment.ordinaryPattern, exact.ordinaryPattern, `${timestamp}/普通取格候选`);
      assert.deepEqual(segment.transformation, exact.transformation, `${timestamp}/五合化气`);
      assert.deepEqual(segment.quzhi, exact.quzhi, `${timestamp}/曲直条件`);
      assert.deepEqual(segment.conger, exact.conger, `${timestamp}/从儿条件`);
      assert.deepEqual(segment.extreme, exact.extreme, `${timestamp}/专旺与通用从格`);
      assert.deepEqual(segment.usefulBaseline, exact.usefulBaseline, `${timestamp}/基础取向`);
      assert.deepEqual(segment.climate, exact.climate, `${timestamp}/调候候选`);
      assert.deepEqual(segment.climateDecision, exact.climateDecision, `${timestamp}/调候条件协调`);
      assert.deepEqual(segment.usefulStrategy, exact.usefulStrategy, `${timestamp}/取用条件候选`);
      assert.deepEqual(segment.patternEvidence, exact.patternEvidence, `${timestamp}/格局根气依据`);
      assert.deepEqual(segment.patternOverview, exact.patternOverview, `${timestamp}/已迁移格局优先顺序`);
      assert.deepEqual(segment.usefulGod, determineUsefulGod(exact), `${timestamp}/最终用神裁定`);
      assert.deepEqual(segment.monthCommander, exact.monthCommander, `${timestamp}/月令司权`);
    }
  }
  for (const key of keys) {
    assert.deepEqual(result.possible[key], [...new Set(result.segments.map((segment) => segment.pillars[key].ganZhi))]);
    assert.equal(result.common[key], result.possible[key].length === 1 ? result.possible[key][0] : null);
  }
}

test('交节日按实际秒切分，晚子换日不被当成稳定日柱', async () => {
  const input = { year: 2024, month: 2, day: 4, timezone: 8 };
  const result = await calculateUnknownBaziTime(input);
  assert.equal(result.source.endTimestamp - result.source.startTimestamp, 24 * 3_600_000);
  assert.equal(result.source.excludedSeconds, 0);
  assert.equal(result.common.year, null); assert.equal(result.common.month, null); assert.equal(result.common.day, null); assert.equal(result.common.hour, null);
  assert.equal(result.segments[0].startTimestamp, result.source.startTimestamp);
  assert.equal(result.segments.at(-1)!.endTimestamp, result.source.endTimestamp);
  for (let i = 1; i < result.segments.length; i++) assert.equal(result.segments[i - 1].endTimestamp, result.segments[i].startTimestamp);
  const term = SolarTerm.fromIndex(2024, 3).getJulianDay().getSolarTime();
  const instant = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
  assert.ok(result.segments.some((segment) => segment.startTimestamp === instant));
  assert.ok(result.segments.some((segment) => segment.startTimestamp === Date.parse('2024-02-04T15:00:00Z')));
  await verifySegments(input, result);
  // Check every second, including the intervals between detected cuts.
  let index = 0;
  for (let timestamp = result.source.startTimestamp; timestamp < result.source.endTimestamp; timestamp += 1000) {
    while (timestamp >= result.segments[index].endTimestamp) index++;
    const d = new Date(timestamp + 8 * 3_600_000);
    const eight = SolarTime.fromYmdHms(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()).getLunarHour().getEightChar();
    const expected = [eight.getYear().getName(), eight.getMonth().getName(), eight.getDay().getName(), eight.getHour().getName()];
    for (let k = 0; k < keys.length; k++) assert.equal(result.segments[index].pillars[keys[k]].ganZhi, expected[k], `${timestamp}/${keys[k]}`);
  }
});

test('多年十二交节前后秒及各候选段与精确排盘一致', async () => {
  for (const year of [1986, 2024, 2100]) for (let index = 1; index < 24; index += 2) {
    const term = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
    const instant = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
    const input = { year: term.getYear(), month: term.getMonth(), day: term.getDay(), timezone: 8 };
    const result = await calculateUnknownBaziTime(input);
    await verifySegments(input, result);
    for (const shift of [-1000, 0, 1000]) {
      const timestamp = instant + shift;
      const segment = result.segments.find((s) => s.startTimestamp <= timestamp && timestamp < s.endTimestamp);
      if (!segment) continue;
      const civil = getCivilDateTimeAtFixedOffset(new Date(timestamp), 8);
      const exact = await calculateBaziPillars({ ...civil, timezone: 8, clock: { kind: 'exact', hour: civil.hour, minute: civil.minute, second: civil.second } });
      assert.deepEqual(segment.pillars, exact.pillars, `${year}/${index}/${shift}`);
    }
  }
});

test('夏令时跳时与回拨保留真实 23、25 小时，指定偏移只保留匹配时刻', async () => {
  const springInput = { year: 2024, month: 3, day: 10, timeZoneId: 'America/New_York' };
  const spring = await calculateUnknownBaziTime(springInput);
  assert.equal(spring.source.endTimestamp - spring.source.startTimestamp, 23 * 3_600_000);
  assert.deepEqual([...new Set(spring.segments.map((segment) => segment.timezone))], [-5, -4]);
  await verifySegments(springInput, spring);
  const fallInput = { year: 2024, month: 11, day: 3, timeZoneId: 'America/New_York' };
  const fall = await calculateUnknownBaziTime(fallInput);
  assert.equal(fall.source.endTimestamp - fall.source.startTimestamp, 25 * 3_600_000);
  assert.deepEqual([...new Set(fall.segments.map((segment) => segment.timezone))], [-4, -5]);
  const first = await calculateUnknownBaziTime({ ...fallInput, timezone: -4 });
  assert.equal(first.source.excludedSeconds, 23 * 3600);
  assert.ok(first.segments.every((segment) => segment.timezone === -4));
  const second = await calculateUnknownBaziTime({ ...fallInput, timezone: -5 });
  assert.equal(second.source.excludedSeconds, 2 * 3600);
  assert.ok(second.segments.every((segment) => segment.timezone === -5));
  await verifySegments(fallInput, fall);
});

test('重复民用日保留两个偏移及完整真实时段', async () => {
  const input = { year: 1969, month: 9, day: 30, timeZoneId: 'Pacific/Kwajalein' };
  const result = await calculateUnknownBaziTime(input);
  assert.equal(result.source.endTimestamp - result.source.startTimestamp, 47 * 3_600_000);
  assert.equal(result.source.excludedSeconds, 0);
  assert.deepEqual([...new Set(result.segments.map((segment) => segment.timezone))], [11, -12]);
  await verifySegments(input, result);
});

test('真太阳时时辰边界与明确时刻结果一致，农历闰月换算保留当地日', async () => {
  const input = { year: 2024, month: 2, day: 4, timezone: 8, timeStandard: 'true-solar' as const, longitude: 116.4 };
  const solar = await calculateUnknownBaziTime(input);
  await verifySegments(input, solar);
  assert.ok(solar.segments.some((segment) => segment.startTimestamp % 3_600_000 !== 0));
  const lunar = await calculateUnknownBaziTime({ year: 2023, month: 2, day: 1, calendar: 'lunar', leapMonth: true, timezone: 8 });
  assert.equal(lunar.source.solarDate, '2023-03-22');
  assert.match(lunar.limitation, /起运时刻/);
});

test('十三个民用钟表时辰覆盖整日，交节、夏令时与真太阳时不取单一中点', async () => {
  let sum = 0;
  for (let index = 0; index <= 12; index++) {
    const result = await calculateUnknownBaziTime({ year: 2024, month: 2, day: 4, timezone: 8, shichenIndex: index });
    const duration = result.segments.reduce((total, segment) => total + (segment.endTimestamp - segment.startTimestamp) / 1000, 0);
    assert.equal(duration, index === 0 || index === 12 ? 3600 : 7200);
    assert.equal(result.source.excludedSeconds + duration, 86400);
    assert.equal(result.source.shichen?.index, index);
    if (index === 8) { assert.equal(result.common.year, null); assert.equal(result.common.month, null); }
    sum += duration;
  }
  assert.equal(sum, 86400);
  const fall = await calculateUnknownBaziTime({ year: 2024, month: 11, day: 3, timeZoneId: 'America/New_York', shichenIndex: 1 });
  assert.equal(fall.segments.reduce((total, segment) => total + segment.endTimestamp - segment.startTimestamp, 0), 3 * 3_600_000);
  assert.deepEqual([...new Set(fall.segments.map((segment) => segment.timezone))], [-4, -5]);
  const spring = await calculateUnknownBaziTime({ year: 2024, month: 3, day: 10, timeZoneId: 'America/New_York', shichenIndex: 1 });
  assert.equal(spring.segments.reduce((total, segment) => total + segment.endTimestamp - segment.startTimestamp, 0), 3_600_000);
  const solar = await calculateUnknownBaziTime({ year: 2024, month: 2, day: 4, timezone: 8, shichenIndex: 8, timeStandard: 'true-solar', longitude: 116.4 });
  assert.ok(solar.segments.some((segment) => segment.startTimestamp % 3_600_000 !== 0));
  await verifySegments({ year: 2024, month: 2, day: 4, timezone: 8, timeStandard: 'true-solar', longitude: 116.4 }, solar);
});

test('无效日期、跳过的整日和不可匹配偏移均明确拒绝', async () => {
  await assert.rejects(() => calculateUnknownBaziTime({ year: 2024, month: 2, day: 30 }));
  await assert.rejects(() => calculateUnknownBaziTime({ year: 2011, month: 12, day: 30, timeZoneId: 'Pacific/Apia' }), /不存在/);
  await assert.rejects(() => calculateUnknownBaziTime({ year: 2024, month: 1, day: 1, timeZoneId: 'America/New_York', timezone: 8 }), /没有有效候选/);
  await assert.rejects(() => calculateUnknownBaziTime({ year: 2024, month: 1, day: 1, timeStandard: 'true-solar' }), /经度/);
});

test('中气实际交接秒切分调候候选，即使四柱与司权不变', async () => {
  for (let index = 0; index < 24; index += 2) {
    const term = SolarTerm.fromIndex(2024, index).getJulianDay().getSolarTime();
    const timestamp = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
    const result = await calculateUnknownBaziTime({ year: term.getYear(), month: term.getMonth(), day: term.getDay(), timezone: 8 });
    const before = result.segments.find((s) => s.startTimestamp <= timestamp - 1000 && timestamp - 1000 < s.endTimestamp);
    const after = result.segments.find((s) => s.startTimestamp <= timestamp && timestamp < s.endTimestamp);
    assert.ok(before && after, `中气 ${index}`);
    assert.equal(after.startTimestamp, timestamp, `中气 ${index}`);
    assert.notEqual(before.climate.currentJieqi, after.climate.currentJieqi, `中气 ${index}`);
    for (const t of [timestamp - 1000, timestamp]) {
      const local = getCivilDateTimeAtFixedOffset(new Date(t), 8);
      const exact = await calculateBaziPillars({ ...local, timezone: 8, clock: { kind: 'exact', hour: local.hour, minute: local.minute, second: local.second } });
      const segment = t === timestamp ? after : before;
      assert.deepEqual(segment.climate, exact.climate, `中气 ${index}/${t}`);
    }
  }
});
