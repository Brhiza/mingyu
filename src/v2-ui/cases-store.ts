import { LunarDay, SolarDay } from 'tyme4ts';
import { methodLabels, type Method } from '../schema';
import { resolveLocationCoordinates, searchLocations } from '../systems/location';
import { migrateV1StorageData } from './v1-migration';

export const CASES_STORE_EVENT = 'mingyu:v2:cases-store';
export const HISTORY_RECORDS_EVENT = 'mingyu:history-records';

const PERSONAL_CASES_STORAGE_KEY = 'mingyu.v2.personal.cases';
const ACTIVE_CASE_ID_STORAGE_KEY = 'mingyu.v2.activeCaseId';
const TEMPORARY_CASE_STORAGE_KEY = 'mingyu.v2.temporary.case';
const DIVINATION_RECORDS_STORAGE_KEY = 'mingyu.v2.history.records';
const COMPATIBILITY_RECORDS_STORAGE_KEY = 'mingyu.v2.compatibility.records';

const MAX_PERSONAL_CASES = 200;
const MAX_COMPATIBILITY_RECORDS = 100;
const MAX_DIVINATION_RECORDS = 50;
const DEFAULT_CASE_NAME = '案例';

export interface ShichenOption {
  index: number;
  branch: string;
  label: string;
  range: string;
  hour: number;
  minute: number;
}

/**
 * 1:1 复刻 V1 十二时辰（早子时 0..晚子时 12）定义与显示区间。
 */
export const BIRTH_TIME_OPTIONS: readonly ShichenOption[] = Object.freeze([
  { index: 0, branch: '子', label: '早子时', range: '00:00-00:59', hour: 0, minute: 30 },
  { index: 1, branch: '丑', label: '丑时', range: '01:00-02:59', hour: 2, minute: 0 },
  { index: 2, branch: '寅', label: '寅时', range: '03:00-04:59', hour: 4, minute: 0 },
  { index: 3, branch: '卯', label: '卯时', range: '05:00-06:59', hour: 6, minute: 0 },
  { index: 4, branch: '辰', label: '辰时', range: '07:00-08:59', hour: 8, minute: 0 },
  { index: 5, branch: '巳', label: '巳时', range: '09:00-10:59', hour: 10, minute: 0 },
  { index: 6, branch: '午', label: '午时', range: '11:00-12:59', hour: 12, minute: 0 },
  { index: 7, branch: '未', label: '未时', range: '13:00-14:59', hour: 14, minute: 0 },
  { index: 8, branch: '申', label: '申时', range: '15:00-16:59', hour: 16, minute: 0 },
  { index: 9, branch: '酉', label: '酉时', range: '17:00-18:59', hour: 18, minute: 0 },
  { index: 10, branch: '戌', label: '戌时', range: '19:00-20:59', hour: 20, minute: 0 },
  { index: 11, branch: '亥', label: '亥时', range: '21:00-22:59', hour: 22, minute: 0 },
  { index: 12, branch: '子', label: '晚子时', range: '23:00-23:59', hour: 23, minute: 30 },
]);

export interface BirthTimeDropdownOption {
  value: string;
  label: string;
}

export function getBirthTimeDropdownOptions(allowUnknownTime = true): BirthTimeDropdownOption[] {
  return [
    { value: '', label: '请选择时辰' },
    ...BIRTH_TIME_OPTIONS.map((item) => ({
      value: String(item.index),
      label: `${item.label}（${item.range}）`,
    })),
    ...(allowUnknownTime ? [{ value: 'unknown', label: '未知时辰' }] : []),
  ];
}

export function getTimeIndexFromClock(hour: number, minute = 0): number {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    hour < 0 ||
    hour > 24
  ) {
    return -1;
  }
  if (hour === 24) return minute === 0 ? 12 : -1;
  if (hour === 23) return 12;
  if (hour === 0) return 0;
  return Math.floor((hour + 1) / 2);
}

export function getTrueSolarTimeHintLabel(
  birthHour: number | string | undefined,
  birthMinute: number | string | undefined,
): string {
  if (birthHour === '' || birthHour === undefined || birthMinute === '' || birthMinute === undefined) {
    return '';
  }
  const hour = Number(birthHour);
  const minute = Number(birthMinute);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }
  const idx = getTimeIndexFromClock(hour, minute);
  const matched = BIRTH_TIME_OPTIONS[idx];
  return matched ? `当前对应时辰：${matched.label}（${matched.range}）` : '';
}

export interface BaziReversePillars {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface BaziReverseSource {
  pillars: BaziReversePillars;
  intervalStart: string;
  intervalEnd: string;
  startTimestamp?: number;
  endTimestamp?: number;
  endExclusive?: true;
  timezone?: 8;
  representativeYear?: number;
  representativeMonth?: number;
  representativeDay?: number;
  representativeHour?: number;
  representativeMinute?: number;
  representativeSecond?: number;
}

export type TimeIndexValue = number | 'unknown' | '';

export interface CaseLifeEvent {
  year: number;
  summary: string;
}

export function normalizeCaseLifeEvents(raw: unknown): CaseLifeEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const year = Number(obj.year);
      const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
      if (!Number.isInteger(year) || year < 1900 || year > 2199 || !summary) return null;
      return { year, summary };
    })
    .filter((item): item is CaseLifeEvent => item !== null)
    .slice(0, 30);
}

export function formatCaseLifeEventsForPrompt(events: readonly CaseLifeEvent[] | undefined): string {
  if (!events?.length) return '';
  return `【已验证人生大事】\n${events.map((e) => `${e.year}年：${e.summary}`).join('；')}`;
}

export interface PersonalCase {
  id: string;
  name: string;
  gender: 'male' | 'female';
  calendar: 'solar' | 'lunar';
  /** V1 兼容别名，与 calendar 同步 */
  dateType: 'solar' | 'lunar';
  isLeapMonth: boolean;
  year: string;
  month: string;
  day: string;
  useTrueSolarTime: boolean;
  /** 0..12 为早子时至晚子时，'unknown' 为未知时辰，'' 为未选择 */
  timeIndex: TimeIndexValue;
  birthHour: string;
  birthMinute: string;
  birthSecond: string;
  birthPlace: string;
  provinceId: string;
  provinceName: string;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  longitude?: number;
  latitude?: number;
  lifeEvents?: CaseLifeEvent[];
  timezone?: number;
  timeZoneId?: string;
  pinned?: boolean;
  generatedName?: boolean;
  isTemporary?: boolean;
  birthText: string;
  reverseSource?: BaziReverseSource | null;
  workspaceSource?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface CompatibilityRecord {
  id: string;
  type: 'compatibility';
  name: string;
  primaryName: string;
  partnerName: string;
  person1: PersonalCase;
  person2: PersonalCase;
  method: string;
  question?: string;
  inputJson?: string;
  result?: unknown;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DivinationRecord {
  id: string;
  type: 'divination' | 'instant';
  method: Method | string;
  methodLabel: string;
  requestedMethod?: string;
  question: string;
  supplementaryInfo?: string;
  caseId?: string | null;
  caseName?: string;
  instantType?: 'bazi' | 'ziwei' | 'bazi-ziwei' | 'astrolabe' | 'qizheng';
  timeStandard?: 'beijing' | 'true-solar';
  inputJson: string;
  result?: unknown;
  promptOptions?: unknown;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CaseSortMode = 'recent' | 'name' | 'birth';

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function emitStoreChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CASES_STORE_EVENT));
  window.dispatchEvent(new Event(HISTORY_RECORDS_EVENT));
}

function generateId(prefix = 'case'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTimeIndex(raw: unknown): TimeIndexValue {
  if (raw === 'unknown' || raw === -1 || raw === '-1') return 'unknown';
  if (raw === '' || raw === null || raw === undefined) return '';
  const num = Number(raw);
  if (Number.isInteger(num) && num >= 0 && num <= 12) return num;
  return '';
}

function normalizeDigitString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === 'string') return value.trim();
  return '';
}

export function buildBirthText(person: Pick<PersonalCase, 'year' | 'month' | 'day'>): string {
  const y = String(person.year || '').trim();
  const m = String(person.month || '').trim();
  const d = String(person.day || '').trim();
  if (!y || !m || !d) return '日期未完整';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function formatBirthTimeText(person: Partial<PersonalCase>): string {
  if (person.useTrueSolarTime || (person.birthHour !== '' && person.birthHour !== undefined && person.birthMinute !== '' && person.birthMinute !== undefined)) {
    if (person.birthHour === '' || person.birthHour === undefined || person.birthMinute === '' || person.birthMinute === undefined) {
      return '时间待补充';
    }
    const hh = String(person.birthHour).padStart(2, '0');
    const mm = String(person.birthMinute).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (person.timeIndex === 'unknown') return '未知时辰';
  if (person.timeIndex === '' || person.timeIndex === undefined) return '时辰待补充';
  return BIRTH_TIME_OPTIONS[Number(person.timeIndex)]?.label ?? '时辰待补充';
}

export function formatCaseSummary(person: Partial<PersonalCase>): string {
  const calLabel = person.reverseSource
    ? '四柱日期'
    : (person.calendar ?? person.dateType) === 'lunar'
      ? `农历${person.isLeapMonth ? '闰' : ''}`
      : '公历';
  const datePart = buildBirthText({
    year: String(person.year ?? ''),
    month: String(person.month ?? ''),
    day: String(person.day ?? ''),
  });
  const timePart = formatBirthTimeText(person);
  const placePart = person.birthPlace?.trim() ? ` · ${person.birthPlace.trim()}` : '';
  return `${calLabel} ${datePart} · ${timePart}${placePart}`;
}

function enrichPlaceCoordinates(draft: Partial<PersonalCase>): {
  longitude?: number;
  latitude?: number;
  lifeEvents?: CaseLifeEvent[];
  timezone?: number;
  timeZoneId?: string;
  provinceName: string;
  cityName: string;
  districtName: string;
} {
  let longitude = typeof draft.longitude === 'number' && Number.isFinite(draft.longitude) ? draft.longitude : undefined;
  let latitude = typeof draft.latitude === 'number' && Number.isFinite(draft.latitude) ? draft.latitude : undefined;
  let timezone = typeof draft.timezone === 'number' && Number.isFinite(draft.timezone) ? draft.timezone : undefined;
  let timeZoneId = typeof draft.timeZoneId === 'string' && draft.timeZoneId.trim() ? draft.timeZoneId.trim() : undefined;
  let provinceName = draft.provinceName?.trim() ?? '';
  let cityName = draft.cityName?.trim() ?? '';
  let districtName = draft.districtName?.trim() ?? '';

  const placeText = draft.birthPlace?.trim() ?? '';
  if (placeText && (longitude === undefined || latitude === undefined || !provinceName)) {
    const parts = placeText.split(/[\s/]+/).filter(Boolean);
    const resolved =
      resolveLocationCoordinates(parts[0] ?? '', parts[1], parts[2]) ??
      searchLocations(placeText, 1)[0] ??
      null;
    if (resolved) {
      if (longitude === undefined) longitude = resolved.longitude;
      if (latitude === undefined && resolved.latitude !== undefined) latitude = resolved.latitude;
      if (timezone === undefined && resolved.timezone !== undefined) timezone = resolved.timezone;
      if (!timeZoneId && resolved.timeZoneId) timeZoneId = resolved.timeZoneId;
      if (!provinceName) provinceName = resolved.province ?? (resolved.level === 'overseas' ? '海外城市' : '');
      if (!cityName) cityName = resolved.city ?? (resolved.level === 'overseas' ? resolved.country : '');
      if (!districtName) districtName = resolved.district ?? resolved.name;
    }
  }

  return {
    ...(longitude !== undefined ? { longitude } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
    ...(timeZoneId ? { timeZoneId } : {}),
    provinceName,
    cityName,
    districtName,
  };
}

export function createDefaultPersonalCase(overrides: Partial<PersonalCase> = {}): PersonalCase {
  const now = new Date().toISOString();
  const calendar = (overrides.calendar ?? overrides.dateType) === 'lunar' ? 'lunar' : 'solar';
  const year = normalizeDigitString(overrides.year ?? '1990');
  const month = normalizeDigitString(overrides.month ?? '1');
  const day = normalizeDigitString(overrides.day ?? '1');
  const placeInfo = enrichPlaceCoordinates(overrides);

  const base: PersonalCase = {
    id: overrides.id || 'temporary',
    name: typeof overrides.name === 'string' ? overrides.name : '',
    gender: overrides.gender === 'female' ? 'female' : 'male',
    calendar,
    dateType: calendar,
    isLeapMonth: calendar === 'lunar' ? Boolean(overrides.isLeapMonth) : false,
    year,
    month,
    day,
    useTrueSolarTime: Boolean(overrides.useTrueSolarTime),
    timeIndex: overrides.timeIndex !== undefined ? normalizeTimeIndex(overrides.timeIndex) : 6,
    birthHour: normalizeDigitString(overrides.birthHour ?? ''),
    birthMinute: normalizeDigitString(overrides.birthMinute ?? ''),
    birthSecond: normalizeDigitString(overrides.birthSecond ?? ''),
    birthPlace: typeof overrides.birthPlace === 'string' ? overrides.birthPlace.trim() : '',
    provinceId: overrides.provinceId ?? placeInfo.provinceName,
    provinceName: placeInfo.provinceName,
    cityId: overrides.cityId ?? placeInfo.cityName,
    cityName: placeInfo.cityName,
    districtId: overrides.districtId ?? placeInfo.districtName,
    districtName: placeInfo.districtName,
    ...(placeInfo.longitude !== undefined ? { longitude: placeInfo.longitude } : {}),
    ...(placeInfo.latitude !== undefined ? { latitude: placeInfo.latitude } : {}),
    ...(placeInfo.timezone !== undefined ? { timezone: placeInfo.timezone } : {}),
    ...(placeInfo.timeZoneId ? { timeZoneId: placeInfo.timeZoneId } : {}),
    pinned: Boolean(overrides.pinned),
    generatedName: Boolean(overrides.generatedName),
    isTemporary: Boolean(overrides.isTemporary),
    birthText: overrides.birthText || buildBirthText({ year, month, day }),
    reverseSource: overrides.reverseSource ?? null,
    ...(overrides.workspaceSource ? { workspaceSource: overrides.workspaceSource } : {}),
    ...(overrides.lifeEvents?.length ? { lifeEvents: normalizeCaseLifeEvents(overrides.lifeEvents) } : {}),
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...(overrides.lastUsedAt ? { lastUsedAt: overrides.lastUsedAt } : {}),
  };

  return base;
}

function normalizeStoredPersonalCase(raw: unknown): PersonalCase | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  // 兼容 V1 PersonalHistoryRecord ({ id, name, gender, input: QueryInputState, ... })
  const inputObj =
    obj.input && typeof obj.input === 'object' ? (obj.input as Record<string, unknown>) : obj;

  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : '';
  if (!id) return null;

  const rawLong = inputObj.longitude ?? inputObj.birthLongitude;
  const rawLat = inputObj.latitude ?? inputObj.birthLatitude;
  const longitude =
    rawLong !== '' && rawLong !== null && rawLong !== undefined && Number.isFinite(Number(rawLong))
      ? Number(rawLong)
      : undefined;
  const latitude =
    rawLat !== '' && rawLat !== null && rawLat !== undefined && Number.isFinite(Number(rawLat))
      ? Number(rawLat)
      : undefined;

  let reverseSource: BaziReverseSource | null = null;
  if (obj.reverseSource && typeof obj.reverseSource === 'object') {
    reverseSource = obj.reverseSource as BaziReverseSource;
  } else if (typeof inputObj.birthReverseSource === 'string' && inputObj.birthReverseSource.trim()) {
    try {
      const parsed = JSON.parse(inputObj.birthReverseSource);
      if (parsed && typeof parsed === 'object' && parsed.pillars) {
        reverseSource = parsed as BaziReverseSource;
      }
    } catch {
      reverseSource = null;
    }
  }

  const calendar =
    inputObj.calendar === 'lunar' || inputObj.dateType === 'lunar' ? 'lunar' : 'solar';

  return createDefaultPersonalCase({
    id,
    name: typeof obj.name === 'string' ? obj.name : typeof inputObj.name === 'string' ? inputObj.name : '',
    gender: obj.gender === 'female' || inputObj.gender === 'female' ? 'female' : 'male',
    calendar,
    dateType: calendar,
    isLeapMonth: Boolean(inputObj.isLeapMonth),
    year: normalizeDigitString(inputObj.year),
    month: normalizeDigitString(inputObj.month),
    day: normalizeDigitString(inputObj.day),
    useTrueSolarTime: Boolean(inputObj.useTrueSolarTime),
    timeIndex: normalizeTimeIndex(inputObj.timeIndex),
    birthHour: normalizeDigitString(inputObj.birthHour),
    birthMinute: normalizeDigitString(inputObj.birthMinute),
    birthSecond: normalizeDigitString(inputObj.birthSecond),
    birthPlace: typeof inputObj.birthPlace === 'string' ? inputObj.birthPlace : '',
    provinceId: typeof inputObj.provinceId === 'string' ? inputObj.provinceId : undefined,
    provinceName: typeof inputObj.provinceName === 'string' ? inputObj.provinceName : undefined,
    cityId: typeof inputObj.cityId === 'string' ? inputObj.cityId : undefined,
    cityName: typeof inputObj.cityName === 'string' ? inputObj.cityName : undefined,
    districtId: typeof inputObj.districtId === 'string' ? inputObj.districtId : undefined,
    districtName: typeof inputObj.districtName === 'string' ? inputObj.districtName : undefined,
    longitude,
    latitude,
    timezone: typeof inputObj.timezone === 'number' ? inputObj.timezone : undefined,
    timeZoneId: typeof inputObj.timeZoneId === 'string' ? inputObj.timeZoneId : undefined,
    pinned: Boolean(obj.pinned),
    generatedName: Boolean(obj.generatedName),
    reverseSource,
    workspaceSource: typeof obj.workspaceSource === 'string' ? obj.workspaceSource : undefined,
    ...(Array.isArray(obj.lifeEvents) ? { lifeEvents: normalizeCaseLifeEvents(obj.lifeEvents) } : {}),
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
    lastUsedAt: typeof obj.lastUsedAt === 'string' ? obj.lastUsedAt : undefined,
  });
}

export function sortPersonalCases(
  records: readonly PersonalCase[],
  mode: CaseSortMode = 'recent',
): PersonalCase[] {
  return [...records].sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1;
    if (mode === 'name') {
      return left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
    }
    if (mode === 'birth') {
      const leftDate = Number(left.year) * 10000 + Number(left.month) * 100 + Number(left.day);
      const rightDate = Number(right.year) * 10000 + Number(right.month) * 100 + Number(right.day);
      return rightDate - leftDate;
    }
    const leftTime = left.lastUsedAt ?? left.updatedAt;
    const rightTime = right.lastUsedAt ?? right.updatedAt;
    return rightTime.localeCompare(leftTime);
  });
}

let v1MigrationChecked = false;
export function ensureV1DataMigrated(): void {
  if (v1MigrationChecked || typeof localStorage === 'undefined') return;
  v1MigrationChecked = true;
  migrateV1StorageData(localStorage, (raw) => normalizeStoredPersonalCase(raw) as unknown as Record<string, unknown> | null);
}

export function loadPersonalCases(): PersonalCase[] {
  ensureV1DataMigrated();
  const raw = readStorage(PERSONAL_CASES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map(normalizeStoredPersonalCase)
      .filter((item): item is PersonalCase => item !== null && Boolean(item.year && item.month && item.day));
    return sortPersonalCases(normalized, 'recent');
  } catch {
    return [];
  }
}

function persistPersonalCases(cases: readonly PersonalCase[]): boolean {
  const trimmed = cases.slice(0, MAX_PERSONAL_CASES);
  const ok = writeStorage(PERSONAL_CASES_STORAGE_KEY, JSON.stringify(trimmed));
  if (ok) emitStoreChange();
  return ok;
}

export function getPersonalCaseById(id: string | null | undefined): PersonalCase | null {
  if (!id || id === 'temporary') return null;
  return loadPersonalCases().find((item) => item.id === id) ?? null;
}

/**
 * 读取当前选中的档案 ID；null 表示「临时档案」。
 */
export function getActiveCaseId(): string | null {
  const stored = readStorage(ACTIVE_CASE_ID_STORAGE_KEY);
  if (!stored || stored === 'temporary') return null;
  const exists = loadPersonalCases().some((item) => item.id === stored);
  return exists ? stored : null;
}

/**
 * 切换「临时档案」(null) 与已保存命例档案。
 */
export function setActiveCaseId(caseId: string | null): PersonalCase {
  if (!caseId || caseId === 'temporary') {
    removeStorage(ACTIVE_CASE_ID_STORAGE_KEY);
    emitStoreChange();
    return loadTemporaryCase();
  }
  const cases = loadPersonalCases();
  const target = cases.find((item) => item.id === caseId);
  if (!target) {
    removeStorage(ACTIVE_CASE_ID_STORAGE_KEY);
    emitStoreChange();
    return loadTemporaryCase();
  }
  const now = new Date().toISOString();
  const updated = cases.map((item) => (item.id === caseId ? { ...item, lastUsedAt: now } : item));
  writeStorage(ACTIVE_CASE_ID_STORAGE_KEY, caseId);
  persistPersonalCases(updated);
  return { ...target, lastUsedAt: now };
}

export function loadTemporaryCase(): PersonalCase {
  const raw = readStorage(TEMPORARY_CASE_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = normalizeStoredPersonalCase(JSON.parse(raw));
      if (parsed) return { ...parsed, id: 'temporary', isTemporary: true };
    } catch {
      // ignore
    }
  }
  return createDefaultPersonalCase({ id: 'temporary', isTemporary: true });
}

export function saveTemporaryCase(draft: Partial<PersonalCase>): PersonalCase {
  const normalized = createDefaultPersonalCase({
    ...loadTemporaryCase(),
    ...draft,
    id: 'temporary',
    isTemporary: true,
    updatedAt: new Date().toISOString(),
  });
  writeStorage(TEMPORARY_CASE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getActiveOrTemporaryCase(): PersonalCase {
  const activeId = getActiveCaseId();
  if (activeId) {
    const found = getPersonalCaseById(activeId);
    if (found) return found;
  }
  return loadTemporaryCase();
}

function resolveAvailableCaseName(existingCases: readonly PersonalCase[]): string {
  const used = new Set(existingCases.map((item) => item.name.trim().toLowerCase()));
  if (!used.has(DEFAULT_CASE_NAME.toLowerCase())) return DEFAULT_CASE_NAME;
  let index = 2;
  while (used.has(`${DEFAULT_CASE_NAME}${index}`.toLowerCase())) {
    index += 1;
  }
  return `${DEFAULT_CASE_NAME}${index}`;
}

function isSamePersonalCaseIdentity(a: PersonalCase, name: string, draft: PersonalCase): boolean {
  return (
    a.name.trim().toLowerCase() === name.trim().toLowerCase() &&
    a.gender === draft.gender &&
    a.calendar === draft.calendar &&
    a.year === draft.year &&
    a.month === draft.month &&
    a.day === draft.day
  );
}

/**
 * 新增或编辑个人命例档案（保存后自动设为当前激活案例）。
 */
export function upsertPersonalCase(
  input: Partial<PersonalCase>,
  existingId?: string | null,
): PersonalCase {
  const cases = loadPersonalCases();
  const targetId = existingId && existingId !== 'temporary' ? existingId : undefined;
  const existing = targetId ? cases.find((item) => item.id === targetId) : undefined;

  const explicitName = (input.name ?? existing?.name ?? '').trim();
  const generatedName = !explicitName;
  const finalName = explicitName || existing?.name || resolveAvailableCaseName(cases);
  const now = new Date().toISOString();

  const candidate = createDefaultPersonalCase({
    ...existing,
    ...input,
    name: finalName,
    generatedName,
    isTemporary: false,
    updatedAt: now,
    lastUsedAt: now,
  });

  const duplicate =
    existing ?? cases.find((item) => isSamePersonalCaseIdentity(item, finalName, candidate));

  const id = duplicate?.id ?? (targetId || generateId('case'));
  const saved: PersonalCase = {
    ...candidate,
    id,
    createdAt: duplicate?.createdAt ?? now,
    pinned: input.pinned !== undefined ? Boolean(input.pinned) : Boolean(duplicate?.pinned),
    birthText: buildBirthText(candidate),
  };

  const next = [
    saved,
    ...cases.filter((item) => item.id !== id && !isSamePersonalCaseIdentity(item, finalName, saved)),
  ];
  persistPersonalCases(next);
  writeStorage(ACTIVE_CASE_ID_STORAGE_KEY, saved.id);
  emitStoreChange();
  return saved;
}

export function togglePersonalCasePin(id: string): PersonalCase[] {
  const cases = loadPersonalCases();
  const next = cases.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item));
  persistPersonalCases(next);
  return sortPersonalCases(next, 'recent');
}

export function deletePersonalCase(id: string): PersonalCase[] {
  const cases = loadPersonalCases();
  const next = cases.filter((item) => item.id !== id);
  if (getActiveCaseId() === id) {
    removeStorage(ACTIVE_CASE_ID_STORAGE_KEY);
  }
  persistPersonalCases(next);
  return next;
}

export const removePersonalCase = deletePersonalCase;

// ==================== 双人合盘历史管理 ====================

export function loadCompatibilityRecords(): CompatibilityRecord[] {
  ensureV1DataMigrated();
  const raw = readStorage(COMPATIBILITY_RECORDS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is CompatibilityRecord =>
            Boolean(item && typeof item === 'object' && typeof (item as CompatibilityRecord).id === 'string'),
        );
      }
    } catch {
      // ignore
    }
  }
  return [];
}

function persistCompatibilityRecords(records: readonly CompatibilityRecord[]): void {
  writeStorage(
    COMPATIBILITY_RECORDS_STORAGE_KEY,
    JSON.stringify(records.slice(0, MAX_COMPATIBILITY_RECORDS)),
  );
  emitStoreChange();
}

export function upsertCompatibilityRecord(
  person1Draft: Partial<PersonalCase>,
  person2Draft: Partial<PersonalCase>,
  options: {
    method?: string;
    question?: string;
    inputJson?: string;
    result?: unknown;
  } = {},
): CompatibilityRecord {
  const records = loadCompatibilityRecords();
  const p1 = createDefaultPersonalCase({
    ...person1Draft,
    name: person1Draft.name?.trim() || '命主一',
  });
  const p2 = createDefaultPersonalCase({
    ...person2Draft,
    name: person2Draft.name?.trim() || '命主二',
  });
  const id = [
    p1.name.toLowerCase(),
    p2.name.toLowerCase(),
    p1.gender,
    p2.gender,
    p1.year,
    p1.month,
    p1.day,
    p2.year,
    p2.month,
    p2.day,
  ].join('|');
  const existing = records.find((item) => item.id === id);
  const now = new Date().toISOString();
  const record: CompatibilityRecord = {
    id,
    type: 'compatibility',
    name: `${p1.name} 和 ${p2.name}`,
    primaryName: p1.name,
    partnerName: p2.name,
    person1: p1,
    person2: p2,
    method: options.method || existing?.method || 'bazi-synastry',
    ...(options.question ? { question: options.question } : {}),
    ...(options.inputJson ? { inputJson: options.inputJson } : {}),
    ...(options.result !== undefined ? { result: options.result } : {}),
    pinned: Boolean(existing?.pinned),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [record, ...records.filter((item) => item.id !== id)].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  persistCompatibilityRecords(next);
  return record;
}

export function toggleCompatibilityRecordPin(id: string): CompatibilityRecord[] {
  const next = loadCompatibilityRecords()
    .map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  persistCompatibilityRecords(next);
  return next;
}

export function deleteCompatibilityRecord(id: string): CompatibilityRecord[] {
  const next = loadCompatibilityRecords().filter((item) => item.id !== id);
  persistCompatibilityRecords(next);
  return next;
}

export const removeCompatibilityRecord = deleteCompatibilityRecord;

// ==================== 占问历史记录管理 ====================

export function loadDivinationRecords(): DivinationRecord[] {
  ensureV1DataMigrated();
  const raw = readStorage(DIVINATION_RECORDS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): DivinationRecord[] => {
      if (!item || typeof item !== 'object') return [];
      const rec = item as Record<string, unknown>;
      if (typeof rec.id !== 'string' || typeof rec.method !== 'string') return [];
      const createdAt = typeof rec.createdAt === 'string' ? rec.createdAt : new Date().toISOString();
      const updatedAt = typeof rec.updatedAt === 'string' ? rec.updatedAt : createdAt;
      const method = rec.method;
      const methodLabel =
        typeof rec.methodLabel === 'string' && rec.methodLabel
          ? rec.methodLabel
          : (methodLabels as Record<string, string>)[method] ?? method;
      return [
        {
          id: rec.id,
          type: rec.type === 'instant' ? 'instant' : 'divination',
          method,
          methodLabel,
          ...(typeof rec.requestedMethod === 'string' ? { requestedMethod: rec.requestedMethod } : {}),
          question: typeof rec.question === 'string' && rec.question.trim() ? rec.question.trim() : '综合排盘分析',
          ...(typeof rec.supplementaryInfo === 'string' ? { supplementaryInfo: rec.supplementaryInfo } : {}),
          ...(typeof rec.caseId === 'string' ? { caseId: rec.caseId } : {}),
          ...(typeof rec.caseName === 'string' ? { caseName: rec.caseName } : {}),
          ...(typeof rec.instantType === 'string'
            ? { instantType: rec.instantType as DivinationRecord['instantType'] }
            : {}),
          ...(rec.timeStandard === 'true-solar' || rec.timeStandard === 'beijing'
            ? { timeStandard: rec.timeStandard }
            : {}),
          inputJson: typeof rec.inputJson === 'string' ? rec.inputJson : '{}',
          ...(rec.result !== undefined ? { result: rec.result } : {}),
          ...(rec.promptOptions !== undefined ? { promptOptions: rec.promptOptions } : {}),
          pinned: Boolean(rec.pinned),
          createdAt,
          updatedAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

function persistDivinationRecords(records: readonly DivinationRecord[]): void {
  writeStorage(
    DIVINATION_RECORDS_STORAGE_KEY,
    JSON.stringify(records.slice(0, MAX_DIVINATION_RECORDS)),
  );
  emitStoreChange();
}

export function saveDivinationRecord(
  entry: Omit<DivinationRecord, 'id' | 'createdAt' | 'updatedAt' | 'methodLabel' | 'type'> & {
    id?: string;
    type?: 'divination' | 'instant';
    methodLabel?: string;
  },
): DivinationRecord {
  const records = loadDivinationRecords();
  const now = new Date().toISOString();
  const activeCase = entry.caseId
    ? getPersonalCaseById(entry.caseId)
    : getActiveCaseId()
      ? getPersonalCaseById(getActiveCaseId())
      : null;
  const methodLabel =
    entry.methodLabel ||
    (methodLabels as Record<string, string>)[entry.method] ||
    String(entry.method);

  const record: DivinationRecord = {
    id: entry.id || generateId('rec'),
    type: entry.type ?? (entry.method === 'instant' ? 'instant' : 'divination'),
    method: entry.method,
    methodLabel,
    ...(entry.requestedMethod ? { requestedMethod: entry.requestedMethod } : {}),
    question: entry.question?.trim() || `${methodLabel}排盘`,
    ...(entry.supplementaryInfo ? { supplementaryInfo: entry.supplementaryInfo } : {}),
    caseId: entry.caseId !== undefined ? entry.caseId : activeCase?.id ?? null,
    ...(entry.caseName || activeCase?.name ? { caseName: entry.caseName ?? activeCase?.name } : {}),
    ...(entry.instantType ? { instantType: entry.instantType } : {}),
    ...(entry.timeStandard ? { timeStandard: entry.timeStandard } : {}),
    inputJson: entry.inputJson,
    ...(entry.result !== undefined ? { result: entry.result } : {}),
    ...(entry.promptOptions !== undefined ? { promptOptions: entry.promptOptions } : {}),
    pinned: Boolean(entry.pinned),
    createdAt: now,
    updatedAt: now,
  };

  const deduped = records.filter(
    (item) =>
      item.id !== record.id &&
      !(item.method === record.method && item.question === record.question && item.inputJson === record.inputJson),
  );
  persistDivinationRecords([record, ...deduped]);
  return record;
}

export function deleteDivinationRecord(id: string): DivinationRecord[] {
  const next = loadDivinationRecords().filter((item) => item.id !== id);
  persistDivinationRecords(next);
  return next;
}

export const removeDivinationRecord = deleteDivinationRecord;

export function clearDivinationRecords(): void {
  persistDivinationRecords([]);
}

export function onCasesStoreChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener();
  window.addEventListener(CASES_STORE_EVENT, handler);
  window.addEventListener(HISTORY_RECORDS_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CASES_STORE_EVENT, handler);
    window.removeEventListener(HISTORY_RECORDS_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

// ==================== 生辰校验与 V2 Calculate Birth 参数转换 ====================

export interface ValidatePersonalCaseOptions {
  label?: string;
  forcePreciseBirthPlace?: boolean;
  allowUnknownTime?: boolean;
  inputMode?: 'solar' | 'lunar' | 'pillars';
}

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function clampNumericField(
  key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute' | 'birthSecond',
  rawValue: string,
): string {
  const digits = rawValue.replace(/\D+/g, '');
  if (!digits) return '';
  if (key === 'year') return digits.slice(0, 4);
  const sliced = digits.slice(0, 2);
  const num = Number(sliced);
  if (key === 'month' && num > 12) return '12';
  if (key === 'day' && num > 31) return '31';
  if (key === 'birthHour' && num > 23) return '23';
  if ((key === 'birthMinute' || key === 'birthSecond') && num > 59) return '59';
  return sliced;
}

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
  /**
   * 目标术数 ID。
   * - 默认（省略或 'bazi' / 'ziwei' / 'bazi-ziwei' / 'minglu' / 'bazi-synastry' / 'ziwei-synastry' / 'chinese-name' / 'chinese-naming'）
   *   返回 V2 标准 `baziBirth` 结构（含 `clock: { kind: 'shichen' | 'exact' | 'unknown' }`）；
   * - `'astrolabe'` / `'astrolabe-synastry'` / `'astrolabe-range'` 返回西洋星盘 `astroBirth` 结构；
   * - `'qizheng'` / `'qizheng-range'` 返回七政四余 `qizhengBirth` 结构；
   * - `'qimen-lifetime'` 返回奇门终身局 `birth` 结构。
   */
  method?: Method | string;
  /** 强制使用精准时分与出生地 */
  forcePreciseBirthPlace?: boolean;
  /** 是否允许未知时辰 */
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

/**
 * 将 `PersonalCase` 转换为 V2 `calculate()` 所需的精确 `birth` 参数：
 * - 自动处理时辰 `shichen` / 未知时辰 `unknown` / 精准时分 `exact`、`second: 0`；
 * - 自动处理农历 `lunar` + `leapMonth`；
 * - 自动处理真太阳时 `true-solar` + `longitude`（民用时间时不附带 `longitude`，严格遵循 V2 Zod Schema 约束）。
 */
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

  // 1. 西洋星盘系列 (astroBirth)
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

  // 2. 七政四余系列 (qizhengBirth)
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

  // 3. 奇门终身局 (qimenLifetimeInput.shape.birth)
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

  // 4. 标准 baziBirth（八字、紫微、八字紫微合参、命录、合盘、姓名等）
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
