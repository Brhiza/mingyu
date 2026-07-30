import type {
  LiurenClassicalRule,
  LiurenData,
  LiurenGuaTiFact,
  LiurenKinship,
  LiurenLesson,
  LiurenTransmission,
} from '../../../../types/divination';
import {
  BRANCH_SANXING,
  LIUCHONG_MAP,
  LIUHAI_MAP,
  LIUHE_MAP,
  LIUPO_MAP,
  isKe,
  isSheng,
} from '../../../../ganzhi';
import { getGanZhiWuxing, isBranchKe } from './plate';

function describeDirectedElementRelation(
  sourceLabel: string,
  sourceValue: string,
  targetLabel: string,
  targetValue: string,
) {
  const sourceElement = getGanZhiWuxing(sourceValue);
  const targetElement = getGanZhiWuxing(targetValue);
  const source = `${sourceLabel}${sourceValue}${sourceElement}`;
  const target = `${targetLabel}${targetValue}${targetElement}`;
  if (sourceElement === targetElement) return `${source}与${target}比和`;
  if (isSheng(sourceElement, targetElement)) return `${source}生${target}`;
  if (isSheng(targetElement, sourceElement)) return `${target}生${source}`;
  if (isKe(sourceElement, targetElement)) return `${source}克${target}`;
  if (isKe(targetElement, sourceElement)) return `${target}克${source}`;
  throw new Error(`无法判断${sourceLabel}${sourceValue}与${targetLabel}${targetValue}的五行关系。`);
}

/** 三传六亲一律以日干为比较中心，不以初中末传彼此替代。 */
export function getLiurenKinship(dayStem: string, transmissionBranch: string): LiurenKinship {
  const dayElement = getGanZhiWuxing(dayStem);
  const transmissionElement = getGanZhiWuxing(transmissionBranch);
  if (dayElement === transmissionElement) return '兄弟';
  if (isSheng(transmissionElement, dayElement)) return '父母';
  if (isSheng(dayElement, transmissionElement)) return '子孙';
  if (isKe(dayElement, transmissionElement)) return '妻财';
  if (isKe(transmissionElement, dayElement)) return '官鬼';
  throw new Error(`无法判断日干${dayStem}与三传${transmissionBranch}的六亲。`);
}

export function describeTransmissionDayStemRelation(
  stage: LiurenTransmission['stage'],
  branch: string,
  dayStem: string,
) {
  return describeDirectedElementRelation(`日干`, dayStem, stage, branch);
}

export function describeTransmissionDayBranchRelation(
  stage: LiurenTransmission['stage'],
  branch: string,
  dayBranch: string,
) {
  return describeDirectedElementRelation(stage, branch, '日支', dayBranch);
}

export function describeTransmissionTransition(
  previousStage: LiurenTransmission['stage'],
  previousBranch: string,
  stage: LiurenTransmission['stage'],
  branch: string,
) {
  return describeDirectedElementRelation(previousStage, previousBranch, stage, branch);
}

/** 只登记两支可复算的固定关系，不把关系名称直接换算成吉凶。 */
export function getLiurenBranchPairRelations(sourceBranch: string, targetBranch: string) {
  const relations: string[] = [];
  if (sourceBranch === targetBranch) relations.push('同支');
  if (LIUHE_MAP[sourceBranch] === targetBranch) relations.push('六合');
  if (LIUCHONG_MAP[sourceBranch] === targetBranch) relations.push('六冲');
  if (LIUHAI_MAP[sourceBranch] === targetBranch) relations.push('六害');
  if (LIUPO_MAP[sourceBranch] === targetBranch) relations.push('六破');
  if (
    BRANCH_SANXING[sourceBranch]?.includes(targetBranch) ||
    BRANCH_SANXING[targetBranch]?.includes(sourceBranch)
  ) {
    relations.push('相刑');
  }
  return relations;
}

export function buildTransmissionNote(
  transmission: Pick<
    LiurenTransmission,
    'stage' | 'branch' | 'kinship' | 'dayStemRelation' | 'previousRelation'
  >,
) {
  return (
    [
      `${transmission.stage}${transmission.branch}相对日干为${transmission.kinship}`,
      transmission.dayStemRelation,
      transmission.previousRelation ? `与上一传的五行关系为${transmission.previousRelation}` : '',
    ]
      .filter(Boolean)
      .join('；') + '。'
  );
}

export function getTransmissionPattern(
  chu: string,
  _zhong: string,
  mo: string,
  transmissionRule = '',
): LiurenData['transmissionPattern'] {
  if (transmissionRule.includes('伏吟')) {
    return '伏吟';
  }
  if (transmissionRule.includes('返吟')) {
    return '反吟';
  }
  if (chu === mo) {
    return '回环';
  }

  return '递传';
}

export function getPatternTag(pattern: LiurenData['transmissionPattern']) {
  if (pattern === '伏吟') {
    return '伏吟';
  }
  if (pattern === '反吟') {
    return '反吟';
  }
  if (pattern === '回环') {
    return '回环';
  }

  return '递传';
}

const LIUREN_GUIDE_VOLUME_ONE_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬指南/1&oldid=854504';
const LIUREN_DAQUAN_VOLUME_SEVEN_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/7&oldid=854575';

export interface LiurenGuaTiContext {
  transmissionBranches: string[];
  initialGroundBranch?: string;
  yearBranch?: string;
  monthBranch?: string;
  monthLeader?: string;
  noblemanBranch?: string;
  noblemanGroundBranch?: string;
  fourLessons?: Array<Pick<LiurenLesson, 'upper' | 'lower'>>;
}

type LiurenGuaTiRule = Omit<LiurenGuaTiFact, 'stableKey' | 'branches' | 'matchedConditions'> & {
  detect: (
    context: LiurenGuaTiContext,
  ) => { branches: string[]; matchedConditions: string[] } | null;
};

function hasSameBranchSet(actualBranches: string[], expectedBranches: string[]) {
  return (
    actualBranches.length === expectedBranches.length &&
    expectedBranches.every((branch) => actualBranches.includes(branch))
  );
}

function matchThreeOfBranchClass(
  context: LiurenGuaTiContext,
  expectedBranches: string[],
  condition: string,
) {
  const uniqueBranches = Array.from(new Set(context.transmissionBranches));
  return uniqueBranches.length === 3 &&
    uniqueBranches.every((branch) => expectedBranches.includes(branch))
    ? { branches: uniqueBranches, matchedConditions: [condition] }
    : null;
}

function matchSanhe(context: LiurenGuaTiContext, expectedBranches: string[], condition: string) {
  const uniqueBranches = Array.from(new Set(context.transmissionBranches));
  return hasSameBranchSet(uniqueBranches, expectedBranches)
    ? { branches: [...context.transmissionBranches], matchedConditions: [condition] }
    : null;
}

const REGISTERED_GUA_TI_RULES: LiurenGuaTiRule[] = [
  {
    id: 'san-jiao',
    name: '三交卦',
    category: '三传支类',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '子午卯酉仲神全见于三传曰三交。',
    detect: (context) =>
      matchThreeOfBranchClass(context, ['子', '午', '卯', '酉'], '三传各为子午卯酉四仲之一'),
  },
  {
    id: 'xuan-tai',
    name: '玄胎卦',
    category: '三传支类',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '寅申巳亥全在三传曰玄胎卦。',
    detect: (context) =>
      matchThreeOfBranchClass(context, ['寅', '申', '巳', '亥'], '三传各为寅申巳亥四孟之一'),
  },
  {
    id: 'jia-se',
    name: '稼穑卦',
    category: '三传支类',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '辰戌丑未全在三传曰稼穑卦。',
    detect: (context) =>
      matchThreeOfBranchClass(context, ['辰', '戌', '丑', '未'], '三传各为辰戌丑未四季之一'),
  },
  {
    id: 'qu-zhi',
    name: '曲直卦',
    category: '三合成局',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '三传亥卯未曰曲直卦。',
    detect: (context) => matchSanhe(context, ['亥', '卯', '未'], '三传亥卯未全'),
  },
  {
    id: 'cong-ge',
    name: '从革卦',
    category: '三合成局',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '三传巳酉丑全者曰从革卦。',
    detect: (context) => matchSanhe(context, ['巳', '酉', '丑'], '三传巳酉丑全'),
  },
  {
    id: 'yan-shang',
    name: '炎上卦',
    category: '三合成局',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '三传寅午戌全者曰炎上卦。',
    detect: (context) => matchSanhe(context, ['寅', '午', '戌'], '三传寅午戌全'),
  },
  {
    id: 'run-xia',
    name: '润下卦',
    category: '三合成局',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '三传申子辰全者曰润下卦。',
    detect: (context) => matchSanhe(context, ['申', '子', '辰'], '三传申子辰全'),
  },
  {
    id: 'long-de',
    name: '龙德课',
    category: '岁将贵人',
    sourceTitle: '《六壬大全》卷七·课经集一·龙德课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SEVEN_URL,
    sourceQuote: '凡太岁月将乘贵人发用，为龙德课。\n如太岁乘贵人发用，传中见月将亦是。',
    detect(context) {
      const initial = context.transmissionBranches[0];
      const yearAndNoblemanUse =
        !!initial && initial === context.yearBranch && initial === context.noblemanBranch;
      const monthLeaderInTransmission =
        !!context.monthLeader && context.transmissionBranches.includes(context.monthLeader);
      return yearAndNoblemanUse && (initial === context.monthLeader || monthLeaderInTransmission)
        ? {
            branches: [initial, context.monthLeader!],
            matchedConditions: [
              initial === context.monthLeader
                ? `初传${initial}同时为太岁、月将并乘贵人`
                : `太岁${initial}乘贵人发用，月将${context.monthLeader}另见于三传`,
            ],
          }
        : null;
    },
  },
  {
    id: 'zhuo-lun',
    name: '斫轮卦',
    category: '发用临地',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '卯加申发用曰斫轮卦。',
    detect: (context) =>
      context.transmissionBranches[0] === '卯' && context.initialGroundBranch === '申'
        ? { branches: ['卯', '申'], matchedConditions: ['初传卯加临地盘申发用'] }
        : null,
  },
  {
    id: 'zhu-yin',
    name: '铸印卦',
    category: '发用临地',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '戌加巳发用曰铸印卦。',
    detect: (context) =>
      context.transmissionBranches[0] === '戌' && context.initialGroundBranch === '巳'
        ? { branches: ['戌', '巳'], matchedConditions: ['初传戌加临地盘巳发用'] }
        : null,
  },
  {
    id: 'gao-gai-cheng-xuan',
    name: '高盖乘轩卦',
    category: '三传支类',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '午卯子三传曰高盖乘轩卦。',
    detect: (context) =>
      context.transmissionBranches.join('') === '午卯子'
        ? { branches: ['午', '卯', '子'], matchedConditions: ['三传依次为午、卯、子'] }
        : null,
  },
  {
    id: 'wu-lu',
    name: '无禄卦',
    category: '四课关系',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '凡四上克下曰无禄卦。',
    detect(context) {
      return context.fourLessons?.length === 4 &&
        context.fourLessons.every((lesson) => isBranchKe(lesson.upper, lesson.lower))
        ? {
            branches: context.fourLessons.flatMap((lesson) => [lesson.upper, lesson.lower]),
            matchedConditions: ['四课均为上神克下位'],
          }
        : null;
    },
  },
  {
    id: 'li-de',
    name: '励德卦',
    category: '贵人临地',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '贵人当卯酉之上曰励德卦。',
    detect: (context) =>
      context.noblemanGroundBranch && ['卯', '酉'].includes(context.noblemanGroundBranch)
        ? {
            branches: [context.noblemanGroundBranch],
            matchedConditions: [`贵人临地盘${context.noblemanGroundBranch}`],
          }
        : null,
  },
];

export const REGISTERED_LIUREN_GUA_TI_COUNT = REGISTERED_GUA_TI_RULES.length;

/**
 * 识别三传成局课体。
 * 《六壬指南》列三交、玄胎、稼穑及曲直、从革、炎上、润下等三传课体；
 * 这里仅按三传地支结构打标签，吉凶仍交由后续断课结合用神、天将与旺衰判断。
 */
export function getLiurenGuaTiFacts(context: LiurenGuaTiContext): LiurenGuaTiFact[] {
  return REGISTERED_GUA_TI_RULES.flatMap((rule) => {
    const match = rule.detect(context);
    return match
      ? [
          {
            id: rule.id,
            stableKey: `liuren:verified-guati:${rule.id}`,
            name: rule.name,
            category: rule.category,
            branches: [...new Set(match.branches)],
            matchedConditions: match.matchedConditions,
            sourceTitle: rule.sourceTitle,
            sourceUrl: rule.sourceUrl,
            sourceQuote: rule.sourceQuote,
          },
        ]
      : [];
  });
}

export function getLiurenTransmissionGuaTi(branches: string[]) {
  return getLiurenGuaTiFacts({ transmissionBranches: branches }).map((fact) => fact.name);
}

export function buildTransmissionDetail(
  rule: string,
  _pattern: LiurenData['transmissionPattern'],
  transmissions: LiurenTransmission[],
  classicalRules: LiurenClassicalRule[] = [],
) {
  const initialTransmission = transmissions[0];
  if (!initialTransmission) {
    throw new Error('buildTransmissionDetail 需要至少包含初传信息。');
  }
  const sourceText = classicalRules.length
    ? `；古籍依据依次为：${classicalRules
        .map((item) => `${item.source}之${item.rule}（${item.summary}）`)
        .join('；')}`
    : '';
  return `取传采用${rule}，以${initialTransmission.stage}${initialTransmission.branch}为初传发用${sourceText}。`;
}
