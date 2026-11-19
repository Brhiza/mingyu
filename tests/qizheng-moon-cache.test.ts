import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { sameJsonValue } from '../src/json-value';
import { createQizhengMoonPhaseCalculator, qizhengMoonPhase } from '../src/systems/qizheng/moon-phase';

// 四正时刻用于定位测试窗口，实际边界以当前七政同源模型求根结果为准。
const events = [
  ['朔', '2024-04-08T18:21:00Z'], ['上弦', '2024-04-15T19:13:00Z'],
  ['望', '2024-04-23T23:49:00Z'], ['下弦', '2024-05-01T11:27:00Z'],
] as const;
function eventAt(time: string) { return qizhengMoonPhase(Date.parse(time) - 60_000).next.utcTimestamp; }

test('四正前后各秒与独立计算一致，当前事件只出现在交界秒', () => {
  const cached = createQizhengMoonPhaseCalculator();
  for (const [name, time] of events) {
    const event = eventAt(time);
    for (const delta of [-2000, -1000, 0, 1000, 2000]) {
      const actual = cached(event + delta), expected = qizhengMoonPhase(event + delta);
      assert.ok(sameJsonValue(actual, expected, 1e-9), `${name}/${delta}`);
      assert.equal(actual.current?.name ?? null, delta === 0 ? name : null);
      assert.ok(actual.previous.utcTimestamp < event + delta); assert.ok(actual.next.utcTimestamp > event + delta);
    }
  }
});

test('大范围向前、向后跳转会重新定位事件，结果不共享可变引用', () => {
  const cached = createQizhengMoonPhaseCalculator();
  for (const time of ['1900-01-01T00:00:00Z', '2024-04-08T18:21:00Z', '2100-12-31T00:00:00Z', '1969-09-30T12:00:00Z', '2024-04-08T18:21:00Z']) {
    const timestamp = Date.parse(time);
    assert.ok(sameJsonValue(cached(timestamp), qizhengMoonPhase(timestamp), 1e-9), time);
  }
  const timestamp = eventAt(events[0][1]), first = cached(timestamp), expected = qizhengMoonPhase(timestamp);
  assert.ok(first.current); assert.notStrictEqual(first.previous, first.next);
  first.previous.name = '伪造' as typeof first.previous.name;
  first.current!.residualDegrees = 999;
  first.next.utcTimestamp = 0;
  assert.ok(sameJsonValue(cached(timestamp), expected, 1e-9));
  assert.throws(() => cached(Number.NaN), /有效出生时刻/);
});

test('出生范围跨越四正时，交界秒单独保留并与单盘对应', async () => {
  for (const [name, time] of events) {
    const event = eventAt(time), start = event - 2000;
    const clock = (timestamp: number) => {
      const local = new Date(timestamp + 8 * 3_600_000);
      return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate(), hour: local.getUTCHours(), minute: local.getUTCMinutes(), second: local.getUTCSeconds() };
    };
    const iso = (timestamp: number) => `${new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 19)}+08:00`;
    const birth = { ...clock(start), latitude: 39.9, longitude: 116.4, timezone: 8 };
    const range = await calculate('qizheng-range', { question: '问题', birth, range: { start: iso(start), end: iso(start + 5000) } });
    assert.deepEqual(range.data.branches.map((branch) => [branch.startIndex, branch.endIndex]), [[0, 2], [2, 3], [3, 5]], name);
    assert.equal(range.data.branches[1].first.moonPhase.current?.name, name);
    for (const branch of range.data.branches) for (const [chart, index] of [[branch.first, branch.startIndex], [branch.last, branch.endIndex - 1]] as const) {
      const single = await calculate('qizheng', { question: '问题', birth: { ...birth, ...clock(start + index * 1000) } });
      assert.ok(sameJsonValue(chart.moonPhase, single.data.moonPhase, 1e-9), `${name}/${index}`);
    }
  }
});
