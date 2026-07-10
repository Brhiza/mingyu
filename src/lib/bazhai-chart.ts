import { analyzeBaZhai, type BaZhaiResult } from '@core/ba_zhai';
import { getSitFacingFromFacingDegree, type SitFacingPosition } from '@core/direction';

export interface BazhaiMeasurement {
  method: string;
  measuredDegree: number;
  facingDegree: number;
  facingMountain: string;
  sitDegree: number;
  sitMountain: string;
  label: string;
  promptText: string;
}

export function resolveBazhaiDoorDirection(measuredDegree: number): SitFacingPosition {
  if (!Number.isFinite(measuredDegree) || measuredDegree < 0 || measuredDegree > 360) {
    throw new Error('大门朝向屋内的度数应填写 0 至 360 之间的数字。');
  }
  return getSitFacingFromFacingDegree((measuredDegree + 180) % 360);
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
  const { facing, sit, label } = resolveBazhaiDoorDirection(measuredDegree);
  if (facing.isBoundary) {
    const mountains = facing.boundaryMountains?.join('向与') ?? '两个二十四山';
    throw new Error(`当前度数正好位于${mountains}向的分界线，请重新测量。`);
  }
  const result = analyzeBaZhai({
    birthYear: birthData.year,
    birthMonth: birthData.month,
    birthDay: birthData.day,
    gender: birthData.gender,
    sitMountain: sit.mountain,
  });
  return {
    result,
    measurement: {
      method: '站在大门处面向屋内测量',
      measuredDegree,
      facingDegree: facing.degree,
      facingMountain: facing.mountain,
      sitDegree: sit.degree,
      sitMountain: sit.mountain,
      label,
      promptText: `测量方式：站在大门处面向屋内，指南针读数为 ${measuredDegree}°。换算后住宅坐山 ${sit.degree}° 为${sit.mountain}山，传统朝向 ${facing.degree}° 为${facing.mountain}向，结果为${label}。`,
    },
  };
}
