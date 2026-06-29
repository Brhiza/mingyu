import type {
  XiaoliurenData,
  XiaoliurenDivinationMethod,
  XiaoliurenPalaceDetail,
} from '../../../types/divination';
import { getTimeIndexFromClock } from '../../../utils/dateUtils';
import { getDivinationTime } from '../../../utils/timeManager';
import { getSeasonState } from './_shared';

const XIAOLIUREN_PALACES: XiaoliurenPalaceDetail[] = [
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
    timing: '代表1-7日内平稳发展',
  },
  {
    name: '留连',
    index: 1,
    element: '木',
    meaning: '事情容易拖延反复，推进时会被旧问题牵扯。',
    keywords: ['拖延', '牵扯', '反复'],
    tendency: '易反复',
    advice: '不要急着定论，先清理卡点与未处理事项。',
    direction: '东南',
    shenSha: '六合',
    yinYang: '阴',
    number: '2/6/8',
    seasonProsper: '春（寅卯月）最旺',
    bodyPart: '股',
    fortune: '平（偏凶）',
    timing: '代表2-8日内反复拖延',
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
    timing: '代表3-9日内消息到来',
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
    timing: '代表4-7日或1-2周内出现争执',
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
    timing: '代表1-4周内有贵人助力',
  },
  {
    name: '空亡',
    index: 5,
    element: '水',
    meaning: '当前信息虚、时机虚或目标虚，容易白忙一场。',
    keywords: ['落空', '失焦', '不实'],
    tendency: '易落空',
    advice: '先核实人事物是否真实有效，再决定是否投入。',
    direction: '中央',
    shenSha: '勾陈',
    yinYang: '阴',
    number: '5/8/10',
    seasonProsper: '冬（亥子月）最旺',
    bodyPart: '脾',
    fortune: '凶（大凶）',
    timing: '应期不定或落空，需重新评估',
  },
];

const XIAOLIUREN_METHOD_LABEL_MAP: Record<XiaoliurenDivinationMethod, string> = {
  time: '时间起课',
  number: '数字起课',
  random: '随机起课',
};

function normalizeModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getPalaceByValue(value: number) {
  return XIAOLIUREN_PALACES[normalizeModulo(value, XIAOLIUREN_PALACES.length)];
}

function getHourLabel(hourIndex: number) {
  const labels = [
    '早子时',
    '丑时',
    '寅时',
    '卯时',
    '辰时',
    '巳时',
    '午时',
    '未时',
    '申时',
    '酉时',
    '戌时',
    '亥时',
    '晚子时',
  ];

  return labels[hourIndex] || '未知时辰';
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

export function generateXiaoliuren(params?: {
  method?: XiaoliurenDivinationMethod;
  number?: number;
  customDate?: Date;
}): XiaoliurenData {
  const method = params?.method ?? 'time';
  const { timeInfo, timestamp } = getDivinationTime(params?.customDate);
  const lunarMonth = timeInfo.lunar.monthNumber;
  const lunarDay = timeInfo.lunar.dayNumber;
  const hourIndex = getTimeIndexFromClock(timeInfo.solar.hour, timeInfo.solar.minute);
  // 时辰数取地支序（子1…亥12）：早子时与晚子时均为 1，与传统小六壬口径一致。
  // hourIndex 为 0-12（早子=0、晚子=12），直接入式会使所有时辰落宫偏移一格。
  const hourNumber = (hourIndex % 12) + 1;

  let startSeed = lunarMonth;
  let processSeed = lunarMonth + lunarDay - 1;
  let resultSeed = lunarMonth + lunarDay + hourNumber - 2;

  if (method === 'number') {
    const inputNumber = params?.number;
    if (typeof inputNumber !== 'number' || !Number.isInteger(inputNumber) || inputNumber <= 0) {
      throw new Error('小六壬数字起课必须提供正整数');
    }
    startSeed = inputNumber;
    processSeed = inputNumber + lunarDay - 1;
    resultSeed = inputNumber + lunarDay + hourNumber - 2;
  } else if (method === 'random') {
    const base = normalizeModulo(timestamp, 6) + 1;
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
  const startToProcess = elementRelations[start.element]?.[process.element] || '无关系';
  const processToResult = elementRelations[process.element]?.[result.element] || '无关系';
  const wuXingDesc = [
    startToProcess === '比和' ? '起因与过程平稳衔接' : '',
    startToProcess === '得生' ? '起因生过程，事态自然推进' : '',
    startToProcess === '所生' ? '起因被过程泄气，事态发展消耗初衷' : '',
    startToProcess === '被克' ? '起因被过程克制，起步受阻需耐心' : '',
    startToProcess === '所克' ? '起因克过程，主导推进但消耗精力' : '',
    processToResult === '比和' ? '过程与结果保持同势' : '',
    processToResult === '得生' ? '过程生结果，越做越顺' : '',
    processToResult === '所生' ? '过程被结果泄气，事态越做越弱' : '',
    processToResult === '被克' ? '过程被结果克制，先易后难需谨慎' : '',
    processToResult === '所克' ? '过程克结果，强力推进可见成效' : '',
  ]
    .filter(Boolean)
    .join('；');

  const wuxingRelations = {
    startToProcess,
    processToResult,
    description: wuXingDesc || '三宫五行无特殊生克态势',
  };

  // 旺衰按月令分析
  const monthBranch = (timeInfo as any)?.lunar?.monthBranch || '';
  const seasonStates = {
    start: monthBranch ? getSeasonState(start.element, monthBranch) : '平',
    process: monthBranch ? getSeasonState(process.element, monthBranch) : '平',
    result: monthBranch ? getSeasonState(result.element, monthBranch) : '平',
  };

  // 应期估算
  const yingQiEstimates: Record<string, string> = {
    '大安': '1-7日内或有初步消息，春季应期更快',
    '留连': '2-8日内或1-2月内，需等待转机，夏秋间或可解',
    '速喜': '3-9日内消息即至，夏季应期更快',
    '赤口': '4-7日内注意争执，秋季尤验',
    '小吉': '1-4周内可见助力，冬季应期更佳',
    '空亡': '应期不定，建议重新评估后再定时间',
  };

  return {
    method,
    methodLabel: XIAOLIUREN_METHOD_LABEL_MAP[method],
    timestamp,
    lunarMonth,
    lunarDay,
    hourIndex,
    hourLabel: getHourLabel(hourIndex),
    sequence: {
      start,
      process,
      result,
    },
    wuxingRelations,
    primary: result,
    tendency: result.tendency,
    questionHint: buildQuestionHint(result),
    // 新增字段
    seasonStates,
    yingQi: yingQiEstimates[result.name] || '应期视具体问题而定',
    direction: result.direction,
    shenSha: result.shenSha,
    fortune: result.fortune,
    timing: result.timing,
    bodyPart: result.bodyPart,
  };
}
