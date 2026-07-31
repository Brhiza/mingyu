import assert from 'node:assert/strict';
import test from 'node:test';

import { HIDDEN_STEMS } from '@core/bazi/baziMappingsData';
import { analyzeTenGodLifeStageProfile } from '@core/bazi/lifeStageAnalysis';
import { analyzeTenGodFlow, analyzeTenGodStructure } from '@core/bazi/tenGodAnalysis';
import { getTenGod } from '@core/bazi/baziUtils';
import type { TenGodPresenceStatus, TenGodStructureProfile } from '@core/types/analysis';

const PILLARS = [
  { gan: '甲', zhi: '子', hiddenStems: [...HIDDEN_STEMS.子] },
  { gan: '丙', zhi: '寅', hiddenStems: [...HIDDEN_STEMS.寅] },
  { gan: '戊', zhi: '午', hiddenStems: [...HIDDEN_STEMS.午] },
  { gan: '庚', zhi: '申', hiddenStems: [...HIDDEN_STEMS.申] },
];

const TEN_GODS = [
  '比肩',
  '劫财',
  '正印',
  '偏印',
  '食神',
  '伤官',
  '正财',
  '偏财',
  '正官',
  '七杀',
] as const;

const FAMILIES = [
  { family: '比劫', representative: '比肩' },
  { family: '印绶', representative: '正印' },
  { family: '食伤', representative: '食神' },
  { family: '财才', representative: '正财' },
  { family: '官杀', representative: '正官' },
] as const;

const RELATIONS = [
  ['印绶', '比劫', '生'],
  ['比劫', '食伤', '生'],
  ['食伤', '财才', '生'],
  ['财才', '官杀', '生'],
  ['官杀', '印绶', '生'],
  ['印绶', '食伤', '克'],
  ['食伤', '官杀', '克'],
  ['官杀', '比劫', '克'],
  ['比劫', '财才', '克'],
  ['财才', '印绶', '克'],
] as const;

function status(count: number): TenGodPresenceStatus {
  return count > 0 ? '透出' : '缺位';
}

function buildFamilySubset(mask: number): TenGodStructureProfile {
  const presentFamilies = new Set(
    FAMILIES.filter((_, index) => (mask & (1 << index)) !== 0).map((item) => item.family),
  );
  const representativeCounts = new Map(
    FAMILIES.map((item) => [item.representative, presentFamilies.has(item.family) ? 1 : 0]),
  );

  return {
    distributions: TEN_GODS.map((tenGod) => {
      const count = representativeCounts.get(tenGod) ?? 0;
      return {
        tenGod,
        visibleCount: count,
        hiddenCount: 0,
        totalCount: count,
        status: status(count),
      };
    }),
    familyDistributions: FAMILIES.map(({ family }) => {
      const count = presentFamilies.has(family) ? 1 : 0;
      return {
        family,
        visibleCount: count,
        hiddenCount: 0,
        totalCount: count,
        status: status(count),
      };
    }),
    summary: '测试用十神家族出现事实',
  };
}

test('十神结构应校验完整四柱、固定藏干、日主与标准十神映射', () => {
  const profile = analyzeTenGodStructure(PILLARS, '戊', getTenGod);

  assert.deepEqual(
    profile.distributions.map((item) => item.tenGod),
    TEN_GODS,
  );
  assert.deepEqual(
    profile.distributions.find((item) => item.tenGod === '比肩'),
    {
      tenGod: '比肩',
      visibleCount: 0,
      hiddenCount: 2,
      totalCount: 2,
      status: '仅藏',
    },
  );
  assert.deepEqual(
    profile.distributions.find((item) => item.tenGod === '食神'),
    {
      tenGod: '食神',
      visibleCount: 1,
      hiddenCount: 1,
      totalCount: 2,
      status: '透藏并见',
    },
  );

  assert.throws(() => analyzeTenGodStructure(PILLARS.slice(0, 3), '戊', getTenGod), /四柱数量无效/);
  assert.throws(() => analyzeTenGodStructure(PILLARS, '甲', getTenGod), /日主与日柱天干不一致/);
  assert.throws(
    () =>
      analyzeTenGodStructure(
        PILLARS.map((pillar, index) => (index === 0 ? { ...pillar, gan: '乙' } : { ...pillar })),
        '戊',
        getTenGod,
      ),
    /不是有效六十甲子/,
  );
  assert.throws(
    () =>
      analyzeTenGodStructure(
        PILLARS.map((pillar, index) =>
          index === 1 ? { ...pillar, hiddenStems: ['甲'] } : { ...pillar },
        ),
        '戊',
        getTenGod,
      ),
    /藏干与地支寅不一致/,
  );
  assert.throws(
    () => analyzeTenGodStructure(PILLARS, '戊', () => '正财'),
    /十神函数与项目标准映射不一致/,
  );
});

test('十神五大家族的32种出现子集应完整登记固定生克关系', () => {
  for (let mask = 0; mask < 1 << FAMILIES.length; mask += 1) {
    const structure = buildFamilySubset(mask);
    const present = new Set(
      structure.familyDistributions
        .filter((item) => item.totalCount > 0)
        .map((item) => item.family),
    );
    const expected = RELATIONS.filter(
      ([sourceFamily, targetFamily]) => present.has(sourceFamily) && present.has(targetFamily),
    );
    const profile = analyzeTenGodFlow(structure);

    assert.deepEqual(
      profile.items.map((item) => [item.sourceFamily, item.targetFamily, item.relation]),
      expected,
      `子集掩码 ${mask}`,
    );
    assert.ok(
      profile.items.every(
        (item) =>
          item.sourceCount === 1 &&
          item.targetCount === 1 &&
          !/财富|地位|权力|才华|技能|人脉|依赖|压力|担财/.test(item.description),
      ),
      `子集掩码 ${mask}`,
    );
  }

  assert.equal(analyzeTenGodFlow(buildFamilySubset(31)).items.length, 10);
  const inconsistent = buildFamilySubset(31);
  inconsistent.familyDistributions[0] = {
    ...inconsistent.familyDistributions[0],
    totalCount: 2,
  };
  assert.throws(() => analyzeTenGodFlow(inconsistent), /总次数与透干、藏干次数不一致/);
});

test('十神十二长生应按实际天干去重并逐干列出四支事实', () => {
  const profile = analyzeTenGodLifeStageProfile(PILLARS, '戊', getTenGod);
  const stems = profile.items.map((item) => item.stem);

  assert.equal(new Set(stems).size, stems.length);
  assert.deepEqual(stems, ['甲', '癸', '丙', '戊', '丁', '己', '庚', '壬']);
  assert.ok(profile.items.every((item) => item.stages.length === 4));
  assert.ok(profile.items.every((item) => !('strongCount' in item) && !('lowCount' in item)));
  assert.deepEqual(profile.items.find((item) => item.stem === '甲')?.sourcePositions, [
    { pillar: 'year', source: '透干' },
    { pillar: 'month', source: '藏干' },
  ]);
  assert.deepEqual(profile.items.find((item) => item.stem === '戊')?.sourcePositions, [
    { pillar: 'month', source: '藏干' },
    { pillar: 'hour', source: '藏干' },
  ]);
  assert.equal(profile.items.find((item) => item.stem === '戊')?.tenGod, '比肩');
  assert.match(profile.items[0].limitation, /不设置权重/);
});
