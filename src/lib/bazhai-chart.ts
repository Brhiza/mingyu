import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
  rebuildAuditedBaZhaiData,
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
  return rebuildAuditedBaZhaiData(
    analyzeBaZhai({
      birthYear: birthData.year,
      birthMonth: birthData.month,
      birthDay: birthData.day,
      gender: birthData.gender,
    }),
  );
}

export function calculateBazhaiChart(
  birthData: { year: number; month: number; day: number; gender: 'male' | 'female' },
  measuredDegree: number,
): { result: BaZhaiResult; measurement: BazhaiMeasurement } {
  const completeResult = rebuildAuditedBaZhaiData(
    analyzeBaZhaiByDoorDegree({
      birthYear: birthData.year,
      birthMonth: birthData.month,
      birthDay: birthData.day,
      gender: birthData.gender,
      doorToInteriorDegree: measuredDegree,
    }),
  );
  if (!('directionMeasurement' in completeResult)) {
    throw new Error('八宅门向审核重建未返回测量资料。');
  }
  const { directionMeasurement, ...result } = completeResult;
  return {
    result,
    measurement: directionMeasurement,
  };
}
