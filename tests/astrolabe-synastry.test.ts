import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAstrolabeSynastry } from '../packages/core/src/divination/astrolabe-synastry.ts';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.ts';
import type { AstrolabeBirthInput, AstrolabeData, AstrolabePoint } from 'mingyu-core/types';
import { assertPromptIsPortableTaskText } from './prompt-assertions';
import { buildAstrolabeSynastryPrompt } from '../packages/core/src/prompt/astrolabe';

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
  const stepKeys = new Set(result.calculationSteps.map((item) => item.key));
  const factKeys = new Set([
    result.summaryFact.key,
    ...result.calculationSteps.map((item) => item.key),
    ...result.aspects.map((item) => item.key),
    ...result.houseOverlays.map((item) => item.key),
    ...result.counterEvidenceFacts.map((item) => item.key),
  ]);
  assert.ok(
    result.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.ok(
    [...result.aspects, ...result.houseOverlays].every((item) =>
      stepKeys.has(item.calculationStepKey),
    ),
  );
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
  assert.ok(conjunction?.sourcePointKey && conjunction.targetPointKey);
  assert.equal(conjunction?.strength, undefined);
  assert.match(conjunction?.source ?? '', /黄经最小夹角/);
  assert.equal(square?.type, '刑相');
  assert.equal(square?.orb, 0);
  assert.equal(result.summary.strongAspects, undefined);
  assert.equal(result.summaryFact.evaluatedPairCount, 9);
  assert.match(result.promptText, /允许容许度/);
  assert.match(result.promptText, /此处只记录跨盘相位事实，不单独推导关系吉凶/);
  assert.match(result.promptText, /不得把单一和谐相位写成必然适合/);
  assert.match(result.promptText, /【应期】静态双盘应期边界/);
  assert.ok(
    result.limitationFacts.some(
      (item) =>
        item.type === '静态应期边界' &&
        item.promptText.includes('静态本命双盘不判断入相、出相或具体关系应期'),
    ),
  );
  assertEvidenceReferences(result);
  assert.ok(result.promptText.length < 10000);
  assert.doesNotMatch(result.promptText, /本项目|项目统一|工程|接口|API|MCP|astrolabe:synastry:/);
  assert.doesNotMatch(result.promptText, /来源：/);
  assert.ok(result.evidence.items.some((item) => item.source));
  assertPromptIsPortableTaskText(result.promptText);
  assert.doesNotMatch(result.promptText, /强度\d+%|匹配率\d+%/);

  // 1/3、2/3 为既有分级界；等级依据几何比例，展示四位舍入不改变归属。
  for (const [deviation, allowedOrb, expected] of [
    [2.6667, 8, '中等'],
    [5.3333, 8, '中等'],
    [0.9999, 3, '紧密'],
    [1, 3, '紧密'],
    [1.0001, 3, '中等'],
    [1.9999, 3, '中等'],
    [2, 3, '中等'],
    [2.0001, 3, '宽松'],
  ] as const) {
    const first = chart('甲', 0, 120);
    const second = chart('乙', deviation, 210);
    const boundary = analyzeAstrolabeSynastry(first, second, {
      pointNames: ['Sun'],
      includeHouseOverlays: false,
      aspectOrbs: { 合相: allowedOrb },
    });
    assert.equal(boundary.aspects.length, 1);
    assert.equal(boundary.aspects[0].closeness, expected, `${deviation}/${allowedOrb}`);
    assert.equal(boundary.aspects[0].orbRatio, Number((deviation / allowedOrb).toFixed(4)));
    const prompt = buildAstrolabeSynastryPrompt({
      chart1: first,
      chart2: second,
      synastry: boundary,
    });
    assert.match(
      prompt,
      new RegExp(`第一人甲的太阳与第二人乙的太阳：合相，目标角0°[^\\n]*${expected}`),
    );
  }
});

test('西占双盘应计算双方星体落入对方宫位', () => {
  const result = analyzeAstrolabeSynastry(chart('甲', 35, 125), chart('乙', 65, 215));
  const overlay = result.houseOverlays.find(
    (item) => item.owner === '甲' && item.visitor === '乙' && item.point === '太阳',
  );

  assert.equal(overlay?.house, 3);
  assert.equal(overlay?.ownerPerson, 'person1');
  assert.equal(overlay?.visitorPerson, 'person2');
  assert.ok(overlay?.ownerChartKey && overlay.visitorPointKey);
  assert.equal(overlay?.houseStart, 60);
  assert.equal(overlay?.houseEnd, 90);
  assertEvidenceReferences(result);
});

test('宫头数量齐全但区间退化或序号重复时不生成该方向落宫', () => {
  const first = chart('甲', 35, 125);
  first.houses = first.houses.map((cusp) => ({ ...cusp, longitude: 0 }));
  const second = chart('乙', 65, 215);
  const degenerate = analyzeAstrolabeSynastry(first, second);

  assert.equal(
    degenerate.houseOverlays.some((item) => item.owner === '甲'),
    false,
  );
  assert.equal(
    degenerate.houseOverlays.some((item) => item.owner === '乙'),
    true,
  );
  assert.equal(
    degenerate.counterEvidenceFacts.find((item) => item.type === '跨盘落宫覆盖')?.status,
    '资料不足',
  );
  assert.match(degenerate.promptText, /宫头序号或黄经区间无效/);
  assert.doesNotMatch(degenerate.promptText, /完成双向定位/);
  const partialPrompt = buildAstrolabeSynastryPrompt({
    chart1: first,
    chart2: second,
    synastry: degenerate,
  });
  assert.match(partialPrompt, /以上仅为可定位方向/);

  first.houses = chart('甲', 35, 125).houses;
  first.houses[1] = { ...first.houses[1], house: 1 };
  const duplicateNumber = analyzeAstrolabeSynastry(first, second);
  assert.equal(
    duplicateNumber.houseOverlays.some((item) => item.owner === '甲'),
    false,
  );

  first.houses = chart('甲', 35, 125).houses;
  first.houses[1] = { ...first.houses[1], longitude: Number.NaN };
  const invalidLongitude = analyzeAstrolabeSynastry(first, second);
  assert.equal(
    invalidLongitude.houseOverlays.some((item) => item.owner === '甲'),
    false,
  );
  assert.equal(
    invalidLongitude.houseOverlays.some((item) => item.owner === '乙'),
    true,
  );
  assert.equal(
    invalidLongitude.counterEvidenceFacts.find((item) => item.type === '跨盘落宫覆盖')?.status,
    '资料不足',
  );
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
    () => analyzeAstrolabeSynastry(first, second, { pointNames: [], aspectOrbs: { 合相: 20 } }),
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
  assert.match(
    buildAstrolabeSynastryPrompt({ chart1: first, chart2: second, synastry: truncated }),
    new RegExp(`本次命中${truncated.summaryFact.matchedAspectCount}项，列出1项`),
  );

  const noFacts = analyzeAstrolabeSynastry(chart('甲', 0, 120), chart('乙', 20, 210), {
    pointNames: ['Sun'],
    includeHouseOverlays: false,
  });
  assert.equal(noFacts.aspects.length, 0);
  assert.equal(noFacts.houseOverlays.length, 0);
  assert.equal(noFacts.summaryFact.status, '未见已列交叉事实');
  assert.match(noFacts.receptionSummary ?? '', /跨盘相位与落宫以已列事实为准/);
  assert.doesNotMatch(noFacts.receptionSummary ?? '', /几何相位交感为主/);
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
  const noFactsPrompt = buildAstrolabeSynastryPrompt({
    chart1: chart('甲', 0, 120),
    chart2: chart('乙', 20, 210),
    synastry: noFacts,
  });
  assert.match(noFactsPrompt, /本次所选计算点未见容许度内的主要相位/);
  assert.doesNotMatch(noFactsPrompt, /【跨盘落宫】|本次未启用跨盘落宫计算/);
  assert.match(noFactsPrompt, /请依据双方本命盘分析互动主轴/);
  assert.doesNotMatch(noFactsPrompt, /已列古典接纳与互溶/);
  assert.doesNotMatch(noFactsPrompt, /请依据双方本命盘、跨盘相位和跨盘落宫/);
});

test('西占双盘提示词不输出空性别占位并按已列资料限定关系需求', () => {
  const first = chart('甲', 15, 120);
  const second = chart('乙', 45, 210);
  delete first.birth.gender;
  delete second.birth.gender;
  first.birth.timezone = 4 + (51 * 60 + 16) / 3600;
  first.planets = [point('Venus', '金星', 15)];
  second.planets = [point('Mars', '火星', 45)];

  const synastry = analyzeAstrolabeSynastry(first, second, {
    pointNames: ['Venus', 'Mars'],
    includeHouseOverlays: false,
  });
  const prompt = buildAstrolabeSynastryPrompt({ chart1: first, chart2: second, synastry });

  assert.match(prompt, /出生信息：甲；2000-01-01 12:00/);
  assert.match(prompt, /时区UTC\+04:51:16/);
  assert.match(prompt, /时区UTC\+08:00/);
  assert.doesNotMatch(prompt, /性别未填|；；/);
  assert.match(prompt, /有现实资料时结合问题所述情况/);
  assert.doesNotMatch(prompt, /关系需求构成各自本命资料/);
  assert.match(prompt, /双方本命盘、已列古典接纳与互溶/);
  assert.match(prompt, /【第一人本命盘】[\s\S]*?金星15°/);
  assert.match(prompt, /【第二人本命盘】[\s\S]*?火星45°/);
  assert.match(prompt, /甲的金星落白羊座，乙的火星落金牛座/);
});

test('西占合盘互溶与接纳判定：识别金火互溶与接纳断诀', () => {
  const chart1: AstrolabeData = {
    ...chart('甲', 0, 120),
    planets: [
      point('Sun', '太阳', 0),
      point('Moon', '月亮', 120),
      point('Venus', '金星', 15), // 白羊座 15度（火星守护）
    ],
  };
  const chart2: AstrolabeData = {
    ...chart('乙', 30, 150),
    planets: [
      point('Sun', '太阳', 30),
      point('Moon', '月亮', 150),
      point('Mars', '火星', 45), // 金牛座 15度（金星守护）
    ],
  };

  const result = analyzeAstrolabeSynastry(chart1, chart2, {
    pointNames: ['Sun', 'Moon', 'Venus', 'Mars'],
  });

  assert.ok(result.receptions);
  assert.ok(result.receptions.length >= 1);
  const mutual = result.receptions.find((r) => r.type === '互溶');
  assert.ok(mutual);
  // 互溶分支只核验入庙守护，不再混称“庙旺”；曜升互溶未核验
  assert.match(mutual.summary, /入庙守护/);
  assert.match(mutual.summary, /守护互溶/);
  assert.match(mutual.summary, /甲的金星落白羊座，乙的火星落金牛座/);
  assert.doesNotMatch(mutual.summary, /庙旺互溶/);
  assert.match(result.promptText, /【古典接纳互溶】/);
  const filtered = analyzeAstrolabeSynastry(chart1, chart2, { pointNames: ['Sun', 'Moon'] });
  assert.equal(
    filtered.receptions?.some((item) => item.type === '互溶'),
    false,
  );
});

test('同名行星各守本宫不构成守护互溶', () => {
  const first = { ...chart('甲', 120, 0), planets: [point('Sun', '太阳', 120)] };
  const second = { ...chart('乙', 120, 0), planets: [point('Sun', '太阳', 120)] };
  const result = analyzeAstrolabeSynastry(first, second, { pointNames: ['Sun'] });

  assert.equal(result.receptions?.filter((item) => item.type === '互溶').length, 0);
});

test('守护互溶伴随相位时不重复记录两个单向接纳', () => {
  const first = { ...chart('甲', 0, 0), planets: [point('Venus', '金星', 0)] };
  const second = { ...chart('乙', 180, 0), planets: [point('Mars', '火星', 180)] };
  const result = analyzeAstrolabeSynastry(first, second, {
    pointNames: ['Venus', 'Mars'],
    includeHouseOverlays: false,
  });

  assert.equal(result.aspects.length, 1);
  assert.equal(result.aspects[0].type, '冲相');
  assert.deepEqual(
    result.receptions?.map((item) => item.type),
    ['互溶'],
  );
  assert.match(result.receptionSummary ?? '', /守护互溶/);
});

test('接纳使用全部命中相位且沿用计算点筛选', () => {
  const first = {
    ...chart('甲', 90, 0),
    planets: [point('Sun', '太阳', 90), point('Venus', '金星', 1)],
  };
  const second = {
    ...chart('乙', 90, 0),
    planets: [point('Sun', '太阳', 90), point('Mars', '火星', 2)],
  };
  const limited = analyzeAstrolabeSynastry(first, second, { maxAspects: 1 });
  const complete = analyzeAstrolabeSynastry(first, second);
  const selected = analyzeAstrolabeSynastry(first, second, { pointNames: ['Sun'] });

  assert.equal(limited.aspects.length, 1);
  assert.deepEqual(limited.receptions, complete.receptions);
  assert.ok(limited.receptions?.some((item) => item.person1Planet === 'Venus'));
  assert.equal(selected.receptions?.length, 0);
});

test('曜升双向接纳保留两人方向，水星入庙兼曜升同时列明', () => {
  const first = { ...chart('甲', 59, 0), planets: [point('Sun', '太阳', 59)] };
  const second = { ...chart('乙', 0, 0), planets: [point('Moon', '月亮', 0)] };
  const result = analyzeAstrolabeSynastry(first, second, { pointNames: ['Sun', 'Moon'] });
  const directed = result.receptions?.filter((item) => item.type === '接纳') ?? [];

  assert.equal(result.aspects.length, 1);
  assert.equal(result.aspects[0].type, '六合');
  assert.equal(directed.length, 2);
  assert.ok(directed.some((item) => item.summary.includes('乙的月亮接纳甲的太阳')));
  assert.ok(directed.some((item) => item.summary.includes('甲的太阳接纳乙的月亮')));
  assert.ok(directed.every((item) => item.summary.includes('曜升')));

  const birth: Omit<AstrolabeBirthInput, 'name' | 'hour'> = {
    gender: '女',
    year: '2024',
    month: '9',
    day: '15',
    minute: '0',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  };
  const virgoFirst = generateAstrolabe({ ...birth, name: '甲', hour: '12' });
  const virgoSecond = generateAstrolabe({ ...birth, name: '乙', hour: '13' });
  assert.equal(
    virgoFirst.planets.find((planet) => planet.name === 'Mercury')?.dignityLabel,
    '入庙、曜升',
  );
  const virgoSynastry = analyzeAstrolabeSynastry(virgoFirst, virgoSecond, {
    pointNames: ['Mercury'],
    includeHouseOverlays: false,
  });
  assert.equal(virgoSynastry.aspects[0]?.type, '合相');
  assert.ok((virgoSynastry.aspects[0]?.actualAngle ?? Infinity) < 0.1);
  const mercuryReceptions = virgoSynastry.receptions?.filter(
    (item) => item.type === '接纳' && item.person1Planet === 'Mercury',
  );
  assert.equal(mercuryReceptions?.length, 2);
  assert.ok(mercuryReceptions?.every((item) => item.summary.includes('入庙、曜升星座')));
  const virgoPrompt = buildAstrolabeSynastryPrompt({
    chart1: virgoFirst,
    chart2: virgoSecond,
    synastry: virgoSynastry,
  });
  assert.equal((virgoPrompt.match(/入庙、曜升星座/g) ?? []).length, 2);
});

test('同名水星接纳分别保留双方实际星座与接纳方向', () => {
  const first = { ...chart('甲', 0, 120), planets: [point('Mercury', '水星', 351)] };
  const second = { ...chart('乙', 30, 150), planets: [point('Mercury', '水星', 81)] };
  const result = analyzeAstrolabeSynastry(first, second, { pointNames: ['Mercury'] });
  const receptions = result.receptions?.filter((item) => item.type === '接纳');
  assert.equal(receptions?.length, 1);
  assert.equal(receptions?.[0].sign1, '双鱼座');
  assert.equal(receptions?.[0].sign2, '双子座');
  assert.match(result.receptionSummary ?? '', /甲的水星落双鱼座，乙的水星落双子座/);
  assert.match(result.receptionSummary ?? '', /双子座是水星的入庙星座，因此甲的水星接纳乙的水星/);
  assert.match(result.receptionSummary ?? '', /双方这两颗星伴随刑相/);
});

test('跨盘相位在同名人物与反向星体组合中保持各自位置和角距', () => {
  const first = {
    ...chart('同名', 0, 120),
    planets: [point('Mercury', '水星', 351, 3), point('Chiron', '凯龙星', 137, 8)],
  };
  const second = {
    ...chart('同名', 30, 150),
    planets: [point('Mercury', '水星', 77, 10), point('Chiron', '凯龙星', 171, 1)],
  };
  const synastry = analyzeAstrolabeSynastry(first, second, {
    pointNames: ['Mercury', 'Chiron', 'Ascendant'],
  });
  const prompt = buildAstrolabeSynastryPrompt({ chart1: first, chart2: second, synastry });
  assert.deepEqual(synastry.people, ['同名', '同名']);
  assert.match(
    synastry.aspects.find((item) => item.point1Name === 'Mercury' && item.point2Name === 'Chiron')
      ?.promptText ?? '',
    /第一人同名水星与第二人同名凯龙星/,
  );
  assert.match(
    synastry.houseOverlays.find(
      (item) =>
        item.ownerPerson === 'person1' &&
        item.visitorPerson === 'person2' &&
        item.pointName === 'Mercury',
    )?.promptText ?? '',
    /第二人同名水星.*第一人同名第\d+宫/,
  );
  assert.ok(
    synastry.evidence.items.some(
      (item) => item.title.includes('第一人同名水星') && item.title.includes('第二人同名凯龙星'),
    ),
  );
  assert.match(synastry.receptionSummary ?? '', /第一人同名的水星.*第二人同名的水星/);
  const firstNatal = prompt.slice(
    prompt.indexOf('【第一人本命盘】'),
    prompt.indexOf('【第二人本命盘】'),
  );
  const secondNatal = prompt.slice(
    prompt.indexOf('【第二人本命盘】'),
    prompt.indexOf('【跨盘资料】'),
  );
  assert.match(firstNatal, /水星351°，第3宫/);
  assert.match(firstNatal, /凯龙星137°，第8宫/);
  assert.match(secondNatal, /水星77°，第10宫/);
  assert.match(secondNatal, /凯龙星171°，第1宫/);

  const cross = prompt.slice(prompt.indexOf('【跨盘资料】'));
  assert.match(cross, /第一人同名的水星与第二人同名的凯龙星：冲相，目标角180°，实际夹角180\.00°/);
  assert.match(cross, /第一人同名的凯龙星与第二人同名的水星：六合，目标角60°，实际夹角60\.00°/);
  assert.match(cross, /第二人同名的水星落入第一人同名的本命盘第3宫/);
  assert.match(cross, /第一人同名的水星落入第二人同名的本命盘第12宫/);
  assert.doesNotMatch(cross, /水星（351°|水星（77°|凯龙星（137°|凯龙星（171°/);
  assert.match(cross, /第一人同名的上升（自身本命第1宫）落入第二人同名的本命盘第1宫/);
  const withoutLabel = structuredClone(first);
  withoutLabel.planets[0].label = '原水星';
  const fallbackPrompt = buildAstrolabeSynastryPrompt({
    chart1: withoutLabel,
    chart2: second,
    synastry,
  });
  assert.match(fallbackPrompt, /第一人同名的水星（351°，自身本命第3宫）与第二人同名的凯龙星：冲相/);
});

test('姓名未填或仅空白时，双盘相位、落宫与完整任务书保留两方身份', () => {
  const first = chart('', 359, 120);
  const second = chart('  ', 1, 210);
  const synastry = analyzeAstrolabeSynastry(first, second);
  const prompt = buildAstrolabeSynastryPrompt({ chart1: first, chart2: second, synastry });

  assert.deepEqual(synastry.people, ['第一人', '第二人']);
  assert.equal(first.birth.name, '');
  assert.equal(second.birth.name, '  ');
  assert.match(
    synastry.aspects.find((item) => item.point1 === '太阳' && item.point2 === '太阳')?.promptText ??
      '',
    /第一人太阳与第二人太阳/,
  );
  assert.match(
    synastry.houseOverlays.find(
      (item) =>
        item.ownerPerson === 'person1' &&
        item.visitorPerson === 'person2' &&
        item.pointName === 'Sun',
    )?.promptText ?? '',
    /第二人太阳.*第一人第1宫/,
  );
  assert.match(prompt, /【第一人本命盘】[\s\S]*?出生信息：第一人；/);
  assert.match(prompt, /【第二人本命盘】[\s\S]*?出生信息：第二人；/);
  assert.match(prompt, /第一人的太阳与第二人的太阳：合相/);
  const firstNatal = prompt.slice(
    prompt.indexOf('【第一人本命盘】'),
    prompt.indexOf('【第二人本命盘】'),
  );
  const secondNatal = prompt.slice(
    prompt.indexOf('【第二人本命盘】'),
    prompt.indexOf('【跨盘资料】'),
  );
  assert.match(firstNatal, /太阳359°，第1宫/);
  assert.match(secondNatal, /太阳1°，第1宫/);
  assert.doesNotMatch(prompt, /第一人第一人|第二人第二人|出生信息：；/);
});
