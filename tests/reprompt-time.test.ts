import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const originalTime = '2020-01-01T00:00:00Z';
const referenceTime = '2030-06-01T12:34:56+08:00';
const question = '原问题';

function isCurrent(value: string, before: number, after: number) {
  const timestamp = Date.parse(value);
  assert.ok(Number.isFinite(timestamp) && timestamp >= before && timestamp <= after, `${value} 应在本次调用期间`);
}

test('追问使用调用时间或指定参考时间，保留实际牌面、起卦时间和原结果', async () => {
  for (const [method, input] of [
    ['tarot', { tarot: { spread: 'three' } }],
    ['lenormand', { lenormand: { spread: 'three' } }],
    ['liuyao', { liuyao: { method: 'coins' } }],
    ['jinkoujue', { jinkoujue: { method: 'random' } }],
    ['random-divination', { methods: ['tarot'] }],
  ] as const) {
    const saved = JSON.parse(JSON.stringify(await calculate(method, { ...input, question, currentTime: originalTime })));
    const beforeResult = JSON.stringify(saved);
    const before = Date.now();
    const reply = await reprompt({ method, result: saved, question: '继续追问' });
    const after = Date.now();
    isCurrent(reply.currentTime, before, after);
    assert.ok(reply.prompt.text.includes(reply.currentTime), method);
    assert.match(reply.prompt.text, /继续追问/, method);
    if (method === 'liuyao' || method === 'jinkoujue') {
      assert.ok(reply.prompt.text.includes(new Date(saved.data.timestamp).toISOString()), `${method}: 原起卦时间`);
    }
    if (method === 'tarot' || method === 'lenormand') for (const card of saved.data.cards) assert.ok(reply.prompt.text.includes(card.name), method);
    if (method === 'random-divination') for (const card of saved.data.result.data.cards) assert.ok(reply.prompt.text.includes(card.name), method);
    const specified = await reprompt({ method, result: saved, question, currentTime: referenceTime });
    assert.equal(specified.currentTime, referenceTime);
    assert.ok(specified.prompt.text.includes(referenceTime), method);
    const original = await reprompt({ method, result: saved, question, currentTime: originalTime });
    assert.equal(original.prompt.text, saved.prompt.text, method);
    assert.equal(JSON.stringify(saved), beforeResult, `${method}: 不修改保存结果`);
  }
});

test('HTTP 和 MCP 追问共享参考时间语义，原牌面始终不变', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'tarot' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const computed = await send('/api/calculate', { method: 'tarot', input: { question, currentTime: originalTime, tarot: { spread: 'three' } } });
  const result: any = await computed.json();
  const args = { method: 'tarot', result, question: '继续问' };
  const before = Date.now();
  const http = await send('/api/prompt', args); assert.equal(http.status, 200);
  const output: any = await http.json(); isCurrent(output.currentTime, before, Date.now());
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'reprompt', arguments: { ...args, currentTime: referenceTime } } });
  const mcpOutput: any = await mcp.json();
  assert.equal(mcpOutput.result.structuredContent.currentTime, referenceTime);
  assert.ok(mcpOutput.result.structuredContent.prompt.text.includes(referenceTime));
  for (const card of result.data.cards) {
    assert.ok(output.prompt.text.includes(card.name));
    assert.ok(mcpOutput.result.structuredContent.prompt.text.includes(card.name));
  }
});
