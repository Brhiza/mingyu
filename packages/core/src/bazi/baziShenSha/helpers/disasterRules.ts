import { calculateKongWangBranches } from '../../kongWang';
import type { RuleContext, ShenShaRuleMap } from './types';

const AN_JIN_SHA_BY_YEAR_BRANCH: Record<string, { branch: string; name: '吟呻煞' | '破碎煞' | '白衣煞' }> = {
  子: { branch: '巳', name: '吟呻煞' },
  午: { branch: '巳', name: '吟呻煞' },
  卯: { branch: '巳', name: '吟呻煞' },
  酉: { branch: '巳', name: '吟呻煞' },
  寅: { branch: '酉', name: '破碎煞' },
  申: { branch: '酉', name: '破碎煞' },
  巳: { branch: '酉', name: '破碎煞' },
  亥: { branch: '酉', name: '破碎煞' },
  辰: { branch: '丑', name: '白衣煞' },
  戌: { branch: '丑', name: '白衣煞' },
  丑: { branch: '丑', name: '白衣煞' },
  未: { branch: '丑', name: '白衣煞' },
};

const SAN_QIU_WU_MU_BY_MONTH_BRANCH: Record<string, { sanQiu: string; wuMu: string }> = {
  寅: { sanQiu: '丑', wuMu: '未' },
  卯: { sanQiu: '丑', wuMu: '未' },
  辰: { sanQiu: '丑', wuMu: '未' },
  巳: { sanQiu: '辰', wuMu: '戌' },
  午: { sanQiu: '辰', wuMu: '戌' },
  未: { sanQiu: '辰', wuMu: '戌' },
  申: { sanQiu: '未', wuMu: '丑' },
  酉: { sanQiu: '未', wuMu: '丑' },
  戌: { sanQiu: '未', wuMu: '丑' },
  亥: { sanQiu: '戌', wuMu: '辰' },
  子: { sanQiu: '戌', wuMu: '辰' },
  丑: { sanQiu: '戌', wuMu: '辰' },
};

const YUE_SHA_BY_MONTH_BRANCH: Record<string, string> = {
  寅: '丑',
  午: '丑',
  戌: '丑',
  亥: '戌',
  卯: '戌',
  未: '戌',
  申: '未',
  子: '未',
  辰: '未',
  巳: '辰',
  酉: '辰',
  丑: '辰',
};

const YUE_YAN_BY_MONTH_BRANCH: Record<string, string> = {
  寅: '戌',
  卯: '酉',
  辰: '申',
  巳: '未',
  午: '午',
  未: '巳',
  申: '辰',
  酉: '卯',
  戌: '寅',
  亥: '丑',
  子: '子',
  丑: '亥',
};

const TOU_DAI_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '辰',
  午: '辰',
  戌: '辰',
  巳: '未',
  酉: '未',
  丑: '未',
  申: '戌',
  子: '戌',
  辰: '戌',
  亥: '丑',
  卯: '丑',
  未: '丑',
};

const PO_JUN_BY_YEAR_BRANCH: Record<string, string> = {
  申: '亥',
  子: '亥',
  辰: '亥',
  亥: '寅',
  卯: '寅',
  未: '寅',
  寅: '巳',
  午: '巳',
  戌: '巳',
  巳: '申',
  酉: '申',
  丑: '申',
};

const SAN_GONG_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '壬子',
  午: '壬子',
  戌: '壬子',
  巳: '丙午',
  酉: '丙午',
  丑: '丙午',
  申: '乙卯',
  子: '乙卯',
  辰: '乙卯',
  亥: '辛酉',
  卯: '辛酉',
  未: '辛酉',
};

const QING_LONG_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '丙寅',
  午: '丙寅',
  戌: '丙寅',
  巳: '辛巳',
  酉: '辛巳',
  丑: '辛巳',
  申: '壬申',
  子: '壬申',
  辰: '壬申',
  亥: '乙亥',
  卯: '乙亥',
  未: '乙亥',
};

const LIANG_HUI_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '丁卯',
  午: '丁卯',
  戌: '丁卯',
  巳: '庚辰',
  酉: '庚辰',
  丑: '庚辰',
  申: '癸酉',
  子: '癸酉',
  辰: '癸酉',
  亥: '甲子',
  卯: '甲子',
  未: '甲子',
};

const FU_SHENG_DAY_BY_MONTH_BRANCH: Record<string, string> = {
  寅: '酉',
  卯: '卯',
  辰: '戌',
  巳: '辰',
  午: '亥',
  未: '巳',
  申: '子',
  酉: '午',
  戌: '丑',
  亥: '未',
  子: '寅',
  丑: '申',
};

const TIAN_XI_SHEN_BRANCH_BY_MONTH_BRANCH: Record<string, string> = {
  寅: '戌',
  卯: '戌',
  辰: '戌',
  巳: '丑',
  午: '丑',
  未: '丑',
  申: '辰',
  酉: '辰',
  戌: '辰',
  亥: '未',
  子: '未',
  丑: '未',
};

const TIAN_GU_SHA_BRANCH_BY_MONTH_BRANCH: Record<string, string> = {
  寅: '申',
  卯: '未',
  辰: '午',
  巳: '巳',
  午: '辰',
  未: '卯',
  申: '寅',
  酉: '丑',
  戌: '子',
  亥: '亥',
  子: '戌',
  丑: '酉',
};

const JING_DE_STEM_BY_MONTH_BRANCH: Record<string, string> = {
  寅: '丙',
  午: '丙',
  戌: '丙',
  巳: '庚',
  酉: '庚',
  丑: '庚',
  申: '壬',
  子: '壬',
  辰: '壬',
  亥: '甲',
  卯: '甲',
  未: '甲',
};

const JING_DE_HOUR_STEM_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '辛',
  午: '辛',
  戌: '辛',
  巳: '乙',
  酉: '乙',
  丑: '乙',
  申: '丁',
  子: '丁',
  辰: '丁',
  亥: '己',
  卯: '己',
  未: '己',
};

const JING_YUE_HOUR_BRANCH_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '寅',
  午: '寅',
  戌: '寅',
  巳: '巳',
  酉: '巳',
  丑: '巳',
  申: '申',
  子: '申',
  辰: '申',
  亥: '亥',
  卯: '亥',
  未: '亥',
};

const JING_YUE_PILLAR_BY_YEAR_MEETING_BRANCH: Record<string, string> = {
  寅: '癸酉',
  卯: '癸酉',
  辰: '癸酉',
  巳: '癸卯',
  午: '癸卯',
  未: '癸卯',
  申: '戊子',
  酉: '戊子',
  戌: '戊子',
  亥: '戊午',
  子: '戊午',
  丑: '戊午',
};

const ZHEN_WANG_SHA_BY_YEAR_BRANCH: Record<string, string[]> = {
  寅: ['癸巳', '癸亥'],
  午: ['癸巳', '癸亥'],
  戌: ['癸巳', '癸亥'],
  巳: ['丙申', '丙寅'],
  酉: ['丙申', '丙寅'],
  丑: ['丙申', '丙寅'],
  申: ['丁亥', '丁巳'],
  子: ['丁亥', '丁巳'],
  辰: ['丁亥', '丁巳'],
  亥: ['壬寅', '壬申'],
  卯: ['壬寅', '壬申'],
  未: ['壬寅', '壬申'],
};

const TIAN_SHA_BY_BRANCH: Record<string, string> = {
  申: '未',
  子: '未',
  辰: '未',
  亥: '辰',
  卯: '辰',
  未: '辰',
  寅: '丑',
  午: '丑',
  戌: '丑',
  巳: '戌',
  酉: '戌',
  丑: '戌',
};

const DI_SHA_BY_BRANCH: Record<string, string> = {
  申: '戌',
  子: '戌',
  辰: '戌',
  亥: '未',
  卯: '未',
  未: '未',
  寅: '辰',
  午: '辰',
  戌: '辰',
  巳: '丑',
  酉: '丑',
  丑: '丑',
};

const MU_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  申: '辰',
  子: '辰',
  辰: '辰',
  亥: '未',
  卯: '未',
  未: '未',
  寅: '戌',
  午: '戌',
  戌: '戌',
  巳: '丑',
  酉: '丑',
  丑: '丑',
};

const HAI_QI_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  申: '亥',
  子: '亥',
  辰: '亥',
  亥: '寅',
  卯: '寅',
  未: '寅',
  寅: '巳',
  午: '巳',
  戌: '巳',
  巳: '申',
  酉: '申',
  丑: '申',
};

const WU_CHENG_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '巳',
  午: '巳',
  戌: '巳',
  巳: '未',
  酉: '未',
  丑: '未',
  申: '卯',
  子: '卯',
  辰: '卯',
  亥: '子',
  卯: '子',
  未: '子',
};

const BAO_BAI_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  子: '未',
  丑: '午',
  寅: '巳',
  卯: '辰',
  辰: '卯',
  巳: '寅',
  午: '丑',
  未: '子',
  申: '亥',
  酉: '戌',
  戌: '酉',
  亥: '申',
};

const LI_XIANG_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '午',
  午: '午',
  戌: '午',
  巳: '酉',
  酉: '酉',
  丑: '酉',
  申: '子',
  子: '子',
  辰: '子',
  亥: '卯',
  卯: '卯',
  未: '卯',
};

const PO_WAI_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '酉',
  卯: '酉',
  辰: '酉',
  巳: '子',
  午: '子',
  未: '子',
  申: '卯',
  酉: '卯',
  戌: '卯',
  亥: '午',
  子: '午',
  丑: '午',
};

const XUE_GUANG_SHA_BY_YEAR_BRANCH: Record<string, string[]> = {
  子: ['戌'],
  戌: ['子', '申'],
  丑: ['卯'],
  卯: ['丑'],
  辰: ['午'],
  午: ['辰'],
  巳: ['未'],
  未: ['巳'],
  申: ['戌'],
  酉: ['亥'],
  亥: ['酉'],
};

const DIAN_TOU_SHA_PILLARS = ['戊寅', '戊申', '庚寅', '庚申', '辛巳', '辛亥'];

const WU_XING_GUI_PILLARS = ['甲午', '丁酉', '己巳', '庚子', '辛亥', '壬申', '壬寅', '癸卯'];

const TIAN_XING_HOUR_STEM_BY_YEAR_BRANCH: Record<string, string> = {
  子: '乙',
  丑: '乙',
  寅: '庚',
  卯: '辛',
  辰: '辛',
  巳: '壬',
  午: '癸',
  未: '癸',
  申: '丙',
  酉: '丁',
  戌: '丁',
  亥: '戊',
};

const LEI_TING_SHA_BRANCH_BY_MONTH_BRANCH: Record<string, string> = {
  寅: '子',
  申: '子',
  卯: '寅',
  酉: '寅',
  辰: '辰',
  戌: '辰',
  巳: '午',
  亥: '午',
  午: '申',
  子: '申',
  未: '戌',
  丑: '戌',
};

const PO_SHA_BRANCH_PAIRS = [
  ['卯', '午'],
  ['丑', '辰'],
  ['子', '酉'],
  ['未', '戌'],
];

const GUI_MEN_BRANCH_BY_YEAR_BRANCH: Record<string, string> = {
  子: '酉',
  酉: '子',
  丑: '午',
  午: '丑',
  寅: '未',
  未: '寅',
  卯: '申',
  申: '卯',
  辰: '亥',
  亥: '辰',
  巳: '戌',
  戌: '巳',
};

const TIAN_GANG_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  子: '午',
  丑: '未',
  寅: '申',
  卯: '酉',
  辰: '戌',
  巳: '亥',
  午: '子',
  未: '丑',
  申: '寅',
  酉: '卯',
  戌: '辰',
  亥: '巳',
};

const YIN_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  子: '午',
  午: '午',
  丑: '辰',
  未: '辰',
  寅: '寅',
  申: '寅',
  卯: '子',
  酉: '子',
  辰: '戌',
  戌: '戌',
  巳: '申',
  亥: '申',
};

const YANG_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '戌',
  申: '戌',
  卯: '子',
  酉: '子',
  辰: '寅',
  戌: '寅',
  巳: '辰',
  亥: '辰',
  子: '午',
  午: '午',
  丑: '申',
  未: '申',
};

export function buildDisasterRules(ctx: RuleContext): ShenShaRuleMap {
  const {
    gan,
    zhi,
    pillarIndex,
    pillarGZ,
    nianGan,
    nianZhi,
    yueZhi,
    riGan,
    riZhi,
    isMan,
    ctg,
    cdz,
    zhiIdx,
    baziArray,
    variants,
  } = ctx;
  const anJinSha = AN_JIN_SHA_BY_YEAR_BRANCH[nianZhi];
  const anJinShaHits = anJinSha?.branch === zhi;
  const sanQiuWuMu = SAN_QIU_WU_MU_BY_MONTH_BRANCH[yueZhi];
  const shiZhi = baziArray[3]?.[1] || '';
  const tianShangBranch = shiZhi ? cdz[(zhiIdx(shiZhi) - 2 + 12) % 12] : '';
  const riKongWangBranches = calculateKongWangBranches(riGan, riZhi);
  const nianKongWangBranches =
    variants.kongWangBasis === 'day-and-year' ? calculateKongWangBranches(nianGan, nianZhi) : [];
  const kongWangBranches = [...riKongWangBranches, ...nianKongWangBranches];
  const guXuBranches = kongWangBranches
    .map((branch) => cdz[(zhiIdx(branch) + 6) % 12])
    .filter(Boolean);
  const hasPoSha = PO_SHA_BRANCH_PAIRS.some(
    ([left, right]) =>
      (zhi === left && baziArray.some((pillar) => pillar[1] === right)) ||
      (zhi === right && baziArray.some((pillar) => pillar[1] === left)),
  );
  const annualPalace = (offset: number) => cdz[(zhiIdx(nianZhi) + offset + 12) % 12] === zhi;
  const nianGanIsYang = ctg.indexOf(nianGan) % 2 === 0;
  const yuanChenOffset = (nianGanIsYang && isMan) || (!nianGanIsYang && !isMan) ? 5 : 7;
  const yuanChenBranch = cdz[(zhiIdx(nianZhi) + yuanChenOffset + 12) % 12];
  const hasYuanChen = baziArray.some((pillar) => pillar[1] === yuanChenBranch);
  const hasRepeatedWuXingGui = baziArray.some(
    (pillar, index) =>
      index >= 1 &&
      index !== pillarIndex &&
      WU_XING_GUI_PILLARS.includes(pillar.join('')) &&
      pillar.join('') === pillarGZ,
  );
  const clashes = (source: string, target: string) => {
    const index = zhiIdx(source);
    return index >= 0 && cdz[(index + 6) % 12] === target;
  };

  return {
    空亡: () => kongWangBranches.includes(zhi),
    孤虚: () => guXuBranches.includes(zhi),
    亡神: () => {
      const map: Record<string, string> = {
        申: '亥',
        子: '亥',
        辰: '亥',
        亥: '申',
        卯: '申',
        未: '申',
        寅: '巳',
        午: '巳',
        戌: '巳',
        巳: '寅',
        酉: '寅',
        丑: '寅',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    劫煞: () => {
      const map: Record<string, string> = {
        申: '巳',
        子: '巳',
        辰: '巳',
        亥: '寅',
        卯: '寅',
        未: '寅',
        寅: '亥',
        午: '亥',
        戌: '亥',
        巳: '申',
        酉: '申',
        丑: '申',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    灾煞: () => {
      const map: Record<string, string> = {
        申: '午',
        子: '午',
        辰: '午',
        亥: '酉',
        卯: '酉',
        未: '酉',
        寅: '子',
        午: '子',
        戌: '子',
        巳: '卯',
        酉: '卯',
        丑: '卯',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    天杀: () => TIAN_SHA_BY_BRANCH[nianZhi] === zhi || TIAN_SHA_BY_BRANCH[riZhi] === zhi,
    地杀: () => DI_SHA_BY_BRANCH[nianZhi] === zhi || DI_SHA_BY_BRANCH[riZhi] === zhi,
    墓杀: () => MU_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    害气杀: () => HAI_QI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    死气杀: () => cdz[(zhiIdx(nianZhi) + 4) % 12] === zhi,
    无成杀: () => WU_CHENG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    暴败杀: () => BAO_BAI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    离乡杀: () => pillarIndex >= 2 && LI_XIANG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    破外杀: () => pillarIndex >= 2 && PO_WAI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    血光杀: () => pillarIndex >= 2 && XUE_GUANG_SHA_BY_YEAR_BRANCH[nianZhi]?.includes(zhi),
    截命杀: () => cdz[(zhiIdx(nianZhi) + 1) % 12] === zhi,
    推命杀: () => cdz[(zhiIdx(nianZhi) + 11) % 12] === zhi,
    建命杀: () => pillarIndex === 1 && pillarGZ === `${nianGan}${nianZhi}`,
    六厄: () => {
      const map: Record<string, string> = {
        申: '卯',
        子: '卯',
        辰: '卯',
        寅: '酉',
        午: '酉',
        戌: '酉',
        亥: '午',
        卯: '午',
        未: '午',
        巳: '子',
        酉: '子',
        丑: '子',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    元辰: () => {
      return yuanChenBranch === zhi;
    },
    血刃: () => {
      const map: Record<string, string> = {
        寅: '丑',
        卯: '寅',
        辰: '卯',
        巳: '辰',
        午: '巳',
        未: '午',
        申: '未',
        酉: '申',
        戌: '酉',
        亥: '戌',
        子: '亥',
        丑: '子',
      };
      return map[yueZhi] === zhi;
    },
    流霞: () => {
      const map: Record<string, string> = {
        甲: '酉',
        乙: '戌',
        丙: '未',
        丁: '申',
        戊: '巳',
        己: '午',
        庚: '辰',
        辛: '卯',
        壬: '亥',
        癸: '寅',
      };
      return map[riGan] === zhi;
    },
    天罗: () => {
      const hasXu = baziArray.some((p) => p[1] === '戌');
      const hasHai = baziArray.some((p) => p[1] === '亥');
      return hasXu && hasHai && (zhi === '戌' || zhi === '亥');
    },
    地网: () => {
      const hasChen = baziArray.some((p) => p[1] === '辰');
      const hasSi = baziArray.some((p) => p[1] === '巳');
      return hasChen && hasSi && (zhi === '辰' || zhi === '巳');
    },
    天医: () => {
      const monthIdx = cdz.indexOf(yueZhi);
      if (monthIdx === -1) return false;
      const targetIdx = (monthIdx - 1 + 12) % 12;
      return cdz[targetIdx] === zhi;
    },
    太岁: () => annualPalace(0),
    剑锋: () => annualPalace(0),
    伏尸: () => annualPalace(0),
    太阳: () => annualPalace(1),
    天空: () => annualPalace(1),
    官符: () => pillarIndex >= 2 && annualPalace(4),
    病符: () => annualPalace(-1),
    死符: () => pillarIndex >= 1 && annualPalace(5),
    吟呻煞: () => anJinSha?.name === '吟呻煞' && anJinShaHits,
    破碎煞: () => anJinSha?.name === '破碎煞' && anJinShaHits,
    白衣煞: () => anJinSha?.name === '白衣煞' && anJinShaHits,
    太白星: () => anJinShaHits,
    斧劈星: () => anJinShaHits,
    破军: () => PO_JUN_BY_YEAR_BRANCH[nianZhi] === zhi,
    三公煞: () => SAN_GONG_SHA_BY_YEAR_BRANCH[nianZhi] === pillarGZ,
    青龙杀: () => QING_LONG_SHA_BY_YEAR_BRANCH[nianZhi] === pillarGZ,
    良会杀: () => LIANG_HUI_SHA_BY_YEAR_BRANCH[nianZhi] === pillarGZ,
    扶生日: () => FU_SHENG_DAY_BY_MONTH_BRANCH[yueZhi] === zhi,
    天喜神: () => TIAN_XI_SHEN_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    天瞽杀: () => TIAN_GU_SHA_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    飞廉杀: () => TIAN_GU_SHA_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    旌德: () =>
      (pillarIndex >= 2 && JING_DE_STEM_BY_MONTH_BRANCH[yueZhi] === gan) ||
      (pillarIndex === 3 && JING_DE_HOUR_STEM_BY_YEAR_BRANCH[nianZhi] === gan),
    旌钺: () =>
      (pillarIndex === 3 && JING_YUE_HOUR_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi) ||
      JING_YUE_PILLAR_BY_YEAR_MEETING_BRANCH[nianZhi] === pillarGZ,
    真亡杀: () => ZHEN_WANG_SHA_BY_YEAR_BRANCH[nianZhi]?.includes(pillarGZ),
    月煞: () => YUE_SHA_BY_MONTH_BRANCH[yueZhi] === zhi,
    月厌: () => YUE_YAN_BY_MONTH_BRANCH[yueZhi] === zhi,
    头戴杀: () => pillarIndex >= 2 && TOU_DAI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    妄语煞: () => pillarIndex >= 2 && annualPalace(4) && riKongWangBranches.includes(zhi),
    点头杀: () => pillarIndex >= 2 && hasYuanChen && DIAN_TOU_SHA_PILLARS.includes(pillarGZ),
    无形鬼: () => pillarIndex >= 1 && WU_XING_GUI_PILLARS.includes(pillarGZ) && hasRepeatedWuXingGui,
    三丘: () => sanQiuWuMu?.sanQiu === zhi,
    五墓: () => sanQiuWuMu?.wuMu === zhi,
    天刑: () => pillarIndex === 3 && TIAN_XING_HOUR_STEM_BY_YEAR_BRANCH[nianZhi] === gan,
    天伤: () => tianShangBranch === zhi,
    雷霆煞: () => LEI_TING_SHA_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    破煞: () => hasPoSha,
    自缢煞: () => GUI_MEN_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi,
    鬼门: () => GUI_MEN_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi,
    天罡杀: () => TIAN_GANG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    阴杀: () => YIN_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    阳杀: () => YANG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    冲天杀: () =>
      (pillarIndex === 1 && clashes(nianZhi, zhi)) || (pillarIndex === 3 && clashes(riZhi, zhi)),
    丧门: () => annualPalace(2),
    地丧: () => annualPalace(2),
    勾绞: () => annualPalace(3),
    贯索: () => annualPalace(3),
    吊客: () => annualPalace(-2),
    披麻: () => annualPalace(-3),
    五鬼: () => pillarIndex >= 2 && annualPalace(4),
    小耗: () => pillarIndex >= 1 && annualPalace(5),
    栏杆: () => annualPalace(6),
    大耗: () => annualPalace(6),
    暴败: () => annualPalace(7),
    天厄: () => annualPalace(7),
    飞廉: () => annualPalace(8),
    白虎: () => annualPalace(8),
    卷舌: () => annualPalace(9),
    福星: () => annualPalace(9),
    天狗: () => annualPalace(-2),
  };
}
