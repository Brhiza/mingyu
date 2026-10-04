import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeTenGodLifeStageProfile } from '../packages/core/src/bazi/lifeStageAnalysis';
import { getTenGod } from '../packages/core/src/bazi/baziUtils';

const pillars = [
  { gan: '甲', zhi: '子', hiddenStems: ['癸'] },
  { gan: '丙', zhi: '寅', hiddenStems: ['甲', '丙', '戊'] },
  { gan: '甲', zhi: '午', hiddenStems: ['丁', '己'] },
  { gan: '壬', zhi: '申', hiddenStems: ['庚', '壬', '戊'] },
];

test('十神十二长生保留非日柱比肩并追溯去重分值来源', () => {
  const profile = analyzeTenGodLifeStageProfile(pillars, '甲', getTenGod);
  const biJian = profile.items.find((item) => item.tenGod === '比肩');

  assert.ok(biJian);
  assert.equal(biJian.stem, '甲');
  assert.equal(biJian.strongCount, 1);
  assert.equal(biJian.lowCount, 2);
  assert.deepEqual(biJian.evidence, [
    {
      stem: '甲',
      occurrences: 2,
      positions: ['年柱透干', '月柱藏干第1位'],
      branchStages: [
        { pillar: '年柱', branch: '子', stage: '沐浴', strongScore: 0, lowScore: 0 },
        { pillar: '月柱', branch: '寅', stage: '临官', strongScore: 1, lowScore: 0 },
        { pillar: '日柱', branch: '午', stage: '死', strongScore: 0, lowScore: 1 },
        { pillar: '时柱', branch: '申', stage: '绝', strongScore: 0, lowScore: 1 },
      ],
    },
  ]);
});

test('同一天干再次出现只增加来源次数，不重复叠加四支长生分值', () => {
  const withHiddenBiJian = analyzeTenGodLifeStageProfile(pillars, '甲', getTenGod).items.find(
    (item) => item.tenGod === '比肩',
  );
  const withoutHiddenBiJian = analyzeTenGodLifeStageProfile(
    pillars.map((pillar, index) =>
      index === 1 ? { ...pillar, hiddenStems: ['丙', '戊'] } : pillar,
    ),
    '甲',
    getTenGod,
  ).items.find((item) => item.tenGod === '比肩');

  assert.ok(withHiddenBiJian);
  assert.ok(withoutHiddenBiJian);
  assert.equal(withHiddenBiJian.strongCount, withoutHiddenBiJian.strongCount);
  assert.equal(withHiddenBiJian.lowCount, withoutHiddenBiJian.lowCount);
  assert.equal(withHiddenBiJian.evidence[0].occurrences, 2);
  assert.equal(withoutHiddenBiJian.evidence[0].occurrences, 1);
});

test('自定义十神合并不同天干时保留各自证据并汇总半分', () => {
  const customPillars = pillars.map((pillar, index) =>
    index === 3 ? { ...pillar, gan: '乙' } : pillar,
  );
  const profile = analyzeTenGodLifeStageProfile(customPillars, '甲', (stem, dayMaster) =>
    stem === '甲' || stem === '乙' ? '自定义同类' : getTenGod(stem, dayMaster),
  );
  const combined = profile.items.find((item) => item.tenGod === '自定义同类');

  assert.ok(combined);
  assert.equal(combined.stem, '甲、乙');
  assert.equal(combined.strongCount, 2.5);
  assert.equal(combined.lowCount, 2.5);
  assert.deepEqual(
    combined.evidence.map(({ stem, occurrences, positions }) => ({
      stem,
      occurrences,
      positions,
    })),
    [
      { stem: '甲', occurrences: 2, positions: ['年柱透干', '月柱藏干第1位'] },
      { stem: '乙', occurrences: 1, positions: ['时柱透干'] },
    ],
  );
  assert.deepEqual(
    combined.evidence[1].branchStages.map(({ stage, strongScore, lowScore }) => ({
      stage,
      strongScore,
      lowScore,
    })),
    [
      { stage: '病', strongScore: 0, lowScore: 0.5 },
      { stage: '帝旺', strongScore: 1, lowScore: 0 },
      { stage: '长生', strongScore: 0.5, lowScore: 0 },
      { stage: '胎', strongScore: 0, lowScore: 0 },
    ],
  );
});

test('十神长生分析要求完整四柱，避免把缺失柱位写成其他阶段', () => {
  assert.throws(
    () => analyzeTenGodLifeStageProfile(pillars.slice(0, 3), '甲', getTenGod),
    /四柱数量无效：3/,
  );
});
