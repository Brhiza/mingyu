/**
 * @file 二十四节气交接时刻证据
 * @description 以 tyme4ts 节气表提供初值，再按太阳回归黄经每 15° 的定义细化交节时刻。
 */
import { SolarTerm } from 'tyme4ts';

const TERM_NAMES = [
  '冬至',
  '小寒',
  '大寒',
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
] as const;

export type SolarTermName = (typeof TERM_NAMES)[number];

export interface SolarTermCalculationStep {
  key: string;
  stage: '目标黄经' | '历表时刻' | '独立求根' | '差值核验';
  status: '已计算' | '已采用';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number>;
  result: Record<string, string | number | boolean>;
  promptText: string;
  sources: string[];
  limitation: '节气计算步骤只证明目标黄经、采用历表、低阶模型求根和两者差值如何形成；不得把二分区间或输出小数位解释为观测级精度';
}

export interface SolarTermVerificationFact {
  key: string;
  status: '已记录差值';
  adoptedStepKey: string;
  modelStepKey: string;
  seedDifferenceSeconds: number;
  promptText: string;
  sources: string[];
  limitation: '独立模型差值只用于核验采用历表没有明显偏离节气定义；不得用低阶模型覆盖采用历表，也不得据差值生成可信度百分比';
}

export interface SolarTermLimitationFact {
  key: string;
  type: '数值求根精度' | '星历模型边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束节气历表与独立太阳黄经核验可以支持的精度声明，不得被反向当作现实事件、吉凶或应期证据';
}

export interface SolarTermSummaryFact {
  key: string;
  status: '历表已采用并完成独立核验';
  factKeys: string[];
  calculationStepCount: number;
  verificationFactCount: 1;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '节气证据汇总只统计目标黄经、采用历表、独立低阶模型求根、差值核验与限制覆盖；不得按差值大小或数值位数生成可信度百分比、观测精度声明、现实吉凶或固定应期';
}

export interface SolarTermEvidence {
  key: string;
  status: '历表已采用并独立核验';
  name: SolarTermName;
  index: number;
  isJie: boolean;
  targetLongitudeDegrees: number;
  utcTimestamp: number;
  utcDateTime: string;
  julianDayUtc: number;
  modelRootUtcTimestamp: number;
  modelRootUtcDateTime: string;
  solarLongitudeDegrees: number;
  residualDegrees: number;
  seedUtcDateTime: string;
  seedDifferenceSeconds: number;
  searchWindowHours: number;
  refinementToleranceSeconds: number;
  refinementIterations: number;
  method: string;
  source: string;
  calculationSteps: SolarTermCalculationStep[];
  calculationChain: string[];
  verificationFact: SolarTermVerificationFact;
  summaryFact: SolarTermSummaryFact;
  limitations: string[];
  limitationFacts: SolarTermLimitationFact[];
  promptText: string;
}

const CALCULATION_STEP_LIMITATION =
  '节气计算步骤只证明目标黄经、采用历表、低阶模型求根和两者差值如何形成；不得把二分区间或输出小数位解释为观测级精度' as const;
const VERIFICATION_FACT_LIMITATION =
  '独立模型差值只用于核验采用历表没有明显偏离节气定义；不得用低阶模型覆盖采用历表，也不得据差值生成可信度百分比' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束节气历表与独立太阳黄经核验可以支持的精度声明，不得被反向当作现实事件、吉凶或应期证据' as const;
const SUMMARY_FACT_LIMITATION =
  '节气证据汇总只统计目标黄经、采用历表、独立低阶模型求根、差值核验与限制覆盖；不得按差值大小或数值位数生成可信度百分比、观测精度声明、现实吉凶或固定应期' as const;

function normalizeLongitude(value: number) {
  return ((value % 360) + 360) % 360;
}

function signedDifference(value: number, target: number) {
  return ((value - target + 540) % 360) - 180;
}

/** Meeus/NOAA 太阳视黄经低阶公式；用于节气过零求根，不包装成观测级星历。 */
function apparentSunLongitudeAt(utcTimestamp: number) {
  const julianDay = utcTimestamp / 86400000 + 2440587.5;
  const t = (julianDay - 2451545) / 36525;
  const geometricMeanLongitude = normalizeLongitude(
    280.46646 + 36000.76983 * t + 0.0003032 * t ** 2,
  );
  const meanAnomaly = normalizeLongitude(
    357.52911 + 35999.05029 * t - 0.0001537 * t ** 2 + t ** 3 / 24490000,
  );
  const anomalyRadians = (meanAnomaly * Math.PI) / 180;
  const equationOfCenter =
    (1.914602 - 0.004817 * t - 0.000014 * t ** 2) * Math.sin(anomalyRadians) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * anomalyRadians) +
    0.000289 * Math.sin(3 * anomalyRadians);
  const trueLongitude = geometricMeanLongitude + equationOfCenter;
  const omega = ((125.04 - 1934.136 * t) * Math.PI) / 180;
  return normalizeLongitude(trueLongitude - 0.00569 - 0.00478 * Math.sin(omega));
}

function tymeSeedUtc(year: number, index: number) {
  const time = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
  // tyme4ts 的节气民用时刻采用中国标准时表达；转成 UTC 仅用于求根初值。
  return (
    Date.UTC(
      time.getYear(),
      time.getMonth() - 1,
      time.getDay(),
      time.getHour(),
      time.getMinute(),
      time.getSecond(),
    ) -
    8 * 3600000
  );
}

export function calculateSolarTermEvidence(year: number, index: number): SolarTermEvidence {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error('节气证据年份需在 1900-2200 之间。');
  }
  if (!Number.isInteger(index) || index < 0 || index > 23) {
    throw new Error('节气索引需为 0-23 的整数。');
  }

  const name = TERM_NAMES[index];
  const targetLongitudeDegrees = normalizeLongitude(270 + index * 15);
  const seedTimestamp = tymeSeedUtc(year, index);
  const searchWindowHours = 18;
  let left = seedTimestamp - searchWindowHours * 3600000;
  let right = seedTimestamp + searchWindowHours * 3600000;
  let leftDifference = signedDifference(apparentSunLongitudeAt(left), targetLongitudeDegrees);
  const rightDifference = signedDifference(apparentSunLongitudeAt(right), targetLongitudeDegrees);
  if (leftDifference === 0) right = left;
  else if (rightDifference !== 0 && leftDifference * rightDifference > 0) {
    throw new Error(`${year}年${name}初值附近未找到太阳黄经过零区间。`);
  }

  const refinementToleranceSeconds = 1;
  let refinementIterations = 0;
  while (right - left > refinementToleranceSeconds * 1000 && refinementIterations < 64) {
    const middle = Math.round((left + right) / 2);
    const middleDifference = signedDifference(
      apparentSunLongitudeAt(middle),
      targetLongitudeDegrees,
    );
    if (leftDifference * middleDifference <= 0) {
      right = middle;
    } else {
      left = middle;
      leftDifference = middleDifference;
    }
    refinementIterations += 1;
  }

  const modelRootUtcTimestamp = Math.round((left + right) / 2 / 1000) * 1000;
  const modelRootUtcDateTime = new Date(modelRootUtcTimestamp).toISOString();
  // 排盘边界继续采用 tyme4ts 历表；低阶视黄经求根只作为独立核验，不覆盖更精细的历表结果。
  const utcTimestamp = seedTimestamp;
  const solarLongitudeDegrees = apparentSunLongitudeAt(utcTimestamp);
  const residualDegrees = Math.abs(signedDifference(solarLongitudeDegrees, targetLongitudeDegrees));
  const utcDateTime = new Date(utcTimestamp).toISOString();
  const seedUtcDateTime = new Date(seedTimestamp).toISOString();
  const seedDifferenceSeconds = Number(((modelRootUtcTimestamp - seedTimestamp) / 1000).toFixed(3));
  const method =
    '排盘采用 tyme4ts 节气历表；另以前后 18 小时包围搜索，对 Meeus/NOAA 低阶太阳视黄经二分至 1 秒区间作独立核验';
  const source =
    '节气定义采用太阳视运动每隔 15° 的回归黄经；太阳视黄经采用 Meeus/NOAA 低阶公式，tyme4ts 提供独立历表初值';
  const limitations = [
    'Meeus/NOAA 低阶太阳公式适合民用历法级节气核验，但二分到 1 秒只表示数值求根区间，不等于观测级一秒精度。',
    '未接入实时 UT1、完整章动项或 JPL 高精度星历；保留与 tyme4ts 历表的差值。出生时间无法满足排盘精度要求时应拒绝进入排盘流程，不生成候选盘。',
  ];
  const calculationSteps: SolarTermCalculationStep[] = [
    {
      key: `solar-term:${year}:${index}:calculation:target`,
      stage: '目标黄经',
      status: '已计算',
      dependsOnStepKeys: [],
      inputs: { year, index, name },
      result: { targetLongitudeDegrees, isJie: index % 2 === 1 },
      promptText: `${name}按二十四节气序列定位目标回归黄经${targetLongitudeDegrees}°`,
      sources: ['二十四节气每隔15°回归黄经定义'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: `solar-term:${year}:${index}:calculation:adopted-table`,
      stage: '历表时刻',
      status: '已采用',
      dependsOnStepKeys: [`solar-term:${year}:${index}:calculation:target`],
      inputs: { year, index },
      result: { utcDateTime, utcTimestamp },
      promptText: `排盘边界采用 tyme4ts 历表 UTC ${utcDateTime}`,
      sources: ['tyme4ts 节气历表'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: `solar-term:${year}:${index}:calculation:model-root`,
      stage: '独立求根',
      status: '已计算',
      dependsOnStepKeys: [`solar-term:${year}:${index}:calculation:target`],
      inputs: { searchWindowHours, refinementToleranceSeconds, targetLongitudeDegrees },
      result: { modelRootUtcDateTime, refinementIterations, residualDegrees },
      promptText: `Meeus/NOAA 低阶太阳视黄经在前后${searchWindowHours}小时窗口二分至${refinementToleranceSeconds}秒区间，独立求根为${modelRootUtcDateTime}`,
      sources: ['Meeus/NOAA 低阶太阳视黄经公式', '二分求根'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: `solar-term:${year}:${index}:calculation:comparison`,
      stage: '差值核验',
      status: '已计算',
      dependsOnStepKeys: [
        `solar-term:${year}:${index}:calculation:adopted-table`,
        `solar-term:${year}:${index}:calculation:model-root`,
      ],
      inputs: { adoptedUtcDateTime: utcDateTime, modelRootUtcDateTime },
      result: { seedDifferenceSeconds },
      promptText: `独立模型与采用历表相差${seedDifferenceSeconds >= 0 ? '+' : ''}${seedDifferenceSeconds.toFixed(1)}秒`,
      sources: ['采用历表与独立低阶模型逐时刻比较'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  const verificationFact: SolarTermVerificationFact = {
    key: `solar-term:${year}:${index}:verification`,
    status: '已记录差值',
    adoptedStepKey: `solar-term:${year}:${index}:calculation:adopted-table`,
    modelStepKey: `solar-term:${year}:${index}:calculation:model-root`,
    seedDifferenceSeconds,
    promptText: `采用历表与独立低阶模型差值为${seedDifferenceSeconds >= 0 ? '+' : ''}${seedDifferenceSeconds.toFixed(1)}秒；排盘仍采用历表`,
    sources: ['tyme4ts 节气历表', 'Meeus/NOAA 低阶太阳视黄经独立求根'],
    limitation: VERIFICATION_FACT_LIMITATION,
  };
  const limitationFacts: SolarTermLimitationFact[] = [
    {
      key: `solar-term:${year}:${index}:limitation:numerical-root`,
      type: '数值求根精度',
      status: '适用',
      ownerFactKeys: [verificationFact.key],
      ownerStepKeys: [`solar-term:${year}:${index}:calculation:model-root`],
      promptText: limitations[0],
      sources: ['低阶太阳公式与二分求根精度说明'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: `solar-term:${year}:${index}:limitation:ephemeris`,
      type: '星历模型边界',
      status: '适用',
      ownerFactKeys: [verificationFact.key],
      ownerStepKeys: [
        `solar-term:${year}:${index}:calculation:adopted-table`,
        `solar-term:${year}:${index}:calculation:model-root`,
      ],
      promptText: limitations[1],
      sources: ['UT1、章动项与高精度星历覆盖范围'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
  ];
  const summaryFact: SolarTermSummaryFact = {
    key: `solar-term:${year}:${index}:evidence-summary`,
    status: '历表已采用并完成独立核验',
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      verificationFact.key,
      ...limitationFacts.map((item) => item.key),
    ],
    calculationStepCount: calculationSteps.length,
    verificationFactCount: 1,
    limitationFactCount: limitationFacts.length,
    promptText: `${name}节气证据已采用历表并完成独立低阶模型核验；记录计算步骤${calculationSteps.length}项、差值核验1项、限制${limitationFacts.length}项`,
    sources: ['二十四节气目标黄经、采用历表、独立低阶太阳模型、差值与限制逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };

  return {
    key: `solar-term:${year}:${index}:${name}`,
    status: '历表已采用并独立核验',
    name,
    index,
    isJie: index % 2 === 1,
    targetLongitudeDegrees,
    utcTimestamp,
    utcDateTime,
    julianDayUtc: Number((utcTimestamp / 86400000 + 2440587.5).toFixed(9)),
    modelRootUtcTimestamp,
    modelRootUtcDateTime,
    solarLongitudeDegrees: Number(solarLongitudeDegrees.toFixed(8)),
    residualDegrees: Number(residualDegrees.toFixed(8)),
    seedUtcDateTime,
    seedDifferenceSeconds,
    searchWindowHours,
    refinementToleranceSeconds,
    refinementIterations,
    method,
    source,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    verificationFact,
    summaryFact,
    limitations,
    limitationFacts,
    promptText: `节气交接证据：${name}定义为太阳回归黄经${targetLongitudeDegrees}°，排盘采用 tyme4ts 历表 UTC ${utcDateTime}；该时刻按 Meeus/NOAA 低阶公式得视黄经${solarLongitudeDegrees.toFixed(6)}°，差目标${residualDegrees.toFixed(6)}°。独立模型求根为${modelRootUtcDateTime}，与采用历表相差${seedDifferenceSeconds >= 0 ? '+' : ''}${seedDifferenceSeconds.toFixed(1)}秒，迭代${refinementIterations}次。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。差值核验：${verificationFact.promptText}。证据汇总：${summaryFact.promptText}。方法：${method}。来源：${source}。限制：${limitations.join('；')}`,
  };
}

export function calculateSolarTermsForYear(year: number): SolarTermEvidence[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2199) {
    throw new Error('全年节气证据年份需在 1900-2199 之间。');
  }
  return [
    ...Array.from({ length: 23 }, (_, offset) => calculateSolarTermEvidence(year, offset + 1)),
    calculateSolarTermEvidence(year + 1, 0),
  ];
}

export function findSolarTermEvidence(name: SolarTermName, year: number): SolarTermEvidence {
  const index = TERM_NAMES.indexOf(name);
  if (index < 0) throw new Error(`无法识别节气 ${name}。`);
  return calculateSolarTermEvidence(year, index);
}
