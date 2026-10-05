/**
 * @file 月相与朔望时刻证据
 * @description 由日月地心黄经差确定月相，以球面角距和距离估算照明，并求取前后四正月相时刻。
 */
import * as AstronomyEngine from 'astronomy-engine';
import { getMoonPosition, getSunPosition } from '../astrology/engine';
import { MAX_FIXED_TIMEZONE_HOURS, MIN_FIXED_TIMEZONE_HOURS } from './civil-time';
import { calculateMoonGeometry } from './moon-geometry';

const astronomyNamespace = AstronomyEngine as unknown as Record<string, unknown>;
const Astronomy = (Reflect.get(astronomyNamespace, 'default') ??
  AstronomyEngine) as typeof AstronomyEngine;

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
  key: string;
  name: PrincipalMoonPhaseName;
  status: '已求根';
  targetAngleDegrees: number;
  utcTimestamp: number;
  utcDateTime: string;
  residualDegrees: number;
  refinementIterations: number;
  ownerFactKeys: string[];
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  calculation: string;
  limitation: '四正月相事件是日月地心黄经差对目标角度的数值求根结果；1秒求根区间不等于观测级精度，也不证明月食可见性、现实事件、吉凶或固定应期';
}

const PRINCIPAL_PHASE_METHOD = '平均朔望月29.530588861日初值与二分求根';

const PRINCIPAL_PHASE_LIMITATION =
  '四正月相事件是日月地心黄经差对目标角度的数值求根结果；1秒求根区间不等于观测级精度，也不证明月食可见性、现实事件、吉凶或固定应期' as const;

export interface MoonPhaseCalculationStep {
  key: string;
  stage: '日月位置' | '月相角与照明' | '前一四正相位' | '下一四正相位' | '当前四正相位';
  status: '已计算' | '已求根';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number>;
  result: Record<string, string | number>;
  promptText: string;
  sources: string[];
  limitation: '月相步骤只证明日月黄经、几何照明和前后四正相位求根如何形成；不得把求根区间解释为观测级精度、月食可见性或现实事件证据';
}

export interface MoonPhaseEventSummaryFact {
  key: 'moon-phase:event-summary';
  status: '已记录前后四正相位' | '已记录当前与前后四正相位';
  previousEventKey: string;
  nextEventKey: string;
  currentEventKey?: string;
  factKeys: string[];
  ownerFactKeys: string[];
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '事件汇总只说明当前时刻前后相邻的四正月相，不等于观测地点可见性、月食判断或现实应期';
}

export interface MoonPhaseLimitationFact {
  key: string;
  type: '平均月龄近似' | '几何照明近似' | '星历精度边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束月相角、照明比例、近似月龄与四正事件可以支持的解释范围，不得被反向当作月食、天气、吉凶或固定应期证据';
}

export interface MoonPhaseSummaryFact {
  key: 'moon-phase:evidence-summary';
  status: '证据链完整';
  factKeys: string[];
  calculationStepCount: number;
  principalEventCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '月相证据汇总只统计日月黄经、月相角、几何照明、前后四正事件与限制覆盖；不得按数量生成月相吉凶、月食可见性、可信度或现实应期';
}

export interface MoonPhaseEvidence {
  key: string;
  status: '已计算';
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
  currentPrincipalPhase?: PrincipalMoonPhaseEvent;
  method: string;
  source: string;
  calculationSteps: MoonPhaseCalculationStep[];
  calculationChain: string[];
  eventSummaryFact: MoonPhaseEventSummaryFact;
  summaryFact: MoonPhaseSummaryFact;
  limitations: string[];
  limitationFacts: MoonPhaseLimitationFact[];
  promptText: string;
}

const CALCULATION_STEP_LIMITATION =
  '月相步骤只证明日月黄经、几何照明和前后四正相位求根如何形成；不得把求根区间解释为观测级精度、月食可见性或现实事件证据' as const;
const EVENT_SUMMARY_LIMITATION =
  '事件汇总只说明当前时刻前后相邻的四正月相，不等于观测地点可见性、月食判断或现实应期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束月相角、照明比例、近似月龄与四正事件可以支持的解释范围，不得被反向当作月食、天气、吉凶或固定应期证据' as const;
const SUMMARY_FACT_LIMITATION =
  '月相证据汇总只统计日月黄经、月相角、几何照明、前后四正事件与限制覆盖；不得按数量生成月相吉凶、月食可见性、可信度或现实应期' as const;

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function signedDifference(value: number, target: number) {
  return ((value - target + 540) % 360) - 180;
}

function caelusPositionsAt(timestamp: number) {
  const julianDay = timestamp / 86400000 + 2440587.5;
  const sun = getSunPosition(julianDay);
  const moon = getMoonPosition(julianDay);
  const phaseAngle = normalizeDegrees(moon.longitude - sun.longitude);
  return {
    julianDay,
    sunLongitude: normalizeDegrees(sun.longitude),
    sunLatitude: sun.latitude,
    sunDistance: sun.distance,
    moonLongitude: normalizeDegrees(moon.longitude),
    moonLatitude: moon.latitude,
    moonDistance: moon.distance,
    phaseAngle,
  };
}

function qizhengPositionsAt(timestamp: number): ReturnType<typeof caelusPositionsAt> {
  const time = Astronomy.MakeTime(new Date(timestamp));
  const sun = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Sun, time, true));
  const moon = Astronomy.EclipticGeoMoon(time);
  const sunLongitude = normalizeDegrees(sun.elon);
  const moonLongitude = normalizeDegrees(moon.lon);
  return {
    julianDay: timestamp / 86400000 + 2440587.5,
    sunLongitude,
    sunLatitude: sun.elat,
    sunDistance: sun.vec.Length(),
    moonLongitude,
    moonLatitude: moon.lat,
    moonDistance: moon.dist,
    phaseAngle: normalizeDegrees(moonLongitude - sunLongitude),
  };
}

type MoonPhasePositionSource = {
  positionsAt: (timestamp: number) => ReturnType<typeof caelusPositionsAt>;
  name: string;
};

const CAELUS_SOURCE: MoonPhasePositionSource = {
  positionsAt: caelusPositionsAt,
  name: 'Caelus',
};

const QIZHENG_SOURCE: MoonPhasePositionSource = {
  positionsAt: qizhengPositionsAt,
  name: 'Astronomy Engine',
};

function refinePhaseEvent(
  estimatedTimestamp: number,
  phase: (typeof PRINCIPAL_PHASES)[number],
  calculationStepKeys: string[],
  source: MoonPhasePositionSource,
): PrincipalMoonPhaseEvent {
  let left = estimatedTimestamp - 2 * 86400000;
  let right = estimatedTimestamp + 2 * 86400000;
  let leftDifference = signedDifference(source.positionsAt(left).phaseAngle, phase.angle);
  const rightDifference = signedDifference(source.positionsAt(right).phaseAngle, phase.angle);
  if (Math.abs(leftDifference) > 90 || Math.abs(rightDifference) > 90) {
    throw new Error(`无法在预计窗口内稳定包围${phase.name}相位。`);
  }
  if (leftDifference * rightDifference > 0) {
    throw new Error(`预计窗口内未找到${phase.name}相位过零点。`);
  }

  let refinementIterations = 0;
  // 将求根区间缩至整秒舍入点以下，避免相邻查询把同一事件分到不同秒。
  while (right - left > 10 && refinementIterations < 64) {
    const middle = Math.round((left + right) / 2);
    const middleDifference = signedDifference(source.positionsAt(middle).phaseAngle, phase.angle);
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
    signedDifference(source.positionsAt(utcTimestamp).phaseAngle, phase.angle),
  );
  const utcDateTime = new Date(utcTimestamp).toISOString();
  const calculation = `以平均朔望月估计${phase.name}初值${new Date(estimatedTimestamp).toISOString()}，在前后各2日窗口内对日月地心黄经差=${phase.angle}°执行二分求根，迭代${refinementIterations}次后区间小于等于1秒`;
  return {
    key: `四正月相:${phase.name}:${utcTimestamp}`,
    name: phase.name,
    status: '已求根',
    targetAngleDegrees: phase.angle,
    utcTimestamp,
    utcDateTime,
    residualDegrees: Number(residualDegrees.toFixed(8)),
    refinementIterations,
    ownerFactKeys: calculationStepKeys,
    calculationStepKeys,
    promptText: `${phase.name}事件：UTC ${utcDateTime}，目标日月黄经差${phase.angle}°，求根残差${residualDegrees.toFixed(8)}°，迭代${refinementIterations}次`,
    sources: [`${source.name} 日月地心黄经`, PRINCIPAL_PHASE_METHOD],
    calculation,
    limitation: PRINCIPAL_PHASE_LIMITATION,
  };
}

function nearestPrincipalEvents(
  timestamp: number,
  phaseAngle: number,
  source: MoonPhasePositionSource,
) {
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
  let previousEvent = refinePhaseEvent(
    timestamp - (previous.backwardDegrees / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
    previous.phase,
    ['moon-phase:calculation:previous-principal'],
    source,
  );
  let nextEvent = refinePhaseEvent(
    timestamp + (next.forwardDegrees / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
    next.phase,
    ['moon-phase:calculation:next-principal'],
    source,
  );
  let currentEvent: PrincipalMoonPhaseEvent | undefined;
  const currentStepKey = 'moon-phase:calculation:current-principal';
  // 查询可精确到毫秒，四正事件按整秒呈现；黄经差反映的真实过零点可能
  // 落在该整秒的另一侧。以前后事件最终呈现的时间戳为准保持严格包围。
  if (previousEvent.utcTimestamp > timestamp) {
    nextEvent = {
      ...previousEvent,
      ownerFactKeys: ['moon-phase:calculation:next-principal'],
      calculationStepKeys: ['moon-phase:calculation:next-principal'],
    };
    const phaseIndex = PRINCIPAL_PHASES.indexOf(previous.phase);
    const priorPhase = PRINCIPAL_PHASES[(phaseIndex + 3) % PRINCIPAL_PHASES.length];
    previousEvent = refinePhaseEvent(
      timestamp - (90 / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
      priorPhase,
      ['moon-phase:calculation:previous-principal'],
      source,
    );
  } else if (nextEvent.utcTimestamp < timestamp) {
    previousEvent = {
      ...nextEvent,
      ownerFactKeys: ['moon-phase:calculation:previous-principal'],
      calculationStepKeys: ['moon-phase:calculation:previous-principal'],
    };
    const phaseIndex = PRINCIPAL_PHASES.indexOf(next.phase);
    const followingPhase = PRINCIPAL_PHASES[(phaseIndex + 1) % PRINCIPAL_PHASES.length];
    nextEvent = refinePhaseEvent(
      timestamp + (90 / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
      followingPhase,
      ['moon-phase:calculation:next-principal'],
      source,
    );
  }
  if (previousEvent.utcTimestamp === timestamp) {
    currentEvent = {
      ...previousEvent,
      ownerFactKeys: [currentStepKey],
      calculationStepKeys: [currentStepKey],
    };
    const phaseIndex = PRINCIPAL_PHASES.indexOf(previous.phase);
    const priorPhase = PRINCIPAL_PHASES[(phaseIndex + 3) % PRINCIPAL_PHASES.length];
    previousEvent = refinePhaseEvent(
      timestamp - (90 / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
      priorPhase,
      ['moon-phase:calculation:previous-principal'],
      source,
    );
  } else if (nextEvent.utcTimestamp === timestamp) {
    currentEvent = {
      ...nextEvent,
      ownerFactKeys: [currentStepKey],
      calculationStepKeys: [currentStepKey],
    };
    const phaseIndex = PRINCIPAL_PHASES.indexOf(next.phase);
    const followingPhase = PRINCIPAL_PHASES[(phaseIndex + 1) % PRINCIPAL_PHASES.length];
    nextEvent = refinePhaseEvent(
      timestamp + (90 / MEAN_PHASE_SPEED_DEGREES_PER_DAY) * 86400000,
      followingPhase,
      ['moon-phase:calculation:next-principal'],
      source,
    );
  }
  return { previous: previousEvent, next: nextEvent, current: currentEvent };
}

function calculateMoonPhaseEvidenceWithSource(
  utcTimestamp: number,
  positionSource: MoonPhasePositionSource,
): MoonPhaseEvidence {
  if (!Number.isFinite(utcTimestamp)) throw new Error('月相证据需要有效的 UTC 时间戳。');
  // 当地 1900–2200 年钟表按合法 UTC 偏移换算，可进入相邻 UTC 年。
  const firstUtcTimestamp = Date.UTC(1900, 0, 1) - MAX_FIXED_TIMEZONE_HOURS * 3_600_000;
  const lastUtcTimestampExclusive = Date.UTC(2201, 0, 1) - MIN_FIXED_TIMEZONE_HOURS * 3_600_000;
  if (utcTimestamp < firstUtcTimestamp || utcTimestamp >= lastUtcTimestampExclusive) {
    throw new Error('月相证据需对应 1900-2200 年的当地钟表范围。');
  }

  const positions = positionSource.positionsAt(utcTimestamp);
  const phaseAngleDegrees = positions.phaseAngle;
  const { elongationDegrees, illuminationFraction } = calculateMoonGeometry(positions);
  const eightPhaseIndex = Math.floor((phaseAngleDegrees + 22.5) / 45) % 8;
  const eightPhaseName = EIGHT_PHASE_NAMES[eightPhaseIndex];
  const waxing = phaseAngleDegrees < 180;
  const approximateMoonAgeDays = (phaseAngleDegrees / 360) * SYNODIC_MONTH_DAYS;
  const events = nearestPrincipalEvents(utcTimestamp, phaseAngleDegrees, positionSource);
  const method =
    '以日月地心黄经差计算 0-360° 月相角；以日月地心黄经、黄纬和距离计算球面角距及月面照明比例；前后朔弦望按平均朔望月估计初值后二分求根至 1 秒区间';
  const source = `日月地心黄经、黄纬和距离由 ${positionSource.name} 星历计算；朔望月均值采用 29.530588861 日`;
  const principalPhaseSources = [`${positionSource.name} 日月地心黄经`, PRINCIPAL_PHASE_METHOD];
  const limitations = [
    '月龄由相位角按平均朔望月线性换算，只是便于理解的近似值，不等于从真实朔时刻起算的严格月龄。',
    '照明比例采用地心几何近似，未加入地形、视差、大气和观测地点条件；不得用于月食可见性判断。',
    '求根到 1 秒只表示数值区间，实际精度仍受底层日月星历模型限制，不宣称达到 JPL 或观测级精度。',
  ];
  const utcDateTime = new Date(utcTimestamp).toISOString();
  const previousEventKey = events.previous.key;
  const nextEventKey = events.next.key;
  const currentEventKey = events.current?.key;
  const calculationSteps: MoonPhaseCalculationStep[] = [
    {
      key: 'moon-phase:calculation:positions',
      stage: '日月位置',
      status: '已计算',
      dependsOnStepKeys: [],
      inputs: { utcTimestamp, utcDateTime },
      result: {
        julianDayUtc: Number(positions.julianDay.toFixed(9)),
        sunLongitudeDegrees: Number(positions.sunLongitude.toFixed(8)),
        sunLatitudeDegrees: Number(positions.sunLatitude.toFixed(8)),
        sunDistanceAu: Number(positions.sunDistance.toFixed(8)),
        moonLongitudeDegrees: Number(positions.moonLongitude.toFixed(8)),
        moonLatitudeDegrees: Number(positions.moonLatitude.toFixed(8)),
        moonDistanceAu: Number(positions.moonDistance.toFixed(8)),
      },
      promptText: `UTC ${utcDateTime} 的地心黄经、黄纬：太阳${positions.sunLongitude.toFixed(6)}°、${positions.sunLatitude.toFixed(6)}°；月亮${positions.moonLongitude.toFixed(6)}°、${positions.moonLatitude.toFixed(6)}°`,
      sources: [`${positionSource.name} 日月地心黄经、黄纬和距离`],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'moon-phase:calculation:angle-illumination',
      stage: '月相角与照明',
      status: '已计算',
      dependsOnStepKeys: ['moon-phase:calculation:positions'],
      inputs: {
        sunLongitudeDegrees: Number(positions.sunLongitude.toFixed(8)),
        moonLongitudeDegrees: Number(positions.moonLongitude.toFixed(8)),
        sunLatitudeDegrees: Number(positions.sunLatitude.toFixed(8)),
        moonLatitudeDegrees: Number(positions.moonLatitude.toFixed(8)),
        sunDistanceAu: Number(positions.sunDistance.toFixed(8)),
        moonDistanceAu: Number(positions.moonDistance.toFixed(8)),
      },
      result: {
        phaseAngleDegrees: Number(phaseAngleDegrees.toFixed(8)),
        elongationDegrees: Number(elongationDegrees.toFixed(8)),
        illuminationPercent: Number((illuminationFraction * 100).toFixed(3)),
        approximateMoonAgeDays: Number(approximateMoonAgeDays.toFixed(4)),
      },
      promptText: `由日月地心黄经差${phaseAngleDegrees.toFixed(6)}°判定${eightPhaseName}、${waxing ? '盈' : '亏'}；日月球面角距${elongationDegrees.toFixed(6)}°，月面照明${(illuminationFraction * 100).toFixed(3)}%`,
      sources: ['日月黄经差定义', '日月球面角距与月面照明几何公式'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'moon-phase:calculation:previous-principal',
      stage: '前一四正相位',
      status: '已求根',
      dependsOnStepKeys: ['moon-phase:calculation:angle-illumination'],
      inputs: { utcTimestamp, phaseAngleDegrees },
      result: { eventKey: previousEventKey, utcDateTime: events.previous.utcDateTime },
      promptText: `以前一相邻目标角度${events.previous.targetAngleDegrees}°为初值，二分求根得到${events.previous.name} ${events.previous.utcDateTime}`,
      sources: [...principalPhaseSources],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'moon-phase:calculation:next-principal',
      stage: '下一四正相位',
      status: '已求根',
      dependsOnStepKeys: ['moon-phase:calculation:angle-illumination'],
      inputs: { utcTimestamp, phaseAngleDegrees },
      result: { eventKey: nextEventKey, utcDateTime: events.next.utcDateTime },
      promptText: `以后一相邻目标角度${events.next.targetAngleDegrees}°为初值，二分求根得到${events.next.name} ${events.next.utcDateTime}`,
      sources: [...principalPhaseSources],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  if (events.current) {
    calculationSteps.push({
      key: 'moon-phase:calculation:current-principal',
      stage: '当前四正相位',
      status: '已求根',
      dependsOnStepKeys: ['moon-phase:calculation:angle-illumination'],
      inputs: { utcTimestamp, phaseAngleDegrees },
      result: { eventKey: events.current.key, utcDateTime: events.current.utcDateTime },
      promptText: `参考时刻与${events.current.name}的整秒求根时刻相同：${events.current.utcDateTime}`,
      sources: [...principalPhaseSources],
      limitation: CALCULATION_STEP_LIMITATION,
    });
  }
  const eventSummaryFact: MoonPhaseEventSummaryFact = {
    key: 'moon-phase:event-summary',
    status: events.current ? '已记录当前与前后四正相位' : '已记录前后四正相位',
    previousEventKey,
    nextEventKey,
    ...(currentEventKey ? { currentEventKey } : {}),
    factKeys: [
      previousEventKey,
      nextEventKey,
      ...(currentEventKey ? [currentEventKey, 'moon-phase:calculation:current-principal'] : []),
      'moon-phase:calculation:previous-principal',
      'moon-phase:calculation:next-principal',
    ],
    ownerFactKeys: [
      'moon-phase:calculation:previous-principal',
      'moon-phase:calculation:next-principal',
      ...(currentEventKey ? ['moon-phase:calculation:current-principal'] : []),
    ],
    calculationStepKeys: [
      'moon-phase:calculation:previous-principal',
      'moon-phase:calculation:next-principal',
      ...(currentEventKey ? ['moon-phase:calculation:current-principal'] : []),
    ],
    promptText: `${events.current ? `当前四正相位为${events.current.name}（${events.current.utcDateTime}），` : ''}前一四正相位为${events.previous.name}（${events.previous.utcDateTime}），下一四正相位为${events.next.name}（${events.next.utcDateTime}）`,
    sources: [...principalPhaseSources],
    limitation: EVENT_SUMMARY_LIMITATION,
  };
  const limitationFacts: MoonPhaseLimitationFact[] = [
    {
      key: 'moon-phase:limitation:mean-age',
      type: '平均月龄近似',
      status: '适用',
      ownerFactKeys: ['moon-phase:calculation:angle-illumination'],
      ownerStepKeys: ['moon-phase:calculation:angle-illumination'],
      promptText: limitations[0],
      sources: ['平均朔望月 29.530588861 日'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'moon-phase:limitation:illumination',
      type: '几何照明近似',
      status: '适用',
      ownerFactKeys: ['moon-phase:calculation:angle-illumination'],
      ownerStepKeys: ['moon-phase:calculation:angle-illumination'],
      promptText: limitations[1],
      sources: ['月相照明几何公式'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'moon-phase:limitation:ephemeris',
      type: '星历精度边界',
      status: '适用',
      ownerFactKeys: [
        'moon-phase:calculation:positions',
        'moon-phase:calculation:previous-principal',
        'moon-phase:calculation:next-principal',
      ],
      ownerStepKeys: [
        'moon-phase:calculation:positions',
        'moon-phase:calculation:previous-principal',
        'moon-phase:calculation:next-principal',
      ],
      promptText: limitations[2],
      sources: [`${positionSource.name} 日月星历模型`, '二分求根区间说明'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
  ];
  const summaryFact: MoonPhaseSummaryFact = {
    key: 'moon-phase:evidence-summary',
    status: '证据链完整',
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      events.previous.key,
      events.next.key,
      ...(events.current ? [events.current.key] : []),
      eventSummaryFact.key,
      ...limitationFacts.map((item) => item.key),
    ],
    calculationStepCount: calculationSteps.length,
    principalEventCount: events.current ? 3 : 2,
    limitationFactCount: limitationFacts.length,
    promptText: `月相证据链记录计算步骤${calculationSteps.length}项、四正事件${events.current ? 3 : 2}项、限制${limitationFacts.length}项`,
    sources: ['日月黄经、月相角照明、前后四正事件与限制事实汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };

  return {
    key: `moon-phase:${utcTimestamp}`,
    status: '已计算',
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
    ...(events.current ? { currentPrincipalPhase: events.current } : {}),
    method,
    source,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    eventSummaryFact,
    summaryFact,
    limitations,
    limitationFacts,
    promptText: `月相证据：UTC ${utcDateTime} 日月黄经差${phaseAngleDegrees.toFixed(3)}°，日月球面角距${elongationDegrees.toFixed(3)}°，${eightPhaseName}、${waxing ? '盈' : '亏'}，照明约${(illuminationFraction * 100).toFixed(1)}%，近似月龄${approximateMoonAgeDays.toFixed(2)}日；计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}；${events.current ? `当前四正相位：${events.current.promptText}；` : ''}前一四正相位：${events.previous.promptText}；下一四正相位：${events.next.promptText}；事件汇总：${eventSummaryFact.promptText}；证据汇总：${summaryFact.promptText}；四正事件统一边界：${PRINCIPAL_PHASE_LIMITATION}。方法：${method}。来源：${source}。限制：${limitations.join('；')}`,
  };
}

export function calculateMoonPhaseEvidence(utcTimestamp: number): MoonPhaseEvidence {
  const year = new Date(utcTimestamp).getUTCFullYear();
  if (year < 1900 || year > 2200) throw new Error('月相证据当前支持 1900-2200 年。');
  return calculateMoonPhaseEvidenceWithSource(utcTimestamp, CAELUS_SOURCE);
}

/** 已解析的当地钟表瞬时复用 Caelus 月相位置与四正求根。 */
export function calculateCivilMoonPhaseEvidence(utcTimestamp: number): MoonPhaseEvidence {
  return calculateMoonPhaseEvidenceWithSource(utcTimestamp, CAELUS_SOURCE);
}

/** 七政的月相与日月星曜共用同一瞬时、同一星历位置和时间尺度。 */
export function calculateQizhengMoonPhaseEvidence(utcTimestamp: number): MoonPhaseEvidence {
  return calculateMoonPhaseEvidenceWithSource(utcTimestamp, QIZHENG_SOURCE);
}
