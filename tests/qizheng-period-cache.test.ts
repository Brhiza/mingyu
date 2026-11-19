import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateQizhengData } from '../src/systems/qizheng';
import { createPeriodSampleCache, scanPeriodEvents } from '../src/systems/qizheng/period-events';
import { sampleLongitudes } from '../src/systems/qizheng/positions';
import { resolveFlowTime, resolveFlowWindow } from '../src/systems/qizheng/flow-time';
import { sameJsonValue } from '../src/json-value';

const birth = { year: 2024, month: 2, day: 19, hour: 11, minute: 25, second: 0, latitude: 39.9, longitude: 116.4, timezone: 8 } as const;

test('缓存按精确时间和星曜补齐，不合并相邻时间与不同星曜', () => {
  const calls: Array<[number, readonly string[]]> = [];
  const cached = createPeriodSampleCache((timestamp, names) => {
    calls.push([timestamp, [...names]]);
    return names.map((name) => ({ name, longitude: timestamp + (name === '甲' ? 1 : 2) }));
  });
  assert.equal(cached(1000, ['甲']).get('甲'), 1001);
  assert.equal(cached(1000, ['甲', '乙']).get('乙'), 1002);
  assert.equal(cached(1000, ['甲']).get('甲'), 1001);
  assert.equal(cached(1000.5, ['甲']).get('甲'), 1001.5);
  assert.deepEqual(calls, [[1000, ['甲']], [1000, ['乙']], [1000.5, ['甲']]]);
  assert.throws(() => createPeriodSampleCache(() => [])(1000, ['缺失']), /缺少缺失的有效黄经/);
});

test('年、月、日扫描复用星位但分别重算不同本命盘的事件', async () => {
  const first = await calculateQizhengData({ birth });
  const second = await calculateQizhengData({ birth: { ...birth, second: 3 } });
  for (const flow of [{ kind: 'year', year: 2026 }, { kind: 'month', year: 2026, month: 6 }, { kind: 'day', year: 2026, month: 6, day: 15 }] as const) {
    const time = resolveFlowTime(flow, birth), window = resolveFlowWindow(flow, birth, time);
    const input = { ...window, timezone: 8, natalStars: first.stars, palaces: first.twelvePalaces };
    const other = { ...input, natalStars: second.stars, palaces: second.twelvePalaces };
    let calls = 0;
    const cache = createPeriodSampleCache((timestamp, names) => { calls++; return sampleLongitudes(timestamp, names); });
    const a = scanPeriodEvents(input, cache), callsAfterFirst = calls;
    const referenceA = scanPeriodEvents(input);
    assert.ok(sameJsonValue(a, referenceA, 1e-9), flow.kind);
    assert.ok(callsAfterFirst > 0);
    const b = scanPeriodEvents(other, cache), callsForSecond = calls - callsAfterFirst;
    const referenceB = scanPeriodEvents(other);
    assert.ok(sameJsonValue(b, referenceB, 1e-9), flow.kind);
    assert.ok(callsForSecond < callsAfterFirst, `${flow.kind}: ${callsForSecond} >= ${callsAfterFirst}`);
    assert.notDeepEqual(a.events, b.events, `${flow.kind} 不同出生秒应各自重算事件`);
    const before = structuredClone(b);
    if (a.events.length) a.events[0].text = '伪造';
    assert.deepEqual(b, before);
  }
});

test('显式注入的测试轨迹不会读取共享的真实星位缓存', () => {
  const start = Date.UTC(2030, 0, 1), hour = 3_600_000;
  const palaces = [...'戌酉申未午巳辰卯寅丑子亥'].map((signBranch, signIndex) => ({ palace: `宫${signIndex}`, signIndex, signBranch }));
  let syntheticCalls = 0;
  const sample = (timestamp: number, names: readonly string[]) => { syntheticCalls++; return names.map((name) => ({ name, longitude: name === '太阳' ? 29 + (timestamp - start) / hour : 200 })); };
  const unused = createPeriodSampleCache(() => { throw new Error('不得调用共享采样'); });
  const result = scanPeriodEvents({ startUtcMs: start, endUtcMs: start + 2 * hour, timezone: 0, mode: 'daily', natalStars: [], palaces, sample }, unused);
  assert.ok(syntheticCalls > 0);
  assert.ok(result.events.some((event) => event.kind === '换宫' && event.movingStar === '太阳' && event.utcTimestamp === start + hour));
});
