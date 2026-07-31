import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeQimenEvidence,
  generateQimen,
  rebuildAuditedQimenData,
} from 'mingyu-core/divination/qimen';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

test('奇门排盘应内置九宫位置与宫间关系结构化证据', () => {
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
  assert.ok(evidence.positionIndexes.length > 0);
  assert.ok(
    evidence.positionIndexes.every((item) =>
      evidence.palaceFacts.some((fact) => fact.key === item.palaceFactKey),
    ),
  );
  assert.ok(evidence.positionIndexes.some((item) => item.indexSources.includes('值符落宫')));
  assert.ok(evidence.positionIndexes.some((item) => item.indexSources.includes('值使落宫')));
  assert.equal(evidence.palaceRelations.length, 36);
  assert.equal(new Set(evidence.palaceRelations.map((item) => item.key)).size, 36);
  assert.ok(
    evidence.palaceRelations.every(
      (item) =>
        item.fromGong < item.toGong &&
        evidence.palaceFacts.some((fact) => fact.key === item.fromPalaceFactKey) &&
        evidence.palaceFacts.some((fact) => fact.key === item.toPalaceFactKey),
    ),
  );
  assert.equal(evidence.summaryFact.status, '盘面资料完整');
  assert.equal(evidence.summaryFact.palaceFactCount, evidence.palaceFacts.length);
  assert.equal(evidence.summaryFact.positionIndexCount, evidence.positionIndexes.length);
  assert.equal(evidence.summaryFact.palaceRelationCount, evidence.palaceRelations.length);
  assert.equal(evidence.summaryFact.patternCount, evidence.patternFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingFactCount, evidence.timingFacts.length);
  assert.equal(evidence.directionBoundaryFact.status, '仅保留九宫方向');
  assert.equal(evidence.limitationFacts.length, 6);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every((item) => item.ownerFactKeys.every((key) => factKeys.has(key))),
  );
  assert.match(evidence.promptText, /【奇门九宫位置与关系结构化证据】/);
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

test('奇门证据应明确位置索引不等于已按问题选定用神', () => {
  const evidence = analyzeQimenEvidence(generateQimen(fixedDate));

  assert.match(evidence.promptText, /不自动指定具体问题的用神宫/);
  assert.match(evidence.promptText, /不等于已经按具体问题选定用神/);
  assert.match(evidence.promptText, /未按具体问题选定用神并取得目标期限前，不生成应期快慢/);
  assert.match(evidence.promptText, /通用入口不生成吉方、避方或候选方向/);
  assert.match(evidence.promptText, /不得输出吉凶总分、成功率/);
});

test('奇门证据应保留真实空亡与宫间五行反证', () => {
  const data = generateQimen(new Date('2024-01-01T17:00:00+08:00'));
  const evidence = analyzeQimenEvidence(data);
  const voidPalace = evidence.palaceFacts.find((item) => item.isVoid);

  assert.ok(voidPalace);
  assert.ok(evidence.counterEvidenceFacts.some((item) => item.detail.includes('宫位逢空')));
  assert.equal(evidence.palaceRelations.length, 36);
  assert.ok(evidence.palaceRelations.every((item) => item.relation.length > 0));
});

test('奇门审核重建应删除旧方位应期并重算经典格局', () => {
  const clean = generateQimen(fixedDate);
  const polluted = {
    ...clean,
    directions: {
      goodDirections: [{ gong: 1, direction: '北', use: '必胜', reasons: ['伪造'] }],
      avoidDirections: [{ gong: 2, direction: '西南', use: '必败', reasons: ['伪造'] }],
    },
    yingQi: { rhythm: '快', triggerConditions: ['三日必成'] },
    classicPatterns: [{ name: '伪造大吉格', type: 'good', summary: '现实必胜', palaces: [1] }],
  } as unknown as Parameters<typeof rebuildAuditedQimenData>[0];

  const rebuilt = rebuildAuditedQimenData(polluted) as unknown as Record<string, unknown>;

  assert.equal(rebuilt.directions, undefined);
  assert.equal(rebuilt.yingQi, undefined);
  assert.doesNotMatch(JSON.stringify(rebuilt.classicPatterns), /伪造|必胜/);
});
