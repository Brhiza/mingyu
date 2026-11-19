import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const question = '解释这份资料';

test('资料表追问复核来源、行文和参数，不混用排盘口径', async () => {
  for (const huangji of [
    { mode: 'reference', table: 'sound-rhythm' },
    { mode: 'reference', table: 'animal-plant' },
    { mode: 'reference', table: 'historical-era', shiIndex: 2190 },
  ]) {
    const saved = JSON.parse(JSON.stringify(await calculate('huangji-jingshi', { currentTime, question, huangji })));
    const next = await reprompt({ method: 'huangji-jingshi', result: saved, question: '继续解释' });
    assert.match(next.prompt.text, /继续解释/);
    assert.ok(next.prompt.text.includes(saved.data.reference.title));
    const changed = structuredClone(saved); changed.data.reference.title = '伪造资料';
    await assert.rejects(() => reprompt({ method: 'huangji-jingshi', result: changed, question: '追问' }), /不一致/);
  }
  for (const huangji of [
    { mode: 'reference', table: 'historical-era' },
    { mode: 'reference', table: 'historical-era', shiIndex: 2148 },
    { mode: 'reference', table: 'historical-era', shiIndex: 2209 },
    { mode: 'reference', table: 'animal-plant', shiIndex: 2190 },
    { mode: 'reference', table: 'unknown' },
  ]) await assert.rejects(() => calculate('huangji-jingshi', { currentTime, question, huangji }));
  await assert.rejects(() => calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'reference', table: 'sound-rhythm' }, prompt: { schools: ['yuanhui'] } }));
});

test('Worker HTTP 和 MCP 提供原表及追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'huangji-jingshi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { currentTime, question, huangji: { mode: 'reference', table: 'historical-era', shiIndex: 2190 } };
  const response = await send('/api/calculate', { method: 'huangji-jingshi', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'huangji-jingshi', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'huangji-jingshi', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.reference.rows.length, 30);
});
test('全部经辰表分页保留三十行与出处，资料表注明来源', async () => {
  for (const table of ['sound-rhythm', 'animal-plant'] as const) {
    const result = await calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'reference', table } });
    assert.ok(result.prompt.text.includes(result.data.reference.title));
    assert.ok(result.data.reference.source.every((source) => result.prompt.text.includes(source.revision)));
  }
  for (let shiIndex = 2149; shiIndex <= 2208; shiIndex++) {
    const result = await calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'reference', table: 'historical-era', shiIndex } });
    assert.equal(result.data.reference.shiIndex, shiIndex);
    assert.equal(result.data.reference.rows.length, 30);
    assert.ok(result.prompt.text.includes(result.data.reference.source.revision));
    for (const row of result.data.reference.rows) if (row.sourceText) assert.ok(result.prompt.text.includes(row.sourceText));
  }
});
