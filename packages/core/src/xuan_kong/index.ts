/**
 * @file 玄空飞星
 * @description 三元九运、下卦山向飞星、局型组合与结构化证据。
 * @传统依据 玄空飞星通行的三元九运、运盘顺飞、元龙阴阳定山向盘顺逆与下卦口径。
 * 不做形峦、玄空大卦或吉凶总分。
 */

import { buildChart, type Combination, type Formation } from '@soul-atelier/xuankong';

import {
  getMountainFromDegree,
  TWENTY_FOUR_MOUNTAINS,
  type CompassMountainPosition,
} from '../direction';
import { analyzeXuanKongEvidence, type XuanKongEvidenceAnalysis } from './evidence';

export type XuanKongFormation = Formation;

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
}

export interface XuanKongPalace {
  gong: number;
  name: string;
  direction: string;
  yunStar: number;
  shanStar: number;
  xiangStar: number;
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
  plates: {
    yun: number[];
    shan: number[];
    xiang: number[];
  };
  palaces: XuanKongPalace[];
  formation: XuanKongFormation;
  combinations: XuanKongCombination[];
  engine: {
    name: '@soul-atelier/xuankong';
    version: '0.2.1';
    mode: '下卦';
  };
  daoShanXiang: {
    shanToMountain: boolean;
    xiangToFacing: boolean;
    summary: string;
  };
  measurement?: XuanKongMeasurement;
  evidenceAnalysis: XuanKongEvidenceAnalysis;
  prompt: string;
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

export type FlyDirection = '顺飞' | '逆飞';

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

/**
 * 九星入中后按显式方向飞布。
 * 返回长度 9 的数组，下标 0..8 对应宫 1..9。
 */
export function flyStars(centerStar: number, direction: FlyDirection): number[] {
  if (!Number.isInteger(centerStar) || centerStar < 1 || centerStar > 9) {
    throw new Error(`飞星入中值必须是 1-9，当前为 ${centerStar}。`);
  }
  if (direction !== '顺飞' && direction !== '逆飞') {
    throw new Error(`飞星方向必须是顺飞或逆飞，当前为 ${String(direction)}。`);
  }
  const order = [5, 6, 7, 8, 9, 1, 2, 3, 4];
  const stars = Array.from({ length: 9 }, () => 0);
  for (let i = 0; i < 9; i += 1) {
    const gong = order[i];
    const offset = direction === '顺飞' ? i : -i;
    stars[gong - 1] = ((centerStar - 1 + offset + 18) % 9) + 1;
  }
  return stars;
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
    const stability: XuanKongMeasurement['stability'] =
      (uncertainty > 0 && boundaryDistance <= uncertainty) ||
      sitPos.isBoundary ||
      facingPos.isBoundary
        ? '山向边界敏感'
        : '稳定';
    const warnings: string[] = [];
    const candidateMountains: NonNullable<XuanKongMeasurement['candidateMountains']> = [];
    if (stability === '山向边界敏感') {
      warnings.push('测量容差已跨越二十四山边界，本次并列相邻山向结果');
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
    return {
      sitMountain: sitPos.mountain,
      facingMountain: facingPos.mountain,
      measurement: {
        facingDegree: facingPos.degree,
        sitDegree: sitPos.degree,
        stability,
        nearestBoundaryDistanceDegrees: Number(boundaryDistance.toFixed(2)),
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

function buildPalaces(yun: number[], shan: number[], xiang: number[]): XuanKongPalace[] {
  return GONG_ORDER.map((gong, index) => ({
    gong,
    name: GONG_NAMES[gong],
    direction: GONG_DIRECTION[gong],
    yunStar: yun[index],
    shanStar: shan[index],
    xiangStar: xiang[index],
  }));
}

function buildPrompt(result: Omit<XuanKongResult, 'evidenceAnalysis' | 'prompt'>) {
  const palaceLines = result.palaces
    .map(
      (item) =>
        `${item.name}（${item.direction}）：运${item.yunStar} 山${item.shanStar} 向${item.xiangStar}`,
    )
    .join('\n');
  return [
    '【玄空飞星排盘】',
    `运程：${result.period.label}`,
    `山向：坐${result.sitMountain}向${result.facingMountain}`,
    `局型：${result.formation}`,
    result.combinations.length
      ? `组合：${result.combinations.map((item) => item.name).join('、')}`
      : '组合：未检出特殊组合',
    `到山到向：${result.daoShanXiang.summary}`,
    ...(result.measurement?.stability === '山向边界敏感' &&
    result.measurement.candidateMountains?.length
      ? [
          `候选山向：${result.measurement.candidateMountains
            .map((item) => `坐${item.sitMountain}向${item.facingMountain}`)
            .join('、')}`,
        ]
      : []),
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
  const chart = buildChart(period.year, sitMountain);
  if (chart.period !== period.yun || chart.facing.name !== facingMountain) {
    throw new Error('玄空引擎返回的运数或朝向与输入不一致。');
  }
  const yunPlate = Array.from({ length: 9 }, () => 0);
  const shanPlate = Array.from({ length: 9 }, () => 0);
  const xiangPlate = Array.from({ length: 9 }, () => 0);
  for (const palace of chart.palaces) {
    const index = palace.earth - 1;
    if (index < 0 || index > 8) throw new Error(`玄空引擎返回无效洛书宫位：${palace.earth}。`);
    yunPlate[index] = palace.period;
    shanPlate[index] = palace.mountain;
    xiangPlate[index] = palace.water;
  }
  if (
    [yunPlate, shanPlate, xiangPlate].some((plate) => plate.some((star) => star < 1 || star > 9))
  ) {
    throw new Error('玄空引擎返回的三盘数据不完整。');
  }
  const sitGong = MOUNTAIN_TO_GONG[sitMountain];
  const facingGong = MOUNTAIN_TO_GONG[facingMountain];
  if (!sitGong || !facingGong) {
    throw new Error('无法识别山向对应宫位。');
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

  const palaces = buildPalaces(yunPlate, shanPlate, xiangPlate);
  const formation = chart.formation;
  const combinations = chart.combinations.map(mapCombination);
  const partial = {
    period,
    sitMountain,
    facingMountain,
    plates: { yun: yunPlate, shan: shanPlate, xiang: xiangPlate },
    palaces,
    formation,
    combinations,
    engine: {
      name: '@soul-atelier/xuankong' as const,
      version: '0.2.1' as const,
      mode: '下卦' as const,
    },
    daoShanXiang,
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
