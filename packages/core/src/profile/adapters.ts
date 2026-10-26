import type { SolarDateTimeParts } from '../calendar/true-solar-time';
import type { Person } from '../bazi/baziTypes';
import type { AlmanacParticipantInput, AstrolabeBirthInput } from '../types/divination';
import type { ChartInput } from '../types/chart';
import type { QizhengInput } from '../qi_zheng';
import {
  BirthProfileError,
  type BirthProfileDiagnostic,
  type NormalizedBirthProfile,
} from './index';

// 仅供已完成规范化的核心调用链复用；公开适配器始终在边界自行规范化。
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

export function normalizedBirthProfileToBaziPerson(normalized: NormalizedBirthProfile): Person {
  requireReady(normalized);
  const { profile } = normalized;
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
    ...(normalized.timeInputMode === 'precise-clock-time'
      ? { birthHour: clock.hour, birthMinute: clock.minute, birthSecond: clock.second }
      : {}),
    birthPlace: location?.name,
    birthLongitude: location?.longitude,
    timezone: location?.timezone,
    timeZoneId: location?.timeZoneId,
    applyChinaDst: profile.applyChinaDst,
  };
}

function formatBirthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizedBirthProfileToZiweiChartInput(
  normalized: NormalizedBirthProfile,
): ChartInput {
  const { profile } = normalized;
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
  const date =
    useTrueSolarTime || normalized.usedChinaDstCorrection ? normalized.effectiveTime : undefined;
  const preciseBirthTime =
    normalized.timeInputMode === 'precise-clock-time' ? normalized.effectiveTime : undefined;
  return {
    name: profile.name ?? '',
    gender: profile.gender === 'male' ? '男' : '女',
    dateType: date ? 'solar' : profile.calendarType,
    birthDate: date
      ? formatBirthDate(date.year, date.month, date.day)
      : formatBirthDate(profile.year, profile.month, profile.day),
    birthTimeIndex: normalized.timeIndex,
    ...(preciseBirthTime
      ? {
          birthTime: {
            hour: preciseBirthTime.hour,
            minute: preciseBirthTime.minute,
            second: preciseBirthTime.second,
          },
        }
      : {}),
    trueSolarEvidence: normalized.trueSolarEvidence,
    isLeapMonth: date ? false : profile.isLeapMonth,
    fixLeap: true,
    algorithm: 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
    dayDivide: 'forward',
  };
}

export function normalizedBirthProfileToAstrolabeInput(
  normalized: NormalizedBirthProfile,
): AstrolabeBirthInput {
  const { profile } = normalized;
  const location = normalized.resolvedLocation;
  const preciseTimeDiagnostic: BirthProfileDiagnostic | undefined =
    normalized.timeInputMode !== 'precise-clock-time'
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
  const clock =
    profile.useTrueSolarTime || location?.timeZoneId
      ? normalized.solarClockTime
      : normalized.effectiveTime;
  if (!location || location.latitude === undefined) throw new Error('出生地状态异常。');
  return {
    name: profile.name ?? '',
    gender: profile.gender === 'male' ? '男' : '女',
    year: String(clock.year),
    month: String(clock.month),
    day: String(clock.day),
    hour: String(clock.hour),
    minute: String(clock.minute),
    ...(profile.second === undefined ? {} : { second: String(clock.second) }),
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    ...(location.timezone !== undefined ? { timezone: String(location.timezone) } : {}),
    ...(location.timeZoneId ? { timeZoneId: location.timeZoneId } : {}),
    // 保留坐标精度登记，使星盘结果可区分用户精确坐标与行政区/省级近似值
    ...(location.coordinateAccuracy ? { coordinateAccuracy: location.coordinateAccuracy } : {}),
    locationName: location.name,
    useTrueSolarTime: profile.useTrueSolarTime,
  };
}

export function normalizedBirthProfileToQizhengInput(
  normalized: NormalizedBirthProfile,
): QizhengInput {
  const { profile } = normalized;
  const preciseTimeDiagnostic: BirthProfileDiagnostic | undefined =
    normalized.timeInputMode !== 'precise-clock-time'
      ? {
          code: 'PRECISE_TIME_REQUIRED',
          level: 'error',
          field: 'hour',
          message: '七政四余必须提供精确到分钟的出生时间，不能使用传统时辰代表值。',
        }
      : undefined;
  requireReady(normalized, preciseTimeDiagnostic);
  const location = normalized.resolvedLocation;
  const clock =
    profile.useTrueSolarTime || location?.timeZoneId
      ? normalized.solarClockTime
      : normalized.effectiveTime;
  if (!location || location.latitude === undefined) {
    throw new BirthProfileError({
      code: 'LATITUDE_REQUIRED',
      level: 'error',
      field: 'location.latitude',
      message: '七政四余必须提供出生地经纬度或可解析的行政区代码。',
    });
  }
  return {
    year: clock.year,
    month: clock.month,
    day: clock.day,
    hour: clock.hour,
    minute: clock.minute,
    second: clock.second,
    latitude: location.latitude,
    longitude: location.longitude,
    ...(location.coordinateAccuracy ? { coordinateAccuracy: location.coordinateAccuracy } : {}),
    ...(location.timezone !== undefined ? { timezone: location.timezone } : {}),
    ...(location.timeZoneId ? { timeZoneId: location.timeZoneId } : {}),
    useTrueSolarTime: profile.useTrueSolarTime === true,
    ...(profile.gender === 'male' || profile.gender === 'female' ? { gender: profile.gender } : {}),
  };
}

export function normalizedBirthProfileToAlmanacParticipant(
  normalized: NormalizedBirthProfile,
  id: string,
): AlmanacParticipantInput {
  const { profile } = normalized;
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
  const useTrueSolarTime = profile.useTrueSolarTime === true;
  const location = normalized.resolvedLocation;
  // 展示字段使用校正时间；真太阳时原始钟表记录另用于按真实瞬时判定节令。
  const participantTime = effective;
  const useCorrectedDate = useTrueSolarTime || normalized.usedChinaDstCorrection;
  return {
    id,
    name: profile.name ?? '参与人',
    gender: profile.gender === 'male' ? '男' : '女',
    year: String(useCorrectedDate ? effective.year : profile.year),
    month: String(useCorrectedDate ? effective.month : profile.month),
    day: String(useCorrectedDate ? effective.day : profile.day),
    timeIndex: String(normalized.timeIndex),
    dateType: useCorrectedDate ? 'solar' : profile.calendarType,
    ...(normalized.timeInputMode === 'precise-clock-time'
      ? {
          birthHour: String(participantTime.hour),
          birthMinute: String(participantTime.minute),
          birthSecond: String(participantTime.second),
        }
      : {}),
    ...(location?.name ? { birthPlace: location.name } : {}),
    ...(location?.longitude !== undefined ? { birthLongitude: String(location.longitude) } : {}),
    ...(!useCorrectedDate && location?.timezone !== undefined
      ? { timezone: location.timezone }
      : {}),
    ...(!useCorrectedDate && location?.timeZoneId ? { timeZoneId: location.timeZoneId } : {}),
    ...(useTrueSolarTime ? { originalTrueSolarProfile: profile } : {}),
  };
}
