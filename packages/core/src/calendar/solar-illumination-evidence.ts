/**
 * @file 太阳高度、日出日落与曙暮光证据
 * @description 采用太阳星历与球面天文坐标换算，输出地点相关的光照事件和计算限制。
 */
import * as AstronomyEngine from 'astronomy-engine';
import { formatFixedTimezoneOffset, resolveCivilDayEnd, resolveCivilDayStart } from './civil-time';
import { getHistoricalTimezoneOffsetAt } from './historical-timezone';
import {
  buildAstronomicalTimeEvidence,
  type AstronomicalTimeEvidence,
  type AstronomicalTimeInput,
} from './astronomical-time';

const DAY_MS = 86_400_000;
// 与日升日落求解采用同一太阳物理半径和海平面标准折射。
const SUN_RADIUS_KM = 695_700;
const STANDARD_HORIZON_REFRACTION_DEGREES = 34 / 60;
const astronomyNamespace = AstronomyEngine as unknown as Record<string, unknown>;
const Astronomy = (Reflect.get(astronomyNamespace, 'default') ??
  AstronomyEngine) as typeof AstronomyEngine;
const {
  Body,
  Equator,
  Horizon,
  HourAngle,
  KM_PER_AU,
  Observer,
  SearchAltitude,
  SearchHourAngle,
  SearchRiseSet,
} = Astronomy;

export type SolarCrossingStatus = '正常交点' | '全天高于阈值' | '全天低于阈值';

export interface SolarCrossingEvent {
  direction: '上行' | '下行';
  utcTimestamp: number;
  utcDateTime: string;
  localDateTime: string;
  utcOffset: string;
}

export interface SolarNoonEvent {
  utcTimestamp: number;
  utcDateTime: string;
  localDateTime: string;
  utcOffset: string;
}

export interface SolarCrossingEvidence {
  key: string;
  name: string;
  /** 日出日落为太阳中心名义阈值，其余为实际太阳中心高度阈值。 */
  solarAltitudeDegrees: number;
  status: SolarCrossingStatus;
  dayStartUtcDateTime: string;
  dayEndUtcDateTimeExclusive: string;
  /** 按真实瞬时排序，保留同一民用日内的每一处交点。 */
  crossings: SolarCrossingEvent[];
  /** 兼容单次升落读取；有多组交点时为该方向的首个交点。 */
  morningUtcDateTime: string | null;
  eveningUtcDateTime: string | null;
  morningLocalDateTime: string | null;
  eveningLocalDateTime: string | null;
  promptText: string;
  ownerFactKeys: string[];
  calculationStepKeys: string[];
  sources: string[];
  calculation: string;
  limitation: '太阳高度阈值交点只描述太阳星历按对应阈值和折射口径、在理想地平线条件下的计算时刻或全天状态；不代表实际可见性、天气、遮挡、建筑采光效果、吉凶或事件结果';
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
  limitation: '太阳光照步骤只证明天文时间、太阳星历位置、视太阳正午和高度阈值交点如何形成；不得把几何结果解释为实际可见性、建筑采光效果或导航级精度';
}

export interface SolarIlluminationAssumptionFact {
  key: string;
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '假设事实只说明标准太阳半径、折射近似与民用日界及逐事件时区偏移的计算前提；不得当作实际天气、遮挡或时区切换影响已经排除';
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
  'VSOP87 太阳星历',
  '球面天文赤道与地平坐标换算',
  'Meeus《Astronomical Algorithms》日出日落标准折射模型',
] as const;

const CROSSING_LIMITATION =
  '太阳高度阈值交点只描述太阳星历按对应阈值和折射口径、在理想地平线条件下的计算时刻或全天状态；不代表实际可见性、天气、遮挡、建筑采光效果、吉凶或事件结果' as const;

export interface SolarIlluminationInput extends AstronomicalTimeInput {
  latitude: number;
  longitude: number;
}

export interface SolarIlluminationEvidence {
  key: string;
  status: '已计算' | '存在全天状态';
  localDate: string;
  localDayStartUtcDateTime: string;
  localDayEndUtcDateTimeExclusive: string;
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
  /** 当地民用日期内按 UTC 排序的全部视太阳正午；重历日可能有两次。 */
  apparentSolarNoonEvents: SolarNoonEvent[];
  /** 兼容单值读取：选择与参考瞬时最近的当日正午；无当日事件时保留参考估计。 */
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
  '太阳光照步骤只证明天文时间、太阳星历位置、视太阳正午和高度阈值交点如何形成；不得把几何结果解释为实际可见性、建筑采光效果或导航级精度' as const;
const ASSUMPTION_FACT_LIMITATION =
  '假设事实只说明标准太阳半径、折射近似与民用日界及逐事件时区偏移的计算前提；不得当作实际天气、遮挡或时区切换影响已经排除' as const;
const CROSSING_SUMMARY_LIMITATION =
  '交点汇总只说明四类太阳高度阈值在该民用日期是否存在正常交点；全天状态不是错误，也不得直接解释为现实吉凶或居住效果' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束太阳高度、方位、日出日落和曙暮光结果可以支持的解释范围，不得被反向当作天气、建筑性能、吉凶或事件证据' as const;
const SUMMARY_FACT_LIMITATION =
  '太阳光照证据汇总只统计天文时间、太阳位置、视太阳正午、阈值交点、全天状态、假设与限制覆盖；不得按状态生成采光评分、天气结论、吉凶或事件保证' as const;

function formatLocalTimestamp(timestamp: number, timezone: number, timeZoneId?: string) {
  const offset = timeZoneId
    ? getHistoricalTimezoneOffsetAt(new Date(timestamp), timeZoneId)
    : timezone;
  const date = new Date(timestamp + offset * 3_600_000);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`;
}

function normalizeDayMinutes(value: number) {
  const normalized = value % 1440;
  return normalized < 0 ? normalized + 1440 : normalized;
}

function findSolarNoonEvents(
  dayStartUtcTimestamp: number,
  dayEndUtcTimestamp: number,
  observer: AstronomyEngine.Observer,
  timezone: number,
  timeZoneId?: string,
): SolarNoonEvent[] {
  const events: SolarNoonEvent[] = [];
  let searchTimestamp = dayStartUtcTimestamp;
  while (searchTimestamp < dayEndUtcTimestamp) {
    const found = SearchHourAngle(Body.Sun, observer, 0, new Date(searchTimestamp), 1);
    const utcTimestamp = found.time.date.getTime();
    if (utcTimestamp >= dayEndUtcTimestamp) break;
    if (utcTimestamp < searchTimestamp) throw new Error('视太阳正午未按真实瞬时递增。');
    const utcOffsetHours = timeZoneId
      ? getHistoricalTimezoneOffsetAt(new Date(utcTimestamp), timeZoneId)
      : timezone;
    events.push({
      utcTimestamp,
      utcDateTime: new Date(utcTimestamp).toISOString(),
      localDateTime: formatLocalTimestamp(utcTimestamp, timezone, timeZoneId),
      utcOffset: formatFixedTimezoneOffset(utcOffsetHours),
    });
    searchTimestamp = utcTimestamp + 1_000;
  }
  return events;
}

function formatTimezoneContext(timezone: number, timeZoneId?: string) {
  const offset = `UTC${timezone >= 0 ? '+' : ''}${timezone}`;
  return timeZoneId ? `${timeZoneId}@${offset}` : offset;
}

function crossingEvidence(
  name: string,
  altitudeDegrees: number,
  latitude: number,
  longitude: number,
  timezone: number,
  localMidnightUtcTimestamp: number,
  localDayEndUtcTimestamp: number,
  timeZoneId?: string,
): SolarCrossingEvidence {
  const key = `光照交点:${name}`;
  const calculationStepKeys = ['solar-illumination:calculation:crossings'];
  const timezoneContext = timeZoneId || `UTC${formatFixedTimezoneOffset(timezone)}`;
  const thresholdText =
    altitudeDegrees === -0.833
      ? '标准太阳上缘与近地平折射阈值（太阳中心名义高度约-0.833°）'
      : `太阳高度${altitudeDegrees}°阈值`;
  const calculation = `以${altitudeDegrees === -0.833 ? '标准太阳上缘与近地平折射（太阳中心名义高度约-0.833°）' : `太阳中心高度${altitudeDegrees}°`}为阈值，结合纬度${latitude}°、经度${longitude}°、时区${timezoneContext}，按太阳星历求该民用日期内的高度交点`;
  const observer = new Observer(latitude, longitude, 0);
  const endTimestamp = localDayEndUtcTimestamp;
  const base = {
    key,
    name,
    solarAltitudeDegrees: altitudeDegrees,
    dayStartUtcDateTime: new Date(localMidnightUtcTimestamp).toISOString(),
    dayEndUtcDateTimeExclusive: new Date(endTimestamp).toISOString(),
    ownerFactKeys: calculationStepKeys,
    calculationStepKeys,
    sources: [...CROSSING_SOURCES],
    limitation: CROSSING_LIMITATION,
  };
  const crossings: SolarCrossingEvent[] = [];
  for (const [direction, label] of [
    [1, '上行'],
    [-1, '下行'],
  ] as const) {
    let searchTimestamp = localMidnightUtcTimestamp;
    while (searchTimestamp < endTimestamp) {
      const limitDays = (endTimestamp - searchTimestamp) / DAY_MS + 1;
      const found =
        altitudeDegrees === -0.833
          ? SearchRiseSet(Body.Sun, observer, direction, new Date(searchTimestamp), limitDays)
          : SearchAltitude(
              Body.Sun,
              observer,
              direction,
              new Date(searchTimestamp),
              limitDays,
              altitudeDegrees,
            );
      if (!found) break;
      const utcTimestamp = found.date.getTime();
      if (utcTimestamp >= endTimestamp) break;
      if (utcTimestamp < searchTimestamp) throw new Error(`${name}交点未按真实瞬时递增。`);
      const utcOffsetHours = timeZoneId
        ? getHistoricalTimezoneOffsetAt(new Date(utcTimestamp), timeZoneId)
        : timezone;
      crossings.push({
        direction: label,
        utcTimestamp,
        utcDateTime: new Date(utcTimestamp).toISOString(),
        localDateTime: formatLocalTimestamp(utcTimestamp, timezone, timeZoneId),
        utcOffset: formatFixedTimezoneOffset(utcOffsetHours),
      });
      // 星历交点求解器在同一根附近可能重复返回相差数毫秒的数值解。
      searchTimestamp = utcTimestamp + 1_000;
    }
  }
  crossings.sort((left, right) => left.utcTimestamp - right.utcTimestamp);
  const morning = crossings.find((item) => item.direction === '上行');
  const evening = crossings.find((item) => item.direction === '下行');
  if (crossings.length === 0) {
    const midpoint = new Date((localMidnightUtcTimestamp + endTimestamp) / 2);
    const equator = Equator(Body.Sun, midpoint, observer, true, true);
    const altitude = Horizon(midpoint, observer, equator.ra, equator.dec, '').altitude;
    const comparisonAltitude =
      altitudeDegrees === -0.833
        ? altitude + (180 / Math.PI) * Math.asin(SUN_RADIUS_KM / KM_PER_AU / equator.dist)
        : altitude;
    const comparisonThreshold =
      altitudeDegrees === -0.833 ? -STANDARD_HORIZON_REFRACTION_DEGREES : altitudeDegrees;
    if (comparisonAltitude < comparisonThreshold) {
      return {
        ...base,
        status: '全天低于阈值',
        crossings,
        morningUtcDateTime: null,
        eveningUtcDateTime: null,
        morningLocalDateTime: null,
        eveningLocalDateTime: null,
        promptText: `${name}：${thresholdText}在该民用日期全天无交点，状态为全天低于阈值`,
        calculation: `${calculation}；当日无交点且太阳高度低于阈值，判定全天低于阈值`,
      };
    }
    return {
      ...base,
      status: '全天高于阈值',
      crossings,
      morningUtcDateTime: null,
      eveningUtcDateTime: null,
      morningLocalDateTime: null,
      eveningLocalDateTime: null,
      promptText: `${name}：${thresholdText}在该民用日期全天无交点，状态为全天高于阈值`,
      calculation: `${calculation}；当日无交点且太阳高度高于阈值，判定全天高于阈值`,
    };
  }
  const showEventOffsets = new Set(crossings.map((item) => item.utcOffset)).size > 1;
  const formatDirection = (direction: SolarCrossingEvent['direction']) => {
    const events = crossings.filter((item) => item.direction === direction);
    return events.length
      ? events
          .map((item) =>
            showEventOffsets ? `${item.localDateTime}（UTC${item.utcOffset}）` : item.localDateTime,
          )
          .join('、')
      : '当日无';
  };
  return {
    ...base,
    status: '正常交点',
    crossings,
    morningUtcDateTime: morning?.utcDateTime ?? null,
    eveningUtcDateTime: evening?.utcDateTime ?? null,
    morningLocalDateTime: morning?.localDateTime ?? null,
    eveningLocalDateTime: evening?.localDateTime ?? null,
    promptText: `${name}：${thresholdText}的当地上行交点${formatDirection('上行')}、下行交点${formatDirection('下行')}`,
    calculation: `${calculation}；在${base.dayStartUtcDateTime}至${base.dayEndUtcDateTimeExclusive}（终点不含）内解得${crossings.length}个交点`,
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
  const observer = new Observer(input.latitude, input.longitude, 0);
  const referenceDate = new Date(referenceTimestamp);
  const equator = Equator(Body.Sun, referenceDate, observer, true, true);
  const horizon = Horizon(referenceDate, observer, equator.ra, equator.dec, '');
  const solarAltitudeDegrees = horizon.altitude;
  const solarAzimuthDegrees = horizon.azimuth;
  const solarDeclinationDegrees = equator.dec;
  const apparentSolarMinutes = normalizeDayMinutes(
    HourAngle(Body.Sun, referenceDate, observer) * 60 + 720,
  );
  const utcMinutes = normalizeDayMinutes(referenceTimestamp / 60_000);
  const equationOfTimeMinutes =
    normalizeDayMinutes(apparentSolarMinutes - utcMinutes - 4 * input.longitude + 720) - 720;
  const nominalMidnightUtcTimestamp =
    Date.UTC(input.year, input.month - 1, input.day) - timezone * 3_600_000;
  const timeZoneId = astronomicalTime.timeZoneId;
  const localMidnightUtcTimestamp = timeZoneId
    ? resolveCivilDayStart({
        year: input.year,
        month: input.month,
        day: input.day,
        timeZoneId,
      }).utcTimestamp
    : nominalMidnightUtcTimestamp;
  const localDayEndUtcTimestamp = timeZoneId
    ? resolveCivilDayEnd({
        year: input.year,
        month: input.month,
        day: input.day,
        timeZoneId,
      }).utcTimestamp
    : localMidnightUtcTimestamp + DAY_MS;
  const solarNoonMinutes = normalizeDayMinutes(
    720 - 4 * input.longitude - equationOfTimeMinutes + timezone * 60,
  );
  const solarNoonTimestamp = nominalMidnightUtcTimestamp + solarNoonMinutes * 60_000;
  const apparentSolarNoonEvents = findSolarNoonEvents(
    localMidnightUtcTimestamp,
    localDayEndUtcTimestamp,
    observer,
    timezone,
    timeZoneId,
  );
  const selectedSolarNoon = apparentSolarNoonEvents.reduce<SolarNoonEvent | undefined>(
    (closest, event) =>
      !closest ||
      Math.abs(event.utcTimestamp - referenceTimestamp) <
        Math.abs(closest.utcTimestamp - referenceTimestamp)
        ? event
        : closest,
    undefined,
  );
  const selectedSolarNoonTimestamp = selectedSolarNoon?.utcTimestamp ?? solarNoonTimestamp;
  const showSolarNoonOffsets =
    new Set(apparentSolarNoonEvents.map((event) => event.utcOffset)).size > 1;
  const solarNoonText = apparentSolarNoonEvents.length
    ? apparentSolarNoonEvents
        .map((event) =>
          showSolarNoonOffsets
            ? `${event.localDateTime}（UTC${event.utcOffset}）`
            : event.localDateTime,
        )
        .join('、')
    : '当日无上中天交点';
  const eventArgs = [
    input.latitude,
    input.longitude,
    timezone,
    localMidnightUtcTimestamp,
    localDayEndUtcTimestamp,
    timeZoneId,
  ] as const;
  const sunriseSunset = crossingEvidence('日出/日落', -0.833, ...eventArgs);
  const civilTwilight = crossingEvidence('民用曙暮光', -6, ...eventArgs);
  const nauticalTwilight = crossingEvidence('航海曙暮光', -12, ...eventArgs);
  const astronomicalTwilight = crossingEvidence('天文曙暮光', -18, ...eventArgs);
  const method =
    '参考位置采用太阳星历的视赤道坐标与无折射地平坐标，时间方程由当地视太阳时与平太阳时之差计算；视太阳正午按太阳上中天时角零点求解，日期内高度交点按同一太阳星历计算，日出日落采用标准太阳上缘与近地平折射（太阳中心名义高度约 -0.833°），民用、航海、天文曙暮光分别以太阳中心高度 -6°、-12°、-18° 求交点';
  const source = 'VSOP87 太阳星历，球面天文坐标换算，Meeus《Astronomical Algorithms》';
  const assumptions = [
    '日出日落以太阳上缘和海平面34角分标准折射计算；太阳角半径随距离变化，太阳中心名义高度约 -0.833°。',
    timeZoneId
      ? '同一民用日期按 IANA 历史时区确定日界，并逐事件换算当地钟表时间。'
      : '同一民用日期采用所给固定 UTC 偏移计算事件。',
  ];
  const limitations = [
    '未考虑实际海拔、山体与建筑遮挡、逐时气象折射和局部地平线起伏，实际可见时刻可能偏移。',
    'IANA 历史时区规则由运行环境的时区数据库提供，数据库版本可能影响历史日界与事件当地时刻。',
    '参考位置、视太阳正午和高度交点采用太阳星历，适合民用历法和光照背景；不宣称达到观测级或导航级精度。',
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
        solarDeclinationDegrees: Number(solarDeclinationDegrees.toFixed(6)),
        equationOfTimeMinutes: Number(equationOfTimeMinutes.toFixed(4)),
      },
      promptText: `按太阳星历计算参考时刻无折射太阳高度${solarAltitudeDegrees.toFixed(4)}°、方位${solarAzimuthDegrees.toFixed(4)}°、视赤纬${solarDeclinationDegrees.toFixed(6)}°`,
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
        apparentSolarNoonUtcDateTime: new Date(selectedSolarNoonTimestamp).toISOString(),
        apparentSolarNoonLocalDateTime: formatLocalTimestamp(
          selectedSolarNoonTimestamp,
          timezone,
          timeZoneId,
        ),
        apparentSolarNoonCount: apparentSolarNoonEvents.length,
      },
      promptText: `按太阳上中天时角零点求该民用日的视太阳正午：${solarNoonText}`,
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
        localDayStartUtcDateTime: new Date(localMidnightUtcTimestamp).toISOString(),
        localDayEndUtcDateTimeExclusive: new Date(localDayEndUtcTimestamp).toISOString(),
        crossingCount: 4,
        normalCrossingCount: [
          sunriseSunset,
          civilTwilight,
          nauticalTwilight,
          astronomicalTwilight,
        ].filter((item) => item.status === '正常交点').length,
      },
      promptText: `按标准太阳上缘与近地平折射条件求日出日落，按太阳中心高度 -6°、-12°、-18° 求曙暮光交点，并记录全天状态`,
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
        ? '四类太阳高度阈值均找到至少一次正常交点'
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
  const timezoneContext = formatTimezoneContext(timezone, astronomicalTime.timeZoneId);
  return {
    key: `solar-illumination:${localDate}:${input.latitude}:${input.longitude}:${astronomicalTime.utcDateTime}:${timezoneContext}`,
    status,
    localDate,
    localDayStartUtcDateTime: new Date(localMidnightUtcTimestamp).toISOString(),
    localDayEndUtcDateTimeExclusive: new Date(localDayEndUtcTimestamp).toISOString(),
    referenceLocalDateTime: astronomicalTime.localDateTime,
    referenceUtcDateTime: astronomicalTime.utcDateTime,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone,
    solarAltitudeDegrees: Number(solarAltitudeDegrees.toFixed(4)),
    solarAzimuthDegrees: Number(solarAzimuthDegrees.toFixed(4)),
    solarDeclinationDegrees: Number(solarDeclinationDegrees.toFixed(6)),
    equationOfTimeMinutes: Number(equationOfTimeMinutes.toFixed(4)),
    apparentSolarNoonEvents,
    apparentSolarNoonUtcDateTime: new Date(selectedSolarNoonTimestamp).toISOString(),
    apparentSolarNoonLocalDateTime: formatLocalTimestamp(
      selectedSolarNoonTimestamp,
      timezone,
      timeZoneId,
    ),
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
    promptText: `太阳光照证据：${localDate}，纬度${input.latitude}°、经度${input.longitude}°，参考当地时间${astronomicalTime.localDateTime}太阳高度${solarAltitudeDegrees.toFixed(2)}°、方位角${solarAzimuthDegrees.toFixed(2)}°（真北起顺时针）；计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}；${crossings.map(formatCrossing).join('；')}。交点汇总：${crossingSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。方法：${method}。来源：${source}。假设：${assumptions.join('；')}。限制：${limitations.join('；')}`,
  };
}
