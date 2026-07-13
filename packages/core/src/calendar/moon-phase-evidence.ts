/**
 * @file 月相与朔望时刻证据
 * @description 由日月地心黄经差计算月相角、照明比例，并求取前后四正月相时刻。
 */
import { getMoonPosition, getSunPosition } from 'celestine';

const SYNODIC_MONTH_DAYS = 29.530588861;
const MEAN_PHASE_SPEED_DEGREES_PER_DAY = 360 / SYNODIC_MONTH_DAYS;

const PRINCIPAL_PHASES = [
  { angle: 0, name: '朔' },
  { angle: 90, name: '上弦' },
  { angle: 180, name: '望' },
  { angle: 270, name: '下弦' },
] as const;

const EIGHT_PHASE_NAMES = [
  '新月',
  '蛾眉月',
  '上弦月',
  '盈凸月',
  '满月',
  '亏凸月',
  '下弦月',
  '残月',
] as const;

export type PrincipalMoonPhaseName = (typeof PRINCIPAL_PHASES)[number]['name'];
export type EightMoonPhaseName = (typeof EIGHT_PHASE_NAMES)[number];

export interface PrincipalMoonPhaseEvent {
  name: PrincipalMoonPhaseName;
  targetAngleDegrees: number;
  utcTimestamp: number;
  utcDateTime: string;
  residualDegrees: number;
  refinementIterations: number;
}

export interface MoonPhaseEvidence {
  utcTimestamp: number;
  utcDateTime: string;
  julianDayUtc: number;
  sunLongitudeDegrees: number;
  moonLongitudeDegrees: number;
  phaseAngleDegrees: number;
  elongationDegrees: number;
  illuminationFraction: number;
  illuminationPercent: number;
  waxing: boolean;
  eightPhaseName: EightMoonPhaseName;
  approximateMoonAgeDays: number;
  previousPrincipalPhase: PrincipalMoonPhaseEvent;
  nextPrincipalPhase: PrincipalMoonPhaseEvent;
  method: string;
  source: string;
  limitations: string[];
  promptText: string;
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function signedDifference(value: number, target: number) {
  return ((value - target + 540) % 360) - 180;
}

function positionsAt(timestamp: number) {
  const julianDay = timestamp / 86400000 + 2440587.5;
  const sun = getSunPosition(julianDay);
  const moon = getMoonPosition(julianDay);
  const phaseAngle = normalizeDegrees(moon.longitude - sun.longitude);
  return {
    julianDay,
    sunLongitude: normalizeDegrees(sun.longitude),
    moonLongitude: normalizeDegrees(moon.longitude),
    phaseAngle,
  };
}

function refinePhaseEvent(
  estimatedTimestamp: number,
  phase: (typeof PRINCIPAL_PHASES)[number],
): PrincipalMoonPhaseEvent {
  let left = estimatedTimestamp - 2 * 86400000;
  let right = estimatedTimestamp + 2 * 86400000;
  let leftDifference = signedDifference(positionsAt(left).phaseAngle, phase.angle);
  const rightDifference = signedDifference(positionsAt(right).phaseAngle, phase.angle);
  if (Math.abs(leftDifference) > 90 || Math.abs(rightDifference) > 90) {
    throw new Error(`无法在预计窗口内稳定包围${phase.name}相位。`);
  }
  if (leftDifference * rightDifference > 0) {
    throw new Error(`预计窗口内未找到${phase.name}相位过零点。`);
  }

  let refinementIterations = 0;
  while (right - left > 1000 && refinementIterations < 64) {
    const middle = Math.round((left + right) / 2);
    const middleDifference = signedDifference(positionsAt(middle).phaseAngle, phase.angle);
    if (leftDifference * middleDifference <= 0) {
      right = middle;
    } else {
      left = middle;
      leftDifference = middleDifference;
    }
    refinementIterations += 1;
  }

  const utcTimestamp = Math.round((left + right) / 2 / 1000) * 1000;
  const residualDegrees = Math.abs(
    signedDifference(positionsAt(utcTimestamp).phaseAngle, phase.angle),
  );
  return {
    name: phase.name,
    targetAngleDegrees: phase.angle,
    utcTimestamp,
    utcDateTime: new Date(utcTimestamp).toISOString(),
    residualDegrees: Number(residualDegrees.toFixed(8)),
    refinementIterations,
  };
}

function nearestPrincipalEvents(timestamp: number, phaseAngle: number) {
  const candidates = PRINCIPAL_PHASES.map((phase) => {
    const forwardDegrees = normalizeDegrees(phase.angle - phaseAngle);
    const backwardDegrees = normalizeDegrees(phaseAngle - phase.angle);
    return {
      phase,
      forwardDegrees: forwardDegrees < 1e-8 ? 360 : forwardDegrees,
      backwardDegrees: backwardDegrees < 1e-8 ? 360 : backwardDegrees,
    };
  });
  const previous = candidates.reduce((best, item) =>
    item.backwardDegrees < best.backwardDegrees ? item : best,
  );
  const next = candidates.reduce((best, item) =>
    item.forwardDegrees < best.forwardDegrees ? item : best,
  );
  return {
    previous: refinePhaseEvent(
      timestamp - (previous.backwardDegrees / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
      previous.phase,
    ),
    next: refinePhaseEvent(
      timestamp + (next.forwardDegrees / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
      next.phase,
    ),
  };
}

export function calculateMoonPhaseEvidence(utcTimestamp: number): MoonPhaseEvidence {
  if (!Number.isFinite(utcTimestamp)) throw new Error('月相证据需要有效的 UTC 时间戳。');
  const year = new Date(utcTimestamp).getUTCFullYear();
  if (year < 1900 || year > 2200) throw new Error('月相证据当前支持 1900-2200 年。');

  const positions = positionsAt(utcTimestamp);
  const phaseAngleDegrees = positions.phaseAngle;
  const elongationDegrees = phaseAngleDegrees <= 180 ? phaseAngleDegrees : 360 - phaseAngleDegrees;
  const illuminationFraction = (1 - Math.cos((phaseAngleDegrees * Math.PI) / 180)) / 2;
  const eightPhaseIndex = Math.floor((phaseAngleDegrees + 22.5) / 45) % 8;
  const eightPhaseName = EIGHT_PHASE_NAMES[eightPhaseIndex];
  const waxing = phaseAngleDegrees < 180;
  const approximateMoonAgeDays = (phaseAngleDegrees / 360) * SYNODIC_MONTH_DAYS;
  const events = nearestPrincipalEvents(utcTimestamp, phaseAngleDegrees);
  const method =
    '以日月地心黄经差计算 0-360° 月相角；照明比例采用 (1-cos相位角)/2；前后朔弦望按平均朔望月估计初值后二分求根至 1 秒区间';
  const source = '日月黄经由 celestine 星历计算；朔望月均值采用 29.530588861 日';
  const limitations = [
    '月龄由相位角按平均朔望月线性换算，只是便于理解的近似值，不等于从真实朔时刻起算的严格月龄。',
    '照明比例采用几何近似，未加入地形、视差、大气和观测地点条件；不得用于月食可见性判断。',
    '求根到 1 秒只表示数值区间，实际精度仍受底层日月星历模型限制，不宣称达到 JPL 或观测级精度。',
  ];
  const utcDateTime = new Date(utcTimestamp).toISOString();

  return {
    utcTimestamp,
    utcDateTime,
    julianDayUtc: Number(positions.julianDay.toFixed(9)),
    sunLongitudeDegrees: Number(positions.sunLongitude.toFixed(8)),
    moonLongitudeDegrees: Number(positions.moonLongitude.toFixed(8)),
    phaseAngleDegrees: Number(phaseAngleDegrees.toFixed(8)),
    elongationDegrees: Number(elongationDegrees.toFixed(8)),
    illuminationFraction: Number(illuminationFraction.toFixed(8)),
    illuminationPercent: Number((illuminationFraction * 100).toFixed(3)),
    waxing,
    eightPhaseName,
    approximateMoonAgeDays: Number(approximateMoonAgeDays.toFixed(4)),
    previousPrincipalPhase: events.previous,
    nextPrincipalPhase: events.next,
    method,
    source,
    limitations,
    promptText: `月相证据：UTC ${utcDateTime} 日月黄经差${phaseAngleDegrees.toFixed(3)}°，最小距角${elongationDegrees.toFixed(3)}°，${eightPhaseName}、${waxing ? '盈' : '亏'}，照明约${(illuminationFraction * 100).toFixed(1)}%，近似月龄${approximateMoonAgeDays.toFixed(2)}日；前一四正相位为${events.previous.name} ${events.previous.utcDateTime}，下一四正相位为${events.next.name} ${events.next.utcDateTime}。方法：${method}。来源：${source}。限制：${limitations.join('；')}`,
  };
}
