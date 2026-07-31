/**
 * @file 十神结构与流动关系分析
 * @description 分别统计四柱天干透出与地支藏干的十神分布，按五大家族聚合，
 *   并识别十神之间的生克流动链条；不以自定权重裁定十神强弱。
 * @古籍依据 《渊海子平》"论十神"、《子平真诠》"论用神成败"
 */
import type {
  TenGodDistributionItem,
  TenGodFamilyDistribution,
  TenGodPresenceStatus,
  TenGodStructureProfile,
  TenGodFlowItem,
  TenGodFlowProfile,
} from '../types/analysis';
import { getTenGod as getStandardTenGod } from './baziUtils';
import { assertTenGodFactInputs } from './tenGodFactValidation';

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

const TEN_GOD_TO_FAMILY: Record<string, string> = {
  比肩: '比劫',
  劫财: '比劫',
  正印: '印绶',
  偏印: '印绶',
  食神: '食伤',
  伤官: '食伤',
  正财: '财才',
  偏财: '财才',
  正官: '官杀',
  七杀: '官杀',
};

const TEN_GOD_FAMILY_ORDER = ['比劫', '印绶', '食伤', '财才', '官杀'];

/** 只按是否透干、是否藏支形成可直接复核的出现状态。 */
function resolvePresenceStatus(item: {
  visibleCount: number;
  hiddenCount: number;
}): TenGodPresenceStatus {
  if (item.visibleCount === 0 && item.hiddenCount === 0) return '缺位';
  if (item.visibleCount === 0) return '仅藏';
  if (item.hiddenCount === 0) return '透出';
  return '透藏并见';
}

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}必须是非负整数：${value}`);
  }
}

function assertTenGodStructureProfile(structure: TenGodStructureProfile): void {
  if (!structure || !Array.isArray(structure.distributions)) {
    throw new Error('十神分布缺失');
  }
  if (!Array.isArray(structure.familyDistributions)) {
    throw new Error('十神家族分布缺失');
  }

  const distributionMap = new Map<string, TenGodDistributionItem>();
  structure.distributions.forEach((item) => {
    if (!(TEN_GODS as readonly string[]).includes(item.tenGod)) {
      throw new Error(`十神分布名称无效：${item.tenGod}`);
    }
    if (distributionMap.has(item.tenGod)) {
      throw new Error(`十神分布重复：${item.tenGod}`);
    }
    assertCount(item.visibleCount, `${item.tenGod}透干次数`);
    assertCount(item.hiddenCount, `${item.tenGod}藏干次数`);
    assertCount(item.totalCount, `${item.tenGod}总次数`);
    if (item.totalCount !== item.visibleCount + item.hiddenCount) {
      throw new Error(`${item.tenGod}总次数与透干、藏干次数不一致`);
    }
    if (item.status !== resolvePresenceStatus(item)) {
      throw new Error(`${item.tenGod}出现状态与次数不一致`);
    }
    distributionMap.set(item.tenGod, item);
  });
  for (const tenGod of TEN_GODS) {
    if (!distributionMap.has(tenGod)) {
      throw new Error(`十神分布缺少：${tenGod}`);
    }
  }

  const familyMap = new Map<string, TenGodFamilyDistribution>();
  structure.familyDistributions.forEach((item) => {
    if (!TEN_GOD_FAMILY_ORDER.includes(item.family)) {
      throw new Error(`十神家族名称无效：${item.family}`);
    }
    if (familyMap.has(item.family)) {
      throw new Error(`十神家族分布重复：${item.family}`);
    }
    assertCount(item.visibleCount, `${item.family}透干次数`);
    assertCount(item.hiddenCount, `${item.family}藏干次数`);
    assertCount(item.totalCount, `${item.family}总次数`);
    if (item.totalCount !== item.visibleCount + item.hiddenCount) {
      throw new Error(`${item.family}总次数与透干、藏干次数不一致`);
    }
    if (item.status !== resolvePresenceStatus(item)) {
      throw new Error(`${item.family}出现状态与次数不一致`);
    }
    familyMap.set(item.family, item);
  });

  for (const family of TEN_GOD_FAMILY_ORDER) {
    const actual = familyMap.get(family);
    if (!actual) {
      throw new Error(`十神家族分布缺少：${family}`);
    }
    const familyItems = TEN_GODS.map((tenGod) => distributionMap.get(tenGod)!).filter(
      (item) => TEN_GOD_TO_FAMILY[item.tenGod] === family,
    );
    const expectedVisible = familyItems.reduce((sum, item) => sum + item.visibleCount, 0);
    const expectedHidden = familyItems.reduce((sum, item) => sum + item.hiddenCount, 0);
    if (
      actual.visibleCount !== expectedVisible ||
      actual.hiddenCount !== expectedHidden ||
      actual.totalCount !== expectedVisible + expectedHidden
    ) {
      throw new Error(`${family}家族次数与十神分布不一致`);
    }
  }
}

export function analyzeTenGodStructure(
  pillars: Array<{ gan: string; zhi: string; hiddenStems: string[] }>,
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
): TenGodStructureProfile {
  assertTenGodFactInputs(pillars, dayMaster, getTenGod);
  const distributionMap = new Map<string, TenGodDistributionItem>();

  const ensure = (tenGod: string): TenGodDistributionItem => {
    let item = distributionMap.get(tenGod);
    if (!item) {
      item = {
        tenGod,
        visibleCount: 0,
        hiddenCount: 0,
        totalCount: 0,
        status: '缺位',
      };
      distributionMap.set(tenGod, item);
    }
    return item;
  };

  TEN_GODS.forEach((t) => ensure(t));

  pillars.forEach((p, pillarIndex) => {
    if (pillarIndex !== 2) {
      const tg = getStandardTenGod(p.gan, dayMaster);
      const item = ensure(tg);
      item.visibleCount += 1;
      item.totalCount += 1;
    }
    p.hiddenStems.forEach((stem) => {
      const ht = getStandardTenGod(stem, dayMaster);
      const item = ensure(ht);
      item.hiddenCount += 1;
      item.totalCount += 1;
    });
  });

  distributionMap.forEach((item) => {
    item.status = resolvePresenceStatus(item);
  });

  const distributions = TEN_GODS.map((tenGod) => distributionMap.get(tenGod)!);

  // Family aggregation
  const familyMap = new Map<
    string,
    { totalCount: number; visibleCount: number; hiddenCount: number }
  >();
  TEN_GOD_FAMILY_ORDER.forEach((f) =>
    familyMap.set(f, { totalCount: 0, visibleCount: 0, hiddenCount: 0 }),
  );
  distributions.forEach((d) => {
    const f = TEN_GOD_TO_FAMILY[d.tenGod];
    if (!f) return;
    const fam = familyMap.get(f);
    if (!fam) return;
    fam.totalCount += d.totalCount;
    fam.visibleCount += d.visibleCount;
    fam.hiddenCount += d.hiddenCount;
  });
  const familyDistributions: TenGodFamilyDistribution[] = TEN_GOD_FAMILY_ORDER.map((family) => {
    const value = familyMap.get(family)!;
    return {
      family,
      visibleCount: value.visibleCount,
      hiddenCount: value.hiddenCount,
      totalCount: value.totalCount,
      status: resolvePresenceStatus(value),
    };
  });

  return {
    distributions,
    familyDistributions,
    summary: '十神透干与藏支分布',
  };
}

/**
 * 十神家族生克事实：仅在两个家族同时出现时登记其固定五行生克关系。
 * 共覆盖五条相生关系与五条相克关系，不据此裁定实际流通、强弱或吉凶。
 */
export function analyzeTenGodFlow(structure: TenGodStructureProfile): TenGodFlowProfile {
  assertTenGodStructureProfile(structure);
  const familyMap = new Map(structure.familyDistributions.map((item) => [item.family, item]));
  const has = (family: string) => (familyMap.get(family)?.totalCount ?? 0) > 0;

  const relations: Array<{
    sourceFamily: string;
    targetFamily: string;
    relation: '生' | '克';
  }> = [
    { sourceFamily: '印绶', targetFamily: '比劫', relation: '生' },
    { sourceFamily: '比劫', targetFamily: '食伤', relation: '生' },
    { sourceFamily: '食伤', targetFamily: '财才', relation: '生' },
    { sourceFamily: '财才', targetFamily: '官杀', relation: '生' },
    { sourceFamily: '官杀', targetFamily: '印绶', relation: '生' },
    { sourceFamily: '印绶', targetFamily: '食伤', relation: '克' },
    { sourceFamily: '食伤', targetFamily: '官杀', relation: '克' },
    { sourceFamily: '官杀', targetFamily: '比劫', relation: '克' },
    { sourceFamily: '比劫', targetFamily: '财才', relation: '克' },
    { sourceFamily: '财才', targetFamily: '印绶', relation: '克' },
  ];

  const flows: TenGodFlowItem[] = relations
    .filter(({ sourceFamily, targetFamily }) => has(sourceFamily) && has(targetFamily))
    .map(({ sourceFamily, targetFamily, relation }) => ({
      name: `${sourceFamily}${relation}${targetFamily}`,
      sourceFamily,
      targetFamily,
      relation,
      sourceCount: familyMap.get(sourceFamily)!.totalCount,
      targetCount: familyMap.get(targetFamily)!.totalCount,
      description: `${sourceFamily}与${targetFamily}同时出现，按十神五类的固定五行关系登记为${sourceFamily}${relation}${targetFamily}`,
      sources: ['五行生克与十神五类定义的固定映射'],
      limitation:
        '这里只证明两个十神家族同时出现及其固定生克方向，不证明实际发生流通，也不据此判断强弱、喜忌、吉凶或现实事件',
    }));

  return {
    items: flows,
    summary: flows.length
      ? `十神家族固定生克关系：共登记${flows.length}项`
      : '未见两个同时出现的十神家族，未登记生克关系',
  };
}
