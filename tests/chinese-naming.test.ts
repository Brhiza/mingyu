import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import { calculateBaziIndependentData } from '../src/systems/bazi';
import worker from '../src/worker';

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const question = '如何理解这个名字？';

test('出生精确时复用八字条件模型，未知时辰保留各候选及共同与条件方向', async () => {
  const births = [
    ...[{ kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, { kind: 'unknown' as const }, { kind: 'shichen' as const, index: 8 }].map((clock) => ({ year: 1990, month: 5, day: 15, clock, timezone: 8 })),
    { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 11, minute: 22, second: 33 }, timeZoneId: 'America/New_York', timeStandard: 'true-solar' as const, longitude: -74 },
    { year: 1990, month: 5, day: 15, clock: { kind: 'unknown' as const }, timeZoneId: 'America/New_York', timeStandard: 'true-solar' as const, longitude: -74 },
  ];
  for (const birth of births) {
    const direct = await calculateBaziIndependentData({ birth });
    const result = await calculate('chinese-name', { fullName: '张知远', birth, question });
    const context = result.data.birthContext!;
    const original = direct.chart ? [direct.chart] : direct.unknown!.segments;
    assert.equal(context.segments.length, original.length);
    for (const [index, segment] of context.segments.entries()) {
      assert.deepEqual(segment.pillars, ['year', 'month', 'day', 'hour'].map((key) => original[index].pillars[key as 'year' | 'month' | 'day' | 'hour'].ganZhi));
      assert.deepEqual(segment.favorable, original[index].usefulBaseline.favorable);
    }
    const stable = context.segments[0].favorable.filter((item) => context.segments.every((segment) => segment.favorable.includes(item)));
    const conditional = [...new Set(context.segments.flatMap((segment) => segment.favorable))].filter((item) => !stable.includes(item));
    assert.deepEqual(context.stableFavorable, stable); assert.deepEqual(context.conditionalFavorable, conditional);
    assert.match(result.prompt.text, /不等于最终喜用/);
    if (birth.timeStandard === 'true-solar') assert.match(result.prompt.text, /真太阳时/);
    const generated = await calculate('chinese-naming', { surname: '张', birth, limit: 3, question });
    assert.deepEqual(generated.data.birthContext, context);
    const bad = plain(result); bad.data.birthContext!.segments[0].pillars[0] = '伪造';
    await assert.rejects(() => reprompt({ method: 'chinese-name', result: bad, question }), /不一致/);
  }
});

test('原结果追问可变更范围，篡改姓名、数理和出生证据均被拒绝', async () => {
  for (const [method, input, subtopicId] of [
    ['chinese-name', { fullName: '欧阳知远', surnameLength: 2 }, 'name-analysis'],
    ['chinese-naming', { surname: '张', limit: 3, generationCharacter: '知' }, 'naming'],
  ] as const) {
    const result = await calculate(method, { ...input, question, prompt: { topicId: 'general', subtopicId, scope: 'natal' } });
    const original = plain(result), same = await reprompt({ method, result: original, question });
    assert.equal(same.prompt.text, result.prompt.text);
    const next = await reprompt({ method, result: original, question: '考虑日常使用', prompt: { topicId: 'general', subtopicId, scope: 'event' } });
    assert.match(next.prompt.text, /当前事项/);
    assert.match(next.prompt.text, /考虑日常使用/);
    const bad = plain(result);
    if (method === 'chinese-name') (bad.data as any).analysis.rawGrids.tian++;
    else (bad.data as any).candidates[0].fullName = '伪造';
    await assert.rejects(() => reprompt({ method, result: bad, question }), /不一致/);
    await assert.rejects(() => reprompt({ method, result: original, question, prompt: { scope: 'invalid' } }));
  }
});

test('多候选提示词共享重复用字资料，仍逐名保留五格与三才', async () => {
  const result = await calculate('chinese-naming', { surname: '张', limit: 50, question });
  assert.equal(result.data.candidates.length, 50);
  assert.ok(result.prompt.text.length < 30000);
  assert.equal((result.prompt.text.match(/姓字「张」/g) ?? []).length, 1);
  for (const candidate of result.data.candidates) {
    assert.ok(result.prompt.text.includes(`姓名：${candidate.fullName}`));
    assert.ok(result.prompt.text.includes(`三才：${candidate.analysis.sancaiEvidence.combo}`));
    for (const grid of candidate.analysis.gridDerivations) assert.ok(result.prompt.text.includes(`${grid.name}：${grid.expression}`));
  }
});

test('HTTP 与 MCP 使用相同姓名分析、起名和追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'chinese-name,chinese-naming' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', body: JSON.stringify(body) }), env);
  const [ct, st] = InMemoryTransport.createLinkedPair(), server = createServer(['chinese-name', 'chinese-naming']), client = new Client({ name: 'naming-test', version: '1' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  try {
    for (const [method, input] of [['chinese-name', { fullName: '张知远', question }], ['chinese-naming', { surname: '张', limit: 3, question }]] as const) {
      const response = await send('/api/calculate', { method, input }); assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal((await send('/api/prompt', { method, result, question: '追问' })).status, 200);
      const mcp = await client.callTool({ name: method, arguments: input });
      assert.deepEqual(mcp.structuredContent?.data, result.data);
      const reply = await client.callTool({ name: 'reprompt', arguments: { method, result: mcp.structuredContent, question: '追问' } });
      assert.equal(reply.isError, undefined);
    }
  } finally { await client.close(); await server.close(); }
});
test('姓名和起名的字形、辈分与避讳条件明确', async () => {
  await assert.rejects(() => calculate('chinese-name', { fullName: '张頔', question }), /未收录/);
  await assert.rejects(() => calculate('chinese-name', { fullName: '张A', question }), /汉字/);
  await assert.rejects(() => calculate('chinese-name', { fullName: '欧阳', surnameLength: 2, question }), /姓名需/);
  const result = await calculate('chinese-naming', { surname: '单于', gender: 'female', generationCharacter: '思', generationPosition: 'second', preferredCharacters: '安寧', forbiddenCharacters: '宁', limit: 10, question });
  assert.ok(result.data.candidates.length > 0);
  assert.ok(result.data.candidates.every((item) => item.givenName.endsWith('思') && !/[宁寧]/.test(item.givenName)));
  assert.match(result.prompt.text, /避讳字形[\s\S]*宁、寧/);
  await assert.rejects(() => calculate('chinese-naming', { surname: '张', generationCharacter: '宁', forbiddenCharacters: '寧', question }));
  const missing = await calculate('chinese-naming', { surname: '张', preferredCharacters: '頔安', limit: 3, question });
  assert.deepEqual(missing.data.unavailablePreferredCharacters, ['頔']);
});
