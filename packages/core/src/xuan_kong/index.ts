/**
 * @file 玄空飞星 v1
 * @description 三元九运、山向飞星、运盘/山盘/向盘与到山到向结构化证据。
 * 不做形峦、玄空大卦、全流派替卦口诀或吉凶总分。
 */

import {
  getMountainFromDegree,
  TWENTY_FOUR_MOUNTAINS,
  type CompassMountainPosition,
} from '../direction';
import { analyzeXuanKongEvidence, type XuanKongEvidenceAnalysis } from './evidence';

export type XuanKongGuaType = '下卦' | '替卦';

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
  year?: number;
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

function assertMountain(value: string, label: string) {
  if (!TWENTY_FOUR_MOUNTAINS.includes(value)) {
    throw new Error(`${label}必须是有效二十四山，当前为 ${value}。`);
  }
}

function normalizeYear(year?: number): number {
  const value = year ?? new Date().getFullYear();
  if (!Number.isSafeInteger(value) || value < 1 || value > 9999) {
    throw new Error('year 必须是 1-9999 的整数年份。');
  }
  return value;
}

export function resolveXuanKongPeriod(year?: number): XuanKongPeriod {
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
 * 九星入中后顺逆飞布。
 * 阳星（1/3/5/7/9）顺飞，阴星（2/4/6/8）逆飞。
 * 返回长度 9 的数组，下标 0..8 对应宫 1..9。
 */
export function flyStars(centerStar: number): number[] {
  if (!Number.isInteger(centerStar) || centerStar < 1 || centerStar > 9) {
    throw new Error(`飞星入中值必须是 1-9，当前为 ${centerStar}。`);
  }
  const yang = centerStar % 2 === 1;
  const order = yang ? [5, 6, 7, 8, 9, 1, 2, 3, 4] : [5, 4, 3, 2, 1, 9, 8, 7, 6];
  const stars = Array.from({ length: 9 }, () => 0);
  for (let i = 0; i < 9; i += 1) {
    const gong = order[i];
    stars[gong - 1] = ((centerStar - 1 + i) % 9) + 1;
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
  if (uncertainty < 0 || uncertainty > 45) {
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
      warnings.push('测量误差可能跨越二十四山边界，应保留相邻山向候选');
      const offsets = [-1.0, 0, 1.0];
      const seen = new Set<string>();
      for (const offset of offsets) {
        const sitCandidate = getMountainFromDegree((((sitPos.degree + offset) % 360) + 360) % 360);
        const facingCandidate = getMountainFromDegree(
          (((facingPos.degree + offset) % 360) + 360) % 360,
        );
        const key = `${sitCandidate.mountain}-${facingCandidate.mountain}`;
        if (seen.has(key)) continue;
        seen.add(key);
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
  if (input.guaType === '替卦') {
    return { guaType: '替卦', replacementApplied: true, replacementReason: '输入明确指定替卦' };
  }
  if (input.guaType === '下卦') {
    return { guaType: '下卦', replacementApplied: false, replacementReason: '输入明确指定下卦' };
  }
  if (measurement?.sitDegree !== undefined) {
    const rem = (((measurement.sitDegree + 7.5) % 15) + 15) % 15;
    const distanceToEdge = Math.min(rem, 15 - rem);
    if (distanceToEdge < 1.5) {
      return {
        guaType: '替卦',
        replacementApplied: true,
        replacementReason: `坐山度数距二十四山边界仅 ${distanceToEdge.toFixed(2)}°，按可核验兼向规则启用替卦`,
      };
    }
  }
  return {
    guaType: '下卦',
    replacementApplied: false,
    replacementReason: '未命中兼向过界条件，按一下卦处理',
  };
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

export function generateXuanKong(input: XuanKongInput = {}): XuanKongResult {
  const period = resolveXuanKongPeriod(input.year);
  const { sitMountain, facingMountain, measurement } = resolveMountains(input);
  const gua = resolveGuaType(input, measurement);

  const yunPlate = flyStars(period.yunStar);
  const sitGong = MOUNTAIN_TO_GONG[sitMountain];
  const facingGong = MOUNTAIN_TO_GONG[facingMountain];
  if (!sitGong || !facingGong) {
    throw new Error('无法识别山向对应宫位。');
  }
  const shanCenter = yunPlate[sitGong - 1];
  const xiangCenter = yunPlate[facingGong - 1];
  if (!shanCenter || !xiangCenter) {
    throw new Error('无法从运盘读取山向宫入中星。');
  }
  const shanPlate = flyStars(shanCenter);
  const xiangPlate = flyStars(xiangCenter);

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
  const partial = {
    period,
    sitMountain,
    facingMountain,
    guaType: gua.guaType,
    replacementApplied: gua.replacementApplied,
    replacementReason: gua.replacementReason,
    plates: { yun: yunPlate, shan: shanPlate, xiang: xiangPlate },
    palaces,
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
