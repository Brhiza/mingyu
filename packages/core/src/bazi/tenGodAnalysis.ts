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

export function analyzeTenGodStructure(
  pillars: Array<{ gan: string; zhi: string; hiddenStems: string[] }>,
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
): TenGodStructureProfile {
  if (pillars.length !== 4) {
    throw new Error(`四柱数量无效：${pillars.length}`);
  }
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

  pillars.forEach((p, index) => {
    const tg = getTenGod(p.gan, dayMaster);
    // 日干是十神的参照点，不能再计作一处透出的比肩；日支藏干仍照常统计。
    if (index !== 2 && tg && tg !== '未知' && tg !== '日主') {
      const item = ensure(tg);
      item.visibleCount += 1;
      item.totalCount += 1;
    }
    (p.hiddenStems || []).forEach((stem) => {
      const ht = getTenGod(stem, dayMaster);
      if (!ht || ht === '未知' || ht === '日主') return;
      const item = ensure(ht);
      item.hiddenCount += 1;
      item.totalCount += 1;
    });
  });

  distributionMap.forEach((item) => {
    item.status = resolvePresenceStatus(item);
  });

  const distributions = [...distributionMap.values()].sort((a, b) => {
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    if (b.visibleCount !== a.visibleCount) return b.visibleCount - a.visibleCount;
    if (b.hiddenCount !== a.hiddenCount) return b.hiddenCount - a.hiddenCount;
    return a.tenGod.localeCompare(b.tenGod, 'zh-Hans-CN');
  });

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
 * 十神流动关系：识别十神家族之间构成的标准生克链条
 * - 比劫泄秀：比劫→食伤
 * - 食伤生财：食伤→财才
 * - 财生官杀：财才→官杀
 * - 官杀生印：官杀→印绶
 * - 印比相生：印绶→比劫
 */
export function analyzeTenGodFlow(structure: TenGodStructureProfile): TenGodFlowProfile {
  const familyMap = new Map(structure.familyDistributions.map((item) => [item.family, item]));
  const has = (family: string) => (familyMap.get(family)?.totalCount ?? 0) > 0;

  const flows: TenGodFlowItem[] = [];
  if (has('比劫') && has('食伤')) {
    flows.push({
      name: '比劫泄秀',
      description: '比劫与食伤同见，具备比劫生食伤的结构线索',
      caution: '须核对透藏、根气、位置及印星制食伤，才能判断是否形成有效作用',
    });
  }
  if (has('食伤') && has('财才')) {
    flows.push({
      name: '食伤生财',
      description: '食伤与财星同见，具备食伤生财的结构线索',
      caution: '须核对透藏、根气、位置及印星制食伤，并辨日主能否担财',
    });
  }
  if (has('财才') && has('官杀')) {
    flows.push({
      name: '财生官杀',
      description: '财星与官杀同见，具备财生官杀的结构线索',
      caution: '须核对透藏、根气、位置及官杀是否有效承接',
    });
  }
  if (has('印绶') && has('比劫')) {
    flows.push({
      name: '印比相生',
      description: '印星与比劫同见，具备印生比劫的结构线索',
      caution: '须核对透藏、根气、位置及财星克印，才能判断是否形成有效作用',
    });
  }
  if (has('官杀') && has('印绶')) {
    flows.push({
      name: '官杀生印',
      description: '官杀与印绶同见，具备官印或杀印相生的结构线索',
      caution: '核对官杀与印星的透藏、根气、位置及财星克印，印能承接生身才论通关',
    });
  }

  return {
    items: flows,
    summary: flows.length ? '十神家族同见的相生候选' : '未见十神家族同见的相生候选',
  };
}
