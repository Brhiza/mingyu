import { LunarDay, SolarDay } from 'tyme4ts';
import type { Method } from '../method-meta';
import {
  BIRTH_TIME_OPTIONS,
  enrichPlaceCoordinates,
  normalizeTimeIndex,
  type PersonalCase,
} from './cases-store';

export interface ValidatePersonalCaseOptions {
  label?: string;
  forcePreciseBirthPlace?: boolean;
  allowUnknownTime?: boolean;
  inputMode?: 'solar' | 'lunar' | 'pillars';
}

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function validatePersonalCase(
  person: Partial<PersonalCase>,
  options: ValidatePersonalCaseOptions = {},
): ValidationResult {
  const label = options.label || '出生资料';
  if (options.inputMode === 'pillars' && !person.reverseSource) {
    return { ok: false, message: `请先为${label}选择一个可回填的四柱候选时段` };
  }

  const yearStr = String(person.year ?? '').trim();
  const monthStr = String(person.month ?? '').trim();
  const dayStr = String(person.day ?? '').trim();
  if (!yearStr || !monthStr || !dayStr) {
    return { ok: false, message: `请填写完整的${label}年、月、日` };
  }

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return { ok: false, message: `${label}年份需在 1900–2100 之间` };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, message: `${label}月份需在 1–12 之间` };
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, message: `${label}日期需在 1–31 之间` };
  }

  const calendar = (person.calendar ?? person.dateType) === 'lunar' ? 'lunar' : 'solar';
  const isLeapMonth = calendar === 'lunar' && Boolean(person.isLeapMonth);
  try {
    if (calendar === 'lunar') {
      LunarDay.fromYmd(year, isLeapMonth ? -month : month, day);
    } else {
      SolarDay.fromYmd(year, month, day);
    }
  } catch {
    return {
      ok: false,
      message:
        calendar === 'lunar'
          ? `${label}农历日期不存在（请检查大小月或闰月设置）`
          : `${label}公历日期不存在（请检查当月天数）`,
    };
  }

  const needPrecise = Boolean(person.useTrueSolarTime || options.forcePreciseBirthPlace);
  const hasHourMinute =
    String(person.birthHour ?? '').trim() !== '' && String(person.birthMinute ?? '').trim() !== '';

  if (needPrecise) {
    if (!hasHourMinute) {
      return { ok: false, message: `请填写${label}的精准出生时间（时:分）` };
    }
    const hh = Number(person.birthHour);
    const mm = Number(person.birthMinute);
    if (!Number.isInteger(hh) || hh < 0 || hh > 23 || !Number.isInteger(mm) || mm < 0 || mm > 59) {
      return { ok: false, message: `${label}精准时间需在 00:00–23:59 范围内` };
    }
    const enriched = enrichPlaceCoordinates(person);
    if (!person.birthPlace?.trim() || enriched.longitude === undefined) {
      return { ok: false, message: `请先为${label}选择出生地` };
    }
  } else if (!hasHourMinute) {
    if (person.timeIndex === '' || person.timeIndex === undefined) {
      return { ok: false, message: `请选择${label}的出生时辰` };
    }
    if (person.timeIndex === 'unknown' && options.allowUnknownTime === false) {
      return { ok: false, message: `当前术数不支持未知时辰，请选择${label}的具体时辰` };
    }
  }

  return { ok: true };
}

export type V2BirthClock =
  | { kind: 'exact'; hour: number; minute: number; second: number }
  | { kind: 'shichen'; index: number }
  | { kind: 'unknown' };

export interface V2BaziBirthPayload {
  year: number;
  month: number;
  day: number;
  clock: V2BirthClock;
  calendar?: 'solar' | 'lunar';
  leapMonth?: boolean;
  timezone?: number;
  timeZoneId?: string;
  timeStandard?: 'civil' | 'true-solar';
  longitude?: number;
}

export interface V2AstroBirthPayload {
  name?: string;
  gender?: 'male' | 'female';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  latitude: number;
  longitude: number;
  timezone?: number;
  timeZoneId?: string;
  locationName?: string;
  useTrueSolarTime?: boolean;
  coordinateAccuracy?: 'user-provided' | 'administrative-center' | 'province-approximation' | 'mixed';
}

export interface V2QizhengBirthPayload {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  latitude: number;
  longitude: number;
  timezone?: number;
  timeZoneId?: string;
  timeStandard?: 'civil' | 'true-solar';
}

export interface V2QimenLifetimeBirthPayload {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  calendar?: 'solar' | 'lunar';
  leapMonth?: boolean;
  timezone?: number;
  timeZoneId?: string;
  timeStandard?: 'civil' | 'true-solar';
  longitude?: number;
}

export type V2BirthPayload =
  | V2BaziBirthPayload
  | V2AstroBirthPayload
  | V2QizhengBirthPayload
  | V2QimenLifetimeBirthPayload;

export interface ToV2BirthPayloadOptions {
  method?: Method | string;
  forcePreciseBirthPlace?: boolean;
  allowUnknownTime?: boolean;
}

function resolveSolarYmd(
  year: number,
  month: number,
  day: number,
  calendar: 'solar' | 'lunar',
  isLeapMonth: boolean,
): { year: number; month: number; day: number } {
  if (calendar !== 'lunar') return { year, month, day };
  try {
    const solar = LunarDay.fromYmd(year, isLeapMonth ? -month : month, day).getSolarDay();
    return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
  } catch {
    return { year, month, day };
  }
}

function resolveHourMinuteSecond(
  person: Partial<PersonalCase>,
): { hour: number; minute: number; second: number; hasExplicitClock: boolean } {
  const rawH = String(person.birthHour ?? '').trim();
  const rawM = String(person.birthMinute ?? '').trim();
  const rawS = String(person.birthSecond ?? '').trim();
  if (rawH !== '' && rawM !== '') {
    const hour = Math.min(23, Math.max(0, Math.trunc(Number(rawH) || 0)));
    const minute = Math.min(59, Math.max(0, Math.trunc(Number(rawM) || 0)));
    const second = rawS !== '' ? Math.min(59, Math.max(0, Math.trunc(Number(rawS) || 0))) : 0;
    return { hour, minute, second, hasExplicitClock: true };
  }
  const idx = normalizeTimeIndex(person.timeIndex);
  if (typeof idx === 'number' && BIRTH_TIME_OPTIONS[idx]) {
    return {
      hour: BIRTH_TIME_OPTIONS[idx].hour,
      minute: BIRTH_TIME_OPTIONS[idx].minute,
      second: 0,
      hasExplicitClock: false,
    };
  }
  return { hour: 12, minute: 0, second: 0, hasExplicitClock: false };
}

export function toV2BirthPayload(
  person: Partial<PersonalCase>,
  options?: ToV2BirthPayloadOptions & { method?: 'bazi' | 'ziwei' | 'bazi-ziwei' | 'minglu' | 'bazi-synastry' | 'ziwei-synastry' | 'chinese-name' | 'chinese-naming' | undefined },
): V2BaziBirthPayload;
export function toV2BirthPayload(
  person: Partial<PersonalCase>,
  options: ToV2BirthPayloadOptions & { method: 'astrolabe' | 'astrolabe-synastry' | 'astrolabe-range' },
): V2AstroBirthPayload;
export function toV2BirthPayload(
  person: Partial<PersonalCase>,
  options: ToV2BirthPayloadOptions & { method: 'qizheng' | 'qizheng-range' },
): V2QizhengBirthPayload;
export function toV2BirthPayload(
  person: Partial<PersonalCase>,
  options: ToV2BirthPayloadOptions & { method: 'qimen-lifetime' },
): V2QimenLifetimeBirthPayload;
export function toV2BirthPayload(
  person: Partial<PersonalCase>,
  options?: ToV2BirthPayloadOptions,
): V2BirthPayload;
export function toV2BirthPayload(
  person: Partial<PersonalCase>,
  options: ToV2BirthPayloadOptions = {},
): V2BirthPayload {
  const year = Math.trunc(Number(person.year) || 1990);
  const month = Math.min(12, Math.max(1, Math.trunc(Number(person.month) || 1)));
  const day = Math.min(31, Math.max(1, Math.trunc(Number(person.day) || 1)));
  const calendar: 'solar' | 'lunar' =
    (person.calendar ?? person.dateType) === 'lunar' ? 'lunar' : 'solar';
  const isLeapMonth = calendar === 'lunar' ? Boolean(person.isLeapMonth) : false;

  const placeInfo = enrichPlaceCoordinates(person);
  const longitude = placeInfo.longitude ?? 116.4074;
  const latitude = placeInfo.latitude ?? 39.9042;
  const timeZoneId = placeInfo.timeZoneId;
  const timezone = timeZoneId ? undefined : (placeInfo.timezone ?? 8);
  const useTrueSolar = Boolean(person.useTrueSolarTime);

  const { hour, minute, second, hasExplicitClock } = resolveHourMinuteSecond(person);
  const method = options.method;

  if (method === 'astrolabe' || method === 'astrolabe-synastry' || method === 'astrolabe-range') {
    const solar = resolveSolarYmd(year, month, day, calendar, isLeapMonth);
    const astroPayload: V2AstroBirthPayload = {
      ...(person.name?.trim() ? { name: person.name.trim() } : {}),
      ...(person.gender ? { gender: person.gender } : {}),
      year: solar.year,
      month: solar.month,
      day: solar.day,
      hour,
      minute,
      second,
      latitude,
      longitude,
      ...(timeZoneId ? { timeZoneId } : { timezone: timezone ?? 8 }),
      ...(person.birthPlace?.trim() ? { locationName: person.birthPlace.trim() } : {}),
      ...(useTrueSolar ? { useTrueSolarTime: true } : {}),
      coordinateAccuracy: 'administrative-center',
    };
    return astroPayload;
  }

  if (method === 'qizheng' || method === 'qizheng-range') {
    const solar = resolveSolarYmd(year, month, day, calendar, isLeapMonth);
    const qizhengPayload: V2QizhengBirthPayload = {
      year: solar.year,
      month: solar.month,
      day: solar.day,
      hour,
      minute,
      second,
      latitude,
      longitude,
      ...(timeZoneId ? { timeZoneId } : { timezone: timezone ?? 8 }),
      timeStandard: useTrueSolar ? 'true-solar' : 'civil',
    };
    return qizhengPayload;
  }

  if (method === 'qimen-lifetime') {
    const qimenBirth: V2QimenLifetimeBirthPayload = {
      year,
      month,
      day,
      hour,
      minute,
      second,
      calendar,
      ...(calendar === 'lunar' ? { leapMonth: isLeapMonth } : {}),
      ...(timeZoneId ? { timeZoneId } : { timezone: timezone ?? 8 }),
      ...(useTrueSolar
        ? { timeStandard: 'true-solar', longitude }
        : { timeStandard: 'civil' }),
    };
    return qimenBirth;
  }

  const normalizedIdx = normalizeTimeIndex(person.timeIndex);
  const useExactClock =
    useTrueSolar ||
    Boolean(options.forcePreciseBirthPlace) ||
    (hasExplicitClock && Boolean(person.reverseSource));

  let clock: V2BirthClock;
  if (useExactClock) {
    clock = { kind: 'exact', hour, minute, second };
  } else if (
    normalizedIdx === 'unknown' ||
    (normalizedIdx === '' && options.allowUnknownTime !== false)
  ) {
    clock = { kind: 'unknown' };
  } else {
    const shichenIndex = typeof normalizedIdx === 'number' ? normalizedIdx : 6;
    clock = { kind: 'shichen', index: shichenIndex };
  }

  const baziPayload: V2BaziBirthPayload = {
    year,
    month,
    day,
    clock,
    calendar,
    ...(calendar === 'lunar' ? { leapMonth: isLeapMonth } : {}),
    ...(timeZoneId ? { timeZoneId } : { timezone: timezone ?? 8 }),
    ...(useTrueSolar
      ? { timeStandard: 'true-solar', longitude }
      : { timeStandard: 'civil' }),
  };

  return baziPayload;
}
