/**
 * @file 小六壬掌诀算法
 * @description 基于《小六壬金口诀》掌诀体系，实现通行掌诀与华山派完整时间课。
 * @流派 standard=通行小六壬金口诀；huashan=华山派完整时间课
 * @古籍依据 《小六壬金口诀》《李淳风六壬时课》及华山派时课公开口径
 * @核心算法
 * 1. 以月、日、时辰三数逐宫顺数定三宫（起因→过程→结果）。
 * 2. 六宫五行生克断吉凶：大安(木)→留连(土)→速喜(火)→赤口(金)→小吉(水)→空亡(土)
 * 3. 起因生过程→顺遂，过程生结果→渐入佳境；克则反之。
 * 4. 按月令定各宫旺衰休囚，作为快慢和条件是否成熟的辅助证据。
 * 5. 华山派仅时间起课，并补全日干支、旬空、驿马、桃花、六亲与三宫完整课象。
 */
import type {
  XiaoliurenData,
  XiaoliurenDivinationMethod,
  XiaoliurenPalaceDetail,
  XiaoliurenSchool,
  XiaoliurenStageChart,
} from '../../types/divination';
import { getShichenByIndex, getTimeIndexFromClock } from '../../calendar/dateUtils';
import { getVoidBranches } from '../../calendar/lunar';
import { getDivinationTime } from '../../calendar/timeManager';
import { getBranchWuxing, getSeasonState, getTaoHua, getYiMa } from '../../ganzhi';
import { liuqinRelations } from '../divination-data';
import { assertOptionalRecord } from '../../shared/validation';
import type { RandomOptions } from '../../shared/random';
import {
  createRandomContext,
  hasRandomOptions,
  randomInt,
  type RandomTrace,
} from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import { analyzeXiaoliurenEvidence } from '../xiaoliuren-evidence';

export {
  analyzeXiaoliurenEvidence,
  conditionXiaoliurenTraditionalText,
} from '../xiaoliuren-evidence';
export type {
  XiaoliurenCounterEvidenceFact,
  XiaoliurenCounterSummaryFact,
  XiaoliurenEvidenceAnalysis,
  XiaoliurenStageEvidence,
  XiaoliurenTimingBasisFact,
  XiaoliurenTimingSummaryFact,
  XiaoliurenTraditionalFact,
  XiaoliurenTransitionFact,
  XiaoliurenTriggerConditionFact,
} from '../xiaoliuren-evidence';

const XIAOLIUREN_PALACES = [
  {
    name: '大安',
    index: 0,
    element: '木',
    meaning: '局势偏稳，宜先守住基本盘，再做稳妥推进。',
    keywords: ['稳定', '守成', '缓进'],
    tendency: '宜等待',
    advice: '先稳住节奏，确认资源和立场，再决定下一步。',
    direction: '东',
    shenSha: '青龙',
    yinYang: '阳',
    number: '1/5/7',
    seasonProsper: '春（寅卯月）最旺',
    bodyPart: '足',
    fortune: '吉',
    timing: '节奏平稳，宜观察基础条件是否持续稳定',
  },
  {
    name: '留连',
    index: 1,
    element: '土',
    meaning: '事情容易拖延反复，推进时会被旧问题牵扯。',
    keywords: ['拖延', '牵扯', '反复'],
    tendency: '易反复',
    advice: '不要急着定论，先清理卡点与未处理事项。',
    direction: '四角',
    shenSha: '螣蛇',
    yinYang: '阴',
    number: '2/6/8',
    seasonProsper: '季（辰戌丑未月）最旺',
    bodyPart: '股',
    fortune: '平（偏凶）',
    timing: '节奏反复，待牵扯事项清理后再观察进展',
  },
  {
    name: '速喜',
    index: 2,
    element: '火',
    meaning: '消息与进展来得较快，适合顺势跟进。',
    keywords: ['消息', '转机', '加速'],
    tendency: '宜推进',
    advice: '有机会就及时跟进，但别因为顺而失去判断。',
    direction: '南',
    shenSha: '朱雀',
    yinYang: '阳',
    number: '3/6/9',
    seasonProsper: '夏（巳午月）最旺',
    bodyPart: '目',
    fortune: '吉',
    timing: '节奏偏快，以消息、回复或机会出现为触发',
  },
  {
    name: '赤口',
    index: 3,
    element: '金',
    meaning: '容易出现争执、误会、口舌或情绪冲撞。',
    keywords: ['争执', '误会', '情绪'],
    tendency: '易争执',
    advice: '少硬碰硬，先控情绪和表达，再谈结果。',
    direction: '西',
    shenSha: '白虎',
    yinYang: '阳',
    number: '4/7/10',
    seasonProsper: '秋（申酉月）最旺',
    bodyPart: '口舌',
    fortune: '凶',
    timing: '争执触发性强，以沟通冲突或立场摊牌为观察点',
  },
  {
    name: '小吉',
    index: 4,
    element: '水',
    meaning: '事情整体可成，常有助力，但更适合渐进推进。',
    keywords: ['助力', '可成', '渐进'],
    tendency: '有助力',
    advice: '可以推进，但要一步一步拿结果，不宜贪快。',
    direction: '北',
    shenSha: '玄武',
    yinYang: '阴',
    number: '1/4/8',
    seasonProsper: '冬（亥子月）最旺',
    bodyPart: '耳',
    fortune: '吉',
    timing: '节奏渐进，以协助、资源或中间人出现为触发',
  },
  {
    name: '空亡',
    index: 5,
    element: '土',
    meaning: '当前信息虚、时机虚或目标虚，容易白忙一场。',
    keywords: ['落空', '失焦', '不实'],
    tendency: '易落空',
    advice: '先核实人事物是否真实有效，再决定是否投入。',
    direction: '中央',
    shenSha: '勾陈',
    yinYang: '阴',
    number: '5/8/10',
    seasonProsper: '季（辰戌丑未月）最旺',
    bodyPart: '脾',
    fortune: '凶（大凶）',
    timing: '应期不定或落空，需重新评估',
  },
] as XiaoliurenPalaceDetail[];

const XIAOLIUREN_METHOD_LABEL_MAP: Record<XiaoliurenDivinationMethod, string> = {
  time: '时间起课',
  number: '数字起课',
  random: '随机起课',
};

const XIAOLIUREN_SCHOOL_LABEL_MAP: Record<XiaoliurenSchool, string> = {
  standard: '通行掌诀',
  huashan: '华山派',
};

const DAYTIME_BRANCHES = new Set(['卯', '辰', '巳', '午', '未', '申']);

const STAGE_ROLE_MAP: Record<XiaoliurenStageChart['stage'], string> = {
  起因: '事端与起意，主问题缘起、求测者初始立场与起步条件',
  过程: '推进与变数，主中间环节、助力阻力与关系互动',
  结果: '归宿与收口，主当前可见结局倾向与兑现条件',
};

function assertXiaoliurenSchool(school: XiaoliurenSchool): void {
  if (!Object.prototype.hasOwnProperty.call(XIAOLIUREN_SCHOOL_LABEL_MAP, school)) {
    throw new Error(`未知的小六壬流派: ${school}`);
  }
}

function getDayNightByHourBranch(hourBranch: string): '昼占' | '夜占' {
  return DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
}

function getRelativeToDay(dayElement: string, palaceElement: string): string {
  const map = liuqinRelations[dayElement as keyof typeof liuqinRelations];
  const relative = map?.[palaceElement as keyof typeof map];
  if (!relative) {
    throw new Error(`小六壬无法计算日主${dayElement}对宫位${palaceElement}的六亲。`);
  }
  return relative;
}

function describeElementToDay(dayElement: string, palaceElement: string): string {
  if (dayElement === palaceElement) return '比和日主';
  const relationTables: Record<string, Record<string, string>> = {
    木: { 木: '比和', 金: '被克', 水: '得生', 火: '所生', 土: '所克' },
    金: { 金: '比和', 火: '被克', 土: '得生', 水: '所生', 木: '所克' },
    火: { 火: '比和', 水: '被克', 木: '得生', 土: '所生', 金: '所克' },
    水: { 水: '比和', 土: '被克', 金: '得生', 木: '所生', 火: '所克' },
    土: { 土: '比和', 木: '被克', 火: '得生', 金: '所生', 水: '所克' },
  };
  return relationTables[palaceElement]?.[dayElement] || '关系未定';
}

function buildStageChart(params: {
  stage: XiaoliurenStageChart['stage'];
  palace: XiaoliurenPalaceDetail;
  seasonState: string;
  dayElement: string;
  xunKong: string[];
  yiMa: string;
  taoHua: string;
}): XiaoliurenStageChart {
  const { stage, palace, seasonState, dayElement, xunKong, yiMa, taoHua } = params;
  const relative = getRelativeToDay(dayElement, palace.element);
  const relationToDay = describeElementToDay(dayElement, palace.element);
  const isVoidPalace = palace.name === '空亡';
  const support = [
    seasonState === '旺' || seasonState === '相' ? `月令${seasonState}` : '',
    relationToDay === '得生' || relationToDay === '所生' ? `对日主${relationToDay}` : '',
    relationToDay === '比和日主' ? '与日主比和' : '',
    palace.fortune === '吉' ? '宫位传统倾向偏吉' : '',
  ].filter(Boolean);
  const constraints = [
    seasonState === '休' || seasonState === '囚' || seasonState === '死'
      ? `月令${seasonState}`
      : '',
    isVoidPalace ? '本宫即空亡宫，主信息虚、目标虚或落空风险' : '',
    palace.name === '赤口' ? '易见争执、误会或情绪冲撞' : '',
    palace.name === '留连' ? '易拖延反复，推进中有牵扯' : '',
    relationToDay === '被克' || relationToDay === '所克' ? `对日主${relationToDay}` : '',
  ].filter(Boolean);
  return {
    stage,
    role: STAGE_ROLE_MAP[stage],
    palace,
    seasonState,
    relative,
    relationToDay,
    isVoid: isVoidPalace,
    hasYiMa: false,
    hasTaoHua: false,
    support,
    constraints,
    promptText: `${stage}${palace.name}：六亲${relative}；五行${palace.element}，月令${seasonState}，对日主${relationToDay}；支持${support.join('、') || '无'}；限制${constraints.join('、') || '无'}；旬空${xunKong.join('、') || '无'}，年驿马${yiMa}，年桃花${taoHua}`,
  };
}

function normalizeModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getPalaceByValue(value: number) {
  return XIAOLIUREN_PALACES[normalizeModulo(value, XIAOLIUREN_PALACES.length)];
}

function getHourLabel(hourIndex: number) {
  const shichen = getShichenByIndex(hourIndex);
  if (!shichen) {
    throw new Error(`小六壬时辰索引无效：${hourIndex}`);
  }
  return shichen.name;
}

function buildQuestionHint(primary: XiaoliurenPalaceDetail) {
  switch (primary.name) {
    case '大安':
      return '当前更适合先稳住局面、守正推进，不宜急躁定输赢。';
    case '留连':
      return '当前重点不是立刻求成，而是先处理拖延、牵扯和卡点。';
    case '速喜':
      return '当前有较快起色，适合抓住机会，但要防止判断过快。';
    case '赤口':
      return '当前最需要防的是争执、误解和沟通过激。';
    case '小吉':
      return '当前整体偏可成，适合稳步推进，慢慢拿结果。';
    case '空亡':
      return '当前容易落空或判断失真，宜先核实再投入。';
  }
}

/**
 * 生成小六壬课盘
 *
 * 通行掌诀支持时间/数字/随机起课；华山派仅支持时间起课，并输出完整课盘。
 * 不传 `customDate` 时使用当前时间。
 *
 * @param params 起课参数：
 *   - method: 起课方式，默认 'time'
 *   - school: 流派，默认 'standard'；`huashan` 仅允许时间起课
 *   - number: 数字起课时的数字（华山派不可用）
 *   - customDate: 自定义时间（可选）
 * @returns 完整的小六壬课盘数据对象 XiaoliurenData。
 *
 * @example
 * ```ts
 * // 通行时间起课
 * const result = generateXiaoliuren({ method: 'time' });
 *
 * // 华山派完整时间课
 * const huashan = generateXiaoliuren({ method: 'time', school: 'huashan' });
 * ```
 */
export function generateXiaoliuren(
  params?: {
    method?: XiaoliurenDivinationMethod;
    school?: XiaoliurenSchool;
    number?: number;
    customDate?: Date;
  } & RandomOptions,
): XiaoliurenData {
  assertOptionalRecord(params, '小六壬起课参数');
  const method = params?.method ?? 'time';
  const school = params?.school ?? 'standard';
  if (!Object.hasOwn(XIAOLIUREN_METHOD_LABEL_MAP, method)) {
    throw new Error(`未知的小六壬起课方式: ${method}`);
  }
  assertXiaoliurenSchool(school);
  if (school === 'huashan' && method !== 'time') {
    throw new Error('华山派小六壬只以时间起课，不支持数字或随机起课。');
  }
  if (school === 'huashan' && params?.number !== undefined) {
    throw new Error('华山派小六壬只以时间起课，不应传入起课数字。');
  }
  if (method !== 'random' && hasRandomOptions(params)) {
    throw new Error('小六壬仅随机起课接受 seed、replay 或自定义随机源。');
  }

  const { ganzhi, timeInfo, timestamp } = getDivinationTime(params?.customDate);
  const lunarMonth = timeInfo.lunar.monthNumber;
  const lunarDay = timeInfo.lunar.dayNumber;
  const hourIndex = getTimeIndexFromClock(timeInfo.solar.hour, timeInfo.solar.minute);
  // 时辰数取地支序（子1…亥12）：早子时与晚子时均为 1，与传统小六壬口径一致。
  // hourIndex 为 0-12（早子=0、晚子=12），直接入式会使所有时辰落宫偏移一格。
  const hourNumber = (hourIndex % 12) + 1;

  let startSeed = lunarMonth;
  let processSeed = lunarMonth + lunarDay - 1;
  let resultSeed = lunarMonth + lunarDay + hourNumber - 2;
  let inputBase = lunarMonth;
  let inputBaseSource: NonNullable<XiaoliurenData['calculation']>['inputBaseSource'] = '农历月数';
  let randomTrace: RandomTrace | undefined;

  if (method === 'number') {
    const inputNumber = params?.number;
    if (typeof inputNumber !== 'number' || !Number.isSafeInteger(inputNumber) || inputNumber <= 0) {
      throw new Error('小六壬数字起课必须提供安全范围内的正整数');
    }
    inputBase = inputNumber;
    inputBaseSource = '用户数字';
    startSeed = inputNumber;
    processSeed = inputNumber + lunarDay - 1;
    resultSeed = inputNumber + lunarDay + hourNumber - 2;
  } else if (method === 'random') {
    const context = createRandomContext(params);
    const base = randomInt(6, context.random) + 1;
    randomTrace = context.getTrace();
    inputBase = base;
    inputBaseSource = '随机取数';
    startSeed = base;
    processSeed = base + lunarDay - 1;
    resultSeed = base + lunarDay + hourNumber - 2;
  }

  const start = getPalaceByValue(startSeed - 1);
  const process = getPalaceByValue(processSeed - 1);
  const result = getPalaceByValue(resultSeed - 1);

  // 宫间五行生克分析（《小六壬金口诀》核心精要）：
  // 起因宫克过程宫→先难后易；起因生过程→顺遂；比和→平稳；
  // 过程宫生结果宫→渐入佳境；过程克结果→先易后难；比和→势头保持。
  const elementRelations: Record<string, Record<string, string>> = {
    木: { 木: '比和', 金: '被克', 水: '得生', 火: '所生', 土: '所克' },
    金: { 金: '比和', 火: '被克', 土: '得生', 水: '所生', 木: '所克' },
    火: { 火: '比和', 水: '被克', 木: '得生', 土: '所生', 金: '所克' },
    水: { 水: '比和', 土: '被克', 金: '得生', 木: '所生', 火: '所克' },
    土: { 土: '比和', 木: '被克', 火: '得生', 金: '所生', 水: '所克' },
  };
  const startToProcess = elementRelations[start.element]?.[process.element];
  const processToResult = elementRelations[process.element]?.[result.element];
  if (!startToProcess) {
    throw new Error(`小六壬无法判断${start.element}与${process.element}的五行关系。`);
  }
  if (!processToResult) {
    throw new Error(`小六壬无法判断${process.element}与${result.element}的五行关系。`);
  }
  const wuXingDesc = [
    startToProcess === '比和' ? '起因与过程平稳衔接' : '',
    startToProcess === '得生' ? '过程回生起因，推进中有反哺助力' : '',
    startToProcess === '所生' ? '起因生过程，事态自然推进' : '',
    startToProcess === '被克' ? '起因被过程克制，起步受阻需耐心' : '',
    startToProcess === '所克' ? '起因克过程，前段有压制，先难后易' : '',
    processToResult === '比和' ? '过程与结果保持同势' : '',
    processToResult === '得生' ? '结果回生过程，后续仍有支撑' : '',
    processToResult === '所生' ? '过程生结果，越做越顺' : '',
    processToResult === '被克' ? '过程被结果克制，先易后难需谨慎' : '',
    processToResult === '所克' ? '过程克结果，后段受压，先易后难' : '',
  ]
    .filter(Boolean)
    .join('；');

  const wuxingRelations = {
    startToProcess,
    processToResult,
    description: wuXingDesc || '三宫五行无特殊生克态势',
  };

  // 旺衰按月令分析（取月干支的地支）
  const monthBranch = ganzhi?.month?.slice(-1) || '';
  const seasonStates = {
    start: monthBranch ? getSeasonState(start.element, monthBranch) : '平',
    process: monthBranch ? getSeasonState(process.element, monthBranch) : '平',
    result: monthBranch ? getSeasonState(result.element, monthBranch) : '平',
  };

  const timingProfiles: Record<
    string,
    {
      rhythm: '偏快' | '平稳' | '偏缓' | '反复' | '不定';
      trigger: string;
    }
  > = {
    大安: { rhythm: '平稳', trigger: '基础条件稳定、资源到位或立场明确后推进' },
    留连: { rhythm: '反复', trigger: '旧问题、手续或牵扯事项得到清理后再推进' },
    速喜: { rhythm: '偏快', trigger: '消息、回复、邀约或明确机会出现时及时核验' },
    赤口: { rhythm: '反复', trigger: '沟通冲突、误解澄清或立场摊牌时出现转折' },
    小吉: { rhythm: '平稳', trigger: '协助者、资源、中间人或小步成果出现后渐进' },
    空亡: { rhythm: '不定', trigger: '先核实目标、信息和承诺是否真实，再重新判断时机' },
  };
  const timingProfile = timingProfiles[result.name] ?? {
    rhythm: '不定' as const,
    trigger: '结合具体问题和现实进展重新判断',
  };
  const resultSeasonState = seasonStates.result;
  const timingEvidence = {
    rhythm: timingProfile.rhythm,
    primaryBasis: [
      `结果宫为${result.name}，宫义节奏为${timingProfile.rhythm}`,
      `过程至结果五行关系为${processToResult}：${wuxingRelations.description}`,
      `结果宫${result.element}在${monthBranch || '未知月支'}月为${resultSeasonState}，只作条件成熟度辅助`,
    ],
    triggerConditions: [timingProfile.trigger],
    limitations: [
      '六宫次序、宫数和传统数目只用于起课与取象，不换算固定日数、周数或公历日期',
      '月令旺衰只表示相对条件，不等于某季节必然发生',
      '未给现实期限和可观察事件时，只判断快慢、反复与触发条件',
    ],
  };

  const hourBranch = getShichenByIndex(hourIndex)?.branch || '子';
  const dayBranch = ganzhi.day.slice(-1);
  const dayStem = ganzhi.day.slice(0, 1);
  const yearBranch = ganzhi.year.slice(-1);
  const dayElement = getBranchWuxing(dayBranch);
  const dayNight = getDayNightByHourBranch(hourBranch);
  const xunKong = getVoidBranches(ganzhi.day);
  const yiMa = getYiMa(yearBranch);
  const taoHua = getTaoHua(yearBranch);
  const schoolLabel = XIAOLIUREN_SCHOOL_LABEL_MAP[school];
  const sixPalaceRing = XIAOLIUREN_PALACES.map((item) => getPalaceByValue(item.index));
  const stageCharts =
    school === 'huashan'
      ? {
          start: buildStageChart({
            stage: '起因',
            palace: start,
            seasonState: seasonStates.start,
            dayElement,
            xunKong,
            yiMa,
            taoHua,
          }),
          process: buildStageChart({
            stage: '过程',
            palace: process,
            seasonState: seasonStates.process,
            dayElement,
            xunKong,
            yiMa,
            taoHua,
          }),
          result: buildStageChart({
            stage: '结果',
            palace: result,
            seasonState: seasonStates.result,
            dayElement,
            xunKong,
            yiMa,
            taoHua,
          }),
        }
      : undefined;
  const mainLine =
    school === 'huashan'
      ? `华山派时间课主线：以日主${dayStem}${dayBranch}（${dayElement}）为基准，先看结果宫${result.name}定收口，再回看起因${start.name}与过程${process.name}的承接；并核对旬空${xunKong.join('、') || '无'}、年驿马${yiMa}、年桃花${taoHua}与三宫六亲是否改变兑现条件。`
      : undefined;
  const focusEvidence =
    school === 'huashan' && stageCharts
      ? [
          {
            target: `结果${result.name}`,
            role: '收口主断',
            level: '主证' as const,
            evidence: [
              stageCharts.result.promptText,
              `三宫推进：${wuxingRelations.description}`,
              `日主${dayStem}${dayBranch}${dayElement}，${dayNight}`,
            ],
            limitations: [
              '结果宫只给出收口倾向，不等于现实必然发生',
              '旬空、驿马、桃花与六亲只作条件化证据，不单独定吉凶分',
            ],
          },
          {
            target: `起因${start.name}`,
            role: '起意与起步',
            level: '辅证' as const,
            evidence: [stageCharts.start.promptText],
            limitations: ['起因宫不单独代表现实起因已坐实'],
          },
          {
            target: `过程${process.name}`,
            role: '推进与变数',
            level: '辅证' as const,
            evidence: [stageCharts.process.promptText],
            limitations: ['过程宫不单独代表中间事件必按盘面顺序发生'],
          },
        ]
      : undefined;

  const dataResult: XiaoliurenData = {
    method,
    methodLabel: XIAOLIUREN_METHOD_LABEL_MAP[method],
    school,
    schoolLabel,
    timestamp,
    lunarMonth,
    lunarDay,
    hourIndex,
    hourLabel: getHourLabel(hourIndex),
    ganzhi,
    dayNight,
    xunKong,
    yiMa,
    taoHua,
    mainLine,
    calculation: {
      inputBase,
      inputBaseSource,
      lunarDay,
      hourNumber,
      startSeed,
      processSeed,
      resultSeed,
      startPalaceIndex: start.index,
      processPalaceIndex: process.index,
      resultPalaceIndex: result.index,
      school,
      schoolLabel,
      dayStem,
      dayBranch,
      hourBranch,
    },
    sequence: {
      start,
      process,
      result,
    },
    stageCharts,
    sixPalaceRing,
    wuxingRelations,
    primary: result,
    tendency: result.tendency,
    questionHint: buildQuestionHint(result),
    seasonStates,
    yingQi: `盘内节奏${timingEvidence.rhythm}；观察条件：${timingEvidence.triggerConditions.join('；')}。不机械换算固定日期。`,
    timingEvidence,
    focusEvidence,
    direction: result.direction,
    shenSha: result.shenSha,
    fortune: result.fortune,
    timing: result.timing,
    bodyPart: result.bodyPart,
  };
  const resultWithMeta = attachResultMeta(dataResult, {
    algorithm: 'xiaoliuren',
    input: { method, school, number: params?.number, timestamp },
    calculatedAt: timestamp,
    random: randomTrace,
  });
  return { ...resultWithMeta, evidenceAnalysis: analyzeXiaoliurenEvidence(resultWithMeta) };
}
