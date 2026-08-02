/**
 * @file 八宅风水（BaZhai）
 * @description 计算命卦、宅卦、东四西四分组与八宅大游年八宫传统标签。
 * 复用 bazi.calculateMingGua 与 direction 模块，返回结构化结果与提示词。
 * @古籍依据 《八宅明镜》《阳宅十书》
 */
import { calculateMingGua } from '../bazi/mingGua';
import { daysInGregorianMonth } from '../calendar/date-validation';
import { getGanZhiFromDate } from '../ganzhi';
import {
  BAGUA,
  TWENTY_FOUR_MOUNTAINS,
  getHouseTrigram,
  getEightMansion,
  getEastWestGroup,
  getBaZhaiPalace,
  getSitFacingFromFacingDegree,
  type BaZhaiPalace,
  type SitFacingPosition,
} from '../direction';
import { buildBaZhaiEvidence } from './evidence';

export type {
  BaZhaiCalculationFact,
  BaZhaiCalculationStep,
  BaZhaiCounterEvidenceFact,
  BaZhaiCounterSummaryFact,
  BaZhaiDirectionComparison,
  BaZhaiDirectionFact,
  BaZhaiEvidenceAnalysis,
  BaZhaiLimitationFact,
  BaZhaiMeasurementCandidateFact,
  BaZhaiMeasurementFact,
} from './evidence';

export interface BaZhaiInput {
  /** 出生公历年份（用于推命卦；已按立春换年处理） */
  birthYear?: number;
  /** 出生公历月日，用于准确处理立春换年。 */
  birthMonth?: number;
  birthDay?: number;
  /** 性别 */
  gender?: 'male' | 'female';
  /** 也可直接给定命卦（坎坤震巽乾兑艮离） */
  mingGua?: string;
  /** 坐山（二十四山，如「子」），用于推宅卦 */
  sitMountain?: string;
}

export type BaZhaiGroupRelation = '同组' | '异组' | '未比较';

export type BaZhaiPersonGenerationSource =
  | {
      source: 'birth';
      birthYear: number;
      birthMonth?: number;
      birthDay?: number;
      gender: 'male' | 'female';
    }
  | {
      source: 'ming-gua';
      mingGua: string;
    };

/** 八宅审核重建所需的唯一可信来源；固定坐山与门向测量不可混用。 */
export type BaZhaiGenerationSource =
  | {
      method: 'fixed-sit-mountain';
      person: BaZhaiPersonGenerationSource;
      sitMountain?: string;
    }
  | {
      method: 'door-measurement';
      person: BaZhaiPersonGenerationSource;
      doorToInteriorDegree: number;
      northReference: 'unspecified' | 'magnetic' | 'true';
      magneticDeclinationDegrees: number | null;
      measurementUncertaintyDegrees: number;
    }
  | {
      method: 'true-north-degree';
      person: BaZhaiPersonGenerationSource;
      sitDegree: number | null;
      facingDegree: number | null;
      measurementUncertaintyDegrees: number;
    };

export interface BaZhaiResult {
  /** 审核重建所需的唯一可信来源；其余字段均为派生结果。 */
  generation: BaZhaiGenerationSource;
  calculationInput: {
    mingGuaSource: '出生年与性别计算' | '直接给定';
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    gender?: 'male' | 'female';
    directMingGua?: string;
    sitMountain?: string;
  };
  mingGua: string;
  effectiveBirthYear: number | null;
  birthYearBoundaryNote: string;
  mingGroup: '东四命' | '西四命';
  houseGua: string | null;
  houseGroup: '东四命' | '西四命' | null;
  /** 命卦大游年盘 */
  mingPalace: BaZhaiPalace[];
  /** 宅卦大游年盘（若有坐山） */
  housePalace: BaZhaiPalace[] | null;
  /** 只比较东四/西四分组是否相同，不推导住宅效果。 */
  groupRelation: BaZhaiGroupRelation;
  evidenceAnalysis: import('./evidence').BaZhaiEvidenceAnalysis;
  prompt: string;
}

/** 从大门处面向屋内测量的八宅便捷入参。 */
export interface BaZhaiDoorDegreeInput extends Omit<BaZhaiInput, 'sitMountain'> {
  /** 站在大门处面向屋内时的指南针读数，正北为 0°，顺时针增加。 */
  doorToInteriorDegree: number;
  /** 读数采用的北向基准；未声明时只按原始罗盘读数计算并提示核验。 */
  northReference?: 'unspecified' | 'magnetic' | 'true';
  /** 当读数基于磁北时使用，东偏为正、西偏为负。 */
  magneticDeclinationDegrees?: number;
  /** 测量可能误差，单位为度；用于判断是否跨越二十四山边界。 */
  measurementUncertaintyDegrees?: number;
}

/** 已换算为真北口径的坐山或朝向度数；与入户门向测量来源分开保存。 */
export interface BaZhaiTrueNorthDegreeInput extends Omit<BaZhaiInput, 'sitMountain'> {
  sitDegree?: number;
  facingDegree?: number;
  measurementUncertaintyDegrees?: number;
}

/** 不依赖居住人资料的门向测量输入，供组合入口复用同一磁北校正规则。 */
export type BaZhaiDoorMeasurementInput = Pick<
  BaZhaiDoorDegreeInput,
  | 'doorToInteriorDegree'
  | 'northReference'
  | 'magneticDeclinationDegrees'
  | 'measurementUncertaintyDegrees'
>;

export type BaZhaiMeasurementStability = '稳定' | '山向边界敏感' | '宅卦不稳定';

export interface BaZhaiDirectionCandidate {
  sitMountain: string;
  facingMountain: string;
  label: string;
  houseGua: string;
  houseGroup: '东四命' | '西四命';
  groupRelation: Exclude<BaZhaiGroupRelation, '未比较'>;
  housePalace: BaZhaiPalace[];
}

/** 入户测量读数换算成传统坐山朝向后的完整资料。 */
export interface BaZhaiDoorMeasurement {
  method: '站在大门处面向屋内测量' | '直接提供真北坐向度数';
  measuredDegree: number;
  northReference: 'unspecified' | 'magnetic' | 'true';
  magneticDeclinationDegrees: number | null;
  /** 换算至真北基准后的入户方向；未声明北向时等同原始读数。 */
  trueNorthDegree: number;
  measurementUncertaintyDegrees: number;
  nearestBoundaryDistanceDegrees: number;
  stability: BaZhaiMeasurementStability;
  candidateDirections: BaZhaiDirectionCandidate[];
  warnings: string[];
  facingDegree: number;
  facingMountain: string;
  sitDegree: number;
  sitMountain: string;
  label: string;
  promptText: string;
}

export interface BaZhaiDoorDegreeResult extends BaZhaiResult {
  directionMeasurement: BaZhaiDoorMeasurement;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function normalizePersonInput(input: Record<string, unknown>): BaZhaiPersonGenerationSource {
  const hasMingGua = input.mingGua !== undefined;
  const hasBirthData =
    input.birthYear !== undefined ||
    input.birthMonth !== undefined ||
    input.birthDay !== undefined ||
    input.gender !== undefined;
  if (hasMingGua && hasBirthData) {
    throw new Error('八宅出生资料与直接命卦只能选择一种来源。');
  }
  if (hasMingGua) {
    if (typeof input.mingGua !== 'string') {
      throw new Error('直接命卦必须是原始字符串。');
    }
    if (!BAGUA.includes(input.mingGua)) {
      throw new Error(`命卦无效：${input.mingGua}`);
    }
    return { source: 'ming-gua', mingGua: input.mingGua };
  }
  if (input.birthYear === undefined || input.gender === undefined) {
    throw new Error('需提供 birthYear+gender 或直接给定 mingGua。');
  }
  if (input.gender !== 'male' && input.gender !== 'female') {
    throw new Error('性别只能是 male 或 female。');
  }
  const birthInput: BaZhaiInput = {
    birthYear: input.birthYear as number,
    ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth as number } : {}),
    ...(input.birthDay !== undefined ? { birthDay: input.birthDay as number } : {}),
    gender: input.gender,
  };
  // 在来源进入结果前完成年份、日期以及月日成对约束验证。
  resolveEffectiveBirthYear(birthInput);
  return {
    source: 'birth',
    birthYear: birthInput.birthYear!,
    ...(birthInput.birthMonth !== undefined ? { birthMonth: birthInput.birthMonth } : {}),
    ...(birthInput.birthDay !== undefined ? { birthDay: birthInput.birthDay } : {}),
    gender: birthInput.gender!,
  };
}

function normalizePersonGenerationSource(source: unknown): BaZhaiPersonGenerationSource {
  if (!isRecord(source)) {
    throw new Error('八宅可信生成来源缺少有效的居住人原始资料。');
  }
  if (source.source === 'birth') {
    assertExactKeys(
      source,
      ['source', 'birthYear', 'birthMonth', 'birthDay', 'gender'],
      '八宅出生可信来源',
    );
    return normalizePersonInput(source);
  }
  if (source.source === 'ming-gua') {
    assertExactKeys(source, ['source', 'mingGua'], '八宅直接命卦可信来源');
    return normalizePersonInput(source);
  }
  throw new Error('八宅可信生成来源的居住人来源只能是 birth 或 ming-gua。');
}

function assertDoorDegree(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 360) {
    throw new Error('大门朝向屋内的度数必须是 0-360 之间的有限数字。');
  }
}

function normalizeCompassDegree(value: unknown, label: string): number {
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

function normalizeBaZhaiGenerationSource(source: unknown): BaZhaiGenerationSource {
  if (!isRecord(source)) {
    throw new Error('八宅审核重建必须提供可信生成来源。');
  }
  if (source.method === 'fixed-sit-mountain') {
    assertExactKeys(source, ['method', 'person', 'sitMountain'], '八宅固定坐山可信来源');
    const person = normalizePersonGenerationSource(source.person);
    if (source.sitMountain !== undefined) {
      if (typeof source.sitMountain !== 'string') {
        throw new Error('八宅可信来源的坐山必须是原始字符串。');
      }
      if (!TWENTY_FOUR_MOUNTAINS.includes(source.sitMountain)) {
        throw new Error(`坐山无效：${source.sitMountain}`);
      }
    }
    return {
      method: 'fixed-sit-mountain',
      person,
      ...(source.sitMountain !== undefined ? { sitMountain: source.sitMountain } : {}),
    };
  }
  if (source.method === 'door-measurement') {
    assertExactKeys(
      source,
      [
        'method',
        'person',
        'doorToInteriorDegree',
        'northReference',
        'magneticDeclinationDegrees',
        'measurementUncertaintyDegrees',
      ],
      '八宅门向测量可信来源',
    );
    const person = normalizePersonGenerationSource(source.person);
    assertDoorDegree(source.doorToInteriorDegree);
    if (
      source.northReference !== 'unspecified' &&
      source.northReference !== 'magnetic' &&
      source.northReference !== 'true'
    ) {
      throw new Error('northReference 只能是 unspecified、magnetic 或 true。');
    }
    if (
      typeof source.measurementUncertaintyDegrees !== 'number' ||
      !Number.isFinite(source.measurementUncertaintyDegrees) ||
      source.measurementUncertaintyDegrees < 0 ||
      source.measurementUncertaintyDegrees > 45
    ) {
      throw new Error('测量误差必须是 0-45 之间的有限数字。');
    }
    if (source.northReference === 'magnetic') {
      if (source.magneticDeclinationDegrees === null) {
        throw new Error('读数采用磁北时必须提供当地磁偏角。');
      }
      if (
        typeof source.magneticDeclinationDegrees !== 'number' ||
        !Number.isFinite(source.magneticDeclinationDegrees) ||
        source.magneticDeclinationDegrees < -30 ||
        source.magneticDeclinationDegrees > 30
      ) {
        throw new Error('磁偏角必须是 -30 至 30 之间的有限数字，东偏为正、西偏为负。');
      }
    } else if (source.magneticDeclinationDegrees !== null) {
      throw new Error('只有 northReference 为 magnetic 时才应提供磁偏角。');
    }
    return {
      method: 'door-measurement',
      person,
      doorToInteriorDegree: source.doorToInteriorDegree,
      northReference: source.northReference,
      magneticDeclinationDegrees: source.magneticDeclinationDegrees as number | null,
      measurementUncertaintyDegrees: source.measurementUncertaintyDegrees,
    };
  }
  if (source.method === 'true-north-degree') {
    assertExactKeys(
      source,
      ['method', 'person', 'sitDegree', 'facingDegree', 'measurementUncertaintyDegrees'],
      '八宅真北坐向可信来源',
    );
    const person = normalizePersonGenerationSource(source.person);
    if (!Object.prototype.hasOwnProperty.call(source, 'sitDegree')) {
      throw new Error('八宅真北坐向可信来源缺少 sitDegree。');
    }
    if (!Object.prototype.hasOwnProperty.call(source, 'facingDegree')) {
      throw new Error('八宅真北坐向可信来源缺少 facingDegree。');
    }
    const sitDegree =
      source.sitDegree === null ? null : normalizeCompassDegree(source.sitDegree, 'sitDegree');
    const facingDegree =
      source.facingDegree === null
        ? null
        : normalizeCompassDegree(source.facingDegree, 'facingDegree');
    if (sitDegree === null && facingDegree === null) {
      throw new Error('八宅真北坐向至少需要 sitDegree 或 facingDegree。');
    }
    if (sitDegree !== null && facingDegree !== null) {
      assertOppositeDegrees(sitDegree, facingDegree);
    }
    if (
      typeof source.measurementUncertaintyDegrees !== 'number' ||
      !Number.isFinite(source.measurementUncertaintyDegrees) ||
      source.measurementUncertaintyDegrees < 0 ||
      source.measurementUncertaintyDegrees > 45
    ) {
      throw new Error('测量误差必须是 0-45 之间的有限数字。');
    }
    return {
      method: 'true-north-degree',
      person,
      sitDegree,
      facingDegree,
      measurementUncertaintyDegrees: source.measurementUncertaintyDegrees,
    };
  }
  throw new Error(
    '八宅可信生成来源的 method 只能是 fixed-sit-mountain、door-measurement 或 true-north-degree。',
  );
}

function normalizeBaZhaiInput(
  input: unknown,
): Extract<BaZhaiGenerationSource, { method: 'fixed-sit-mountain' }> {
  if (!isRecord(input)) throw new Error('八宅排盘必须提供输入对象。');
  assertExactKeys(
    input,
    ['birthYear', 'birthMonth', 'birthDay', 'gender', 'mingGua', 'sitMountain'],
    '八宅排盘输入',
  );
  if (input.sitMountain !== undefined) {
    if (typeof input.sitMountain !== 'string') throw new Error('坐山必须是原始字符串。');
    if (!TWENTY_FOUR_MOUNTAINS.includes(input.sitMountain)) {
      throw new Error(`坐山无效：${input.sitMountain}`);
    }
  }
  return {
    method: 'fixed-sit-mountain',
    person: normalizePersonInput(input),
    ...(input.sitMountain !== undefined ? { sitMountain: input.sitMountain } : {}),
  };
}

function normalizeDoorInput(
  input: unknown,
): Extract<BaZhaiGenerationSource, { method: 'door-measurement' }> {
  if (!isRecord(input)) throw new Error('八宅门向排盘必须提供输入对象。');
  assertExactKeys(
    input,
    [
      'birthYear',
      'birthMonth',
      'birthDay',
      'gender',
      'mingGua',
      'doorToInteriorDegree',
      'northReference',
      'magneticDeclinationDegrees',
      'measurementUncertaintyDegrees',
    ],
    '八宅门向排盘输入',
  );
  const northReference = input.northReference === undefined ? 'unspecified' : input.northReference;
  if (input.magneticDeclinationDegrees === null) {
    throw new Error('门向排盘输入的磁偏角必须是有限数字，不能用 null 代替未填写。');
  }
  const magneticDeclinationDegrees =
    input.magneticDeclinationDegrees === undefined ? null : input.magneticDeclinationDegrees;
  if (input.measurementUncertaintyDegrees === undefined) {
    throw new Error('门向度数来源必须明确提供测量误差；只有确认无误差时才可填写 0。');
  }
  const measurementUncertaintyDegrees = input.measurementUncertaintyDegrees;
  return normalizeBaZhaiGenerationSource({
    method: 'door-measurement',
    person: normalizePersonInput(input),
    doorToInteriorDegree: input.doorToInteriorDegree,
    northReference,
    magneticDeclinationDegrees,
    measurementUncertaintyDegrees,
  }) as Extract<BaZhaiGenerationSource, { method: 'door-measurement' }>;
}

function normalizeTrueNorthDegreeInput(
  input: unknown,
): Extract<BaZhaiGenerationSource, { method: 'true-north-degree' }> {
  if (!isRecord(input)) throw new Error('八宅真北坐向排盘必须提供输入对象。');
  assertExactKeys(
    input,
    [
      'birthYear',
      'birthMonth',
      'birthDay',
      'gender',
      'mingGua',
      'sitDegree',
      'facingDegree',
      'measurementUncertaintyDegrees',
    ],
    '八宅真北坐向排盘输入',
  );
  if (input.sitDegree === null || input.facingDegree === null) {
    throw new Error('真北坐向排盘输入不能用 null 代替未填写。');
  }
  if (input.measurementUncertaintyDegrees === undefined) {
    throw new Error('真北度数来源必须明确提供测量误差；只有确认无误差时才可填写 0。');
  }
  return normalizeBaZhaiGenerationSource({
    method: 'true-north-degree',
    person: normalizePersonInput(input),
    sitDegree: input.sitDegree === undefined ? null : input.sitDegree,
    facingDegree: input.facingDegree === undefined ? null : input.facingDegree,
    measurementUncertaintyDegrees: input.measurementUncertaintyDegrees,
  }) as Extract<BaZhaiGenerationSource, { method: 'true-north-degree' }>;
}

/**
 * 将“从大门面向屋内”的指南针读数换算为八宅传统坐山朝向。
 * 例如读数 0° 表示从大门向屋内看正北，对应子山午向。
 */
export function getBaZhaiSitFacingFromDoorDegree(doorToInteriorDegree: number): SitFacingPosition {
  if (
    typeof doorToInteriorDegree !== 'number' ||
    !Number.isFinite(doorToInteriorDegree) ||
    doorToInteriorDegree < 0 ||
    doorToInteriorDegree > 360
  ) {
    throw new Error('大门朝向屋内的度数必须是 0-360 之间的有限数字。');
  }
  return getSitFacingFromFacingDegree((doorToInteriorDegree + 180) % 360);
}

function normalizeDegree(degree: number) {
  return ((degree % 360) + 360) % 360;
}

function circularDistance(a: number, b: number) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return Math.min(diff, 360 - diff);
}

function nearestMountainBoundaryDistance(degree: number) {
  let minimum = 180;
  for (let index = 0; index < 24; index += 1) {
    minimum = Math.min(minimum, circularDistance(degree, 7.5 + index * 15));
  }
  return minimum;
}

/** 只处理门向原始读数、北向基准、磁偏角与误差，不需要伪造居住人资料。 */
export function resolveBaZhaiDoorMeasurement(input: BaZhaiDoorMeasurementInput) {
  assertDoorDegree(input.doorToInteriorDegree);
  if (input.measurementUncertaintyDegrees === undefined) {
    throw new Error('门向度数来源必须明确提供测量误差；只有确认无误差时才可填写 0。');
  }
  const reference = input.northReference ?? 'unspecified';
  const declination = input.magneticDeclinationDegrees;
  const uncertainty = input.measurementUncertaintyDegrees;
  if (!['unspecified', 'magnetic', 'true'].includes(reference)) {
    throw new Error('northReference 只能是 unspecified、magnetic 或 true。');
  }
  if (!Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 45) {
    throw new Error('测量误差必须是 0-45 之间的有限数字。');
  }
  if (
    declination !== undefined &&
    (!Number.isFinite(declination) || declination < -30 || declination > 30)
  ) {
    throw new Error('磁偏角必须是 -30 至 30 之间的有限数字，东偏为正、西偏为负。');
  }
  if (reference === 'magnetic' && declination === undefined) {
    throw new Error('读数采用磁北时必须提供当地磁偏角。');
  }
  if (reference !== 'magnetic' && declination !== undefined) {
    throw new Error('只有 northReference 为 magnetic 时才应提供磁偏角。');
  }
  const trueNorthDegree = normalizeDegree(
    input.doorToInteriorDegree + (reference === 'magnetic' ? declination! : 0),
  );
  const candidateDirections: Array<
    Pick<BaZhaiDirectionCandidate, 'sitMountain' | 'facingMountain' | 'label' | 'houseGua'>
  > = [];
  for (let index = 0; index < 24; index += 1) {
    const center = index * 15;
    if (circularDistance(trueNorthDegree, center) > uncertainty + 7.5 + Number.EPSILON * 32) {
      continue;
    }
    const position = getSitFacingFromFacingDegree(normalizeDegree(center + 180));
    candidateDirections.push({
      sitMountain: position.sit.mountain,
      facingMountain: position.facing.mountain,
      label: position.label,
      houseGua: getHouseTrigram(position.sit.mountain),
    });
  }
  const houseGuas = new Set(candidateDirections.map((item) => item.houseGua));
  const stability: BaZhaiMeasurementStability =
    houseGuas.size > 1 ? '宅卦不稳定' : candidateDirections.length > 1 ? '山向边界敏感' : '稳定';
  const warnings = [
    ...(reference === 'unspecified'
      ? ['未声明读数基于磁北还是真北；若设备显示磁北，应补充当地磁偏角后复核']
      : []),
    ...(stability === '山向边界敏感'
      ? ['测量误差范围跨越二十四山边界，但候选山向仍属于同一宅卦']
      : []),
    ...(stability === '宅卦不稳定'
      ? ['测量误差范围跨越宅卦边界，不能只采用单一八宅盘，应重新测量或并列比较候选盘']
      : []),
  ];
  return {
    reference,
    declination: declination ?? null,
    uncertainty,
    trueNorthDegree,
    nearestBoundaryDistanceDegrees: nearestMountainBoundaryDistance(trueNorthDegree),
    stability,
    candidateDirections,
    warnings,
  };
}

function resolveBaZhaiTrueNorthDirectionMeasurement(
  generation: Extract<BaZhaiGenerationSource, { method: 'true-north-degree' }>,
) {
  const facingDegree =
    generation.facingDegree ?? normalizeDegree((generation.sitDegree as number) + 180);
  const uncertainty = generation.measurementUncertaintyDegrees;
  const candidateDirections: Array<
    Pick<BaZhaiDirectionCandidate, 'sitMountain' | 'facingMountain' | 'label' | 'houseGua'>
  > = [];
  for (let index = 0; index < 24; index += 1) {
    const facingCenter = index * 15;
    if (circularDistance(facingDegree, facingCenter) > uncertainty + 7.5 + Number.EPSILON * 32) {
      continue;
    }
    const position = getSitFacingFromFacingDegree(facingCenter);
    candidateDirections.push({
      sitMountain: position.sit.mountain,
      facingMountain: position.facing.mountain,
      label: position.label,
      houseGua: getHouseTrigram(position.sit.mountain),
    });
  }
  const houseGuas = new Set(candidateDirections.map((item) => item.houseGua));
  const stability: BaZhaiMeasurementStability =
    houseGuas.size > 1 ? '宅卦不稳定' : candidateDirections.length > 1 ? '山向边界敏感' : '稳定';
  const warnings = [
    ...(stability === '山向边界敏感'
      ? ['测量误差范围跨越二十四山边界，但候选山向仍属于同一宅卦']
      : []),
    ...(stability === '宅卦不稳定'
      ? ['测量误差范围跨越宅卦边界，不能只采用单一八宅盘，应重新测量或并列比较候选盘']
      : []),
  ];
  return {
    reference: 'true' as const,
    declination: null,
    uncertainty,
    trueNorthDegree: facingDegree,
    nearestBoundaryDistanceDegrees: nearestMountainBoundaryDistance(facingDegree),
    stability,
    candidateDirections,
    warnings,
  };
}

function resolveEffectiveBirthYear(input: BaZhaiInput): {
  year: number;
  note: string;
} {
  if (!Number.isSafeInteger(input.birthYear) || input.birthYear! < 1 || input.birthYear! > 9999) {
    throw new Error('出生年份必须是 1-9999 之间的整数。');
  }
  const year = input.birthYear!;
  const hasMonth = input.birthMonth !== undefined;
  const hasDay = input.birthDay !== undefined;
  if (hasMonth !== hasDay) throw new Error('八宅立春换年需同时提供出生月和出生日。');
  if (!hasMonth || !hasDay) {
    return {
      year,
      note: '只提供了出生年份；若出生在当年立春前，命卦应按上一年复核。',
    };
  }
  const month = input.birthMonth!;
  const day = input.birthDay!;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('出生月份需在 1-12 之间。');
  }
  const maxDay = daysInGregorianMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new Error(`出生日期需在 1-${maxDay} 之间。`);
  }
  const birthGanZhiYear = getGanZhiFromDate(new Date(year, month - 1, day, 12, 0, 0)).year;
  const currentGanZhiYear = getGanZhiFromDate(new Date(year, 6, 1, 12, 0, 0)).year;
  const effectiveYear = birthGanZhiYear === currentGanZhiYear ? year : year - 1;
  return {
    year: effectiveYear,
    note:
      effectiveYear === year
        ? `出生日期已过 ${year} 年立春，命卦按 ${year} 年计算。`
        : `出生日期在 ${year} 年立春前，命卦按 ${effectiveYear} 年计算。`,
  };
}

function resolveMingGua(input: BaZhaiInput): {
  gua: string;
  effectiveBirthYear: number | null;
  note: string;
} {
  if (input.mingGua) {
    return { gua: input.mingGua, effectiveBirthYear: null, note: '本次直接使用已给定的命卦。' };
  }
  if (input.birthYear != null && input.gender) {
    const resolved = resolveEffectiveBirthYear(input);
    return {
      gua: calculateMingGua(resolved.year, input.gender).gua,
      effectiveBirthYear: resolved.year,
      note: resolved.note,
    };
  }
  throw new Error('需提供 birthYear+gender 或直接给定 mingGua。');
}

function buildPrompt(r: Omit<BaZhaiResult, 'prompt'>): string {
  const lines: string[] = [];
  lines.push('【八宅风水排盘】');
  lines.push(`命卦：${r.mingGua}（${r.mingGroup}）`);
  lines.push(`立春年界：${r.birthYearBoundaryNote}`);
  if (r.houseGua) {
    lines.push(`宅卦：${r.houseGua}（${r.houseGroup}）`);
    lines.push(`命宅分组关系：${r.groupRelation}`);
  } else {
    lines.push('宅卦：未提供');
  }
  lines.push('命卦八宫传统标签：');
  lines.push(
    ...r.mingPalace.map(
      (palace) => `- ${palace.gua}宫：${palace.direction} ${palace.degree}°，${palace.label}`,
    ),
  );
  if (r.housePalace) {
    lines.push('宅卦八宫传统标签：');
    lines.push(
      ...r.housePalace.map(
        (palace) => `- ${palace.gua}宫：${palace.direction} ${palace.degree}°，${palace.label}`,
      ),
    );
  }
  lines.push(
    '标签边界：以上只记录传统查表名称与分组同异，不直接生成现实方向、住宅效果或布置建议。',
  );
  return lines.join('\n');
}

function personSourceToInput(person: BaZhaiPersonGenerationSource): BaZhaiInput {
  return person.source === 'ming-gua'
    ? { mingGua: person.mingGua }
    : {
        birthYear: person.birthYear,
        ...(person.birthMonth !== undefined ? { birthMonth: person.birthMonth } : {}),
        ...(person.birthDay !== undefined ? { birthDay: person.birthDay } : {}),
        gender: person.gender,
      };
}

function buildBaZhaiFromPerson(
  person: BaZhaiPersonGenerationSource,
  sitMountain: string | undefined,
  generation: BaZhaiGenerationSource,
): BaZhaiResult {
  const input: BaZhaiInput = {
    ...personSourceToInput(person),
    ...(sitMountain !== undefined ? { sitMountain } : {}),
  };
  const resolvedMingGua = resolveMingGua(input);
  const mingGua = resolvedMingGua.gua;
  const mingGroup = getEastWestGroup(mingGua);
  const mingMansion = getEightMansion(mingGua);
  const mingPalace = [...mingMansion.palaces].sort((a, b) => a.degree - b.degree);

  let houseGua: string | null = null;
  let houseGroup: '东四命' | '西四命' | null = null;
  let housePalace: BaZhaiPalace[] | null = null;
  let groupRelation: BaZhaiGroupRelation = '未比较';

  if (input.sitMountain) {
    houseGua = getHouseTrigram(input.sitMountain);
    houseGroup = getEastWestGroup(houseGua);
    housePalace = getBaZhaiPalace(houseGua);
    groupRelation = houseGroup === mingGroup ? '同组' : '异组';
  }

  const resultBase: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'> = {
    generation,
    calculationInput: {
      mingGuaSource: person.source === 'ming-gua' ? '直接给定' : '出生年与性别计算',
      ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
      ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
      ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.mingGua ? { directMingGua: input.mingGua } : {}),
      ...(input.sitMountain ? { sitMountain: input.sitMountain } : {}),
    },
    mingGua,
    effectiveBirthYear: resolvedMingGua.effectiveBirthYear,
    birthYearBoundaryNote: resolvedMingGua.note,
    mingGroup,
    houseGua,
    houseGroup,
    mingPalace,
    housePalace,
    groupRelation,
  };
  const evidenceAnalysis = buildBaZhaiEvidence(resultBase);
  const result: Omit<BaZhaiResult, 'prompt'> = { ...resultBase, evidenceAnalysis };
  return { ...result, prompt: buildPrompt(result) };
}

/** 八宅风水分析。输入先规范化为可信来源，再生成全部派生盘面。 */
export function analyzeBaZhai(input: BaZhaiInput): BaZhaiResult {
  const generation = normalizeBaZhaiInput(input);
  return buildBaZhaiFromPerson(generation.person, generation.sitMountain, generation);
}

function buildMeasuredBaZhaiResult(
  generation: Extract<BaZhaiGenerationSource, { method: 'door-measurement' | 'true-north-degree' }>,
  measurement: ReturnType<typeof resolveBaZhaiDoorMeasurement>,
  position: SitFacingPosition,
): BaZhaiDoorDegreeResult {
  const { facing, sit, label } = position;
  if (facing.isBoundary && measurement.uncertainty === 0) {
    const boundary = facing.boundaryMountains?.join('向与') ?? '两个二十四山';
    throw new Error(`当前度数正好位于${boundary}向的分界线，请重新测量。`);
  }
  const result = buildBaZhaiFromPerson(generation.person, sit.mountain, generation);
  const candidateDirections: BaZhaiDirectionCandidate[] = measurement.candidateDirections.map(
    (item) => {
      const houseGroup = getEastWestGroup(item.houseGua);
      return {
        ...item,
        houseGroup,
        groupRelation: houseGroup === result.mingGroup ? '同组' : '异组',
        housePalace: getBaZhaiPalace(item.houseGua),
      };
    },
  );
  const isDoorMeasurement = generation.method === 'door-measurement';
  const measuredDegree = isDoorMeasurement
    ? generation.doorToInteriorDegree
    : measurement.trueNorthDegree;
  const method = isDoorMeasurement ? '站在大门处面向屋内测量' : '直接提供真北坐向度数';
  const inputDescription = isDoorMeasurement
    ? `测量方式：站在大门处面向屋内，指南针读数为 ${generation.doorToInteriorDegree}°；北向基准为${measurement.reference === 'magnetic' ? `磁北，磁偏角 ${measurement.declination}°（东偏为正）` : measurement.reference === 'true' ? '真北' : '未声明'}。`
    : `坐向来源：直接提供真北口径度数；坐山${generation.sitDegree === null ? '未单独提供' : `${generation.sitDegree}°`}，朝向${generation.facingDegree === null ? '未单独提供' : `${generation.facingDegree}°`}。`;
  const normalizedDescription = isDoorMeasurement
    ? `真北口径入户方向为 ${measurement.trueNorthDegree}°，测量误差 ±${measurement.uncertainty}°，距最近二十四山边界 ${measurement.nearestBoundaryDistanceDegrees.toFixed(2)}°，稳定性为${measurement.stability}。`
    : `规范化后的真北朝向为 ${facing.degree}°、坐山为 ${sit.degree}°，测量误差 ±${measurement.uncertainty}°，距最近二十四山边界 ${measurement.nearestBoundaryDistanceDegrees.toFixed(2)}°，稳定性为${measurement.stability}。`;
  const directionMeasurement: BaZhaiDoorMeasurement = {
    method,
    measuredDegree,
    northReference: measurement.reference,
    magneticDeclinationDegrees: measurement.declination,
    trueNorthDegree: measurement.trueNorthDegree,
    measurementUncertaintyDegrees: measurement.uncertainty,
    nearestBoundaryDistanceDegrees: measurement.nearestBoundaryDistanceDegrees,
    stability: measurement.stability,
    candidateDirections,
    warnings: measurement.warnings,
    facingDegree: facing.degree,
    facingMountain: facing.mountain,
    sitDegree: sit.degree,
    sitMountain: sit.mountain,
    label,
    promptText: [
      inputDescription,
      normalizedDescription,
      `中心读数换算后住宅坐山 ${sit.degree}° 为${sit.mountain}山，传统朝向 ${facing.degree}° 为${facing.mountain}向，结果为${label}。`,
      `误差候选：${candidateDirections.map((item) => `${item.label}（${item.houseGua}宅、${item.houseGroup}、命宅分组${item.groupRelation}）`).join('、')}。`,
      ...(measurement.stability === '宅卦不稳定'
        ? candidateDirections.map(
            (item) =>
              `- 候选${item.label}：${item.houseGua}宅八宫为${item.housePalace.map((palace) => `${palace.direction}${palace.label}`).join('、')}`,
          )
        : []),
      measurement.warnings.length ? `测量限制：${measurement.warnings.join('；')}。` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
  const { prompt: _prompt, evidenceAnalysis: _evidenceAnalysis, ...resultFacts } = result;
  const evidenceAnalysis = buildBaZhaiEvidence(resultFacts, directionMeasurement);
  return {
    ...result,
    evidenceAnalysis,
    prompt: buildPrompt({ ...resultFacts, evidenceAnalysis }),
    directionMeasurement,
  };
}

/**
 * 直接使用“从大门面向屋内”的指南针读数生成完整八宅结果。
 * 调用方无需自行换算相反方向或二十四山。
 */
export function analyzeBaZhaiByDoorDegree(input: BaZhaiDoorDegreeInput): BaZhaiDoorDegreeResult {
  const generation = normalizeDoorInput(input);
  const doorInput: BaZhaiDoorDegreeInput = {
    ...personSourceToInput(generation.person),
    doorToInteriorDegree: generation.doorToInteriorDegree,
    northReference: generation.northReference,
    ...(generation.magneticDeclinationDegrees !== null
      ? { magneticDeclinationDegrees: generation.magneticDeclinationDegrees }
      : {}),
    measurementUncertaintyDegrees: generation.measurementUncertaintyDegrees,
  };
  const measurement = resolveBaZhaiDoorMeasurement(doorInput);
  return buildMeasuredBaZhaiResult(
    generation,
    measurement,
    getBaZhaiSitFacingFromDoorDegree(measurement.trueNorthDegree),
  );
}

/** 直接使用真北口径的坐山或朝向度数生成八宅结果，并保留误差候选。 */
export function analyzeBaZhaiByTrueNorthDegree(
  input: BaZhaiTrueNorthDegreeInput,
): BaZhaiDoorDegreeResult {
  const generation = normalizeTrueNorthDegreeInput(input);
  const measurement = resolveBaZhaiTrueNorthDirectionMeasurement(generation);
  return buildMeasuredBaZhaiResult(
    generation,
    measurement,
    getSitFacingFromFacingDegree(measurement.trueNorthDegree),
  );
}

/** 只凭规范化出生/命卦来源及固定坐山或门向测量来源重建完整八宅结果。 */
export function rebuildAuditedBaZhaiData(
  input: Pick<BaZhaiResult, 'generation'>,
): BaZhaiResult | BaZhaiDoorDegreeResult {
  if (!isRecord(input)) throw new Error('八宅审核重建必须提供结果对象。');
  if (!Object.prototype.hasOwnProperty.call(input, 'generation')) {
    throw new Error('八宅旧结果缺少可信原始输入，无法审核重建。');
  }
  const generation = normalizeBaZhaiGenerationSource(input.generation);
  if (generation.method === 'door-measurement') {
    return analyzeBaZhaiByDoorDegree({
      ...personSourceToInput(generation.person),
      doorToInteriorDegree: generation.doorToInteriorDegree,
      northReference: generation.northReference,
      ...(generation.magneticDeclinationDegrees !== null
        ? { magneticDeclinationDegrees: generation.magneticDeclinationDegrees }
        : {}),
      measurementUncertaintyDegrees: generation.measurementUncertaintyDegrees,
    });
  }
  if (generation.method === 'true-north-degree') {
    return analyzeBaZhaiByTrueNorthDegree({
      ...personSourceToInput(generation.person),
      ...(generation.sitDegree !== null ? { sitDegree: generation.sitDegree } : {}),
      ...(generation.facingDegree !== null ? { facingDegree: generation.facingDegree } : {}),
      measurementUncertaintyDegrees: generation.measurementUncertaintyDegrees,
    });
  }
  return analyzeBaZhai({
    ...personSourceToInput(generation.person),
    ...(generation.sitMountain !== undefined ? { sitMountain: generation.sitMountain } : {}),
  });
}

/** 先从可信来源审核重建完整盘面，再返回结构化证据。 */
export function analyzeBaZhaiEvidence(
  input: Pick<BaZhaiResult, 'generation'>,
): BaZhaiResult['evidenceAnalysis'] {
  return rebuildAuditedBaZhaiData(input).evidenceAnalysis;
}

export const bazhai = {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  analyzeBaZhaiByTrueNorthDegree,
  rebuildAuditedBaZhaiData,
  analyzeBaZhaiEvidence,
  getBaZhaiSitFacingFromDoorDegree,
  resolveBaZhaiDoorMeasurement,
};
