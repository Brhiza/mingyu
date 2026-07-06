/**
 * @file 十神结构与流动关系分析
 * @description 统计四柱天干与地支藏干的十神分布，按五大家族聚合，
 *   并识别十神之间的生克流动链条。
 * @古籍依据 《渊海子平》"论十神"、《子平真诠》"论用神成败"
 *
 * 评分口径（沿用 vibebazi/tyme4ts 量化方案）：
 *   - 透干（天干）每见 +1 分
 *   - 藏干本气 +0.8，中气 +0.5，余气 +0.3
 *   - 状态：缺位 / 潜藏 / 有力 / 偏重
 */
import type {
  TenGodDistributionItem,
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

function getHiddenTenGodScore(index: number): number {
  if (index === 0) return 0.8; // 本气
  if (index === 1) return 0.5; // 中气
  return 0.3; // 余气
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 单个十神分布状态 */
function resolveTenGodStatus(item: {
  totalCount: number;
  score: number;
  visibleCount: number;
}): TenGodDistributionItem['status'] {
  if (item.totalCount === 0) return '缺位';
  if (item.score >= 2 || item.totalCount >= 3) return '偏重';
  if (item.visibleCount > 0 || item.score >= 1) return '有力';
  return '潜藏';
}

/** 十神家族（如比劫、印绶等）状态 */
function resolveFamilyStatus(item: {
  totalCount: number;
  score: number;
  visibleCount: number;
}): '偏重' | '有力' | '偏弱' | '缺位' {
  if (item.totalCount === 0) return '缺位';
  if (item.score >= 3 || item.totalCount >= 5) return '偏重';
  if (item.visibleCount > 0 || item.score >= 1.6) return '有力';
  return '偏弱';
}

export function analyzeTenGodStructure(
  pillars: Array<{ gan: string; zhi: string; hiddenStems: string[] }>,
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
): TenGodStructureProfile {
  const distributionMap = new Map<string, TenGodDistributionItem>();

  const ensure = (tenGod: string): TenGodDistributionItem => {
    let item = distributionMap.get(tenGod);
    if (!item) {
      item = {
        tenGod,
        visibleCount: 0,
        hiddenCount: 0,
        totalCount: 0,
        score: 0,
        status: '缺位',
      };
      distributionMap.set(tenGod, item);
    }
    return item;
  };

  TEN_GODS.forEach((t) => ensure(t));

  pillars.forEach((p) => {
    const tg = getTenGod(p.gan, dayMaster);
    if (tg && tg !== '未知' && tg !== '日主') {
      const item = ensure(tg);
      item.visibleCount += 1;
      item.totalCount += 1;
      item.score += 1; // 透干每见 +1
    }
    (p.hiddenStems || []).forEach((stem, index) => {
      const ht = getTenGod(stem, dayMaster);
      if (!ht || ht === '未知') return;
      const item = ensure(ht);
      item.hiddenCount += 1;
      item.totalCount += 1;
      item.score += getHiddenTenGodScore(index);
    });
  });

  distributionMap.forEach((item) => {
    item.score = roundScore(item.score);
    item.status = resolveTenGodStatus(item);
  });

  const distributions = [...distributionMap.values()].sort((a, b) => {
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    if (b.score !== a.score) return b.score - a.score;
    return a.tenGod.localeCompare(b.tenGod, 'zh-Hans-CN');
  });

  // Family aggregation
  const familyMap = new Map<string, { totalCount: number; score: number; visibleCount: number }>();
  TEN_GOD_FAMILY_ORDER.forEach((f) =>
    familyMap.set(f, { totalCount: 0, score: 0, visibleCount: 0 }),
  );
  distributions.forEach((d) => {
    const f = TEN_GOD_TO_FAMILY[d.tenGod];
    if (!f) return;
    const fam = familyMap.get(f);
    if (!fam) return;
    fam.totalCount += d.totalCount;
    fam.score += d.score;
    fam.visibleCount += d.visibleCount;
  });
  const familyDistributions = TEN_GOD_FAMILY_ORDER.map((family) => {
    const v = familyMap.get(family)!;
    return {
      family,
      totalCount: v.totalCount,
      score: roundScore(v.score),
      status: resolveFamilyStatus(v),
    };
  });

  return {
    distributions,
    familyDistributions,
    summary: '十神分布分析',
  };
}

/**
 * 十神流动关系：识别十神家族之间构成的标准生克链条
 * - 比劫泄秀：比劫→食伤
 * - 食伤生财：食伤→财才
 * - 财生官杀：财才→官杀
 * - 印比相生：印绶→比劫
 */
export function analyzeTenGodFlow(structure: TenGodStructureProfile): TenGodFlowProfile {
  const familyMap = new Map(structure.familyDistributions.map((item) => [item.family, item]));
  const has = (family: string) => (familyMap.get(family)?.totalCount ?? 0) > 0;

  const flows: TenGodFlowItem[] = [];
  if (has('比劫') && has('食伤')) {
    flows.push({
      name: '比劫泄秀',
      description: '比劫同党与食伤承接，可能靠技能、表达输出',
      caution: '食伤为用则吉，食伤为忌则泄身太过',
    });
  }
  if (has('食伤') && has('财才')) {
    flows.push({
      name: '食伤生财',
      description: '才华、技能可转化为财富',
      caution: '需日主能担财',
    });
  }
  if (has('财才') && has('官杀')) {
    flows.push({
      name: '财生官杀',
      description: '财富可带来地位、权力',
      caution: '官杀为用则贵，官杀为忌则压力',
    });
  }
  if (has('印绶') && has('比劫')) {
    flows.push({
      name: '印比相生',
      description: '人脉、资源相互支撑',
      caution: '印重则依赖性强',
    });
  }

  return {
    items: flows,
    summary: flows.length ? '十神流动关系分析' : '十神流动特征不明显',
  };
}
