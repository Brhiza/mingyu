import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { inputSchemas, methodIds, type Method } from '../src/schema';
import { methodExamples } from '../scripts/method-examples.mjs';
import { z } from 'zod';
import worker from '../src/worker';

const now = '2025-01-01T00:00:00Z';
const question = '原问题';
const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };

// 每种支持 prompt 的方法至少选择一项真实生效的选项；数字能量的通用主题本身就是默认值。
const methodOptions: Partial<Record<Method, Record<string, unknown>>> = {
  'number-energy': { topicId: 'general' }, 'chinese-name': { topicId: 'general' }, 'chinese-naming': { topicId: 'general' },
  tarot: { topicId: 'timing' }, lenormand: { topicId: 'timing' }, xiaoliuren: { topicId: 'timing' }, ssgw: { topicId: 'timing' },
  zhuge: { topicId: 'timing' }, 'wuyun-liuqi': { topicId: 'timing' },
  'huangji-jingshi': { topicId: 'timing' }, jinkoujue: { topicId: 'timing' }, liuren: { topicId: 'timing' }, meihua: { topicId: 'timing' },
  liuyao: { topicId: 'timing' }, taiyi: { topicId: 'timing' }, qimen: { topicId: 'timing' }, 'qimen-lifetime': { schools: ['gongwei'] },
  'bazi': { topic: 'talent' }, 'bazi-synastry': { schools: ['ziping'] }, almanac: { dates: ['2026-06-15'] },
  qizheng: { topicId: 'timing' }, 'qizheng-range': { topicId: 'timing' }, 'ziwei': { topic: 'chat' },
  'ziwei-synastry': { schools: ['sanhe'] }, 'bazi-ziwei': { topic: 'timing' },
  'astrolabe': { topic: 'chat' }, 'astrolabe-synastry': { schools: ['modern'] }, 'astrolabe-range': { topic: 'chat' },
  bazhai: { schools: ['bazhaimingjing'] }, xuankong: { schools: ['shenshi'] }, residential: { schools: ['hecan'] },
  minglu: { topic: 'career' }, fortune: { topic: 'career' },
};

test('所有支持提示词选项的方法保存后都能沿用并重置选项', async () => {
  const supported = methodIds.filter((method) => !!(z.toJSONSchema(inputSchemas[method]) as any).properties?.prompt);
  assert.deepEqual(Object.keys(methodOptions).sort(), [...supported].sort());
  for (const method of supported) {
    const input = { ...methodExamples[method], currentTime: '2026-06-15T04:00:00Z', prompt: methodOptions[method] };
    const saved = JSON.parse(JSON.stringify(await calculate(method, input)));
    assert.deepEqual(saved.promptOptions, input.prompt, method);
    const follow = await reprompt({ method, result: saved, question: input.question, currentTime: input.currentTime });
    assert.ok(follow.prompt.text === saved.prompt.text, `${method} 未沿用原选项`);
    const reset = await reprompt({ method, result: saved, question: input.question, currentTime: input.currentTime, prompt: {} });
    if (method !== 'number-energy') assert.ok(reset.prompt.text !== saved.prompt.text, `${method} 的选项未改变提示词`);
  }
});

test('保存的随机和非随机结果会沿用本次提示词选项', async () => {
  const cases = [
    ['tarot', { question, currentTime: now, tarot: { spread: 'three' }, prompt: { topicId: 'relationship', schools: ['rws'] } }],
    ['lenormand', { question, currentTime: now, lenormand: { spread: 'three' }, prompt: { topicId: 'career' } }],
    ['liuyao', { question, currentTime: now, liuyao: { method: 'coins' }, prompt: { liuyaoTemplate: 'shiye' } }],
    ['qizheng', { question, currentTime: now, birth, prompt: { topicId: 'career', subtopicId: 'job-change' } }],
    ['bazi', { question, currentTime: now, birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 }, prompt: { topic: 'career', schools: ['ziping'] } }],
    ['huangji-jingshi', { question, currentTime: now, huangji: { mode: 'year', year: 2025 }, prompt: { topicId: 'timing' } }],
  ] as const;
  for (const [method, input] of cases) {
    const saved = JSON.parse(JSON.stringify(await calculate(method, input)));
    assert.deepEqual(saved.promptOptions, input.prompt, method);
    const resumed = await reprompt({ method, result: saved, question, currentTime: now });
    assert.equal(resumed.prompt.text, saved.prompt.text, method);
    assert.doesNotMatch(JSON.stringify(saved), /"(?:seed|samples|randomTrace|replay)"/, method);
  }
});

test('显式选项覆盖原设置，空对象恢复默认，非法选项不会静默忽略', async () => {
  const saved = await calculate('tarot', { question, currentTime: now, tarot: { spread: 'three' }, prompt: { topicId: 'relationship', schools: ['rws'] } });
  const changed = await reprompt({ method: 'tarot', result: saved, question: '工作？', prompt: { topicId: 'career' } });
  assert.match(changed.prompt.text, /解读主题：事业/);
  assert.doesNotMatch(changed.prompt.text, /解读主题：感情/);
  for (const card of saved.data.cards) assert.ok(changed.prompt.text.includes(card.name));
  const reset = await reprompt({ method: 'tarot', result: saved, question: '新问题', prompt: {} });
  assert.doesNotMatch(reset.prompt.text, /【解读选择】|【解读口径】/);
  await assert.rejects(() => reprompt({ method: 'tarot', result: saved, question, prompt: null }));
  const bad = structuredClone(saved); (bad.promptOptions as any).schools = ['unknown'];
  await assert.rejects(() => reprompt({ method: 'tarot', result: bad, question }));
  const noOptions = await calculate('tarot', { question, currentTime: now, tarot: { spread: 'single' } });
  assert.equal('promptOptions' in noOptions, false);
});

test('HTTP 和 MCP 追问沿用保存选项及原牌面', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'tarot' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const computed = await send('/api/calculate', { method: 'tarot', input: { question, currentTime: now, tarot: { spread: 'three' }, prompt: { topicId: 'relationship' } } });
  assert.equal(computed.status, 200);
  const saved: any = await computed.json();
  const args = { method: 'tarot', result: saved, question: '继续', currentTime: now };
  const http = await send('/api/prompt', args); assert.equal(http.status, 200);
  const a: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'reprompt', arguments: args } }); assert.equal(mcp.status, 200);
  const b: any = await mcp.json();
  assert.equal(a.prompt.text, b.result.structuredContent.prompt.text);
  assert.match(a.prompt.text, /解读主题：感情/);
  for (const card of saved.data.cards) assert.ok(a.prompt.text.includes(card.name));
});
