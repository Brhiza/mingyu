import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 2024, month: 2, day: 19, hour: 11, minute: 24, second: 48, latitude: 39.9, longitude: 116.4, timezone: 8 };
const options = { includeStarMeanings: true };
const title = '【十一曜传统取象参考】';

test('十一曜取象按需加入提示词，标明整理来源并支持原盘追问', async () => {
  const base = await calculate('qizheng', { question: '问题', birth });
  const withMeanings = await calculate('qizheng', { question: '问题', birth, prompt: options });
  assert.ok(!base.prompt.text.includes(title));
  assert.ok(withMeanings.prompt.text.includes(title));
  for (const star of withMeanings.data.stars) assert.ok(withMeanings.prompt.text.includes(`${star.name}：`), star.name);
  assert.match(withMeanings.prompt.text, /项目整理.*未经古籍原文校核/);
  const originalData = structuredClone(withMeanings.data);
  delete originalData.input.prompt;
  assert.deepEqual(originalData, base.data);
  const next = await reprompt({ method: 'qizheng', result: withMeanings, question: '继续问' });
  assert.match(next.prompt.text, /继续问/);
  assert.ok(next.prompt.text.includes(title));
  const reset = await reprompt({ method: 'qizheng', result: withMeanings, question: '继续问', prompt: {} });
  assert.ok(!reset.prompt.text.includes(title));
});

test('出生范围多分支共享一份取象参考，追问可沿用或关闭', async () => {
  const result = await calculate('qizheng-range', { question: '问题', birth,
    range: { start: '2024-02-19T03:24:48Z', end: '2024-02-19T03:24:50Z' }, prompt: options });
  assert.equal(result.data.branches.length, 2);
  assert.equal(result.prompt.text.split(title).length - 1, 1);
  const follow = await reprompt({ method: 'qizheng-range', result, question: '继续问' });
  assert.equal(follow.prompt.text.split(title).length - 1, 1);
  const reset = await reprompt({ method: 'qizheng-range', result, question: '继续问', prompt: {} });
  assert.ok(!reset.prompt.text.includes(title));
});

test('HTTP 和 MCP 可发现取象选项并生成同一提示词', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng' };
  const get = (path: string) => worker.fetch(new Request(`https://local${path}`), env);
  const schema = await (await get('/api/schema?method=qizheng')).json() as any;
  assert.equal(schema.methods.qizheng.properties.prompt.properties.includeStarMeanings.type, 'boolean');
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body),
  }), env);
  const input = { question: '问题', birth, currentTime: '2025-01-01T00:00:00Z', prompt: options };
  const http = await send('/api/calculate', { method: 'qizheng', input });
  assert.equal(http.status, 200);
  const result = await http.json() as any;
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qizheng', arguments: input } });
  const message = await mcp.json() as any;
  assert.equal(message.result.structuredContent.prompt.text, result.prompt.text);
  assert.ok(result.prompt.text.includes(title));
});
