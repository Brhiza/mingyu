import { calculateKongWangBranches } from '../../kongWang';
import { isGanZhiPair } from '../../baziUtils';
import { NAYIN_MAP } from '../../baziDefinitions';
import type { RuleContext, ShenShaRuleMap } from './types';

const JIN_SHA_BY_YEAR_BRANCH: Record<
  string,
  { branch: string; name: '吟呻煞' | '破碎煞' | '白衣煞' }
> = {
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

type YearBranchGroup = '寅午戌' | '巳酉丑' | '申子辰' | '亥卯未';

const YEAR_BRANCH_GROUP_BY_BRANCH: Record<string, YearBranchGroup> = {
  寅: '寅午戌',
  午: '寅午戌',
  戌: '寅午戌',
  巳: '巳酉丑',
  酉: '巳酉丑',
  丑: '巳酉丑',
  申: '申子辰',
  子: '申子辰',
  辰: '申子辰',
  亥: '亥卯未',
  卯: '亥卯未',
  未: '亥卯未',
};

const JIE_TOU_SHA_BY_YEAR_GROUP: Record<YearBranchGroup, Record<string, string>> = {
  寅午戌: {
    甲: '己亥',
    丙: '辛亥',
    戊: '癸亥',
    庚: '乙亥',
    壬: '丁亥',
  },
  巳酉丑: {
    乙: '戊寅',
    丁: '庚寅',
    己: '壬寅',
    辛: '甲寅',
    癸: '丙寅',
  },
  申子辰: {
    甲: '己巳',
    丙: '辛巳',
    戊: '癸巳',
    庚: '乙巳',
    壬: '丁巳',
  },
  亥卯未: {
    乙: '戊申',
    丁: '庚申',
    己: '壬申',
    辛: '甲申',
    癸: '丙申',
  },
};

const JIE_TOU_GUI_BY_YEAR_GROUP: Record<YearBranchGroup, Record<string, string>> = {
  寅午戌: {
    甲: '辛亥',
    丙: '癸亥',
    戊: '乙亥',
    庚: '丁亥',
    壬: '己亥',
  },
  巳酉丑: {
    乙: '庚寅',
    丁: '壬寅',
    己: '甲寅',
    辛: '丙寅',
    癸: '戊寅',
  },
  申子辰: {
    甲: '辛巳',
    丙: '癸巳',
    戊: '乙巳',
    庚: '丁巳',
    壬: '己巳',
  },
  亥卯未: {
    乙: '庚申',
    丁: '壬申',
    己: '甲申',
    辛: '丙申',
    癸: '戊申',
  },
};

const SAN_GONG_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '壬子',
  午: '壬子',
  戌: '壬子',
  巳: '丙午',
  酉: '丙午',
  丑: '丙午',
  申: '己卯',
  子: '己卯',
  辰: '己卯',
  亥: '辛酉',
  卯: '辛酉',
  未: '辛酉',
};

const GUAN_HUI_SHA_BY_YEAR_STEM: Record<string, string> = {
  甲: '辛丑',
  乙: '辛丑',
  丙: '壬辰',
  丁: '壬辰',
  戊: '乙未',
  己: '乙未',
  庚: '丙戌',
  辛: '丙戌',
  壬: '戊辰',
  癸: '戊辰',
};

const CAI_HUI_SHA_BY_YEAR_BRANCH: Record<string, string> = {
  寅: '辛丑',
  午: '辛丑',
  戌: '辛丑',
  巳: '乙未',
  酉: '乙未',
  丑: '乙未',
  申: '丙戌',
  子: '丙戌',
  辰: '丙戌',
  亥: '戊辰',
  卯: '戊辰',
  未: '戊辰',
};

const ZHEN_GUI_XING_JI_STEMS_BY_YEAR_STEM: Record<string, string[]> = {
  甲: ['丁', '壬'],
  己: ['丁', '壬'],
  乙: ['戊', '癸'],
  庚: ['戊', '癸'],
  丙: ['甲', '己'],
  辛: ['甲', '己'],
  丁: ['乙', '庚'],
  壬: ['乙', '庚'],
  戊: ['丙', '辛'],
  癸: ['丙', '辛'],
};

const WU_GUI_KONG_WANG_BRANCHES_BY_YEAR_STEM: Record<string, string[]> = {
  甲: ['午'],
  己: ['午'],
  乙: ['辰', '巳'],
  庚: ['辰', '巳'],
  丙: ['寅', '卯'],
  辛: ['寅', '卯'],
  丁: ['子', '丑'],
  壬: ['子', '丑'],
  戊: ['申', '酉'],
  癸: ['申', '酉'],
};

const YOU_WU_GUI_KONG_WANG_BRANCHES_BY_YEAR_STEM: Record<string, string[]> = {
  甲: ['巳', '午'],
  己: ['巳', '午'],
  乙: ['寅', '卯'],
  庚: ['寅', '卯'],
  丙: ['子', '丑'],
  辛: ['子', '丑'],
  丁: ['戌', '亥'],
  壬: ['戌', '亥'],
  戊: ['申', '酉'],
  癸: ['申', '酉'],
};

const PO_ZU_KONG_WANG_BRANCH_BY_YEAR_STEM: Record<string, string> = {
  甲: '午',
  乙: '午',
  丙: '申',
  丁: '申',
  戊: '戌',
  己: '戌',
  庚: '子',
  辛: '子',
  壬: '寅',
  癸: '寅',
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

const JING_DE_STEM_BY_YEAR_BRANCH: Record<string, string> = {
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

const XUE_GUANG_SHA_HOUR_BY_DAY_BRANCH: Record<string, string> = {
  子: '戌',
  丑: '卯',
  辰: '午',
  未: '酉',
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

const JIAO_HAI_SHA_DAY_HOUR_BRANCH_PAIRS = [
  ['申', '亥'],
  ['亥', '申'],
  ['巳', '寅'],
  ['寅', '巳'],
];

const ZI_YI_SHA_BRANCH_BY_YEAR_BRANCH: Record<string, string> = {
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

// 《五行精纪》“鬼门关”只列子见酉、丑见午、寅见未、申见卯、亥见辰、戌见巳，
// 不是《三命通会》自缢煞的十二支成对互见表。
const GUI_MEN_GUAN_BRANCH_BY_YEAR_BRANCH: Record<string, string> = {
  子: '酉',
  丑: '午',
  寅: '未',
  申: '卯',
  亥: '辰',
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

function calculateOptionalKongWangBranches(gan: string, zhi: string): string[] {
  return isGanZhiPair(gan, zhi) ? calculateKongWangBranches(gan, zhi) : [];
}

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
  const jinSha = JIN_SHA_BY_YEAR_BRANCH[nianZhi];
  const jinShaHits = jinSha?.branch === zhi;
  const sanQiuWuMu = SAN_QIU_WU_MU_BY_MONTH_BRANCH[yueZhi];
  const yearBranchGroup = YEAR_BRANCH_GROUP_BY_BRANCH[nianZhi];
  const jieTouShaPillar = JIE_TOU_SHA_BY_YEAR_GROUP[yearBranchGroup]?.[nianGan];
  const jieTouGuiPillar = JIE_TOU_GUI_BY_YEAR_GROUP[yearBranchGroup]?.[nianGan];
  const shiZhi = baziArray[3][1];
  const tianXingBranch = cdz[(zhiIdx(shiZhi) + 1) % 12];
  const tianShangBranch = cdz[(zhiIdx(shiZhi) - 2 + 12) % 12];
  const riKongWangBranches = calculateOptionalKongWangBranches(riGan, riZhi);
  const nianMingKongWangBranches = calculateOptionalKongWangBranches(nianGan, nianZhi);
  const variantYearKongWangBranches =
    variants.kongWangBasis === 'day-and-year' ? nianMingKongWangBranches : [];
  const kongWangBranches = [...riKongWangBranches, ...variantYearKongWangBranches];
  const guXuBranches = kongWangBranches
    .map((branch) => cdz[(zhiIdx(branch) + 6) % 12])
    .filter(Boolean);
  const hasPoSha = PO_SHA_BRANCH_PAIRS.some(
    ([left, right]) =>
      (zhi === left && baziArray.some((pillar) => pillar[1] === right)) ||
      (zhi === right && baziArray.some((pillar) => pillar[1] === left)),
  );
  const hasJiaoHaiSha = JIAO_HAI_SHA_DAY_HOUR_BRANCH_PAIRS.some(([dayBranch, hourBranch]) => {
    return riZhi === dayBranch && shiZhi === hourBranch;
  });
  const annualPalace = (offset: number) => cdz[(zhiIdx(nianZhi) + offset + 12) % 12] === zhi;
  const unsupportedFlowYearStar = () => false;
  const nianGanIsYang = ctg.indexOf(nianGan) % 2 === 0;
  const yuanChenOffset = (nianGanIsYang && isMan) || (!nianGanIsYang && !isMan) ? 5 : 7;
  const yuanChenBranch = cdz[(zhiIdx(nianZhi) + yuanChenOffset + 12) % 12];
  const hasYuanChen = baziArray.some((pillar) => pillar[1] === yuanChenBranch);
  const chiXiaoMonthBranch = cdz[(zhiIdx(nianZhi) + 2) % 12];
  const chiXiaoDayHourBranch = cdz[(zhiIdx(yueZhi) + 3) % 12];
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
  const nianNayinWuxing = NAYIN_MAP[`${nianGan}${nianZhi}`]?.slice(-1);

  return {
    空亡: () => kongWangBranches.includes(zhi),
    孤虚: () => guXuBranches.includes(zhi),
    // 默认采用《命理探源》口径：劫煞、亡神“以日主为主”，其中“申子辰日”的例子表明这里指日支。
    // 《五行精纪》另有按生年支起例的旧法，此处不把两个版本同时混算。
    亡神: () => {
      const map: Record<string, string> = {
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
      return map[riZhi] === zhi;
    },
    劫煞: () => {
      const map: Record<string, string> = {
        申: '巳',
        子: '巳',
        辰: '巳',
        亥: '申',
        卯: '申',
        未: '申',
        寅: '亥',
        午: '亥',
        戌: '亥',
        巳: '寅',
        酉: '寅',
        丑: '寅',
      };
      return map[riZhi] === zhi;
    },
    劫头杀: () => jieTouShaPillar === pillarGZ,
    劫头鬼: () => jieTouGuiPillar === pillarGZ,
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
      return map[riZhi] === zhi;
    },
    // 《五行精纪》把天杀、地杀列入以“本命”起的十二宫驿马例，故只按生年支取用。
    天杀: () => TIAN_SHA_BY_BRANCH[nianZhi] === zhi,
    地杀: () => DI_SHA_BY_BRANCH[nianZhi] === zhi,
    墓杀: () => MU_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    害气杀: () => HAI_QI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    死气杀: () => cdz[(zhiIdx(nianZhi) + 4) % 12] === zhi,
    无成杀: () => WU_CHENG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    暴败杀: () => BAO_BAI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    离乡杀: () => pillarIndex >= 2 && LI_XIANG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    破外杀: () => pillarIndex >= 2 && PO_WAI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    // 《五行精纪》把日时固定表题作“血光杀”，把年命取日时表另题作“又血光杀”，
    // 两套基准分别输出，避免同名规则静默合并。
    血光杀: () => pillarIndex === 3 && XUE_GUANG_SHA_HOUR_BY_DAY_BRANCH[riZhi] === zhi,
    又血光杀: () =>
      pillarIndex >= 2 && (XUE_GUANG_SHA_BY_YEAR_BRANCH[nianZhi]?.includes(zhi) ?? false),
    截命杀: () => cdz[(zhiIdx(nianZhi) + 1) % 12] === zhi,
    推命杀: () => cdz[(zhiIdx(nianZhi) + 11) % 12] === zhi,
    // 《五行精纪》《三命通会》只确定命前五辰为宅、命后五辰为墓，并要求宅墓再受岁、劫等煞，
    // 或进入行年岁运后才论相应结果；原文没有给出把任一本命日时支直接标成“宅墓煞”的完整条件。
    // 目标位置仍可交给上层按原文继续推算，神煞层对旧简化规则失败关闭。
    宅墓煞: () => false,
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
      // 《五行精纪》十二宫驿马例及“本命”用语均按生年支起六厄，不与日支异法混算。
      return map[nianZhi] === zhi;
    },
    元辰: () => {
      return yuanChenBranch === zhi;
    },
    // 默认采用《命理探源》所引《渊海子平》口径：年命纳音火见戌亥日为天罗，
    // 年命纳音水土见辰巳日为地网，金木命无之。只标记日柱，不把《五行精纪》
    // 的年、月、日、时交互版本静默并入同一名称。
    天罗: () => pillarIndex === 2 && nianNayinWuxing === '火' && ['戌', '亥'].includes(zhi),
    地网: () =>
      pillarIndex === 2 &&
      ['水', '土'].includes(nianNayinWuxing ?? '') &&
      ['辰', '巳'].includes(zhi),
    // 《神峰通考》《命理探源》均把太岁至病符这套十二宫明列为“流年星耀”，
    // 其用法是把指定流年排入宫限，并非以出生年支横取本命四柱。《命理探源》还明确
    // 反对舍干支生克而凭此断流年。《五行精纪》的“太岁十二杀”另有不同名称表，且未给出
    // 当前这种四柱落位法；两表不能静默合并。因此八字本命神煞对整套流年星耀失败关闭。
    天医: unsupportedFlowYearStar,
    太岁: unsupportedFlowYearStar,
    剑锋: unsupportedFlowYearStar,
    伏尸: unsupportedFlowYearStar,
    太阳: unsupportedFlowYearStar,
    天空: unsupportedFlowYearStar,
    官符: unsupportedFlowYearStar,
    病符: unsupportedFlowYearStar,
    死符: unsupportedFlowYearStar,
    // 《五行精纪》金神大杀又称金杀，并明确“一杀而有三名”：巳为吟呻、酉为破碎、丑为白衣。
    // 《神峰通考》另以太白星、斧劈星列出同一组三合年命位置；真正“暗金杀”是另一张十二支表，
    // 不得因查表位置相近而混用名称。
    吟呻煞: () => jinSha?.name === '吟呻煞' && jinShaHits,
    破碎煞: () => jinSha?.name === '破碎煞' && jinShaHits,
    白衣煞: () => jinSha?.name === '白衣煞' && jinShaHits,
    金神大杀: () => jinShaHits,
    太白星: () => jinShaHits,
    斧劈星: () => jinShaHits,
    // 《五行精纪》此表题为“天官符”，正文又说明它是年命版亡神、属破军星；
    // 默认亡神已采用《命理探源》的日支口径，不能把另一版本改名“破军”后并列输出。
    破军: () => false,
    // 原文申子辰组为己卯，并解释“水土同位，故取己土卯木之克”；年柱只作本命基准。
    三公煞: () => pillarIndex >= 1 && SAN_GONG_SHA_BY_YEAR_BRANCH[nianZhi] === pillarGZ,
    官会杀: () => GUAN_HUI_SHA_BY_YEAR_STEM[nianGan] === pillarGZ,
    财会杀: () => CAI_HUI_SHA_BY_YEAR_BRANCH[nianZhi] === pillarGZ,
    真鬼刑疾: () => pillarIndex >= 2 && ZHEN_GUI_XING_JI_STEMS_BY_YEAR_STEM[nianGan]?.includes(gan),
    // 《五行精纪》连续列出“五鬼空亡”和“又五鬼空亡”两张不同表，分别输出。
    五鬼空亡: () =>
      pillarIndex >= 1 && (WU_GUI_KONG_WANG_BRANCHES_BY_YEAR_STEM[nianGan]?.includes(zhi) ?? false),
    又五鬼空亡: () =>
      pillarIndex >= 1 &&
      (YOU_WU_GUI_KONG_WANG_BRANCHES_BY_YEAR_STEM[nianGan]?.includes(zhi) ?? false),
    // 本段以生年干起例，原文例证另取日柱相见；与前后两张五鬼空亡一致，
    // 年柱只作命的基准，不得用自身干支回标破祖空亡。
    破祖空亡: () => pillarIndex >= 1 && PO_ZU_KONG_WANG_BRANCH_BY_YEAR_STEM[nianGan] === zhi,
    青龙杀: () => QING_LONG_SHA_BY_YEAR_BRANCH[nianZhi] === pillarGZ,
    良会杀: () => LIANG_HUI_SHA_BY_YEAR_BRANCH[nianZhi] === pillarGZ,
    // 《五行精纪》把此项题作“扶生日”，并按正月至十二月逐月列出日支，
    // 与紧邻的天赦日同属历日规则；不得把同支的年、月、时柱一并回标。
    扶生日: () => pillarIndex === 2 && FU_SHENG_DAY_BY_MONTH_BRANCH[yueZhi] === zhi,
    天喜神: () => TIAN_XI_SHEN_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    天瞽杀: () => TIAN_GU_SHA_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    飞廉杀: () => TIAN_GU_SHA_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    旌德: () => pillarIndex >= 2 && JING_DE_STEM_BY_MONTH_BRANCH[yueZhi] === gan,
    // 《五行精纪》《三命通会》均作“寅午戌人见辛……”；“生时犯之”只是时柱的附加说明，
    // 不是成立条件，故按原文“见”检查四柱，不静默缩成仅时干。
    又旌德: () => JING_DE_STEM_BY_YEAR_BRANCH[nianZhi] === gan,
    旌钺: () => pillarIndex === 3 && JING_YUE_HOUR_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi,
    又旌钺: () => JING_YUE_PILLAR_BY_YEAR_MEETING_BRANCH[nianZhi] === pillarGZ,
    真亡杀: () => ZHEN_WANG_SHA_BY_YEAR_BRANCH[nianZhi]?.includes(pillarGZ),
    月煞: () => YUE_SHA_BY_MONTH_BRANCH[yueZhi] === zhi,
    月厌: () => YUE_YAN_BY_MONTH_BRANCH[yueZhi] === zhi,
    头戴杀: () => pillarIndex >= 2 && TOU_DAI_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    // 《五行精纪》“官符落天中”与《三命通会》“太岁前五辰，是日时遇之”均属本命年起例；
    // 天中因此取本命年柱旬空，不得改用日柱旬空。十二宫以太岁为第一位，官符为第五位，即顺行四支。
    妄语煞: () => pillarIndex >= 2 && annualPalace(4) && nianMingKongWangBranches.includes(zhi),
    // 《五行精纪》限定六个完整日时柱，并要求命中另带元辰，三项条件缺一不可。
    点头杀: () => pillarIndex >= 2 && hasYuanChen && DIAN_TOU_SHA_PILLARS.includes(pillarGZ),
    // 原文只取月、日、时内同一完整干支重见；年柱不参与重叠，也不得把同支或同干当作重见。
    无形鬼: () =>
      pillarIndex >= 1 && WU_XING_GUI_PILLARS.includes(pillarGZ) && hasRepeatedWuXingGui,
    三丘: () => sanQiuWuMu?.sanQiu === zhi,
    五墓: () => sanQiuWuMu?.wuMu === zhi,
    // 《三命通会》的年命配时干版，与《五行精纪》“时前一辰”版同名而条件不同，明确分名输出。
    '天刑（三命通会年命时干版）': () =>
      pillarIndex === 3 && TIAN_XING_HOUR_STEM_BY_YEAR_BRANCH[nianZhi] === gan,
    // 《五行精纪》把天刑、天伤作为同一组时支前后位置，保留成对事实并标明版本，
    // 不再把其中的天伤与《三命通会》异版天刑静默拼接。
    '天刑（五行精纪时支版）': () => tianXingBranch === zhi,
    '天伤（五行精纪时支版）': () => tianShangBranch === zhi,
    雷霆煞: () => LEI_TING_SHA_BRANCH_BY_MONTH_BRANCH[yueZhi] === zhi,
    破煞: () => hasPoSha,
    狡害杀: () => pillarIndex >= 2 && hasJiaoHaiSha,
    自缢煞: () => pillarIndex >= 1 && ZI_YI_SHA_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi,
    鬼门: () => pillarIndex >= 1 && GUI_MEN_GUAN_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi,
    天罡杀: () => TIAN_GANG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    阴杀: () => YIN_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    阳杀: () => YANG_SHA_BY_YEAR_BRANCH[nianZhi] === zhi,
    // 《五行精纪》“年隔月一位，月隔时日二位”，即年支顺隔一支取月、月支顺隔二支取日时。
    鸱枭杀: () => pillarIndex >= 2 && yueZhi === chiXiaoMonthBranch && zhi === chiXiaoDayHourBranch,
    冲天杀: () =>
      (pillarIndex === 1 && clashes(nianZhi, zhi)) || (pillarIndex === 3 && clashes(riZhi, zhi)),
    丧门: unsupportedFlowYearStar,
    地丧: unsupportedFlowYearStar,
    勾绞: unsupportedFlowYearStar,
    贯索: unsupportedFlowYearStar,
    吊客: unsupportedFlowYearStar,
    披麻: () => annualPalace(-3),
    五鬼: unsupportedFlowYearStar,
    小耗: unsupportedFlowYearStar,
    栏杆: unsupportedFlowYearStar,
    大耗: unsupportedFlowYearStar,
    暴败: unsupportedFlowYearStar,
    天厄: unsupportedFlowYearStar,
    飞廉: unsupportedFlowYearStar,
    白虎: unsupportedFlowYearStar,
    卷舌: unsupportedFlowYearStar,
    福星: unsupportedFlowYearStar,
    天狗: unsupportedFlowYearStar,
  };
}
