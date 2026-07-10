import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
  type BaZhaiDoorMeasurement,
  type BaZhaiResult,
} from '@core/ba_zhai';
import type { SitFacingPosition } from '@core/direction';

export type BazhaiMeasurement = BaZhaiDoorMeasurement;

export function resolveBazhaiDoorDirection(measuredDegree: number): SitFacingPosition {
  return getBaZhaiSitFacingFromDoorDegree(measuredDegree);
}

export function calculateBazhaiBaseChart(birthData: {
  year: number;
  month: number;
  day: number;
  gender: 'male' | 'female';
}): BaZhaiResult {
  return analyzeBaZhai({
    birthYear: birthData.year,
    birthMonth: birthData.month,
    birthDay: birthData.day,
    gender: birthData.gender,
  });
}

export function calculateBazhaiChart(
  birthData: { year: number; month: number; day: number; gender: 'male' | 'female' },
  measuredDegree: number,
): { result: BaZhaiResult; measurement: BazhaiMeasurement } {
  const completeResult = analyzeBaZhaiByDoorDegree({
    birthYear: birthData.year,
    birthMonth: birthData.month,
    birthDay: birthData.day,
    gender: birthData.gender,
    doorToInteriorDegree: measuredDegree,
  });
  const { directionMeasurement, ...result } = completeResult;
  return {
    result,
    measurement: directionMeasurement,
  };
}
