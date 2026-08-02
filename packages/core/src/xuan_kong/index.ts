/**
 * @file 玄空飞星
 * @description 三元九运、下卦与兼向替卦山向飞星、位置结构与结构化证据。
 * 不做形峦、玄空大卦或吉凶总分。
 */

import {
  getMountainFromDegree,
  TWENTY_FOUR_MOUNTAINS,
  type CompassMountainPosition,
} from '../direction';
import {
  analyzeXuanKongEvidence as analyzeRebuiltXuanKongEvidence,
  type XuanKongEvidenceAnalysis,
} from './evidence';

export type XuanKongGuaType = '下卦' | '替卦';
export type XuanKongFormation =
  '旺山旺向' | '上山下水' | '双星到向' | '双星到坐' | '替卦未成四正局';

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
  centerOffsetDegrees?: number;
  possibleCenterOffsetRangeDegrees?: { minimum: number; maximum: number };
  guaTypeStability?: '可自动判下卦' | '可自动判替卦' | '异说区间';
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

export type XuanKongOrientationGenerationSource =
  | {
      source: 'mountain';
      sitMountain: string | null;
      facingMountain: string | null;
    }
  | {
      source: 'degree';
      sitDegree: number | null;
      facingDegree: number | null;
      measurementUncertaintyDegrees: number;
    };

/** 玄空审核重建的唯一可信来源；山名与度数测量不可混用。 */
export interface XuanKongGenerationSource {
  year: number;
  orientation: XuanKongOrientationGenerationSource;
  guaType: XuanKongGuaType | null;
}

export interface XuanKongPalace {
  gong: number;
  name: string;
  direction: string;
  yunStar: number;
  shanStar: number;
  xiangStar: number;
}

export interface XuanKongReplacementLeg {
  originalCenterStar: number;
  referenceMountain: string;
  replacementStar: number;
  direction: FlyDirection;
}

export interface XuanKongResult {
  /** 审核重建所需的唯一可信来源；其余字段均为派生结果。 */
  generation: XuanKongGenerationSource;
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
  replacement?: {
    mountain: XuanKongReplacementLeg;
    facing: XuanKongReplacementLeg;
    rule: string;
    sourceUrl: string;
    verificationSourceUrl: string;
  };
  engine: {
    name: 'mingyu-core';
    version: '玄空三盘规则-v2';
    mode: XuanKongGuaType;
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
const DOWN_GUA_MAX_CENTER_OFFSET = 3;
const REPLACEMENT_MIN_CENTER_OFFSET = 4.5;

export type FlyDirection = '顺飞' | '逆飞';

const REPLACEMENT_SOURCE_URL =
  'https://github.com/funfwo/Fengshui/blob/bd7d85ea1af4be41cacab6e35a5e07023e469be9/paipan.py';
const REPLACEMENT_TABLE_VERIFICATION_URL =
  'https://github.com/weig19364/xuankongfeixing/blob/324623c5460b035d537a8ff2da6b6567f9b85e9e/index.html';

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

function assertMountain(value: string, label: string) {
  if (!TWENTY_FOUR_MOUNTAINS.includes(value)) {
    throw new Error(`${label}必须是有效二十四山，当前为 ${value}。`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new Error(`${label}包含不受支持的字段：${unexpected.join('、')}`);
  }
}

function normalizeCompassInputDegree(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 360) {
    throw new Error(`${label} 必须是 0-360 之间的有限数字。`);
  }
  return value === 360 ? 0 : value;
}

function assertOppositeDegrees(sitDegree: number, facingDegree: number): void {
  const expectedFacing = (sitDegree + 180) % 360;
  const difference = Math.abs(expectedFacing - facingDegree);
  const circularDifference = Math.min(difference, 360 - difference);
  if (circularDifference > Number.EPSILON * 360 * 32) {
    throw new Error(
      `坐向度数必须严格相差 180°；当前坐山 ${sitDegree}° 应朝向 ${expectedFacing}°，不能朝向 ${facingDegree}°。`,
    );
  }
}

function normalizeGuaType(value: unknown): XuanKongGuaType | null {
  if (value === null) return null;
  if (value !== '下卦' && value !== '替卦') {
    throw new Error(`guaType 必须是下卦、替卦或 null，当前为 ${String(value)}。`);
  }
  return value;
}

function normalizeXuanKongGenerationSource(input: unknown): XuanKongGenerationSource {
  if (!isRecord(input)) throw new Error('玄空可信来源必须是对象。');
  assertExactKeys(input, ['year', 'orientation', 'guaType'], '玄空可信来源');
  if (!Object.prototype.hasOwnProperty.call(input, 'year')) {
    throw new Error('玄空可信来源缺少 year。');
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'orientation')) {
    throw new Error('玄空可信来源缺少 orientation。');
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'guaType')) {
    throw new Error('玄空可信来源缺少 guaType。');
  }

  const year = normalizeYear(input.year as number);
  const guaType = normalizeGuaType(input.guaType);
  if (!isRecord(input.orientation)) throw new Error('玄空可信山向来源必须是对象。');
  const orientation = input.orientation;
  if (orientation.source === 'mountain') {
    assertExactKeys(orientation, ['source', 'sitMountain', 'facingMountain'], '玄空山名来源');
    if (!Object.prototype.hasOwnProperty.call(orientation, 'sitMountain')) {
      throw new Error('玄空山名来源缺少 sitMountain。');
    }
    if (!Object.prototype.hasOwnProperty.call(orientation, 'facingMountain')) {
      throw new Error('玄空山名来源缺少 facingMountain。');
    }
    const sitMountain = orientation.sitMountain;
    const facingMountain = orientation.facingMountain;
    if (sitMountain !== null && typeof sitMountain !== 'string') {
      throw new Error('sitMountain 必须是二十四山字符串或 null。');
    }
    if (facingMountain !== null && typeof facingMountain !== 'string') {
      throw new Error('facingMountain 必须是二十四山字符串或 null。');
    }
    if (sitMountain === null && facingMountain === null) {
      throw new Error('玄空山名来源至少需要 sitMountain 或 facingMountain。');
    }
    if (sitMountain !== null) assertMountain(sitMountain, 'sitMountain');
    if (facingMountain !== null) assertMountain(facingMountain, 'facingMountain');
    if (
      sitMountain !== null &&
      facingMountain !== null &&
      oppositeMountain(sitMountain) !== facingMountain
    ) {
      throw new Error(
        `坐向必须严格相对；当前坐${sitMountain}应向${oppositeMountain(sitMountain)}，不能向${facingMountain}。`,
      );
    }
    return {
      year,
      orientation: { source: 'mountain', sitMountain, facingMountain },
      guaType,
    };
  }

  if (orientation.source === 'degree') {
    assertExactKeys(
      orientation,
      ['source', 'sitDegree', 'facingDegree', 'measurementUncertaintyDegrees'],
      '玄空度数来源',
    );
    for (const key of ['sitDegree', 'facingDegree', 'measurementUncertaintyDegrees'] as const) {
      if (!Object.prototype.hasOwnProperty.call(orientation, key)) {
        throw new Error(`玄空度数来源缺少 ${key}。`);
      }
    }
    const sitDegree =
      orientation.sitDegree === null
        ? null
        : normalizeCompassInputDegree(orientation.sitDegree, 'sitDegree');
    const facingDegree =
      orientation.facingDegree === null
        ? null
        : normalizeCompassInputDegree(orientation.facingDegree, 'facingDegree');
    if (sitDegree === null && facingDegree === null) {
      throw new Error('玄空度数来源至少需要 sitDegree 或 facingDegree。');
    }
    const uncertainty = orientation.measurementUncertaintyDegrees;
    if (typeof uncertainty !== 'number' || !Number.isFinite(uncertainty)) {
      throw new Error('measurementUncertaintyDegrees 必须是 0-45 之间的有限数字。');
    }
    if (uncertainty < 0 || uncertainty > 45) {
      throw new Error('measurementUncertaintyDegrees 必须在 0-45 之间。');
    }
    if (sitDegree !== null && facingDegree !== null) {
      assertOppositeDegrees(sitDegree, facingDegree);
    }
    return {
      year,
      orientation: {
        source: 'degree',
        sitDegree,
        facingDegree,
        measurementUncertaintyDegrees: uncertainty,
      },
      guaType,
    };
  }

  throw new Error(
    `玄空山向来源 source 必须是 mountain 或 degree，当前为 ${String(orientation.source)}。`,
  );
}

function normalizeXuanKongInput(input: unknown): XuanKongGenerationSource {
  if (!isRecord(input)) throw new Error('玄空飞星参数必须是对象。');
  const allowedKeys = [
    'year',
    'sitMountain',
    'facingMountain',
    'facingDegree',
    'sitDegree',
    'measurementUncertaintyDegrees',
    'guaType',
  ] as const;
  assertExactKeys(input, allowedKeys, '玄空飞星参数');
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] === null) {
      throw new Error(`玄空飞星参数 ${key} 不接受显式 null。`);
    }
  }

  const hasMountain = input.sitMountain !== undefined || input.facingMountain !== undefined;
  const hasDegree = input.sitDegree !== undefined || input.facingDegree !== undefined;
  if (hasMountain && hasDegree) {
    throw new Error('玄空山名与度数测量属于两种可信来源，不能混用。');
  }
  if (!hasMountain && !hasDegree) {
    throw new Error('需提供 sitMountain/facingMountain，或 sitDegree/facingDegree。');
  }
  if (!hasDegree && input.measurementUncertaintyDegrees !== undefined) {
    throw new Error('measurementUncertaintyDegrees 只能与度数测量来源一起提供。');
  }
  const normalized = normalizeXuanKongGenerationSource({
    year: input.year,
    orientation: hasDegree
      ? {
          source: 'degree',
          sitDegree: input.sitDegree ?? null,
          facingDegree: input.facingDegree ?? null,
          measurementUncertaintyDegrees: input.measurementUncertaintyDegrees ?? 0,
        }
      : {
          source: 'mountain',
          sitMountain: input.sitMountain ?? null,
          facingMountain: input.facingMountain ?? null,
        },
    guaType: input.guaType ?? null,
  });
  if (hasDegree && input.measurementUncertaintyDegrees === undefined) {
    throw new Error(
      '度数测量来源必须明确提供 measurementUncertaintyDegrees；只有确认无误差时才可填写 0。',
    );
  }
  return normalized;
}

function generationSourceToInput(generation: XuanKongGenerationSource): XuanKongInput {
  const orientation = generation.orientation;
  return {
    year: generation.year,
    ...(orientation.source === 'mountain'
      ? {
          ...(orientation.sitMountain !== null ? { sitMountain: orientation.sitMountain } : {}),
          ...(orientation.facingMountain !== null
            ? { facingMountain: orientation.facingMountain }
            : {}),
        }
      : {
          ...(orientation.sitDegree !== null ? { sitDegree: orientation.sitDegree } : {}),
          ...(orientation.facingDegree !== null ? { facingDegree: orientation.facingDegree } : {}),
          measurementUncertaintyDegrees: orientation.measurementUncertaintyDegrees,
        }),
    ...(generation.guaType !== null ? { guaType: generation.guaType } : {}),
  };
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
    const centerDifference = Math.abs(sitPos.degree - sitPos.centerDegree);
    const centerOffset = Math.min(centerDifference, 360 - centerDifference);
    const minimumCenterOffset = Math.max(0, centerOffset - uncertainty);
    const maximumCenterOffset = Math.min(7.5, centerOffset + uncertainty);
    const guaTypeStability: NonNullable<XuanKongMeasurement['guaTypeStability']> =
      maximumCenterOffset <= DOWN_GUA_MAX_CENTER_OFFSET + Number.EPSILON * 32
        ? '可自动判下卦'
        : minimumCenterOffset >= REPLACEMENT_MIN_CENTER_OFFSET - Number.EPSILON * 32
          ? '可自动判替卦'
          : '异说区间';
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
    if (guaTypeStability === '异说区间') {
      warnings.push('坐山读数或测量误差范围涉及偏离山中心 3° 至 4.5° 的异说区间');
    }
    return {
      sitMountain: sitPos.mountain,
      facingMountain: facingPos.mountain,
      measurement: {
        facingDegree: facingPos.degree,
        sitDegree: sitPos.degree,
        stability,
        nearestBoundaryDistanceDegrees: Number(boundaryDistance.toFixed(2)),
        centerOffsetDegrees: Number(centerOffset.toFixed(2)),
        possibleCenterOffsetRangeDegrees: {
          minimum: Number(minimumCenterOffset.toFixed(2)),
          maximum: Number(maximumCenterOffset.toFixed(2)),
        },
        guaTypeStability,
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
  if (measurement?.sitDegree === undefined) {
    return {
      guaType: '下卦',
      replacementApplied: false,
      replacementReason: '仅提供正向山名，按该山中心口径采用下卦',
    };
  }
  if (measurement.guaTypeStability === '可自动判下卦') {
    const range = measurement.possibleCenterOffsetRangeDegrees;
    return {
      guaType: '下卦',
      replacementApplied: false,
      replacementReason: `坐山读数及测量误差范围偏离山中心最多 ${range?.maximum.toFixed(2)}°，两份固定公开实现均可判为下卦`,
    };
  }
  if (measurement.guaTypeStability === '可自动判替卦') {
    const range = measurement.possibleCenterOffsetRangeDegrees;
    return {
      guaType: '替卦',
      replacementApplied: true,
      replacementReason: `坐山读数及测量误差范围偏离山中心至少 ${range?.minimum.toFixed(2)}°，两份固定公开实现均可判为替卦`,
    };
  }
  const range = measurement.possibleCenterOffsetRangeDegrees;
  throw new Error(
    `坐山读数或测量误差范围偏离山中心 ${range?.minimum.toFixed(2)}°-${range?.maximum.toFixed(2)}°，涉及 3° 至 4.5° 的下卦、替卦异说区间；请依据采用的流派明确提供 guaType。`,
  );
}

function resolveReferenceMountain(sourceMountain: string, centerStar: number): string {
  const sourceMeta = MOUNTAIN_YUAN_AND_DIRECTION[sourceMountain];
  if (!sourceMeta) throw new Error(`缺少${sourceMountain}山元龙资料。`);
  const referenceMountain =
    centerStar === 5 ? sourceMountain : STAR_HOME_MOUNTAINS[centerStar]?.[sourceMeta.yuan];
  if (!referenceMountain) {
    throw new Error(`无法按${centerStar}星与${sourceMountain}山同元龙取本宫山。`);
  }
  return referenceMountain;
}

function resolveFlyingDirection(sourceMountain: string, centerStar: number): FlyDirection {
  const referenceMountain = resolveReferenceMountain(sourceMountain, centerStar);
  const referenceMeta = MOUNTAIN_YUAN_AND_DIRECTION[referenceMountain];
  if (!referenceMeta) throw new Error(`缺少${referenceMountain}山阴阳资料。`);
  return referenceMeta.direction;
}

function resolveReplacementLeg(
  sourceMountain: string,
  originalCenterStar: number,
): XuanKongReplacementLeg {
  const referenceMountain = resolveReferenceMountain(sourceMountain, originalCenterStar);
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
    `当运星位置结构：${result.formation}（仅表示山向宫的星位比较，不直接代表现实吉凶）`,
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
        }${
          result.measurement.warnings.length
            ? `；提示 ${result.measurement.warnings.join('；')}`
            : ''
        }`
      : '',
    '【结构化证据】',
    evidenceText,
  ]
    .filter(Boolean)
    .join('\n');
}

function generateXuanKongFromGeneration(generation: XuanKongGenerationSource): XuanKongResult {
  const input = generationSourceToInput(generation);
  const period = resolveXuanKongPeriod(input.year);
  const { sitMountain, facingMountain, measurement } = resolveMountains(input);
  const gua = resolveGuaType(input, measurement);
  const sitGong = MOUNTAIN_TO_GONG[sitMountain];
  const facingGong = MOUNTAIN_TO_GONG[facingMountain];
  if (!sitGong || !facingGong) throw new Error('无法识别山向对应宫位。');

  const yunPlate = flyStars(period.yun, '顺飞');
  const mountainCenterStar = yunPlate[sitGong - 1];
  const facingCenterStar = yunPlate[facingGong - 1];
  const shanPlate =
    gua.guaType === '下卦'
      ? flyStars(mountainCenterStar, resolveFlyingDirection(sitMountain, mountainCenterStar))
      : Array.from({ length: 9 }, () => 0);
  const xiangPlate =
    gua.guaType === '下卦'
      ? flyStars(facingCenterStar, resolveFlyingDirection(facingMountain, facingCenterStar))
      : Array.from({ length: 9 }, () => 0);
  let replacement: XuanKongResult['replacement'];
  if (gua.guaType === '替卦') {
    const mountain = resolveReplacementLeg(sitMountain, mountainCenterStar);
    const facing = resolveReplacementLeg(facingMountain, facingCenterStar);
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

  const palaces = buildPalaces(yunPlate, shanPlate, xiangPlate);
  const formation = classifyPlates(period.yun, sitGong, facingGong, shanPlate, xiangPlate);
  const partial = {
    generation,
    period,
    sitMountain,
    facingMountain,
    guaType: gua.guaType,
    replacementApplied: gua.replacementApplied,
    replacementReason: gua.replacementReason,
    plates: { yun: yunPlate, shan: shanPlate, xiang: xiangPlate },
    palaces,
    formation,
    ...(replacement ? { replacement } : {}),
    engine: {
      name: 'mingyu-core' as const,
      version: '玄空三盘规则-v2' as const,
      mode: gua.guaType,
    },
    daoShanXiang,
    ...(measurement ? { measurement } : {}),
  };

  const evidenceAnalysis = analyzeRebuiltXuanKongEvidence(partial);
  const prompt = buildPrompt(partial, evidenceAnalysis.promptText);
  return {
    ...partial,
    evidenceAnalysis,
    prompt,
  };
}

export function generateXuanKong(input: XuanKongInput): XuanKongResult {
  return generateXuanKongFromGeneration(normalizeXuanKongInput(input));
}

/** 只凭建造/起运年、山向来源与显式卦型口径重建完整玄空结果。 */
export function rebuildAuditedXuanKongData(
  input: Pick<XuanKongResult, 'generation'>,
): XuanKongResult {
  if (!isRecord(input)) throw new Error('玄空审核重建必须提供结果对象。');
  if (!Object.prototype.hasOwnProperty.call(input, 'generation')) {
    throw new Error('玄空旧结果缺少可信原始输入，无法审核重建。');
  }
  return generateXuanKongFromGeneration(normalizeXuanKongGenerationSource(input.generation));
}

/** 先从可信来源审核重建完整盘面，再返回结构化证据。 */
export function analyzeXuanKongEvidence(
  input: Pick<XuanKongResult, 'generation'>,
): XuanKongEvidenceAnalysis {
  return rebuildAuditedXuanKongData(input).evidenceAnalysis;
}

export type { XuanKongEvidenceAnalysis };
