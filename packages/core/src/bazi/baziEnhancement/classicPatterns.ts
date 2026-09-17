/**
 * @file 经典格局库与识别函数
 * @description 八字经典格局体系扩充，按《渊海子平》《三命通会》《子平真诠》收录传统外格。
 * @古籍依据 《渊海子平》卷二"论外格"、《三命通会》卷六"论诸格"
 *
 * 格局分类：
 * - 专旺格：曲直(木)/炎上(火)/稼穑(土)/从革(金)/润下(水)
 * - 化气格：甲己化土/乙庚化金/丙辛化水/丁壬化木/戊癸化火
 * - 特殊结构：金神/日贵/日德/福德秀气/子午双包
 * - 逸格局：井栏叉格/壬骑龙背/六阴朝阳/飞天禄马等
 */

import type { BaziChartResult, Wuxing } from '../baziTypes';
import { checkCondition } from '../baziConditionMatchers';
import { collectEstablishedBranchFormations } from '../baziFormationUtils';
import { HIDDEN_STEMS } from '../baziMappingsData';
import { assessStemHarmonyTransform } from '../harmonyTransform';
import { HEAVENLY_STEMS } from '../../ganzhi/data';
import { assessQuzhiPattern } from '../baziQuzhiStrategy';

export interface ClassicPattern {
  id: string;
  name: string;
  description: string;
  conditions: {
    dayStems?: string[];
    monthBranch?: string[];
    otherConditions?: string[];
    anyConditions?: string[];
    exactMonthBranchMap?: Record<string, string>;
    establishedFormationWuxing?: Wuxing;
    excludePatterns?: string[];
  };
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  level: '极品' | '上等' | '中等';
  source?: {
    title: string;
    quote: string;
    url: string;
  };
}

export type ClassicPatternCandidateStatus = '结构命中' | '待核验' | '存在反证';

/**
 * 经典目录的结构命中结果。
 *
 * `pattern.level` 是古籍目录中的传统等级参考，不表示当前命盘已经成格；
 * `status`、条件与事实用于把结构候选和本盘成败分开。
 */
export interface ClassicPatternCandidate {
  pattern: ClassicPattern;
  status: ClassicPatternCandidateStatus;
  matchedConditions: string[];
  verificationFacts: string[];
  pendingConditions: string[];
  counterEvidence: string[];
}

const CLASSIC_PATTERNS: ClassicPattern[] = [
  {
    id: 'lu-ren-yang',
    name: '阳刃格',
    description:
      '甲羊刃在卯，丙戊羊刃在午，庚羊刃在酉，壬羊刃在子。阴干不论阳刃。羊刃帮身有力，但需官杀制伏方为贵。',
    conditions: {
      dayStems: ['甲', '丙', '戊', '庚', '壬'],
      monthBranch: ['卯', '午', '酉', '子'],
      exactMonthBranchMap: { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' },
      otherConditions: ['羊刃透出', '羊刃当令'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['官', '杀'],
    unfavorableWuxing: ['刃', '比'],
    level: '上等',
  },
  {
    id: 'lu-ren-lu',
    name: '建禄格',
    description: '日干与月支同气，如甲木生寅月。建禄自旺，不祖则兄，主辛苦创业。',
    conditions: {
      dayStems: [...HEAVENLY_STEMS],
      monthBranch: ['寅', '卯', '巳', '午', '申', '酉', '亥', '子'],
      exactMonthBranchMap: {
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
      },
      otherConditions: ['日干与月支同气', '月令司权'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['财', '官', '食'],
    unfavorableWuxing: ['印', '比'],
    level: '中等',
  },

  {
    id: 'jin-shen-jia',
    name: '金神格',
    description:
      '甲日生，时柱为乙丑、己巳或癸酉，构成金神格的基本结构。古籍以火制金神为成格关键，明言喜火乡、惧水乡，原局与岁运的火水制化决定成败。',
    conditions: {
      dayStems: ['甲'],
      anyConditions: ['时柱为乙丑', '时柱为己巳', '时柱为癸酉'],
    },
    favorableWuxing: ['火'],
    unfavorableWuxing: ['水'],
    level: '上等',
    source: {
      title: '《渊海子平·论金神》',
      quote: '金神乃破败之神，要制伏，入火乡为胜；惧水乡，则非福矣。',
      url: 'https://zh.wikisource.org/wiki/淵海子平',
    },
  },
  {
    id: 'jin-shen-ji',
    name: '金神格',
    description:
      '己日生乙丑、己巳、癸酉三时，为金神格的基本结构。古籍另有“己日金神何劳火制”之辨，己日不能照搬甲日一概定为喜火或忌水，须结合身旺与金气轻重裁定。',
    conditions: {
      dayStems: ['己'],
      anyConditions: ['时柱为乙丑', '时柱为己巳', '时柱为癸酉'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    level: '上等',
    source: {
      title: '《三命通会·卷六》',
      quote: '甲日金神偏宜火地，己日金神何劳火制。',
      url: 'https://zh.wikisource.org/wiki/三命通會/卷六',
    },
  },

  {
    id: 'jing-lan-cha',
    name: '井栏叉格',
    description: '庚日地支申子辰全，取水局暗冲寅午戌中财官印。忌丙丁巳午填实破局。',
    conditions: {
      dayStems: ['庚'],
      otherConditions: ['申子辰三合水局', '不见天干丙', '不见天干丁', '不见地支巳', '不见地支午'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['火', '土'],
    level: '极品',
  },

  {
    id: 'ren-qi-long',
    name: '壬骑龙背格',
    description: '壬辰日生，地支多辰，取辰多冲戌中官星。忌戌字填实冲破。',
    conditions: {
      dayStems: ['壬'],
      otherConditions: ['日柱为壬辰', '地支多辰', '不见地支戌'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['土', '戌'],
    level: '极品',
  },

  {
    id: 'liu-yin-chao-yang',
    name: '六阴朝阳格',
    description: '辛日见戊子时，取子位一阳来复。忌午冲子，忌丙丁火出干填实。',
    conditions: {
      dayStems: ['辛'],
      otherConditions: ['时柱为戊子', '不见地支午', '不见天干丙', '不见天干丁'],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['火', '午'],
    level: '上等',
  },

  {
    id: 'run-xia',
    name: '润下格',
    description: '壬癸日见亥子丑三会水局或申子辰三合水局，水势泛滥。忌土来制水，喜木泄水为用。',
    conditions: {
      dayStems: ['壬', '癸'],
      establishedFormationWuxing: '水',
      // 三会与三合为择一成立；四柱只有四支，逐项同时要求五支不可能命中
      anyConditions: ['亥子丑三会水局', '申子辰三合水局'],
      otherConditions: ['水势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['木', '火'],
    unfavorableWuxing: ['土'],
    level: '极品',
  },

  {
    id: 'yan-shang',
    name: '炎上格',
    description: '丙丁日见巳午未三会火局。火势炎上，忌水来破局，喜木火相助。',
    conditions: {
      dayStems: ['丙', '丁'],
      establishedFormationWuxing: '火',
      otherConditions: ['巳午未三会火局', '火势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['木', '火'],
    unfavorableWuxing: ['水'],
    level: '极品',
  },

  {
    id: 'cong-ge',
    name: '从革格',
    description: '庚辛日见申酉戌三会金局。金气纯粹，忌火来克金，喜土金相助。',
    conditions: {
      dayStems: ['庚', '辛'],
      establishedFormationWuxing: '金',
      otherConditions: ['申酉戌三会金局', '金势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['土', '金'],
    unfavorableWuxing: ['火', '木'],
    level: '极品',
  },

  {
    id: 'qu-zhi',
    name: '曲直格',
    description:
      '甲乙日以亥卯未局全，或春生寅卯辰全而无间断破坏立曲直；采用《神峰通考》所引《格解》的严格口径核庚辛透藏，并按张楠按语核局外支直接冲破。水木顺势、火可泄秀，土财按实际作用另论。',
    conditions: {
      dayStems: ['甲', '乙'],
      anyConditions: ['亥卯未三合木局', '寅卯辰三会木局'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['水', '木', '火'],
    unfavorableWuxing: ['金'],
    level: '极品',
    source: {
      title: '《三命通会·卷六》曲直格',
      quote: '甲乙日得亥卯未局，柱中须有亥字带印为入格；甲乙生人寅卯辰，又名仁寿；亥卯未全嫌白帝。',
      url: 'https://zh.wikisource.org/w/index.php?title=三命通會_(四庫全書本)/卷06&oldid=657375',
    },
  },

  {
    id: 'jia-se',
    name: '稼穑格',
    description: '戊己日见辰戌丑未全局。土性厚重，忌木来克土，喜火土相助。',
    conditions: {
      dayStems: ['戊', '己'],
      otherConditions: ['辰戌丑未全', '土势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['火', '土'],
    unfavorableWuxing: ['木', '水'],
    level: '极品',
  },

  {
    id: 'fei-tian-lu-ma-geng',
    name: '飞天禄马格',
    description: '庚子日地支多子，暗冲午中丁火为官、己土为印。忌丑绊、午冲及丁己填实。',
    conditions: {
      dayStems: ['庚'],
      otherConditions: [
        '日柱为庚子',
        '地支多子',
        '不见地支丑',
        '不见地支午',
        '不见天干丁',
        '不见天干己',
      ],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['火', '土'],
    level: '极品',
  },

  {
    id: 'fei-tian-lu-ma-ren',
    name: '飞天禄马格',
    description: '壬子日地支多子，暗冲午中丁火为财、己土为官。忌丑绊、午冲及丁己填实。',
    conditions: {
      dayStems: ['壬'],
      otherConditions: [
        '日柱为壬子',
        '地支多子',
        '不见地支丑',
        '不见地支午',
        '不见天干丁',
        '不见天干己',
      ],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['火', '土'],
    level: '极品',
  },

  {
    id: 'liu-yi-shu-gui',
    name: '六乙鼠贵格',
    description:
      '乙日见丙子时，为六乙鼠贵的基本结构；须避午冲、丑绊、卯刑，并避申庚、酉辛显露破格。月令另有财官印可取时，仍应先按正常格局论。',
    conditions: {
      dayStems: ['乙'],
      otherConditions: [
        '时柱为丙子',
        '不见地支午',
        '不见地支丑',
        '不见地支卯',
        '不见地支申',
        '不见地支酉',
        '不见天干庚',
        '不见天干辛',
      ],
    },
    favorableWuxing: [],
    unfavorableWuxing: ['午', '丑', '卯', '申', '酉', '庚', '辛'],
    level: '上等',
    source: {
      title: '《三命通会·卷六》',
      quote: '乙木生临丙子时，要无午破卯刑之；乙日生人得子时，名为鼠贵最为奇。',
      url: 'https://zh.wikisource.org/wiki/三命通會/卷六',
    },
  },

  {
    id: 'dao-chong-bing',
    name: '倒冲格',
    description:
      '丙日见午多或丁日见巳多，火势极旺，反冲子水为官。忌壬癸亥子填实，喜火旺助冲。主异路功名。',
    conditions: {
      dayStems: ['丙'],
      otherConditions: ['地支多午'],
    },
    favorableWuxing: ['火', '木'],
    unfavorableWuxing: ['水'],
    level: '上等',
  },

  {
    id: 'dao-chong-ding',
    name: '倒冲格',
    description:
      '丙日见午多或丁日见巳多，火势极旺，反冲子水为官。忌壬癸亥子填实，喜火旺助冲。主异路功名。',
    conditions: {
      dayStems: ['丁'],
      otherConditions: ['地支多巳'],
    },
    favorableWuxing: ['火', '木'],
    unfavorableWuxing: ['水'],
    level: '上等',
  },

  {
    id: 'hua-qi-tu',
    name: '甲己化土格',
    description:
      '甲己合化土，月令辰戌丑未土旺之地，天干甲己同透，甲己不重出争合妒合破局。化气纯粹则贵，喜火土生扶，忌木克土破化。',
    conditions: {
      dayStems: ['甲', '己'],
      monthBranch: ['辰', '戌', '丑', '未'],
      otherConditions: ['甲己同透', '无甲己争合'],
    },
    favorableWuxing: ['火', '土'],
    unfavorableWuxing: ['木', '水'],
    level: '极品',
  },
  {
    id: 'hua-qi-jin',
    name: '乙庚化金格',
    description:
      '乙庚合化金，月令巳酉丑或申酉戌金旺之地，天干乙庚同透，乙庚不重出争合妒合破局。化气纯粹则贵，喜土金生扶，忌火克金破化。',
    conditions: {
      dayStems: ['乙', '庚'],
      monthBranch: ['巳', '酉', '丑', '申', '戌'],
      otherConditions: ['乙庚同透', '无乙庚争合'],
    },
    favorableWuxing: ['土', '金'],
    unfavorableWuxing: ['火', '木'],
    level: '极品',
  },
  {
    id: 'hua-qi-shui',
    name: '丙辛化水格',
    description:
      '丙辛合化水，月令申子辰或亥子丑水旺之地，天干丙辛同透，丙辛不重出争合妒合破局。化气纯粹则贵，喜金水生扶，忌土克水破化。',
    conditions: {
      dayStems: ['丙', '辛'],
      monthBranch: ['申', '子', '辰', '亥', '丑'],
      otherConditions: ['丙辛同透', '无丙辛争合'],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['土', '火'],
    level: '极品',
  },
  {
    id: 'hua-qi-mu',
    name: '丁壬化木格',
    description:
      '丁壬合化木，月令亥卯未或寅卯辰木旺之地，天干丁壬同透，丁壬不重出争合妒合破局。化气纯粹则贵，喜水木生扶，忌金克木破化。',
    conditions: {
      dayStems: ['丁', '壬'],
      monthBranch: ['亥', '卯', '未', '寅', '辰'],
      otherConditions: ['丁壬同透', '无丁壬争合'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['金', '土'],
    level: '极品',
  },
  {
    id: 'hua-qi-huo',
    name: '戊癸化火格',
    description:
      '戊癸合化火，月令寅午戌或巳午未火旺之地，天干戊癸同透，戊癸不重出争合妒合破局。化气纯粹则贵，喜木火生扶，忌水克火破化。',
    conditions: {
      dayStems: ['戊', '癸'],
      monthBranch: ['寅', '午', '戌', '巳', '未'],
      otherConditions: ['戊癸同透', '无戊癸争合'],
    },
    favorableWuxing: ['木', '火'],
    unfavorableWuxing: ['水', '金'],
    level: '极品',
  },
  {
    id: 'ri-gui',
    name: '日贵格',
    description:
      '日贵只有丁酉、丁亥、癸巳、癸卯四日。古籍另分昼夜：癸卯、丁亥宜日生，癸巳、丁酉宜夜生；昼夜取法还需结合出生时刻，刑冲破害等影响需结合全盘核对。',
    conditions: {
      dayStems: ['丁', '癸'],
      anyConditions: ['日柱为丁酉', '日柱为丁亥', '日柱为癸巳', '日柱为癸卯'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    level: '上等',
    source: {
      title: '《三命通会·卷六》',
      quote: '此格只有四日：丁酉、丁亥、癸巳、癸卯。日生要癸卯、丁亥，夜生要癸巳、丁酉。',
      url: 'https://zh.wikisource.org/wiki/三命通會/卷六',
    },
  },
  {
    id: 'ri-de',
    name: '日德格',
    description: '甲寅、丙辰、戊辰、庚辰、壬戌五日生人。日德入命，传统多取象为性格敦厚宽仁。',
    conditions: {
      dayStems: ['甲', '丙', '戊', '庚', '壬'],
      anyConditions: ['日柱为甲寅', '日柱为丙辰', '日柱为戊辰', '日柱为庚辰', '日柱为壬戌'],
    },
    favorableWuxing: ['印', '食'],
    unfavorableWuxing: ['伤', '杀'],
    level: '上等',
  },
  {
    id: 'fu-de',
    name: '福德秀气格',
    description:
      '福德秀气专取乙、丁、己、辛、癸五阴干，日支坐巳、酉、丑之一，并须四柱会齐巳酉丑金局；各日干的成败与喜忌，仍按对应原局与岁运核定。',
    conditions: {
      dayStems: ['乙', '丁', '己', '辛', '癸'],
      anyConditions: [
        '日柱为乙巳',
        '日柱为乙酉',
        '日柱为乙丑',
        '日柱为丁巳',
        '日柱为丁酉',
        '日柱为丁丑',
        '日柱为己巳',
        '日柱为己酉',
        '日柱为己丑',
        '日柱为辛巳',
        '日柱为辛酉',
        '日柱为辛丑',
        '日柱为癸巳',
        '日柱为癸酉',
        '日柱为癸丑',
      ],
      otherConditions: ['巳酉丑三合金局'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    level: '中等',
    source: {
      title: '《三命通会·卷六》',
      quote: '此格专以巳酉丑金局而看所得天干。',
      url: 'https://zh.wikisource.org/wiki/三命通會/卷六',
    },
  },
  {
    id: 'zi-wu-shuang-bao',
    name: '子午双包格',
    description:
      '四柱须同时见子、午，并构成两子包一午、两午包一子或两子两午；只有两个子或只有两个午均不成格，须按上述支数结构成立。',
    conditions: {
      dayStems: [...HEAVENLY_STEMS],
      otherConditions: ['子午双包'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    level: '上等',
    source: {
      title: '《三命通会·卷六》',
      quote: '或两子两午，或两午包一子，或两子包一午。',
      url: 'https://zh.wikisource.org/wiki/三命通會/卷六',
    },
  },
];

const CLASSIC_PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
type ClassicPillarKey = (typeof CLASSIC_PILLAR_KEYS)[number];
const CLASSIC_PILLAR_LABELS: Record<ClassicPillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

function hasCompletePillars(pillars: BaziChartResult['pillars']): boolean {
  return CLASSIC_PILLAR_KEYS.every((key) => Boolean(pillars?.[key]?.gan && pillars?.[key]?.zhi));
}

function resolveHiddenStems(
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
  key: ClassicPillarKey,
): string[] {
  const supplied = hiddenStems?.[key];
  return supplied?.length ? [...supplied] : [...(HIDDEN_STEMS[pillars[key].zhi] ?? [])];
}

function getHarmonyPillars(
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
) {
  return CLASSIC_PILLAR_KEYS.map((label) => ({
    label: CLASSIC_PILLAR_LABELS[label],
    gan: pillars[label].gan,
    zhi: pillars[label].zhi,
    hiddenStems: resolveHiddenStems(pillars, hiddenStems, label),
  }));
}

function formatMatchedCondition(condition: string): string {
  if (/势旺盛|当令|月令司权/.test(condition)) {
    return `结构出现条件“${condition}”（旺衰仍需结合整盘核对）`;
  }
  return `结构条件“${condition}”`;
}

function matchClassicPatternConditions(
  pattern: ClassicPattern,
  dayStem: string,
  monthBranch: string,
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
  currentPattern?: string,
): string[] | null {
  if (pattern.id === 'qu-zhi') {
    const assessment = assessQuzhiPattern(pillars);
    return assessment.structuralMatch ? [...assessment.matchedConditions] : null;
  }

  const matchedConditions: string[] = [];

  if (pattern.conditions.dayStems) {
    if (!pattern.conditions.dayStems.includes(dayStem)) return null;
    matchedConditions.push(`日干${dayStem}满足候选范围`);
  }

  if (pattern.conditions.monthBranch) {
    if (!pattern.conditions.monthBranch.includes(monthBranch)) return null;
    matchedConditions.push(`月支${monthBranch}满足候选范围`);
  }

  if (pattern.conditions.exactMonthBranchMap) {
    const requiredBranch = pattern.conditions.exactMonthBranchMap[dayStem];
    if (!requiredBranch || monthBranch !== requiredBranch) return null;
    matchedConditions.push(`日干${dayStem}与月支${monthBranch}映射满足`);
  }

  if (pattern.conditions.excludePatterns && currentPattern) {
    if (pattern.conditions.excludePatterns.includes(currentPattern)) return null;
  }

  if (pattern.conditions.establishedFormationWuxing) {
    const established = collectEstablishedBranchFormations(pillars).filter(
      (formation) => formation.wuxing === pattern.conditions.establishedFormationWuxing,
    );
    if (!established.length) return null;
    matchedConditions.push(
      `已见得月令且未被局外支冲破的${pattern.conditions.establishedFormationWuxing}会合`,
    );
  }

  if (pattern.conditions.otherConditions) {
    for (const condition of pattern.conditions.otherConditions) {
      if (!checkCondition(condition, dayStem, pillars, hiddenStems)) return null;
      matchedConditions.push(formatMatchedCondition(condition));
    }
  }

  if (pattern.conditions.anyConditions) {
    const matchedAny = pattern.conditions.anyConditions.filter((condition) =>
      checkCondition(condition, dayStem, pillars, hiddenStems),
    );
    if (!matchedAny.length) return null;
    matchedConditions.push(`任一条件命中：${matchedAny.map(formatMatchedCondition).join('、')}`);
  }

  return matchedConditions;
}

function getVisibleStems(pillars: BaziChartResult['pillars']): string[] {
  return CLASSIC_PILLAR_KEYS.map((key) => pillars[key].gan);
}

function getHiddenStemPositions(
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
  stems: string[],
): string[] {
  return CLASSIC_PILLAR_KEYS.filter((key) =>
    resolveHiddenStems(pillars, hiddenStems, key).some((stem) => stems.includes(stem)),
  ).map((key) => CLASSIC_PILLAR_LABELS[key]);
}

function getHuaQiPartner(
  pattern: ClassicPattern,
  pillars: BaziChartResult['pillars'],
): { stem: string; pillar: 'month' | 'hour' } | null {
  if (!pattern.id.startsWith('hua-qi-')) return null;
  const pair = pattern.conditions.dayStems ?? [];
  const dayStem = pillars.day.gan;
  const partner = pair.find((stem) => stem !== dayStem);
  if (!partner) return null;
  const pillar =
    pillars.month.gan === partner ? 'month' : pillars.hour.gan === partner ? 'hour' : null;
  return pillar ? { stem: partner, pillar } : null;
}

function evaluateClassicPatternCandidate(
  pattern: ClassicPattern,
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
): Omit<ClassicPatternCandidate, 'pattern' | 'matchedConditions' | 'status'> {
  if (pattern.id === 'qu-zhi') {
    const assessment = assessQuzhiPattern(pillars);
    return {
      verificationFacts: [...assessment.evidence],
      pendingConditions: [],
      counterEvidence: [...assessment.blockers],
    };
  }

  const verificationFacts: string[] = [];
  const pendingConditions: string[] = [];
  const counterEvidence: string[] = [];
  const visibleStems = getVisibleStems(pillars);

  const huaQiPartner = getHuaQiPartner(pattern, pillars);
  if (huaQiPartner) {
    pendingConditions.push('化气纯粹、全局成败与岁运仍需另行核验');
    const profile = assessStemHarmonyTransform(
      pillars.day.gan,
      CLASSIC_PILLAR_LABELS.day,
      huaQiPartner.stem,
      CLASSIC_PILLAR_LABELS[huaQiPartner.pillar],
      pillars.month.zhi,
      getHarmonyPillars(pillars, hiddenStems),
    );
    verificationFacts.push(
      `天干五合核验：${profile.level}；化神${profile.transformElement}；${profile.evidence.join('、')}`,
    );
    if (!profile.isTransformed) {
      counterEvidence.push(`天干五合当前为${profile.level}，不能直接按成化处理`);
    }
    if (profile.evidence.some((item) => item.includes('作为阻化证据'))) {
      counterEvidence.push('参与合干仍见根气，存在阻化证据');
    }
    if (profile.hasClashBreak) counterEvidence.push('参与合干见天干冲破，存在破合证据');
    if (profile.hasControllingElement) counterEvidence.push('原局见克制化神的五行，存在制化反证');
    if (profile.hasCompetition) counterEvidence.push('原局见争合，合意不专');

    if (pattern.id === 'hua-qi-tu' && visibleStems.includes('乙')) {
      counterEvidence.push(
        '另见乙透干：按《渊海子平》“有一个乙字露出，谓之妒合，为破格不成”；不同化气版本仍需并列核验',
      );
    }
  }

  if (pattern.id === 'jin-shen-jia') {
    pendingConditions.push('甲日金神火制强弱与岁运仍需结合全局核验');
    const fireVisible = visibleStems.filter((stem) => ['丙', '丁'].includes(stem));
    const fireHidden = getHiddenStemPositions(pillars, hiddenStems, ['丙', '丁']);
    const waterVisible = visibleStems.filter((stem) => ['壬', '癸'].includes(stem));
    const waterHidden = getHiddenStemPositions(pillars, hiddenStems, ['壬', '癸']);
    verificationFacts.push(
      `甲日金神火制事实：${fireVisible.length ? `透${fireVisible.join('、')}` : '未透丙丁'}；${fireHidden.length ? `支藏于${fireHidden.join('、')}` : '未见丙丁藏根'}`,
    );
    verificationFacts.push(
      `甲日金神水乡事实：${waterVisible.length ? `透${waterVisible.join('、')}` : '未透壬癸'}；${waterHidden.length ? `支藏于${waterHidden.join('、')}` : '未见壬癸藏根'}`,
    );
    if (!fireVisible.length && !fireHidden.length) {
      pendingConditions.push('古籍所说火制金神的原局证据未见');
    }
    if (waterVisible.length || waterHidden.length) {
      counterEvidence.push('原局见水干或水根，需核对金神“惧水乡”的破格反证');
    }
  }

  if (pattern.id === 'jin-shen-ji') {
    verificationFacts.push('己日金神不照搬甲日火制规则，仍需结合身旺与金气轻重核验');
    pendingConditions.push('己日金神的身旺、金气轻重与喜忌仍待核验');
  }

  if (pattern.id === 'dao-chong-bing' || pattern.id === 'dao-chong-ding') {
    const fillStems = visibleStems.filter((stem) => ['壬', '癸'].includes(stem));
    const fillBranches = CLASSIC_PILLAR_KEYS.filter((key) =>
      ['亥', '子'].includes(pillars[key].zhi),
    ).map((key) => `${CLASSIC_PILLAR_LABELS[key]}${pillars[key].zhi}`);
    verificationFacts.push(
      `倒冲填实事实：${fillStems.length ? `见${fillStems.join('、')}` : '未见壬癸透干'}；${fillBranches.length ? `见${fillBranches.join('、')}` : '未见亥子支'}`,
    );
    if (fillStems.length || fillBranches.length) {
      counterEvidence.push('原局见壬癸亥子填实所冲之官，存在破冲反证');
    }
    pendingConditions.push('倒冲支数动力与全局成败仍需结合旺衰核验');
  }

  if (pattern.id === 'jing-lan-cha') {
    const establishedWater = collectEstablishedBranchFormations(pillars).filter(
      (formation) => formation.wuxing === '水',
    );
    verificationFacts.push(
      establishedWater.length
        ? `申子辰三支齐全，月令状态为${establishedWater.map((formation) => formation.monthStatus).join('、')}且未见局外支冲破`
        : '申子辰三支齐全，但未形成得月令且无局外支冲破的成势条件',
    );
    if (!establishedWater.length) {
      pendingConditions.push('井栏叉格的得令成势与庚金乘旺仍待核验');
    }
    pendingConditions.push('井栏叉格的暗冲取用与局外破局仍待核验');
  }

  if (pattern.id === 'ri-gui') {
    pendingConditions.push('日贵昼夜、刑冲破害等加强条件需结合出生时刻与全盘核对');
  }

  return { verificationFacts, pendingConditions, counterEvidence };
}

/** 返回所有结构命中项；不会把静态目录等级升级为本盘成格结论。 */
export function identifyClassicPatternCandidates(
  dayStem: string,
  monthBranch: string,
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
  currentPattern?: string,
): ClassicPatternCandidate[] {
  if (!hasCompletePillars(pillars)) return [];

  return CLASSIC_PATTERNS.flatMap((pattern) => {
    const matchedConditions = matchClassicPatternConditions(
      pattern,
      dayStem,
      monthBranch,
      pillars,
      hiddenStems,
      currentPattern,
    );
    if (!matchedConditions) return [];

    const evaluation = evaluateClassicPatternCandidate(pattern, pillars, hiddenStems);
    const status: ClassicPatternCandidateStatus = evaluation.counterEvidence.length
      ? '存在反证'
      : evaluation.pendingConditions.length
        ? '待核验'
        : '结构命中';
    return [{ pattern, matchedConditions, status, ...evaluation }];
  });
}

/** 返回目录顺序中的首项；已明确否定的曲直结构只保留在候选反证中。 */
export function identifyClassicPattern(
  dayStem: string,
  monthBranch: string,
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
  currentPattern?: string,
): ClassicPattern | null {
  return (
    identifyClassicPatternCandidates(
      dayStem,
      monthBranch,
      pillars,
      hiddenStems,
      currentPattern,
    ).find((candidate) => candidate.pattern.id !== 'qu-zhi' || candidate.status === '结构命中')
      ?.pattern ?? null
  );
}
