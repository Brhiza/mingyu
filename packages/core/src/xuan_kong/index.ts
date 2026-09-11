/**
 * @file 玄空飞星
 * @description 三元九运、下卦与兼向替卦山向飞星、流年流月紫白叠宫、局型组合与结构化证据。
 * @传统依据 玄空飞星通行的三元九运、运盘顺飞、元龙阴阳定山向盘顺逆、中央九度与兼向替星口径；流年流月取三元紫白入中后顺飞。
 * 不做形峦、玄空大卦或吉凶总分。
 */

import {
  buildChart,
  detectCombinations,
  type Combination,
  type Formation,
} from '@soul-atelier/xuankong';

import {
  getMountainFromDegree,
  TWENTY_FOUR_MOUNTAINS,
  type CompassMountainPosition,
} from '../direction';
import {
  analyzeXuanKongEvidence,
  formatReplacementLeg,
  type XuanKongEvidenceAnalysis,
} from './evidence';
import { evaluateCastleGate, type CastleGateEvaluation } from './castle-gate';
import {
  flyStars,
  FLYING_STAR_WUXING,
  resolveFlyingStarYunState,
  resolveShanXiangRelation,
  resolveMonthFlyingStar,
  resolveXuanKongFlowStars,
  resolveYearFlyingStar,
  type FlyingStarYunState,
  type FlyDirection,
  type ShanXiangRelation,
  type XuanKongFlowStars,
} from './period-stars';

export {
  evaluateCastleGate,
  flyStars,
  resolveFlyingStarYunState,
  resolveMonthFlyingStar,
  resolveShanXiangRelation,
  resolveXuanKongFlowStars,
  resolveYearFlyingStar,
};
export type {
  FlyDirection,
  FlyingStarYunState,
  ShanXiangRelation,
  XuanKongFlowStars,
} from './period-stars';
export type { CastleGateCandidate, CastleGateEvaluation } from './castle-gate';

/**
 * 蒋大鸿《地理辨正》、沈氏玄空学通行二十四山替卦（起星）诀。
 * “子癸并甲申，贪狼一路行；壬卯乙未坤，五位为巨门；
 *  乾亥辰巽巳，连戌武曲名；酉辛丑艮丙，天星说破军；
 *  寅午庚丁上，右弼四星临。”
 */
export const SUBSTITUTE_STAR_POEM =
  '子癸并甲申，贪狼一路行；壬卯乙未坤，五位为巨门；乾亥辰巽巳，连戌武曲名；酉辛丑艮丙，天星说破军；寅午庚丁上，右弼四星临。';

/** 二十四山起星替卦对应表（替星数：1贪狼、2巨门、6武曲、7破军、9右弼）。 */
export const TWENTY_FOUR_MOUNTAIN_SUBSTITUTES: Readonly<Record<string, number>> = {
  子: 1,
  癸: 1,
  甲: 1,
  申: 1,
  壬: 2,
  卯: 2,
  乙: 2,
  未: 2,
  坤: 2,
  辰: 6,
  巽: 6,
  巳: 6,
  戌: 6,
  乾: 6,
  亥: 6,
  艮: 7,
  丙: 7,
  辛: 7,
  酉: 7,
  丑: 7,
  寅: 9,
  午: 9,
  丁: 9,
  庚: 9,
};

export type XuanKongGuaType = '下卦' | '替卦';
export type XuanKongFormation = Formation | '替卦未成四正局';

export interface XuanKongPeriod {
  year: number;
  yuan: '上元' | '中元' | '下元';
  yun: number;
  yunStar: number;
  startYear: number;
  endYear: number;
  label: string;
}

export interface XuanKongMeasurement {
  facingDegree?: number;
  sitDegree?: number;
  stability: '稳定' | '山向边界敏感';
  nearestBoundaryDistanceDegrees?: number;
  /** 两端度数均位于各山中央九度之外的兼向范围。 */
  isJianXiang?: boolean;
  candidateMountains?: Array<{ sitMountain: string; facingMountain: string; label: string }>;
  warnings: string[];
}

export interface XuanKongInput {
  year: number;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  measurementUncertaintyDegrees?: number;
  /** 默认下卦；仅在已核定兼向时显式传入替卦。 */
  guaType?: XuanKongGuaType;
  /** 流年公元年；不传则只排宅盘，不排流年飞星 */
  flowYear?: number;
  /** 流月公历月 1-12；须同时提供 flowYear */
  flowMonth?: number;
  /** 流月日期；不传时按该月 15 日所属节气月 */
  flowDay?: number;
}

export interface XuanKongPalace {
  gong: number;
  name: string;
  direction: string;
  yunStar: number;
  shanStar: number;
  xiangStar: number;
  yearStar?: number;
  monthStar?: number;
  shanXiangRelation: ShanXiangRelation;
  yunStarState: FlyingStarYunState;
}

export interface XuanKongCombination {
  name: string;
  kind: 'auspicious' | 'inauspicious';
  palaces?: number[];
  note: string;
}

export interface XuanKongResult {
  period: XuanKongPeriod;
  sitMountain: string;
  facingMountain: string;
  guaType: XuanKongGuaType;
  replacementApplied: boolean;
  replacementReason: string;
  plates: {
    yun: number[];
    shan: number[];
    xiang: number[];
    year?: number[];
    month?: number[];
  };
  flowStars?: XuanKongFlowStars;
  palaces: XuanKongPalace[];
  formation: XuanKongFormation;
  combinations: XuanKongCombination[];
  replacement?: {
    mountain: XuanKongReplacementLeg;
    facing: XuanKongReplacementLeg;
    rule: string;
    sourceUrl: string;
    verificationSourceUrl: string;
  };
  engine:
    | {
        name: '@soul-atelier/xuankong';
        version: '0.2.1';
        mode: '下卦';
      }
    | {
        name: 'mingyu-core';
        version: '替卦规则-v1';
        mode: '替卦';
        baseEngine: '@soul-atelier/xuankong@0.2.1';
      };
  daoShanXiang: {
    shanToMountain: boolean;
    xiangToFacing: boolean;
    summary: string;
  };
  measurement?: XuanKongMeasurement;
  castleGate?: CastleGateEvaluation;
  evidenceAnalysis: XuanKongEvidenceAnalysis;
  prompt: string;
}

export interface XuanKongReplacementLeg {
  originalCenterStar: number;
  referenceMountain: string;
  replacementStar: number;
  direction: '顺飞' | '逆飞';
}

const GONG_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const GONG_NAMES: Record<number, string> = {
  1: '坎一',
  2: '坤二',
  3: '震三',
  4: '巽四',
  5: '中五',
  6: '乾六',
  7: '兑七',
  8: '艮八',
  9: '离九',
};
const GONG_DIRECTION: Record<number, string> = {
  1: '北',
  2: '西南',
  3: '东',
  4: '东南',
  5: '中',
  6: '西北',
  7: '西',
  8: '东北',
  9: '南',
};

const MOUNTAIN_TO_GONG: Record<string, number> = {
  子: 1,
  癸: 1,
  丑: 8,
  艮: 8,
  寅: 8,
  甲: 3,
  卯: 3,
  乙: 3,
  辰: 4,
  巽: 4,
  巳: 4,
  丙: 9,
  午: 9,
  丁: 9,
  未: 2,
  坤: 2,
  申: 2,
  庚: 7,
  酉: 7,
  辛: 7,
  戌: 6,
  乾: 6,
  亥: 6,
  壬: 1,
};

const PERIOD_BASE_YEAR = 1864;

const REPLACEMENT_SOURCE_URL =
  'https://vr-d.com/pdf-file/%E9%A3%8E%E6%B0%B4%2F%E6%B2%89%E6%B0%8F%E7%8E%84%E7%A9%BA_%E4%B8%8A.pdf';
const REPLACEMENT_TABLE_VERIFICATION_URL =
  'https://vr-d.com/pdf-file/%E9%A3%8E%E6%B0%B4%2F%E4%B8%AD%E5%B7%9E%E6%B4%BE%E7%8E%84%E7%A9%BA%E5%AD%A6_%E4%B8%8A%E5%86%8C_%E7%8E%8B%E4%BA%AD%E4%B9%8B.pdf';

/** 九星本宫的三元龙山序，替星先按原入中星取同元山。 */
const STAR_HOME_MOUNTAINS: Record<number, readonly [string, string, string]> = {
  1: ['壬', '子', '癸'],
  2: ['未', '坤', '申'],
  3: ['甲', '卯', '乙'],
  4: ['辰', '巽', '巳'],
  6: ['戌', '乾', '亥'],
  7: ['庚', '酉', '辛'],
  8: ['丑', '艮', '寅'],
  9: ['丙', '午', '丁'],
};

/** 原典二十四山表中的元龙序与顺逆，方向仍以参考山阴阳确定。 */
const MOUNTAIN_YUAN_AND_DIRECTION: Record<string, { yuan: 0 | 1 | 2; direction: FlyDirection }> = {
  壬: { yuan: 0, direction: '顺飞' },
  子: { yuan: 1, direction: '逆飞' },
  癸: { yuan: 2, direction: '逆飞' },
  未: { yuan: 0, direction: '逆飞' },
  坤: { yuan: 1, direction: '顺飞' },
  申: { yuan: 2, direction: '顺飞' },
  甲: { yuan: 0, direction: '顺飞' },
  卯: { yuan: 1, direction: '逆飞' },
  乙: { yuan: 2, direction: '逆飞' },
  辰: { yuan: 0, direction: '逆飞' },
  巽: { yuan: 1, direction: '顺飞' },
  巳: { yuan: 2, direction: '顺飞' },
  戌: { yuan: 0, direction: '逆飞' },
  乾: { yuan: 1, direction: '顺飞' },
  亥: { yuan: 2, direction: '顺飞' },
  庚: { yuan: 0, direction: '顺飞' },
  酉: { yuan: 1, direction: '逆飞' },
  辛: { yuan: 2, direction: '逆飞' },
  丑: { yuan: 0, direction: '逆飞' },
  艮: { yuan: 1, direction: '顺飞' },
  寅: { yuan: 2, direction: '顺飞' },
  丙: { yuan: 0, direction: '顺飞' },
  午: { yuan: 1, direction: '逆飞' },
  丁: { yuan: 2, direction: '逆飞' },
};

const PALACE_KEY_TO_GONG: Record<string, number> = {
  kan: 1,
  kun: 2,
  zhen: 3,
  xun: 4,
  center: 5,
  qian: 6,
  dui: 7,
  gen: 8,
  li: 9,
};

function assertMountain(value: string, label: string) {
  if (!TWENTY_FOUR_MOUNTAINS.includes(value)) {
    throw new Error(`${label}必须是有效二十四山，当前为 ${value}。`);
  }
}

function normalizeYear(year: number): number {
  const value = year;
  if (!Number.isSafeInteger(value) || value < 1 || value > 9999) {
    throw new Error('year 必须是 1-9999 的整数年份。');
  }
  return value;
}

export function resolveXuanKongPeriod(year: number): XuanKongPeriod {
  const y = normalizeYear(year);
  const offset = y - PERIOD_BASE_YEAR;
  const cycleIndex = ((Math.floor(offset / 20) % 9) + 9) % 9;
  const yun = cycleIndex + 1;
  const startYear = PERIOD_BASE_YEAR + Math.floor(offset / 20) * 20;
  const endYear = startYear + 19;
  const yuan: XuanKongPeriod['yuan'] = yun <= 3 ? '上元' : yun <= 6 ? '中元' : '下元';
  return {
    year: y,
    yuan,
    yun,
    yunStar: yun,
    startYear,
    endYear,
    label: `${yuan}${yun}运（${startYear}-${endYear}）`,
  };
}

function oppositeMountain(mountain: string): string {
  const index = TWENTY_FOUR_MOUNTAINS.indexOf(mountain);
  return TWENTY_FOUR_MOUNTAINS[(index + 12) % 24];
}

function resolveMountains(input: XuanKongInput): {
  sitMountain: string;
  facingMountain: string;
  measurement?: XuanKongMeasurement;
} {
  const uncertainty = input.measurementUncertaintyDegrees ?? 0;
  if (!Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 45) {
    throw new Error('measurementUncertaintyDegrees 必须在 0-45 之间。');
  }

  if (input.sitDegree !== undefined || input.facingDegree !== undefined) {
    const sitPos: CompassMountainPosition =
      input.sitDegree !== undefined
        ? getMountainFromDegree(input.sitDegree)
        : getMountainFromDegree(((input.facingDegree as number) + 180) % 360);
    const facingPos: CompassMountainPosition =
      input.facingDegree !== undefined
        ? getMountainFromDegree(input.facingDegree)
        : getMountainFromDegree(((input.sitDegree as number) + 180) % 360);
    if (Math.abs(Math.abs(sitPos.degree - facingPos.degree) - 180) > 1e-10) {
      throw new Error('坐向度数必须严格相差180度。');
    }
    for (const [mountain, position, label] of [
      [input.sitMountain, sitPos, '坐山'],
      [input.facingMountain, facingPos, '朝向'],
    ] as const) {
      if (mountain !== undefined) {
        assertMountain(mountain, label);
        if (mountain !== position.mountain) {
          throw new Error(
            `${label}${mountain}与度数${position.degree}对应的${position.mountain}不一致。`,
          );
        }
      }
    }
    if (oppositeMountain(sitPos.mountain) !== facingPos.mountain) {
      throw new Error(
        `坐向必须严格相对；当前坐${sitPos.mountain}应向${oppositeMountain(sitPos.mountain)}，不能向${facingPos.mountain}。`,
      );
    }

    const distanceToBoundary = (pos: CompassMountainPosition) => {
      if (pos.isBoundary) return 0;
      const rem = (((pos.degree + 7.5) % 15) + 15) % 15;
      return Math.min(rem, 15 - rem);
    };
    const boundaryDistance = Math.min(distanceToBoundary(sitPos), distanceToBoundary(facingPos));
    const distanceFromCenter = (pos: CompassMountainPosition) => {
      if (pos.isBoundary) return 7.5;
      const rem = (((pos.degree + 7.5) % 15) + 15) % 15;
      return Math.abs(7.5 - rem);
    };
    const centralNineBoundaryDistance = Math.min(
      Math.abs(distanceFromCenter(sitPos) - 4.5),
      Math.abs(distanceFromCenter(facingPos) - 4.5),
    );
    const centralNineBoundarySensitive =
      centralNineBoundaryDistance === 0 ||
      (uncertainty > 0 && centralNineBoundaryDistance <= uncertainty);
    const stability: XuanKongMeasurement['stability'] =
      (uncertainty > 0 && boundaryDistance <= uncertainty) ||
      centralNineBoundarySensitive ||
      sitPos.isBoundary ||
      facingPos.isBoundary
        ? '山向边界敏感'
        : '稳定';
    const warnings: string[] = [];
    const candidateMountains: NonNullable<XuanKongMeasurement['candidateMountains']> = [];
    if (stability === '山向边界敏感') {
      warnings.push('测量容差已跨越二十四山边界或中央九度分界，本次并列相邻山向结果');
      const coverage = Math.max(uncertainty, 0.01) + 7.5;
      for (let index = 0; index < TWENTY_FOUR_MOUNTAINS.length; index += 1) {
        const centerDegree = index * 15;
        const difference = Math.abs(centerDegree - sitPos.degree);
        const circularDistance = Math.min(difference, 360 - difference);
        if (circularDistance > coverage + Number.EPSILON * 32) continue;
        const sitCandidate = getMountainFromDegree(centerDegree);
        const facingCandidate = getMountainFromDegree((centerDegree + 180) % 360);
        candidateMountains.push({
          sitMountain: sitCandidate.mountain,
          facingMountain: facingCandidate.mountain,
          label: `坐${sitCandidate.mountain}向${facingCandidate.mountain}`,
        });
      }
    }
    const isJianXiang =
      !sitPos.isBoundary &&
      !facingPos.isBoundary &&
      distanceFromCenter(sitPos) > 4.5 &&
      distanceFromCenter(facingPos) > 4.5;
    if (isJianXiang) {
      warnings.push(
        '坐山或朝向偏离山中心超过中央九度半宽（4.5度），已进入兼向范围；默认仍按下卦，已核定兼向时可显式选择替卦',
      );
    }
    return {
      sitMountain: sitPos.mountain,
      facingMountain: facingPos.mountain,
      measurement: {
        facingDegree: facingPos.degree,
        sitDegree: sitPos.degree,
        stability,
        nearestBoundaryDistanceDegrees: Number(boundaryDistance.toFixed(2)),
        isJianXiang,
        ...(candidateMountains.length ? { candidateMountains } : {}),
        warnings,
      },
    };
  }

  if (input.sitMountain) {
    assertMountain(input.sitMountain, 'sitMountain');
    const facing = input.facingMountain ?? oppositeMountain(input.sitMountain);
    assertMountain(facing, 'facingMountain');
    if (oppositeMountain(input.sitMountain) !== facing) {
      throw new Error(
        `坐向必须严格相对；当前坐${input.sitMountain}应向${oppositeMountain(input.sitMountain)}，不能向${facing}。`,
      );
    }
    return { sitMountain: input.sitMountain, facingMountain: facing };
  }
  if (input.facingMountain) {
    assertMountain(input.facingMountain, 'facingMountain');
    return {
      sitMountain: oppositeMountain(input.facingMountain),
      facingMountain: input.facingMountain,
    };
  }
  throw new Error('需提供 sitMountain/facingMountain，或 sitDegree/facingDegree。');
}

function resolveGuaType(
  input: XuanKongInput,
  measurement?: XuanKongMeasurement,
): { guaType: XuanKongGuaType; replacementApplied: boolean; replacementReason: string } {
  if (input.guaType !== undefined && input.guaType !== '下卦' && input.guaType !== '替卦') {
    throw new Error(`guaType 必须是下卦或替卦，当前为 ${String(input.guaType)}。`);
  }
  if (input.guaType === '替卦') {
    if (measurement) {
      if (measurement.stability !== '稳定') {
        throw new Error('替卦不能用于山向边界敏感的测量，请先复测并确认山向。');
      }
      if (!measurement.isJianXiang) {
        throw new Error('替卦需要坐向均位于各山中央九度之外的兼向度数（外侧三度）。');
      }
      return {
        guaType: '替卦',
        replacementApplied: true,
        replacementReason: '输入明确指定替卦，坐向已核定为中央九度之外的兼向外侧三度',
      };
    }
    return {
      guaType: '替卦',
      replacementApplied: true,
      replacementReason: '输入明确指定替卦；山向以二十四山名输入，兼向范围由调用方核定',
    };
  }
  if (input.guaType === '下卦') {
    return { guaType: '下卦', replacementApplied: false, replacementReason: '输入明确指定下卦' };
  }
  return {
    guaType: '下卦',
    replacementApplied: false,
    replacementReason: '未指定卦型，按下卦处理',
  };
}

function resolveReplacementLeg(
  sourceMountain: string,
  originalCenterStar: number,
): XuanKongReplacementLeg {
  const sourceMeta = MOUNTAIN_YUAN_AND_DIRECTION[sourceMountain];
  if (!sourceMeta) throw new Error(`替卦缺少${sourceMountain}山元龙资料。`);
  const referenceMountain =
    originalCenterStar === 5
      ? sourceMountain
      : STAR_HOME_MOUNTAINS[originalCenterStar]?.[sourceMeta.yuan];
  if (!referenceMountain) {
    throw new Error(`替卦无法按${originalCenterStar}星与${sourceMountain}山同元龙取本宫山。`);
  }
  const replacementStar =
    originalCenterStar === 5 ? 5 : TWENTY_FOUR_MOUNTAIN_SUBSTITUTES[referenceMountain];
  const referenceMeta = MOUNTAIN_YUAN_AND_DIRECTION[referenceMountain];
  if (!replacementStar || !referenceMeta) {
    throw new Error(`替卦缺少${referenceMountain}山替星或阴阳资料。`);
  }
  return {
    originalCenterStar,
    referenceMountain,
    replacementStar,
    direction: referenceMeta.direction,
  };
}

function classifyPlates(
  period: number,
  sitGong: number,
  facingGong: number,
  shanPlate: number[],
  xiangPlate: number[],
): XuanKongFormation {
  const mountainAtSit = shanPlate[sitGong - 1] === period;
  const mountainAtFacing = shanPlate[facingGong - 1] === period;
  const facingAtSit = xiangPlate[sitGong - 1] === period;
  const facingAtFacing = xiangPlate[facingGong - 1] === period;
  if (mountainAtSit && facingAtFacing) return '旺山旺向';
  if (mountainAtFacing && facingAtSit) return '上山下水';
  if (mountainAtFacing && facingAtFacing) return '双星到向';
  if (mountainAtSit && facingAtSit) return '双星到坐';
  return '替卦未成四正局';
}

function buildPalaces(
  yun: number[],
  shan: number[],
  xiang: number[],
  yunNumber: number,
  yearPlate?: number[],
  monthPlate?: number[],
): XuanKongPalace[] {
  return GONG_ORDER.map((gong, index) => ({
    gong,
    name: GONG_NAMES[gong],
    direction: GONG_DIRECTION[gong],
    yunStar: yun[index],
    shanStar: shan[index],
    xiangStar: xiang[index],
    ...(yearPlate ? { yearStar: yearPlate[index] } : {}),
    ...(monthPlate ? { monthStar: monthPlate[index] } : {}),
    shanXiangRelation: resolveShanXiangRelation(shan[index], xiang[index]),
    yunStarState: resolveFlyingStarYunState(yun[index], yunNumber),
  }));
}

function formatStarRelation(from: string, fromStar: number, to: string, toStar: number): string {
  const source = `${from}${fromStar}${FLYING_STAR_WUXING[fromStar]}`;
  const target = `${to}${toStar}${FLYING_STAR_WUXING[toStar]}`;
  switch (resolveShanXiangRelation(fromStar, toStar)) {
    case '生入':
      return `${target}生${source}`;
    case '生出':
      return `${source}生${target}`;
    case '克入':
      return `${target}克${source}`;
    case '克出':
      return `${source}克${target}`;
    case '比和':
      return `${source}与${target}比和`;
  }
}

function buildPrompt(result: Omit<XuanKongResult, 'evidenceAnalysis' | 'prompt'>) {
  const natalStar = (label: string, star: number) =>
    `${label}${star}（${FLYING_STAR_WUXING[star]}，${resolveFlyingStarYunState(star, result.period.yun)}）`;
  const palaceLines = result.palaces
    .map((item) => {
      const combos = result.combinations
        .filter((combo) => combo.palaces?.includes(item.gong))
        .map((combo) => combo.name);
      const yearText =
        item.yearStar !== undefined
          ? ` 年${item.yearStar}（${FLYING_STAR_WUXING[item.yearStar]}）`
          : '';
      const monthText =
        item.monthStar !== undefined
          ? ` 月${item.monthStar}（${FLYING_STAR_WUXING[item.monthStar]}）`
          : '';
      const relations = [
        `山向${item.shanXiangRelation}：${formatStarRelation('山星', item.shanStar, '向星', item.xiangStar)}`,
        formatStarRelation('运星', item.yunStar, '山星', item.shanStar),
        formatStarRelation('运星', item.yunStar, '向星', item.xiangStar),
      ];
      return `${item.name}（${item.direction}）：${natalStar('运', item.yunStar)} ${natalStar('山', item.shanStar)} ${natalStar('向', item.xiangStar)}${yearText}${monthText}\n  ${relations.join('；')}${combos.length ? `；组合${combos.join('、')}` : ''}`;
    })
    .join('\n');
  return [
    '【玄空飞星排盘】',
    `运程：${result.period.label}`,
    `本次资料层级：宅盘（运盘、山盘、向盘）${result.flowStars ? '、流年盘' : ''}${result.flowStars?.monthPlate ? '、流月盘' : ''}。各星当运、生气、退气等状态以宅盘${result.period.yun}运为参照。`,
    `山向：坐${result.sitMountain}向${result.facingMountain}`,
    `卦型：${result.guaType}；${result.replacementReason}`,
    result.replacement
      ? `替星取法：山盘${formatReplacementLeg(result.replacement.mountain)}；向盘${formatReplacementLeg(result.replacement.facing)}`
      : '',
    `局型：${result.formation}`,
    result.combinations.length
      ? `组合：${result.combinations.map((item) => item.name).join('、')}`
      : '组合：未检出特殊组合',
    `到山到向：${result.daoShanXiang.summary}`,
    result.castleGate?.summary ?? '',
    (() => {
      const wuHuang = result.palaces.filter((p) => p.xiangStar === 5 || p.shanStar === 5);
      return wuHuang.length
        ? `五黄落宫：${wuHuang
            .map((palace) => {
              const layers = [
                palace.shanStar === 5 ? '山星' : '',
                palace.xiangStar === 5 ? '向星' : '',
              ].filter(Boolean);
              return `${palace.name}（${palace.direction}，${layers.join('、')}）`;
            })
            .join('；')}`
        : '';
    })(),
    ...(result.measurement?.stability === '山向边界敏感' &&
    result.measurement.candidateMountains?.length
      ? [
          `候选山向：${result.measurement.candidateMountains
            .map((item) => `坐${item.sitMountain}向${item.facingMountain}`)
            .join('、')}`,
        ]
      : []),
    result.flowStars
      ? `流年飞星：${result.flowStars.yearPlate.year === 0 ? '公元前1' : result.flowStars.yearPlate.year}年${result.flowStars.yearPlate.starName}入中；${result.flowStars.yearPlate.calendarNote}`
      : '',
    result.flowStars?.monthPlate
      ? `流月飞星：${result.flowStars.monthPlate.starName}入中；${result.flowStars.monthPlate.calendarNote}`
      : '',
    result.flowStars ? '宅盘与流年流月逐宫叠加：' : '',
    '三盘九宫：',
    palaceLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function mapCombination(combination: Combination): XuanKongCombination {
  const palaces = combination.palaces?.map((key) => {
    const gong = PALACE_KEY_TO_GONG[key];
    if (!gong) throw new Error(`玄空引擎返回未知宫位：${key}。`);
    return gong;
  });
  return {
    name: combination.name,
    kind: combination.kind,
    ...(palaces?.length ? { palaces } : {}),
    note: combination.note,
  };
}

export function generateXuanKong(input: XuanKongInput): XuanKongResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('玄空飞星参数必须是对象。');
  }
  const period = resolveXuanKongPeriod(input.year);
  const { sitMountain, facingMountain, measurement } = resolveMountains(input);
  const gua = resolveGuaType(input, measurement);
  const chart = buildChart(period.year, sitMountain);
  if (chart.period !== period.yun || chart.facing.name !== facingMountain) {
    throw new Error('玄空引擎返回的运数或朝向与输入不一致。');
  }
  const yunPlate = Array.from({ length: 9 }, () => 0);
  let shanPlate = Array.from({ length: 9 }, () => 0);
  let xiangPlate = Array.from({ length: 9 }, () => 0);
  for (const palace of chart.palaces) {
    const index = palace.earth - 1;
    if (index < 0 || index > 8) throw new Error(`玄空引擎返回无效洛书宫位：${palace.earth}。`);
    yunPlate[index] = palace.period;
    shanPlate[index] = palace.mountain;
    xiangPlate[index] = palace.water;
  }
  const sitGong = MOUNTAIN_TO_GONG[sitMountain];
  const facingGong = MOUNTAIN_TO_GONG[facingMountain];
  if (!sitGong || !facingGong) {
    throw new Error('无法识别山向对应宫位。');
  }
  let replacement: XuanKongResult['replacement'];
  if (gua.guaType === '替卦') {
    const mountain = resolveReplacementLeg(sitMountain, yunPlate[sitGong - 1]);
    const facing = resolveReplacementLeg(facingMountain, yunPlate[facingGong - 1]);
    shanPlate = flyStars(mountain.replacementStar, mountain.direction);
    xiangPlate = flyStars(facing.replacementStar, facing.direction);
    replacement = {
      mountain,
      facing,
      rule: '运盘山向宫星入中，按原入中星本宫同元龙取替星；五黄仍以五入中，借实际山向阴阳定顺逆；其余星顺逆依参考山阴阳',
      sourceUrl: REPLACEMENT_SOURCE_URL,
      verificationSourceUrl: REPLACEMENT_TABLE_VERIFICATION_URL,
    };
  }
  if (
    [yunPlate, shanPlate, xiangPlate].some((plate) => plate.some((star) => star < 1 || star > 9))
  ) {
    throw new Error('玄空引擎返回的三盘数据不完整。');
  }
  const daoShan = shanPlate[sitGong - 1] === period.yunStar;
  const daoXiang = xiangPlate[facingGong - 1] === period.yunStar;
  const daoShanXiang = {
    shanToMountain: daoShan,
    xiangToFacing: daoXiang,
    summary:
      daoShan && daoXiang
        ? '当运星到山且到向'
        : daoShan
          ? '当运星到山，未同时到向'
          : daoXiang
            ? '当运星到向，未同时到山'
            : '当运星未同时形成到山到向',
  };

  const flowStars = resolveXuanKongFlowStars({
    flowYear: input.flowYear,
    flowMonth: input.flowMonth,
    flowDay: input.flowDay,
  });
  const palaces = buildPalaces(
    yunPlate,
    shanPlate,
    xiangPlate,
    period.yun,
    flowStars?.yearPlate.plate,
    flowStars?.monthPlate?.plate,
  );
  const formation =
    gua.guaType === '下卦'
      ? chart.formation
      : classifyPlates(period.yun, sitGong, facingGong, shanPlate, xiangPlate);
  const combinationSource =
    gua.guaType === '下卦'
      ? chart.combinations
      : detectCombinations(
          period.yun,
          // 检测器仅以“双星到向”开启打劫，其余组合独立于四正局；保留扩展局型原值。
          formation as Formation,
          chart.facing.palace,
          chart.palaces.map((palace) => ({
            ...palace,
            mountain: shanPlate[palace.earth - 1],
            water: xiangPlate[palace.earth - 1],
          })),
        );
  const combinations = combinationSource.map(mapCombination);
  const castleGate = evaluateCastleGate({
    yun: period.yun,
    facingMountain,
    yunPlate,
  });
  const partial = {
    period,
    sitMountain,
    facingMountain,
    guaType: gua.guaType,
    replacementApplied: gua.replacementApplied,
    replacementReason: gua.replacementReason,
    plates: {
      yun: yunPlate,
      shan: shanPlate,
      xiang: xiangPlate,
      ...(flowStars ? { year: flowStars.yearPlate.plate } : {}),
      ...(flowStars?.monthPlate ? { month: flowStars.monthPlate.plate } : {}),
    },
    ...(flowStars ? { flowStars } : {}),
    palaces,
    formation,
    combinations,
    ...(replacement ? { replacement } : {}),
    engine:
      gua.guaType === '下卦'
        ? {
            name: '@soul-atelier/xuankong' as const,
            version: '0.2.1' as const,
            mode: '下卦' as const,
          }
        : {
            name: 'mingyu-core' as const,
            version: '替卦规则-v1' as const,
            mode: '替卦' as const,
            baseEngine: '@soul-atelier/xuankong@0.2.1' as const,
          },
    daoShanXiang,
    castleGate,
    ...(measurement ? { measurement } : {}),
  };

  const evidenceAnalysis = analyzeXuanKongEvidence(partial);
  const prompt = buildPrompt(partial);
  return {
    ...partial,
    evidenceAnalysis,
    prompt,
  };
}

export type { XuanKongEvidenceAnalysis };
