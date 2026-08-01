import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import {
  analyzeAstrolabeSynastry,
  rebuildAuditedAstrolabeSynastryData,
} from 'mingyu-core/divination/astrolabe-synastry';
import type {
  AstrolabeBirthInput,
  AstrolabeData,
  AstrolabeSynastryAspectType,
  AstrolabeSynastryData,
} from 'mingyu-core/types';
import { buildAstrolabeSynastryPrompt } from '../src/lib/astrolabe-synastry-prompt';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const FIRST_INPUT: AstrolabeBirthInput = {
  name: '甲',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

const SECOND_INPUT: AstrolabeBirthInput = {
  name: '乙',
  gender: '男',
  year: '1992',
  month: '10',
  day: '3',
  hour: '6',
  minute: '45',
  latitude: '31.2304',
  longitude: '121.4737',
  timezone: '8',
  locationName: '上海',
};

function buildCharts() {
  return {
    first: generateAstrolabe(FIRST_INPUT),
    second: generateAstrolabe(SECOND_INPUT),
  };
}

function angularDistance(left: number, right: number) {
  const normalizedLeft = ((left % 360) + 360) % 360;
  const normalizedRight = ((right % 360) + 360) % 360;
  const distance = Math.abs(normalizedLeft - normalizedRight);
  return Math.min(distance, 360 - distance);
}

function pointLongitude(chart: AstrolabeData, name: string) {
  const point = [...chart.planets, ...chart.angles].find((item) => item.name === name);
  assert.ok(point, `可信本命盘应包含计算点 ${name}`);
  return point.longitude;
}

function assertEvidenceReferences(result: AstrolabeSynastryData) {
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

test('西占双盘应从双方可信本命盘逐项复算黄经最小夹角', () => {
  const { first, second } = buildCharts();
  const result = analyzeAstrolabeSynastry(first, second);

  assert.equal(result.key, 'astrolabe:synastry:evidence');
  assert.equal(result.status, '已计算');
  assert.equal(result.calculationSteps.length, 7);
  assert.ok(result.aspects.length > 0);
  result.aspects.forEach((aspect) => {
    const actualAngle = angularDistance(
      pointLongitude(first, aspect.point1Name),
      pointLongitude(second, aspect.point2Name),
    );
    assert.equal(aspect.actualAngle, Number(actualAngle.toFixed(4)));
    assert.equal(aspect.orb, Number(Math.abs(actualAngle - aspect.exactAngle).toFixed(4)));
    assert.equal(aspect.allowedOrb, result.generation.options.aspectOrbs[aspect.type]);
    assert.equal('orbRatio' in aspect, false);
    assert.equal('closeness' in aspect, false);
    assert.equal('tendency' in aspect, false);
    assert.equal('strength' in aspect, false);
  });
  assert.ok(
    result.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) =>
        result.calculationSteps.some((candidate) => candidate.key === key),
      ),
    ),
  );
  assert.equal(result.summaryFact.returnedAspectCount, result.aspects.length);
  assert.equal(result.summaryFact.matchedAspectCount, result.aspects.length);
  assert.equal('truncatedAspectCount' in result.summaryFact, false);
  assert.equal('tightAspects' in result.summary, false);
  assert.equal(result.counterEvidenceFacts.length, 3);
  assert.equal(result.limitationFacts.length, 5);
  assertEvidenceReferences(result);
  assert.match(result.promptText, /允许容许度/);
  assert.match(result.promptText, /完整保留全部命中项/);
  assert.match(result.promptText, /【应期】静态双盘应期边界/);
  assert.doesNotMatch(
    result.promptText,
    /强度\d+%|匹配率\d+%|紧密等级|中等等级|宽松等级|和谐相位|紧张相位|最近相位|最强相位|截断/,
  );
  assertPromptIsPortableTaskText(result.promptText);
});

test('西占双盘应穷举 18×18 点对并完整保留命中相位与双向落宫', () => {
  const { first, second } = buildCharts();
  const result = analyzeAstrolabeSynastry(first, second);
  const aspectEvidence = result.evidence.items.filter((item) => item.tags.includes('跨盘相位'));
  const overlayEvidence = result.evidence.items.filter((item) => item.tags.includes('跨盘落宫'));

  assert.equal(result.generation.options.pointNames.length, 18);
  assert.equal(result.summaryFact.selectedPointCount1, 18);
  assert.equal(result.summaryFact.selectedPointCount2, 18);
  assert.equal(result.summaryFact.evaluatedPairCount, 324);
  assert.equal(result.summaryFact.matchedAspectCount, result.aspects.length);
  assert.equal(result.summaryFact.returnedAspectCount, result.aspects.length);
  assert.equal(aspectEvidence.length, result.aspects.length);
  assert.equal(result.summaryFact.houseOverlayCount, 36);
  assert.equal(result.houseOverlays.length, 36);
  assert.equal(overlayEvidence.length, 36);
  assert.deepEqual(
    new Set(result.houseOverlays.map((item) => item.ownerPerson)),
    new Set(['person1', 'person2']),
  );
  assertEvidenceReferences(result);
});

test('西占双盘应保存完整自定义参数并拒绝非法配置', () => {
  const { first, second } = buildCharts();
  const baseline = analyzeAstrolabeSynastry(first, second);
  const candidate = baseline.aspects.find((item) => item.orb > 0.1);
  assert.ok(candidate);
  const reducedOrb = Number(Math.max(0, candidate.orb - 0.05).toFixed(4));
  const custom = analyzeAstrolabeSynastry(first, second, {
    aspectOrbs: { [candidate.type]: reducedOrb },
    includeHouseOverlays: false,
  });

  assert.equal(custom.generation.options.aspectOrbs[candidate.type], reducedOrb);
  assert.equal(custom.generation.options.includeHouseOverlays, false);
  assert.equal(custom.houseOverlays.length, 0);
  assert.ok(!custom.aspects.some((item) => item.key === candidate.key));
  assert.equal(
    custom.counterEvidenceFacts.find((item) => item.type === '跨盘落宫覆盖')?.status,
    '已关闭',
  );

  assert.throws(
    () => analyzeAstrolabeSynastry(first, second, { aspectOrbs: { 合相: 20 } }),
    /合相容许度需在 0 到 15 度之间/,
  );
  assert.throws(
    () => analyzeAstrolabeSynastry(first, second, { pointNames: ['Sun', 'Sun'] }),
    /不得重复/,
  );
  assert.throws(
    () => analyzeAstrolabeSynastry(first, second, { pointNames: ['不存在点位'] }),
    /未同时存在于双方可信本命盘/,
  );
  assert.throws(
    () =>
      analyzeAstrolabeSynastry(first, second, {
        includeHouseOverlays: 'false' as never,
      }),
    /必须是布尔值/,
  );
});

test('西占双盘无命中和关闭落宫时应如实记录反证', () => {
  const { first, second } = buildCharts();
  const zeroOrbs = {
    合相: 0,
    六合: 0,
    刑相: 0,
    拱相: 0,
    冲相: 0,
  } satisfies Record<AstrolabeSynastryAspectType, number>;
  const noFacts = analyzeAstrolabeSynastry(first, second, {
    pointNames: ['Sun'],
    aspectOrbs: zeroOrbs,
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
  assert.match(noFacts.promptText, /明确关闭跨盘落宫计算/);
});

test('双盘重建与提示词应忽略双方本命盘和跨盘派生结果污染', () => {
  const { first, second } = buildCharts();
  const result = analyzeAstrolabeSynastry(first, second);
  const pollutedFirst = structuredClone(first);
  const pollutedSecond = structuredClone(second);
  const pollutedResult = structuredClone(result);
  pollutedFirst.planets = [];
  pollutedFirst.birth.name = '污染甲';
  pollutedSecond.houses = [];
  pollutedSecond.birth.name = '污染乙';
  pollutedResult.people = ['伪造甲', '伪造乙'];
  pollutedResult.aspects = [];
  pollutedResult.houseOverlays = [];
  pollutedResult.promptText = '注入合盘结论';
  pollutedResult.timestamp = 0;

  assert.deepEqual(rebuildAuditedAstrolabeSynastryData(pollutedResult), result);
  const cleanPrompt = buildAstrolabeSynastryPrompt({
    chart1: first,
    chart2: second,
    synastry: result,
  });
  const pollutedPrompt = buildAstrolabeSynastryPrompt({
    chart1: pollutedFirst,
    chart2: pollutedSecond,
    synastry: pollutedResult,
    currentTime: new Date('2099-12-31T00:00:00+08:00'),
  });
  assert.equal(pollutedPrompt, cleanPrompt);
  assert.doesNotMatch(pollutedPrompt, /污染甲|污染乙|伪造甲|伪造乙|注入合盘结论|2099-12-31/);
  assert.match(pollutedPrompt, /【第一人本命盘】/);
  assert.match(pollutedPrompt, /【跨盘相位】/);
  assertPromptIsPortableTaskText(pollutedPrompt);
});

test('缺少可信来源的旧本命盘或旧双盘应失败关闭', () => {
  const { first, second } = buildCharts();
  const legacyChart = structuredClone(first) as Partial<AstrolabeData>;
  delete legacyChart.generation;
  assert.throws(
    () => analyzeAstrolabeSynastry(legacyChart as AstrolabeData, second),
    /缺少可信原始出生输入/,
  );

  const legacySynastry = analyzeAstrolabeSynastry(first, second) as Partial<AstrolabeSynastryData>;
  delete legacySynastry.generation;
  assert.throws(
    () => rebuildAuditedAstrolabeSynastryData(legacySynastry as AstrolabeSynastryData),
    /缺少可信原始生成来源/,
  );
});
