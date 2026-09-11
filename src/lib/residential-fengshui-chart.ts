import {
  generateResidentialFengshui,
  type ResidentialFengshuiInput,
  type ResidentialFengshuiResult,
} from 'mingyu-core/residential-fengshui';
import {
  getBaZhaiSitFacingFromDoorDegree,
  type BaZhaiDoorMeasurement,
  type BaZhaiResult,
} from 'mingyu-core/bazhai';
import type { SitFacingPosition } from 'mingyu-core/direction';
import type { XuanKongResult } from 'mingyu-core/xuankong';
import { LunarDay } from 'tyme4ts';

export type ResidentialMeasurement = BaZhaiDoorMeasurement;
export type ResidentialChartResult = ResidentialFengshuiResult;

export type ResidentialChartInput = {
  year?: number;
  month?: number;
  day?: number;
  gender?: 'male' | 'female';
  houseYear?: number;
  doorToInteriorDegree?: number;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  mingGua?: string;
  northReference?: ResidentialFengshuiInput['northReference'];
  magneticDeclinationDegrees?: number;
  measurementUncertaintyDegrees?: number;
  flowYear?: number;
  flowMonth?: number;
  flowDay?: number;
};

export type ResidentialBirthData = Pick<ResidentialChartInput, 'year' | 'month' | 'day' | 'gender'>;

export function resolveResidentialBirthDate(
  birth: Required<ResidentialBirthData>,
  dateType: 'solar' | 'lunar',
  isLeapMonth: boolean,
): Required<ResidentialBirthData> {
  if (dateType === 'solar') return birth;
  const solar = LunarDay.fromYmd(
    birth.year,
    isLeapMonth ? -birth.month : birth.month,
    birth.day,
  ).getSolarDay();
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    gender: birth.gender,
  };
}

/** 将网页或主体快照中的住宅资料统一整理为核心住宅输入。 */
export function buildResidentialChartInput(params: {
  birthData?: ResidentialBirthData | null;
  houseYear?: number;
  doorToInteriorDegree?: number;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  mingGua?: string;
  northReference?: ResidentialFengshuiInput['northReference'];
  magneticDeclinationDegrees?: number;
  measurementUncertaintyDegrees?: number;
  flowYear?: number;
  flowMonth?: number;
  flowDay?: number;
}): ResidentialChartInput {
  return {
    ...(params.birthData ?? {}),
    ...(params.houseYear != null ? { houseYear: params.houseYear } : {}),
    ...(params.doorToInteriorDegree != null
      ? { doorToInteriorDegree: params.doorToInteriorDegree }
      : {}),
    ...(params.sitMountain ? { sitMountain: params.sitMountain } : {}),
    ...(params.facingMountain ? { facingMountain: params.facingMountain } : {}),
    ...(params.facingDegree != null ? { facingDegree: params.facingDegree } : {}),
    ...(params.sitDegree != null ? { sitDegree: params.sitDegree } : {}),
    ...(params.mingGua ? { mingGua: params.mingGua } : {}),
    ...(params.northReference ? { northReference: params.northReference } : {}),
    ...(params.magneticDeclinationDegrees != null
      ? { magneticDeclinationDegrees: params.magneticDeclinationDegrees }
      : {}),
    ...(params.measurementUncertaintyDegrees != null
      ? { measurementUncertaintyDegrees: params.measurementUncertaintyDegrees }
      : {}),
    ...(params.flowYear != null ? { flowYear: params.flowYear } : {}),
    ...(params.flowMonth != null ? { flowMonth: params.flowMonth } : {}),
    ...(params.flowDay != null ? { flowDay: params.flowDay } : {}),
  };
}

export function buildResidentialCoreInput(
  params: Parameters<typeof buildResidentialChartInput>[0],
) {
  return toCoreInput(buildResidentialChartInput(params));
}

export function resolveResidentialDoorDirection(measuredDegree: number): SitFacingPosition {
  return getBaZhaiSitFacingFromDoorDegree(measuredDegree);
}

function toCoreInput(input: ResidentialChartInput): ResidentialFengshuiInput {
  return {
    ...(input.year != null ? { birthYear: input.year } : {}),
    ...(input.month != null ? { birthMonth: input.month } : {}),
    ...(input.day != null ? { birthDay: input.day } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.houseYear != null ? { year: input.houseYear } : {}),
    ...(input.doorToInteriorDegree != null
      ? { doorToInteriorDegree: input.doorToInteriorDegree }
      : {}),
    ...(input.sitMountain ? { sitMountain: input.sitMountain } : {}),
    ...(input.facingMountain ? { facingMountain: input.facingMountain } : {}),
    ...(input.facingDegree != null ? { facingDegree: input.facingDegree } : {}),
    ...(input.sitDegree != null ? { sitDegree: input.sitDegree } : {}),
    ...(input.mingGua ? { mingGua: input.mingGua } : {}),
    ...(input.northReference ? { northReference: input.northReference } : {}),
    ...(input.magneticDeclinationDegrees != null
      ? { magneticDeclinationDegrees: input.magneticDeclinationDegrees }
      : {}),
    ...(input.measurementUncertaintyDegrees != null
      ? { measurementUncertaintyDegrees: input.measurementUncertaintyDegrees }
      : {}),
    ...(input.flowYear != null ? { flowYear: input.flowYear } : {}),
    ...(input.flowMonth != null ? { flowMonth: input.flowMonth } : {}),
    ...(input.flowDay != null ? { flowDay: input.flowDay } : {}),
  };
}

export function calculateResidentialChart(input: ResidentialChartInput = {}): {
  result: ResidentialFengshuiResult;
  measurement: ResidentialMeasurement | null;
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
} {
  const result = generateResidentialFengshui(toCoreInput(input));
  const measurement =
    (result.bazhai as { directionMeasurement?: ResidentialMeasurement } | null)
      ?.directionMeasurement ?? null;
  return {
    result,
    measurement,
    bazhai: result.bazhai,
    xuankong: result.xuankong,
  };
}

/** @deprecated 使用 calculateResidentialChart；保留兼容旧调用 */
export function calculateResidentialBaseChart(birthData: {
  year: number;
  month: number;
  day: number;
  gender: 'male' | 'female';
  houseYear?: number;
}): ResidentialFengshuiResult {
  return calculateResidentialChart(birthData).result;
}
