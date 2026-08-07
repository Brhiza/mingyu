import {
  resolveBirthCalendarClockTime,
  resolveTrueSolarBirthTime,
  type SolarDateTimeParts,
  type TrueSolarTimeEvidenceFields,
} from '../calendar/true-solar-time';
import { getShichenByIndex, getTimeIndexFromClock } from '../calendar/dateUtils';
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
  second?: number;
  isLeapMonth?: boolean;
  location?: BirthProfileLocation;
  useTrueSolarTime?: boolean;
  applyChinaDst?: boolean;
}

export type BirthProfileDiagnosticCode =
  | 'LOCATION_REQUIRED_FOR_TRUE_SOLAR_TIME'
  | 'LOCATION_NOT_FOUND'
  | 'LOCATION_COORDINATES_REQUIRED'
  | 'LATITUDE_REQUIRED'
  | 'GENDER_REQUIRED'
  | 'TIME_REQUIRED'
  | 'PRECISE_TIME_REQUIRED'
  | 'TIME_INPUT_CONFLICT';

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
  if (profile.location) {
    if (profile.location.longitude !== undefined) {
      assertFiniteInRange(profile.location.longitude, '出生地经度', -180, 180);
    }
    if (profile.location.latitude !== undefined) {
      assertFiniteInRange(profile.location.latitude, '出生地纬度', -90, 90);
    }
    if (profile.location.timezone !== undefined) {
      assertFiniteInRange(profile.location.timezone, '时区', -12, 14);
    }
    if (
      profile.location.timeZoneId !== undefined &&
      (typeof profile.location.timeZoneId !== 'string' || !profile.location.timeZoneId.trim())
    ) {
      throw new TypeError('IANA 时区名不能为空。');
    }
  }
}

/** 将行政区代码或显式坐标统一为可直接排盘的出生地点。 */
export function resolveBirthProfileLocation(
  location?: BirthProfileLocation,
): ResolvedBirthProfileLocation | undefined {
  if (!location) return undefined;
  const region = location.regionId ? resolveBirthPlace(location.regionId) : null;

  if (location.regionId && !region && location.longitude === undefined) {
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
    timezone: location.timezone ?? (location.timeZoneId ? undefined : (region?.timezone ?? 8)),
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
    'TIME_REQUIRED' | 'PRECISE_TIME_REQUIRED' | 'TIME_INPUT_CONFLICT'
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
      timePrecision: 'minute',
      usedTrueSolarTime: true,
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
  const selectedShichen = getShichenByIndex(timeInput.timeIndex);
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
    selectedShichen,
    solarClockTime,
    effectiveTime: solarClockTime,
    usedTrueSolarTime: false,
    requestedTrueSolarTime: profile.useTrueSolarTime ?? false,
    diagnostics,
  });
  return {
    profile,
    resolvedLocation,
    solarClockTime,
    effectiveTime: solarClockTime,
    timeIndex: timeInput.timeIndex,
    timeInputMode: timeInput.inputMode,
    timePrecision: timeInput.inputMode === 'traditional-shichen' ? 'shichen' : 'minute',
    usedTrueSolarTime: false,
    timeEvidence,
    diagnostics,
  };
}

function requireReady(
  result: NormalizedBirthProfile,
  extraDiagnostic?: BirthProfileDiagnostic,
): asserts result is NormalizedBirthProfile & {
  solarClockTime: SolarDateTimeParts;
  effectiveTime: SolarDateTimeParts;
  timeIndex: number;
} {
  const blocking = extraDiagnostic ?? result.diagnostics.find((item) => item.level === 'error');
  if (blocking) throw new BirthProfileError(blocking);
}

/** 将统一档案转换为八字既有输入。 */
export function birthProfileToBaziPerson(profile: BirthProfile): Person {
  const normalized = normalizeBirthProfile(profile);
  requireReady(normalized);
  const clock = normalized.solarClockTime;
  const location = normalized.resolvedLocation;
  const useTrueSolarTime = profile.useTrueSolarTime === true;
  return {
    // 真太阳时前先把农历输入落成公历钟表时间，避免 BaziCalculator 再次把
    // 已换算的时间按农历解释；真太阳时校正仍由 BaziCalculator 统一执行一次。
    year: useTrueSolarTime ? clock.year : profile.year,
    month: useTrueSolarTime ? clock.month : profile.month,
    day: useTrueSolarTime ? clock.day : profile.day,
    timeIndex: normalized.timeIndex,
    gender: profile.gender === 'unspecified' ? '' : profile.gender,
    isLunar: useTrueSolarTime ? false : profile.calendarType === 'lunar',
    isLeapMonth: useTrueSolarTime ? false : profile.isLeapMonth,
    useTrueSolarTime,
    ...(normalized.timePrecision === 'minute'
      ? { birthHour: clock.hour, birthMinute: clock.minute }
      : {}),
    birthPlace: location?.name,
    birthLongitude: location?.longitude,
    timezone: location?.timezone,
    timeZoneId: location?.timeZoneId,
    applyChinaDst: profile.applyChinaDst,
  };
}

/** 直接按统一出生档案生成八字传统盘数据。 */
export function calculateBaziFromBirthProfile(profile: BirthProfile): BaziChartResult {
  return baziCalculator.calculateBazi(birthProfileToBaziPerson(profile));
}

function formatBirthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 将统一出生档案转换为紫微斗数传统盘的 ChartInput。 */
export function birthProfileToZiweiChartInput(profile: BirthProfile): ChartInput {
  const normalized = normalizeBirthProfile(profile);
  const genderDiagnostic: BirthProfileDiagnostic | undefined =
    profile.gender === 'unspecified'
      ? {
          code: 'GENDER_REQUIRED',
          level: 'error',
          field: 'gender',
          message: '紫微斗数排盘需要明确性别。',
        }
      : undefined;
  requireReady(normalized, genderDiagnostic);

  const useTrueSolarTime = profile.useTrueSolarTime === true;
  const date = useTrueSolarTime ? normalized.effectiveTime : undefined;
  return {
    name: profile.name ?? '',
    gender: profile.gender === 'male' ? '男' : '女',
    dateType: useTrueSolarTime ? 'solar' : profile.calendarType,
    birthDate: date
      ? formatBirthDate(date.year, date.month, date.day)
      : formatBirthDate(profile.year, profile.month, profile.day),
    birthTimeIndex: normalized.timeIndex,
    trueSolarEvidence: normalized.trueSolarEvidence,
    isLeapMonth: useTrueSolarTime ? false : profile.isLeapMonth,
    fixLeap: true,
    algorithm: 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
    dayDivide: 'forward',
  };
}

/** 将统一出生档案转换为星盘既有输入。星盘必须有经纬度和准确时辰。 */
export function birthProfileToAstrolabeInput(profile: BirthProfile): AstrolabeBirthInput {
  const normalized = normalizeBirthProfile(profile);
  const location = normalized.resolvedLocation;
  const preciseTimeDiagnostic: BirthProfileDiagnostic | undefined =
    normalized.timePrecision !== 'minute'
      ? {
          code: 'PRECISE_TIME_REQUIRED',
          level: 'error',
          field: 'hour',
          message: '星盘必须提供精确到分钟的出生时间，不能使用传统时辰代表值。',
        }
      : undefined;
  const locationDiagnostic: BirthProfileDiagnostic | undefined =
    location?.latitude === undefined
      ? {
          code: 'LATITUDE_REQUIRED',
          level: 'error',
          field: 'location.latitude',
          message: '星盘必须提供出生地纬度。',
        }
      : undefined;
  const genderDiagnostic: BirthProfileDiagnostic | undefined =
    profile.gender === 'unspecified'
      ? {
          code: 'GENDER_REQUIRED',
          level: 'error',
          field: 'gender',
          message: '星盘现有输入需要明确性别。',
        }
      : undefined;
  requireReady(normalized, preciseTimeDiagnostic ?? locationDiagnostic ?? genderDiagnostic);
  const clock = normalized.solarClockTime;
  if (!location || location.latitude === undefined) throw new Error('出生地状态异常。');
  return {
    name: profile.name ?? '',
    gender: profile.gender === 'male' ? '男' : '女',
    year: String(clock.year),
    month: String(clock.month),
    day: String(clock.day),
    hour: String(clock.hour),
    minute: String(clock.minute),
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    ...(location.timezone !== undefined ? { timezone: String(location.timezone) } : {}),
    ...(location.timeZoneId ? { timeZoneId: location.timeZoneId } : {}),
    locationName: location.name,
    useTrueSolarTime: profile.useTrueSolarTime,
  };
}

/**
 * 将统一出生档案转换为七政四余输入。
 *
 * 七政四余只接受公历时刻，因此农历档案先沿用统一档案的公历钟表时间。
 * 启用真太阳时后，把原始民用时间交给七政四余自身校正，避免重复校正；
 * 这与八字、紫微适配器的输出口径不同，调用方不应混用已校正时间。
 */
export function birthProfileToQizhengInput(profile: BirthProfile): QizhengInput {
  const normalized = normalizeBirthProfile(profile);
  requireReady(normalized);
  const clock = normalized.solarClockTime;
  const location = normalized.resolvedLocation;
  return {
    year: clock.year,
    month: clock.month,
    day: clock.day,
    hour: clock.hour,
    minute: clock.minute,
    ...(location?.latitude !== undefined ? { latitude: location.latitude } : {}),
    ...(location?.longitude !== undefined ? { longitude: location.longitude } : {}),
    ...(location?.timezone !== undefined ? { timezone: location.timezone } : {}),
    ...(location?.timeZoneId ? { timeZoneId: location.timeZoneId } : {}),
    useTrueSolarTime: profile.useTrueSolarTime === true,
  };
}

/** 将统一档案转换为择日参与人既有输入。 */
export function birthProfileToAlmanacParticipant(
  profile: BirthProfile,
  id = profile.id ?? 'participant',
): AlmanacParticipantInput {
  const normalized = normalizeBirthProfile(profile);
  const genderDiagnostic: BirthProfileDiagnostic | undefined =
    profile.gender === 'unspecified'
      ? {
          code: 'GENDER_REQUIRED',
          level: 'error',
          field: 'gender',
          message: '择日参与人需要明确性别。',
        }
      : undefined;
  requireReady(normalized, genderDiagnostic);
  const effective = normalized.effectiveTime;
  return {
    id,
    name: profile.name ?? '参与人',
    gender: profile.gender === 'male' ? '男' : '女',
    year: String(effective.year),
    month: String(effective.month),
    day: String(effective.day),
    timeIndex: String(normalized.timeIndex),
    dateType: 'solar',
  };
}
