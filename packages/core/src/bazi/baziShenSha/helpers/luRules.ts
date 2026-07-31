import { REN_BRANCH_MAP, SIXTY_CYCLE, TWELVE_STAGES_MAP } from '../../baziDefinitions';
import type { RuleContext, ShenShaRuleMap } from './types';

const YI_MA_BY_BRANCH: Record<string, string> = {
  申: '寅',
  子: '寅',
  辰: '寅',
  亥: '巳',
  卯: '巳',
  未: '巳',
  寅: '申',
  午: '申',
  戌: '申',
  巳: '亥',
  酉: '亥',
  丑: '亥',
};

const SHENG_CHENG_MA_BY_BRANCH: Record<string, string> = {
  寅: '庚申',
  午: '庚申',
  戌: '庚申',
  申: '甲寅',
  子: '甲寅',
  辰: '甲寅',
  巳: '癸亥',
  酉: '癸亥',
  丑: '癸亥',
  亥: '丁巳',
  卯: '丁巳',
  未: '丁巳',
};

const MA_CAI_KU_BY_YI_MA_BRANCH: Record<string, string> = {
  寅: '辰',
  申: '未',
  巳: '丑',
  亥: '戌',
};

const FOOD_GOD_BY_STEM: Record<string, string> = {
  甲: '丙',
  乙: '丁',
  丙: '戊',
  丁: '己',
  戊: '庚',
  己: '辛',
  庚: '壬',
  辛: '癸',
  壬: '甲',
  癸: '乙',
};

const LU_BRANCH_BY_STEM: Record<string, string> = {
  甲: '寅',
  乙: '卯',
  丙: '巳',
  丁: '午',
  戊: '巳',
  己: '午',
  庚: '申',
  辛: '酉',
  壬: '亥',
  癸: '子',
};

const SHENG_CHENG_LU_BY_STEM: Record<string, string[]> = {
  甲: ['甲寅', '乙卯'],
  乙: ['甲寅', '乙卯'],
  丙: ['丁巳', '戊午'],
  丁: ['丁巳', '戊午'],
  戊: ['丁巳', '戊午'],
  己: ['丁巳', '戊午'],
  庚: ['庚申', '辛酉'],
  辛: ['庚申', '辛酉'],
  壬: ['癸亥', '壬子'],
  癸: ['癸亥', '壬子'],
};

const SHI_SHEN_DAI_LU_BY_STEM: Record<string, string> = {
  壬: '甲寅',
  癸: '乙卯',
  戊: '庚申',
  己: '辛酉',
};

const MING_WEI_LU_BY_YEAR_STEM: Record<string, string> = {
  甲: '丙寅',
  乙: '丁卯',
  庚: '壬申',
  辛: '癸酉',
};

const GOU_CHEN_BY_STEM: Record<string, string[]> = {
  甲: ['巳', '亥'],
  乙: ['巳', '亥'],
  丙: ['戌', '辰'],
  丁: ['戌', '辰'],
  戊: ['寅', '申'],
  己: ['寅', '申'],
  庚: ['丑', '未'],
  辛: ['丑', '未'],
  壬: ['子', '午'],
  癸: ['子', '午'],
};

const ZHEN_WU_BY_STEM: Record<string, string[]> = {
  甲: ['未'],
  乙: ['未'],
  丙: ['午'],
  丁: ['午'],
  戊: ['辰'],
  己: ['辰'],
  庚: ['卯'],
  辛: ['卯'],
  壬: ['寅'],
  癸: ['寅'],
};

const LU_TOU_CAI_BY_STEM: Record<string, string> = {
  甲: '戊寅',
  乙: '己卯',
  丙: '辛巳',
  丁: '庚午',
  戊: '癸巳',
  己: '壬午',
  庚: '甲申',
  辛: '乙酉',
  壬: '丁亥',
  癸: '丙子',
};

const LU_TOU_GUI_BY_STEM: Record<string, string> = {
  甲: '庚寅',
  乙: '辛卯',
  丙: '癸巳',
  丁: '壬午',
  戊: '乙巳',
  己: '甲午',
  庚: '丙申',
  辛: '丁酉',
  壬: '己亥',
  癸: '戊子',
};

const REN_TOU_CAI_BY_STEM: Record<string, string> = {
  甲: '己卯',
  乙: '戊辰',
  丙: '庚午',
  丁: '辛未',
  戊: '壬午',
  己: '癸亥',
  庚: '乙酉',
  辛: '甲戌',
  壬: '丙子',
  癸: '丁丑',
};

const REN_TOU_GUI_BY_STEM: Record<string, string> = {
  甲: '辛卯',
  乙: '庚辰',
  丙: '壬午',
  丁: '癸未',
  戊: '甲午',
  己: '乙未',
  庚: '丁酉',
  辛: '丙戌',
  壬: '戊子',
  癸: '己丑',
};

const KU_TOU_CAI_BY_STEM: Record<string, string> = {
  甲: '己未',
  乙: '己未',
  丙: '庚戌',
  丁: '庚戌',
  戊: '壬辰',
  己: '壬辰',
  庚: '乙丑',
  辛: '乙丑',
  壬: '丙辰',
  癸: '丙辰',
};

const KU_TOU_GUI_BY_STEM: Record<string, string> = {
  甲: '辛未',
  乙: '辛未',
  丙: '壬戌',
  丁: '壬戌',
  戊: '甲辰',
  己: '甲辰',
  庚: '丁丑',
  辛: '丁丑',
  壬: '戊辰',
  癸: '戊辰',
};

function getYangRenMap(includeYinRen: boolean): Record<string, string> {
  if (!includeYinRen) return REN_BRANCH_MAP;

  return Object.fromEntries(
    Object.entries(TWELVE_STAGES_MAP).map(([stem, stages]) => {
      const wangBranch = Object.entries(stages).find(([, stage]) => stage === '帝旺');
      return [stem, wangBranch ? wangBranch[0] : ''];
    }),
  );
}

export function buildLuRules(ctx: RuleContext): ShenShaRuleMap {
  const { zhi, pillarIndex, nianGan, nianZhi, riGan, riZhi, pillarGZ, cdz, zhiIdx, variants } = ctx;
  const yangRenMap = getYangRenMap(variants.yangRenMode === 'include-yin-ren');
  const forwardBranch = (branch: string, offset: number) => {
    const index = zhiIdx(branch);
    if (index < 0 || cdz.length === 0) return '';
    const targetIndex = (((index + offset) % cdz.length) + cdz.length) % cdz.length;
    return cdz[targetIndex];
  };
  const mingWeiMaPillar = (stem: string, branch: string) => {
    const target = `${FOOD_GOD_BY_STEM[stem] ?? ''}${YI_MA_BY_BRANCH[branch] ?? ''}`;
    return SIXTY_CYCLE.includes(target) ? target : '';
  };

  return {
    禄神: () => {
      return LU_BRANCH_BY_STEM[riGan] === zhi;
    },
    // 下列禄、马衍生规则采用《五行精纪》的年命旧法：“甲人”等以年干起例，
    // “寅午戌人”等以年支起例，目标只查生月、生日、生时，不再静默并入日干、日支版本。
    生成禄: () =>
      pillarIndex >= 1 && (SHENG_CHENG_LU_BY_STEM[nianGan]?.includes(pillarGZ) ?? false),
    名位禄: () => pillarIndex >= 1 && MING_WEI_LU_BY_YEAR_STEM[nianGan] === pillarGZ,
    食神带禄: () => pillarIndex >= 1 && SHI_SHEN_DAI_LU_BY_STEM[nianGan] === pillarGZ,
    禄对神: () => pillarIndex >= 1 && forwardBranch(LU_BRANCH_BY_STEM[nianGan], 6) === zhi,
    禄头财: () => pillarIndex >= 1 && LU_TOU_CAI_BY_STEM[nianGan] === pillarGZ,
    禄头鬼: () => pillarIndex >= 1 && LU_TOU_GUI_BY_STEM[nianGan] === pillarGZ,
    刃头财: () => pillarIndex >= 1 && REN_TOU_CAI_BY_STEM[nianGan] === pillarGZ,
    刃头鬼: () => pillarIndex >= 1 && REN_TOU_GUI_BY_STEM[nianGan] === pillarGZ,
    库头财: () => pillarIndex >= 1 && KU_TOU_CAI_BY_STEM[nianGan] === pillarGZ,
    库头鬼: () => pillarIndex >= 1 && KU_TOU_GUI_BY_STEM[nianGan] === pillarGZ,
    羊刃: () => {
      return yangRenMap[riGan] === zhi;
    },
    飞刃: () => {
      const yangRenZhi = yangRenMap[riGan];
      const clashMap: Record<string, string> = {
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
      const hasYangRenFeiRen = yangRenZhi ? clashMap[yangRenZhi] === zhi : false;
      return hasYangRenFeiRen;
    },
    驿马: () => {
      // 默认采用《命理探源》“以日主为主”的日支口径，不与《五行精纪》年命异法混算。
      return YI_MA_BY_BRANCH[riZhi] === zhi;
    },
    生成马: () => pillarIndex >= 1 && SHENG_CHENG_MA_BY_BRANCH[nianZhi] === pillarGZ,
    名位马: () => pillarIndex >= 1 && mingWeiMaPillar(nianGan, nianZhi) === pillarGZ,
    马财库: () => {
      const nianYiMa = YI_MA_BY_BRANCH[nianZhi];
      return pillarIndex >= 1 && MA_CAI_KU_BY_YI_MA_BRANCH[nianYiMa] === zhi;
    },
    攀鞍: () => {
      const nianYiMa = YI_MA_BY_BRANCH[nianZhi];
      return pillarIndex >= 1 && forwardBranch(nianYiMa, -1) === zhi;
    },
    马天庭: () => {
      const nianYiMa = YI_MA_BY_BRANCH[nianZhi];
      return pillarIndex >= 1 && forwardBranch(nianYiMa, 1) === zhi;
    },
    马九天: () => {
      const nianYiMa = YI_MA_BY_BRANCH[nianZhi];
      return pillarIndex >= 1 && forwardBranch(nianYiMa, -1) === zhi;
    },
    马九地: () => {
      const nianYiMa = YI_MA_BY_BRANCH[nianZhi];
      return pillarIndex >= 1 && forwardBranch(nianYiMa, -2) === zhi;
    },
    勾陈: () => pillarIndex >= 1 && (GOU_CHEN_BY_STEM[nianGan]?.includes(zhi) ?? false),
    真武: () => pillarIndex >= 1 && (ZHEN_WU_BY_STEM[nianGan]?.includes(zhi) ?? false),
    命天庭: () => pillarIndex >= 1 && forwardBranch(nianZhi, 1) === zhi,
    禄九天: () => pillarIndex >= 1 && forwardBranch(LU_BRANCH_BY_STEM[nianGan], -1) === zhi,
    离祖杀: () => pillarIndex === 3 && forwardBranch(LU_BRANCH_BY_STEM[nianGan], -1) === zhi,
    禄九地: () =>
      pillarIndex >= 1 &&
      !['戊', '己'].includes(nianGan) &&
      forwardBranch(LU_BRANCH_BY_STEM[nianGan], -2) === zhi,
    将星: () => {
      const map: Record<string, string> = {
        申: '子',
        子: '子',
        辰: '子',
        亥: '卯',
        卯: '卯',
        未: '卯',
        寅: '午',
        午: '午',
        戌: '午',
        巳: '酉',
        酉: '酉',
        丑: '酉',
      };
      return map[riZhi] === zhi;
    },
    华盖: () => {
      const map: Record<string, string> = {
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
      return map[riZhi] === zhi;
    },
    金舆: () => {
      const map: Record<string, string> = {
        甲: '辰',
        乙: '巳',
        丙: '未',
        丁: '申',
        戊: '未',
        己: '申',
        庚: '戌',
        辛: '亥',
        壬: '丑',
        癸: '寅',
      };
      // 《命理探源》明确“以日主为主”，这里只保留禄前二辰的日干版本；
      // 不与《五行精纪》的命前二辰、马前二辰年命异法混算。
      return map[riGan] === zhi;
    },
    金神: () =>
      ['乙丑', '己巳', '癸酉'].includes(pillarGZ) && (pillarIndex === 2 || pillarIndex === 3),
  };
}
