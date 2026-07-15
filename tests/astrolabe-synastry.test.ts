import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAstrolabeSynastry } from 'mingyu-core/divination/astrolabe-synastry';
import type { AstrolabeData, AstrolabePoint } from 'mingyu-core/types';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

function point(name: string, label: string, longitude: number, house = 1): AstrolabePoint {
  return {
    name,
    label,
    longitude,
    sign: '测试星座',
    degree: 0,
    minute: 0,
    house,
    formatted: `${longitude}°`,
  };
}

function chart(name: string, sun: number, moon: number): AstrolabeData {
  return {
    birth: {
      name,
      gender: '女',
      dateTime: '2000-01-01 12:00',
      location: '测试地点',
      timezone: 8,
    },
    planets: [point('Sun', '太阳', sun), point('Moon', '月亮', moon)],
    angles: [point('Ascendant', '上升', 15)],
    houses: Array.from({ length: 12 }, (_, index) =>
      point(`House ${index + 1}`, `第${index + 1}宫`, index * 30, index + 1),
    ),
    aspects: [],
    summary: { elements: {}, modalities: {}, retrograde: [], patterns: [] },
    timestamp: 0,
  };
}

function assertEvidenceReferences(result: ReturnType<typeof analyzeAstrolabeSynastry>) {
  const factKeys = new Set([
    result.summaryFact.key,
    ...result.calculationSteps.map((item) => item.key),
    ...result.aspects.map((item) => item.key),
    ...result.houseOverlays.map((item) => item.key),
    ...result.counterEvidenceFacts.map((item) => item.key),
  ]);
  assert.ok(result.summaryFact.factKeys.length > 0);
  assert.ok(result.summaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    result.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    result.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
}

test('西占双盘应按黄经最小夹角识别主要相位并保留计算口径', () => {
  const result = analyzeAstrolabeSynastry(chart('甲', 359, 120), chart('乙', 1, 210));
  const conjunction = result.aspects.find(
    (item) => item.point1 === '太阳' && item.point2 === '太阳',
  );
  const square = result.aspects.find((item) => item.point1 === '月亮' && item.point2 === '月亮');

  assert.equal(conjunction?.type, '合相');
  assert.equal(conjunction?.actualAngle, 2);
  assert.equal(conjunction?.orb, 2);
  assert.equal(conjunction?.allowedOrb, 8);
  assert.equal(conjunction?.orbRatio, 0.25);
  assert.equal(conjunction?.closeness, '紧密');
  assert.equal(result.key, 'astrolabe:synastry:evidence');
  assert.equal(result.status, '已计算');
  assert.equal(result.calculationSteps.length, 7);
  assert.ok(
    result.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) =>
        result.calculationSteps.some((candidate) => candidate.key === key),
      ),
    ),
  );
  assert.ok(conjunction?.key.startsWith('astrolabe:synastry:aspect:'));
  assert.equal(conjunction?.status, '已命中');
  assert.ok(conjunction?.sourcePointKey && conjunction.targetPointKey);
  assert.ok(result.calculationSteps.some((step) => step.key === conjunction?.calculationStepKey));
  assert.equal(conjunction?.strength, undefined);
  assert.match(conjunction?.source ?? '', /黄经最小夹角/);
  assert.equal(square?.type, '刑相');
  assert.equal(square?.orb, 0);
  assert.equal(
    result.summary.tightAspects,
    result.aspects.filter((item) => item.closeness === '紧密').length,
  );
  assert.equal(result.summary.strongAspects, undefined);
  assert.equal(result.summaryFact.returnedAspectCount, result.aspects.length);
  assert.equal(result.summaryFact.evaluatedPairCount, 9);
  assert.equal(result.summaryFact.tendencyCounts.和谐, result.summary.harmonious);
  assert.equal(result.summaryFact.tendencyCounts.紧张, result.summary.tense);
  assert.equal(result.methodology.defaultOrbs.合相, 8);
  assert.match(result.promptText, /允许容许度/);
  assert.match(result.promptText, /此处只记录跨盘相位事实，不单独推导关系吉凶/);
  assert.match(result.promptText, /不得把单一和谐相位写成必然适合/);
  assert.match(result.promptText, /【应期】静态双盘应期边界/);
  assert.match(result.promptText, /计算链概览/);
  assert.equal(result.counterEvidenceFacts.length, 4);
  assert.equal(result.limitationFacts.length, 6);
  assertEvidenceReferences(result);
  assert.ok(result.promptText.length < 10000);
  assert.doesNotMatch(result.promptText, /本项目|项目统一|工程|接口|API|MCP|astrolabe:synastry:/);
  assertPromptIsPortableTaskText(result.promptText);
  assert.doesNotMatch(result.promptText, /强度\d+%|匹配率\d+%/);
});

test('西占双盘应计算双方星体落入对方宫位', () => {
  const result = analyzeAstrolabeSynastry(chart('甲', 35, 125), chart('乙', 65, 215));
  const overlay = result.houseOverlays.find(
    (item) => item.owner === '甲' && item.visitor === '乙' && item.point === '太阳',
  );

  assert.equal(overlay?.house, 3);
  assert.ok(overlay?.key.startsWith('astrolabe:synastry:house-overlay:'));
  assert.equal(overlay?.status, '已定位');
  assert.equal(overlay?.ownerPerson, 'person1');
  assert.equal(overlay?.visitorPerson, 'person2');
  assert.ok(overlay?.ownerChartKey && overlay.visitorPointKey);
  assert.ok(result.calculationSteps.some((step) => step.key === overlay?.calculationStepKey));
  assert.equal(overlay?.houseStart, 60);
  assert.equal(overlay?.houseEnd, 90);
  assert.equal(result.summaryFact.houseOverlayCount, result.houseOverlays.length);
  assertEvidenceReferences(result);
});

test('西占双盘应允许显式调整容许度并拒绝非法参数', () => {
  const first = chart('甲', 0, 120);
  const second = chart('乙', 7, 210);

  assert.ok(
    analyzeAstrolabeSynastry(first, second).aspects.some(
      (item) => item.point1 === '太阳' && item.point2 === '太阳',
    ),
  );
  assert.ok(
    !analyzeAstrolabeSynastry(first, second, { aspectOrbs: { 合相: 5 } }).aspects.some(
      (item) => item.point1 === '太阳' && item.point2 === '太阳',
    ),
  );
  assert.throws(
    () => analyzeAstrolabeSynastry(first, second, { aspectOrbs: { 合相: 20 } }),
    /合相容许度需在 0 到 15 度之间/,
  );
  assert.throws(
    () => analyzeAstrolabeSynastry(first, second, { maxAspects: 0 }),
    /最大相位数需为 1 到 200 之间的整数/,
  );
});

test('西占双盘应保留截断数量和关闭落宫的反证', () => {
  const first = chart('甲', 0, 120);
  const second = chart('乙', 0, 210);
  const truncated = analyzeAstrolabeSynastry(first, second, { maxAspects: 1 });

  assert.equal(truncated.aspects.length, 1);
  assert.ok(truncated.summaryFact.matchedAspectCount > truncated.summaryFact.returnedAspectCount);
  assert.equal(
    truncated.summaryFact.truncatedAspectCount,
    truncated.summaryFact.matchedAspectCount - truncated.summaryFact.returnedAspectCount,
  );
  assert.match(truncated.promptText, /因最大返回数截断/);

  const noFacts = analyzeAstrolabeSynastry(chart('甲', 0, 120), chart('乙', 20, 210), {
    pointNames: ['Sun'],
    includeHouseOverlays: false,
  });
  assert.equal(noFacts.aspects.length, 0);
  assert.equal(noFacts.houseOverlays.length, 0);
  assert.equal(noFacts.summaryFact.status, '未见已列交叉事实');
  assert.equal(
    noFacts.counterEvidenceFacts.find((item) => item.type === '主要相位覆盖')?.status,
    '未命中',
  );
  assert.equal(
    noFacts.counterEvidenceFacts.find((item) => item.type === '跨盘落宫覆盖')?.status,
    '已关闭',
  );
  assertEvidenceReferences(noFacts);
  assert.match(noFacts.promptText, /明确关闭跨盘落宫计算/);
});
