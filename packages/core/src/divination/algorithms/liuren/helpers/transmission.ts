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
import {
  DIZHI,
  FORWARD_GENERAL_GROUND_BRANCHES,
  getDayStemResidence,
  getGanZhiWuxing,
  isBranchKe,
  REVERSE_GENERAL_GROUND_BRANCHES,
  TIANGAN,
  TIANJIANG,
} from './plate';
import { getLiurenMonthlyCompositeBranch, getLiurenTianMaBranch } from './shensha';

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
const LIUREN_DAQUAN_VOLUME_SIX_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/6&oldid=854574';
const LIUREN_DAQUAN_VOLUME_SEVEN_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/7&oldid=854575';
const LIUREN_DAQUAN_VOLUME_EIGHT_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/8&oldid=854576';
const LIUREN_DAQUAN_VOLUME_NINE_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/9&oldid=854578';
const LIUREN_DAQUAN_VOLUME_TEN_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/10&oldid=854579';
const LIUREN_DAQUAN_VOLUME_ELEVEN_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/11&oldid=854580';
const LIUREN_DAQUAN_VOLUME_TWELVE_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬大全/12&oldid=854581';
const LIUREN_GUIDE_VOLUME_TWO_URL =
  'https://zh.wikisource.org/w/index.php?title=六壬指南/2&oldid=854505';
const YANG_BRANCHES: ReadonlySet<string> = new Set(['子', '寅', '辰', '午', '申', '戌']);
const YIN_BRANCHES: ReadonlySet<string> = new Set(['丑', '卯', '巳', '未', '酉', '亥']);
const AUSPICIOUS_GENERALS: ReadonlySet<string> = new Set([
  '贵人',
  '六合',
  '青龙',
  '太常',
  '太阴',
  '天后',
]);
const INAUSPICIOUS_GENERALS: ReadonlySet<string> = new Set([
  '螣蛇',
  '朱雀',
  '勾陈',
  '天空',
  '白虎',
  '玄武',
]);
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
const TOMB_BRANCH_BY_ELEMENT: Readonly<Record<string, string>> = {
  木: '未',
  火: '戌',
  土: '辰',
  金: '丑',
  水: '辰',
};
const DAY_GHOST_BRANCHES_BY_STEM: Readonly<Record<string, readonly string[]>> = {
  甲: ['申'],
  乙: ['酉'],
  丙: ['子'],
  丁: ['亥'],
  戊: ['寅'],
  己: ['卯'],
  庚: ['午'],
  辛: ['巳'],
  壬: ['辰', '戌'],
  癸: ['丑', '未'],
};

export interface LiurenGuaTiContext {
  transmissionBranches: string[];
  transmissionGods?: string[];
  transmissionGroundBranches?: string[];
  dayGanZhi?: string;
  dayStem?: string;
  dayBranch?: string;
  hourBranch?: string;
  initialGroundBranch?: string;
  finalGroundBranch?: string;
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

  if (context.transmissionGroundBranches !== undefined) {
    if (
      !Array.isArray(context.transmissionGroundBranches) ||
      context.transmissionGroundBranches.length !== 3
    ) {
      throw new Error('大六壬课体识别的三传所临地盘一经提供，就必须恰好包含初传、中传、末传三项。');
    }
    context.transmissionGroundBranches.forEach((branch, index) =>
      assertLiurenGuaTiBranch(branch, `第${index + 1}传所临地盘`),
    );
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
    [context.finalGroundBranch, '末传所临地盘'],
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

  if (
    context.initialGroundBranch !== undefined &&
    context.transmissionGroundBranches !== undefined &&
    context.initialGroundBranch !== context.transmissionGroundBranches[0]
  ) {
    throw new Error('初传所临地盘与三传所临地盘第一项不一致。');
  }
  if (
    context.finalGroundBranch !== undefined &&
    context.transmissionGroundBranches !== undefined &&
    context.finalGroundBranch !== context.transmissionGroundBranches[2]
  ) {
    throw new Error('末传所临地盘与三传所临地盘第三项不一致。');
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

function isGanZhiSheng(source: string, target: string) {
  return isSheng(getGanZhiWuxing(source), getGanZhiWuxing(target));
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

function getPreviousLiurenBranch(branch: string): string {
  const index = DIZHI.indexOf(branch as (typeof DIZHI)[number]);
  if (index < 0) throw new Error(`无法定位地支${branch}的前一位。`);
  return DIZHI[(index - 1 + DIZHI.length) % DIZHI.length];
}

function getNextLiurenBranch(branch: string): string {
  const index = DIZHI.indexOf(branch as (typeof DIZHI)[number]);
  if (index < 0) throw new Error(`无法定位地支${branch}的后一位。`);
  return DIZHI[(index + 1) % DIZHI.length];
}

function getLiurenXunTailBranch(dayGanZhi: string): string {
  const xunHeadBranch = getXunHead(dayGanZhi).charAt(1);
  const xunHeadIndex = DIZHI.indexOf(xunHeadBranch as (typeof DIZHI)[number]);
  if (xunHeadIndex < 0) throw new Error(`无法定位${dayGanZhi}的旬首地支。`);
  return DIZHI[(xunHeadIndex + 9) % DIZHI.length];
}

const TRANSMISSION_STAGE_NAMES = ['初传', '中传', '末传'] as const;

interface LiurenTransmissionVoidState {
  stage: (typeof TRANSMISSION_STAGE_NAMES)[number];
  branch: string;
  groundBranch: string;
  branchIsVoid: boolean;
  groundIsVoid: boolean;
  isEmpty: boolean;
}

function getLiurenVoidBranches(dayGanZhi: string): [string, string] {
  const xunHead = getXunHead(dayGanZhi);
  const xunHeadIndex = DIZHI.indexOf(xunHead.charAt(1) as (typeof DIZHI)[number]);
  if (xunHeadIndex < 0) throw new Error(`无法定位${dayGanZhi}的旬首地支。`);
  return [DIZHI[(xunHeadIndex + 10) % 12], DIZHI[(xunHeadIndex + 11) % 12]];
}

function getTransmissionVoidStates(
  context: LiurenGuaTiContext,
): LiurenTransmissionVoidState[] | null {
  if (!context.dayGanZhi || !context.transmissionGroundBranches) return null;
  const voidBranches = new Set(getLiurenVoidBranches(context.dayGanZhi));
  return context.transmissionBranches.map((branch, index) => {
    const groundBranch = context.transmissionGroundBranches?.[index];
    if (!groundBranch) throw new Error(`缺少第${index + 1}传所临地盘。`);
    const branchIsVoid = voidBranches.has(branch);
    const groundIsVoid = voidBranches.has(groundBranch);
    return {
      stage: TRANSMISSION_STAGE_NAMES[index],
      branch,
      groundBranch,
      branchIsVoid,
      groundIsVoid,
      isEmpty: branchIsVoid || groundIsVoid,
    };
  });
}

function describeTransmissionVoidState(state: LiurenTransmissionVoidState): string {
  if (state.branchIsVoid && state.groundIsVoid) {
    return `${state.stage}${state.branch}旬空且所临地盘${state.groundBranch}空`;
  }
  if (state.branchIsVoid) return `${state.stage}${state.branch}旬空`;
  if (state.groundIsVoid) {
    return `${state.stage}${state.branch}所临地盘${state.groundBranch}空`;
  }
  return `${state.stage}${state.branch}及所临地盘${state.groundBranch}均实`;
}

function getAllEmptyTransmissionMatch(context: LiurenGuaTiContext) {
  const states = getTransmissionVoidStates(context);
  return states?.every((state) => state.isEmpty)
    ? {
        states,
        branches: [...context.transmissionBranches, ...(context.transmissionGroundBranches || [])],
        matchedConditions: states.map(describeTransmissionVoidState),
      }
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

const LIUREN_DAQUAN_INTERVAL_RULE_SPECS = [
  { id: 'deng-san-tian', name: '登三天格', branches: ['辰', '午', '申'] },
  { id: 'chu-san-tian', name: '出三天格', branches: ['午', '申', '戌'] },
  { id: 'she-san-yuan', name: '涉三渊格', branches: ['申', '戌', '子'] },
  { id: 'ru-san-yuan', name: '入三渊格', branches: ['戌', '子', '寅'] },
  { id: 'xiang-yang', name: '向阳格', branches: ['子', '寅', '辰'] },
  { id: 'chu-yang', name: '出阳格', branches: ['寅', '辰', '午'] },
  { id: 'chu-hu', name: '出户格', branches: ['丑', '卯', '巳'] },
  { id: 'ying-yang', name: '盈阳格', branches: ['卯', '巳', '未'] },
  { id: 'chong-ying', name: '充盈格', branches: ['巳', '未', '酉'] },
  { id: 'ru-ming', name: '入冥格', branches: ['未', '酉', '亥'] },
  { id: 'ning-yin', name: '凝阴格', branches: ['酉', '亥', '丑'] },
  { id: 'ming-meng', name: '溟蒙格', branches: ['亥', '丑', '卯'] },
  { id: 'ming-yin', name: '冥阴格', branches: ['寅', '子', '戌'] },
  { id: 'yan-jian', name: '偃蹇格', branches: ['子', '戌', '申'] },
  { id: 'bei-li', name: '悖戾格', branches: ['戌', '申', '午'] },
  { id: 'ning-yang', name: '凝阳格', branches: ['申', '午', '辰'] },
  { id: 'gu-zu', name: '顾祖格', branches: ['午', '辰', '寅'] },
  { id: 'she-yi', name: '涉疑格', branches: ['辰', '寅', '子'] },
  { id: 'ji-yin', name: '极阴格', branches: ['丑', '亥', '酉'] },
  { id: 'shi-dun', name: '时遁格', branches: ['亥', '酉', '未'] },
  { id: 'li-ming', name: '励明格', branches: ['酉', '未', '巳'] },
  { id: 'hui-ming', name: '回明格', branches: ['未', '巳', '卯'] },
  { id: 'zhuan-bei', name: '转悖格', branches: ['巳', '卯', '丑'] },
  { id: 'duan-jian', name: '断涧格', branches: ['卯', '丑', '亥'] },
] as const;

const LIUREN_DAQUAN_INTERVAL_RULES: LiurenGuaTiRule[] = LIUREN_DAQUAN_INTERVAL_RULE_SPECS.map(
  (spec) => ({
    id: spec.id,
    name: spec.name,
    category: '三传顺逆',
    sourceTitle: '《六壬大全》卷十·间传课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote: `《六壬大全》：“${spec.branches.join('')}为${spec.name}。”当前只登记初中末传的固定次序。`,
    detect: (context) =>
      context.transmissionBranches.every((branch, index) => branch === spec.branches[index])
        ? {
            branches: [...spec.branches],
            matchedConditions: [`三传固定为${spec.branches.join('、')}`],
          }
        : null,
  }),
);

const LIUREN_DAQUAN_COMBINATION_SELF_PUNISHMENT_SPECS = [
  {
    id: 'jin-gang',
    name: '金刚格',
    transmissionBranches: ['巳', '酉', '丑'],
    repeatedBranch: '酉',
  },
  {
    id: 'huo-qiang',
    name: '火强格',
    transmissionBranches: ['寅', '午', '戌'],
    repeatedBranch: '午',
  },
  {
    id: 'shui-liu-qu-dong',
    name: '水流趋东格',
    transmissionBranches: ['申', '子', '辰'],
    repeatedBranch: '辰',
  },
  {
    id: 'mu-luo-gui-gen',
    name: '木落归根格',
    transmissionBranches: ['亥', '卯', '未'],
    repeatedBranch: '亥',
  },
] as const;

const LIUREN_DAQUAN_COMBINATION_SELF_PUNISHMENT_RULES: LiurenGuaTiRule[] =
  LIUREN_DAQUAN_COMBINATION_SELF_PUNISHMENT_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    category: '三合成局',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote: `《六壬大全》：“${spec.transmissionBranches.join('')}三合为三传，支干上复见${spec.repeatedBranch}者，为${spec.name}。”当前只登记三传全局且干支任一上神复见指定支的结构。`,
    detect(context) {
      if (!context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return hasSameBranchSet(context.transmissionBranches, [...spec.transmissionBranches]) &&
        [stemUpper, branchUpper].includes(spec.repeatedBranch)
        ? {
            branches: [...context.transmissionBranches, stemUpper, branchUpper],
            matchedConditions: [
              `三传为${spec.transmissionBranches.join('、')}全局，干上神${stemUpper}、支上神${branchUpper}中复见${spec.repeatedBranch}`,
            ],
          }
        : null;
    },
  }));

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
  ...LIUREN_DAQUAN_COMBINATION_SELF_PUNISHMENT_RULES,
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
  ...LIUREN_DAQUAN_INTERVAL_RULES,
  {
    id: 'zhuang-gan',
    name: '撞干格',
    category: '日辰关隔',
    sourceTitle: '《六壬大全》卷十·撞干格',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“干支前一位为关隔……初末传撞日之关……如辛巳日三传丑亥酉……末传撞辛之关。”当前只登记初传或末传碰到日干寄宫前一位的固定结构。',
    detect(context) {
      if (!context.dayStem) return null;
      const stemResidence = getDayStemResidence(context.dayStem);
      const barrier = getPreviousLiurenBranch(stemResidence);
      const matchedStages = [
        ...(context.transmissionBranches[0] === barrier ? ['初传'] : []),
        ...(context.transmissionBranches[2] === barrier ? ['末传'] : []),
      ];
      return matchedStages.length
        ? {
            branches: [barrier, stemResidence],
            matchedConditions: [
              `日干${context.dayStem}寄宫${stemResidence}的前一位关隔为${barrier}，${matchedStages.join('、')}撞关`,
            ],
          }
        : null;
    },
  },
  {
    id: 'zhuang-zhi',
    name: '撞支格',
    category: '日辰关隔',
    sourceTitle: '《六壬大全》卷十·撞支格',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“干支前一位为关隔……三传通连日之支辰，为撞支格。盖初末传撞支之隔。”当前只登记初传或末传碰到日支前一位的固定结构。',
    detect(context) {
      if (!context.dayBranch) return null;
      const barrier = getPreviousLiurenBranch(context.dayBranch);
      const matchedStages = [
        ...(context.transmissionBranches[0] === barrier ? ['初传'] : []),
        ...(context.transmissionBranches[2] === barrier ? ['末传'] : []),
      ];
      return matchedStages.length
        ? {
            branches: [barrier, context.dayBranch],
            matchedConditions: [
              `日支${context.dayBranch}的前一位关隔为${barrier}，${matchedStages.join('、')}撞关`,
            ],
          }
        : null;
    },
  },
  {
    id: 'zhou-er-fu-shi',
    name: '周而复始格',
    category: '旬首旬尾',
    sourceTitle: '《六壬大全》卷十一·首尾相见始终宜',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“干上有旬尾，支上有旬首，名周而复始格，亦名一旬周遍格。”下文另列干上旬首、支上旬尾的反向结构；当前两向均只登记旬首旬尾落位事实。',
    detect(context) {
      if (!context.dayGanZhi || !context.fourLessons) return null;
      const xunHead = getXunHead(context.dayGanZhi).charAt(1);
      const xunTail = getLiurenXunTailBranch(context.dayGanZhi);
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const isForward = stemUpper === xunTail && branchUpper === xunHead;
      const isReverse = stemUpper === xunHead && branchUpper === xunTail;
      return isForward || isReverse
        ? {
            branches: [stemUpper, branchUpper],
            matchedConditions: [
              `${context.dayGanZhi}属${getXunHead(context.dayGanZhi)}旬，干上神${stemUpper}与支上神${branchUpper}分居旬${isForward ? '尾、旬首' : '首、旬尾'}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'zhi-chuan-gan',
    name: '支传干格',
    category: '四课关系',
    sourceTitle: '《六壬大全》卷十一·彼求我事支传干',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“谓初传从支上起，末传归干上者。”当前只登记初传等于支上神、末传等于干上神的首末结构。',
    detect(context) {
      if (!context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return context.transmissionBranches[0] === branchUpper &&
        context.transmissionBranches[2] === stemUpper
        ? {
            branches: [branchUpper, stemUpper],
            matchedConditions: [`初传从支上神${branchUpper}起，末传归干上神${stemUpper}`],
          }
        : null;
    },
  },
  {
    id: 'gan-chuan-zhi',
    name: '干传支格',
    category: '四课关系',
    sourceTitle: '《六壬大全》卷十一·我求彼事干传支',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“谓初传从干上起，末传归在支上者。”当前只登记初传等于干上神、末传等于支上神的首末结构。',
    detect(context) {
      if (!context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return context.transmissionBranches[0] === stemUpper &&
        context.transmissionBranches[2] === branchUpper
        ? {
            branches: [stemUpper, branchUpper],
            matchedConditions: [`初传从干上神${stemUpper}起，末传归支上神${branchUpper}`],
          }
        : null;
    },
  },
  {
    id: 'zi-sheng-chuan-mu',
    name: '自生传墓格',
    category: '三传支类',
    sourceTitle: '《六壬大全》卷十一·有始无终难变易',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“初传是日之长生，末传为干之墓……自生传墓。”当前只登记初传为日干长生、末传为日干墓位的结构。',
    detect(context) {
      if (!context.dayStem) return null;
      const dayOrigin = LIUREN_DAY_ORIGIN_BY_STEM[context.dayStem];
      const dayTomb = ELEMENT_TOMB_BY_STEM[context.dayStem];
      return context.transmissionBranches[0] === dayOrigin &&
        context.transmissionBranches[2] === dayTomb
        ? {
            branches: [dayOrigin, dayTomb],
            matchedConditions: [
              `初传${dayOrigin}为日干${context.dayStem}长生，末传${dayTomb}为日干墓位`,
            ],
          }
        : null;
    },
  },
  {
    id: 'zi-mu-chuan-sheng',
    name: '自墓传生格',
    category: '三传支类',
    sourceTitle: '《六壬大全》卷十一·有始无终难变易',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“初为干墓，末传为干之长生……自墓传生。”当前只登记初传为日干墓位、末传为日干长生的结构。',
    detect(context) {
      if (!context.dayStem) return null;
      const dayOrigin = LIUREN_DAY_ORIGIN_BY_STEM[context.dayStem];
      const dayTomb = ELEMENT_TOMB_BY_STEM[context.dayStem];
      return context.transmissionBranches[0] === dayTomb &&
        context.transmissionBranches[2] === dayOrigin
        ? {
            branches: [dayTomb, dayOrigin],
            matchedConditions: [
              `初传${dayTomb}为日干${context.dayStem}墓位，末传${dayOrigin}为日干长生`,
            ],
          }
        : null;
    },
  },
  {
    id: 'kui-du-tian-men',
    name: '魁度天门格',
    category: '发用临地',
    sourceTitle: '《六壬大全》卷十二·魁度天门关隔定',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“谓戌为天魁，亥为天门，凡戌加亥为用者。”当前只登记天魁戌临地盘亥发用的固定结构。',
    detect(context) {
      if (!context.transmissionGroundBranches) return null;
      return context.transmissionBranches[0] === '戌' &&
        context.transmissionGroundBranches[0] === '亥'
        ? {
            branches: ['戌', '亥'],
            matchedConditions: ['天魁戌临地盘天门亥发用'],
          }
        : null;
    },
  },
  {
    id: 'gang-sai-gui-hu',
    name: '罡塞鬼户格',
    category: '天罡临地',
    sourceTitle: '《六壬大全》卷十二·罡塞鬼户任谋为',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“谓辰为天罡，寅为鬼户，凡辰加寅为罡塞鬼门，不论在传不在传。”当前只登记天盘辰临地盘寅的固定天地盘结构。',
    detect: (context) =>
      context.heavenlyDragonGroundBranch === '寅'
        ? {
            branches: ['辰', '寅'],
            matchedConditions: ['天盘天罡辰临地盘鬼户寅'],
          }
        : null,
  },
  {
    id: 'gan-zhi-luo-wang',
    name: '干支罗网格',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·所谋多拙逢罗网',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“谓干上乘干前一辰，支上乘支前一辰，故名一在罗地网。”当前只登记干支上神分别为日干寄宫、日支后一位的固定结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemResidence = getDayStemResidence(context.dayStem);
      const stemNet = getNextLiurenBranch(stemResidence);
      const branchNet = getNextLiurenBranch(context.dayBranch);
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return stemUpper === stemNet && branchUpper === branchNet
        ? {
            branches: [stemNet, branchNet],
            matchedConditions: [
              `干上神${stemUpper}为日干${context.dayStem}寄宫${stemResidence}后一位，支上神${branchUpper}为日支${context.dayBranch}后一位`,
            ],
          }
        : null;
    },
  },
  {
    id: 'san-liu-he',
    name: '三六合格',
    category: '三合成局',
    sourceTitle: '《六壬大全》卷十二·万事喜忻三六合',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》分列寅午戌见未、亥卯未见戌、申子辰见丑、巳酉丑见辰四种“三合中有六合”结构。当前只登记三传成局且干支任一上神复见对应六合支。',
    detect(context) {
      if (!context.fourLessons) return null;
      const upperBranches = [context.fourLessons[0].upper, context.fourLessons[2].upper];
      const spec = [
        { sanhe: ['寅', '午', '戌'], companion: '未' },
        { sanhe: ['亥', '卯', '未'], companion: '戌' },
        { sanhe: ['申', '子', '辰'], companion: '丑' },
        { sanhe: ['巳', '酉', '丑'], companion: '辰' },
      ].find(
        (candidate) =>
          hasSameBranchSet(context.transmissionBranches, candidate.sanhe) &&
          upperBranches.includes(candidate.companion),
      );
      return spec
        ? {
            branches: [...context.transmissionBranches, spec.companion],
            matchedConditions: [
              `三传${context.transmissionBranches.join('、')}成三合局，干支上神复见六合支${spec.companion}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'he-zhong-fan-sha',
    name: '合中犯杀格',
    category: '三合成局',
    sourceTitle: '《六壬大全》卷十二·合中犯杀蜜中砒',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》逐局列出三合局在干支上神复见本局自刑、六害或六冲支的十二种固定结构。当前只登记对应犯杀支复见，不继承现实断语。',
    detect(context) {
      if (!context.fourLessons) return null;
      const upperBranches = [context.fourLessons[0].upper, context.fourLessons[2].upper];
      const spec = [
        { sanhe: ['寅', '午', '戌'], offenders: ['午', '丑', '子'] },
        { sanhe: ['亥', '卯', '未'], offenders: ['子', '辰', '酉'] },
        { sanhe: ['申', '子', '辰'], offenders: ['卯', '未', '午'] },
        { sanhe: ['巳', '酉', '丑'], offenders: ['酉', '戌', '卯'] },
      ].find((candidate) => hasSameBranchSet(context.transmissionBranches, candidate.sanhe));
      if (!spec) return null;
      const matchedOffenders = [
        ...new Set(upperBranches.filter((branch) => spec.offenders.includes(branch))),
      ];
      return matchedOffenders.length
        ? {
            branches: [...context.transmissionBranches, ...matchedOffenders],
            matchedConditions: [
              `三传${context.transmissionBranches.join('、')}成三合局，干支上神复见本局犯杀支${matchedOffenders.join('、')}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'san-chuan-jie-kong',
    name: '三传皆空格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十二·毕法赋；《六壬粹言》卷三·毕法赋；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“谓三传皆空亡者是也。”《六壬粹言》分列“三传皆空格”，《御定六壬直指》按传支旬空或所临地盘空逐传复核。当前只登记初中末三传全部空陷的结构。',
    detect(context) {
      const match = getAllEmptyTransmissionMatch(context);
      return match
        ? { branches: match.branches, matchedConditions: match.matchedConditions }
        : null;
    },
  },
  {
    id: 'si-ke-quan-kong',
    name: '四课全空格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“四课全空格，四课无形。”原例逐课分别按上神旬空或所临下位空核对；当前只登记四课逐课均有一层空亡的结构。',
    detect(context) {
      if (!context.dayGanZhi || !context.fourLessons) return null;
      const voidBranches = new Set(getLiurenVoidBranches(context.dayGanZhi));
      const states = context.fourLessons.map((lesson, index) => {
        const upperIsVoid = voidBranches.has(lesson.upper);
        const lowerIsVoid = voidBranches.has(lesson.lower);
        return {
          isEmpty: upperIsVoid || lowerIsVoid,
          branches: [upperIsVoid ? lesson.upper : '', lowerIsVoid ? lesson.lower : ''].filter(
            Boolean,
          ),
          condition: upperIsVoid
            ? `第${index + 1}课上神${lesson.upper}旬空`
            : lowerIsVoid
              ? `第${index + 1}课所临下位${lesson.lower}空`
              : `第${index + 1}课上下均实`,
        };
      });
      return states.every((state) => state.isEmpty)
        ? {
            branches: states.flatMap((state) => state.branches),
            matchedConditions: states.map((state) => state.condition),
          }
        : null;
    },
  },
  {
    id: 'fa-yong-shang-xia-jie-kong',
    name: '发用上下皆空格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十二·毕法赋；《六壬粹言》卷三·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬粹言》：“谓发用旬空，又坐空乡。”《六壬大全》分别说明发用天盘旬空与地盘空。当前要求初传本支与其所临地盘同时属于本日旬空。',
    detect(context) {
      const initial = getTransmissionVoidStates(context)?.[0];
      return initial?.branchIsVoid && initial.groundIsVoid
        ? {
            branches: [initial.branch, initial.groundBranch],
            matchedConditions: [describeTransmissionVoidState(initial)],
          }
        : null;
    },
  },
  {
    id: 'du-chuan-bu-xing',
    name: '杜传不行格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十二·毕法赋；《六壬粹言》卷三·毕法赋；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬粹言》：“杜传不行，谓初实而中末空亡也。”《六壬大全》《御定六壬直指》均以中末俱空而只存初传复核。当前严格要求初传不空、中末两传均空陷。',
    detect(context) {
      const states = getTransmissionVoidStates(context);
      return states && !states[0].isEmpty && states[1].isEmpty && states[2].isEmpty
        ? {
            branches: [
              ...context.transmissionBranches,
              ...(context.transmissionGroundBranches || []),
            ],
            matchedConditions: states.map(describeTransmissionVoidState),
          }
        : null;
    },
  },
  {
    id: 'zhong-chuan-duan-qiao',
    name: '断桥格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十二·毕法赋；《六壬粹言》卷三·毕法赋；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》《六壬粹言》均称“中传空，为断桥”，《御定六壬直指》又称“断桥折腰”。当前只登记中传本支旬空或所临地盘空的结构。',
    detect(context) {
      const middle = getTransmissionVoidStates(context)?.[1];
      return middle?.isEmpty
        ? {
            branches: [middle.branch, middle.groundBranch],
            matchedConditions: [describeTransmissionVoidState(middle)],
          }
        : null;
    },
  },
  {
    id: 'sheng-chuan-kong-gu',
    name: '声传空谷格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十一·毕法赋；《六壬指南》卷二·指掌赋；《六壬粹言》卷三·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“进茹空亡宜退步”，并以三传寅卯辰、辰巳午皆空为例；《六壬指南》《六壬粹言》称“声传空谷”。当前只登记进茹三传全部空陷。',
    detect(context) {
      const match = getAllEmptyTransmissionMatch(context);
      if (!match || !matchConsecutiveTransmissions(context, 1, '')) return null;
      return {
        branches: match.branches,
        matchedConditions: [
          `三传${context.transmissionBranches.join('、')}顺行逐支相连`,
          ...match.matchedConditions,
        ],
      };
    },
  },
  {
    id: 'jiao-ta-kong-wang',
    name: '脚踏空亡格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十一·毕法赋；《六壬指南》卷二·指掌赋；《六壬粹言》卷三·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“谓退步传全值空亡者，故名踏脚空亡。”《六壬指南》《六壬粹言》同以退茹三传全部空陷复核。当前不继承进退或现实吉凶断语。',
    detect(context) {
      const match = getAllEmptyTransmissionMatch(context);
      if (!match || !matchConsecutiveTransmissions(context, -1, '')) return null;
      return {
        branches: match.branches,
        matchedConditions: [
          `三传${context.transmissionBranches.join('、')}逆行逐支相连`,
          ...match.matchedConditions,
        ],
      };
    },
  },
  {
    id: 'lai-qu-ju-kong',
    name: '来去俱空格',
    category: '课传空陷',
    sourceTitle: '《六壬大全》卷十二·毕法赋；《六壬粹言》卷三·返吟；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“来去者，返吟卦也……内有三传皆空亡者。”《六壬粹言》《御定六壬直指》亦按返吟三传空陷复核。当前只登记返吟天地盘与三传皆空的共同结构。',
    detect(context) {
      const match = getAllEmptyTransmissionMatch(context);
      return match &&
        !!context.monthLeader &&
        !!context.hourBranch &&
        LIUCHONG_MAP[context.monthLeader] === context.hourBranch
        ? {
            branches: [...match.branches, context.monthLeader, context.hourBranch],
            matchedConditions: [
              `月将${context.monthLeader}与占时${context.hourBranch}六冲，天地盘为返吟`,
              ...match.matchedConditions,
            ],
          }
        : null;
    },
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
    id: 'de-ru-tian-men',
    name: '德入天门格',
    category: '日辰发用',
    sourceTitle: '《六壬大全》卷十一·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_ELEVEN_URL,
    sourceQuote:
      '《六壬大全》：“德入天门格，乃日德加亥为用。”依本书日德表，丁、壬日的日德为亥；当前只登记丁壬日亥发用。',
    detect(context) {
      const initial = context.transmissionBranches[0];
      return context.dayStem && ['丁', '壬'].includes(context.dayStem) && initial === '亥'
        ? {
            branches: [initial],
            matchedConditions: [`日干${context.dayStem}之日德为亥，初传亥发用并居天门`],
          }
        : null;
    },
  },
  {
    id: 'san-yang',
    name: '三阳课',
    category: '贵顺旺相',
    sourceTitle: '《六壬大全》卷七·课经集一·三阳课；《六壬心镜》·吉泰门',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SEVEN_URL,
    sourceQuote:
      '《六壬大全》：“天乙顺行，日辰有气居前，旺相气发用，为三阳课。”《订讹》：“天乙顺行，日辰居前，发用旺相。”《六壬心镜》：“天乙顺行为正理……日辰有气复居前……立用之神兼旺相。”当前按贵人顺布、干支上神均在贵人前五位、初传旺相登记。',
    detect(context) {
      if (
        !context.monthBranch ||
        !context.noblemanBranch ||
        !context.noblemanGroundBranch ||
        !context.fourLessons ||
        !FORWARD_GENERAL_GROUND_BRANCHES.has(context.noblemanGroundBranch)
      ) {
        return null;
      }
      const initial = context.transmissionBranches[0];
      const initialState = getSeasonState(getBranchWuxing(initial), context.monthBranch);
      if (initialState !== '旺' && initialState !== '相') return null;
      const noblemanIndex = DIZHI.indexOf(context.noblemanBranch as (typeof DIZHI)[number]);
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const getForwardStep = (upper: string) =>
        (DIZHI.indexOf(upper as (typeof DIZHI)[number]) - noblemanIndex + DIZHI.length) %
        DIZHI.length;
      const stemStep = getForwardStep(stemUpper);
      const branchStep = getForwardStep(branchUpper);
      if (stemStep < 1 || stemStep > 5 || branchStep < 1 || branchStep > 5) return null;
      return {
        branches: [initial, context.noblemanBranch, stemUpper, branchUpper],
        matchedConditions: [
          `贵人${context.noblemanBranch}临地盘${context.noblemanGroundBranch}，十二天将顺布`,
          `干上神${stemUpper}与支上神${branchUpper}分别居贵人前第${stemStep}、${branchStep}位`,
          `初传${initial}于月建${context.monthBranch}为${initialState}`,
        ],
      };
    },
  },
  {
    id: 'liu-yang',
    name: '六阳课',
    category: '课传阴阳',
    sourceTitle: '《六壬大全》卷十·六纯课；《六壬灵觉经》·六阳六阴课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“凡四课三传俱阳……为六阳课。”《六壬灵觉经》：“凡四课三传俱阳神，或四课三传俱阴神，皆名六纯课。”当前只登记四课上神与三传七处纯阳结构。',
    detect(context) {
      if (!context.fourLessons) return null;
      const branches = [
        ...context.fourLessons.map((lesson) => lesson.upper),
        ...context.transmissionBranches,
      ];
      return branches.every((branch) => YANG_BRANCHES.has(branch))
        ? {
            branches,
            matchedConditions: [
              `四课上神${context.fourLessons.map((lesson) => lesson.upper).join('、')}与三传${context.transmissionBranches.join('、')}均为阳支`,
            ],
          }
        : null;
    },
  },
  {
    id: 'liu-yin',
    name: '六阴课',
    category: '课传阴阳',
    sourceTitle: '《六壬大全》卷十·六纯课；《六壬灵觉经》·六阳六阴课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“若四课阴……中末皆阴，为六阴格。”《六壬灵觉经》：“凡四课三传俱阳神，或四课三传俱阴神，皆名六纯课。”当前只登记四课上神与三传七处纯阴结构。',
    detect(context) {
      if (!context.fourLessons) return null;
      const branches = [
        ...context.fourLessons.map((lesson) => lesson.upper),
        ...context.transmissionBranches,
      ];
      return branches.every((branch) => YIN_BRANCHES.has(branch))
        ? {
            branches,
            matchedConditions: [
              `四课上神${context.fourLessons.map((lesson) => lesson.upper).join('、')}与三传${context.transmissionBranches.join('、')}均为阴支`,
            ],
          }
        : null;
    },
  },
  {
    id: 'si-shun',
    name: '四顺课',
    category: '贵人顺逆',
    sourceTitle: '《六壬大全》卷七·课经集一·四顺课；《六壬灵觉经》·四顺课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SEVEN_URL,
    sourceQuote:
      '《六壬大全》：“初神将凶，末神吉；初死囚，末旺相；天乙顺行；传出天乙前。”《六壬灵觉经》：“用起凶神恶将，传得吉神良将；用起囚死，传得旺相；贵人顺治；传出贵人前。”当前只登记四项结构同时成立。',
    detect(context) {
      const initialGod = context.transmissionGods?.[0];
      const finalGod = context.transmissionGods?.[2];
      if (
        !initialGod ||
        !finalGod ||
        !context.monthBranch ||
        !context.noblemanBranch ||
        !context.noblemanGroundBranch ||
        !INAUSPICIOUS_GENERALS.has(initialGod) ||
        !AUSPICIOUS_GENERALS.has(finalGod) ||
        !FORWARD_GENERAL_GROUND_BRANCHES.has(context.noblemanGroundBranch)
      ) {
        return null;
      }
      const initial = context.transmissionBranches[0];
      const final = context.transmissionBranches[2];
      const initialState = getSeasonState(getBranchWuxing(initial), context.monthBranch);
      const finalState = getSeasonState(getBranchWuxing(final), context.monthBranch);
      const finalStep =
        (DIZHI.indexOf(final as (typeof DIZHI)[number]) -
          DIZHI.indexOf(context.noblemanBranch as (typeof DIZHI)[number]) +
          DIZHI.length) %
        DIZHI.length;
      if (
        !['囚', '死'].includes(initialState) ||
        !['旺', '相'].includes(finalState) ||
        finalStep < 1 ||
        finalStep > 5
      ) {
        return null;
      }
      return {
        branches: [initial, final, context.noblemanBranch],
        matchedConditions: [
          `初传${initial}乘${initialGod}，末传${final}乘${finalGod}`,
          `初传于月建${context.monthBranch}为${initialState}，末传为${finalState}`,
          `贵人${context.noblemanBranch}临地盘${context.noblemanGroundBranch}顺布，末传居贵人前第${finalStep}位`,
        ],
      };
    },
  },
  {
    id: 'si-ni',
    name: '四逆课',
    category: '贵人顺逆',
    sourceTitle: '《六壬大全》卷十·四逆课；《六壬灵觉经》·四逆课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“用吉终凶；用旺终衰；天乙逆行；传入天乙后。”《六壬灵觉经》同列用吉终凶、用旺终衰、贵人逆治、传入贵人后四项。当前只登记四项结构同时成立。',
    detect(context) {
      const initialGod = context.transmissionGods?.[0];
      const finalGod = context.transmissionGods?.[2];
      if (
        !initialGod ||
        !finalGod ||
        !context.monthBranch ||
        !context.noblemanBranch ||
        !context.noblemanGroundBranch ||
        !AUSPICIOUS_GENERALS.has(initialGod) ||
        !INAUSPICIOUS_GENERALS.has(finalGod) ||
        !REVERSE_GENERAL_GROUND_BRANCHES.has(context.noblemanGroundBranch)
      ) {
        return null;
      }
      const initial = context.transmissionBranches[0];
      const final = context.transmissionBranches[2];
      const initialState = getSeasonState(getBranchWuxing(initial), context.monthBranch);
      const finalState = getSeasonState(getBranchWuxing(final), context.monthBranch);
      const finalStep =
        (DIZHI.indexOf(final as (typeof DIZHI)[number]) -
          DIZHI.indexOf(context.noblemanBranch as (typeof DIZHI)[number]) +
          DIZHI.length) %
        DIZHI.length;
      if (
        !['旺', '相'].includes(initialState) ||
        !['囚', '死'].includes(finalState) ||
        finalStep < 6 ||
        finalStep > 11
      ) {
        return null;
      }
      return {
        branches: [initial, final, context.noblemanBranch],
        matchedConditions: [
          `初传${initial}乘${initialGod}，末传${final}乘${finalGod}`,
          `初传于月建${context.monthBranch}为${initialState}，末传为${finalState}`,
          `贵人${context.noblemanBranch}临地盘${context.noblemanGroundBranch}逆布，末传居贵人后第${12 - finalStep}位`,
        ],
      };
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
    id: 'tian-xin',
    name: '天心格',
    category: '四建聚合',
    sourceTitle: '《六壬大全》卷十·天心格；《六壬粹言》卷三·经课；《六壬寻源》',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“岁月日时俱在四课之上，或俱在三传之中。”《六壬粹言》分列“四建全在四课中”与“四建全在三传中”。当前不把两个容器拆开取并集。',
    detect(context) {
      if (
        !context.yearBranch ||
        !context.monthBranch ||
        !context.dayBranch ||
        !context.hourBranch
      ) {
        return null;
      }
      const fourEstablishments = [
        context.yearBranch,
        context.monthBranch,
        context.dayBranch,
        context.hourBranch,
      ];
      const lessonUppers = new Set(context.fourLessons?.map((lesson) => lesson.upper) ?? []);
      const transmissionBranches = new Set(context.transmissionBranches);
      const allInLessons =
        !!context.fourLessons && fourEstablishments.every((branch) => lessonUppers.has(branch));
      const allInTransmissions = fourEstablishments.every((branch) =>
        transmissionBranches.has(branch),
      );
      if (!allInLessons && !allInTransmissions) return null;
      return {
        branches: fourEstablishments,
        matchedConditions: [
          `太岁${context.yearBranch}、月建${context.monthBranch}、日支${context.dayBranch}、占时${context.hourBranch}全在${allInLessons ? '四课上神' : '三传'}中`,
        ],
      };
    },
  },
  {
    id: 'pan-zhu',
    name: '盘珠课',
    category: '课传聚合',
    sourceTitle: '《六壬大全》卷十·盘珠课；《六壬寻源》',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“太岁、月建及日、时并三传皆在四课之中。”《六壬寻源》同列四建与三传全在四课的结构。',
    detect(context) {
      if (
        !context.yearBranch ||
        !context.monthBranch ||
        !context.dayBranch ||
        !context.hourBranch ||
        !context.fourLessons
      ) {
        return null;
      }
      const lessonUppers = new Set(context.fourLessons.map((lesson) => lesson.upper));
      const fourEstablishments = [
        context.yearBranch,
        context.monthBranch,
        context.dayBranch,
        context.hourBranch,
      ];
      if (
        !fourEstablishments.every((branch) => lessonUppers.has(branch)) ||
        !context.transmissionBranches.every((branch) => lessonUppers.has(branch))
      ) {
        return null;
      }
      return {
        branches: [...fourEstablishments, ...context.transmissionBranches],
        matchedConditions: [
          `太岁${context.yearBranch}、月建${context.monthBranch}、日支${context.dayBranch}、占时${context.hourBranch}及三传${context.transmissionBranches.join('、')}均见于四课上神`,
        ],
      };
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
    id: 'zhan-guan',
    name: '斩关课',
    category: '魁罡临日辰',
    sourceTitle: '《六壬指南》卷一、卷二；《六壬大全》卷八·斩关课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬指南》卷一：“魁罡加干支，上更得六合、青龙名斩关卦。”卷二：“日辰见辰戌又发用为斩关。”《六壬大全》：“凡卦魁罡加日辰发用，为斩关课。”',
    detect(context) {
      const initial = context.transmissionBranches[0];
      const initialGod = context.transmissionGods?.[0];
      if (
        !context.dayStem ||
        !context.dayBranch ||
        !context.initialGroundBranch ||
        !initialGod ||
        !['辰', '戌'].includes(initial) ||
        !['六合', '青龙'].includes(initialGod)
      ) {
        return null;
      }
      const dayStemResidence = getDayStemResidence(context.dayStem);
      const isOnDayStem = context.initialGroundBranch === dayStemResidence;
      const isOnDayBranch = context.initialGroundBranch === context.dayBranch;
      if (!isOnDayStem && !isOnDayBranch) return null;
      const position =
        isOnDayStem && isOnDayBranch
          ? `日干${context.dayStem}寄宫${dayStemResidence}及日支${context.dayBranch}`
          : isOnDayStem
            ? `日干${context.dayStem}寄宫${dayStemResidence}`
            : `日支${context.dayBranch}`;
      return {
        branches: [initial, context.initialGroundBranch],
        matchedConditions: [`初传${initial}临${position}并乘${initialGod}`],
      };
    },
  },
  {
    id: 'heng-tong',
    name: '亨通课',
    category: '三传递生',
    sourceTitle: '《六壬大全》卷八·亨通课；《六壬指南》卷二',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬大全》：“凡课用神生日，及三传递生日干……为亨通课。”《六壬指南》：“三传递生人举荐。”当前只取三传逐级相生并最终生日干的可复算结构。',
    detect(context) {
      if (!context.dayStem) return null;
      const [initial, middle, final] = context.transmissionBranches;
      const initialElement = getGanZhiWuxing(initial);
      const middleElement = getGanZhiWuxing(middle);
      const finalElement = getGanZhiWuxing(final);
      const dayElement = getGanZhiWuxing(context.dayStem);
      if (
        isSheng(initialElement, middleElement) &&
        isSheng(middleElement, finalElement) &&
        isSheng(finalElement, dayElement)
      ) {
        return {
          branches: [...context.transmissionBranches],
          matchedConditions: [
            `初传${initial}${initialElement}生中传${middle}${middleElement}，中传生末传${final}${finalElement}，末传生日干${context.dayStem}${dayElement}`,
          ],
        };
      }
      return isSheng(finalElement, middleElement) &&
        isSheng(middleElement, initialElement) &&
        isSheng(initialElement, dayElement)
        ? {
            branches: [...context.transmissionBranches],
            matchedConditions: [
              `末传${final}${finalElement}生中传${middle}${middleElement}，中传生初传${initial}${initialElement}，初传生日干${context.dayStem}${dayElement}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'ju-sheng',
    name: '俱生格',
    category: '干支生合',
    sourceTitle: '《六壬大全》卷六·毕法赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SIX_URL,
    sourceQuote:
      '《六壬大全》：“干上神生干，支上神生支，为俱生格。”《六壬粹言》：“谓干支各受上神之生。”当前只登记两处五行生关系。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return isGanZhiSheng(stemUpper, context.dayStem) &&
        isGanZhiSheng(branchUpper, context.dayBranch)
        ? {
            branches: [stemUpper, context.dayBranch, branchUpper],
            matchedConditions: [
              `干上神${stemUpper}生日干${context.dayStem}，支上神${branchUpper}生日支${context.dayBranch}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'hu-sheng',
    name: '互生格',
    category: '干支生合',
    sourceTitle: '《六壬大全》卷六·毕法赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SIX_URL,
    sourceQuote:
      '《六壬大全》：“干上神生支，支上神生干，为互生格。”《六壬粹言》：“谓干支交车互生。”当前只登记两处交互五行生关系。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return isGanZhiSheng(stemUpper, context.dayBranch) &&
        isGanZhiSheng(branchUpper, context.dayStem)
        ? {
            branches: [stemUpper, context.dayBranch, branchUpper],
            matchedConditions: [
              `干上神${stemUpper}生日支${context.dayBranch}，支上神${branchUpper}生日干${context.dayStem}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'zi-zai',
    name: '自在格',
    category: '干支生合',
    sourceTitle: '《六壬大全》卷六·毕法赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SIX_URL,
    sourceQuote:
      '《六壬大全》：“支加干上而生日，为自在格。”《六壬粹言》列为支来生干的往来相生格。当前按日支加干并生日干的结构复算。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      return stemUpper === context.dayBranch && isGanZhiSheng(context.dayBranch, context.dayStem)
        ? {
            branches: [context.dayBranch],
            matchedConditions: [`日支${context.dayBranch}加临日干${context.dayStem}上并生日干`],
          }
        : null;
    },
  },
  {
    id: 'hu-wang',
    name: '互旺格',
    category: '干支生合',
    sourceTitle: '《六壬大全》卷六·毕法赋；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_SIX_URL,
    sourceQuote:
      '《六壬大全》《六壬粹言》均只列甲申、庚寅二日：甲申日干上酉、支上卯，庚寅日干上卯、支上酉。当前严格按这两种固定轮廓登记。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const day = `${context.dayStem}${context.dayBranch}`;
      const matches =
        (day === '甲申' && stemUpper === '酉' && branchUpper === '卯') ||
        (day === '庚寅' && stemUpper === '卯' && branchUpper === '酉');
      return matches
        ? {
            branches: [stemUpper, branchUpper],
            matchedConditions: [`${day}日干上${stemUpper}、支上${branchUpper}，符合固定互旺轮廓`],
          }
        : null;
    },
  },
  {
    id: 'he-mei',
    name: '和美课',
    category: '干支生合',
    sourceTitle: '《六壬大全》卷八·和美课；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬大全》以“上下递互相合”为和美课结构之一，《六壬粹言》称“干支交车六合”。当前只取两书共同且可复算的交车六合子结构，不扩展其他三合、六合变体。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const stemResidence = getDayStemResidence(context.dayStem);
      return LIUHE_MAP[stemUpper] === context.dayBranch && LIUHE_MAP[branchUpper] === stemResidence
        ? {
            branches: [stemUpper, context.dayBranch, branchUpper, stemResidence],
            matchedConditions: [
              `干上神${stemUpper}与日支${context.dayBranch}六合，支上神${branchUpper}与日干${context.dayStem}寄宫${stemResidence}六合`,
            ],
          }
        : null;
    },
  },
  {
    id: 'wai-hao-li-cha-ya',
    name: '外好里槎枒格',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷八·和美课；卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“干支上神作六合，而地下干支作六害，为外好里牙槎。”当前只登记上神六合、日干寄宫与日支六害同时成立的结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const stemResidence = getDayStemResidence(context.dayStem);
      return LIUHE_MAP[stemUpper] === branchUpper && LIUHAI_MAP[stemResidence] === context.dayBranch
        ? {
            branches: [stemUpper, branchUpper, stemResidence, context.dayBranch],
            matchedConditions: [
              `干上神${stemUpper}与支上神${branchUpper}六合，日干${context.dayStem}寄宫${stemResidence}与日支${context.dayBranch}六害`,
            ],
          }
        : null;
    },
  },
  {
    id: 'hu-cheng-mu-shen',
    name: '互乘墓神格',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“干乘支之墓，支乘干之墓者。”当前只登记干上神为日支五行墓、支上神为日干五行墓的交互结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const dayBranchTomb = TOMB_BRANCH_BY_ELEMENT[getGanZhiWuxing(context.dayBranch)];
      const dayStemTomb = ELEMENT_TOMB_BY_STEM[context.dayStem];
      return stemUpper === dayBranchTomb && branchUpper === dayStemTomb
        ? {
            branches: [stemUpper, context.dayBranch, branchUpper],
            matchedConditions: [
              `干上神${stemUpper}为日支${context.dayBranch}五行之墓，支上神${branchUpper}为日干${context.dayStem}五行之墓`,
            ],
          }
        : null;
    },
  },
  {
    id: 'gan-zhi-quan-shang',
    name: '干支全伤',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋下；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“谓支干各被上神克伐者。”《六壬粹言》：“谓干支受上神之克。”当前只登记干、支分别被本位上神所克的结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return isBranchKe(stemUpper, context.dayStem) && isBranchKe(branchUpper, context.dayBranch)
        ? {
            branches: [stemUpper, context.dayStem, branchUpper, context.dayBranch],
            matchedConditions: [
              `干上神${stemUpper}克日干${context.dayStem}，支上神${branchUpper}克日支${context.dayBranch}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'si-sheng-sha',
    name: '四胜煞格',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“乃干上酉、支上午，或支上酉、干上午者皆是。”当前只登记干支上神为午酉交错的固定结构。',
    detect(context) {
      if (!context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return (stemUpper === '酉' && branchUpper === '午') ||
        (stemUpper === '午' && branchUpper === '酉')
        ? {
            branches: [stemUpper, branchUpper],
            matchedConditions: [`干上神${stemUpper}、支上神${branchUpper}为午酉交错`],
          }
        : null;
    },
  },
  {
    id: 'yi-zi-xing',
    name: '一字刑格',
    category: '日辰刑害',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“一字刑者，乃四课上神全逢辰午酉亥者是。”当前只登记四课上神全部属于四个自刑支的结构。',
    detect(context) {
      if (!context.fourLessons) return null;
      const upperBranches = context.fourLessons.map((lesson) => lesson.upper);
      return upperBranches.every((branch) => ['辰', '午', '酉', '亥'].includes(branch))
        ? {
            branches: upperBranches,
            matchedConditions: [`四课上神${upperBranches.join('、')}全部属于辰午酉亥自刑支`],
          }
        : null;
    },
  },
  {
    id: 'er-zi-xing',
    name: '二字刑格',
    category: '日辰刑害',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“二字刑者，乃支干上全乘子卯是也。”当前只登记干上神、支上神分别为子卯的结构。',
    detect(context) {
      if (!context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return new Set([stemUpper, branchUpper]).size === 2 &&
        [stemUpper, branchUpper].every((branch) => ['子', '卯'].includes(branch))
        ? {
            branches: [stemUpper, branchUpper],
            matchedConditions: [`干上神${stemUpper}、支上神${branchUpper}分别为子卯`],
          }
        : null;
    },
  },
  {
    id: 'san-zi-xing',
    name: '三字刑格',
    category: '日辰刑害',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“三字刑者，乃三传寅巳申或丑戌未是也。”原文只列两组三刑各自依定向刑序轮转的三种次序；当前不扩展为任意排列。',
    detect(context) {
      const sequence = context.transmissionBranches.join('');
      return ['寅巳申', '巳申寅', '申寅巳', '丑戌未', '戌未丑', '未丑戌'].includes(sequence)
        ? {
            branches: [...context.transmissionBranches],
            matchedConditions: [
              `三传${context.transmissionBranches.join('、')}依大六壬定向刑序组成三字刑`,
            ],
          }
        : null;
    },
  },
  {
    id: 'san-chuan-ri-chen-nei-zhan',
    name: '三传日辰内战格',
    category: '四课关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“支干三传皆下克上者。”当前严格要求日干、日支及初中末传五处全部由下位克上神。',
    detect(context) {
      if (
        !context.dayStem ||
        !context.dayBranch ||
        !context.fourLessons ||
        !context.transmissionGroundBranches
      ) {
        return null;
      }
      const transmissionGroundBranches = context.transmissionGroundBranches;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const transmissionMatches = context.transmissionBranches.every((branch, index) => {
        const ground = transmissionGroundBranches[index];
        return !!ground && isBranchKe(ground, branch);
      });
      return isBranchKe(context.dayStem, stemUpper) &&
        isBranchKe(context.dayBranch, branchUpper) &&
        transmissionMatches
        ? {
            branches: [
              stemUpper,
              branchUpper,
              ...context.transmissionBranches,
              ...transmissionGroundBranches,
            ],
            matchedConditions: [
              `日干${context.dayStem}克干上神${stemUpper}，日支${context.dayBranch}克支上神${branchUpper}`,
              ...context.transmissionBranches.map(
                (branch, index) =>
                  `${['初', '中', '末'][index]}传下位${transmissionGroundBranches[index]}克上神${branch}`,
              ),
            ],
          }
        : null;
    },
  },
  {
    id: 'gan-zhi-shang-xia-liu-he',
    name: '干支上下相合格',
    category: '干支固定关系',
    sourceTitle: '《六壬粹言》卷三·经课；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬粹言》：“干支上下相合格，谓干支与上神六合。”《御定六壬直指》多处课例以“干支上下相合”复核。当前只登记两处本位六合。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const stemResidence = getDayStemResidence(context.dayStem);
      return LIUHE_MAP[stemUpper] === stemResidence && LIUHE_MAP[branchUpper] === context.dayBranch
        ? {
            branches: [stemUpper, stemResidence, branchUpper, context.dayBranch],
            matchedConditions: [
              `干上神${stemUpper}与日干${context.dayStem}寄宫${stemResidence}六合，支上神${branchUpper}与日支${context.dayBranch}六合`,
            ],
          }
        : null;
    },
  },
  {
    id: 'gan-zhi-shang-shen-liu-he',
    name: '干支上神相合格',
    category: '干支固定关系',
    sourceTitle: '《六壬粹言》卷三·经课；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬粹言》：“干支上神相合格，谓干支上神作六合。”《御定六壬直指》多处课例直接称“干支上神相合”。当前只登记两上神六合。',
    detect(context) {
      if (!context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return LIUHE_MAP[stemUpper] === branchUpper
        ? {
            branches: [stemUpper, branchUpper],
            matchedConditions: [`干上神${stemUpper}与支上神${branchUpper}六合`],
          }
        : null;
    },
  },
  {
    id: 'gan-zhi-shang-xia-liu-hai',
    name: '干支上下六害',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋下；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》分列“干支上下皆各作六害”，《六壬粹言》称“干支上下六害”。当前只登记干、支分别与本位上神构成六害。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const stemResidence = getDayStemResidence(context.dayStem);
      return LIUHAI_MAP[stemUpper] === stemResidence &&
        LIUHAI_MAP[branchUpper] === context.dayBranch
        ? {
            branches: [stemUpper, stemResidence, branchUpper, context.dayBranch],
            matchedConditions: [
              `干上神${stemUpper}与日干${context.dayStem}寄宫${stemResidence}六害，支上神${branchUpper}与日支${context.dayBranch}六害`,
            ],
          }
        : null;
    },
  },
  {
    id: 'gan-zhi-shang-shen-liu-hai',
    name: '干支上神相害格',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋下；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》分列“支干上神作六害”，《六壬粹言》称“干支上神相害格”。当前只登记两上神六害。',
    detect(context) {
      if (!context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return LIUHAI_MAP[stemUpper] === branchUpper
        ? {
            branches: [stemUpper, branchUpper],
            matchedConditions: [`干上神${stemUpper}与支上神${branchUpper}构成六害`],
          }
        : null;
    },
  },
  {
    id: 'jiao-che-liu-hai',
    name: '交车六害格',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋下；《六壬粹言》卷三·经课；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》分列“支干上下交互作六害”，《六壬粹言》称“交车六害格”，《御定六壬直指》有多处实际课例。当前只登记两处交车六害。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const stemResidence = getDayStemResidence(context.dayStem);
      return LIUHAI_MAP[stemUpper] === context.dayBranch &&
        LIUHAI_MAP[branchUpper] === stemResidence
        ? {
            branches: [stemUpper, context.dayBranch, branchUpper, stemResidence],
            matchedConditions: [
              `干上神${stemUpper}与日支${context.dayBranch}六害，支上神${branchUpper}与日干${context.dayStem}寄宫${stemResidence}六害`,
            ],
          }
        : null;
    },
  },
  {
    id: 'jiao-che-xiang-tuo',
    name: '交车相脱格',
    category: '干支固定关系',
    sourceTitle: '《六壬大全》卷十二·毕法赋下；《六壬粹言》卷三·经课；《御定六壬直指》课例',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》《六壬粹言》均以壬午日干上未、支上寅说明交车相脱，《御定六壬直指》另有伏吟课例。当前只登记日支生干上神、日干生支上神的交互泄生结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return isGanZhiSheng(context.dayBranch, stemUpper) &&
        isGanZhiSheng(context.dayStem, branchUpper)
        ? {
            branches: [context.dayBranch, stemUpper, context.dayStem, branchUpper],
            matchedConditions: [
              `日支${context.dayBranch}生干上神${stemUpper}，日干${context.dayStem}生支上神${branchUpper}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'bi-kou',
    name: '闭口课',
    category: '旬首旬尾',
    sourceTitle: '《六壬大全》卷一、卷八·闭口课；《六壬指南》卷二',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬大全》：“凡旬尾加旬首……发用者，为闭口课。”《六壬指南》：“闭口旬尾，如乘玄发用。”当前只取各书共同的旬尾临旬首发用结构，不扩展玄武、禄财等异说。',
    detect(context) {
      if (!context.dayGanZhi || !context.initialGroundBranch) return null;
      const xunHead = getXunHead(context.dayGanZhi);
      const xunHeadBranch = xunHead.charAt(1);
      const xunHeadIndex = DIZHI.indexOf(xunHeadBranch as (typeof DIZHI)[number]);
      const xunTailBranch = DIZHI[(xunHeadIndex + 9) % DIZHI.length];
      return context.transmissionBranches[0] === xunTailBranch &&
        context.initialGroundBranch === xunHeadBranch
        ? {
            branches: [xunTailBranch, xunHeadBranch],
            matchedConditions: [
              `日柱${context.dayGanZhi}属${xunHead}旬，旬尾${xunTailBranch}临旬首${xunHeadBranch}发用`,
            ],
          }
        : null;
    },
  },
  {
    id: 'jue-shen-jia-sheng',
    name: '绝神加生格',
    category: '发用临地',
    sourceTitle: '《六壬大全》卷十二·毕法赋',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TWELVE_URL,
    sourceQuote:
      '《六壬大全》：“凡巳加寅、申加巳、亥加申、寅加亥。”当前只登记四种绝神临长生地并发用的固定结构。',
    detect(context) {
      const initial = context.transmissionBranches[0];
      const ground = context.initialGroundBranch;
      if (!initial || !ground) return null;
      const matches =
        (initial === '巳' && ground === '寅') ||
        (initial === '申' && ground === '巳') ||
        (initial === '亥' && ground === '申') ||
        (initial === '寅' && ground === '亥');
      return matches
        ? {
            branches: [initial, ground],
            matchedConditions: [`初传${initial}临地盘${ground}，符合绝神加生固定轮廓`],
          }
        : null;
    },
  },
  {
    id: 'yin-cong',
    name: '引从课',
    category: '初末拱夹',
    sourceTitle: '《六壬大全》卷八·引从课；《六壬指南》卷二',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬大全》：“凡课日辰干支前后上神发用为初末传，曰引从课。”《六壬指南》：“引从日辰名曰用媒。”当前只取初末传所临地盘相邻夹日干寄宫或日支的结构。',
    detect(context) {
      if (
        !context.dayStem ||
        !context.dayBranch ||
        !context.initialGroundBranch ||
        !context.finalGroundBranch
      ) {
        return null;
      }
      const initialGroundIndex = DIZHI.indexOf(
        context.initialGroundBranch as (typeof DIZHI)[number],
      );
      const finalGroundIndex = DIZHI.indexOf(context.finalGroundBranch as (typeof DIZHI)[number]);
      const dayStemResidence = getDayStemResidence(context.dayStem);
      const isAdjacentPairAround = (target: string) => {
        const targetIndex = DIZHI.indexOf(target as (typeof DIZHI)[number]);
        const before = (targetIndex - 1 + DIZHI.length) % DIZHI.length;
        const after = (targetIndex + 1) % DIZHI.length;
        return (
          (initialGroundIndex === before && finalGroundIndex === after) ||
          (initialGroundIndex === after && finalGroundIndex === before)
        );
      };
      const aroundStem = isAdjacentPairAround(dayStemResidence);
      const aroundBranch = isAdjacentPairAround(context.dayBranch);
      if (!aroundStem && !aroundBranch) return null;
      const target =
        aroundStem && aroundBranch
          ? `日干${context.dayStem}寄宫${dayStemResidence}及日支${context.dayBranch}`
          : aroundStem
            ? `日干${context.dayStem}寄宫${dayStemResidence}`
            : `日支${context.dayBranch}`;
      return {
        branches: [
          context.transmissionBranches[0],
          context.transmissionBranches[2],
          context.initialGroundBranch,
          context.finalGroundBranch,
        ],
        matchedConditions: [
          `初传${context.transmissionBranches[0]}临${context.initialGroundBranch}、末传${context.transmissionBranches[2]}临${context.finalGroundBranch}，前后夹${target}`,
        ],
      };
    },
  },
  {
    id: 'wu-yin',
    name: '芜淫课',
    category: '日辰交克',
    sourceTitle: '《六壬指南》卷一；《六壬大全》卷八·芜淫课；《六壬粹言》',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬指南》：“上神互克干支名曰芜淫卦。”《六壬粹言》：“芜淫课，上神互克其干支。如甲子日，干上戌，支上申。”当前只取干上神克日支、支上神克日干的交互受克结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return isBranchKe(stemUpper, context.dayBranch) && isBranchKe(branchUpper, context.dayStem)
        ? {
            branches: [stemUpper, context.dayBranch, branchUpper],
            matchedConditions: [
              `干上神${stemUpper}克日支${context.dayBranch}，支上神${branchUpper}克日干${context.dayStem}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'jie-li',
    name: '解离课',
    category: '日辰交克',
    sourceTitle: '《六壬大全》卷八·解离课；《六壬粹言》；《六壬指南注解》',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬大全》：“干克支上神，支克干上神。”《六壬粹言》：“解离课，干支互克其上神。如甲子日，干上午，支上辰。”当前只取日干克支上神、日支克干上神的交互克上神结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      return isBranchKe(context.dayStem, branchUpper) && isBranchKe(context.dayBranch, stemUpper)
        ? {
            branches: [context.dayStem, branchUpper, context.dayBranch, stemUpper],
            matchedConditions: [
              `日干${context.dayStem}克支上神${branchUpper}，日支${context.dayBranch}克干上神${stemUpper}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'chong-po',
    name: '冲破课',
    category: '冲神乘破',
    sourceTitle: '《六壬大全》卷八·冲破课；《御定六壬直指》',
    sourceUrl: LIUREN_DAQUAN_VOLUME_EIGHT_URL,
    sourceQuote:
      '《六壬大全》：“日辰之冲神，加破为用。”《御定六壬直指》庚子日例：“午冲子，冲神乘破发用，为之冲破格。”当前只取日支冲神临该冲神六破支发用的严格结构。',
    detect(context) {
      if (!context.dayBranch || !context.initialGroundBranch) return null;
      const initial = context.transmissionBranches[0];
      const clashBranch = LIUCHONG_MAP[context.dayBranch];
      const breakBranch = LIUPO_MAP[initial];
      return initial === clashBranch && context.initialGroundBranch === breakBranch
        ? {
            branches: [context.dayBranch, initial, context.initialGroundBranch],
            matchedConditions: [
              `初传${initial}冲日支${context.dayBranch}，并临其六破地盘${context.initialGroundBranch}发用`,
            ],
          }
        : null;
    },
  },
  {
    id: 'qin-hai',
    name: '侵害课',
    category: '日辰刑害',
    sourceTitle: '《六壬大全》卷九·侵害课；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬大全》：“凡课日辰六害相加……为侵害课。”《六壬粹言》：“凡六害加干支发用，为侵害课。”当前只登记六害上神临日干寄宫或日支并发用的共同结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const initial = context.transmissionBranches[0];
      const stemResidence = getDayStemResidence(context.dayStem);
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const harmsStem = initial === stemUpper && LIUHAI_MAP[stemUpper] === stemResidence;
      const harmsBranch = initial === branchUpper && LIUHAI_MAP[branchUpper] === context.dayBranch;
      if (!harmsStem && !harmsBranch) return null;
      return {
        branches: [
          initial,
          ...(harmsStem ? [stemResidence] : []),
          ...(harmsBranch ? [context.dayBranch] : []),
        ],
        matchedConditions: [
          ...(harmsStem
            ? [`初传${initial}临日干${context.dayStem}寄宫${stemResidence}，两支构成六害`]
            : []),
          ...(harmsBranch ? [`初传${initial}临日支${context.dayBranch}，两支构成六害`] : []),
        ],
      };
    },
  },
  {
    id: 'xing-shang',
    name: '刑伤课',
    category: '日辰刑害',
    sourceTitle: '《六壬大全》卷九·刑伤课；《六壬粹言》卷三·经课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬大全》：“凡课中三刑发用……为刑伤课。”《六壬粹言》：“三刑加干支发用，为刑伤课。”当前只登记定向刑神临日干寄宫或日支并发用的共同结构。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch || !context.fourLessons) return null;
      const initial = context.transmissionBranches[0];
      const stemResidence = getDayStemResidence(context.dayStem);
      const stemUpper = context.fourLessons[0].upper;
      const branchUpper = context.fourLessons[2].upper;
      const punishesStem = initial === stemUpper && SANXING_MAP[stemUpper] === stemResidence;
      const punishesBranch =
        initial === branchUpper && SANXING_MAP[branchUpper] === context.dayBranch;
      if (!punishesStem && !punishesBranch) return null;
      return {
        branches: [
          initial,
          ...(punishesStem ? [stemResidence] : []),
          ...(punishesBranch ? [context.dayBranch] : []),
        ],
        matchedConditions: [
          ...(punishesStem
            ? [`初传${initial}临日干${context.dayStem}寄宫${stemResidence}，定向刑及寄宫`]
            : []),
          ...(punishesBranch ? [`初传${initial}临日支${context.dayBranch}，定向刑及日支`] : []),
        ],
      };
    },
  },
  {
    id: 'po-hua',
    name: '魄化课',
    category: '发用囚死墓',
    sourceTitle: '《六壬大全》卷九·魄化课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬大全》：“白虎乘死神死气及囚死，临日辰行年发用……为魄化。”当前只登记现有盘面可完整复算的临日干或日支发用结构，不补造行年条件。',
    detect(context) {
      if (
        !context.dayStem ||
        !context.dayBranch ||
        !context.monthBranch ||
        !context.transmissionGods ||
        !context.transmissionGroundBranches
      ) {
        return null;
      }
      const initial = context.transmissionBranches[0];
      const initialGod = context.transmissionGods[0];
      const initialGround = context.transmissionGroundBranches[0];
      const deadQi = getLiurenMonthlyCompositeBranch('死气', context.monthBranch);
      const deadSpirit = getLiurenMonthlyCompositeBranch('死神', context.monthBranch);
      const matchedMonthlyNames = [
        ...(initial === deadSpirit ? ['死神'] : []),
        ...(initial === deadQi ? ['死气'] : []),
      ];
      const seasonState = getSeasonState(getBranchWuxing(initial), context.monthBranch);
      const stemResidence = getDayStemResidence(context.dayStem);
      const location =
        initialGround === stemResidence
          ? `日干${context.dayStem}寄宫${stemResidence}`
          : initialGround === context.dayBranch
            ? `日支${context.dayBranch}`
            : '';
      return initialGod === '白虎' &&
        matchedMonthlyNames.length > 0 &&
        ['囚', '死'].includes(seasonState) &&
        !!location
        ? {
            branches: [initial, initialGround],
            matchedConditions: [
              `月建${context.monthBranch}所起${matchedMonthlyNames.join('、')}${initial}发用乘白虎，月令为${seasonState}并临${location}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'fu-yang',
    name: '伏殃卦',
    category: '日辰发用',
    sourceTitle: '《六壬大全》卷十·伏殃卦',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“伏殃，即天鬼也……如行年日辰发用。”《订讹》：“天鬼临日辰发用或临年命发用。”当前只登记现有盘面可完整复算的临日干或日支发用结构。',
    detect(context) {
      if (
        !context.dayStem ||
        !context.dayBranch ||
        !context.monthBranch ||
        !context.transmissionGroundBranches
      ) {
        return null;
      }
      const initial = context.transmissionBranches[0];
      const initialGround = context.transmissionGroundBranches[0];
      const heavenlyGhost = getLiurenMonthlyCompositeBranch('天鬼', context.monthBranch);
      const stemResidence = getDayStemResidence(context.dayStem);
      const location =
        initialGround === stemResidence
          ? `日干${context.dayStem}寄宫${stemResidence}`
          : initialGround === context.dayBranch
            ? `日支${context.dayBranch}`
            : '';
      return initial === heavenlyGhost && !!location
        ? {
            branches: [initial, initialGround],
            matchedConditions: [`月建${context.monthBranch}所起天鬼${initial}临${location}发用`],
          }
        : null;
    },
  },
  {
    id: 'gui-mu',
    name: '鬼墓课',
    category: '鬼墓发用',
    sourceTitle: '《六壬大全》卷十·鬼墓课；《六壬灵觉经》·鬼墓课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》《六壬灵觉经》均载：“凡日辰墓神及日鬼发用，为鬼墓课。”当前只按原文固定日干墓、日支五行墓及同阴阳日鬼三类发用位置登记。',
    detect(context) {
      if (!context.dayStem || !context.dayBranch) return null;
      const initial = context.transmissionBranches[0];
      const stemTomb = ELEMENT_TOMB_BY_STEM[context.dayStem];
      const branchTomb = TOMB_BRANCH_BY_ELEMENT[getBranchWuxing(context.dayBranch)];
      const isDayGhost = DAY_GHOST_BRANCHES_BY_STEM[context.dayStem]?.includes(initial) ?? false;
      const matchedConditions = [
        ...(initial === stemTomb ? [`初传${initial}为日干${context.dayStem}五行墓位`] : []),
        ...(initial === branchTomb ? [`初传${initial}为日支${context.dayBranch}五行墓位`] : []),
        ...(isDayGhost ? [`初传${initial}为日干${context.dayStem}同阴阳日鬼`] : []),
      ];
      return matchedConditions.length ? { branches: [initial], matchedConditions } : null;
    },
  },
  {
    id: 'yang-jiu',
    name: '殃咎课',
    category: '三传递克',
    sourceTitle: '《六壬大全》卷十·殃咎课；《六壬灵觉经》·殃咎课',
    sourceUrl: LIUREN_DAQUAN_VOLUME_TEN_URL,
    sourceQuote:
      '《六壬大全》：“凡三传递克日……为殃咎课。”《六壬灵觉经》列初克中、中克末、末克日及末克中、中克初、初克日两种递克次序。当前只登记这两种完整五行克制链。',
    detect(context) {
      if (!context.dayStem) return null;
      const [initial, middle, final] = context.transmissionBranches;
      const initialElement = getBranchWuxing(initial);
      const middleElement = getBranchWuxing(middle);
      const finalElement = getBranchWuxing(final);
      const dayElement = getGanZhiWuxing(context.dayStem);
      if (
        isKe(initialElement, middleElement) &&
        isKe(middleElement, finalElement) &&
        isKe(finalElement, dayElement)
      ) {
        return {
          branches: [...context.transmissionBranches],
          matchedConditions: [
            `初传${initial}${initialElement}克中传${middle}${middleElement}，中传克末传${final}${finalElement}，末传克日干${context.dayStem}${dayElement}`,
          ],
        };
      }
      return isKe(finalElement, middleElement) &&
        isKe(middleElement, initialElement) &&
        isKe(initialElement, dayElement)
        ? {
            branches: [...context.transmissionBranches],
            matchedConditions: [
              `末传${final}${finalElement}克中传${middle}${middleElement}，中传克初传${initial}${initialElement}，初传克日干${context.dayStem}${dayElement}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'jiu-chou',
    name: '九丑课',
    category: '大吉临仲',
    sourceTitle: '《六壬大全》卷九·九丑课；《六壬指南》卷一·三传课体',
    sourceUrl: LIUREN_DAQUAN_VOLUME_NINE_URL,
    sourceQuote:
      '《六壬大全》：“戊子、戊午、壬子、壬午、乙卯、乙酉、己卯、己酉、辛卯、辛酉十日……如四仲时占，丑临日加四仲上发用，为九丑课。”《订讹》：“不发用而临支上者亦是。四仲时占更的。”',
    detect(context) {
      if (!context.dayGanZhi || !context.hourBranch || !context.greatAuspiciousGroundBranch) {
        return null;
      }
      const dayBranch = context.dayGanZhi.charAt(1);
      const initial = context.transmissionBranches[0];
      return JIU_CHOU_DAYS.has(context.dayGanZhi) &&
        ['子', '午', '卯', '酉'].includes(context.hourBranch) &&
        context.greatAuspiciousGroundBranch === dayBranch
        ? {
            branches: [initial, dayBranch, context.hourBranch],
            matchedConditions: [
              initial === '丑'
                ? `日柱${context.dayGanZhi}为九丑十日之一，四仲时${context.hourBranch}占，天盘大吉丑临日支${dayBranch}并发用`
                : `日柱${context.dayGanZhi}为九丑十日之一，四仲时${context.hourBranch}占，天盘大吉丑临日支${dayBranch}，依《订讹》不发用而临支上者亦是`,
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
