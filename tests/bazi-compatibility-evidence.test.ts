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

test('八字双盘证据应计算日主、日支和四柱交叉关系', () => {
  const { chart1, chart2 } = createPair();
  const result = analyzeBaziCompatibility(chart1, chart2, {
    person1Name: '甲方',
    person2Name: '乙方',
  });

  assert.equal(result.dayMasterRelation.person1ToPerson2, '克对方');
  assert.equal(result.dayMasterRelation.person2ToPerson1, '受对方克');
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
});

test('八字双盘证据应双向映射十神和喜忌覆盖', () => {
  const { chart1, chart2 } = createPair();
  const result = analyzeBaziCompatibility(chart1, chart2);

  assert.equal(result.tenGodMappings.length, 8);
  assert.ok(
    result.tenGodMappings.some(
      (item) => item.observer === 'person1' && item.pillar === 'day' && item.stem === '辛',
    ),
  );
  assert.deepEqual(result.usefulGodCoverage[0].favorable, [{ wuxing: '木' }, { wuxing: '火' }]);
  assert.deepEqual(result.usefulGodCoverage[1].unfavorable, [{ wuxing: '火' }]);
});

test('八字双盘提示词应区分事实和限制且不输出匹配总分', () => {
  const { chart1, chart2 } = createPair();
  const result = analyzeBaziCompatibility(chart1, chart2);

  assert.match(result.promptText, /【八字双盘结构化证据】/);
  assert.match(result.promptText, /【主证】/);
  assert.match(result.promptText, /【反证】/);
  assert.match(result.promptText, /【限制】/);
  assert.match(result.promptText, /不输出匹配总分/);
  assert.doesNotMatch(result.promptText, /匹配(?:分数|率|百分比)|合化成功/);
});

test('八字双盘证据应拒绝无效四柱', () => {
  const { chart1, chart2 } = createPair();
  chart2.pillars.day.gan = 'A';
  assert.throws(() => analyzeBaziCompatibility(chart1, chart2), /day柱天干无效/);
});
