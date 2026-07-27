/**
 * @file 玄空飞星
 * @description 三元九运、下卦与兼向替卦山向飞星、局型组合与结构化证据。
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
import { analyzeXuanKongEvidence, type XuanKongEvidenceAnalysis } from './evidence';

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
  guaType?: XuanKongGuaType;
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

export interface XuanKongReplacementLeg {
  originalCenterStar: number;
  referenceMountain: string;
  replacementStar: number;
  direction: FlyDirection;
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
  };
  palaces: XuanKongPalace[];
  formation: XuanKongFormation;
  combinations: XuanKongCombination[];
  replacement?: {
    mountain: XuanKongReplacementLeg;
    facing: XuanKongReplacementLeg;
    rule: string;
    sourceUrl: string;
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

const REPLACEMENT_SOURCE_URL =
  'https://github.com/funfwo/Fengshui/blob/bd7d85ea1af4be41cacab6e35a5e07023e469be9/paipan.py';

const REPLACEMENT_STAR_BY_MOUNTAIN: Record<string, number> = {
  子: 1,
  癸: 1,
  甲: 1,
  申: 1,
  壬: 2,
  卯: 2,
  乙: 2,
  未: 2,
  坤: 2,
  乾: 6,
  亥: 6,
  辰: 6,
  巽: 6,
  巳: 6,
  戌: 6,
  酉: 7,
  辛: 7,
  丑: 7,
  艮: 7,
  丙: 7,
  寅: 9,
  午: 9,
  庚: 9,
  丁: 9,
};

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

const MOUNTAIN_YUAN_AND_DIRECTION: Record<string, { yuan: 0 | 1 | 2; direction: FlyDirection }> =
  Object.fromEntries(
    Object.entries(STAR_HOME_MOUNTAINS).flatMap(([starText, mountains]) => {
      const star = Number(starText);
      const corner = [2, 4, 6, 8].includes(star);
      return mountains.map((mountain, yuan) => [
        mountain,
        {
          yuan: yuan as 0 | 1 | 2,
          direction: (corner ? yuan !== 0 : yuan === 0) ? '顺飞' : '逆飞',
        },
      ]);
    }),
  );

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

function resolveGuaType(
  input: XuanKongInput,
  measurement?: XuanKongMeasurement,
): { guaType: XuanKongGuaType; replacementApplied: boolean; replacementReason: string } {
  if (input.guaType !== undefined && input.guaType !== '下卦' && input.guaType !== '替卦') {
    throw new Error(`guaType 必须是下卦或替卦，当前为 ${String(input.guaType)}。`);
  }
  if (input.guaType === '替卦') {
    return { guaType: '替卦', replacementApplied: true, replacementReason: '输入明确指定替卦' };
  }
  if (input.guaType === '下卦') {
    return { guaType: '下卦', replacementApplied: false, replacementReason: '输入明确指定下卦' };
  }
  if (measurement?.sitDegree !== undefined) {
    const rem = (((measurement.sitDegree + 7.5) % 15) + 15) % 15;
    const distanceToEdge = Math.min(rem, 15 - rem);
    if (distanceToEdge <= 3 + Number.EPSILON * 32) {
      return {
        guaType: '替卦',
        replacementApplied: true,
        replacementReason: `坐山度数距二十四山边界 ${distanceToEdge.toFixed(2)}°，超出每山中央 9° 的下卦范围，自动采用兼向替卦`,
      };
    }
  }
  return {
    guaType: '下卦',
    replacementApplied: false,
    replacementReason: '未命中兼向过界条件，按一下卦处理',
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
  const referenceMeta = MOUNTAIN_YUAN_AND_DIRECTION[referenceMountain];
  const replacementStar = REPLACEMENT_STAR_BY_MOUNTAIN[referenceMountain];
  if (!referenceMeta || !replacementStar) {
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

function buildPrompt(
  result: Omit<XuanKongResult, 'evidenceAnalysis' | 'prompt'>,
  evidenceText: string,
) {
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
    `卦型：${result.guaType}；${result.replacementReason}`,
    `局型：${result.formation}`,
    result.combinations.length
      ? `组合：${result.combinations.map((item) => item.name).join('、')}`
      : '组合：未检出已实现的特殊组合',
    `到山到向：${result.daoShanXiang.summary}`,
    '三盘九宫：',
    palaceLines,
    result.measurement
      ? `测量：稳定性${result.measurement.stability}${
          result.measurement.nearestBoundaryDistanceDegrees !== undefined
            ? `，距边界 ${result.measurement.nearestBoundaryDistanceDegrees}°`
            : ''
        }${
          result.measurement.candidateMountains?.length
            ? `；候选 ${result.measurement.candidateMountains.map((item) => item.label).join('、')}`
            : ''
        }`
      : '',
    '【结构化证据】',
    evidenceText,
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
  const shanPlate = Array.from({ length: 9 }, () => 0);
  const xiangPlate = Array.from({ length: 9 }, () => 0);
  for (const palace of chart.palaces) {
    const index = palace.earth - 1;
    if (index < 0 || index > 8) throw new Error(`玄空引擎返回无效洛书宫位：${palace.earth}。`);
    yunPlate[index] = palace.period;
    shanPlate[index] = palace.mountain;
    xiangPlate[index] = palace.water;
  }
  let replacement: XuanKongResult['replacement'];
  if (gua.guaType === '替卦') {
    const sitGong = MOUNTAIN_TO_GONG[sitMountain];
    const facingGong = MOUNTAIN_TO_GONG[facingMountain];
    if (!sitGong || !facingGong) throw new Error('替卦无法识别山向对应宫位。');
    const mountain = resolveReplacementLeg(sitMountain, yunPlate[sitGong - 1]);
    const facing = resolveReplacementLeg(facingMountain, yunPlate[facingGong - 1]);
    shanPlate.splice(
      0,
      shanPlate.length,
      ...flyStars(mountain.replacementStar, mountain.direction),
    );
    xiangPlate.splice(0, xiangPlate.length, ...flyStars(facing.replacementStar, facing.direction));
    replacement = {
      mountain,
      facing,
      rule: '运盘山向宫星入中，按其本宫同元龙山取替星；五黄无本宫时借实际山向；顺逆仍依所取山阴阳',
      sourceUrl: REPLACEMENT_SOURCE_URL,
    };
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
  const formation = classifyPlates(period.yun, sitGong, facingGong, shanPlate, xiangPlate);
  const combinationSource =
    gua.guaType === '下卦'
      ? chart.combinations
      : formation === '替卦未成四正局'
        ? []
        : detectCombinations(
            period.yun,
            formation,
            chart.facing.palace,
            chart.palaces.map((palace) => ({
              ...palace,
              mountain: shanPlate[palace.earth - 1],
              water: xiangPlate[palace.earth - 1],
            })),
          );
  const combinations = combinationSource.map(mapCombination);
  const partial = {
    period,
    sitMountain,
    facingMountain,
    guaType: gua.guaType,
    replacementApplied: gua.replacementApplied,
    replacementReason: gua.replacementReason,
    plates: { yun: yunPlate, shan: shanPlate, xiang: xiangPlate },
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
    ...(measurement ? { measurement } : {}),
  };

  const evidenceAnalysis = analyzeXuanKongEvidence(partial);
  const prompt = buildPrompt(partial, evidenceAnalysis.promptText);
  return {
    ...partial,
    evidenceAnalysis,
    prompt,
  };
}

export type { XuanKongEvidenceAnalysis };
