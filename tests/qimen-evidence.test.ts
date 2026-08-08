import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeQimenEvidence, generateQimen } from 'mingyu-core/divination/qimen';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

test('奇门排盘应内置用神宫与宫间作用结构化证据', () => {
  const data = generateQimen(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'qimen:evidence');
  assert.equal(evidence.status, '已计算');
  assert.deepEqual(evidence.calculationSteps, evidence.calculationEvidenceFacts);
  assert.equal(evidence.calculationChain.length, evidence.calculationEvidenceFacts.length);
  assert.equal(data.jiuGongGe.length, 9);
  assert.equal(evidence.palaceFacts.length, 9);
  assert.deepEqual(
    evidence.palaceFacts.map((item) => item.gong),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.ok(
    evidence.palaceFacts.every(
      (item) =>
        item.tianPan &&
        item.diPan &&
        item.renPan &&
        item.shenPan &&
        item.promptText &&
        item.sources.length >= 3 &&
        item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(evidence.candidates.length > 0);
  assert.ok(
    evidence.candidates.every((item) =>
      evidence.palaceFacts.some((fact) => fact.key === item.palaceFactKey),
    ),
  );
  assert.ok(evidence.candidates.some((item) => item.sources.includes('值符落宫')));
  assert.ok(evidence.candidates.some((item) => item.sources.includes('值使落宫')));
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.palaceFactCount, evidence.palaceFacts.length);
  assert.equal(evidence.summaryFact.candidateCount, evidence.candidates.length);
  assert.equal(evidence.summaryFact.relationCount, evidence.relations.length);
  assert.equal(evidence.summaryFact.patternCount, evidence.patternFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingFactCount, evidence.timingFacts.length);
  assert.equal(evidence.summaryFact.directionFactCount, evidence.directionFacts.length);
  assert.equal(evidence.limitationFacts.length, 6);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every((item) => item.ownerFactKeys.every((key) => factKeys.has(key))),
  );
  assert.match(evidence.promptText, /【奇门用神宫与宫间作用结构化证据】/);
  assert.match(evidence.promptText, /奇门九宫逐宫计算事实/);
  assert.match(evidence.promptText, /计算链：/);
  assert.match(evidence.promptText, /证据汇总：/);
  assert.match(evidence.promptText, /解释限制：/);
  assert.match(evidence.promptText, /门.+、星.+、神.+、天盘.+、地盘/);
  assert.doesNotMatch(
    evidence.promptText,
    /主宫评分|辅宫评分|权重[：=]?\d|评分-?\d+|（-?\d+分|成功率[：=]?\d|应期范围\d/,
  );
  assert.doesNotMatch(evidence.promptText, /qimen:(?:evidence|limitation|calculation):/);
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('奇门证据应明确候选不等于已按问题选定用神', () => {
  const evidence = analyzeQimenEvidence(generateQimen(fixedDate));

  assert.match(evidence.promptText, /均为盘面候选/);
  assert.match(evidence.promptText, /不等于已经按具体问题选定用神/);
  assert.match(evidence.promptText, /未给目标期限时不把宫数、局数或盘内快慢换算成唯一日期/);
  assert.match(evidence.promptText, /方位仅在现实路线、安全和事项用神均匹配时采用/);
  assert.match(evidence.promptText, /不得输出吉凶总分、成功率/);
});

test('Issue #204：结构化依据中的节令背景应采用正式定局三元', () => {
  const data = generateQimen(new Date('2026-08-08T15:14:00+08:00'));
  const evidence = analyzeQimenEvidence(data);

  assert.equal(data.timeInfo.epoch, '中元');
  assert.match(evidence.promptText, /定局立秋中元/);
  assert.doesNotMatch(evidence.promptText, /立秋上元/);
});

test('Issue #204 同类：候选宫支持与制约应按格局类型归类', () => {
  const evidence = analyzeQimenEvidence(generateQimen(new Date('2026-08-08T15:14:00+08:00')));
  const palace = evidence.candidates.find((item) => item.gong === 1);

  assert.ok(palace);
  assert.ok(palace.support.some((item) => item.includes('值符开通闭塞')));
  assert.ok(palace.constraints.some((item) => item.includes('青龙网罗')));
  assert.ok(palace.constraints.some((item) => item.includes('蛇入狱刑')));
  assert.ok(palace.support.every((item) => !/青龙网罗|蛇入狱刑/.test(item)));
  assert.ok(palace.constraints.every((item) => !/逢开利以有为|天乙击冲/.test(item)));
});

test('奇门证据应保留空亡与宫间五行反证', () => {
  const data = generateQimen(fixedDate);
  const first = data.evidenceAnalysis?.candidates[0];
  assert.ok(first);
  data.voidPalaces = [
    ...(data.voidPalaces ?? []),
    { branch: '子', palace: first.gong, name: first.name },
  ];

  const evidence = analyzeQimenEvidence(data);

  assert.equal(evidence.candidates.find((item) => item.gong === first.gong)?.isVoid, true);
  assert.match(evidence.promptText, /宫位逢空/);
  assert.ok(evidence.relations.every((item) => item.relation.length > 0));
});
