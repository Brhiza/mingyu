import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 2024, month: 2, day: 19, hour: 11, minute: 24, second: 48, latitude: 39.9, longitude: 116.4, timezone: 8 };
const at = (time: string) => ({ question: '事业如何', birth, gender: 'female', flow: { kind: 'instant', at: time } });

test('七政行限按实际瞬时判断先后，出生当秒可用，出生前一秒不可用', async () => {
  await assert.rejects(() => calculate('qizheng', at('2024-02-19T03:24:47Z')), /不得早于出生时刻/);
  const same = await calculate('qizheng', at('2024-02-19T11:24:48+08:00'));
  assert.equal(same.data.timeLords?.nominalAge, 1);
  assert.ok(same.data.mingDu);
  assert.equal(same.data.mingDu.method, '太阳同度立命');
  assert.ok(same.data.mingDu.duZhu);
  assert.equal(same.data.timeLords?.dongweiStandard.mingGongYears, 15);
  assert.equal(same.data.timeLords?.dongweiStandard.limits.length, 12);
  assert.match(same.prompt.text, /太阳同度立命度/);
  assert.match(same.prompt.text, /洞微百岁定式参考/);
  assert.equal(same.data.flowing?.time.timestamp, same.data.basis.utcTimestamp);
  assert.match((await reprompt({ method: 'qizheng', result: same, question: '继续问' })).prompt.text, /继续问/);
  const after = await calculate('qizheng', at('2024-02-19T03:24:49Z'));
  assert.equal(after.data.timeLords?.nominalAge, 1);
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, gender: 'female', flow: { kind: 'year', year: 2024 } }), /不得早于出生时刻/);
  const beforeWithoutLimits = await calculate('qizheng', { question: '问题', birth, flow: { kind: 'instant', at: '2024-02-19T03:24:47Z' } });
  assert.equal(beforeWithoutLimits.data.timeLords, null);
});

test('出生范围不能把出生前流曜当作所有候选的行限', async () => {
  const input = { question: '问题', birth, gender: 'female', flow: { kind: 'instant', at: '2024-02-19T03:24:49Z' },
    range: { start: '2024-02-19T03:24:48Z', end: '2024-02-19T03:24:51Z', pageSize: 3 } };
  await assert.rejects(() => calculate('qizheng-range', input), /不得早于出生时刻/);
  await assert.rejects(() => calculate('qizheng-range', { ...input, range: { ...input.range, pageSize: 1 } }), /所有候选/);
  const valid = await calculate('qizheng-range', { ...input, flow: { kind: 'instant', at: '2024-02-19T03:24:50Z' } });
  assert.equal(valid.data.range.endIndex, 3);
});

test('HTTP 与 MCP 都拒绝早于出生的行限时点', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body),
  }), env);
  const input = at('2024-02-19T03:24:47Z');
  const http = await send('/api/calculate', { method: 'qizheng', input });
  assert.equal(http.status, 400);
  assert.match((await http.json() as { error: string }).error, /不得早于出生时刻/);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qizheng', arguments: input } });
  const body = await mcp.json() as any;
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /不得早于出生时刻/);
});
