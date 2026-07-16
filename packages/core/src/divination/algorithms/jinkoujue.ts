/**
 * @file 金口诀（大六壬金口诀）起课算法
 * @description 以地分、将神、贵神、人元四位一体完成起课，并输出旺衰、生克、空亡与结构化证据。
 * @流派 大六壬金口诀
 * @古籍依据 《大六壬金口诀》及《大六壬大全》月将加时、贵人顺逆、五子元遁口径
 * @核心算法
 * 1. 地分：时间起课取占时地支；数字起课 1-12 映射子至亥，大于 12 按 12 归一；随机起课在十二支中可复现抽取。
 * 2. 将神：按已交中气定月将，月将加占时顺布天盘，取地分上所临天盘地支。
 * 3. 贵神：按日干昼夜贵人起十二天将，取地分上神所乘天将，并以该上神支为贵神支。
 * 4. 人元：按日干五子元遁求地分遁干。
 * 5. 断法主线固定为“贵神主事、将神主事体、人元主人情、地分主落点”。
 */
import type {
  JinkoujueData,
  JinkoujueDivinationMethod,
  JinkoujueFourPosition,
  JinkoujuePositionName,
} from '../../types/divination';
import { getDivinationTime } from '../../calendar/timeManager';
import { getVoidBranches } from '../../calendar/lunar';
import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  getBranchIndex,
  getBranchWuxing,
  getSeasonState,
  getStemWuxing,
  isKe,
  isSheng,
} from '../../ganzhi';
import { SolarTerm, SolarTime } from 'tyme4ts';
import { assertOptionalRecord } from '../../shared/validation';
import type { RandomOptions, RandomTrace } from '../../shared/random';
import { createRandomContext, hasRandomOptions, randomInt } from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import {
  buildHeavenlyPlate,
  getNoblemanBranch,
  TIANJIANG_ATTRIBUTES,
  type TianJiangName,
} from './liuren/helpers/plate';
import { analyzeJinkoujueEvidence } from '../jinkoujue-evidence';

const METHOD_LABELS: Record<JinkoujueDivinationMethod, string> = {
  time: '时间起课',
  number: '数字起课',
  random: '随机起课',
};

const MONTH_LEADER_BY_ZHONGQI: Record<string, string> = {
  雨水: '亥',
  春分: '戌',
  谷雨: '酉',
  小满: '申',
  夏至: '未',
  大暑: '午',
  处暑: '巳',
  秋分: '辰',
  霜降: '卯',
  小雪: '寅',
  冬至: '丑',
  大寒: '子',
};

const DAYTIME_BRANCHES = new Set(['卯', '辰', '巳', '午', '未', '申']);

/** 五子元遁：甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途 */
const WUZI_YUAN_STEM: Record<string, string> = {
  甲: '甲',
  己: '甲',
  乙: '丙',
  庚: '丙',
  丙: '戊',
  辛: '戊',
  丁: '庚',
  壬: '庚',
  戊: '壬',
  癸: '壬',
};

const POSITION_ROLES: Record<JinkoujuePositionName, string> = {
  地分: '落点与所处之位，主事情发生场域与现实落脚',
  将神: '事体与所问对象之象，主事情本身情状',
  贵神: '主事之神，主断事成败、主客与关键推动力量',
  人元: '人情与气机之端，主相关人物态度与气势',
};

function assertMethod(method: JinkoujueDivinationMethod): void {
  if (!Object.prototype.hasOwnProperty.call(METHOD_LABELS, method)) {
    throw new Error(`未知的金口诀起课方式: ${method}`);
  }
}

function getMonthLeaderByZhongqi(timeInfo: ReturnType<typeof getDivinationTime>['timeInfo']) {
  const currentTime = SolarTime.fromYmdHms(
    timeInfo.solar.year,
    timeInfo.solar.month,
    timeInfo.solar.day,
    timeInfo.solar.hour,
    timeInfo.solar.minute,
    0,
  );
  const currentJulianDay = currentTime.getJulianDay().getDay();
  const year = timeInfo.solar.year;
  let activeZhongqi = '冬至';
  let activeJulianDay = Number.NEGATIVE_INFINITY;

  for (const scanYear of [year - 1, year, year + 1]) {
    for (let termIndex = 0; termIndex < 24; termIndex += 2) {
      const term = SolarTerm.fromIndex(scanYear, termIndex);
      const termJulianDay = term.getJulianDay().getDay();
      if (termJulianDay <= currentJulianDay && termJulianDay > activeJulianDay) {
        activeJulianDay = termJulianDay;
        activeZhongqi = term.getName();
      }
    }
  }

  const monthLeader = MONTH_LEADER_BY_ZHONGQI[activeZhongqi];
  if (!monthLeader) {
    throw new Error(`找不到中气 "${activeZhongqi}" 对应的金口诀月将。`);
  }
  return monthLeader;
}

function getYuanStemOnBranch(dayStem: string, branch: string) {
  const startStem = WUZI_YUAN_STEM[dayStem];
  if (!startStem) {
    throw new Error(`无法识别日干 "${dayStem}" 的五子元遁起干。`);
  }
  const startStemIndex = HEAVENLY_STEMS.indexOf(startStem as (typeof HEAVENLY_STEMS)[number]);
  const branchIndex = getBranchIndex(branch);
  if (startStemIndex < 0 || branchIndex < 0) {
    throw new Error(`五子元遁计算失败：日干 ${dayStem}，地支 ${branch}`);
  }
  return HEAVENLY_STEMS[(startStemIndex + branchIndex) % HEAVENLY_STEMS.length];
}

function describeElementRelation(sourceElement: string, targetElement: string) {
  if (!sourceElement || !targetElement) return '关系未定';
  if (sourceElement === targetElement) return '比和';
  if (isSheng(sourceElement, targetElement)) return '生';
  if (isSheng(targetElement, sourceElement)) return '被生';
  if (isKe(sourceElement, targetElement)) return '克';
  if (isKe(targetElement, sourceElement)) return '被克';
  return '无直接生克';
}

function buildPosition(params: {
  name: JinkoujuePositionName;
  branch: string;
  stem?: string;
  god?: string;
  monthBranch: string;
  xunKong: string[];
}): JinkoujueFourPosition {
  const element = params.stem ? getStemWuxing(params.stem) : getBranchWuxing(params.branch);
  const seasonState = getSeasonState(element, params.monthBranch);
  const isVoid = params.xunKong.includes(params.branch);
  const support: string[] = [];
  const constraints: string[] = [];

  if (seasonState === '旺' || seasonState === '相') support.push(`月令${seasonState}`);
  if (seasonState === '休' || seasonState === '囚' || seasonState === '死') {
    constraints.push(`月令${seasonState}`);
  }
  if (isVoid) constraints.push('落日旬空');
  if (params.god) {
    const attr = TIANJIANG_ATTRIBUTES[params.god as TianJiangName];
    if (attr) support.push(`天将属${attr.category}`);
  }

  return {
    name: params.name,
    role: POSITION_ROLES[params.name],
    branch: params.branch,
    stem: params.stem,
    god: params.god,
    element,
    seasonState,
    isVoid,
    support,
    constraints,
    promptText: [
      `${params.name}${params.stem || ''}${params.branch}`,
      params.god ? `乘${params.god}` : '',
      `五行${element}`,
      `月令${seasonState}`,
      isVoid ? '旬空' : '不空',
    ]
      .filter(Boolean)
      .join('；'),
  };
}

function resolveDiFenBranch(params: {
  method: JinkoujueDivinationMethod;
  number?: number;
  hourBranch: string;
  random?: () => number;
}) {
  if (params.method === 'time') {
    return {
      branch: params.hourBranch,
      inputBase: getBranchIndex(params.hourBranch) + 1,
      inputBaseSource: '占时地支序数' as const,
      note: `时间起课以占时${params.hourBranch}为地分`,
    };
  }

  if (params.method === 'number') {
    const number = params.number;
    if (!Number.isInteger(number) || !number || number < 1) {
      throw new Error('金口诀数字起课必须提供不小于 1 的整数。');
    }
    const normalized = ((number - 1) % 12) + 1;
    const branch = EARTHLY_BRANCHES[normalized - 1];
    return {
      branch,
      inputBase: number,
      inputBaseSource: '用户数字' as const,
      note: `数字起课以${number}归一为${normalized}，对应地分${branch}`,
    };
  }

  if (!params.random) {
    throw new Error('金口诀随机起课缺少随机源。');
  }
  const value = randomInt(12, params.random) + 1;
  const branch = EARTHLY_BRANCHES[value - 1];
  return {
    branch,
    inputBase: value,
    inputBaseSource: '随机数' as const,
    note: `随机起课抽得${value}，对应地分${branch}`,
  };
}

/**
 * 生成金口诀完整课盘。
 */
export function generateJinkoujue(
  params?: {
    method?: JinkoujueDivinationMethod;
    number?: number;
    customDate?: Date;
  } & RandomOptions,
): JinkoujueData {
  assertOptionalRecord(params, '金口诀起课参数');
  const method = params?.method ?? 'time';
  assertMethod(method);
  if (method !== 'random' && hasRandomOptions(params)) {
    throw new Error('金口诀仅随机起课接受 seed、replay 或自定义随机源。');
  }

  let randomTrace: RandomTrace | undefined;

  const { ganzhi, timeInfo, timestamp } = getDivinationTime(params?.customDate);
  const dayStem = ganzhi.day.charAt(0);
  const monthBranch = ganzhi.month.charAt(1);
  const hourBranch = ganzhi.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
  const monthLeader = getMonthLeaderByZhongqi(timeInfo);
  const noblemanBranch = getNoblemanBranch(dayStem, dayNight);
  const xunKong = getVoidBranches(ganzhi.day);

  let diFenResolved: {
    branch: string;
    inputBase: number;
    inputBaseSource: '占时地支序数' | '用户数字' | '随机数';
    note: string;
  };

  if (method === 'random') {
    const context = createRandomContext(params);
    diFenResolved = resolveDiFenBranch({
      method,
      hourBranch,
      random: context.random,
    });
    randomTrace = context.getTrace();
  } else {
    diFenResolved = resolveDiFenBranch({
      method,
      number: params?.number,
      hourBranch,
    });
  }

  const heavenlyPlate = buildHeavenlyPlate({
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    dayNight,
  });
  const jiangOnDiFen = heavenlyPlate.find((item) => item.under === diFenResolved.branch);
  if (!jiangOnDiFen) {
    throw new Error(`金口诀找不到地分 ${diFenResolved.branch} 上的将神。`);
  }

  const renYuanStem = getYuanStemOnBranch(dayStem, diFenResolved.branch);
  const diFen = buildPosition({
    name: '地分',
    branch: diFenResolved.branch,
    monthBranch,
    xunKong,
  });
  const jiangShen = buildPosition({
    name: '将神',
    branch: jiangOnDiFen.branch,
    monthBranch,
    xunKong,
  });
  const guiShen = buildPosition({
    name: '贵神',
    branch: jiangOnDiFen.branch,
    god: jiangOnDiFen.god,
    monthBranch,
    xunKong,
  });
  const renYuan = buildPosition({
    name: '人元',
    branch: diFenResolved.branch,
    stem: renYuanStem,
    monthBranch,
    xunKong,
  });

  const positions = { diFen, jiangShen, guiShen, renYuan };
  const relations = {
    guiToJiang: describeElementRelation(guiShen.element, jiangShen.element),
    guiToRen: describeElementRelation(guiShen.element, renYuan.element),
    jiangToDi: describeElementRelation(jiangShen.element, diFen.element),
    renToDi: describeElementRelation(renYuan.element, diFen.element),
    guiToDi: describeElementRelation(guiShen.element, diFen.element),
  };
  const mainLine = [
    `取用主线：以贵神${guiShen.god || ''}${guiShen.branch}主事，将神${jiangShen.branch}主事体，人元${renYuan.stem || ''}${renYuan.branch}主人情，地分${diFen.branch}主落点`,
    `贵神与将神关系：${relations.guiToJiang}`,
    `贵神与人元关系：${relations.guiToRen}`,
    `将神与地分关系：${relations.jiangToDi}`,
  ].join('；');

  const result: JinkoujueData = {
    method,
    methodLabel: METHOD_LABELS[method],
    ganzhi,
    timestamp,
    dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    xunKong,
    diFenBranch: diFen.branch,
    positions,
    relations,
    mainLine,
    calculation: {
      method,
      methodLabel: METHOD_LABELS[method],
      inputBase: diFenResolved.inputBase,
      inputBaseSource: diFenResolved.inputBaseSource,
      diFenNote: diFenResolved.note,
      monthLeaderRule: '按已交中气定月将',
      yuanDunRule: '五子元遁求地分人元',
      noblemanRule: `${dayNight}贵人法`,
    },
    focusEvidence: [
      {
        target: `贵神${guiShen.god || ''}${guiShen.branch}`,
        role: '主事之神',
        level: '主证',
        evidence: [
          `${dayNight}贵人起于${noblemanBranch}`,
          `地分${diFen.branch}上乘${guiShen.god}`,
          `月令${guiShen.seasonState}`,
        ],
        limitations: guiShen.isVoid ? ['贵神旬空，主证需待填实'] : [],
      },
      {
        target: `将神${jiangShen.branch}`,
        role: '事体之象',
        level: '主证',
        evidence: [
          `月将${monthLeader}加占时${hourBranch}`,
          `地分${diFen.branch}上临${jiangShen.branch}`,
        ],
        limitations: jiangShen.isVoid ? ['将神旬空，事体需待填实'] : [],
      },
      {
        target: `人元${renYuan.stem}${renYuan.branch}`,
        role: '人情与气势',
        level: '辅证',
        evidence: [`日干${dayStem}五子元遁`, `地分${diFen.branch}遁得${renYuan.stem}`],
        limitations: [],
      },
      {
        target: `地分${diFen.branch}`,
        role: '落点与场域',
        level: '辅证',
        evidence: [diFenResolved.note, `地支五行${diFen.element}`],
        limitations: diFen.isVoid ? ['地分旬空，落点需待核实'] : [],
      },
    ],
    summary: [
      mainLine,
      `四位：地分${diFen.branch}、将神${jiangShen.branch}、贵神${guiShen.god}${guiShen.branch}、人元${renYuan.stem}${renYuan.branch}`,
      `空亡：${xunKong.join('、') || '无'}`,
    ].join('。'),
    ...(randomTrace ? { randomTrace } : {}),
  };

  const resultWithMeta = attachResultMeta(result, {
    algorithm: 'jinkoujue',
    input: {
      method,
      number: params?.number ?? null,
      timestamp,
      diFenBranch: diFen.branch,
    },
    calculatedAt: timestamp,
    random: randomTrace,
  });
  return {
    ...resultWithMeta,
    evidenceAnalysis: analyzeJinkoujueEvidence(resultWithMeta),
  };
}

export { analyzeJinkoujueEvidence } from '../jinkoujue-evidence';
export type {
  JinkoujueEvidenceAnalysis,
  JinkoujuePositionFact,
  JinkoujueRelationFact,
} from '../jinkoujue-evidence';
