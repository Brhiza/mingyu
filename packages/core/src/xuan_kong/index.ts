/**
 * @file 玄空飞星
 * @description 三元九运、下卦山向飞星、流年流月紫白叠宫、局型组合与结构化证据。
 * @传统依据 玄空飞星通行的三元九运、运盘顺飞、元龙阴阳定山向盘顺逆与下卦口径；流年流月取三元紫白入中后顺飞。
 * 不做形峦、玄空大卦或吉凶总分。
 */

import { buildChart, type Combination, type Formation } from '@soul-atelier/xuankong';

import {
  getMountainFromDegree,
  TWENTY_FOUR_MOUNTAINS,
  type CompassMountainPosition,
} from '../direction';
import { analyzeXuanKongEvidence, type XuanKongEvidenceAnalysis } from './evidence';
import { evaluateCastleGate, type CastleGateEvaluation } from './castle-gate';
import {
  flyStars,
  resolveFlyingStarYunState,
  resolveShanXiangRelation,
  resolveMonthFlyingStar,
  resolveXuanKongFlowStars,
  resolveYearFlyingStar,
  type FlyingStarYunState,
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
  castleGate?: CastleGateEvaluation;
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

function buildPrompt(result: Omit<XuanKongResult, 'evidenceAnalysis' | 'prompt'>) {
  const palaceLines = result.palaces
    .map((item) => {
      const combos = result.combinations
        .filter((combo) => combo.palaces?.includes(item.gong))
        .map((combo) => combo.name);
      const yearText = item.yearStar !== undefined ? ` 年${item.yearStar}` : '';
      const monthText = item.monthStar !== undefined ? ` 月${item.monthStar}` : '';
      return `${item.name}（${item.direction}）：运${item.yunStar} 山${item.shanStar} 向${item.xiangStar}${yearText}${monthText}，山向${item.shanXiangRelation}，运星${item.yunStarState}${combos.length ? `，组合${combos.join('、')}` : ''}`;
    })
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
    result.castleGate?.summary ?? '',
    (() => {
      const wuHuang = result.palaces?.find((p) => p.xiangStar === 5 || p.shanStar === 5);
      return wuHuang
        ? `气场避煞：五黄大煞见于${wuHuang.name}（${wuHuang.direction}），该方位动静宜慎、以静安为吉`
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
  const formation = chart.formation;
  const combinations = chart.combinations.map(mapCombination);
  const castleGate = evaluateCastleGate({
    yun: period.yun,
    facingMountain,
    yunPlate,
  });
  const partial = {
    period,
    sitMountain,
    facingMountain,
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
    engine: {
      name: '@soul-atelier/xuankong' as const,
      version: '0.2.1' as const,
      mode: '下卦' as const,
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
