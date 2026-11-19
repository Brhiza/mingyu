import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
const input = { birth, question: '今年如何？', flow: { reference: { kind: 'day', year: 2025, month: 5, day: 15 } } } as const;

test('四种推运进入提示词，太阳返照与本命太阳黄经一致', async () => {
  const result = await calculate('astrolabe', input), flow = result.data.flow!;
  assert.equal(flow.reference.utcDateTime, '2025-05-15T04:00:00.000Z');
  assert.ok(flow.transit);
  assert.equal(flow.secondary!.status, 'calculated');
  assert.equal(flow.solarArc!.status, 'calculated');
  assert.equal(flow.solarReturn!.status, 'calculated');
  if (flow.solarReturn!.status !== 'calculated') throw new Error('返照不可用');
  const natalSun = result.data.points.find((point) => point.id === 'sun')!.longitude;
  for (const chart of flow.solarReturn.charts) {
    const returnSun = chart.points.find((point) => point.id === 'sun')!.longitude;
    assert.ok(Math.abs(((returnSun - natalSun + 540) % 360) - 180) < 0.00001);
  }
  assert.ok(Date.parse(flow.solarReturn.previousUtcDateTime!) <= Date.parse(flow.reference.utcDateTime));
  assert.ok(Date.parse(flow.solarReturn.nextUtcDateTime!) > Date.parse(flow.reference.utcDateTime));
  for (const name of ['行运快照', '太阳返照', '次限', '太阳弧']) assert.ok(result.prompt.text.includes(name), name);
});

test('年、月、日与明确瞬时的时区、边界和技术选择', async () => {
  const zoneBirth = { ...birth, timezone: undefined, timeZoneId: 'America/New_York' };
  const year = await calculate('astrolabe', { birth: zoneBirth, question: '问题', flow: { reference: { kind: 'year', year: 2025 }, techniques: ['transit'] } });
  const month = await calculate('astrolabe', { birth: zoneBirth, question: '问题', flow: { reference: { kind: 'month', year: 2025, month: 1 }, techniques: ['transit'] } });
  assert.equal(year.data.flow!.reference.utcDateTime, '2025-07-01T16:00:00.000Z');
  assert.equal(month.data.flow!.reference.utcDateTime, '2025-01-15T17:00:00.000Z');
  assert.equal(year.data.flow!.solarReturn, null); assert.equal(year.data.flow!.secondary, null);
  const exact = await calculate('astrolabe', { birth, question: '问题', flow: { reference: { kind: 'instant', at: '2025-01-15T12:34:56+08:00' }, techniques: ['secondary', 'solar-arc'] } });
  assert.equal(exact.data.flow!.reference.utcDateTime, '2025-01-15T04:34:56.000Z'); assert.equal(exact.data.flow!.transit, null);
  const earlier = await calculate('astrolabe', { birth, question: '问题', flow: { reference: { kind: 'year', year: 1980 } } });
  assert.ok(earlier.data.flow!.transit); assert.equal(earlier.data.flow!.secondary!.status, 'not-applicable'); assert.equal(earlier.data.flow!.solarReturn!.status, 'not-applicable');
  await assert.rejects(() => calculate('astrolabe', { birth, question: '问题', flow: { reference: { kind: 'day', year: 2025, month: 2, day: 30 } } }));
  await assert.rejects(() => calculate('astrolabe', { birth, question: '问题', flow: { reference: { kind: 'instant', at: '2200-01-01T00:00:00Z' } } }));
  await assert.rejects(() => calculate('astrolabe', { birth, question: '问题', flow: { reference: { kind: 'year', year: 2025 }, techniques: ['transit', 'transit'] } }));
});

test('推运保存追问和结果校验，以及 Worker HTTP/MCP 调用', async () => {
  const result = await calculate('astrolabe', input);
  const saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'astrolabe', result: saved, question: '继续问', prompt: { schools: ['timing'] } });
  assert.match(next.prompt.text, /继续问/); assert.match(next.prompt.text, /推运参考/); assert.match(next.prompt.text, /行运快照/);
  saved.data.flow.solarArc.arcDegrees += 1; await assert.rejects(() => reprompt({ method: 'astrolabe', result: saved, question: '追问' }), /不一致/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'astrolabe' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'astrolabe', input }); assert.equal(http.status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'astrolabe', arguments: input } }); assert.equal(mcp.status, 200);
  const response: any = await mcp.json(); assert.equal(response.result.structuredContent.data.flow.reference.utcDateTime, '2025-05-15T04:00:00.000Z');
});
