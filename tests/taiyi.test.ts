import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calculate, reprompt } from '../src/core';
import { generateTaiyi as generateV2Taiyi } from '../src/systems/taiyi/chart';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const question = '事业如何';

test('四计积数使用对应名称，数段保留计算依据且不暴露旧兼容字段', async () => {
  for (const [scope, label] of [['year', '积年'], ['month', '积月'], ['day', '积日'], ['hour', '积时']] as const) {
    const taiyi = scope === 'year' ? { scope, year: 2025 } : { scope, date: currentTime };
    const result = await calculate('taiyi', { currentTime, question, taiyi });
    const chart = result.data.chart;
    assert.equal(chart.accumulatedLabel, label);
    for (const field of ['accumulatedYears', 'yuan', 'ji']) assert.equal(Object.hasOwn(chart, field), false, `${scope}/${field}`);
    const steps = chart.evidenceAnalysis.calculationSteps;
    for (const removed of ['conditions', 'evidence', 'promptText']) assert.equal(removed in chart.evidenceAnalysis, false, `${scope}/${removed}`);
    assert.ok(chart.conditions.threeGates);
    assert.ok(chart.conditions.fiveGenerals);
    assert.ok(chart.conditions.yinYangHarmony);
    if (scope === 'day') {
      assert.equal(chart.conditions.fiveGenerals.hostGuestElementRelation.complete, true);
      assert.ok(chart.conditions.fiveGenerals.hostGuestElementRelation.dayNayin);
      assert.notEqual(chart.conditions.fiveGenerals.hostGuestElementRelation.relation, '未判定');
      assert.equal(chart.conditions.fiveGenerals.hostGuestElementRelation.usedForFiveGeneralsLaunch, false);
    } else {
      assert.equal(chart.conditions.fiveGenerals.hostGuestElementRelation.complete, false);
    }
    assert.equal(chart.evidenceAnalysis.sixteenGodFacts.length, 16);
    assert.ok(chart.evidenceAnalysis.conditionFacts.length > 0);
    assert.equal(steps.find((step) => step.key === 'taiyi:calculation:yuan')?.result, Math.ceil(chart.entryYears / 72));
    assert.equal(steps.find((step) => step.key === 'taiyi:calculation:ji')?.result, Math.ceil(chart.entryYears / 60));
    assert.match(result.prompt.text, /数段/);
    const followup = await reprompt({ method: 'taiyi', result, question: '继续问' });
    assert.match(followup.prompt.text, /继续问/);
  }
});

test('返回盘面、证据与模型资料不会共享可变引用', () => {
  const result = generateV2Taiyi({ scope: 'year', year: 2025 });
  const expected = structuredClone(result.evidenceAnalysis);
  (result.conditions.threeGates as any).status = '伪造';
  result.model.sources[0].title = '伪造';
  assert.deepEqual(result.evidenceAnalysis, expected);
  assert.notEqual(generateV2Taiyi({ scope: 'year', year: 2025 }).model.sources[0].title, '伪造');
});

test('保存四计后可追问，拒绝不一致盘面及范围', async () => {
  for (const scope of ['year', 'month', 'day', 'hour'] as const) {
    const taiyi = scope === 'year' ? { scope, year: 2025 } : { scope, date: currentTime };
    const saved = JSON.parse(JSON.stringify(await calculate('taiyi', { currentTime, question, taiyi })));
    saved.data.chart.evidenceAnalysis = { injected: '伪造证据' };
    const next = await reprompt({ method: 'taiyi', result: saved, question: '如何发展', prompt: { topicId: 'career', subtopicId: 'job-change', schools: ['zhuke', 'gongwei'], includeClassics: true } });
    for (const text of ['如何发展', '工作变动', '主客定算法', '宫位神将法', '经典依据']) assert.ok(next.prompt.text.includes(text));
    assert.doesNotMatch(next.prompt.text, /伪造证据/);
    for (const mutate of [
      (chart: any) => { chart.bureau = 999; },
      (chart: any) => { chart.conditions.threeGates.status = '伪造'; },
      (chart: any) => { chart.sixteenGods[0].god = '伪造'; },
    ]) {
      const altered = structuredClone(saved); mutate(altered.data.chart);
      await assert.rejects(() => reprompt({ method: 'taiyi', result: altered, question: '追问' }), /不一致/);
    }
    if (scope !== 'year') {
      const missing = structuredClone(saved); delete missing.data.input.date;
      await assert.rejects(() => reprompt({ method: 'taiyi', result: missing, question: '追问' }), /缺少原始起局时刻/);
    }
    const wrongScope = scope === 'year' ? 'monthly' : 'yearly';
    await assert.rejects(() => reprompt({ method: 'taiyi', result: saved, question: '追问', prompt: { scope: wrongScope } }));
  }
  for (const invalid of [{ scope: 'year' }, { scope: 'year', year: 2025, date: currentTime }, { scope: 'day', year: 2025 }, { scope: 'year', year: 2025, ganZhi: '甲子' }]) {
    await assert.rejects(() => calculate('taiyi', { currentTime, question, taiyi: invalid }));
  }
  const baseline = JSON.parse(readFileSync(new URL('../docs/v2-capability-baseline.json', import.meta.url), 'utf8'));
  const original = baseline.promptCapabilities.find((item: any) => item.methodId === 'taiyi');
  assert.deepEqual(catalog.taiyi.topicIds, original.topicIds);
  assert.deepEqual(catalog.taiyi.subtopics, original.subtopics);
  const saved = JSON.parse(JSON.stringify(await calculate('taiyi', { currentTime, question, taiyi: { scope: 'year', year: 2025 } })));
  for (const [topicId, choices] of Object.entries(catalog.taiyi.subtopics)) for (const choice of choices as { id: string; label: string }[]) {
    const response = await reprompt({ method: 'taiyi', result: saved, question: '追问', prompt: { topicId, subtopicId: choice.id } });
    assert.ok(response.prompt.text.split('【任务】')[1].includes(choice.label));
  }
});

test('Worker HTTP 与 MCP 使用相同太乙盘面并支持原盘追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'taiyi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { currentTime, question, taiyi: { scope: 'year', year: 2025 } };
  const response = await send('/api/calculate', { method: 'taiyi', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'taiyi', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'taiyi', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.chart.bureau, saved.data.chart.bureau);
});
