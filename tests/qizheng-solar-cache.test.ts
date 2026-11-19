import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { sameJsonValue } from '../src/json-value';
import { createSolarIlluminationCalculator, solarIllumination } from '../src/systems/astronomy/solar-illumination';
import { createTimezoneOffsetReader, getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';

const cases = [
  { name: '日出', start: '2024-02-18T23:03:08Z', latitude: 39.9, longitude: 116.4, timezone: 8, seconds: 4 },
  { name: '午夜', start: '2024-02-19T15:59:58Z', latitude: 39.9, longitude: 116.4, timezone: 8, seconds: 5 },
  { name: '夏令时回拨', start: '2024-11-03T05:59:59Z', latitude: 40.7, longitude: -74, timezone: -4, timeZoneId: 'America/New_York', seconds: 4 },
  { name: '重历日', start: '1969-09-30T12:59:59Z', latitude: 8.7167, longitude: 167.7333, timezone: 11, timeZoneId: 'Pacific/Kwajalein', seconds: 4 },
  { name: '极昼', start: '2024-06-21T11:00:00Z', latitude: 80, longitude: 15, timezone: 1, seconds: 3 },
] as const;

function sample(item: typeof cases[number], timestamp: number) {
  const timezone = 'timeZoneId' in item ? createTimezoneOffsetReader(item.timeZoneId)(timestamp) : item.timezone;
  const civil = getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone);
  return { timestamp, year: civil.year, month: civil.month, day: civil.day, latitude: item.latitude, longitude: item.longitude, timezone,
    ...('timeZoneId' in item ? { timeZoneId: item.timeZoneId } : {}) };
}

test('按日期复用交点与每秒独立计算一致，覆盖日出、午夜、夏令时、重历日和极昼', () => {
  const cached = createSolarIlluminationCalculator();
  for (const item of cases) for (let second = 0; second < item.seconds; second++) {
    const input = sample(item, Date.parse(item.start) + second * 1000);
    assert.deepEqual(cached(input), solarIllumination(input), `${item.name}/${second}`);
  }
});

test('缓存返回的交点和民用日不共享可变引用，非法时刻仍被拒绝', () => {
  const cached = createSolarIlluminationCalculator();
  const input = sample(cases[0], Date.parse(cases[0].start));
  const first = cached(input), expected = solarIllumination(input), second = cached(input);
  assert.notStrictEqual(first.window, second.window);
  assert.notStrictEqual(first.sunriseSunset.crossings, second.sunriseSunset.crossings);
  first.window.startUtcMs = 0;
  first.sunriseSunset.crossings[0].localDateTime = '伪造';
  assert.deepEqual(second, expected); assert.deepEqual(cached(input), expected);
  assert.throws(() => cached({ ...input, timestamp: input.timestamp + 2 * 86_400_000 }), /不在指定当地民用日内/);
  assert.throws(() => cached({ ...input, latitude: 91 }), /有效时刻及经纬度/);
});

test('范围分支首末秒与独立单盘一致，且不同秒不共享交点引用', async () => {
  const birth = { year: 2024, month: 2, day: 19, hour: 11, minute: 24, second: 49, latitude: 39.9, longitude: 116.4, timezone: 8 };
  const input = { question: '问题', birth, range: { start: '2024-02-19T11:24:49+08:00', end: '2024-02-19T11:24:54+08:00' } };
  const range = await calculate('qizheng-range', input);
  assert.equal(range.data.range.complete, true);
  for (const branch of range.data.branches) for (const [chart, index] of [[branch.first, branch.startIndex], [branch.last, branch.endIndex - 1]] as const) {
    const direct = await calculate('qizheng', { question: input.question, birth: { ...birth, second: birth.second + index } });
    assert.ok(sameJsonValue(chart, direct.data, 1e-9), `第 ${index} 秒`);
  }
  const branch = range.data.branches.find((item) => item.endIndex - item.startIndex > 1)!;
  assert.ok(branch); assert.notStrictEqual(branch.first.illumination.sunriseSunset.crossings, branch.last.illumination.sunriseSunset.crossings);
  const last = structuredClone(branch.last.illumination);
  branch.first.illumination.sunriseSunset.crossings[0].localDateTime = '伪造';
  assert.deepEqual(branch.last.illumination, last);
});
