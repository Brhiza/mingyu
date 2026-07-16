/**
 * @file 太阳高度、日出日落与曙暮光证据
 * @description 采用 NOAA/Meeus 低阶太阳模型，输出地点相关的光照事件和计算限制。
 */
import {
  buildAstronomicalTimeEvidence,
  type AstronomicalTimeEvidence,
  type AstronomicalTimeInput,
} from './astronomical-time';

const DAY_MS = 86_400_000;

export type SolarCrossingStatus = '正常交点' | '全天高于阈值' | '全天低于阈值';

export interface SolarCrossingEvidence {
  key: string;
  name: string;
  solarAltitudeDegrees: number;
  status: SolarCrossingStatus;
  morningUtcDateTime: string | null;
  eveningUtcDateTime: string | null;
  morningLocalDateTime: string | null;
  eveningLocalDateTime: string | null;
  promptText: string;
  ownerFactKeys: string[];
  calculationStepKeys: string[];
  sources: string[];
  calculation: string;
  limitation: '太阳高度阈值交点只描述低阶太阳模型在理想地平线条件下的几何时刻或全天状态；不代表实际可见性、天气、遮挡、建筑采光效果、吉凶或事件结果';
}

export interface SolarIlluminationCalculationStep {
  key: string;
  stage: '天文时间' | '参考太阳位置' | '视太阳正午' | '阈值交点';
  status: '已计算';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number>;
  result: Record<string, string | number>;
  promptText: string;
  sources: string[];
  limitation: '太阳光照步骤只证明天文时间、低阶太阳位置、视太阳正午和高度阈值交点如何形成；不得把几何结果解释为实际可见性、建筑采光效果或导航级精度';
}

export interface SolarIlluminationAssumptionFact {
  key: string;
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '假设事实只说明标准太阳半径、折射近似与单日时区偏移的计算前提；不得当作实际天气、遮挡或时区切换影响已经排除';
}

export interface SolarCrossingSummaryFact {
  key: 'solar-illumination:crossing-summary';
  status: '均有正常交点' | '存在全天状态';
  factKeys: string[];
  crossingFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '交点汇总只说明四类太阳高度阈值在该民用日期是否存在正常交点；全天状态不是错误，也不得直接解释为现实吉凶或居住效果';
}

export interface SolarIlluminationLimitationFact {
  key: string;
  type: '现场可见性边界' | '时区切换边界' | '模型精度边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束太阳高度、方位、日出日落和曙暮光结果可以支持的解释范围，不得被反向当作天气、建筑性能、吉凶或事件证据';
}

export interface SolarIlluminationSummaryFact {
  key: 'solar-illumination:evidence-summary';
  status: '证据链完整' | '含全天状态';
  factKeys: string[];
  calculationStepCount: number;
  normalCrossingCount: number;
  allDayStateCount: number;
  assumptionFactCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '太阳光照证据汇总只统计天文时间、太阳位置、视太阳正午、阈值交点、全天状态、假设与限制覆盖；不得按状态生成采光评分、天气结论、吉凶或事件保证';
}

const CROSSING_SOURCES = [
  'NOAA Solar Calculator 太阳赤纬、时间方程与时角公式',
  'Meeus《Astronomical Algorithms》低阶太阳模型',
] as const;

const CROSSING_LIMITATION =
  '太阳高度阈值交点只描述低阶太阳模型在理想地平线条件下的几何时刻或全天状态；不代表实际可见性、天气、遮挡、建筑采光效果、吉凶或事件结果' as const;

export interface SolarIlluminationInput extends AstronomicalTimeInput {
  latitude: number;
  longitude: number;
}

export interface SolarIlluminationEvidence {
  key: string;
  status: '已计算' | '存在全天状态';
  localDate: string;
  referenceLocalDateTime: string;
  referenceUtcDateTime: string;
  latitude: number;
  longitude: number;
  timezone: number;
  astronomicalTime: AstronomicalTimeEvidence;
  solarAltitudeDegrees: number;
  solarAzimuthDegrees: number;
  solarDeclinationDegrees: number;
  equationOfTimeMinutes: number;
  apparentSolarNoonUtcDateTime: string;
  apparentSolarNoonLocalDateTime: string;
  sunriseSunset: SolarCrossingEvidence;
  civilTwilight: SolarCrossingEvidence;
  nauticalTwilight: SolarCrossingEvidence;
  astronomicalTwilight: SolarCrossingEvidence;
  method: string;
  source: string;
  calculationSteps: SolarIlluminationCalculationStep[];
  calculationChain: string[];
  assumptions: string[];
  assumptionFacts: SolarIlluminationAssumptionFact[];
  crossingSummaryFact: SolarCrossingSummaryFact;
  summaryFact: SolarIlluminationSummaryFact;
  limitations: string[];
  limitationFacts: SolarIlluminationLimitationFact[];
  promptText: string;
}

const CALCULATION_STEP_LIMITATION =
  '太阳光照步骤只证明天文时间、低阶太阳位置、视太阳正午和高度阈值交点如何形成；不得把几何结果解释为实际可见性、建筑采光效果或导航级精度' as const;
const ASSUMPTION_FACT_LIMITATION =
  '假设事实只说明标准太阳半径、折射近似与单日时区偏移的计算前提；不得当作实际天气、遮挡或时区切换影响已经排除' as const;
const CROSSING_SUMMARY_LIMITATION =
  '交点汇总只说明四类太阳高度阈值在该民用日期是否存在正常交点；全天状态不是错误，也不得直接解释为现实吉凶或居住效果' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束太阳高度、方位、日出日落和曙暮光结果可以支持的解释范围，不得被反向当作天气、建筑性能、吉凶或事件证据' as const;
const SUMMARY_FACT_LIMITATION =
  '太阳光照证据汇总只统计天文时间、太阳位置、视太阳正午、阈值交点、全天状态、假设与限制覆盖；不得按状态生成采光评分、天气结论、吉凶或事件保证' as const;

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function formatLocalTimestamp(timestamp: number, timezone: number) {
  const date = new Date(timestamp + timezone * 3_600_000);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`;
}

function solarParameters(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((timestamp - yearStart) / DAY_MS) + 1;
  const fractionalHour =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const daysInYear = Date.UTC(year + 1, 0, 1) - yearStart === 366 * DAY_MS ? 366 : 365;
  const gamma = (2 * Math.PI * (dayOfYear - 1 + (fractionalHour - 12) / 24)) / daysInYear;
  const equationOfTimeMinutes =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declinationRadians =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  return { equationOfTimeMinutes, declinationRadians };
}

function crossingEvidence(
  name: string,
  altitudeDegrees: number,
  latitude: number,
  longitude: number,
  timezone: number,
  localMidnightUtcTimestamp: number,
  equationOfTimeMinutes: number,
  declinationRadians: number,
): SolarCrossingEvidence {
  const key = `光照交点:${name}`;
  const calculationStepKeys = ['solar-illumination:calculation:crossings'];
  const calculation = `以太阳中心高度${altitudeDegrees}°为阈值，结合纬度${latitude}°、经度${longitude}°、时区UTC${timezone >= 0 ? '+' : ''}${timezone}、时间方程${equationOfTimeMinutes.toFixed(4)}分钟与太阳赤纬${radiansToDegrees(declinationRadians).toFixed(6)}°求时角交点`;
  const latitudeRadians = degreesToRadians(latitude);
  const zenithRadians = degreesToRadians(90 - altitudeDegrees);
  const cosineHourAngle =
    Math.cos(zenithRadians) / (Math.cos(latitudeRadians) * Math.cos(declinationRadians)) -
    Math.tan(latitudeRadians) * Math.tan(declinationRadians);
  if (cosineHourAngle > 1) {
    return {
      key,
      name,
      solarAltitudeDegrees: altitudeDegrees,
      status: '全天低于阈值',
      morningUtcDateTime: null,
      eveningUtcDateTime: null,
      morningLocalDateTime: null,
      eveningLocalDateTime: null,
      promptText: `${name}：太阳高度${altitudeDegrees}°阈值在该民用日期全天无交点，状态为全天低于阈值`,
      ownerFactKeys: calculationStepKeys,
      calculationStepKeys,
      sources: [...CROSSING_SOURCES],
      calculation: `${calculation}；余弦时角大于1，判定全天低于阈值`,
      limitation: CROSSING_LIMITATION,
    };
  }
  if (cosineHourAngle < -1) {
    return {
      key,
      name,
      solarAltitudeDegrees: altitudeDegrees,
      status: '全天高于阈值',
      morningUtcDateTime: null,
      eveningUtcDateTime: null,
      morningLocalDateTime: null,
      eveningLocalDateTime: null,
      promptText: `${name}：太阳高度${altitudeDegrees}°阈值在该民用日期全天无交点，状态为全天高于阈值`,
      ownerFactKeys: calculationStepKeys,
      calculationStepKeys,
      sources: [...CROSSING_SOURCES],
      calculation: `${calculation}；余弦时角小于-1，判定全天高于阈值`,
      limitation: CROSSING_LIMITATION,
    };
  }
  const hourAngleDegrees = radiansToDegrees(Math.acos(cosineHourAngle));
  const solarNoonMinutes = 720 - 4 * longitude - equationOfTimeMinutes + timezone * 60;
  const morningMinutes = solarNoonMinutes - 4 * hourAngleDegrees;
  const eveningMinutes = solarNoonMinutes + 4 * hourAngleDegrees;
  const morningTimestamp = localMidnightUtcTimestamp + morningMinutes * 60_000;
  const eveningTimestamp = localMidnightUtcTimestamp + eveningMinutes * 60_000;
  const morningUtcDateTime = new Date(morningTimestamp).toISOString();
  const eveningUtcDateTime = new Date(eveningTimestamp).toISOString();
  const morningLocalDateTime = formatLocalTimestamp(morningTimestamp, timezone);
  const eveningLocalDateTime = formatLocalTimestamp(eveningTimestamp, timezone);
  return {
    key,
    name,
    solarAltitudeDegrees: altitudeDegrees,
    status: '正常交点',
    morningUtcDateTime,
    eveningUtcDateTime,
    morningLocalDateTime,
    eveningLocalDateTime,
    promptText: `${name}：太阳高度${altitudeDegrees}°阈值的当地上午交点为${morningLocalDateTime}、下午交点为${eveningLocalDateTime}`,
    ownerFactKeys: calculationStepKeys,
    calculationStepKeys,
    sources: [...CROSSING_SOURCES],
    calculation: `${calculation}；余弦时角位于[-1,1]，解得上午与下午两个交点`,
    limitation: CROSSING_LIMITATION,
  };
}

function formatCrossing(event: SolarCrossingEvidence) {
  return `${event.promptText}；边界：${event.limitation}`;
}

export function calculateSolarIlluminationEvidence(
  input: SolarIlluminationInput,
): SolarIlluminationEvidence {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error('太阳光照证据纬度需在 -90 至 90 之间。');
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error('太阳光照证据经度需在 -180 至 180 之间。');
  }
  const astronomicalTime = buildAstronomicalTimeEvidence(input);
  const referenceTimestamp = astronomicalTime.unixMilliseconds;
  const timezone = astronomicalTime.timezone;
  const reference = solarParameters(referenceTimestamp);
  const latitudeRadians = degreesToRadians(input.latitude);
  const localMinutes = (input.hour ?? 0) * 60 + (input.minute ?? 0) + (input.second ?? 0) / 60;
  const trueSolarMinutes =
    (((localMinutes + reference.equationOfTimeMinutes + 4 * input.longitude - 60 * timezone) %
      1440) +
      1440) %
    1440;
  const hourAngleDegrees = trueSolarMinutes / 4 - 180;
  const hourAngleRadians = degreesToRadians(hourAngleDegrees);
  const cosineZenith =
    Math.sin(latitudeRadians) * Math.sin(reference.declinationRadians) +
    Math.cos(latitudeRadians) * Math.cos(reference.declinationRadians) * Math.cos(hourAngleRadians);
  const zenithRadians = Math.acos(Math.max(-1, Math.min(1, cosineZenith)));
  const solarAltitudeDegrees = 90 - radiansToDegrees(zenithRadians);
  const solarAzimuthDegrees = normalizeDegrees(
    radiansToDegrees(
      Math.atan2(
        Math.sin(hourAngleRadians),
        Math.cos(hourAngleRadians) * Math.sin(latitudeRadians) -
          Math.tan(reference.declinationRadians) * Math.cos(latitudeRadians),
      ),
    ) + 180,
  );
  const localMidnightUtcTimestamp =
    Date.UTC(input.year, input.month - 1, input.day) - timezone * 3_600_000;
  const localNoonUtcTimestamp = localMidnightUtcTimestamp + 12 * 3_600_000;
  const daily = solarParameters(localNoonUtcTimestamp);
  const solarNoonMinutes = 720 - 4 * input.longitude - daily.equationOfTimeMinutes + timezone * 60;
  const solarNoonTimestamp = localMidnightUtcTimestamp + solarNoonMinutes * 60_000;
  const eventArgs = [
    input.latitude,
    input.longitude,
    timezone,
    localMidnightUtcTimestamp,
    daily.equationOfTimeMinutes,
    daily.declinationRadians,
  ] as const;
  const sunriseSunset = crossingEvidence('日出/日落', -0.833, ...eventArgs);
  const civilTwilight = crossingEvidence('民用曙暮光', -6, ...eventArgs);
  const nauticalTwilight = crossingEvidence('航海曙暮光', -12, ...eventArgs);
  const astronomicalTwilight = crossingEvidence('天文曙暮光', -18, ...eventArgs);
  const method =
    '采用 NOAA/Meeus 低阶太阳赤纬与时间方程；日出日落以太阳中心高度 -0.833°，民用、航海、天文曙暮光分别以 -6°、-12°、-18° 求时角交点';
  const source = 'NOAA Solar Calculator equations，核心公式源自 Meeus《Astronomical Algorithms》';
  const assumptions = [
    '日出日落的 -0.833° 阈值包含标准太阳半径与近地平大气折射近似。',
    '同一民用日期内采用参考时刻解析出的 UTC 偏移计算事件。',
  ];
  const limitations = [
    '未考虑实际海拔、山体与建筑遮挡、逐时气象折射和局部地平线起伏，实际可见时刻可能偏移。',
    'IANA 时区在当天发生偏移切换时，事件当地时间仍按参考时刻偏移表达，应结合时区诊断复核。',
    '低阶模型适合民用历法和光照背景，不宣称达到观测级或导航级精度。',
  ];
  const localDate = `${String(input.year).padStart(4, '0')}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')}`;
  const calculationSteps: SolarIlluminationCalculationStep[] = [
    {
      key: 'solar-illumination:calculation:astronomical-time',
      stage: '天文时间',
      status: '已计算',
      dependsOnStepKeys: [],
      inputs: {
        referenceLocalDateTime: astronomicalTime.localDateTime,
        timezone,
      },
      result: {
        referenceUtcDateTime: astronomicalTime.utcDateTime,
        unixMilliseconds: astronomicalTime.unixMilliseconds,
      },
      promptText: `将参考当地时间${astronomicalTime.localDateTime}换算为 UTC ${astronomicalTime.utcDateTime}`,
      sources: ['天文时间尺度换算证据', '当地时间与 UTC 偏移'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'solar-illumination:calculation:reference-position',
      stage: '参考太阳位置',
      status: '已计算',
      dependsOnStepKeys: ['solar-illumination:calculation:astronomical-time'],
      inputs: {
        latitude: input.latitude,
        longitude: input.longitude,
        referenceUtcDateTime: astronomicalTime.utcDateTime,
      },
      result: {
        solarAltitudeDegrees: Number(solarAltitudeDegrees.toFixed(4)),
        solarAzimuthDegrees: Number(solarAzimuthDegrees.toFixed(4)),
        solarDeclinationDegrees: Number(radiansToDegrees(reference.declinationRadians).toFixed(6)),
        equationOfTimeMinutes: Number(reference.equationOfTimeMinutes.toFixed(4)),
      },
      promptText: `按 NOAA/Meeus 低阶模型计算参考时刻太阳高度${solarAltitudeDegrees.toFixed(4)}°、方位${solarAzimuthDegrees.toFixed(4)}°、赤纬${radiansToDegrees(reference.declinationRadians).toFixed(6)}°`,
      sources: [...CROSSING_SOURCES],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'solar-illumination:calculation:solar-noon',
      stage: '视太阳正午',
      status: '已计算',
      dependsOnStepKeys: ['solar-illumination:calculation:reference-position'],
      inputs: {
        localDate,
        latitude: input.latitude,
        longitude: input.longitude,
        timezone,
      },
      result: {
        apparentSolarNoonUtcDateTime: new Date(solarNoonTimestamp).toISOString(),
        apparentSolarNoonLocalDateTime: formatLocalTimestamp(solarNoonTimestamp, timezone),
      },
      promptText: `按经度、时区与时间方程求视太阳正午：当地${formatLocalTimestamp(solarNoonTimestamp, timezone)}`,
      sources: [...CROSSING_SOURCES],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'solar-illumination:calculation:crossings',
      stage: '阈值交点',
      status: '已计算',
      dependsOnStepKeys: [
        'solar-illumination:calculation:reference-position',
        'solar-illumination:calculation:solar-noon',
      ],
      inputs: {
        localDate,
        latitude: input.latitude,
        longitude: input.longitude,
        timezone,
      },
      result: {
        crossingCount: 4,
        normalCrossingCount: [
          sunriseSunset,
          civilTwilight,
          nauticalTwilight,
          astronomicalTwilight,
        ].filter((item) => item.status === '正常交点').length,
      },
      promptText: `以 -0.833°、-6°、-12°、-18° 四个太阳高度阈值求日出日落与曙暮光交点，并记录全天状态`,
      sources: [...CROSSING_SOURCES],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  const assumptionFacts: SolarIlluminationAssumptionFact[] = assumptions.map((text, index) => ({
    key: `solar-illumination:assumption:${index + 1}`,
    status: '适用',
    ownerStepKeys:
      index === 0
        ? ['solar-illumination:calculation:crossings']
        : [
            'solar-illumination:calculation:astronomical-time',
            'solar-illumination:calculation:crossings',
          ],
    ownerFactKeys:
      index === 0
        ? ['solar-illumination:calculation:crossings']
        : [
            'solar-illumination:calculation:astronomical-time',
            'solar-illumination:calculation:crossings',
          ],
    promptText: text,
    sources: [index === 0 ? '太阳高度阈值定义' : '参考时刻的时区偏移'],
    limitation: ASSUMPTION_FACT_LIMITATION,
  }));
  const crossings = [sunriseSunset, civilTwilight, nauticalTwilight, astronomicalTwilight];
  const normalCrossingCount = crossings.filter((item) => item.status === '正常交点').length;
  const crossingSummaryFact: SolarCrossingSummaryFact = {
    key: 'solar-illumination:crossing-summary',
    status: normalCrossingCount === crossings.length ? '均有正常交点' : '存在全天状态',
    factKeys: ['solar-illumination:calculation:crossings', ...crossings.map((item) => item.key)],
    crossingFactKeys: crossings.map((item) => item.key),
    promptText:
      normalCrossingCount === crossings.length
        ? '四类太阳高度阈值均找到上午和下午正常交点'
        : `${crossings.length - normalCrossingCount}类太阳高度阈值呈全天高于或低于阈值状态，未形成常规交点`,
    sources: [...CROSSING_SOURCES],
    limitation: CROSSING_SUMMARY_LIMITATION,
  };
  const limitationFacts: SolarIlluminationLimitationFact[] = [
    {
      key: 'solar-illumination:limitation:visibility',
      type: '现场可见性边界',
      status: '适用',
      ownerFactKeys: ['solar-illumination:calculation:crossings'],
      ownerStepKeys: ['solar-illumination:calculation:crossings'],
      promptText: limitations[0],
      sources: ['理想地平线模型与现场条件差异'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'solar-illumination:limitation:timezone-transition',
      type: '时区切换边界',
      status: '适用',
      ownerFactKeys: [
        'solar-illumination:calculation:astronomical-time',
        'solar-illumination:calculation:crossings',
      ],
      ownerStepKeys: [
        'solar-illumination:calculation:astronomical-time',
        'solar-illumination:calculation:crossings',
      ],
      promptText: limitations[1],
      sources: ['IANA 时区历史偏移诊断'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'solar-illumination:limitation:model-precision',
      type: '模型精度边界',
      status: '适用',
      ownerFactKeys: [
        'solar-illumination:calculation:reference-position',
        'solar-illumination:calculation:crossings',
      ],
      ownerStepKeys: [
        'solar-illumination:calculation:reference-position',
        'solar-illumination:calculation:crossings',
      ],
      promptText: limitations[2],
      sources: [...CROSSING_SOURCES],
      limitation: LIMITATION_FACT_LIMITATION,
    },
  ];
  const status = crossingSummaryFact.status === '均有正常交点' ? '已计算' : '存在全天状态';
  const summaryFact: SolarIlluminationSummaryFact = {
    key: 'solar-illumination:evidence-summary',
    status: normalCrossingCount === crossings.length ? '证据链完整' : '含全天状态',
    factKeys: [
      astronomicalTime.key,
      astronomicalTime.summaryFact.key,
      ...calculationSteps.map((item) => item.key),
      ...crossings.map((item) => item.key),
      crossingSummaryFact.key,
      ...assumptionFacts.map((item) => item.key),
      ...limitationFacts.map((item) => item.key),
    ],
    calculationStepCount: calculationSteps.length,
    normalCrossingCount,
    allDayStateCount: crossings.length - normalCrossingCount,
    assumptionFactCount: assumptionFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `太阳光照证据状态为${normalCrossingCount === crossings.length ? '证据链完整' : '含全天状态'}；记录计算步骤${calculationSteps.length}项、正常交点阈值${normalCrossingCount}类、全天状态${crossings.length - normalCrossingCount}类、假设${assumptionFacts.length}项、限制${limitationFacts.length}项`,
    sources: ['天文时间、太阳位置、阈值交点、全天状态、假设与限制事实汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
  return {
    key: `solar-illumination:${localDate}:${input.latitude}:${input.longitude}`,
    status,
    localDate,
    referenceLocalDateTime: astronomicalTime.localDateTime,
    referenceUtcDateTime: astronomicalTime.utcDateTime,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone,
    solarAltitudeDegrees: Number(solarAltitudeDegrees.toFixed(4)),
    solarAzimuthDegrees: Number(solarAzimuthDegrees.toFixed(4)),
    solarDeclinationDegrees: Number(radiansToDegrees(reference.declinationRadians).toFixed(6)),
    equationOfTimeMinutes: Number(reference.equationOfTimeMinutes.toFixed(4)),
    apparentSolarNoonUtcDateTime: new Date(solarNoonTimestamp).toISOString(),
    apparentSolarNoonLocalDateTime: formatLocalTimestamp(solarNoonTimestamp, timezone),
    astronomicalTime,
    sunriseSunset,
    civilTwilight,
    nauticalTwilight,
    astronomicalTwilight,
    method,
    source,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    assumptions,
    assumptionFacts,
    crossingSummaryFact,
    summaryFact,
    limitations,
    limitationFacts,
    promptText: `太阳光照证据：${localDate}，纬度${input.latitude}°、经度${input.longitude}°，参考当地时间${astronomicalTime.localDateTime}太阳高度${solarAltitudeDegrees.toFixed(2)}°、方位角${solarAzimuthDegrees.toFixed(2)}°（真北起顺时针），视太阳正午${formatLocalTimestamp(solarNoonTimestamp, timezone)}；计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}；${crossings.map(formatCrossing).join('；')}。交点汇总：${crossingSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。方法：${method}。来源：${source}。假设：${assumptions.join('；')}。限制：${limitations.join('；')}`,
  };
}
