import { resolveTrueSolarBirthTime, type SolarDateTimeParts } from '../calendar/true-solar-time';
import { getTimeIndexFromClock } from '../calendar/dateUtils';
import type { Person } from '../bazi/baziTypes';
import type { AlmanacParticipantInput, AstrolabeBirthInput } from '../types/divination';
import { MingyuCoreError, type CoreDiagnostic } from '../shared/result';

export type BirthGender = 'male' | 'female' | 'unspecified';
export type BirthCalendarType = 'solar' | 'lunar';

export interface BirthProfileLocation {
  name?: string;
  longitude: number;
  latitude?: number;
  /** 当地标准时区，例如中国为 UTC+8。 */
  timezone?: number;
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
  hour?: number;
  minute?: number;
  second?: number;
  unknownTime?: boolean;
  isLeapMonth?: boolean;
  location?: BirthProfileLocation;
  useTrueSolarTime?: boolean;
  applyChinaDst?: boolean;
}

export type BirthProfileDiagnosticCode =
  | 'UNKNOWN_BIRTH_TIME'
  | 'TIME_IGNORED_WHEN_UNKNOWN'
  | 'LOCATION_REQUIRED_FOR_TRUE_SOLAR_TIME'
  | 'LATITUDE_REQUIRED'
  | 'GENDER_REQUIRED'
  | 'TIME_REQUIRED';

export type BirthProfileDiagnostic = CoreDiagnostic<BirthProfileDiagnosticCode>;

export interface NormalizedBirthProfile {
  profile: BirthProfile;
  hasKnownTime: boolean;
  solarClockTime?: SolarDateTimeParts;
  effectiveTime?: SolarDateTimeParts;
  timeIndex?: number;
  usedTrueSolarTime: boolean;
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
    assertFiniteInRange(profile.location.longitude, '出生地经度', -180, 180);
    if (profile.location.latitude !== undefined) {
      assertFiniteInRange(profile.location.latitude, '出生地纬度', -90, 90);
    }
    if (profile.location.timezone !== undefined) {
      assertFiniteInRange(profile.location.timezone, '时区', -12, 14);
    }
  }
}

/**
 * 校验并统一出生档案的时间口径。
 *
 * 未知时辰不会被静默替换为中午或子时；调用方可根据 hasKnownTime 和
 * diagnostics 决定降级展示，必须依赖时辰的算法则使用下方适配函数明确报错。
 */
export function normalizeBirthProfile(profile: BirthProfile): NormalizedBirthProfile {
  assertProfileShape(profile);
  const diagnostics: BirthProfileDiagnostic[] = [];
  const hasClockFields = profile.hour !== undefined || profile.minute !== undefined;
  const hasCompleteClock = profile.hour !== undefined && profile.minute !== undefined;
  const hasKnownTime = profile.unknownTime !== true && hasCompleteClock;

  if (profile.unknownTime === true) {
    diagnostics.push({
      code: 'UNKNOWN_BIRTH_TIME',
      level: 'warning',
      field: 'unknownTime',
      message: '出生时辰未知，仅可使用不依赖时柱或宫位起点的稳定结论。',
    });
    if (hasClockFields) {
      diagnostics.push({
        code: 'TIME_IGNORED_WHEN_UNKNOWN',
        level: 'info',
        field: 'hour',
        message: '已标记未知时辰，传入的小时和分钟不会参与计算。',
      });
    }
  } else if (!hasKnownTime) {
    diagnostics.push({
      code: 'TIME_REQUIRED',
      level: 'error',
      field: 'hour',
      message: '请提供出生小时和分钟，或明确设置 unknownTime: true。',
    });
  }

  if (profile.useTrueSolarTime && !profile.location) {
    diagnostics.push({
      code: 'LOCATION_REQUIRED_FOR_TRUE_SOLAR_TIME',
      level: 'error',
      field: 'location',
      message: '真太阳时需要出生地经度和时区。',
    });
  }

  if (!hasKnownTime) {
    // 未知时辰也必须校验出生日期；用正午只做历法转换，不把该时间写入结果。
    resolveTrueSolarBirthTime({
      dateType: profile.calendarType,
      year: profile.year,
      month: profile.month,
      day: profile.day,
      hour: 12,
      minute: 0,
      isLeapMonth: profile.isLeapMonth,
      longitude: 120,
      timezone: 8,
      applyChinaDst: false,
    });
    return {
      profile: { ...profile, hour: undefined, minute: undefined, second: undefined },
      hasKnownTime: false,
      usedTrueSolarTime: false,
      diagnostics,
    };
  }

  const hour = profile.hour;
  const minute = profile.minute;
  if (hour === undefined || minute === undefined) {
    throw new Error('出生时间状态异常。');
  }
  assertIntegerInRange(hour, '出生小时', 0, 23);
  assertIntegerInRange(minute, '出生分钟', 0, 59);
  const second = profile.second ?? 0;
  assertIntegerInRange(second, '出生秒数', 0, 59);

  if (profile.useTrueSolarTime && profile.location) {
    const resolved = resolveTrueSolarBirthTime({
      dateType: profile.calendarType,
      year: profile.year,
      month: profile.month,
      day: profile.day,
      hour,
      minute,
      second,
      isLeapMonth: profile.isLeapMonth,
      longitude: profile.location.longitude,
      timezone: profile.location.timezone ?? 8,
      applyChinaDst: profile.applyChinaDst,
    });
    return {
      profile,
      hasKnownTime: true,
      solarClockTime: resolved.solarClockTime,
      effectiveTime: resolved.correctedTime,
      timeIndex: resolved.timeIndex,
      usedTrueSolarTime: true,
      diagnostics,
    };
  }

  // 即使不启用真太阳时，也通过统一入口完成农历转公历和日期合法性校验。
  const location = profile.location;
  const resolved = resolveTrueSolarBirthTime({
    dateType: profile.calendarType,
    year: profile.year,
    month: profile.month,
    day: profile.day,
    hour,
    minute,
    second,
    isLeapMonth: profile.isLeapMonth,
    longitude: (location?.timezone ?? 8) * 15,
    timezone: location?.timezone ?? 8,
    applyChinaDst: false,
  });
  return {
    profile,
    hasKnownTime: true,
    solarClockTime: resolved.solarClockTime,
    effectiveTime: resolved.solarClockTime,
    timeIndex: getTimeIndexFromClock(resolved.solarClockTime.hour, resolved.solarClockTime.minute),
    usedTrueSolarTime: false,
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
  if (
    !result.hasKnownTime ||
    !result.solarClockTime ||
    !result.effectiveTime ||
    result.timeIndex === undefined
  ) {
    throw new BirthProfileError({
      code: 'TIME_REQUIRED',
      level: 'error',
      field: 'hour',
      message: '此算法必须提供准确出生时辰，未知时辰不能使用占位值代替。',
    });
  }
}

/** 将统一档案转换为八字既有输入。 */
export function birthProfileToBaziPerson(profile: BirthProfile): Person {
  const normalized = normalizeBirthProfile(profile);
  requireReady(normalized);
  const clock = normalized.solarClockTime;
  return {
    year: profile.year,
    month: profile.month,
    day: profile.day,
    timeIndex: normalized.timeIndex,
    gender: profile.gender === 'unspecified' ? '' : profile.gender,
    isLunar: profile.calendarType === 'lunar',
    isLeapMonth: profile.isLeapMonth,
    useTrueSolarTime: profile.useTrueSolarTime,
    birthHour: clock.hour,
    birthMinute: clock.minute,
    birthPlace: profile.location?.name,
    birthLongitude: profile.location?.longitude,
    applyChinaDst: profile.applyChinaDst,
  };
}

/** 将统一档案转换为星盘既有输入。星盘必须有经纬度和准确时辰。 */
export function birthProfileToAstrolabeInput(profile: BirthProfile): AstrolabeBirthInput {
  const normalized = normalizeBirthProfile(profile);
  const locationDiagnostic: BirthProfileDiagnostic | undefined =
    profile.location?.latitude === undefined
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
  requireReady(normalized, locationDiagnostic ?? genderDiagnostic);
  const clock = normalized.solarClockTime;
  const location = profile.location;
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
    timezone: String(location.timezone ?? 8),
    locationName: location.name,
    useTrueSolarTime: profile.useTrueSolarTime,
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
