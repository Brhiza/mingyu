/**
 * @file 住宅风水（八宅 + 玄空飞星 一站式）
 * @description 产品入口收敛为“住宅风水”；算法仍分层计算八宅与玄空，再合成统一结果与提示词。
 * 不生成可执行方位取舍、具体布置方案或综合总分，不把两套体系互相改写。
 */

import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  analyzeBaZhaiByTrueNorthDegree,
  getBaZhaiSitFacingFromDoorDegree,
  rebuildAuditedBaZhaiData,
  resolveBaZhaiDoorMeasurement,
  type BaZhaiDoorDegreeInput,
  type BaZhaiInput,
  type BaZhaiPersonGenerationSource,
  type BaZhaiResult,
} from '../ba_zhai';
import { TWENTY_FOUR_MOUNTAINS } from '../direction';
import {
  generateXuanKong,
  rebuildAuditedXuanKongData,
  type XuanKongGuaType,
  type XuanKongInput,
  type XuanKongResult,
} from '../xuan_kong';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export interface ResidentialFengshuiInput {
  /** 建造年或起运年；排玄空宅运盘时必需 */
  year?: number;
  /** 出生公历年，用于八宅命卦 */
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  gender?: 'male' | 'female';
  mingGua?: string;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  /** 八宅门向测量：站在大门处面向屋内 */
  doorToInteriorDegree?: number;
  northReference?: 'unspecified' | 'magnetic' | 'true';
  magneticDeclinationDegrees?: number;
  measurementUncertaintyDegrees?: number;
  guaType?: '下卦' | '替卦';
}

export type ResidentialFengshuiOrientationGenerationSource =
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
    }
  | {
      source: 'door-measurement';
      doorToInteriorDegree: number;
      northReference: 'unspecified' | 'magnetic' | 'true';
      magneticDeclinationDegrees: number | null;
      measurementUncertaintyDegrees: number;
    };

/** 住宅风水统一入口的唯一可信来源；八宅与玄空结果均由此重新生成。 */
export interface ResidentialFengshuiGenerationSource {
  person: BaZhaiPersonGenerationSource | null;
  orientation: ResidentialFengshuiOrientationGenerationSource | null;
  year: number | null;
  guaType: XuanKongGuaType | null;
}

export interface ResidentialFengshuiReviewNote {
  level: '资料完整' | '资料不足' | '分层记录' | '边界敏感';
  title: string;
  detail: string;
}

export interface ResidentialFengshuiResult {
  /** 审核重建所需的唯一可信来源；其余字段均为派生结果。 */
  generation: ResidentialFengshuiGenerationSource;
  key: 'residential-fengshui';
  label: '住宅风水';
  inputSummary: {
    hasPerson: boolean;
    hasHouseOrientation: boolean;
    houseYear: number | null;
    orientationText: string;
    xuankongStatus: '已排盘' | '缺少山向' | '缺少建造年或起运年';
  };
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
  reviewNotes: ResidentialFengshuiReviewNote[];
  prompt: string;
  evidencePromptText: string;
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

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeYear(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 9999) {
    throw new Error('year 必须是 1-9999 之间的安全整数。');
  }
  return value as number;
}

function normalizeCompassDegree(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 360) {
    throw new Error(`${label} 必须是 0-360 之间的有限数字。`);
  }
  return value === 360 ? 0 : value;
}

function oppositeMountain(mountain: string): string {
  const index = TWENTY_FOUR_MOUNTAINS.indexOf(mountain);
  return TWENTY_FOUR_MOUNTAINS[(index + 12) % 24];
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

function normalizePersonSource(source: unknown): BaZhaiPersonGenerationSource | null {
  if (source === null) return null;
  if (!isRecord(source)) throw new Error('住宅风水居住人可信来源必须是对象或 null。');
  if (source.source === 'birth') {
    assertExactKeys(
      source,
      ['source', 'birthYear', 'birthMonth', 'birthDay', 'gender'],
      '住宅风水出生来源',
    );
    for (const key of ['birthYear', 'gender'] as const) {
      if (!hasOwn(source, key)) throw new Error(`住宅风水出生来源缺少 ${key}。`);
    }
    for (const key of ['birthMonth', 'birthDay'] as const) {
      if (hasOwn(source, key) && source[key] === undefined) {
        throw new Error(`住宅风水出生来源 ${key} 不能用 undefined 冒充未提供。`);
      }
    }
    const result = analyzeBaZhai({
      birthYear: source.birthYear as number,
      ...(source.birthMonth !== undefined ? { birthMonth: source.birthMonth as number } : {}),
      ...(source.birthDay !== undefined ? { birthDay: source.birthDay as number } : {}),
      gender: source.gender as 'male' | 'female',
    });
    return result.generation.person;
  }
  if (source.source === 'ming-gua') {
    assertExactKeys(source, ['source', 'mingGua'], '住宅风水命卦来源');
    if (!hasOwn(source, 'mingGua')) throw new Error('住宅风水命卦来源缺少 mingGua。');
    const result = analyzeBaZhai({ mingGua: source.mingGua as string });
    return result.generation.person;
  }
  throw new Error('住宅风水居住人来源 source 必须是 birth 或 ming-gua。');
}

function normalizeOrientationSource(
  source: unknown,
): ResidentialFengshuiOrientationGenerationSource | null {
  if (source === null) return null;
  if (!isRecord(source)) throw new Error('住宅风水山向可信来源必须是对象或 null。');
  if (source.source === 'mountain') {
    assertExactKeys(source, ['source', 'sitMountain', 'facingMountain'], '住宅风水山名来源');
    for (const key of ['sitMountain', 'facingMountain'] as const) {
      if (!hasOwn(source, key)) throw new Error(`住宅风水山名来源缺少 ${key}。`);
    }
    const sitMountain = source.sitMountain;
    const facingMountain = source.facingMountain;
    if (sitMountain !== null && typeof sitMountain !== 'string') {
      throw new Error('sitMountain 必须是二十四山字符串或 null。');
    }
    if (facingMountain !== null && typeof facingMountain !== 'string') {
      throw new Error('facingMountain 必须是二十四山字符串或 null。');
    }
    if (sitMountain === null && facingMountain === null) {
      throw new Error('住宅风水山名来源至少需要 sitMountain 或 facingMountain。');
    }
    if (sitMountain !== null && !TWENTY_FOUR_MOUNTAINS.includes(sitMountain)) {
      throw new Error(`sitMountain 必须是有效二十四山，当前为 ${sitMountain}。`);
    }
    if (facingMountain !== null && !TWENTY_FOUR_MOUNTAINS.includes(facingMountain)) {
      throw new Error(`facingMountain 必须是有效二十四山，当前为 ${facingMountain}。`);
    }
    if (
      sitMountain !== null &&
      facingMountain !== null &&
      oppositeMountain(sitMountain) !== facingMountain
    ) {
      throw new Error(
        `坐向必须严格相对；当前坐${sitMountain}应向${oppositeMountain(sitMountain)}，不能向${facingMountain}。`,
      );
    }
    return { source: 'mountain', sitMountain, facingMountain };
  }
  if (source.source === 'degree') {
    assertExactKeys(
      source,
      ['source', 'sitDegree', 'facingDegree', 'measurementUncertaintyDegrees'],
      '住宅风水度数来源',
    );
    for (const key of ['sitDegree', 'facingDegree', 'measurementUncertaintyDegrees'] as const) {
      if (!hasOwn(source, key)) throw new Error(`住宅风水度数来源缺少 ${key}。`);
    }
    const sitDegree =
      source.sitDegree === null ? null : normalizeCompassDegree(source.sitDegree, 'sitDegree');
    const facingDegree =
      source.facingDegree === null
        ? null
        : normalizeCompassDegree(source.facingDegree, 'facingDegree');
    if (sitDegree === null && facingDegree === null) {
      throw new Error('住宅风水度数来源至少需要 sitDegree 或 facingDegree。');
    }
    const uncertainty = source.measurementUncertaintyDegrees;
    if (
      typeof uncertainty !== 'number' ||
      !Number.isFinite(uncertainty) ||
      uncertainty < 0 ||
      uncertainty > 45
    ) {
      throw new Error('measurementUncertaintyDegrees 必须是 0-45 之间的有限数字。');
    }
    if (sitDegree !== null && facingDegree !== null) {
      assertOppositeDegrees(sitDegree, facingDegree);
    }
    return {
      source: 'degree',
      sitDegree,
      facingDegree,
      measurementUncertaintyDegrees: uncertainty,
    };
  }
  if (source.source === 'door-measurement') {
    assertExactKeys(
      source,
      [
        'source',
        'doorToInteriorDegree',
        'northReference',
        'magneticDeclinationDegrees',
        'measurementUncertaintyDegrees',
      ],
      '住宅风水门向测量来源',
    );
    for (const key of [
      'doorToInteriorDegree',
      'northReference',
      'magneticDeclinationDegrees',
      'measurementUncertaintyDegrees',
    ] as const) {
      if (!hasOwn(source, key)) throw new Error(`住宅风水门向测量来源缺少 ${key}。`);
    }
    if (
      source.magneticDeclinationDegrees !== null &&
      (typeof source.magneticDeclinationDegrees !== 'number' ||
        !Number.isFinite(source.magneticDeclinationDegrees))
    ) {
      throw new Error('magneticDeclinationDegrees 必须是有限数字或 null。');
    }
    const measurement = resolveBaZhaiDoorMeasurement({
      doorToInteriorDegree: source.doorToInteriorDegree as number,
      northReference: source.northReference as 'unspecified' | 'magnetic' | 'true',
      ...(source.magneticDeclinationDegrees !== null
        ? { magneticDeclinationDegrees: source.magneticDeclinationDegrees as number }
        : {}),
      measurementUncertaintyDegrees: source.measurementUncertaintyDegrees as number,
    });
    return {
      source: 'door-measurement',
      doorToInteriorDegree: source.doorToInteriorDegree as number,
      northReference: measurement.reference,
      magneticDeclinationDegrees: measurement.declination,
      measurementUncertaintyDegrees: measurement.uncertainty,
    };
  }
  throw new Error('住宅风水山向来源 source 必须是 mountain、degree 或 door-measurement。');
}

function normalizeResidentialGenerationSource(
  source: unknown,
): ResidentialFengshuiGenerationSource {
  if (!isRecord(source)) throw new Error('住宅风水可信来源必须是对象。');
  assertExactKeys(source, ['person', 'orientation', 'year', 'guaType'], '住宅风水可信来源');
  for (const key of ['person', 'orientation', 'year', 'guaType'] as const) {
    if (!hasOwn(source, key)) throw new Error(`住宅风水可信来源缺少 ${key}。`);
  }
  const person = normalizePersonSource(source.person);
  const orientation = normalizeOrientationSource(source.orientation);
  const year = source.year === null ? null : normalizeYear(source.year);
  const guaType = normalizeGuaType(source.guaType);
  if (person === null && orientation === null) {
    throw new Error('住宅风水至少需要提供山向，或居住人出生资料/命卦。');
  }
  if (year !== null && orientation === null) {
    throw new Error('year 只能在同时提供山向时使用。');
  }
  if (orientation !== null && year === null && person === null) {
    throw new Error('仅按山向排玄空宅运盘时，必须提供住宅建造年或起运年。');
  }
  if (guaType !== null && (orientation === null || year === null)) {
    throw new Error('guaType 只能在同时提供山向与建造/起运年时使用。');
  }
  return { person, orientation, year, guaType };
}

function normalizeResidentialInput(input: unknown): ResidentialFengshuiGenerationSource {
  if (!isRecord(input)) throw new Error('住宅风水参数必须是对象。');
  const allowedKeys = [
    'year',
    'birthYear',
    'birthMonth',
    'birthDay',
    'gender',
    'mingGua',
    'sitMountain',
    'facingMountain',
    'facingDegree',
    'sitDegree',
    'doorToInteriorDegree',
    'northReference',
    'magneticDeclinationDegrees',
    'measurementUncertaintyDegrees',
    'guaType',
  ] as const;
  assertExactKeys(input, allowedKeys, '住宅风水参数');
  for (const key of allowedKeys) {
    if (hasOwn(input, key) && input[key] === null) {
      throw new Error(`住宅风水参数 ${key} 不接受显式 null。`);
    }
  }

  const hasPersonFields = ['birthYear', 'birthMonth', 'birthDay', 'gender', 'mingGua'].some(
    (key) => input[key] !== undefined,
  );
  const person = hasPersonFields
    ? normalizePersonSource(
        input.mingGua !== undefined
          ? {
              source: 'ming-gua',
              mingGua: input.mingGua,
              ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
              ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
              ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
              ...(input.gender !== undefined ? { gender: input.gender } : {}),
            }
          : {
              source: 'birth',
              birthYear: input.birthYear,
              ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
              ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
              gender: input.gender,
            },
      )
    : null;

  const hasMountain = input.sitMountain !== undefined || input.facingMountain !== undefined;
  const hasDegree = input.sitDegree !== undefined || input.facingDegree !== undefined;
  const hasDoor = input.doorToInteriorDegree !== undefined;
  const orientationSourceCount = Number(hasMountain) + Number(hasDegree) + Number(hasDoor);
  if (orientationSourceCount > 1) {
    throw new Error('住宅风水山名、直接度数与门向测量属于不同可信来源，不能混用。');
  }
  if (
    !hasDoor &&
    (input.northReference !== undefined || input.magneticDeclinationDegrees !== undefined)
  ) {
    throw new Error('northReference 与 magneticDeclinationDegrees 只能用于门向测量来源。');
  }
  if (!hasDegree && !hasDoor && input.measurementUncertaintyDegrees !== undefined) {
    throw new Error('measurementUncertaintyDegrees 只能用于直接度数或门向测量来源。');
  }
  const orientation = normalizeOrientationSource(
    hasMountain
      ? {
          source: 'mountain',
          sitMountain: input.sitMountain ?? null,
          facingMountain: input.facingMountain ?? null,
        }
      : hasDegree
        ? {
            source: 'degree',
            sitDegree: input.sitDegree ?? null,
            facingDegree: input.facingDegree ?? null,
            measurementUncertaintyDegrees: input.measurementUncertaintyDegrees ?? 0,
          }
        : hasDoor
          ? {
              source: 'door-measurement',
              doorToInteriorDegree: input.doorToInteriorDegree,
              northReference: input.northReference ?? 'unspecified',
              magneticDeclinationDegrees: input.magneticDeclinationDegrees ?? null,
              measurementUncertaintyDegrees: input.measurementUncertaintyDegrees ?? 0,
            }
          : null,
  );
  return normalizeResidentialGenerationSource({
    person,
    orientation,
    year: input.year === undefined ? null : input.year,
    guaType: input.guaType === undefined ? null : input.guaType,
  });
}

function personSourceToInput(
  person: BaZhaiPersonGenerationSource | null,
): ResidentialFengshuiInput {
  if (person === null) return {};
  return person.source === 'birth'
    ? {
        birthYear: person.birthYear,
        ...(person.birthMonth !== undefined ? { birthMonth: person.birthMonth } : {}),
        ...(person.birthDay !== undefined ? { birthDay: person.birthDay } : {}),
        gender: person.gender,
      }
    : { mingGua: person.mingGua };
}

function generationSourceToInput(
  generation: ResidentialFengshuiGenerationSource,
): ResidentialFengshuiInput {
  const orientation = generation.orientation;
  return {
    ...personSourceToInput(generation.person),
    ...(generation.year !== null ? { year: generation.year } : {}),
    ...(generation.guaType !== null ? { guaType: generation.guaType } : {}),
    ...(orientation?.source === 'mountain'
      ? {
          ...(orientation.sitMountain !== null ? { sitMountain: orientation.sitMountain } : {}),
          ...(orientation.facingMountain !== null
            ? { facingMountain: orientation.facingMountain }
            : {}),
        }
      : orientation?.source === 'degree'
        ? {
            ...(orientation.sitDegree !== null ? { sitDegree: orientation.sitDegree } : {}),
            ...(orientation.facingDegree !== null
              ? { facingDegree: orientation.facingDegree }
              : {}),
            measurementUncertaintyDegrees: orientation.measurementUncertaintyDegrees,
          }
        : orientation?.source === 'door-measurement'
          ? {
              doorToInteriorDegree: orientation.doorToInteriorDegree,
              northReference: orientation.northReference,
              ...(orientation.magneticDeclinationDegrees !== null
                ? { magneticDeclinationDegrees: orientation.magneticDeclinationDegrees }
                : {}),
              measurementUncertaintyDegrees: orientation.measurementUncertaintyDegrees,
            }
          : {}),
  };
}

function buildOrientationText(params: {
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
  input: ResidentialFengshuiInput;
}) {
  if (params.xuankong) {
    return `坐${params.xuankong.sitMountain}向${params.xuankong.facingMountain}`;
  }
  const sit =
    params.input.sitMountain ||
    (params.bazhai as { directionMeasurement?: { sitMountain?: string } } | null)
      ?.directionMeasurement?.sitMountain;
  const facing =
    params.input.facingMountain ||
    (params.bazhai as { directionMeasurement?: { facingMountain?: string } } | null)
      ?.directionMeasurement?.facingMountain;
  if (sit && facing) return `坐${sit}向${facing}`;
  if (sit) return `坐${sit}`;
  if (params.input.doorToInteriorDegree != null) {
    return `门向度数 ${params.input.doorToInteriorDegree}°`;
  }
  if (params.input.facingDegree != null) return `朝向度数 ${params.input.facingDegree}°`;
  if (params.input.sitDegree != null) return `坐山度数 ${params.input.sitDegree}°`;
  return '未提供山向';
}

function buildBazhai(input: ResidentialFengshuiInput): BaZhaiResult | null {
  if (input.mingGua === undefined && input.birthYear === undefined) return null;

  const base: BaZhaiInput = {
    ...(input.birthYear != null ? { birthYear: input.birthYear } : {}),
    ...(input.birthMonth != null ? { birthMonth: input.birthMonth } : {}),
    ...(input.birthDay != null ? { birthDay: input.birthDay } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.mingGua ? { mingGua: input.mingGua } : {}),
  };

  if (input.doorToInteriorDegree != null) {
    const doorInput: BaZhaiDoorDegreeInput = {
      ...base,
      doorToInteriorDegree: input.doorToInteriorDegree,
      ...(input.northReference ? { northReference: input.northReference } : {}),
      ...(input.magneticDeclinationDegrees != null
        ? { magneticDeclinationDegrees: input.magneticDeclinationDegrees }
        : {}),
      ...(input.measurementUncertaintyDegrees != null
        ? { measurementUncertaintyDegrees: input.measurementUncertaintyDegrees }
        : {}),
    };
    return rebuildAuditedBaZhaiData(analyzeBaZhaiByDoorDegree(doorInput));
  }

  if (input.sitDegree != null || input.facingDegree != null) {
    return rebuildAuditedBaZhaiData(
      analyzeBaZhaiByTrueNorthDegree({
        ...base,
        ...(input.sitDegree != null ? { sitDegree: input.sitDegree } : {}),
        ...(input.facingDegree != null ? { facingDegree: input.facingDegree } : {}),
        ...(input.measurementUncertaintyDegrees != null
          ? { measurementUncertaintyDegrees: input.measurementUncertaintyDegrees }
          : {}),
      }),
    );
  }

  const sitMountain =
    input.sitMountain ??
    (input.facingMountain ? oppositeMountain(input.facingMountain) : undefined);

  // 若只给了朝向山名，则由玄空侧推坐山后，再回填八宅。
  if (sitMountain) {
    return rebuildAuditedBaZhaiData(analyzeBaZhai({ ...base, sitMountain }));
  }

  // 无明确坐山时，仍可先算命卦盘。
  return rebuildAuditedBaZhaiData(analyzeBaZhai(base));
}

function buildXuanKong(input: ResidentialFengshuiInput): XuanKongResult | null {
  const hasOrientation =
    input.sitMountain !== undefined ||
    input.facingMountain !== undefined ||
    input.sitDegree !== undefined ||
    input.facingDegree !== undefined ||
    input.doorToInteriorDegree !== undefined;
  if (!hasOrientation || input.year == null) return null;

  const xuanInput: XuanKongInput = {
    year: input.year,
    ...(input.guaType ? { guaType: input.guaType } : {}),
  };

  if (input.sitDegree != null || input.facingDegree != null) {
    if (input.sitDegree != null) xuanInput.sitDegree = input.sitDegree;
    if (input.facingDegree != null) xuanInput.facingDegree = input.facingDegree;
    if (input.measurementUncertaintyDegrees != null) {
      xuanInput.measurementUncertaintyDegrees = input.measurementUncertaintyDegrees;
    }
  } else if (input.doorToInteriorDegree != null) {
    // 无论有无居住人，门向测量都先复用八宅层的北向与磁偏角校正规则。
    const measurement = resolveBaZhaiDoorMeasurement({
      doorToInteriorDegree: input.doorToInteriorDegree,
      ...(input.northReference ? { northReference: input.northReference } : {}),
      ...(input.magneticDeclinationDegrees !== undefined
        ? { magneticDeclinationDegrees: input.magneticDeclinationDegrees }
        : {}),
      ...(input.measurementUncertaintyDegrees !== undefined
        ? { measurementUncertaintyDegrees: input.measurementUncertaintyDegrees }
        : {}),
    });
    const position = getBaZhaiSitFacingFromDoorDegree(measurement.trueNorthDegree);
    xuanInput.sitDegree = position.sit.degree;
    xuanInput.facingDegree = position.facing.degree;
    xuanInput.measurementUncertaintyDegrees = measurement.uncertainty;
  } else if (input.sitMountain || input.facingMountain) {
    if (input.measurementUncertaintyDegrees != null) {
      throw new Error('山名来源不能夹带 measurementUncertaintyDegrees；请提供实际度数测量。');
    }
    if (input.sitMountain) xuanInput.sitMountain = input.sitMountain;
    if (input.facingMountain) xuanInput.facingMountain = input.facingMountain;
  } else {
    return null;
  }

  return rebuildAuditedXuanKongData(generateXuanKong(xuanInput));
}

function buildReviewNotes(
  bazhai: BaZhaiResult | null,
  xuankong: XuanKongResult | null,
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'],
): ResidentialFengshuiReviewNote[] {
  const items: ResidentialFengshuiReviewNote[] = [];

  if (!bazhai && !xuankong) {
    return [
      {
        level: '资料不足',
        title: '缺少可用资料',
        detail: '至少提供山向或居住人出生信息之一，才能形成住宅风水结果。',
      },
    ];
  }

  if (bazhai && !xuankong) {
    items.push({
      level: '资料不足',
      title: '仅完成八宅人宅层',
      detail:
        xuankongStatus === '缺少建造年或起运年'
          ? '已有命卦与山向资料，但缺少住宅建造年或起运年，暂不排玄空宅运盘。'
          : '已有命卦方位，但缺少明确山向，暂不能排玄空宅运盘。',
    });
  }

  if (!bazhai && xuankong) {
    items.push({
      level: '资料不足',
      title: '仅完成玄空宅运层',
      detail: '已有山向与运盘，但未提供居住人出生年性别或命卦，暂不生成八宅命卦层资料。',
    });
  }

  if (bazhai && xuankong) {
    items.push({
      level: '分层记录',
      title: '玄空与八宅资料分层保存',
      detail: `玄空记录${xuankong.period.label}、${xuankong.daoShanXiang.summary}；八宅记录命卦${bazhai.mingGua}、宅卦${bazhai.houseGua ?? '未定'}、命宅分组${bazhai.groupRelation}。两套资料不互相改写，也不自动合成现实结论。`,
    });

    if (
      xuankong.measurement?.stability === '山向边界敏感' ||
      bazhai.evidenceAnalysis.measurementFact.status === '山向边界敏感' ||
      bazhai.evidenceAnalysis.measurementFact.status === '宅卦不稳定'
    ) {
      items.push({
        level: '边界敏感',
        title: '山向或宅卦存在多个候选',
        detail: '测量误差跨越边界，需保留全部候选山向与候选宅卦，中心读数不能作为唯一盘面。',
      });
    }
  }

  if (bazhai && xuankong && !items.some((item) => item.level === '边界敏感')) {
    items.push({
      level: '资料完整',
      title: '两层基础资料已形成',
      detail:
        '当前已形成八宅命卦宅卦资料与玄空宅运资料；完整只表示输入链闭合，不证明住宅现实效果。',
    });
  }

  return items;
}

function buildEvidencePrompt(params: {
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
  reviewNotes: ResidentialFengshuiReviewNote[];
}) {
  const items: PromptEvidenceItem[] = [];
  if (params.xuankong) {
    items.push({
      level: '主证',
      title: '玄空宅运层',
      detail: `${params.xuankong.period.label}；坐${params.xuankong.sitMountain}向${params.xuankong.facingMountain}；${params.xuankong.guaType}；${params.xuankong.daoShanXiang.summary}`,
      source: '玄空飞星 v1',
    });
  }
  if (params.bazhai) {
    items.push({
      level: '主证',
      title: '八宅人宅层',
      detail: `命卦${params.bazhai.mingGua}，宅卦${params.bazhai.houseGua ?? '未定'}，命宅分组${params.bazhai.groupRelation}；八宫只保留传统标签`,
      source: '八宅大游年',
    });
  }
  for (const item of params.reviewNotes) {
    items.push({
      level:
        item.level === '资料不足' || item.level === '边界敏感'
          ? '反证'
          : item.level === '分层记录'
            ? '限制'
            : '辅证',
      title: item.title,
      detail: item.detail,
      source: '住宅风水合参',
    });
  }
  items.push({
    level: '限制',
    title: '分层资料边界',
    detail:
      '住宅风水只分层并列八宅与玄空，不生成综合总分、可执行方位取舍或具体布置方案，也不覆盖形峦、阴宅或装修方案保证。',
    source: '项目住宅风水 v1',
  });
  const bundle: PromptEvidenceBundle = { title: '住宅风水证据', items };
  return formatPromptEvidenceBundle(bundle).join('\n');
}

function buildPrompt(result: {
  orientationText: string;
  houseYear: number | null;
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
  reviewNotes: ResidentialFengshuiReviewNote[];
  evidencePromptText: string;
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'];
}) {
  const lines = [
    '【住宅风水排盘】',
    `山向：${result.orientationText}`,
    result.houseYear != null ? `宅运年份：${result.houseYear}` : '',
    result.xuankong
      ? `玄空：${result.xuankong.period.label}；坐${result.xuankong.sitMountain}向${result.xuankong.facingMountain}；${result.xuankong.guaType}；${result.xuankong.daoShanXiang.summary}`
      : `玄空：未排盘（${result.xuankongStatus}）`,
    result.bazhai
      ? `八宅：命卦${result.bazhai.mingGua}（${result.bazhai.mingGroup}），宅卦${result.bazhai.houseGua ?? '未定'}，命宅分组${result.bazhai.groupRelation}`
      : '八宅：未排盘（缺少居住人出生信息或命卦）',
    '资料与复核提示：',
    ...result.reviewNotes.map((item) => `- ${item.title}：${item.detail}`),
    '【结构化证据】',
    result.evidencePromptText,
  ];
  return lines.filter(Boolean).join('\n');
}

function generateResidentialFengshuiFromGeneration(
  generation: ResidentialFengshuiGenerationSource,
): ResidentialFengshuiResult {
  const input = generationSourceToInput(generation);
  // 先尽量用门向度数算出八宅坐向，再喂给玄空，保证两边山向一致。
  let bazhai = buildBazhai(input);
  const xuankong = buildXuanKong(input);

  // 若八宅只有命卦、但玄空已推出坐山，则回填八宅宅卦。
  if (bazhai && !bazhai.houseGua && xuankong?.sitMountain && generation.person !== null) {
    bazhai = rebuildAuditedBaZhaiData(
      analyzeBaZhai({
        ...personSourceToInput(generation.person),
        sitMountain: xuankong.sitMountain,
      }),
    );
  }

  const xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'] = xuankong
    ? '已排盘'
    : generation.orientation !== null
      ? '缺少建造年或起运年'
      : '缺少山向';
  const reviewNotes = buildReviewNotes(bazhai, xuankong, xuankongStatus);
  const houseYear = generation.year;
  const orientationText = buildOrientationText({ bazhai, xuankong, input });
  const evidencePromptText = buildEvidencePrompt({ bazhai, xuankong, reviewNotes });
  const prompt = buildPrompt({
    orientationText,
    houseYear,
    bazhai,
    xuankong,
    reviewNotes,
    evidencePromptText,
    xuankongStatus,
  });

  return {
    generation,
    key: 'residential-fengshui',
    label: '住宅风水',
    inputSummary: {
      hasPerson: generation.person !== null,
      hasHouseOrientation: generation.orientation !== null,
      houseYear,
      orientationText,
      xuankongStatus,
    },
    bazhai,
    xuankong,
    reviewNotes,
    prompt,
    evidencePromptText,
  };
}

/** 输入先规范化为可信来源，再由该来源生成两层盘面、证据与提示词。 */
export function generateResidentialFengshui(
  input: ResidentialFengshuiInput = {},
): ResidentialFengshuiResult {
  return generateResidentialFengshuiFromGeneration(normalizeResidentialInput(input));
}

/** 只凭居住人、山向、宅运年份与卦型可信来源重建完整住宅风水结果。 */
export function rebuildAuditedResidentialFengshuiData(
  input: Pick<ResidentialFengshuiResult, 'generation'>,
): ResidentialFengshuiResult {
  if (!isRecord(input)) throw new Error('住宅风水审核重建必须提供结果对象。');
  if (!hasOwn(input, 'generation')) {
    throw new Error('住宅风水旧结果缺少可信原始输入，无法审核重建。');
  }
  return generateResidentialFengshuiFromGeneration(
    normalizeResidentialGenerationSource(input.generation),
  );
}

export const residentialFengshui = {
  generateResidentialFengshui,
  rebuildAuditedResidentialFengshuiData,
};
