import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import worker from '../src/worker';
import { baziIndependentInput, methodIds } from '../src/schema';
import promptCatalog from '../src/prompt-catalog.json';
import { drawNext } from '../src/interactive';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/first-methods.json', import.meta.url), 'utf8'));
const time = '2025-01-01T00:00:00Z';
const bazi = { birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 }, gender: 'female', referenceTime: '2025-05-15T04:00:00Z', question: '事业如何', currentTime: time, prompt: { topic: 'career' } };
const liuyao = { question: '工作如何', currentTime: time, liuyao: { method: 'manual', yaos: [6, 7, 8, 9, 7, 8] } };
const tarot = { question: '工作如何', currentTime: time, tarot: { spread: 'three', manualCards: [{ id: 46, reversed: false }, { id: 30, reversed: true }, { id: 43, reversed: false }] } };
const lenormand = { question: '工作如何', currentTime: time, lenormand: { spread: 'three', manualCardIds: [28, 4, 12] } };

test('Node 使用新的八字方法名，不接受旧预览名称', async () => {
  assert.ok(methodIds.includes('bazi'));
  assert.ok(!methodIds.includes('bazi-independent' as never));
  await assert.rejects(() => calculate('bazi-independent' as never, bazi), /暂不支持/);
});

test('八字返回真实四柱，提示词含同一盘面及问题', async () => {
  const result = await calculate('bazi', bazi);
  assert.deepEqual(Object.values(result.data.chart.pillars).map((pillar) => pillar.ganZhi), baseline.baziPillars);
  assert.match(result.prompt.text, /事业如何/);
  assert.match(result.prompt.text, new RegExp(result.data.chart.pillars.day.ganZhi));
  assert.ok(result.data.chart.strength);
  await assert.rejects(() => calculate('bazi', { ...bazi, referenceTime: undefined, prompt: { scope: 'year' } }));
  await assert.rejects(() => calculate('bazi', { ...bazi, prompt: { schools: ['unknown'] } }));
});

test('占问提示词目录与冻结基线一致', () => {
  const original = JSON.parse(readFileSync(new URL('../docs/v2-capability-baseline.json', import.meta.url), 'utf8'));
  for (const method of ['liuyao', 'tarot', 'lenormand', 'xiaoliuren', 'qimen']) {
    const source = original.promptCapabilities.find((item) => item.methodId === method);
    assert.deepEqual(promptCatalog[method].topicIds, source.topicIds);
    assert.deepEqual(promptCatalog[method].subtopics, source.subtopics);
    assert.deepEqual(promptCatalog[method].scopeIds, source.scopeIds);
    for (const [schoolId, meta] of Object.entries(original.promptSchools[method])) {
      assert.deepEqual(promptCatalog[method].schools[schoolId], meta);
    }
  }
});

test('八字岁运按明确时刻定位，提示词含实际选中的层级', async () => {
  for (const [scope, label] of Object.entries({ dayun: '大运', year: '流年', month: '流月', day: '流日' })) {
    const result = await calculate('bazi', { ...bazi, prompt: { scope } });
    assert.ok(result.data.located);
    assert.ok(result.prompt.text.includes(label), scope);
  }
  await assert.rejects(() => calculate('bazi', { ...bazi, referenceTime: undefined, prompt: { scope: 'year' } }));
  await assert.rejects(() => calculate('bazi', { ...bazi, referenceTime: '1800-01-01T00:00:00Z' }));
});

test('六爻手工爻与提示词对应', async () => {
  const result = await calculate('liuyao', liuyao);
  assert.equal(result.data.originalName, baseline.liuyao.originalName);
  assert.equal(result.data.changedName, baseline.liuyao.changedName);
  assert.deepEqual(result.data.yaoArray, baseline.liuyao.yaos);
  assert.equal(result.data.originalName.length > 0, true);
  assert.ok(result.prompt.text.includes(result.data.originalName));
  assert.match(result.prompt.text, /工作如何/);
});

test('塔罗手工牌面进入提示词', async () => {
  const first = await calculate('tarot', tarot);
  const second = await calculate('tarot', tarot);
  assert.deepEqual(first.data.cards.map(({ id, name, position, reversed }) => ({ id, name, position, reversed })), baseline.tarot);
  assert.deepEqual(first.data.cards, second.data.cards);
  assert.deepEqual(first.data, second.data);
  assert.equal(first.prompt.text, second.prompt.text);
  for (const card of first.data.cards) assert.ok(first.prompt.text.includes(card.name));
});

test('18 种塔罗牌阵均能排盘并按牌位写入提示词', async () => {
  const spreads = {
    single: 1, three: 3, love: 5, career: 6, decision: 6, celtic: 10,
    chakra: 7, year: 12, mindBodySpirit: 3, horseshoe: 7, holyTriangle: 3,
    universal: 5, fourElements: 5, hexagram: 7, relationship: 6, wealth: 5,
    problemSolving: 5, twelveHouses: 12,
  };
  for (const [spread, count] of Object.entries(spreads)) {
    const result = await calculate('tarot', { ...tarot, tarot: { spread } });
    assert.equal(result.data.cards.length, count, spread);
    for (const card of result.data.cards) {
      assert.ok(result.prompt.text.includes(card.name), `${spread}: ${card.name}`);
      assert.ok(result.prompt.text.includes(card.position), `${spread}: ${card.position}`);
    }
  }
});

test('塔罗支持逐张选定牌面，不接受内部随机样本作为公开参数', async () => {
  const manual = await calculate('tarot', { question: '问题', currentTime: time, tarot: { spread: 'single', manualCards: [{ id: 1, reversed: false }] } });
  assert.equal(manual.data.cards[0].name, '愚者');
  assert.match(manual.prompt.text, /愚者/);
  await assert.rejects(() => calculate('tarot', { question: '问题', tarot: { spread: 'single', interactiveSamples: [0.1, 0.6] } }));
});

test('逐张抽牌只提交牌面并正确标记交互来源', async () => {
  for (const method of ['tarot', 'lenormand'] as const) {
    const chosen = [];
    for (let index = 0; index < 3; index++) {
      const next = await drawNext(method, 'three', chosen, () => 0.25);
      chosen.push(next.card);
    }
    assert.equal(new Set(chosen.map((card) => card.id)).size, 3);
    const settings = method === 'tarot'
      ? { tarot: { spread: 'three', selectionMode: 'interactive', manualCards: chosen.map(({ id, reversed }) => ({ id, reversed })) } }
      : { lenormand: { spread: 'three', selectionMode: 'interactive', manualCardIds: chosen.map((card) => card.id) } };
    const result = await calculate(method, { question: '问题', currentTime: time, ...settings });
    assert.deepEqual(result.data.cards.map((card) => card.id), chosen.map((card) => card.id));
    assert.match(result.data.draw.method, /逐张/);
    assert.doesNotMatch(JSON.stringify(result), /"(?:seed|samples|randomTrace)"/);
    const prompt = await reprompt({ method, result, question: '继续问' });
    for (const card of chosen) assert.ok(prompt.prompt.text.includes(card.name));
  }
  await assert.rejects(() => drawNext('tarot', 'single', [{ id: 1, name: '愚者', position: '当前指引' }]));
  await assert.rejects(() => calculate('tarot', { question: '问题', tarot: { selectionMode: 'interactive' } }));
});

test('雷诺曼 8 种牌阵、手工和交互输入可用于生成提示词', async () => {
  const expected = { single: 1, three: 3, five: 5, relationship: 5, decision: 6, nine: 9, element: 4, grandTableau: 36 };
  for (const [spread, count] of Object.entries(expected)) {
    const result = await calculate('lenormand', { ...lenormand, lenormand: { spread } });
    assert.equal(result.data.cards.length, count, spread);
    for (const card of result.data.cards) assert.ok(result.prompt.text.includes(card.name), `${spread}: ${card.name}`);
  }
  const saved = await calculate('lenormand', lenormand);
  assert.deepEqual(saved.data.cards.map(({ id, name, position }) => ({ id, name, position })), baseline.lenormand);
  const manual = await calculate('lenormand', { question: '问题', currentTime: time, lenormand: { spread: 'single', manualCardIds: [1] } });
  assert.equal(manual.data.cards[0].name, '骑士');
  const selected = [4];
  const interactive = await calculate('lenormand', { question: '问题', currentTime: time, lenormand: { spread: 'single', manualCardIds: selected } });
  assert.ok(interactive.prompt.text.includes(interactive.data.cards[0].name));
  const next = await reprompt({ method: 'lenormand', result: saved, question: '新问题' });
  for (const card of saved.data.cards) assert.ok(next.prompt.text.includes(card.name));
  await assert.rejects(() => calculate('lenormand', { ...lenormand, lenormand: { spread: 'single', interactiveSamples: [0.5] } }));
});

test('小六壬通行与多能鄙事两种口径均保留各自盘面和提示词', async () => {
  for (const rule of ['common', 'duoneng']) {
    const result = await calculate('xiaoliuren', { question: '工作如何', currentTime: time, xiaoliuren: { rule } });
    assert.equal(result.data.primary.name, baseline.xiaoliuren[rule]);
    assert.equal(result.data.palaceOrder.length, 6);
    assert.deepEqual(result.data.evidenceAnalysis.steps.map((step) => step.role), ['日数起点', '时辰起点', '本次占得宫']);
    assert.ok(result.data.evidenceAnalysis.source);
    assert.ok(result.prompt.text.includes(result.data.primary.name));
    const next = await reprompt({ method: 'xiaoliuren', result, question: '新问题', prompt: { schools: ['gongjue'] } });
    assert.ok(next.prompt.text.includes(result.data.primary.name));
    assert.match(next.prompt.text, /六宫歌诀/);
  }
});

test('奇门时局转飞盘、时日月年与可用定局方法生成对应提示词', async () => {
  for (const method of ['zhuanpan', 'feipan']) for (const scope of ['hour', 'day', 'month', 'year']) {
    for (const juMethod of scope === 'hour' || scope === 'day' ? ['chaibu', 'zhirun'] : [undefined]) {
      const input = { question: '工作如何', currentTime: time, qimen: { method, scope, ...(juMethod ? { juMethod } : {}) } };
      const result = await calculate('qimen', input);
      assert.equal(result.data.method, method);
      assert.equal(result.data.scope, scope);
      assert.equal(result.data.jiuGongGe.length, 9);
      if (juMethod) assert.equal(result.data.juMethod, juMethod);
      assert.ok(result.prompt.text.includes(result.data.zhiFu));
      assert.ok(result.prompt.text.includes(result.data.zhiShi));
      if (method === 'zhuanpan' && scope === 'hour' && juMethod === 'chaibu') {
        for (const [key, value] of Object.entries(baseline.qimen)) assert.equal(result.data[key], value);
        const next = await reprompt({ method: 'qimen', result, question: '新问题', prompt: { schools: ['gongwei'] } });
        assert.match(next.prompt.text, /宫位用神/);
        assert.ok(next.prompt.text.includes(result.data.zhiFu));
        await assert.rejects(() => reprompt({ method: 'qimen', result, question: '新问题', prompt: { scope: 'yearly' } }));
      }
    }
  }
  await assert.rejects(() => calculate('qimen', { question: '问题', qimen: { scope: 'year', juMethod: 'zhirun' } }));
  await assert.rejects(() => calculate('qimen', { question: '问题', qimen: { scope: 'hour' }, prompt: { scope: 'yearly' } }));
});

test('六爻、塔罗和雷诺曼的主题、子主题与流派进入完整提示词', async () => {
  for (const [method, input, school, label] of [
    ['liuyao', liuyao, 'huozhulin', '火珠林'],
    ['tarot', tarot, 'rws', 'RWS'],
    ['lenormand', lenormand, 'combination', '邻牌组合'],
  ] as const) {
    const prompt = { topicId: 'career', subtopicId: 'job-change', scope: 'event', schools: [school] };
    const result = await calculate(method, { ...input, prompt });
    assert.ok(result.prompt.text.includes(label), method);
    assert.match(result.prompt.text, /工作变动/);
    const rebuilt = await reprompt({ method, result, question: '新问题', prompt });
    assert.ok(rebuilt.prompt.text.includes(label), method);
    assert.match(rebuilt.prompt.text, /工作变动/);
  }
  await assert.rejects(() => calculate('tarot', { ...tarot, prompt: { schools: ['unknown'] } }));
  await assert.rejects(() => calculate('tarot', { ...tarot, prompt: { topicId: 'unknown' } }));
});

test('已有盘面可用于新问题，提示词包含原牌面且不会重新抽牌', async () => {
  const saved = await calculate('tarot', tarot);
  const same = await reprompt({ method: 'tarot', result: saved, question: tarot.question, currentTime: saved.currentTime });
  assert.equal(same.prompt.text, saved.prompt.text);
  const next = await reprompt({ method: 'tarot', result: saved, question: '人际关系如何' });
  assert.match(next.prompt.text, /人际关系如何/);
  for (const card of saved.data.cards) assert.ok(next.prompt.text.includes(card.name));
  await assert.rejects(() => reprompt({ method: 'liuyao', result: saved, question: '问题' }));
});

test('随机结果不公开随机轨迹，保存盘面后仍可重新生成提示词', async () => {
  for (const [method, input] of [
    ['liuyao', { question: '问题', currentTime: time, liuyao: { method: 'coins' } }],
    ['lenormand', { question: '问题', currentTime: time, lenormand: { spread: 'three' } }],
    ['tarot', { question: '问题', currentTime: time, tarot: { spread: 'three' } }],
  ] as const) {
    const result = await calculate(method, input);
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /"(?:seed|samples|randomTrace)"|随机轨迹|随机种子|\bseed\b|\breplay\b|重放/i);
    const prompt = await reprompt({ method, result, question: '继续问' });
    assert.match(prompt.prompt.text, /继续问/);
  }
});

test('八字、六爻可基于原盘生成新提示词', async () => {
  for (const [method, input] of [['bazi', bazi], ['liuyao', liuyao]] as const) {
    const saved = await calculate(method, input);
    const next = await reprompt({ method, result: saved, question: '新的问题', prompt: method === 'bazi' ? { topic: 'career' } : undefined });
    assert.match(next.prompt.text, /新的问题/);
    assert.ok(next.prompt.text.includes(method === 'bazi' ? saved.data.chart.pillars.day.ganZhi : saved.data.originalName));
  }
});

test('同一 Worker HTTP 入口计算并限制启用方法', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'tarot' };
  const send = (body: unknown) => worker.fetch(new Request('https://local/api/calculate', { method: 'POST', body: JSON.stringify(body) }), env);
  const response = await send({ method: 'tarot', input: tarot });
  assert.equal(response.status, 200);
  const result = await response.json();
  const direct = await calculate('tarot', tarot);
  assert.deepEqual(result.data.cards, direct.data.cards);
  assert.equal(result.prompt.text, direct.prompt.text);
  assert.equal((await send({ method: 'bazi', input: bazi })).status, 400);
  const schemaResponse = await worker.fetch(new Request('https://local/api/schema'), env);
  const catalog = await schemaResponse.json();
  assert.deepEqual(Object.keys(catalog.methods), ['tarot']);
  assert.deepEqual(catalog.reprompt.properties.method.enum, ['tarot']);
  assert.deepEqual(catalog.reprompt.properties.result.properties.method.enum, ['tarot']);
  assert.ok(catalog.methods.tarot.required.includes('question'));
  const promptCatalog = await (await worker.fetch(new Request('https://local/api/prompts'), env)).json();
  assert.deepEqual(Object.keys(promptCatalog.methods), ['tarot']);
  assert.ok(promptCatalog.methods.tarot.topicIds.includes('career'));
  const repromptResponse = await worker.fetch(new Request('https://local/api/prompt', { method: 'POST', body: JSON.stringify({ method: 'tarot', result, question: '新问题' }) }), env);
  assert.equal(repromptResponse.status, 200);
  assert.match((await repromptResponse.json()).prompt.text, /新问题/);
  assert.equal((await send({ method: 'tarot', input: { question: '问题', random: { seed: 'x', replay: [0.5] } } })).status, 400);
  assert.equal((await send({ method: 'tarot', input: {} })).status, 400);
  const badConfig = await worker.fetch(new Request('https://local/api/methods'), { ...env, ENABLED_METHODS: 'tarot,typo' });
  assert.equal(badConfig.status, 500);
});

test('MCP 工具目录与调用使用同一内核', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(['tarot']);
  const client = new Client({ name: 'test', version: '1' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), ['tarot', 'reprompt', 'prompt_catalog']);
    assert.deepEqual(tools.find((tool) => tool.name === 'reprompt')?.inputSchema.properties?.method.enum, ['tarot']);
    assert.deepEqual(tools.find((tool) => tool.name === 'prompt_catalog')?.inputSchema.properties?.method.enum, ['tarot']);
    assert.doesNotMatch(JSON.stringify(tools.find((tool) => tool.name === 'tarot')?.inputSchema), /seed|replay|interactiveSamples/);
    const catalog = await client.callTool({ name: 'prompt_catalog', arguments: { method: 'tarot' } });
    assert.ok(catalog.structuredContent?.methods?.tarot?.topicIds.includes('career'));
    const result = await client.callTool({ name: 'tarot', arguments: tarot });
    const direct = await calculate('tarot', tarot);
    assert.deepEqual(result.structuredContent?.data?.cards, direct.data.cards);
    assert.equal(result.structuredContent?.prompt?.text, direct.prompt.text);
  } finally {
    await client.close();
    await server.close();
  }
});

test('本地 MCP stdio 进程提供工具并可调用', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/mcp-stdio.ts'] });
  const client = new Client({ name: 'stdio-test', version: '1' });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), [...methodIds, 'reprompt', 'prompt_catalog']);
    const response = await client.callTool({ name: 'liuyao', arguments: liuyao });
    assert.equal(response.isError, undefined);
    assert.equal(response.structuredContent?.method, 'liuyao');
    const lifetime = await client.callTool({ name: 'qimen-lifetime', arguments: { question: '事业如何？', birth: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8 }, gender: 'male', stagePolicy: { model: 'decadalGanzhi' } } });
    assert.equal(lifetime.isError, undefined);
    assert.equal(lifetime.structuredContent?.method, 'qimen-lifetime');
    assert.equal(lifetime.structuredContent?.data?.stages.length, 13);
  } finally {
    await client.close();
  }
});
