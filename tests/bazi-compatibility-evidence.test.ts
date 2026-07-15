import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { analyzeBaziCompatibility } from '../packages/core/src/bazi/compatibilityEvidence';
import type { BaziChartResult, Pillars } from '../packages/core/src/bazi/baziTypes';

function createChart(): BaziChartResult {
  return baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
}

function withPillars(
  pillars: Pillars,
  dayMaster: { gan: string; element: string; yinYang: string },
  useful: { favorableWuxing: string[]; unfavorableWuxing: string[] },
  composition: Record<string, number>,
) {
  const chart = structuredClone(createChart());
  chart.pillars = pillars;
  chart.dayMaster = dayMaster;
  chart.analysis.usefulGod.favorableWuxing = useful.favorableWuxing;
  chart.analysis.usefulGod.unfavorableWuxing = useful.unfavorableWuxing;
  chart.wuxingStrength.present = Object.entries(composition)
    .filter(([, value]) => value > 0)
    .map(([wuxing]) => wuxing);
  return chart;
}

function createPair() {
  const chart1 = withPillars(
    {
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    },
    { gan: '丙', element: '火', yinYang: '阳' },
    { favorableWuxing: ['木', '火'], unfavorableWuxing: ['水'] },
    { 木: 30, 火: 25, 土: 20, 金: 10, 水: 15 },
  );
  const chart2 = withPillars(
    {
      year: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      month: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
      day: { gan: '辛', zhi: '亥', ganZhi: '辛亥' },
      hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
    },
    { gan: '辛', element: '金', yinYang: '阴' },
    { favorableWuxing: ['水', '木'], unfavorableWuxing: ['火'] },
    { 木: 18, 火: 12, 土: 25, 金: 20, 水: 25 },
  );
  return { chart1, chart2 };
}

function assertEvidenceReferences(result: ReturnType<typeof analyzeBaziCompatibility>) {
  const factKeys = new Set([
    result.dayMasterRelation.key,
    result.summaryFact.key,
    ...result.calculationSteps.map((item) => item.key),
    ...result.crossPillarRelations.map((item) => item.key),
    ...result.crossBranchCombinations.map((item) => item.key),
    ...result.tenGodMappings.map((item) => item.key),
    ...result.usefulGodCoverage.flatMap((item) => [
      item.key,
      ...item.favorable.map((entry) => entry.key),
      ...item.unfavorable.map((entry) => entry.key),
    ]),
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

test('八字双盘证据应计算日主、日支和四柱交叉关系', () => {
  const { chart1, chart2 } = createPair();
  const result = analyzeBaziCompatibility(chart1, chart2, {
    person1Name: '甲方',
    person2Name: '乙方',
  });

  assert.equal(result.dayMasterRelation.person1ToPerson2, '克对方');
  assert.equal(result.dayMasterRelation.person2ToPerson1, '受对方克');
  assert.equal(result.key, 'bazi:compatibility:evidence');
  assert.equal(result.status, '已计算');
  assert.equal(result.dayMasterRelation.key, 'bazi:compatibility:day-master-relation');
  assert.equal(result.calculationSteps.length, 7);
  assert.ok(
    result.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) =>
        result.calculationSteps.some((candidate) => candidate.key === key),
      ),
    ),
  );
  assert.ok(result.spousePalaceRelations.some((item) => item.type === '六合'));
  assert.ok(
    result.crossPillarRelations.some(
      (item) =>
        item.type === '五合候选' &&
        item.person1Pillar === 'day' &&
        item.person2Pillar === 'day' &&
        item.transformWuxing === '水',
    ),
  );
  assert.ok(
    result.crossPillarRelations.every(
      (item) =>
        item.key &&
        item.status === '已命中' &&
        item.sourceLayerKey &&
        item.targetLayerKey &&
        result.calculationSteps.some((step) => step.key === item.calculationStepKey),
    ),
  );
  assert.equal(result.summaryFact.crossPillarRelationCount, result.crossPillarRelations.length);
  assert.equal(result.summaryFact.spousePalaceRelationCount, result.spousePalaceRelations.length);
  assertEvidenceReferences(result);
});

test('八字双盘证据应记录跨盘三会来源但不声称成化', () => {
  const { chart1, chart2 } = createPair();
  const result = analyzeBaziCompatibility(chart1, chart2);
  const combination = result.crossBranchCombinations.find((item) => item.name === '东方木');

  assert.ok(combination);
  assert.deepEqual(
    combination.members.map((item) => item.branch),
    ['寅', '卯', '辰'],
  );
  assert.match(combination.note, /不直接判定成局或成化/);
  assert.equal(combination.status, '组合齐备');
  assert.ok(combination.key.startsWith('bazi:compatibility:branch-combination:'));
  assert.ok(combination.sourceLayerKeys.length >= 3);
});

test('八字双盘证据应双向映射十神和喜忌覆盖', () => {
  const { chart1, chart2 } = createPair();
  const result = analyzeBaziCompatibility(chart1, chart2);

  assert.equal(result.tenGodMappings.length, 8);
  assert.ok(
    result.tenGodMappings.every(
      (item) => item.key && item.status === '已计算' && item.sourceLayerKey,
    ),
  );
  assert.ok(
    result.tenGodMappings.some(
      (item) => item.observer === 'person1' && item.pillar === 'day' && item.stem === '辛',
    ),
  );
  assert.deepEqual(
    result.usefulGodCoverage[0].favorable.map((item) => item.wuxing),
    ['木', '火'],
  );
  assert.equal(result.usefulGodCoverage[0].status, '已计算');
  assert.ok(
    result.usefulGodCoverage
      .flatMap((item) => [...item.favorable, ...item.unfavorable])
      .every((item) => item.key && item.status === '已命中' && item.sourceLayerKeys.length),
  );
  assert.deepEqual(
    result.usefulGodCoverage[1].unfavorable.map((item) => item.wuxing),
    ['火'],
  );
  assert.ok(
    result.usefulGodCoverage[0].favorable.every(
      (item) => item.sources.length > 0 && item.sources.every((source) => source.pillar),
    ),
  );
  assert.match(result.promptText, /喜用五行.*木（.*柱(?:天干|地支|藏干).*）/s);
});

test('八字双盘提示词应区分事实和限制且不输出匹配总分', () => {
  const { chart1, chart2 } = createPair();
  const result = analyzeBaziCompatibility(chart1, chart2);

  assert.match(result.promptText, /【八字双盘结构化证据】/);
  assert.match(result.promptText, /【主证】/);
  assert.match(result.promptText, /【反证】/);
  assert.match(result.promptText, /【限制】/);
  assert.match(result.promptText, /不输出匹配总分/);
  assert.match(result.promptText, /计算链概览/);
  assert.match(result.promptText, /证据汇总/);
  assert.ok(result.counterEvidenceFacts.length >= 4);
  assert.ok(result.limitationFacts.some((item) => item.type === '合化边界'));
  assert.ok(result.promptText.length < 10000);
  assert.doesNotMatch(result.promptText, /bazi:compatibility:|本模块|本引擎|内部配置/);
  assert.doesNotMatch(result.promptText, /匹配(?:分数|率|百分比)|合化成功/);
});

test('八字双盘喜忌资料缺失时应保留缺口而不生成互补结论', () => {
  const { chart1, chart2 } = createPair();
  chart1.analysis.usefulGod.favorableWuxing = [];
  chart1.analysis.usefulGod.unfavorableWuxing = [];

  const result = analyzeBaziCompatibility(chart1, chart2);

  assert.equal(result.status, '存在资料缺口');
  assert.equal(result.summaryFact.status, '存在资料缺口');
  assert.equal(result.summaryFact.unavailableCoverageCount, 1);
  assert.ok(result.usefulGodCoverage.some((item) => item.status === '资料不足'));
  assert.ok(
    result.counterEvidenceFacts.some(
      (item) => item.type === '喜用资料覆盖' && item.status === '资料不足',
    ),
  );
  assertEvidenceReferences(result);
  assert.match(result.promptText, /缺少受益方结构化喜忌资料，不生成互补结论/);
});

test('八字双盘未命中关系或喜忌覆盖时仍应保留可追溯引用', () => {
  const { chart1, chart2 } = createPair();
  const person1Pillar = { gan: '甲', zhi: '子', ganZhi: '甲子' };
  const person2Pillar = { gan: '戊', zhi: '辰', ganZhi: '戊辰' };
  chart1.pillars = {
    year: { ...person1Pillar },
    month: { ...person1Pillar },
    day: { ...person1Pillar },
    hour: { ...person1Pillar },
  };
  chart2.pillars = {
    year: { ...person2Pillar },
    month: { ...person2Pillar },
    day: { ...person2Pillar },
    hour: { ...person2Pillar },
  };
  chart1.dayMaster = { gan: '甲', element: '木', yinYang: '阳' };
  chart2.dayMaster = { gan: '戊', element: '土', yinYang: '阳' };
  chart1.analysis.usefulGod.favorableWuxing = [];
  chart1.analysis.usefulGod.unfavorableWuxing = [];
  chart2.analysis.usefulGod.favorableWuxing = [];
  chart2.analysis.usefulGod.unfavorableWuxing = [];

  const result = analyzeBaziCompatibility(chart1, chart2);

  assert.equal(result.spousePalaceRelations.length, 0);
  assert.equal(result.crossBranchCombinations.length, 0);
  assert.ok(result.counterEvidenceFacts.some((item) => item.status === '未命中'));
  assertEvidenceReferences(result);
});

test('八字双盘证据应拒绝无效四柱', () => {
  const { chart1, chart2 } = createPair();
  chart2.pillars.day.gan = 'A';
  assert.throws(() => analyzeBaziCompatibility(chart1, chart2), /day柱天干无效/);
});
