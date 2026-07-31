import { NAYIN_MAP } from '../../baziDefinitions';
import type { RuleContext, ShenShaRuleMap } from './types';

const TIAN_YI_BRANCHES_BY_DAY_STEM: Record<string, string[]> = {
  甲: ['丑', '未'],
  戊: ['丑', '未'],
  庚: ['丑', '未'],
  乙: ['子', '申'],
  己: ['子', '申'],
  丙: ['亥', '酉'],
  丁: ['亥', '酉'],
  壬: ['卯', '巳'],
  癸: ['卯', '巳'],
  辛: ['寅', '午'],
};

const TAI_JI_BRANCHES_BY_YEAR_STEM: Record<string, string[]> = {
  甲: ['子', '午'],
  乙: ['子', '午'],
  丙: ['卯', '酉'],
  丁: ['卯', '酉'],
  戊: ['辰', '戌', '丑', '未'],
  己: ['辰', '戌', '丑', '未'],
  庚: ['寅', '亥'],
  辛: ['寅', '亥'],
  壬: ['巳', '申'],
  癸: ['巳', '申'],
};

const FU_XING_GUI_PILLARS_BY_YEAR_STEM: Record<string, string[]> = {
  甲: ['甲寅', '甲子'],
  乙: ['乙丑'],
  丙: ['丙寅', '丙子'],
  丁: ['丁亥'],
  戊: ['戊申'],
  己: ['己未'],
  庚: ['庚午'],
  辛: ['辛巳'],
  壬: ['壬辰'],
  癸: ['癸丑'],
};

const TIAN_GUAN_BRANCH_BY_YEAR_STEM: Record<string, string> = {
  甲: '酉',
  乙: '申',
  丙: '子',
  丁: '亥',
  戊: '卯',
  己: '寅',
  庚: '午',
  辛: '巳',
  壬: '午',
  癸: '巳',
};

const WEN_CHANG_BRANCH_BY_YEAR_STEM: Record<string, string> = {
  甲: '巳',
  乙: '亥',
  丙: '戌',
  丁: '辰',
  戊: '申',
  己: '午',
  庚: '寅',
  辛: '未',
  壬: '卯',
  癸: '丑',
};

const WEN_XING_GUI_BRANCH_BY_YEAR_STEM: Record<string, string> = {
  甲: '午',
  乙: '巳',
  丙: '申',
  丁: '酉',
  戊: '申',
  己: '酉',
  庚: '戌',
  辛: '亥',
  壬: '寅',
  癸: '卯',
};

const OFFICIAL_ACADEMY_BRANCHES_BY_DAY_STEM: Record<string, string[]> = {
  甲: ['巳', '申'],
  乙: ['巳', '申'],
  丙: ['申', '亥'],
  丁: ['申', '亥'],
  戊: ['亥', '寅'],
  己: ['亥', '寅'],
  庚: ['寅', '巳'],
  辛: ['寅', '巳'],
  壬: ['申', '亥'],
  癸: ['申', '亥'],
};

const KE_MING_GUI_PILLARS = [
  '甲辰',
  '乙巳',
  '丙午',
  '丁未',
  '戊申',
  '己酉',
  '庚戌',
  '辛亥',
  '壬子',
  '癸丑',
];

const ZHEN_KUI_XING_PILLARS = ['甲辰', '丁未', '庚戌', '癸丑'];
const KUI_XING_PILLARS = ['丁亥', '辛卯', '庚戌'];
const WEN_XING_PILLARS = ['乙亥', '丁巳'];

const GUAN_XING_XUE_TANG_BY_STEM: Record<string, string> = {
  甲: '辛亥',
  乙: '辛亥',
  丙: '壬寅',
  丁: '壬寅',
  戊: '甲申',
  己: '甲申',
  庚: '丁巳',
  辛: '丁巳',
  壬: '戊申',
  癸: '戊申',
};

const MING_FU_MONTH_BRANCH_BY_YEAR_STEM: Record<string, string> = {
  甲: '酉',
  乙: '午',
  丙: '巳',
  丁: '辰',
  戊: '巳',
  己: '寅',
  庚: '卯',
  辛: '戌',
  壬: '亥',
  癸: '申',
};

const MING_XUE_TANG_BRANCH_BY_YEAR_BRANCH: Record<string, string> = {
  子: '亥',
  丑: '子',
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
};

const LU_XUE_TANG_BRANCH_BY_YEAR_BRANCH: Record<string, string> = {
  子: '戌',
  丑: '亥',
  寅: '子',
  卯: '丑',
  辰: '寅',
  巳: '卯',
  午: '辰',
  未: '巳',
  申: '午',
  酉: '未',
  戌: '申',
  亥: '酉',
};

const TIAN_YIN_GUI_BRANCHES_BY_YEAR_STEM: Record<string, string[]> = {
  乙: ['亥'],
  丙: ['戌'],
  丁: ['酉'],
  戊: ['申'],
  己: ['未'],
  庚: ['午'],
  辛: ['巳'],
  壬: ['辰'],
  癸: ['卯'],
};

const GUAN_GUI_TANG_BRANCH_BY_YEAR_STEM: Record<string, string> = {
  甲: '未',
  乙: '辰',
  丙: '巳',
  丁: '寅',
  己: '戌',
  庚: '亥',
  辛: '申',
  壬: '酉',
  癸: '午',
};

const SCHOLAR_PILLAR_BY_YEAR_NAYIN_ELEMENT: Record<string, string> = {
  金: '辛巳',
  木: '己亥',
  水: '甲申',
  火: '丙寅',
  土: '戊申',
};

const CI_GUAN_PILLAR_BY_YEAR_NAYIN_ELEMENT: Record<string, string> = {
  金: '壬申',
  木: '庚寅',
  水: '癸亥',
  火: '乙巳',
  土: '丁亥',
};

const TIAN_CHU_BRANCH_BY_DAY_STEM: Record<string, string> = {
  甲: '巳',
  乙: '午',
  丙: '巳',
  丁: '午',
  戊: '申',
  己: '酉',
  庚: '亥',
  辛: '子',
  壬: '寅',
  癸: '卯',
};

export function buildNobleRules(ctx: RuleContext): ShenShaRuleMap {
  const {
    gan,
    zhi,
    pillarIndex,
    nianGan,
    nianZhi,
    yueZhi,
    riGan,
    pillarGZ,
    baziArray,
    cdz,
    zhiIdx,
  } = ctx;
  const shiZhi = baziArray[3]?.[1] || '';
  const yearNayinElement = NAYIN_MAP[`${nianGan}${nianZhi}`]?.slice(-1) || '';
  const branchFromHour = (offset: number) => {
    const index = zhiIdx(shiZhi);
    return index < 0 ? '' : cdz[(index + offset + cdz.length) % cdz.length];
  };

  return {
    // 《命理探源》在天乙口诀后明确“以日主为主”，不与《五行精纪》的年命旧法混算。
    天乙贵人: () => TIAN_YI_BRANCHES_BY_DAY_STEM[riGan]?.includes(zhi) ?? false,
    // 下列“甲人、乙人、甲乙生人”均按《五行精纪》《三命通会》的年命旧法处理；
    // 年干只作为起例基准，目标只查月、日、时，不再把日干作为第二套基准静默并入。
    // 《五行精纪》主文作“壬巳癸申”，同时明载“一作壬癸巳申”；《三命通会》
    // 以水生于申、纳于巳解释后一版本。这里明确采用后一完整版本，不把两版拼成新表。
    太极贵人: () =>
      pillarIndex >= 1 && (TAI_JI_BRANCHES_BY_YEAR_STEM[nianGan]?.includes(zhi) ?? false),
    天德贵人: () => {
      const targetByMonthBranch: Record<string, string> = {
        寅: '丁',
        辰: '壬',
        巳: '辛',
        午: '亥',
        未: '甲',
        申: '癸',
        戌: '丙',
        亥: '乙',
        子: '巳',
        丑: '庚',
      };
      // 二月“坤”、八月“艮”在《渊海子平》《考原》中落支解释不同，默认不选边。
      const target = targetByMonthBranch[yueZhi];
      return pillarIndex >= 2 && (target === gan || target === zhi);
    },
    天德合: () => {
      const dayStemByMonthBranch: Record<string, string> = {
        寅: '壬',
        辰: '丁',
        巳: '丙',
        未: '己',
        申: '戊',
        戌: '辛',
        亥: '庚',
        丑: '乙',
      };
      // 《五行精纪》所引《三历会同》只列上述八月的“天德合日”，其余四月不推值。
      return pillarIndex === 2 && dayStemByMonthBranch[yueZhi] === gan;
    },
    月德贵人: () => {
      const map: Record<string, string> = {
        寅: '丙',
        午: '丙',
        戌: '丙',
        申: '壬',
        子: '壬',
        辰: '壬',
        亥: '甲',
        卯: '甲',
        未: '甲',
        巳: '庚',
        酉: '庚',
        丑: '庚',
      };
      return pillarIndex >= 2 && map[yueZhi] === gan;
    },
    月德合: () => {
      const yueDeGan: string = (
        {
          寅: '丙',
          午: '丙',
          戌: '丙',
          申: '壬',
          子: '壬',
          辰: '壬',
          亥: '甲',
          卯: '甲',
          未: '甲',
          巳: '庚',
          酉: '庚',
          丑: '庚',
        } as Record<string, string>
      )[yueZhi];
      const heGanMap: Record<string, string> = {
        甲: '己',
        乙: '庚',
        丙: '辛',
        丁: '壬',
        戊: '癸',
        己: '甲',
        庚: '乙',
        辛: '丙',
        壬: '丁',
        癸: '戊',
      };
      return pillarIndex >= 2 && heGanMap[yueDeGan] === gan;
    },
    月空: () => {
      const map: Record<string, string> = {
        寅: '壬',
        午: '壬',
        戌: '壬',
        亥: '庚',
        卯: '庚',
        未: '庚',
        申: '丙',
        子: '丙',
        辰: '丙',
        巳: '甲',
        酉: '甲',
        丑: '甲',
      };
      // 与同章天德、月德一致，月令只作起例，“日为引，时为用”，不回标年柱或月柱。
      return pillarIndex >= 2 && map[yueZhi] === gan;
    },
    // 《五行精纪》原文示例为“甲人见甲寅或甲子”等同干完整柱，旧实现误换成食神干支。
    福星贵人: () =>
      pillarIndex >= 1 && (FU_XING_GUI_PILLARS_BY_YEAR_STEM[nianGan]?.includes(pillarGZ) ?? false),
    // 此表采用《五行精纪》“阴官贵，一名天官贵，又名文星贵”条；下方“文星贵”
    // 采用该书另立标题且《三命通会》互证的十干表，两条分名保留，不按别名合并。
    天官贵人: () => pillarIndex >= 1 && TIAN_GUAN_BRANCH_BY_YEAR_STEM[nianGan] === zhi,
    文昌贵人: () => pillarIndex >= 1 && WEN_CHANG_BRANCH_BY_YEAR_STEM[nianGan] === zhi,
    文星贵: () => pillarIndex >= 1 && WEN_XING_GUI_BRANCH_BY_YEAR_STEM[nianGan] === zhi,
    // 甲干在现存文本中分别作“甲在子寅中”“甲子在寅中”“甲在子宫中”，
    // 无法确认是双支、单支还是甲子年限定；其余九干有稳定互证，甲干失败关闭。
    天印贵人: () =>
      pillarIndex >= 1 && (TIAN_YIN_GUI_BRANCHES_BY_YEAR_STEM[nianGan]?.includes(zhi) ?? false),
    // 《五行精纪》同书的戊干分别转录为午、牛（丑）与“土中”，无法稳定互证；
    // 只保留其余九干一致表，戊干失败关闭。
    官贵堂: () => pillarIndex >= 1 && GUAN_GUI_TANG_BRANCH_BY_YEAR_STEM[nianGan] === zhi,
    // 《五行精纪》以生时为起例：“前五辰为天奇，后五辰为天宝”；
    // 生时只作基准，目标查年、月、日，不能把时柱自身回标成目标。
    天奇: () => pillarIndex <= 2 && branchFromHour(5) === zhi,
    天宝: () => pillarIndex <= 2 && branchFromHour(-5) === zhi,
    科名贵: () => pillarIndex >= 2 && KE_MING_GUI_PILLARS.includes(pillarGZ),
    魁星: () => pillarIndex >= 2 && KUI_XING_PILLARS.includes(pillarGZ),
    文星: () => pillarIndex >= 2 && WEN_XING_PILLARS.includes(pillarGZ),
    真魁星: () => pillarIndex >= 2 && ZHEN_KUI_XING_PILLARS.includes(pillarGZ),
    岁窠: () => pillarIndex === 1 && zhi === nianZhi,
    名福: () => pillarIndex === 1 && MING_FU_MONTH_BRANCH_BY_YEAR_STEM[nianGan] === zhi,
    命学堂: () => pillarIndex >= 1 && MING_XUE_TANG_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi,
    禄学堂: () => pillarIndex >= 1 && LU_XUE_TANG_BRANCH_BY_YEAR_BRANCH[nianZhi] === zhi,
    // 现有固定表只见于《张果星宗》的星命宫位法，不能移作八字四柱横取，故失败关闭。
    国印贵人: () => false,
    // 《三命通会》正学堂、词馆均须同时满足年命纳音五行、长生/临官支、目标柱同纳音；
    // 这里只保留该完整版本，不混入只看年干或日干地支的简化表。
    学堂: () =>
      pillarIndex >= 1 && SCHOLAR_PILLAR_BY_YEAR_NAYIN_ELEMENT[yearNayinElement] === pillarGZ,
    词馆: () =>
      pillarIndex >= 1 && CI_GUAN_PILLAR_BY_YEAR_NAYIN_ELEMENT[yearNayinElement] === pillarGZ,
    // 《神峰通考》明言“甲乙日生人”，并把官星长生、临官两支合称官贵学馆；
    // 采用该日主版本，不与《三命通会》的年命官贵学堂、官贵词馆分项静默混算。
    官贵学馆: () => OFFICIAL_ACADEMY_BRANCHES_BY_DAY_STEM[riGan]?.includes(zhi) ?? false,
    官星学堂: () => pillarIndex >= 1 && GUAN_XING_XUE_TANG_BY_STEM[nianGan] === pillarGZ,
    // 原文只明列甲、乙、丙、丁四例并以“之类”收束，旧表其余项含非六十甲子和无来源推值；
    // 在完整十干表及推法未获可靠文本前，不输出一个看似完整但实际残缺的算法。
    食神学堂: () => false,
    // 《神峰通考》以日主食神见禄解释“天厨食神”，采用日干版本，不混入年命异法。
    天厨贵人: () => TIAN_CHU_BRANCH_BY_DAY_STEM[riGan] === zhi,
    德秀贵人: () => {
      // 来源：《三命通会》卷三《论德秀》。
      const deXiuMap: Record<string, { de: string[]; xiu: string[] }> = {
        寅: { de: ['丙', '丁'], xiu: ['戊', '癸'] },
        午: { de: ['丙', '丁'], xiu: ['戊', '癸'] },
        戌: { de: ['丙', '丁'], xiu: ['戊', '癸'] },
        申: { de: ['壬', '癸', '戊', '己'], xiu: ['丙', '辛', '甲', '己'] },
        子: { de: ['壬', '癸', '戊', '己'], xiu: ['丙', '辛', '甲', '己'] },
        辰: { de: ['壬', '癸', '戊', '己'], xiu: ['丙', '辛', '甲', '己'] },
        巳: { de: ['庚', '辛'], xiu: ['乙', '庚'] },
        酉: { de: ['庚', '辛'], xiu: ['乙', '庚'] },
        丑: { de: ['庚', '辛'], xiu: ['乙', '庚'] },
        亥: { de: ['甲', '乙'], xiu: ['丁', '壬'] },
        卯: { de: ['甲', '乙'], xiu: ['丁', '壬'] },
        未: { de: ['甲', '乙'], xiu: ['丁', '壬'] },
      };
      const config = deXiuMap[yueZhi];
      if (!config) return false;
      const allGans = baziArray.map(([currentGan]) => currentGan);
      const hasDe = config.de.some((d) => allGans.includes(d));
      const hasXiu = config.xiu.some((s) => allGans.includes(s));
      const isDeOrXiu = config.de.includes(gan) || config.xiu.includes(gan);
      return hasDe && hasXiu && isDeOrXiu;
    },
  };
}
