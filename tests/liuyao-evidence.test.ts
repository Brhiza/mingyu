import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import reference from '../src/systems/liuyao-reference.json';
import catalog from '../src/prompt-catalog.json';

const currentTime = '2025-01-01T00:00:00Z';
const liuyao = { method: 'manual', yaos: [6, 7, 8, 9, 7, 8] };
const input = { currentTime, question: '工作如何', liuyao };

test('五种六爻问事模板保留盘面证据和提示词的对应关系', async () => {
  for (const topic of ['general', 'ganqing', 'shiye', 'caifu', 'guaishen'] as const) {
    const result = await calculate('liuyao', { ...input, prompt: { liuyaoTemplate: topic, includeClassics: true, schools: ['huozhulin', 'zengshanbuyi'] } });
    const evidence = result.data.evidenceAnalysis;
    assert.equal(evidence.topic, topic);
    for (const field of ['generationFacts', 'timingConditions', 'counterEvidence', 'calculationChain', 'limitationFacts', 'summaryFact']) assert.ok(!(field in evidence), field);
    for (const field of ['lineFacts', 'hiddenSpiritFacts', 'candidates', 'godChain', 'structureFacts', 'counterEvidenceFacts', 'timingFacts'] as const) {
      for (const item of evidence[field]) assert.ok(result.prompt.text.includes(item.promptText), `${topic}: ${field}`);
    }
    assert.equal(evidence.lineFacts.length, 6);
    assert.equal(evidence.calculationSteps.length, 7);
    assert.ok(evidence.limitations.length >= 6);
    assert.ok(result.prompt.text.includes(reference.templates[topic]));
    assert.match(result.prompt.text, /多口径合参/);
    for (const classic of reference.classics) assert.ok(result.prompt.text.includes(classic.book));
    assert.doesNotMatch(JSON.stringify(result), /"(?:seed|samples|randomTrace)"|随机轨迹|随机种子|\bseed\b|\breplay\b|重放/i);
  }
});

test('保存六爻盘面可切换问题与模板，伪造盘面会被拒绝', async () => {
  const saved = JSON.parse(JSON.stringify(await calculate('liuyao', input)));
  saved.data.evidenceAnalysis.lineFacts[0].promptText = '伪造证据';
  const next = await reprompt({ method: 'liuyao', result: saved, question: '财务如何', prompt: { liuyaoTemplate: 'caifu' } });
  assert.ok(next.prompt.text.includes('财务如何'));
  assert.ok(next.prompt.text.includes(reference.templates.caifu));
  assert.ok(next.prompt.text.includes(saved.data.originalName));
  assert.ok(!next.prompt.text.includes('伪造证据'));
  for (const mutate of [
    (data: any) => { data.originalName = '伪造卦名'; },
    (data: any) => { data.ganzhi.day = '甲子'; },
    (data: any) => { data.yaosDetail[0].sixRelative = '伪造六亲'; },
    (data: any) => { data.timestamp += 3600_000; },
    (data: any) => { data.yaoArray[0] = 7; },
    (data: any) => { data.timezoneOffsetMinutes = 0; },
  ]) {
    const altered = structuredClone(saved);
    mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'liuyao', result: altered, question: '追问' }));
  }
});

test('六爻全部主题、子主题及时间范围进入任务要求', async () => {
  const result = await calculate('liuyao', input);
  for (const topic of catalog.liuyao.topicIds) {
    const subtopics = (catalog.liuyao.subtopics as Record<string, { id: string; label: string }[]>)[topic] ?? [];
    for (const subtopic of subtopics) {
      const next = await reprompt({ method: 'liuyao', result, question: '追问', prompt: { topicId: topic, subtopicId: subtopic.id } });
      assert.ok(next.prompt.text.split('【任务】')[1].includes(subtopic.label), `${topic}/${subtopic.id}`);
    }
  }
  for (const scope of catalog.liuyao.scopeIds) {
    const next = await reprompt({ method: 'liuyao', result, question: '追问', prompt: { scope } });
    assert.match(next.prompt.text, /未提供对应时间资料时明确说明缺口/);
  }
});
