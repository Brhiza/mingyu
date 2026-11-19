import assert from 'node:assert/strict';
import test from 'node:test';
import { SixtyCycle } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import { buildPillarFact, buildPillarFacts } from '../src/systems/bazi/pillars';
import { calculateFortuneShensha, formatFortuneShensha } from '../src/systems/bazi/fortune-shensha';
import worker from '../src/worker';

const names = { year: '甲子', month: '丙寅', day: '丙申', hour: '己亥' };
const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 };
const input = { birth, gender: 'female', question: '岁运如何？', referenceTime: '2025-05-15T04:00:00Z' };

test('流年起例保留本命年干，不把流年覆盖为本命年柱', () => {
  const pillars = buildPillarFacts(names);
  const target = buildPillarFact('乙丑', pillars.day.gan);
  const result = calculateFortuneShensha(pillars, [{ id: 'year', pillar: target }], 'female');
  const match = result.layers[0].entries.find((item) => item.name === '天乙贵人');
  assert.deepEqual(match?.basis, [{ pillar: 'year', kind: '干', value: '甲', target: '丑' }]);
  assert.ok(!result.layers[0].entries.some((item) => 'position' in item));
  assert.match(result.rule, /不替换本命年柱/);
});

test('60 个目标干支保留本命起例，不受本命时柱替换影响', () => {
  const first = buildPillarFacts(names), second = buildPillarFacts({ ...names, hour: '庚子' });
  for (let index = 0; index < 60; index++) {
    const ganZhi = SixtyCycle.fromIndex(index).getName(), pillar = buildPillarFact(ganZhi, first.day.gan);
    const layer = [{ id: 'year' as const, pillar }];
    const result = calculateFortuneShensha(first, layer, 'male');
    assert.deepEqual(result, calculateFortuneShensha(second, layer, 'male'), ganZhi);
    assert.equal(result.layers[0].ganZhi, ganZhi);
    assert.ok(result.layers[0].entries.every((entry) => entry.basis.every((basis) => ['year', 'month', 'day'].includes(basis.pillar))), ganZhi);
    assert.ok(!result.layers[0].entries.some((entry) => ['魁罡', '三奇贵人', '拱禄', '童子煞'].includes(entry.name)), ganZhi);
  }
});

test('不同提示词范围只展示实际选定的岁运层级，追问保留依据并验证结果', async () => {
  const saved = await calculate('bazi', input), data = saved.data.located!.shensha;
  assert.deepEqual(data.layers.map((layer) => layer.id), ['dayun', 'year', 'month', 'day', 'hour']);
  const year = await reprompt({ method: 'bazi', result: saved, question: '今年？', prompt: { scope: 'year', detailMode: 'full' } });
  assert.ok(year.prompt.text.includes(formatFortuneShensha(data, ['dayun', 'year'], true)));
  const section = year.prompt.text.split('【岁运神煞】')[1].split('【')[0];
  assert.match(section, /大运|流年/); assert.doesNotMatch(section, /流月|流日|流时/);
  const natal = await reprompt({ method: 'bazi', result: saved, question: '本命？', prompt: { scope: 'natal' } });
  assert.doesNotMatch(natal.prompt.text, /【岁运神煞】/);
  const altered = structuredClone(saved); altered.data.located!.shensha.included.pop();
  await assert.rejects(() => reprompt({ method: 'bazi', result: altered, question: '继续' }), /不一致/);
});

test('合参的时机主题、HTTP 与 MCP 复用同一岁运神煞事实', async () => {
  const combined = await calculate('bazi-ziwei', { ...input, prompt: { topic: 'timing', detailLevel: 'professional' } });
  assert.match(combined.prompt.text, /【八字岁运神煞】/);
  assert.ok(combined.prompt.text.includes(formatFortuneShensha(combined.data.charts.bazi.located!.shensha, ['dayun', 'year', 'month', 'day', 'hour'], true)));
  const follow = await reprompt({ method: 'bazi-ziwei', result: combined, question: '继续问', prompt: { topic: 'timing' } });
  assert.match(follow.prompt.text, /【八字岁运神煞】/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazi', input }); assert.equal(http.status, 200);
  const a: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi', arguments: input } }); assert.equal(mcp.status, 200);
  const b: any = await mcp.json();
  assert.deepEqual(a.data.located.shensha, b.result.structuredContent.data.located.shensha);
  assert.match(a.prompt.text, /【岁运神煞】/);
});
