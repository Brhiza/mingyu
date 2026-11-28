import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const p1 = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
const p2 = { year: 1992, month: 8, day: 12, hour: 9, minute: 0, latitude: 31.2, longitude: 121.5, timezone: 8 };
const input = { question: '双方怎样相处？', person1: p1, person2: p2 };

test('计算点筛选、容许度、截断与接纳使用全部命中相位', async () => {
  const options = { points: ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const, maxAspects: 1, includeHouseOverlays: false, aspectOrbs: { conjunction: 2 } };
  const limited = await calculate('astrolabe-synastry', { ...input, options });
  const full = await calculate('astrolabe-synastry', { ...input, options: { ...options, maxAspects: 200 } });
  assert.equal(limited.data.settings.aspectOrbs.conjunction, 2); assert.equal(limited.data.overlays.length, 0);
  assert.equal(limited.data.aspects.length, Math.min(1, limited.data.counts.matchedAspects));
  assert.equal(limited.data.counts.omittedAspects, limited.data.counts.matchedAspects - limited.data.aspects.length);
  assert.deepEqual(limited.data.receptions, full.data.receptions); assert.equal(limited.data.settings.includeAsteroids, false);
  const selected = await calculate('astrolabe-synastry', { ...input, options: { points: ['juno', 'sun'] } });
  assert.equal(selected.data.settings.includeAsteroids, true); assert.equal(selected.data.counts.evaluatedPairs, 4); assert.equal(selected.data.overlays.length, 4);
  await assert.rejects(() => calculate('astrolabe-synastry', { ...input, options: { points: ['sun', 'sun'] } }));
  await assert.rejects(() => calculate('astrolabe-synastry', { ...input, options: { points: ['fake'] } }));
  await assert.rejects(() => calculate('astrolabe-synastry', { ...input, options: { aspectOrbs: { square: 0 } } }));
});

test('保存追问、篡改拒绝、HTTP 与 MCP 调用', async () => {
  const result = await calculate('astrolabe-synastry', { ...input, prompt: { schools: ['traditional'] } });
  const saved = JSON.parse(JSON.stringify(result));
  const reply = await reprompt({ method: 'astrolabe-synastry', result: saved, question: '如何沟通？' });
  assert.match(reply.prompt.text, /如何沟通/); assert.match(reply.prompt.text, /传统占星/); assert.match(reply.prompt.text, /双方本命计算点/);
  saved.data.overlays[0].house = 12; await assert.rejects(() => reprompt({ method: 'astrolabe-synastry', result: saved, question: '追问' }), /不一致/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'astrolabe-synastry' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'astrolabe-synastry', input }); assert.equal(http.status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'astrolabe-synastry', arguments: input } }); assert.equal(mcp.status, 200);
  const data: any = await mcp.json(); assert.equal(data.result.structuredContent.data.counts.selectedPoints1, 18);
});

test('西洋双盘支持最短圆弧组合中点盘与双人流年行运合参', async () => {
  const result = await calculate('astrolabe-synastry', {
    ...input,
    referenceTime: '2026-06-15T12:00:00Z',
    options: { includeComposite: true },
    prompt: { schools: ['modern', 'timing'] },
  });
  assert.ok(result.data.composite);
  assert.equal(result.data.composite.houses.length, 12);
  assert.equal(result.data.composite.points.length, 18);
  assert.ok(result.data.transits);
  assert.equal(result.data.transits.referenceTime, '2026-06-15T12:00:00Z');
  assert.match(result.prompt.text, /【组合中点盘】/);
  assert.match(result.prompt.text, /【双人行运合参（Transit）】/);
  const noComposite = await calculate('astrolabe-synastry', { ...input, options: { includeComposite: false } });
  assert.equal(noComposite.data.composite, undefined);
});
