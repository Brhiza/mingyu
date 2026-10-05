import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
  type BaZhaiDoorMeasurement,
  type BaZhaiResult,
} from 'mingyu-core/bazhai';
import type { SitFacingPosition } from 'mingyu-core/direction';

export type BazhaiMeasurement = BaZhaiDoorMeasurement;

export function resolveBazhaiDoorDirection(measuredDegree: number): SitFacingPosition {
  return getBaZhaiSitFacingFromDoorDegree(measuredDegree);
}

export function calculateBazhaiBaseChart(birthData: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  timezone?: number;
  timeZoneId?: string;
  gender: 'male' | 'female';
}): BaZhaiResult {
  return analyzeBaZhai({
    birthYear: birthData.year,
    birthMonth: birthData.month,
    birthDay: birthData.day,
    birthHour: birthData.hour,
    birthMinute: birthData.minute,
    birthTimezone: birthData.timezone,
    birthTimeZoneId: birthData.timeZoneId,
    gender: birthData.gender,
  });
}

export function calculateBazhaiChart(
  birthData: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    timezone?: number;
    timeZoneId?: string;
    gender: 'male' | 'female';
  },
  measuredDegree: number,
): { result: BaZhaiResult; measurement: BazhaiMeasurement } {
  const completeResult = analyzeBaZhaiByDoorDegree({
    birthYear: birthData.year,
    birthMonth: birthData.month,
    birthDay: birthData.day,
    birthHour: birthData.hour,
    birthMinute: birthData.minute,
    birthTimezone: birthData.timezone,
    birthTimeZoneId: birthData.timeZoneId,
    gender: birthData.gender,
    doorToInteriorDegree: measuredDegree,
  });
  const { directionMeasurement, ...result } = completeResult;
  return {
    result,
    measurement: directionMeasurement,
  };
}
