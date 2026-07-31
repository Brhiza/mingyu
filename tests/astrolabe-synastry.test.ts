import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAstrolabeSynastry } from 'mingyu-core/divination/astrolabe-synastry';
import type { AstrolabeData, AstrolabePoint } from 'mingyu-core/types';
import { buildAstrolabeSynastryPrompt } from '../src/lib/astrolabe-synastry-prompt';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const FULL_POINT_DEFINITIONS = [
  ['Sun', '太阳'],
  ['Moon', '月亮'],
  ['Mercury', '水星'],
  ['Venus', '金星'],
  ['Mars', '火星'],
  ['Jupiter', '木星'],
  ['Saturn', '土星'],
  ['Uranus', '天王星'],
  ['Neptune', '海王星'],
  ['Pluto', '冥王星'],
  ['Chiron', '凯龙星'],
  ['Juno', '婚神星'],
  ['North Node', '北交点'],
  ['South Node', '南交点'],
  ['Ascendant', '上升'],
  ['Midheaven', '天顶'],
  ['Descendant', '下降'],
  ['Imum Coeli', '天底'],
] as const;

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

function fullPointChart(name: string, longitude = 0): AstrolabeData {
  const base = chart(name, longitude, longitude);
  const points = FULL_POINT_DEFINITIONS.map(([pointName, label]) =>
    point(pointName, label, longitude),
  );
  return {
    ...base,
    planets: points.slice(0, 14),
    angles: points.slice(14),
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
  assert.equal('orbRatio' in (conjunction ?? {}), false);
  assert.equal('closeness' in (conjunction ?? {}), false);
  assert.equal('tendency' in (conjunction ?? {}), false);
  assert.equal('tags' in (conjunction ?? {}), false);
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
  assert.equal('tightAspects' in result.summary, false);
  assert.equal('closestAspects' in result.summary, false);
  assert.equal('harmonious' in result.summary, false);
  assert.equal('tense' in result.summary, false);
  assert.equal('strongAspects' in result.summary, false);
  assert.equal(result.summaryFact.returnedAspectCount, result.aspects.length);
  assert.equal(result.summaryFact.evaluatedPairCount, 9);
  assert.equal(result.summaryFact.matchedAspectCount, result.aspects.length);
  assert.equal('truncatedAspectCount' in result.summaryFact, false);
  assert.equal('tendencyCounts' in result.summaryFact, false);
  assert.equal(result.methodology.defaultOrbs.合相, 8);
  assert.match(result.promptText, /允许容许度/);
  assert.match(result.promptText, /此处只记录跨盘相位事实，不单独推导关系吉凶/);
  assert.match(result.promptText, /完整保留全部命中项/);
  assert.match(result.promptText, /【应期】静态双盘应期边界/);
  assert.match(result.promptText, /计算链概览/);
  assert.equal(result.counterEvidenceFacts.length, 3);
  assert.equal(result.limitationFacts.length, 5);
  assertEvidenceReferences(result);
  assert.ok(result.promptText.length < 10000);
  assert.doesNotMatch(result.promptText, /本项目|项目统一|工程|接口|API|MCP|astrolabe:synastry:/);
  assertPromptIsPortableTaskText(result.promptText);
  assert.doesNotMatch(
    result.promptText,
    /强度\d+%|匹配率\d+%|紧密等级|中等等级|宽松等级|和谐相位|紧张相位|最近相位|最强相位|截断/,
  );
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
  const exactOnly = analyzeAstrolabeSynastry(chart('甲', 0, 120), chart('乙', 0, 210), {
    pointNames: ['Sun'],
    aspectOrbs: { 合相: 0 },
  });
  assert.equal(exactOnly.aspects.length, 1);
  assert.equal(exactOnly.aspects[0]?.allowedOrb, 0);
});

test('西占双盘应如实记录未命中相位和关闭落宫的反证', () => {
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

test('西占双盘应穷举 18×18 点对并完整保留全部相位与双向落宫', () => {
  const first = fullPointChart('甲');
  const second = fullPointChart('乙');
  const result = analyzeAstrolabeSynastry(first, second);
  const aspectEvidence = result.evidence.items.filter((item) => item.tags.includes('跨盘相位'));
  const overlayEvidence = result.evidence.items.filter((item) => item.tags.includes('跨盘落宫'));

  assert.equal(result.summaryFact.selectedPointCount1, 18);
  assert.equal(result.summaryFact.selectedPointCount2, 18);
  assert.equal(result.summaryFact.evaluatedPairCount, 324);
  assert.equal(result.summaryFact.matchedAspectCount, 324);
  assert.equal(result.summaryFact.returnedAspectCount, 324);
  assert.equal(result.aspects.length, 324);
  assert.equal(aspectEvidence.length, 324);
  assert.equal(result.summaryFact.houseOverlayCount, 36);
  assert.equal(result.houseOverlays.length, 36);
  assert.equal(overlayEvidence.length, 36);
  assert.equal(result.aspects.at(-1)?.point1Name, 'Imum Coeli');
  assert.equal(result.aspects.at(-1)?.point2Name, 'Imum Coeli');
  assert.equal(result.houseOverlays.at(-1)?.pointName, 'Imum Coeli');
  assertEvidenceReferences(result);

  const prompt = buildAstrolabeSynastryPrompt({
    chart1: first,
    chart2: second,
    synastry: result,
    currentTime: new Date('2026-07-31T00:00:00+08:00'),
  });
  assert.match(prompt, /甲天底与乙天底：合相/);
  assert.match(prompt, /甲天底落入乙本命盘第1宫/);
  assert.match(prompt, /实际夹角0\.00°，精确角0\.00°，偏差0\.00°，采用容许度8\.00°/);
  assert.doesNotMatch(
    prompt,
    /紧密等级|中等等级|宽松等级|和谐相位|紧张相位|最近相位|最强相位|截断/,
  );
  assertPromptIsPortableTaskText(prompt);
});

test('西占双盘在自定义容许度重叠时应保留同一点对的全部命中相位', () => {
  const result = analyzeAstrolabeSynastry(chart('甲', 0, 120), chart('乙', 75, 210), {
    pointNames: ['Sun'],
    aspectOrbs: { 六合: 15, 刑相: 15 },
    includeHouseOverlays: false,
  });

  assert.deepEqual(
    result.aspects.map((item) => item.type),
    ['六合', '刑相'],
  );
  assert.deepEqual(
    result.aspects.map((item) => item.orb),
    [15, 15],
  );
  assert.equal(result.summaryFact.evaluatedPairCount, 1);
  assert.equal(result.summaryFact.matchedAspectCount, 2);
  assert.equal(result.summaryFact.returnedAspectCount, 2);
});
