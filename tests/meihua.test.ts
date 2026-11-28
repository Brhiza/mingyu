import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { generateMeihuaChart } from '../src/systems/meihua/chart';
import worker from '../src/worker';
import catalog from '../src/prompt-catalog.json';

const currentTime = '2025-01-01T00:00:00Z';
const base = { question: '工作如何', currentTime };
const examples = [
  { method: 'time' }, { method: 'number', number: 135 }, { method: 'sound', soundCount: 5 },
  { method: 'character', characterText: '明', characterLeftStrokes: 4, characterRightStrokes: 4 },
  { method: 'character', characterText: '天地', characterStrokeCounts: [4, 6] },
  { method: 'character', characterText: '天地玄黄', characterTones: [1, 2, 3, 4] },
  { method: 'character', characterCount: 11 },
  { method: 'direction', direction: 'east', objectType: 'fire' },
] as const;

test('随机起卦覆盖六十四卦与六个动爻，结果不暴露内部随机轨迹', () => {
  const date = new Date(currentTime), names = new Set<string>();
  for (let upper = 1; upper <= 8; upper++) for (let lower = 1; lower <= 8; lower++) for (let moving = 1; moving <= 6; moving++) {
    const chart = generateMeihuaChart(date, { method: 'random' }, { upperTrigramIndex: upper, lowerTrigramIndex: lower, movingYaoIndex: moving });
    names.add(chart.originalName);
    assert.equal(chart.calculation.upperTrigramIndex, upper);
    assert.equal(chart.calculation.lowerTrigramIndex, lower);
    assert.equal(chart.movingYao.position, moving);
    assert.doesNotMatch(JSON.stringify(chart), /"(?:seed|samples|randomTrace|replay)"/i);
  }
  assert.equal(names.size, 64);
});

test('每种起法的提示词引用实际卦爻证据、经典和所选口径', async () => {
  for (const settings of examples) {
    const result = await calculate('meihua', { ...base, meihua: settings, prompt: { schools: ['tiyong', 'xiangshu'], includeClassics: true } });
    const evidence = result.data.evidenceAnalysis;
    for (const field of ['hexagramStructureFacts', 'yaoStructureFacts', 'stages', 'transitionFacts', 'counterEvidenceFacts', 'timingFacts', 'traditionalFacts'] as const) {
      for (const fact of evidence[field]) assert.ok(result.prompt.text.includes(fact.promptText), `${settings.method}/${field}`);
    }
    assert.equal(evidence.yaoStructureFacts.length, 6); assert.equal(evidence.stages.length, 3);
    assert.match(result.prompt.text, /多口径合参/); assert.match(result.prompt.text, /经典依据/);
  }
});

test('随机原卦追问和主题选项使用同一卦面', async () => {
  const random = await calculate('meihua', { ...base, meihua: { method: 'random' } });
  assert.doesNotMatch(JSON.stringify(random), /"(?:seed|samples|randomTrace|randomTraceStatus)"|随机轨迹|随机种子|\breplay\b|重放/i);
  for (const topic of catalog.meihua.topicIds) {
    for (const subtopic of (catalog.meihua.subtopics as Record<string, { id: string; label: string }[]>)[topic] ?? []) {
      const next = await reprompt({ method: 'meihua', result: random, question: '接下来怎么做', prompt: { topicId: topic, subtopicId: subtopic.id } });
      assert.ok(next.prompt.text.includes(random.data.originalName));
      assert.ok(next.prompt.text.split('【任务】')[1].includes(subtopic.label));
      assert.doesNotMatch(JSON.stringify(next), /随机轨迹|随机种子|\breplay\b|重放/i);
    }
  }
  for (const scope of catalog.meihua.scopeIds) {
    const next = await reprompt({ method: 'meihua', result: random, question: '追问', prompt: { scope } });
    assert.match(next.prompt.text, /未提供对应时间资料时明确说明缺口/);
  }
});

test('每种起法的保存盘面可追问，并拒绝修改的计算资料', async () => {
  for (const settings of [...examples, { method: 'random' } as const]) {
    const result = JSON.parse(JSON.stringify(await calculate('meihua', { ...base, meihua: settings })));
    const next = await reprompt({ method: 'meihua', result, question: '原卦追问' });
    assert.match(next.prompt.text, /原卦追问/);
    assert.ok(next.prompt.text.includes(result.data.originalName));
    const altered = structuredClone(result);
    altered.data.analysis.tiSeasonState = '伪造';
    await assert.rejects(() => reprompt({ method: 'meihua', result: altered, question: '追问' }));
  }
});

test('梅花复用盘面重新验证取数和关键事实，不接受无效输入', async () => {
  const saved = JSON.parse(JSON.stringify(await calculate('meihua', { ...base, meihua: { method: 'number', number: 135 } })));
  saved.data.evidenceAnalysis.stages[0].promptText = '伪造证据';
  const next = await reprompt({ method: 'meihua', result: saved, question: '追问', prompt: { topicId: 'career', subtopicId: 'job-change', schools: ['yaoci'] } });
  assert.doesNotMatch(next.prompt.text, /伪造证据/);
  assert.match(next.prompt.text, /工作变动/);
  for (const mutate of [
    (d: any) => { d.originalName = '伪造卦名'; },
    (d: any) => { d.calculation.upperTrigramIndex = 2; },
    (d: any) => { d.tiGua.element = '火'; },
    (d: any) => { d.ganzhi.day = '甲子'; },
  ]) {
    const altered = structuredClone(saved); mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'meihua', result: altered, question: '追问' }));
  }
  for (const meihua of [{ method: 'number' }, { method: 'time', number: 2 }, { method: 'direction', direction: 'east' }, { method: 'character', characterText: '天地' }, { method: 'random', seed: 'x' }]) {
    await assert.rejects(() => calculate('meihua', { ...base, meihua }));
  }
});

test('Worker 的 HTTP 和 MCP 使用相同梅花盘面与提示词', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'meihua' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { ...base, meihua: { method: 'number', number: 135 } };
  const http = await send('/api/calculate', { method: 'meihua', input });
  assert.equal(http.status, 200);
  const result = await http.json();
  const next = await send('/api/prompt', { method: 'meihua', result, question: '追问' });
  assert.equal(next.status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'meihua', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.originalName, result.data.originalName);
});

test('梅花易数支持真太阳时经度校正与追问复算', async () => {
  const iso = '2025-05-01T15:30:00Z';
  const beijing = await calculate('meihua', { question: '合作前景', currentTime: iso, meihua: { method: 'time', timeStandard: 'beijing' } });
  const kashgar = await calculate('meihua', { question: '合作前景', currentTime: iso, meihua: { method: 'time', timeStandard: 'true-solar', longitude: 76 } });
  assert.notEqual(kashgar.data.ganzhi.hour, beijing.data.ganzhi.hour);
  assert.equal(kashgar.data.calculation.timeStandard, 'true-solar');
  const next = await reprompt({ method: 'meihua', result: JSON.parse(JSON.stringify(kashgar)), question: '继续问' });
  assert.match(next.prompt.text, /真太阳时/);
  await assert.rejects(() => calculate('meihua', { question: '缺经度', currentTime: iso, meihua: { method: 'time', timeStandard: 'true-solar' } }));
  await assert.rejects(() => calculate('meihua', { question: '多经度', currentTime: iso, meihua: { method: 'time', timeStandard: 'beijing', longitude: 116 } }));
});
