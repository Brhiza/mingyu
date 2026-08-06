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
};

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
