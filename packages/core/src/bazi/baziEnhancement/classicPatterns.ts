/**
 * @file 经典外格结构候选
 * @description 区分《子平真诠》“论杂格”认可的候选与其他古籍名目参考，只识别可复算结构；化气格因合化条件无法由固定字表唯一闭合而失败关闭。
 */

import type { BaziChartResult, Wuxing } from '../baziTypes';
import { checkCondition } from '../baziConditionMatchers';
import { canUseExternalPattern } from '../baziExternalPatternEligibility';
import { getTenGod } from '../baziUtils';
import { HEAVENLY_STEMS } from '../../ganzhi/data';

export type ClassicPatternSourceRole = '《子平真诠》杂格候选' | '其他古籍名目参考';

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
    excludePatterns?: string[];
  };
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  sourceRole: ClassicPatternSourceRole;
  source: {
    title: string;
    quote: string;
    url?: string;
  };
}

interface ClassicPatternDefinition extends ClassicPattern {
  eligibility: 'zhen-quan-misc' | 'strict-external';
  allowedFormationWuxing?: Wuxing[];
  allowedExposedMonthStems?: string[];
}

const ZHEN_QUAN_URL = 'https://zh.wikisource.org/wiki/子平真詮評註';
const SAN_MING_URL = 'https://zh.wikisource.org/wiki/三命通會/卷六';
const YUAN_HAI_URL = 'https://zh.wikisource.org/wiki/淵海子平';

/**
 * 《子平真诠》本章认可的候选排在其他古籍名目之前，避免一个被本章否定的名目
 * 遮住同盘中本章明确讨论的结构。数组顺序只决定单结果接口的展示优先级，不代表贵贱。
 */
const CLASSIC_PATTERNS: ClassicPatternDefinition[] = [
  {
    id: 'qu-zhi',
    name: '曲直格',
    description:
      '甲乙日生春月，地支完整见亥卯未三合木局或寅卯辰三会木局，列为五行一方秀气的曲直结构候选；只证明木局全而得时，不据此断定体纯、成格或贵贱。',
    conditions: {
      dayStems: ['甲', '乙'],
      monthBranch: ['寅', '卯', '辰'],
      anyConditions: ['三合木局', '三会木局'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '取甲乙全亥卯未、寅卯辰，又生春月之类。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'yan-shang',
    name: '炎上格',
    description:
      '丙丁日生夏月，地支完整见寅午戌三合火局或巳午未三会火局，列为五行一方秀气的炎上结构候选；不把火局齐全直接等同体纯、成格或吉凶。',
    conditions: {
      dayStems: ['丙', '丁'],
      monthBranch: ['巳', '午', '未'],
      anyConditions: ['三合火局', '三会火局'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '以五行各得其全体，所以成格。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'cong-ge',
    name: '从革格',
    description:
      '庚辛日生秋月，地支完整见巳酉丑三合金局或申酉戌三会金局，列为五行一方秀气的从革结构候选；不据会局名称直接推导成格层次。',
    conditions: {
      dayStems: ['庚', '辛'],
      monthBranch: ['申', '酉', '戌'],
      anyConditions: ['三合金局', '三会金局'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '有取五行一方秀气者。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'run-xia',
    name: '润下格',
    description:
      '壬癸日生冬月，地支完整见申子辰三合水局或亥子丑三会水局，列为五行一方秀气的润下结构候选；水局齐全以外的纯杂、强弱与成败仍须复核。',
    conditions: {
      dayStems: ['壬', '癸'],
      monthBranch: ['亥', '子', '丑'],
      anyConditions: ['三合水局', '三会水局'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '以五行各得其全体，所以成格。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'jia-se',
    name: '稼穑格',
    description:
      '戊己日生四季土月，地支辰戌丑未四库齐全，列为五行一方秀气的稼穑结构候选；只登记四库全与得时，不直接判定土气纯杂及最终成败。',
    conditions: {
      dayStems: ['戊', '己'],
      monthBranch: ['辰', '戌', '丑', '未'],
      otherConditions: ['辰戌丑未全'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '有取五行一方秀气者。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'dao-chong-wu',
    name: '倒冲格',
    description:
      '戊日四支全午且原局不见壬癸子，列为多午遥冲子中财星的倒冲结构候选；只登记原文例型，不推导财星已被冲出或成格贵贱。',
    conditions: {
      dayStems: ['戊'],
      otherConditions: ['地支四午', '不见天干壬', '不见天干癸', '不见地支子'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '如戊午、戊午、戊午、戊午，是冲子财也。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'dao-chong-bing',
    name: '倒冲格',
    description:
      '丙日四支至少三午且原局不见壬癸子，列为多午遥冲子中官星的倒冲结构候选；“支中字多”按原文三午例型收口，不再以两午泛报。',
    conditions: {
      dayStems: ['丙'],
      otherConditions: ['地支三午', '不见天干壬', '不见天干癸', '不见地支子'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '甲寅、庚午、丙午、甲午，是冲子官也。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'liu-yin-chao-yang',
    name: '六阴朝阳格',
    description:
      '辛日得戊子时，干头不见甲乙木与丙丁火，地支又不见午冲子，列为六阴朝阳结构候选；只证明本章明列条件，不直接断成格。',
    conditions: {
      dayStems: ['辛'],
      otherConditions: [
        '时柱为戊子',
        '不见天干甲',
        '不见天干乙',
        '不见天干丙',
        '不见天干丁',
        '不见地支午',
      ],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '要干头无木火，方成其格。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'he-lu-wu',
    name: '合禄格',
    description:
      '戊日得庚申时，干头不见甲乙官杀，列为借庚合乙的合禄结构候选；干合只是邀取逻辑，不代表乙官已经出现或最终成格。',
    conditions: {
      dayStems: ['戊'],
      otherConditions: ['时柱为庚申', '不见天干甲', '不见天干乙'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '戊日庚申，以庚合乙，因其主而得其偶。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'he-lu-gui',
    name: '合禄格',
    description:
      '癸日得庚申时，干头不见戊己官杀且地支不见巳填实，列为借申合巳的合禄结构候选；不把遥合逻辑写成已经得官。',
    conditions: {
      dayStems: ['癸'],
      otherConditions: ['时柱为庚申', '不见天干戊', '不见天干己', '不见地支巳'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '癸日庚申，以申合巳，因其主而得其朋。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },
  {
    id: 'jing-lan-cha',
    name: '井栏格',
    description:
      '庚日只在辰月或申月，地支申子辰水局齐全，且不见丙丁、巳午，才列井栏结构候选；会局只证明盘面结构，不代表寅午戌中财官印已经被冲出。',
    conditions: {
      dayStems: ['庚'],
      monthBranch: ['辰', '申'],
      otherConditions: ['申子辰三合水局', '不见天干丙', '不见天干丁', '不见地支巳', '不见地支午'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '庚金生三七月，方用此格。以申子辰冲寅午戌。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
    allowedFormationWuxing: ['水'],
    allowedExposedMonthStems: ['戊'],
  },
  {
    id: 'xing-he',
    name: '刑合格',
    description:
      '癸日得甲寅时，原局不见庚申冲克甲寅，也不见戊己官杀明透，列为寅刑巳的刑合结构候选；不把“刑”直接改写为已经取得财官。',
    conditions: {
      dayStems: ['癸'],
      otherConditions: ['时柱为甲寅', '不见天干庚', '不见地支申', '不见天干戊', '不见天干己'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '癸日甲寅时，寅刑巳而得财官。命有庚申，则木被冲克而不能刑；有戊己字，则现透官煞。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
    allowedExposedMonthStems: ['乙'],
  },
  {
    id: 'yao-he-xin-chou',
    name: '辛丑遥合格',
    description:
      '辛丑日地支至少三丑，不见子合丑，也不见丙丁戊己官杀明透，列为丑多遥会巳的结构候选；只保留本章认可的辛丑例，不收录作者明言可废的甲子遥巳。',
    conditions: {
      dayStems: ['辛'],
      otherConditions: [
        '日柱为辛丑',
        '地支三丑',
        '不见地支子',
        '不见天干丙',
        '不见天干丁',
        '不见天干戊',
        '不见天干己',
      ],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '《子平真诠》杂格候选',
    source: {
      title: '《子平真诠评注·论杂格》',
      quote: '丑多则会巳而辛丑处官，亦合禄之意也。',
      url: ZHEN_QUAN_URL,
    },
    eligibility: 'zhen-quan-misc',
  },

  // 下列名目仅保留其他古籍的结构参考；《子平真诠》本章点名否定者在说明中明确隔离。
  {
    id: 'jin-shen-jia',
    name: '金神格',
    description:
      '甲日生乙丑、己巳、癸酉三时，是《渊海子平》金神名目的基础结构；《子平真诠》“论杂格”把金神列入“既置勿取”，这里只作其他古籍来源参考。',
    conditions: {
      dayStems: ['甲'],
      anyConditions: ['时柱为乙丑', '时柱为己巳', '时柱为癸酉'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《渊海子平·论金神》',
      quote: '金神乃破败之神，要制伏，入火乡为胜；惧水乡，则非福矣。',
      url: YUAN_HAI_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'jin-shen-ji',
    name: '金神格',
    description:
      '己日生乙丑、己巳、癸酉三时，是《三命通会》所载金神名目；己日喜忌不能照搬甲日，《子平真诠》本章又明确不取金神，因此只保留来源参考。',
    conditions: {
      dayStems: ['己'],
      anyConditions: ['时柱为乙丑', '时柱为己巳', '时柱为癸酉'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《三命通会·卷六》',
      quote: '甲日金神偏宜火地，己日金神何劳火制。',
      url: SAN_MING_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'ren-qi-long',
    name: '壬骑龙背格',
    description:
      '壬辰日地支至少两辰且不见戌，是其他古籍壬骑龙背名目的基础结构；《子平真诠》本章点名认为骑龙牵就，不能当作该书正式杂格。',
    conditions: {
      dayStems: ['壬'],
      otherConditions: ['日柱为壬辰', '地支多辰', '不见地支戌'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《三命通会·卷六》',
      quote: '壬骑龙背，见戌无情。',
      url: SAN_MING_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'fei-tian-lu-ma-geng',
    name: '飞天禄马格',
    description:
      '庚子日地支多子且不见丑午、丁己，是《渊海子平》飞天禄马名目的结构参考；暗冲是否成立及成败不能仅由支数断定。',
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
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《渊海子平·飞天禄马诗诀》',
      quote: '庚壬二日重逢子，虚冲禄马号飞天。',
      url: YUAN_HAI_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'fei-tian-lu-ma-ren',
    name: '飞天禄马格',
    description:
      '壬子日地支多子且不见丑午、丁己，是《渊海子平》飞天禄马名目的结构参考；这里只识别字面条件，不推导暗冲已经取得财官。',
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
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《渊海子平·飞天禄马诗诀》',
      quote: '庚壬二日重逢子，虚冲禄马号飞天。',
      url: YUAN_HAI_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'liu-yi-shu-gui',
    name: '六乙鼠贵格',
    description:
      '乙日得丙子时并避午、丑、卯、申、酉及庚辛，是《三命通会》六乙鼠贵的结构参考；《子平真诠》本章点名不取鼠贵，不能冒充该书正式杂格。',
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
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《三命通会·卷六》',
      quote: '乙木生临丙子时，要无午破卯刑之。',
      url: SAN_MING_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'ri-gui',
    name: '日贵格',
    description:
      '丁酉、丁亥、癸巳、癸卯四日是《三命通会》日贵名目的基础结构；《子平真诠》本章点名不取日贵，且当前资料不足以判昼夜条件。',
    conditions: {
      dayStems: ['丁', '癸'],
      anyConditions: ['日柱为丁酉', '日柱为丁亥', '日柱为癸巳', '日柱为癸卯'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《三命通会·卷六》',
      quote: '此格只有四日：丁酉、丁亥、癸巳、癸卯。',
      url: SAN_MING_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'ri-de',
    name: '日德格',
    description:
      '甲寅、丙辰、戊辰、庚辰、壬戌五日是《三命通会》日德名目的日柱结构；《子平真诠》本章点名不取日德，不输出性情、福寿与贵贱断语。',
    conditions: {
      dayStems: ['甲', '丙', '戊', '庚', '壬'],
      anyConditions: ['日柱为甲寅', '日柱为丙辰', '日柱为戊辰', '日柱为庚辰', '日柱为壬戌'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《三命通会·卷六》',
      quote: '日德有五日：甲寅、丙辰、戊辰、庚辰、壬戌。',
      url: SAN_MING_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'fu-de',
    name: '福德秀气格',
    description:
      '乙丁己辛癸日坐巳酉丑之一，且四柱巳酉丑金局齐全，是《三命通会》福德秀气的共同结构参考；各日干成败不同，不作统一强断。',
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
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《三命通会·卷六》',
      quote: '此格专以巳酉丑金局而看所得天干。',
      url: SAN_MING_URL,
    },
    eligibility: 'strict-external',
  },
  {
    id: 'zi-wu-shuang-bao',
    name: '子午双包格',
    description:
      '四柱同时见子午，并构成两子包一午、两午包一子或两子两午，只列《三命通会》所载支数结构，不推导成格或贵贱。',
    conditions: {
      dayStems: [...HEAVENLY_STEMS],
      otherConditions: ['子午双包'],
    },
    favorableWuxing: [],
    unfavorableWuxing: [],
    sourceRole: '其他古籍名目参考',
    source: {
      title: '《三命通会·卷六》',
      quote: '或两子两午，或两午包一子，或两子包一午。',
      url: SAN_MING_URL,
    },
    eligibility: 'strict-external',
  },
];

function isEligible(
  pattern: ClassicPatternDefinition,
  pillars: BaziChartResult['pillars'],
): boolean {
  if (pattern.eligibility === 'strict-external') {
    return canUseExternalPattern(pillars, getTenGod);
  }

  return canUseExternalPattern(pillars, getTenGod, {
    allowNonPeerMonthPrincipal: true,
    allowSingleUnrootedWealth: true,
    allowedFormationWuxing: pattern.allowedFormationWuxing,
    allowedExposedMonthStems: pattern.allowedExposedMonthStems,
  });
}

export function identifyClassicPattern(
  dayStem: string,
  monthBranch: string,
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
  currentPattern?: string,
): ClassicPattern | null {
  for (const pattern of CLASSIC_PATTERNS) {
    if (!isEligible(pattern, pillars)) continue;

    if (pattern.conditions.dayStems && !pattern.conditions.dayStems.includes(dayStem)) {
      continue;
    }
    if (pattern.conditions.monthBranch && !pattern.conditions.monthBranch.includes(monthBranch)) {
      continue;
    }
    if (pattern.conditions.exactMonthBranchMap) {
      const requiredBranch = pattern.conditions.exactMonthBranchMap[dayStem];
      if (!requiredBranch || monthBranch !== requiredBranch) continue;
    }
    if (
      pattern.conditions.excludePatterns &&
      currentPattern &&
      pattern.conditions.excludePatterns.includes(currentPattern)
    ) {
      continue;
    }
    if (
      pattern.conditions.otherConditions?.some(
        (condition) => !checkCondition(condition, dayStem, pillars, hiddenStems),
      )
    ) {
      continue;
    }
    if (
      pattern.conditions.anyConditions &&
      !pattern.conditions.anyConditions.some((condition) =>
        checkCondition(condition, dayStem, pillars, hiddenStems),
      )
    ) {
      continue;
    }

    return pattern;
  }

  return null;
}
