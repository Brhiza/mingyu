import type { BirthProfileTimeRange } from './time-range';
import {
  normalizedBirthProfileToAlmanacParticipant,
  normalizedBirthProfileToAstrolabeInput,
  normalizedBirthProfileToBaziPerson,
  normalizedBirthProfileToQizhengInput,
  normalizedBirthProfileToZiweiChartInput,
} from './adapters';
export type { BirthProfileTimeRange, BirthRangeBatch, BirthRangeBatchOptions } from './time-range';
export {
  birthProfileAtRangeTimestamp,
  resolveBirthRangeBatch,
  validateBirthProfileTimeRange,
} from './time-range';
import {
  resolveBirthCalendarClockTime,
  resolveTrueSolarBirthTime,
  type SolarDateTimeParts,
  type TrueSolarTimeEvidenceFields,
} from '../calendar/true-solar-time';
import { getShichenByIndex, getTimeIndexFromClock } from '../calendar/dateUtils';
import { resolveChinaStandardBirthTime } from '../calendar/china-dst';
import { baziCalculator } from '../bazi/baziCalculator';
import type { BaziChartResult, Person } from '../bazi/baziTypes';
import type { AlmanacParticipantInput, AstrolabeBirthInput } from '../types/divination';
import type { ChartInput } from '../types/chart';
import type { QizhengInput } from '../qi_zheng';
import { MingyuCoreError, type CoreDiagnostic } from '../shared/result';
import { resolveBirthPlace, type BirthPlaceCoordinateAccuracy } from '../location';
import {
  buildBirthTimeEvidence,
  type BirthTimeEvidence,
  type BirthTimeInputMode,
  type BirthTimePrecision,
} from './evidence';
export {
  clampNumericField,
  validateBirthInput,
  type BirthInputFields,
  type BirthInputText,
  type BirthInputValidationResult,
} from './input';

export type {
  BirthTimeCalculationStep,
  BirthTimeEvidence,
  BirthTimeInputFact,
  BirthTimeInputMode,
  BirthTimeLimitationFact,
  BirthTimePrecision,
  BirthTimeSummaryFact,
} from './evidence';

export type BirthGender = 'male' | 'female' | 'unspecified';
export type BirthCalendarType = 'solar' | 'lunar';

export interface BirthProfileLocation {
  /** 中国省、市、区行政区代码；提供后可自动补全地点名称和坐标。 */
  regionId?: string;
  name?: string;
  longitude?: number;
  latitude?: number;
  /** 当地标准时区，例如中国为 UTC+8。 */
  timezone?: number;
  /** IANA 历史时区，例如 America/New_York。 */
  timeZoneId?: string;
}

export interface ResolvedBirthProfileLocation {
  regionId?: string;
  name?: string;
  longitude: number;
  latitude?: number;
  timezone?: number;
  timeZoneId?: string;
  coordinateAccuracy?: BirthPlaceCoordinateAccuracy | 'user-provided' | 'mixed';
}

/**
 * 跨算法复用的出生档案。
 *
 * 此类型只描述客观出生输入，不包含页面状态、报告偏好或用户历史。
 */
export interface BirthProfile {
  id?: string;
  name?: string;
  gender: BirthGender;
  calendarType: BirthCalendarType;
  year: number;
  month: number;
  day: number;
  /** 精准出生小时；与 minute 成对提供。 */
  hour?: number;
  /** 精准出生分钟；与 hour 成对提供。 */
  minute?: number;
  /** 明确传统时辰索引，范围 0-12；未启用真太阳时时可替代精准时分。 */
  timeIndex?: number;
  /** 出生秒数；需与完整的 hour、minute 同时提供。 */
  second?: number;
  isLeapMonth?: boolean;
  location?: BirthProfileLocation;
  useTrueSolarTime?: boolean;
  applyChinaDst?: boolean;
  /** 四柱反推保留的完整出生区间；统一排盘入口按有界批次计算每一秒。 */
  birthTimeRange?: BirthProfileTimeRange;
}

export type BirthProfileDiagnosticCode =
  | 'LOCATION_REQUIRED_FOR_TRUE_SOLAR_TIME'
  | 'LOCATION_NOT_FOUND'
  | 'LOCATION_COORDINATES_REQUIRED'
  | 'TIMEZONE_REQUIRED'
  | 'LATITUDE_REQUIRED'
  | 'GENDER_REQUIRED'
  | 'TIME_REQUIRED'
  | 'PRECISE_TIME_REQUIRED'
  | 'TIME_INPUT_CONFLICT'
  | 'TIME_RANGE_REQUIRES_BATCH';

export type BirthProfileDiagnostic = CoreDiagnostic<BirthProfileDiagnosticCode>;

export interface NormalizedBirthProfile {
  profile: BirthProfile;
  /** 已按行政区代码补全并校验的实际排盘地点。 */
  resolvedLocation?: ResolvedBirthProfileLocation;
  solarClockTime: SolarDateTimeParts;
  effectiveTime: SolarDateTimeParts;
  timeIndex: number;
  timeInputMode: BirthTimeInputMode;
  timePrecision: BirthTimePrecision;
  usedTrueSolarTime: boolean;
  usedChinaDstCorrection: boolean;
  trueSolarEvidence?: TrueSolarTimeEvidenceFields;
  timeEvidence: BirthTimeEvidence;
  diagnostics: BirthProfileDiagnostic[];
}

export class BirthProfileError extends MingyuCoreError<BirthProfileDiagnosticCode> {
  constructor(diagnostic: BirthProfileDiagnostic) {
    super({
      code: diagnostic.code,
      category: diagnostic.code.includes('REQUIRED') ? 'validation' : 'boundary',
      message: diagnostic.message,
      field: diagnostic.field,
      recoverable: diagnostic.recoverable ?? true,
      diagnostics: [diagnostic],
    });
    this.name = 'BirthProfileError';
  }
}

function assertIntegerInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label}需在 ${min}-${max} 之间。`);
  }
}

function assertFiniteInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label}需在 ${min} 到 ${max} 之间。`);
  }
}

function assertBirthProfileLocationShape(location: BirthProfileLocation): void {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new TypeError('出生地点必须是地点资料对象。');
  }
  if (location.longitude !== undefined) {
    assertFiniteInRange(location.longitude, '出生地经度', -180, 180);
  }
  if (location.latitude !== undefined) {
    assertFiniteInRange(location.latitude, '出生地纬度', -90, 90);
  }
  if (location.timezone !== undefined) {
    assertFiniteInRange(location.timezone, '时区', -12, 14);
  }
  if (
    location.timeZoneId !== undefined &&
    (typeof location.timeZoneId !== 'string' || !location.timeZoneId.trim())
  ) {
    throw new TypeError('IANA 时区名不能为空。');
  }
}

function assertProfileShape(profile: BirthProfile): void {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new TypeError('出生档案必须是对象。');
  }
  if (!['male', 'female', 'unspecified'].includes(profile.gender)) {
    throw new TypeError('出生档案性别必须是 male、female 或 unspecified。');
  }
  if (profile.calendarType !== 'solar' && profile.calendarType !== 'lunar') {
    throw new TypeError('出生档案日历类型必须是 solar 或 lunar。');
  }
  assertIntegerInRange(profile.year, '出生年份', 1900, 2100);
  assertIntegerInRange(profile.month, '出生月份', 1, 12);
  assertIntegerInRange(profile.day, '出生日期', 1, 31);
  if (profile.location !== undefined) {
    assertBirthProfileLocationShape(profile.location);
  }
  if (profile.useTrueSolarTime !== undefined && typeof profile.useTrueSolarTime !== 'boolean') {
    throw new TypeError('useTrueSolarTime 必须是布尔值。');
  }
  if (profile.applyChinaDst !== undefined && typeof profile.applyChinaDst !== 'boolean') {
    throw new TypeError('applyChinaDst 必须是布尔值。');
  }
}

/** 将行政区代码或显式坐标统一为可直接排盘的出生地点。 */
export function resolveBirthProfileLocation(
  location?: BirthProfileLocation,
): ResolvedBirthProfileLocation | undefined {
  if (location === undefined) return undefined;
  assertBirthProfileLocationShape(location);
  const region = location.regionId ? resolveBirthPlace(location.regionId) : null;

  if (location.regionId && !region) {
    throw new BirthProfileError({
      code: 'LOCATION_NOT_FOUND',
      level: 'error',
      field: 'location.regionId',
      message: `未找到行政区代码 ${location.regionId}，请检查出生地区。`,
    });
  }
  if (location.longitude === undefined && !region) {
    throw new BirthProfileError({
      code: 'LOCATION_COORDINATES_REQUIRED',
      level: 'error',
      field: 'location.longitude',
      message: '出生地点需要提供有效行政区代码或经度。',
    });
  }
  if (location.timezone === undefined && !location.timeZoneId && !region) {
    throw new BirthProfileError({
      code: 'TIMEZONE_REQUIRED',
      level: 'error',
      field: 'location.timezone',
      message: '自定义出生地点需要提供 timezone 或 timeZoneId。',
    });
  }

  const latitude = location.latitude ?? region?.latitude;
  const hasExplicitLongitude = location.longitude !== undefined;
  const hasExplicitLatitude = location.latitude !== undefined;
  const coordinateAccuracy =
    region && hasExplicitLongitude !== hasExplicitLatitude
      ? 'mixed'
      : hasExplicitLongitude || hasExplicitLatitude
        ? 'user-provided'
        : region?.coordinateAccuracy;
  return {
    regionId: region?.regionId ?? location.regionId,
    name: location.name ?? region?.displayName,
    longitude: location.longitude ?? region!.longitude,
    latitude,
    timezone: location.timezone ?? (location.timeZoneId ? undefined : region?.timezone),
    ...(location.timeZoneId ? { timeZoneId: location.timeZoneId.trim() } : {}),
    coordinateAccuracy,
  };
}

interface ResolvedBirthTimeInput {
  inputMode: BirthTimeInputMode;
  hour: number;
  minute: number;
  timeIndex: number;
}

function throwBirthTimeError(
  code: Extract<
    BirthProfileDiagnosticCode,
    'TIME_REQUIRED' | 'PRECISE_TIME_REQUIRED' | 'TIME_INPUT_CONFLICT' | 'TIME_RANGE_REQUIRES_BATCH'
  >,
  message: string,
  field: string,
): never {
  throw new BirthProfileError({
    code,
    level: 'error',
    field,
    message,
  });
}

function resolveBirthTimeInput(profile: BirthProfile): ResolvedBirthTimeInput {
  const hasHour = profile.hour !== undefined;
  const hasMinute = profile.minute !== undefined;
  const hasPreciseTime = hasHour && hasMinute;
  const hasTimeIndex = profile.timeIndex !== undefined;

  if (hasHour !== hasMinute) {
    throwBirthTimeError(
      'TIME_REQUIRED',
      '出生小时和分钟必须同时提供；也可以改为只提供明确的传统时辰。',
      hasHour ? 'minute' : 'hour',
    );
  }
  if (profile.second !== undefined && !hasPreciseTime) {
    throwBirthTimeError(
      'PRECISE_TIME_REQUIRED',
      '出生秒数必须与完整的出生小时和分钟同时提供。',
      'second',
    );
  }
  if (!hasPreciseTime && !hasTimeIndex) {
    throwBirthTimeError(
      'TIME_REQUIRED',
      '请提供明确的出生时辰，或完整的出生小时和分钟。',
      'timeIndex',
    );
  }

  let selectedTimeIndex: number | undefined;
  if (hasTimeIndex) {
    const shichen = getShichenByIndex(profile.timeIndex!);
    if (!shichen) {
      throw new RangeError('出生时辰索引需在 0-12 之间。');
    }
    selectedTimeIndex = shichen.index;
  }

  if (hasPreciseTime) {
    const hour = profile.hour!;
    const minute = profile.minute!;
    assertIntegerInRange(hour, '出生小时', 0, 23);
    assertIntegerInRange(minute, '出生分钟', 0, 59);
    const preciseTimeIndex = getTimeIndexFromClock(hour, minute);
    if (selectedTimeIndex !== undefined && selectedTimeIndex !== preciseTimeIndex) {
      throwBirthTimeError(
        'TIME_INPUT_CONFLICT',
        `精准出生时间对应时辰索引 ${preciseTimeIndex}，与已提供的时辰索引 ${selectedTimeIndex} 不一致。`,
        'timeIndex',
      );
    }
    return {
      inputMode: 'precise-clock-time',
      hour,
      minute,
      timeIndex: preciseTimeIndex,
    };
  }

  if (profile.useTrueSolarTime) {
    throwBirthTimeError(
      'PRECISE_TIME_REQUIRED',
      '真太阳时必须提供完整的出生小时和分钟，不能使用传统时辰代表值。',
      'hour',
    );
  }
  const shichen = getShichenByIndex(selectedTimeIndex!);
  if (!shichen) throw new Error('出生时辰状态异常。');
  return {
    inputMode: 'traditional-shichen',
    hour: shichen.hour,
    minute: shichen.minute,
    timeIndex: shichen.index,
  };
}

/**
 * 校验并统一出生档案的时间口径。
 *
 * 未启用真太阳时时，可直接提供明确传统时辰；启用真太阳时时必须提供完整小时和分钟。
 * 两种模式都只形成一个确定结果，不生成候选盘、敏感性结果或缺时柱命盘。
 */
export function normalizeBirthProfile(profile: BirthProfile): NormalizedBirthProfile {
  assertProfileShape(profile);
  if (profile.birthTimeRange !== undefined) {
    throwBirthTimeError(
      'TIME_RANGE_REQUIRES_BATCH',
      '出生区间需通过统一排盘入口逐秒分批计算。',
      'birthTimeRange',
    );
  }
  const diagnostics: BirthProfileDiagnostic[] = [];
  const resolvedLocation = resolveBirthProfileLocation(profile.location);
  const timeInput = resolveBirthTimeInput(profile);
  const { hour, minute } = timeInput;

  if (profile.useTrueSolarTime && !resolvedLocation) {
    diagnostics.push({
      code: 'LOCATION_REQUIRED_FOR_TRUE_SOLAR_TIME',
      level: 'error',
      field: 'location',
      message: '真太阳时需要出生地经度和时区。',
    });
  }

  const second = profile.second ?? 0;
  assertIntegerInRange(second, '出生秒数', 0, 59);

  if (profile.useTrueSolarTime && resolvedLocation) {
    const resolved = resolveTrueSolarBirthTime({
      dateType: profile.calendarType,
      year: profile.year,
      month: profile.month,
      day: profile.day,
      hour,
      minute,
      second,
      isLeapMonth: profile.isLeapMonth,
      longitude: resolvedLocation.longitude,
      timezone: resolvedLocation.timezone ?? (resolvedLocation.timeZoneId ? undefined : 8),
      timeZoneId: resolvedLocation.timeZoneId,
      applyChinaDst: profile.applyChinaDst,
    });
    const selectedShichen = getShichenByIndex(resolved.timeIndex);
    if (!selectedShichen) throw new Error('真太阳时时辰状态异常。');
    const trueSolarEvidence: TrueSolarTimeEvidenceFields = {
      key: resolved.key,
      status: resolved.status,
      calculationSteps: resolved.calculationSteps,
      calculationChain: resolved.calculationChain,
      correctionFacts: resolved.correctionFacts,
      summaryFact: resolved.summaryFact,
      limitations: resolved.limitations,
      limitationFacts: resolved.limitationFacts,
      timezoneEvidence: resolved.timezoneEvidence,
      source: resolved.source,
      promptText: resolved.promptText,
    };
    const timeEvidence = buildBirthTimeEvidence({
      inputMode: timeInput.inputMode,
      calendarType: profile.calendarType,
      originalDate: {
        year: profile.year,
        month: profile.month,
        day: profile.day,
        isLeapMonth: profile.isLeapMonth ?? false,
      },
      inputHour: hour,
      inputMinute: minute,
      inputSecond: profile.second,
      selectedShichen,
      solarClockTime: resolved.solarClockTime,
      effectiveTime: resolved.correctedTime,
      usedTrueSolarTime: true,
      requestedTrueSolarTime: true,
      trueSolarEvidence,
      diagnostics,
    });
    return {
      profile,
      resolvedLocation,
      solarClockTime: resolved.solarClockTime,
      effectiveTime: resolved.correctedTime,
      timeIndex: resolved.timeIndex,
      timeInputMode: timeInput.inputMode,
      timePrecision: timeEvidence.precision,
      usedTrueSolarTime: true,
      usedChinaDstCorrection: resolved.chinaDst.applied,
      trueSolarEvidence,
      timeEvidence,
      diagnostics,
    };
  }

  const solarClockTime = resolveBirthCalendarClockTime({
    dateType: profile.calendarType,
    year: profile.year,
    month: profile.month,
    day: profile.day,
    hour,
    minute,
    second,
    isLeapMonth: profile.isLeapMonth,
  });
  // 仅精准钟表时间可还原历史夏令时的唯一瞬时；传统时辰没有可校正的分钟。
  const standardBirthTime =
    timeInput.inputMode === 'precise-clock-time'
      ? resolveChinaStandardBirthTime({
          ...solarClockTime,
          timezone: resolvedLocation?.timezone,
          timeZoneId: resolvedLocation?.timeZoneId,
          applyChinaDst: profile.applyChinaDst,
        })
      : undefined;
  const usedChinaDstCorrection = standardBirthTime?.usedChinaDstCorrection === true;
  const effectiveTime = standardBirthTime?.effectiveTime ?? solarClockTime;
  const selectedShichen = getShichenByIndex(
    usedChinaDstCorrection
      ? getTimeIndexFromClock(effectiveTime.hour, effectiveTime.minute)
      : timeInput.timeIndex,
  );
  if (!selectedShichen) throw new Error('出生时辰状态异常。');
  const timeEvidence = buildBirthTimeEvidence({
    inputMode: timeInput.inputMode,
    calendarType: profile.calendarType,
    originalDate: {
      year: profile.year,
      month: profile.month,
      day: profile.day,
      isLeapMonth: profile.isLeapMonth ?? false,
    },
    inputHour: hour,
    inputMinute: minute,
    inputSecond: profile.second,
    selectedShichen,
    solarClockTime,
    effectiveTime,
    ...(usedChinaDstCorrection
      ? {
          chinaDstEvidence: {
            offsetMinutes: -60,
            standardTimezone: 8,
            utcDateTime: standardBirthTime!.utcDateTime,
          },
        }
      : {}),
    usedTrueSolarTime: false,
    requestedTrueSolarTime: profile.useTrueSolarTime ?? false,
    diagnostics,
  });
  return {
    profile,
    resolvedLocation,
    solarClockTime,
    effectiveTime,
    timeIndex: selectedShichen.index,
    timeInputMode: timeInput.inputMode,
    timePrecision: timeEvidence.precision,
    usedTrueSolarTime: false,
    usedChinaDstCorrection,
    timeEvidence,
    diagnostics,
  };
}

/** 将统一档案转换为八字既有输入。 */
export function birthProfileToBaziPerson(profile: BirthProfile): Person {
  return normalizedBirthProfileToBaziPerson(normalizeBirthProfile(profile));
}

/** 直接按统一出生档案生成八字传统盘数据。 */
export function calculateBaziFromBirthProfile(profile: BirthProfile): BaziChartResult {
  return baziCalculator.calculateBazi(birthProfileToBaziPerson(profile));
}

/** 将统一出生档案转换为紫微斗数传统盘的 ChartInput。 */
export function birthProfileToZiweiChartInput(profile: BirthProfile): ChartInput {
  return normalizedBirthProfileToZiweiChartInput(normalizeBirthProfile(profile));
}

/** 将统一出生档案转换为星盘既有输入。星盘必须有经纬度和准确时辰。 */
export function birthProfileToAstrolabeInput(profile: BirthProfile): AstrolabeBirthInput {
  return normalizedBirthProfileToAstrolabeInput(normalizeBirthProfile(profile));
}

/**
 * 将统一出生档案转换为七政四余输入。
 *
 * 七政四余只接受公历时刻。IANA 时区模式传原始民用钟表时间，由引擎解析
 * 历史法定偏移；固定偏移模式先还原中国历史夏令时的标准时间。
 */
export function birthProfileToQizhengInput(profile: BirthProfile): QizhengInput {
  return normalizedBirthProfileToQizhengInput(normalizeBirthProfile(profile));
}

/** 将统一档案转换为择日参与人既有输入。 */
export function birthProfileToAlmanacParticipant(
  profile: BirthProfile,
  id = profile.id ?? 'participant',
): AlmanacParticipantInput {
  return normalizedBirthProfileToAlmanacParticipant(normalizeBirthProfile(profile), id);
}
