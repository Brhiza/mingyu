import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
const input = { question: '事业如何？', birth, options: { includeAsteroids: true } };

test('时区、高纬降级、真太阳时和出生信息边界', async () => {
  const baseline = await calculate('astrolabe', { ...input, options: undefined });
  assert.equal(baseline.data.points.length, 13);
  const solar = await calculate('astrolabe', { ...input, options: undefined, birth: { ...birth, useTrueSolarTime: true } });
  assert.deepEqual(solar.data.points, baseline.data.points); assert.ok(solar.data.basis.trueSolarTimeCorrection);
  const polar = await calculate('astrolabe', { ...input, options: undefined, birth: { ...birth, latitude: 80 } });
  assert.equal(polar.data.basis.houseSystem, 'whole_sign'); assert.match(polar.prompt.text, /已改用整宫/);
  const ny = { ...birth, year: 2024, month: 7, day: 15, hour: 12, minute: 0, timezone: undefined, timeZoneId: 'America/New_York' };
  const result = await calculate('astrolabe', { ...input, options: undefined, birth: ny });
  assert.equal(result.data.basis.utcDateTime, '2024-07-15T16:00:00.000Z');
  await assert.rejects(() => calculate('astrolabe', { ...input, birth: { ...ny, month: 11, day: 3, hour: 1, minute: 30 } }));
  await assert.rejects(() => calculate('astrolabe', { ...input, birth: { ...birth, latitude: 90 } }));
  await assert.rejects(() => calculate('astrolabe', { ...input, birth: { ...birth, month: 2, day: 30 } }));
  await assert.rejects(() => calculate('astrolabe', { ...input, birth: { ...birth, year: 1899 } }));
});

test('保存与追问核对盘面，Worker HTTP 和 MCP 使用同一独立能力', async () => {
  const result = await calculate('astrolabe', input);
  const next = await reprompt({ method: 'astrolabe', result: JSON.parse(JSON.stringify(result)), question: '继续询问', prompt: { schools: ['traditional'] } });
  assert.match(next.prompt.text, /继续询问/); assert.match(next.prompt.text, /传统占星/);
  const altered = structuredClone(result); altered.data.points[0].longitude += 1;
  await assert.rejects(() => reprompt({ method: 'astrolabe', result: altered, question: '继续询问' }), /不一致/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'astrolabe' };
  const request = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await request('/api/calculate', { method: 'astrolabe', input }); assert.equal(http.status, 200);
  const mcp = await request('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'astrolabe', arguments: input } });
  assert.equal(mcp.status, 200); const json: any = await mcp.json(); assert.equal(json.result.structuredContent.data.points.length, 17);
  assert.equal(json.result.structuredContent.data.distributions.elements.reduce((sum: number, item: any) => sum + item.members.length, 0), 10);
  assert.ok(Array.isArray(json.result.structuredContent.data.patterns)); assert.match(json.result.structuredContent.prompt.text, /十大星体格局/);
});
