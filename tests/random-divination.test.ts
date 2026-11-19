import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { randomDivinationMethods } from '../src/schema';
import { randomDivination } from '../src/systems/random-divination';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';

test('十种候选均可随机选中，保存完整结果后追问不重新选择或起盘', async () => {
  for (const [index, method] of randomDivinationMethods.entries()) {
    const result = await calculate('random-divination', { question: '问题', currentTime, methods: [method] });
    assert.equal(result.data.selectedMethod, method);
    assert.equal(result.data.result.method, method);
    assert.ok(result.prompt.text);
    assert.equal('prompt' in result.data.result, false);
    assert.doesNotMatch(JSON.stringify(result), /"(?:randomTrace|replay|seed)"/);
    const original = JSON.parse(JSON.stringify(result));
    const follow = await reprompt({ method: 'random-divination', result: original, currentTime, question: '继续解读' });
    const direct = await reprompt({ method, result: original.data.result, currentTime, question: '继续解读' });
    assert.deepEqual(follow.prompt, direct.prompt, method);
    assert.match(follow.prompt.text, /继续解读/);
    const selected = await randomDivination({ question: '问题', methods: [...randomDivinationMethods] }, currentTime, undefined, calculate, () => (index + 0.5) / randomDivinationMethods.length);
    assert.equal(selected.data.selectedMethod, method);
  }
  await assert.rejects(() => calculate('random-divination', { question: '问题', methods: ['tarot', 'tarot'] }));
  await assert.rejects(() => calculate('random-divination', { question: '问题', methods: ['unknown'] }));
  await assert.rejects(() => calculate('random-divination', { question: '问题', seed: 'old' }));
});

test('随机结果的追问使用选中术数的提示词选项，可保存沿用并重置', async () => {
  for (const [method, prompt] of [
    ['tarot', { topicId: 'career', subtopicId: 'workplace', schools: ['rws'] }],
    ['liuyao', { liuyaoTemplate: 'caifu' }],
  ] as const) {
    const result = await calculate('random-divination', { question: '问题', currentTime, methods: [method] });
    const selected = await reprompt({ method: 'random-divination', result, currentTime, question: '继续', prompt });
    const direct = await reprompt({ method, result: result.data.result, currentTime, question: '继续', prompt });
    assert.deepEqual(selected.prompt, direct.prompt);
    const saved = { ...result, promptOptions: prompt };
    assert.deepEqual((await reprompt({ method: 'random-divination', result: saved, currentTime, question: '继续' })).prompt, selected.prompt);
    assert.notEqual((await reprompt({ method: 'random-divination', result: saved, currentTime, question: '继续', prompt: {} })).prompt.text, selected.prompt.text);
    await assert.rejects(() => reprompt({ method: 'random-divination', result, question: '继续', prompt: { unsupported: true } }));
  }
});

test('随机源不可用时，已保存的随机结果与范围结果仍能继续追问', async () => {
  const base = { question: '原问题', currentTime };
  const range = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };
  const cases = [
    ['tarot', { ...base, tarot: { spread: 'three' } }],
    ['lenormand', { ...base, lenormand: { spread: 'nine' } }],
    ['ssgw', { ...base, ssgw: { method: 'random' } }],
    ['zhuge', { ...base, zhuge: { method: 'coins' } }],
    ['meihua', { ...base, meihua: { method: 'random' } }],
    ['jinkoujue', { ...base, jinkoujue: { method: 'random' } }],
    ['jinkoujue', { ...base, range, jinkoujue: { method: 'random', timeStandard: 'true-solar', longitude: 116.4 } }],
    ['liuyao', { ...base, liuyao: { method: 'coins' } }],
    ['liuyao', { ...base, liuyao: { method: 'yarrow' } }],
    ['liuyao', { ...base, range, liuyao: { method: 'coins' } }],
    ['liuyao', { ...base, range, liuyao: { method: 'yarrow' } }],
    ...randomDivinationMethods.map((method) => ['random-divination', { ...base, methods: [method] }] as const),
  ] as const;
  const saved = [];
  for (const [method, input] of cases) saved.push({ method, result: JSON.parse(JSON.stringify(await calculate(method, input))) });
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues() { throw new Error('不应重新取随机数'); } } });
    await assert.rejects(() => calculate('tarot', base), /不应重新取随机数/);
    for (const { method, result } of saved) {
      const before = JSON.stringify(result);
      const same = await reprompt({ method, result, currentTime, question: base.question });
      assert.equal(same.prompt.text, result.prompt.text, `${method}: 原问题`);
      const next = await reprompt({ method, result, question: '继续追问' });
      assert.match(next.prompt.text, /继续追问/, method);
      assert.equal(JSON.stringify(result), before, `${method}: 不修改保存结果`);
    }
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto); else Reflect.deleteProperty(globalThis, 'crypto');
  }
});

test('随机入口遵守已启用术数，复用已有结果同样不能绕过限制', async () => {
  const assets = { fetch: async () => new Response('asset') };
  const env = { ASSETS: assets, ENABLED_METHODS: 'random-divination,tarot' };
  const send = (path: string, body: unknown, settings = env) => worker.fetch(new Request(`https://local${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body),
  }), settings);
  const response = await send('/api/calculate', { method: 'random-divination', input: { question: '问题', currentTime } });
  assert.equal(response.status, 200);
  const saved = await response.json() as any;
  assert.deepEqual(saved.data.candidates, ['tarot']);
  assert.equal(saved.data.selectedMethod, 'tarot');
  assert.equal((await send('/api/calculate', { method: 'random-divination', input: { question: '问题', methods: ['liuyao'] } })).status, 400);
  assert.equal((await send('/api/calculate', { method: 'liuyao', input: { question: '问题' } })).status, 400);
  assert.equal((await send('/api/calculate', { method: 'random-divination', input: { question: '问题' } }, { ...env, ENABLED_METHODS: 'random-divination' })).status, 400);
  assert.equal((await send('/api/prompt', { method: 'random-divination', result: saved, question: '追问' })).status, 200);
  const restricted = { ...env, ENABLED_METHODS: 'random-divination,liuyao' };
  assert.equal((await send('/api/prompt', { method: 'random-divination', result: saved, question: '追问' }, restricted)).status, 400);
  const bad = structuredClone(saved); bad.data.selectedMethod = 'liuyao';
  assert.equal((await send('/api/prompt', { method: 'random-divination', result: bad, question: '追问' })).status, 400);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'random-divination', arguments: { question: '问题', currentTime } } });
  const result = await mcp.json() as any;
  assert.equal(result.result.structuredContent.data.selectedMethod, 'tarot');
  const forbidden = await send('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'reprompt', arguments: { method: 'random-divination', result: saved, question: '追问' } } }, restricted);
  assert.equal((await forbidden.json() as any).result.isError, true);
});
