import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeQimenEvidence, generateQimen } from 'mingyu-core/divination/qimen';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

test('奇门排盘应内置用神宫与宫间作用结构化证据', () => {
  const data = generateQimen(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(data.jiuGongGe.length, 9);
  assert.ok(evidence.candidates.length > 0);
  assert.ok(evidence.candidates.some((item) => item.sources.includes('值符落宫')));
  assert.ok(evidence.candidates.some((item) => item.sources.includes('值使落宫')));
  assert.match(evidence.promptText, /【奇门用神宫与宫间作用结构化证据】/);
  assert.match(evidence.promptText, /门.+、星.+、神.+、天盘.+、地盘/);
  assert.doesNotMatch(
    evidence.promptText,
    /主宫评分|辅宫评分|权重[：=]?\d|评分-?\d+|（-?\d+分|成功率[：=]?\d|应期范围\d/,
  );
});

test('奇门证据应明确候选不等于已按问题选定用神', () => {
  const evidence = analyzeQimenEvidence(generateQimen(fixedDate));

  assert.match(evidence.promptText, /均为盘面候选/);
  assert.match(evidence.promptText, /不等于已经按具体问题选定用神/);
  assert.match(evidence.promptText, /未给目标期限时不把宫数、局数或内部应期范围换算成唯一日期/);
  assert.match(evidence.promptText, /方位仅在现实路线、安全和事项用神均匹配时采用/);
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
