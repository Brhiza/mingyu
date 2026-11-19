import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

const currentTime = '2025-01-01T00:00:00Z';
const range = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };

function checkEvidence(chart: any) {
  const evidence = chart.evidenceAnalysis;
  assert.ok(evidence);
  for (const removed of ['evidence', 'promptText', 'calculationSteps', 'calculationFacts', 'calculationChain', 'ruleSources', 'counterEvidence', 'timingConditions', 'directionConditions', 'summaryFact', 'limitationFacts']) assert.equal(removed in evidence, false, removed);
  for (const field of ['calculationEvidenceFacts', 'ruleSourceFacts', 'palaceFacts', 'candidates', 'patternFacts', 'counterEvidenceFacts', 'timingFacts', 'directionFacts', 'limitations']) {
    assert.ok(Array.isArray(evidence[field]), field);
  }
  assert.equal(evidence.palaceFacts.length, 9);
  assert.ok(evidence.calculationEvidenceFacts.length > 0);
  assert.equal(evidence.limitations.length, 6);
  assert.ok(evidence.limitations.some((item: string) => item.includes('用神')));
  assert.ok(evidence.limitations.some((item: string) => item.includes('应期')));
}

test('四种奇门层级保留结构化证据与适用的节令提示词，原盘可追问', async () => {
  for (const scope of ['hour', 'day', 'month', 'year'] as const) for (const method of ['zhuanpan', 'feipan'] as const) {
    const saved = JSON.parse(JSON.stringify(await calculate('qimen', { question: '原问题', currentTime, qimen: { scope, method } })));
    checkEvidence(saved.data);
    if (scope === 'hour' || scope === 'day') {
      assert.match(saved.prompt.text, /【节令背景】/);
      assert.ok(saved.prompt.text.includes(`月相${saved.data.seasonality.lunarPhase}（${saved.data.seasonality.lunarPhaseDetail}）`));
    } else assert.doesNotMatch(saved.prompt.text, /【节令背景】/);
    const next = await reprompt({ method: 'qimen', result: saved, question: '原问题', currentTime });
    assert.equal(next.prompt.text, saved.prompt.text, `${scope}/${method}`);
  }
});

test('范围分支与终身局保留证据，不重复旧通用提示词', async () => {
  const ranged = JSON.parse(JSON.stringify(await calculate('qimen', { question: '原问题', currentTime, range, qimen: { scope: 'hour' } })));
  for (const branch of ranged.data.branches) checkEvidence(branch.data);
  assert.equal((await reprompt({ method: 'qimen', result: ranged, question: '原问题', currentTime })).prompt.text, ranged.prompt.text);
  const lifetime = JSON.parse(JSON.stringify(await calculate('qimen-lifetime', { question: '原问题', currentTime, birth: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8 } })));
  checkEvidence(lifetime.data.baseChart);
  assert.equal((await reprompt({ method: 'qimen-lifetime', result: lifetime, question: '原问题', currentTime })).prompt.text, lifetime.prompt.text);
});
