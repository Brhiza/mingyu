import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { sampleLongitudes, positionsAt } from '../src/systems/qizheng/positions';
import { scanPeriodEvents } from '../src/systems/qizheng/period-events';
import * as AstronomyEngine from 'astronomy-engine';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
const start = Date.UTC(2030, 0, 1), hour = 3_600_000;
const palaces = [...'戌酉申未午巳辰卯寅丑子亥'].map((signBranch, signIndex) => ({ palace: `宫${signIndex}`, signIndex, signBranch }));
const track = (f: (hours: number) => number) => (timestamp: number, names: readonly string[]) => names.map((name) => ({ name, longitude: name === '太阳' ? f((timestamp - start) / hour) : 200 }));
const scan = (duration: number, f: (hours: number) => number, natalStars: Array<{ name: string; longitude: number }> = [], mode: 'yearly' | 'monthly' | 'daily' = 'daily') => scanPeriodEvents({ startUtcMs: start, endUtcMs: start + duration * hour, timezone: 0, mode, natalStars, palaces, sample: track(f) });

test('按需采样与完整星位的黄经一致，未知星曜报错', () => {
  for (const year of [1900, 1950, 2024, 2100, 2200]) {
    const timestamp = Date.UTC(year, 5, 15, 12), positions = positionsAt(timestamp), names = positions.map((star) => star.name);
    const samples = sampleLongitudes(timestamp, names);
    assert.equal(samples.length, 11);
    for (const star of positions) assert.ok(Math.abs(star.longitude - samples.find((sample) => sample.name === star.name)!.longitude) < 1e-9, `${year}/${star.name}`);
  }
  assert.throws(() => sampleLongitudes(start, ['不存在']), /未知星曜/);
});

test('半开端点、内部采样点和不足一毫秒的周期末事件', () => {
  const natal = [{ name: '本命星', longitude: 330 }];
  for (const direction of [1, -1]) {
    assert.equal(scan(1, (t) => 30 + direction * (t - 1), natal).events.filter((event) => event.movingStar === '太阳').length, 0);
    const middle = scan(2, (t) => 30 + direction * (t - 1), natal).events.filter((event) => event.movingStar === '太阳');
    assert.equal(middle.filter((event) => event.kind === '换宫').length, 1);
    assert.equal(middle.filter((event) => event.kind === '精确吊照').length, 1);
    assert.ok(middle.every((event) => event.utcTimestamp === start + hour));
    const first = scan(1, (t) => 30 + direction * t, natal).events.filter((event) => event.movingStar === '太阳');
    assert.ok(first.some((event) => event.kind === '换宫' && event.utcTimestamp === start));
    assert.ok(first.some((event) => event.kind === '精确吊照' && event.utcTimestamp === start));
  }
  const almostEnd = scan(1, (t) => 29 + (t * hour) / (hour - 0.4));
  const ingress = almostEnd.events.find((event) => event.kind === '换宫' && event.movingStar === '太阳');
  assert.ok(ingress); assert.equal(ingress.utcTimestamp, start + hour - 1000);
});

test('停逆附近同段内两次吊照和两次换宫均保留', () => {
  const crossing = scan(12, (t) => 30.1 - 0.01 * (t - 6) ** 2, [{ name: '本命星', longitude: 29.9 }], 'monthly');
  const own = crossing.events.filter((event) => event.movingStar === '太阳');
  assert.equal(own.filter((event) => event.kind === '停逆').length, 1);
  assert.deepEqual(own.filter((event) => event.kind === '换宫').map((event) => event.signBranch), ['酉', '戌']);
  assert.equal(own.filter((event) => event.kind === '精确吊照' && event.aspectType === '同宫').length, 2);
  assert.ok(own.find((event) => event.kind === '停逆')!.utcTimestamp === start + 6 * hour);
});

test('停逆落在窗口或采样端点时仅记录一次，周期终点除外', () => {
  for (const mode of ['yearly', 'monthly', 'daily'] as const) for (const direction of [1, -1]) for (const position of [0, 0.5, 8, 12, 24, 48, 72, 96]) {
    const result = scan(96, (t) => (360 + direction * 0.001 * (t - position) ** 2) % 360, [], mode);
    const events = result.events.filter((event) => event.movingStar === '太阳' && event.kind === '停逆');
    assert.equal(events.length, position === 96 ? 0 : 1, `${mode}/${direction}/${position}`);
    if (position !== 96) {
      assert.ok(Math.abs(events[0].utcTimestamp - (start + position * hour)) < 2000);
      assert.equal(events[0].stationDirection, direction === 1 ? '顺行' : '逆行');
    }
  }
});

test('罗睺停逆与同一星历的独立六阶速度参考收敛', async () => {
  const namespace = AstronomyEngine as unknown as Record<string, unknown>;
  const astronomy = (Reflect.get(namespace, 'default') ?? AstronomyEngine) as typeof AstronomyEngine;
  const result = await calculate('qizheng', { question: '问题', birth, flow: { kind: 'year', year: 2024 }, periodEvents: true });
  const wrap = (value: number) => ((value + 540) % 360) - 180;
  const node = (timestamp: number, stepSeconds: number) => {
    const time = astronomy.MakeTime(new Date(timestamp)), step = stepSeconds / 86_400, center = astronomy.GeoMoon(time);
    const samples = [-3, -2, -1, 1, 2, 3].map((offset) => astronomy.GeoMoon(time.AddDays(offset * step)));
    const velocity = (axis: 'x' | 'y' | 'z') => (45 * (samples[3][axis] - samples[2][axis]) - 9 * (samples[4][axis] - samples[1][axis]) + samples[5][axis] - samples[0][axis]) / (60 * step);
    const vx = velocity('x'), vy = velocity('y'), vz = velocity('z');
    const momentum = new astronomy.Vector(center.y * vz - center.z * vy, center.z * vx - center.x * vz, center.x * vy - center.y * vx, time);
    const vector = astronomy.RotateVector(astronomy.Rotation_EQJ_ECT(time), momentum);
    return ((Math.atan2(vector.x, -vector.y) * 180 / Math.PI + 360) % 360);
  };
  const speed = (timestamp: number, step: number) => wrap(node(timestamp + 60_000, step) - node(timestamp - 60_000, step));
  for (const [left, right, direction] of [[Date.UTC(2024, 3, 5, 12), Date.UTC(2024, 3, 5, 20), '顺行'], [Date.UTC(2024, 8, 11, 2), Date.UTC(2024, 8, 11, 9), '逆行'], [Date.UTC(2024, 9, 10, 12), Date.UTC(2024, 9, 10, 23), '顺行']] as const) {
    const matches = result.data.flowing.period.events.filter((event: any) => event.kind === '停逆' && event.movingStar === '罗睺(火余)' && event.utcTimestamp > left && event.utcTimestamp < right);
    assert.equal(matches.length, 1); assert.equal(matches[0].stationDirection, direction);
    for (const step of [3600, 7200, 14400]) {
      let a = left, b = right, first = speed(a, step);
      for (let i = 0; i < 32; i++) { const mid = (a + b) / 2, value = speed(mid, step); if (Math.sign(value) === Math.sign(first)) { a = mid; first = value; } else b = mid; }
      assert.ok(Math.abs(matches[0].utcTimestamp - (a + b) / 2) < 10_000);
    }
  }
});

test('周期区间、夏令时、提示词明细及原盘重算', async () => {
  const person = { ...birth, year: 1990, month: 1, day: 15, timezone: -5, timeZoneId: 'America/New_York', latitude: 40.7, longitude: -74 };
  for (const [date, hours] of [[10, 23], [11, 24]] as const) {
    const result = await calculate('qizheng', { question: '问题', birth: person, flow: { kind: 'day', year: 2024, month: 3, day: date }, periodEvents: true });
    assert.equal(result.data.flowing.period.endUtcMs - result.data.flowing.period.startUtcMs, hours * hour);
    assert.ok(result.data.flowing.period.events.every((item: any) => item.utcTimestamp >= result.data.flowing.period.startUtcMs && item.utcTimestamp < result.data.flowing.period.endUtcMs));
  }
  const fall = await calculate('qizheng', { question: '问题', birth: person, flow: { kind: 'day', year: 2024, month: 11, day: 3 }, periodEvents: true });
  assert.equal(fall.data.flowing.period.endUtcMs - fall.data.flowing.period.startUtcMs, 25 * hour);
  const march = await calculate('qizheng', { question: '问题', birth: person, flow: { kind: 'month', year: 2024, month: 3 }, periodEvents: true });
  assert.deepEqual([...new Set<number>(march.data.flowing.period.events.map((event: any) => event.timezone))].sort((a, b) => a - b), [-5, -4]);
  const apia = { ...birth, latitude: -13.8, longitude: -171.75, timezone: undefined, timeZoneId: 'Pacific/Apia' };
  const skipped = await calculate('qizheng', { question: '问题', birth: apia, flow: { kind: 'day', year: 2011, month: 12, day: 29 }, periodEvents: true });
  assert.equal(skipped.data.flowing.period.endUtcMs - skipped.data.flowing.period.startUtcMs, 24 * hour);
  const input = { question: '问题', birth, flow: { kind: 'year', year: 2026 }, periodEvents: true };
  const result = await calculate('qizheng', input), saved = JSON.parse(JSON.stringify(result));
  assert.ok(result.data.flowing.period.events.length > 20);
  assert.match(result.prompt.text, /其余\d+项见结构化结果/);
  const full = await reprompt({ method: 'qizheng', result: saved, question: '全部', prompt: { eventDetail: 'full' } });
  assert.ok(full.prompt.text.includes(result.data.flowing.period.events.at(-1).text));
  const altered = structuredClone(saved); altered.data.flowing.period.events[0].movingStar = '伪造';
  await assert.rejects(() => reprompt({ method: 'qizheng', result: altered, question: '问题' }), /不一致/);
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, periodEvents: true }));
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, flow: { kind: 'year', year: 2026 }, prompt: { eventDetail: 'full' } }), /启用周期扫描/);
});
