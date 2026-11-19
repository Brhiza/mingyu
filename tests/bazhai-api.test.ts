import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { question: '住宅方向如何？', person: { kind: 'birth', year: 2024, month: 2, day: 4, gender: 'female', timezone: 8 }, house: { kind: 'measurement', reading: 'door-to-interior', degree: 22.5, northReference: 'true', uncertaintyDegrees: 1 } };

test('出生和测量均跨边界时完整保留命宅候选并生成提示词', async () => {
  const result = await calculate('bazhai', input);
  assert.deepEqual(result.data.birth.years, [2023, 2024]);
  assert.equal(result.data.measurement.stability, '宅卦不稳定');
  assert.equal(result.data.persons.length, 2); assert.equal(result.data.houses.length, 2);
  assert.equal(result.data.comparisons.length, 4);
  assert.ok(result.data.comparisons.every((item: any) => item.directions.length === 8));
  assert.ok(result.data.housePalaces.every((item: any) => item.starPalaces.length === 8));
  assert.match(result.prompt.text, /星宫生克/);
  assert.match(result.prompt.text, /不能选一个候选冒充已确定/);
  assert.match(result.prompt.text, /不包含玄空飞星/);
});

test('直接命卦、磁北修正与输入错误和保存追问', async () => {
  const initial = await calculate('bazhai', { question: '问题', person: { kind: 'gua', mingGua: '坎' }, house: { kind: 'measurement', reading: 'sit', degree: 355, northReference: 'magnetic', magneticDeclinationDegrees: 10 } });
  assert.equal(initial.data.measurement.correctedDegree, 5);
  assert.equal(initial.data.houses[0].sitMountain, '子');
  const saved = JSON.parse(JSON.stringify(initial));
  assert.match((await reprompt({ method: 'bazhai', result: saved, question: '继续问' })).prompt.text, /继续问/);
  const alteredStar = structuredClone(saved); alteredStar.data.housePalaces[0].starPalaces[0].relation = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazhai', result: alteredStar, question: '继续问' }), /不一致/);
  saved.data.comparisons[0].directions[0].house = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazhai', result: saved, question: '继续问' }), /不一致/);
  await assert.rejects(() => calculate('bazhai', { question: '问题', person: { kind: 'gua', mingGua: '坎' }, house: { kind: 'measurement', reading: 'sit', degree: 1, northReference: 'magnetic' } }));
  await assert.rejects(() => calculate('bazhai', { question: '问题', person: { kind: 'birth', year: 2024, month: 2, gender: 'male' } }));
  await assert.rejects(() => calculate('bazhai', { question: '问题', person: { kind: 'gua', mingGua: '坎' }, house: { kind: 'mountain', sitMountain: '错' } }));
});

test('Worker HTTP 与 MCP 共享八宅结果和追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazhai' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazhai', input }); assert.equal(http.status, 200);
  const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazhai', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'bazhai', result: saved, question: '继续' })).status, 200);
});
