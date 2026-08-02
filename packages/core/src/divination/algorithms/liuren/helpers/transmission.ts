import type {
  LiurenClassicalRule,
  LiurenData,
  LiurenGuaTiFact,
  LiurenKinship,
  LiurenLesson,
  LiurenTransmission,
} from '../../../../types/divination';
import {
  getXunHead,
  getBranchWuxing,
  getSeasonState,
  isValidGanZhi,
  LIUCHONG_MAP,
  LIUHAI_MAP,
  LIUHE_MAP,
  LIUPO_MAP,
  SANXING_MAP,
  isKe,
  isSheng,
} from '../../../../ganzhi';
import { DIZHI, getGanZhiWuxing, isBranchKe, TIANGAN, TIANJIANG } from './plate';
import { getLiurenTianMaBranch } from './shensha';

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

/** 大六壬六亲一律以日干为比较中心，不以四课下位或初中末传彼此替代。 */
export function getLiurenKinship(dayStem: string, targetBranch: string): LiurenKinship {
  const dayElement = getGanZhiWuxing(dayStem);
  const targetElement = getGanZhiWuxing(targetBranch);
  if (dayElement === targetElement) return '兄弟';
  if (isSheng(targetElement, dayElement)) return '父母';
  if (isSheng(dayElement, targetElement)) return '子孙';
  if (isKe(dayElement, targetElement)) return '妻财';
  if (isKe(targetElement, dayElement)) return '官鬼';
  throw new Error(`无法判断日干${dayStem}与地支${targetBranch}的六亲。`);
}

export function describeTransmissionDayStemRelation(
  stage: LiurenTransmission['stage'],
  branch: string,
  dayStem: string,
) {
  return describeDirectedElementRelation(`日干`, dayStem, stage, branch);
}

export function describeLessonDayStemRelation(
  lessonName: LiurenLesson['name'],
  branch: string,
  dayStem: string,
) {
  return describeDirectedElementRelation('日干', dayStem, `${lessonName}上神`, branch);
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

/**
 * 只登记两支可复算的固定关系，不把关系名称直接换算成吉凶。
 * 相刑按大六壬传统定向刑序 source → target 判断，不反向扩展为三刑组任意二支。
 */
export function getLiurenBranchPairRelations(sourceBranch: string, targetBranch: string) {
  const relations: string[] = [];
  if (sourceBranch === targetBranch) relations.push('同支');
  if (LIUHE_MAP[sourceBranch] === targetBranch) relations.push('六合');
  if (LIUCHONG_MAP[sourceBranch] === targetBranch) relations.push('六冲');
  if (LIUHAI_MAP[sourceBranch] === targetBranch) relations.push('六害');
  if (LIUPO_MAP[sourceBranch] === targetBranch) relations.push('六破');
  if (SANXING_MAP[sourceBranch] === targetBranch) relations.push('相刑');
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
const LIUREN_DAQUAN_VOLUME_EIGHT_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/8&oldid=854576';
const LIUREN_DAQUAN_VOLUME_NINE_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/9&oldid=854578';
const LIUREN_GUIDE_VOLUME_TWO_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬指南/2&oldid=854505';
const JIU_CHOU_DAYS = new Set([
  '乙卯',
  '乙酉',
  '戊子',
  '戊午',
  '己卯',
  '己酉',
  '辛卯',
  '辛酉',
  '壬子',
  '壬午',
]);
const LIUREN_DAY_ORIGIN_BY_STEM: Readonly<Record<string, string>> = {
  甲: '亥',
  乙: '亥',
  丙: '寅',
  丁: '寅',
  戊: '申',
  己: '申',
  庚: '巳',
  辛: '巳',
  壬: '申',
  癸: '申',
};
const ELEMENT_TOMB_BY_STEM: Readonly<Record<string, string>> = {
  甲: '未',
  乙: '未',
  丙: '戌',
  丁: '戌',
  戊: '辰',
  己: '辰',
  庚: '丑',
  辛: '丑',
  壬: '辰',
  癸: '辰',
};

export interface LiurenGuaTiContext {
  transmissionBranches: string[];
  transmissionGods?: string[];
  dayGanZhi?: string;
  dayStem?: string;
  dayBranch?: string;
  hourBranch?: string;
  initialGroundBranch?: string;
  yearBranch?: string;
  monthBranch?: string;
  monthLeader?: string;
  noblemanBranch?: string;
  noblemanGroundBranch?: string;
  greatAuspiciousGroundBranch?: string;
  heavenlyDragonGroundBranch?: string;
  fourLessons?: Array<Pick<LiurenLesson, 'upper' | 'lower'>>;
}

type LiurenGuaTiRule = Omit<LiurenGuaTiFact, 'stableKey' | 'branches' | 'matchedConditions'> & {
  detect: (
    context: LiurenGuaTiContext,
  ) => { branches: string[]; matchedConditions: string[] } | null;
};

function assertLiurenGuaTiBranch(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !DIZHI.includes(value as (typeof DIZHI)[number])) {
    throw new Error(`${label}必须是有效地支。`);
  }
}

function assertValidLiurenGuaTiContext(context: LiurenGuaTiContext): void {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new Error('大六壬课体识别必须提供完整上下文对象。');
  }
  if (!Array.isArray(context.transmissionBranches) || context.transmissionBranches.length !== 3) {
    throw new Error('大六壬课体识别的三传必须恰好包含初传、中传、末传三项。');
  }
  context.transmissionBranches.forEach((branch, index) =>
    assertLiurenGuaTiBranch(branch, `第${index + 1}传`),
  );

  if (context.transmissionGods !== undefined) {
    if (!Array.isArray(context.transmissionGods) || context.transmissionGods.length !== 3) {
      throw new Error('大六壬课体识别的三传天将一经提供，就必须恰好包含初传、中传、末传三项。');
    }
    context.transmissionGods.forEach((god, index) => {
      if (!TIANJIANG.includes(god as (typeof TIANJIANG)[number])) {
        throw new Error(`第${index + 1}传天将必须是有效十二天将。`);
      }
    });
  }

  if (
    context.dayStem !== undefined &&
    !TIANGAN.includes(context.dayStem as (typeof TIANGAN)[number])
  ) {
    throw new Error('日干必须是有效天干。');
  }

  if (context.dayGanZhi !== undefined) {
    if (!isValidGanZhi(context.dayGanZhi)) {
      throw new Error('日柱必须是完整且有效的六十甲子。');
    }
    if (context.dayStem !== undefined && context.dayGanZhi.charAt(0) !== context.dayStem) {
      throw new Error('日柱与日干不一致。');
    }
    if (context.dayBranch !== undefined && context.dayGanZhi.charAt(1) !== context.dayBranch) {
      throw new Error('日柱与日支不一致。');
    }
  }

  const optionalBranches: Array<[unknown, string]> = [
    [context.dayBranch, '日支'],
    [context.hourBranch, '占时地支'],
    [context.initialGroundBranch, '初传所临地盘'],
    [context.yearBranch, '太岁地支'],
    [context.monthBranch, '月支'],
    [context.monthLeader, '月将'],
    [context.noblemanBranch, '贵人所乘上神'],
    [context.noblemanGroundBranch, '贵人所临地盘'],
    [context.greatAuspiciousGroundBranch, '大吉所临地盘'],
    [context.heavenlyDragonGroundBranch, '天罡所临地盘'],
  ];
  for (const [value, label] of optionalBranches) {
    if (value !== undefined) assertLiurenGuaTiBranch(value, label);
  }

  if (context.fourLessons !== undefined) {
    if (!Array.isArray(context.fourLessons) || context.fourLessons.length !== 4) {
      throw new Error('大六壬课体识别的四课一经提供，就必须恰好包含完整四课。');
    }
    context.fourLessons.forEach((lesson, index) => {
      if (!lesson || typeof lesson !== 'object') {
        throw new Error(`第${index + 1}课必须是有效对象。`);
      }
      assertLiurenGuaTiBranch(lesson.upper, `第${index + 1}课上神`);
      if (
        typeof lesson.lower !== 'string' ||
        (!DIZHI.includes(lesson.lower as (typeof DIZHI)[number]) &&
          !TIANGAN.includes(lesson.lower as (typeof TIANGAN)[number]))
      ) {
        throw new Error(`第${index + 1}课下位必须是有效天干或地支。`);
      }
    });
  }
}

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

function matchConsecutiveTransmissions(
  context: LiurenGuaTiContext,
  step: 1 | -1 | 2 | -2,
  condition: string,
) {
  const indices = context.transmissionBranches.map((branch) =>
    DIZHI.indexOf(branch as (typeof DIZHI)[number]),
  );
  return indices[1] === (indices[0] + step + DIZHI.length) % DIZHI.length &&
    indices[2] === (indices[1] + step + DIZHI.length) % DIZHI.length
    ? { branches: [...context.transmissionBranches], matchedConditions: [condition] }
    : null;
}

const XUN_QI_BY_HEAD: Readonly<Record<string, string>> = {
  甲子: '丑',
  甲戌: '丑',
  甲申: '子',
  甲午: '子',
  甲辰: '亥',
  甲寅: '亥',
};

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
    id: 'jin-ru',
    name: '进茹',
    category: '三传顺逆',
    sourceTitle: '《六壬指南》卷二·指掌赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_GUIDE_VOLUME_TWO_URL,
    sourceQuote:
      '《六壬指南》：“若顺连茹亥将顺行。”《六壬粹言》：“谓三传之神俱在一方，顺行而进，曰进茹。”',
    detect: (context) =>
      matchConsecutiveTransmissions(
        context,
        1,
        `三传${context.transmissionBranches.join('、')}依十二地支顺序逐支相连`,
      ),
  },
  {
    id: 'tui-ru',
    name: '退茹',
    category: '三传顺逆',
    sourceTitle: '《六壬指南》卷二·指掌赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_GUIDE_VOLUME_TWO_URL,
    sourceQuote:
      '《六壬指南》：“若逆连茹亥位逆推。”《六壬粹言》：“谓三传之神俱在一方，逆行而退，曰退茹。”',
    detect: (context) =>
      matchConsecutiveTransmissions(
        context,
        -1,
        `三传${context.transmissionBranches.join('、')}依十二地支逆序逐支相连`,
      ),
  },
  {
    id: 'jin-jian',
    name: '进间',
    category: '三传顺逆',
    sourceTitle: '《六壬指南》卷二·指掌赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_GUIDE_VOLUME_TWO_URL,
    sourceQuote:
      '《六壬指南》：“故顺三间之课，亥丑卯……”《六壬粹言》：“凡课得间一位作三传，顺行而进，曰进间。”',
    detect: (context) =>
      matchConsecutiveTransmissions(
        context,
        2,
        `三传${context.transmissionBranches.join('、')}依十二地支顺序每次间隔一位`,
      ),
  },
  {
    id: 'tui-jian',
    name: '退间',
    category: '三传顺逆',
    sourceTitle: '《六壬指南》卷二·指掌赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_GUIDE_VOLUME_TWO_URL,
    sourceQuote:
      '《六壬指南》：“至若逆三间之课，亥酉未……”《六壬粹言》：“谓课得间一位作三传，逆行而退，曰退间。”',
    detect: (context) =>
      matchConsecutiveTransmissions(
        context,
        -2,
        `三传${context.transmissionBranches.join('、')}依十二地支逆序每次间隔一位`,
      ),
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
    sourceTitle: '《六壬大全》卷七·课经集一·斫轮课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SEVEN_URL,
    sourceQuote: '斫轮，卯加庚辛申酉发用。卯为车轮，金为斧斤，木就金斫，故名斫轮。',
    detect(context) {
      if (context.transmissionBranches[0] !== '卯') return null;
      if (context.initialGroundBranch && ['申', '酉'].includes(context.initialGroundBranch)) {
        return {
          branches: ['卯', context.initialGroundBranch],
          matchedConditions: [`初传卯加临地盘${context.initialGroundBranch}发用`],
        };
      }
      const stemLesson = context.fourLessons?.find(
        (lesson) => lesson.upper === '卯' && ['庚', '辛'].includes(lesson.lower),
      );
      return stemLesson
        ? {
            branches: ['卯'],
            matchedConditions: [`初传卯从日干${stemLesson.lower}上发用`],
          }
        : null;
    },
  },
  {
    id: 'zhu-yin',
    name: '铸印卦',
    category: '三传支类',
    sourceTitle: '《六壬大全》卷七·课经集一·铸印课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SEVEN_URL,
    sourceQuote: '凡课得戌加巳中传，为铸印课。\n铸印，三传巳戌卯，巳为炉，戌为印，卯为印模。',
    detect: (context) =>
      context.transmissionBranches.join('') === '巳戌卯'
        ? {
            branches: ['巳', '戌', '卯'],
            matchedConditions: ['三传依次为巳、戌、卯，戌加巳为中传'],
          }
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
    id: 'jue-si',
    name: '绝嗣卦',
    category: '四课关系',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '凡四下克上曰绝嗣卦。',
    detect(context) {
      return context.fourLessons?.length === 4 &&
        context.fourLessons.every((lesson) => isBranchKe(lesson.lower, lesson.upper))
        ? {
            branches: context.fourLessons.flatMap((lesson) => [lesson.upper, lesson.lower]),
            matchedConditions: ['四课均为下位克上神'],
          }
        : null;
    },
  },
  {
    id: 'you-du-e',
    name: '幼度厄',
    category: '四课关系',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '三上克为幼度厄。',
    detect(context) {
      return context.fourLessons?.length === 4 &&
        context.fourLessons.filter((lesson) => isBranchKe(lesson.upper, lesson.lower)).length === 3
        ? {
            branches: context.fourLessons.flatMap((lesson) => [lesson.upper, lesson.lower]),
            matchedConditions: ['四课中恰有三课为上神克下位'],
          }
        : null;
    },
  },
  {
    id: 'zhang-du-e',
    name: '长度厄',
    category: '四课关系',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '三下克为长度厄。',
    detect(context) {
      return context.fourLessons?.length === 4 &&
        context.fourLessons.filter((lesson) => isBranchKe(lesson.lower, lesson.upper)).length === 3
        ? {
            branches: context.fourLessons.flatMap((lesson) => [lesson.upper, lesson.lower]),
            matchedConditions: ['四课中恰有三课为下位克上神'],
          }
        : null;
    },
  },
  {
    id: 'tian-wang',
    name: '天网卦',
    category: '时用克日',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '凡时与用神并克天干者曰天网卦。',
    detect(context) {
      const initial = context.transmissionBranches[0];
      return context.dayStem &&
        context.hourBranch &&
        isBranchKe(context.hourBranch, context.dayStem) &&
        isBranchKe(initial, context.dayStem)
        ? {
            branches: [context.hourBranch, initial],
            matchedConditions: [
              `占时${context.hourBranch}与初传${initial}均克日干${context.dayStem}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'shang-men-luan-shou',
    name: '上门乱首',
    category: '日辰发用',
    sourceTitle: '《六壬大全》卷七·课经集一·乱首课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SEVEN_URL,
    sourceQuote: '支临干克干，为上门乱首，更兼发用尤的。',
    detect(context) {
      const initial = context.transmissionBranches[0];
      const firstLesson = context.fourLessons?.[0];
      return context.dayStem &&
        context.dayBranch &&
        firstLesson?.lower === context.dayStem &&
        firstLesson.upper === context.dayBranch &&
        initial === context.dayBranch &&
        isBranchKe(context.dayBranch, context.dayStem)
        ? {
            branches: [context.dayBranch],
            matchedConditions: [
              `日支${context.dayBranch}临日干${context.dayStem}并克干，且以日支发用`,
            ],
          }
        : null;
    },
  },
  {
    id: 'zhui-xu',
    name: '赘婿卦',
    category: '日辰发用',
    sourceTitle: '《六壬指南》卷一·心印赋；《六壬大全》卷八·赘婿课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬指南》：“支辰加天干之上被克为用曰赘婿卦。”《六壬大全》：“支临干被克，更兼发用尤的。”',
    detect(context) {
      const initial = context.transmissionBranches[0];
      const firstLesson = context.fourLessons?.[0];
      return context.dayStem &&
        context.dayBranch &&
        firstLesson?.lower === context.dayStem &&
        firstLesson.upper === context.dayBranch &&
        initial === context.dayBranch &&
        isBranchKe(context.dayStem, context.dayBranch)
        ? {
            branches: [context.dayBranch],
            matchedConditions: [
              `日支${context.dayBranch}临日干${context.dayStem}受干克，且以日支发用`,
            ],
          }
        : null;
    },
  },
  {
    id: 'hui-huan',
    name: '回环课',
    category: '四课关系',
    sourceTitle: '《六壬指南》卷二·指掌赋；《六壬粹言》卷八·占法',
    sourceUrl: LIUREN_GUIDE_VOLUME_TWO_URL,
    sourceQuote: '《六壬指南》：“三传不离四课名曰回环。”《六壬粹言》：“三传全在四课之中，曰回环。”',
    detect(context) {
      if (context.fourLessons?.length !== 4) return null;
      const lessonUppers = new Set(context.fourLessons.map((lesson) => lesson.upper));
      return context.transmissionBranches.every((branch) => lessonUppers.has(branch))
        ? {
            branches: [...context.transmissionBranches],
            matchedConditions: [`三传${context.transmissionBranches.join('、')}均见于四课上神`],
          }
        : null;
    },
  },
  {
    id: 'you-zi',
    name: '游子课',
    category: '三传天马',
    sourceTitle: '《六壬指南》卷一、卷二；《六壬大全》卷九·游子课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬指南》卷一：“辰戌丑未为四季，在三传本静，而丁神天马入之曰游子。”卷二：“四季名为游子，乘天马。”《六壬大全》：“凡课三传皆土，遇旬丁天马为用，曰游子课。”',
    detect(context) {
      if (!context.monthBranch) return null;
      const tianMa = getLiurenTianMaBranch(context.monthBranch);
      return tianMa &&
        context.transmissionBranches[0] === tianMa &&
        context.transmissionBranches.every((branch) => ['辰', '戌', '丑', '未'].includes(branch))
        ? {
            branches: [...context.transmissionBranches],
            matchedConditions: [
              `三传${context.transmissionBranches.join('、')}均为辰戌丑未四季，月建${context.monthBranch}所起天马${tianMa}发用`,
            ],
          }
        : null;
    },
  },
  {
    id: 'yi-nv',
    name: '泆女格',
    category: '三传天将',
    sourceTitle: '《六壬指南》卷一、卷二；《六壬大全》卷九·淫泆课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬指南》卷一：“初传天后，末传六合，更传见卯酉曰淫女卦。”卷二：“凡卯酉作传而前天后后见六合……非佚女而何？”《六壬大全》：“凡课初传卯酉为用，将乘后合，为淫泆课。”“初传天后，末传六合。”',
    detect(context) {
      const initial = context.transmissionBranches[0];
      const initialGod = context.transmissionGods?.[0];
      const finalGod = context.transmissionGods?.[2];
      return initial &&
        ['卯', '酉'].includes(initial) &&
        initialGod === '天后' &&
        finalGod === '六合'
        ? {
            branches: [...context.transmissionBranches],
            matchedConditions: [
              `初传${initial}乘天后，末传${context.transmissionBranches[2]}乘六合`,
            ],
          }
        : null;
    },
  },
  {
    id: 'jiao-tong',
    name: '狡童格',
    category: '三传天将',
    sourceTitle: '《六壬指南》卷二；《六壬大全》卷九·淫泆课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬指南》：“凡卯酉作传而前见六合后见天后为阳往求阴，非狡童而何？”《六壬大全》：“凡课初传卯酉为用，将乘后合，为淫泆课。如用起六合，终于天后，为狡童格。”',
    detect(context) {
      const initial = context.transmissionBranches[0];
      const initialGod = context.transmissionGods?.[0];
      const finalGod = context.transmissionGods?.[2];
      return initial &&
        ['卯', '酉'].includes(initial) &&
        initialGod === '六合' &&
        finalGod === '天后'
        ? {
            branches: [...context.transmissionBranches],
            matchedConditions: [
              `初传${initial}乘六合，末传${context.transmissionBranches[2]}乘天后`,
            ],
          }
        : null;
    },
  },
  {
    id: 'tian-yu',
    name: '天狱课',
    category: '发用囚死墓',
    sourceTitle: '《六壬指南》卷一、卷二；《六壬大全》卷九·天狱课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬指南》卷一：“凡用神囚死更天罡加日本之上曰天狱卦。”卷二：“用死囚而斗加日本名曰天狱。”《六壬大全》：“凡课囚死墓神发用，斗系日本，为天狱卦。”“日本者，日干长生位也。”“亥为甲乙之本，寅为丙丁之本，申为戊己壬癸之本，巳为庚辛之本。”',
    detect(context) {
      if (!context.dayStem || !context.monthBranch || !context.heavenlyDragonGroundBranch) {
        return null;
      }
      const initial = context.transmissionBranches[0];
      const seasonState = getSeasonState(getBranchWuxing(initial), context.monthBranch);
      const tombBranch = ELEMENT_TOMB_BY_STEM[context.dayStem];
      const dayOrigin = LIUREN_DAY_ORIGIN_BY_STEM[context.dayStem];
      if (!tombBranch || !dayOrigin) return null;
      const initialCondition =
        seasonState === '囚' || seasonState === '死'
          ? `初传${initial}于月建${context.monthBranch}为${seasonState}`
          : initial === tombBranch
            ? `初传${initial}为日干${context.dayStem}五行墓位`
            : null;
      return initialCondition && context.heavenlyDragonGroundBranch === dayOrigin
        ? {
            branches: [initial, dayOrigin],
            matchedConditions: [initialCondition, `天罡辰临日干${context.dayStem}日本${dayOrigin}`],
          }
        : null;
    },
  },
  {
    id: 'jiu-chou',
    name: '九丑课',
    category: '大吉临仲',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '乙戊己辛壬日更得四仲相并而又大吉加仲上曰九丑卦。',
    detect(context) {
      if (!context.dayGanZhi || !context.greatAuspiciousGroundBranch) return null;
      const dayBranch = context.dayGanZhi.charAt(1);
      return JIU_CHOU_DAYS.has(context.dayGanZhi) &&
        context.greatAuspiciousGroundBranch === dayBranch
        ? {
            branches: [dayBranch],
            matchedConditions: [
              `日柱${context.dayGanZhi}为九丑十日之一，天盘大吉丑临日支${dayBranch}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'liu-yi',
    name: '六仪课',
    category: '旬仪发用',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '旬首发用为六仪。',
    detect(context) {
      if (!context.dayGanZhi) return null;
      const xunHead = getXunHead(context.dayGanZhi);
      const xunInstrument = xunHead.charAt(1);
      return context.transmissionBranches[0] === xunInstrument
        ? {
            branches: [xunInstrument],
            matchedConditions: [
              `日柱${context.dayGanZhi}属${xunHead}旬，旬首地支${xunInstrument}发用`,
            ],
          }
        : null;
    },
  },
  {
    id: 'xun-san-qi',
    name: '三奇课',
    category: '旬奇发用',
    sourceTitle: '《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_GUIDE_VOLUME_ONE_URL,
    sourceQuote: '三奇发用。子戌旬奇在丑，申午旬奇在子，辰寅旬中奇在亥。',
    detect(context) {
      if (!context.dayGanZhi) return null;
      const xunHead = getXunHead(context.dayGanZhi);
      const xunQi = XUN_QI_BY_HEAD[xunHead];
      if (!xunQi) throw new Error(`无法定位${xunHead}旬的旬奇。`);
      return context.transmissionBranches[0] === xunQi
        ? {
            branches: [xunQi],
            matchedConditions: [`日柱${context.dayGanZhi}属${xunHead}旬，旬奇${xunQi}发用`],
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
  assertValidLiurenGuaTiContext(context);
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
