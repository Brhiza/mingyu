import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { methodIds, type Method } from '../src/schema';
import { methodExamples } from '../scripts/method-examples.mjs';
import worker from '../src/worker';

test('所有术数的计算与追问只返回一份提示词文本', async () => {
  assert.deepEqual(Object.keys(methodExamples), methodIds);
  for (const method of methodIds) {
    const input = { ...methodExamples[method], currentTime: '2025-01-01T00:00:00Z' };
    const saved = JSON.parse(JSON.stringify(await calculate(method as Method, input)));
    assert.equal('auditEvidence' in saved, false, method);
    if (method === 'random-divination') assert.equal('auditEvidence' in saved.data.result, false, method);
    assert.deepEqual(Object.keys(saved.prompt), ['text'], method);
    assert.ok(saved.prompt.text.length > 0, method);
    const next = await reprompt({ method, result: saved, question: '继续提问' });
    assert.deepEqual(Object.keys(next.prompt), ['text'], method);
    assert.match(next.prompt.text, /继续提问/, method);
  }
});

test('范围盘面直接保留各分支的证据，保存追问无需重复的顶层副本', async () => {
  const currentTime = '2025-01-01T00:00:00Z';
  const range = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };
  const cases = [
    ['qimen', { qimen: { scope: 'hour' } }, 'data', 'evidenceAnalysis'],
    ['liuyao', { liuyao: { method: 'manual', yaos: [6, 7, 8, 9, 7, 8] } }, 'data', 'evidenceAnalysis'],
    ['liuren', {}, 'data', 'evidenceAnalysis'],
    ['jinkoujue', { jinkoujue: { method: 'branch', branch: '午' } }, 'data', 'evidenceAnalysis'],
    ['taiyi', { taiyi: { scope: 'hour' } }, 'chart', 'evidenceAnalysis'],
    ['huangji-jingshi', { huangji: { mode: 'datetime' } }, 'chart', 'calculationChain'],
  ] as const;
  for (const [method, settings, container, field] of cases) {
    const saved = JSON.parse(JSON.stringify(await calculate(method, { question: '原问题', currentTime, range, ...settings })));
    assert.ok(saved.data.branches.length > 0, method);
    for (const branch of saved.data.branches) assert.ok(branch[container][field], `${method}: ${field}`);
    assert.equal('auditEvidence' in saved, false, method);
    const follow = await reprompt({ method, result: saved, currentTime, question: '原问题' });
    assert.equal(follow.prompt.text, saved.prompt.text, method);
  }
});

test('HTTP 与 MCP 的文本和结构化返回均可复用原牌面追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'tarot' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '原问题', currentTime: '2025-01-01T00:00:00Z', tarot: { spread: 'single', manualCards: [{ id: 1, reversed: false }] } };
  const http = await send('/api/calculate', { method: 'tarot', input }); assert.equal(http.status, 200); const a: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'tarot', arguments: input } });
  const body: any = await mcp.json(), b = body.result.structuredContent;
  assert.deepEqual(a, b); assert.deepEqual(JSON.parse(body.result.content[0].text), b);
  assert.deepEqual(Object.keys(a.prompt), ['text']);
  const follow = await send('/api/prompt', { method: 'tarot', result: a, question: '继续' });
  assert.equal(follow.status, 200); assert.match((await follow.json() as any).prompt.text, /愚者/);
});
