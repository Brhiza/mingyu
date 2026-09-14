import { calculateSolarTermsForYear, type SolarTermEvidence } from 'mingyu-core/calendar';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import type { AlmanacDayCandidate } from 'mingyu-core/types';
import { SolarDay, SolarTime } from 'tyme4ts';

const CHINA_TIME_ZONE = 'Asia/Shanghai';
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const GRID_SIZE = 42;

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** 十二神中代表黄道的值神。 */
const HUANGDAO_STARS = new Set(['青龙', '明堂', '天德', '玉堂', '司命', '金匮']);

export type ValueGodFortune = '黄道' | '黑道';

export interface SolarTermMarker {
  name: string;
  isJie: boolean;
  utcTimestamp: number;
  chinaDateTime: string;
}

export interface MonthPillarBoundary {
  termName: string;
  utcTimestamp: number;
  chinaDateTime: string;
  beforePillar: string;
  afterPillar: string;
}

export interface GanzhiCalendarCell {
  date: string;
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
  weekday: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  lunarDate: string;
  dayGanzhi: string;
  monthGanzhi: string;
  valueGod: string;
  valueGodFortune: ValueGodFortune;
  dayOfficer: string;
  solarTerms: SolarTermMarker[];
}

export interface GanzhiCalendarDayDetail extends GanzhiCalendarCell {
  almanac: AlmanacDayCandidate;
  monthBoundaryBefore: MonthPillarBoundary | null;
  monthBoundaryAfter: MonthPillarBoundary | null;
  monthBoundaries: MonthPillarBoundary[];
}

export interface GanzhiCalendarMonth {
  monthKey: string;
  year: number;
  month: number;
  label: string;
  cells: GanzhiCalendarCell[];
  monthBoundaries: MonthPillarBoundary[];
}

type CivilDateParts = { year: number; month: number; day: number };

const monthCache = new Map<string, GanzhiCalendarMonth>();
const dayDetailCache = new Map<string, GanzhiCalendarDayDetail>();
const solarTermsYearCache = new Map<number, SolarTermEvidence[]>();
const monthBoundaryCache = new Map<number, MonthPillarBoundary[]>();

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(`月份年份需在 ${MIN_YEAR}-${MAX_YEAR} 年之间。`);
  }
}

function formatNumber(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatGanzhiCalendarDate(year: number, month: number, day: number): string {
  return `${year}-${formatNumber(month)}-${formatNumber(day)}`;
}

function parseDateKey(dateKey: string): CivilDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`日期格式不正确：${dateKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`日期不存在：${dateKey}`);
  }
  return { year, month, day };
}

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error(`月份格式不正确：${monthKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  assertYear(year);
  if (month < 1 || month > 12) throw new Error(`月份不存在：${monthKey}`);
  return { year, month };
}

function parseDateToUtc(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date: Date): string {
  return formatGanzhiCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addCivilDays(dateKey: string, amount: number): string {
  const date = parseDateToUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatUtcDate(date);
}

function monthKeyFromDateKey(dateKey: string): string {
  const { year, month } = parseDateKey(dateKey);
  return `${year}-${formatNumber(month)}`;
}

function parseChinaDateParts(utcTimestamp: number): CivilDateParts {
  const shifted = new Date(utcTimestamp + CHINA_TIME_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** 把节气证据统一显示为中国标准时间，避免跟随浏览器所在时区漂移。 */
export function formatChinaStandardDateTime(utcTimestamp: number): string {
  if (!Number.isFinite(utcTimestamp)) throw new Error('节气时间戳无效。');
  const shifted = new Date(utcTimestamp + CHINA_TIME_OFFSET_MS);
  return `${formatGanzhiCalendarDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  )} ${formatNumber(shifted.getUTCHours())}:${formatNumber(shifted.getUTCMinutes())}:${formatNumber(shifted.getUTCSeconds())}`;
}

function getChinaNoonTimestamp(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  return Date.UTC(year, month - 1, day, 4);
}

function formatLunarMonthDay(lunar: {
  getDay(): number;
  getName(): string;
  toString(): string;
}): string {
  const text = lunar.toString().replace(/^农历[^年]+年/u, '');
  if (lunar.getDay() !== 1) return lunar.getName();
  const monthName = text.endsWith(lunar.getName()) ? text.slice(0, -lunar.getName().length) : text;
  return monthName || lunar.getName();
}

function classifyValueGod(valueGod: string): ValueGodFortune {
  return HUANGDAO_STARS.has(valueGod) ? '黄道' : '黑道';
}

function getSolarTermsForYears(years: number[]): SolarTermEvidence[] {
  const byKey = new Map<string, SolarTermEvidence>();
  [...new Set(years)].forEach((year) => {
    if (year < 1900 || year > 2199) return;
    const terms = solarTermsYearCache.get(year) ?? calculateSolarTermsForYear(year);
    solarTermsYearCache.set(year, terms);
    terms.forEach((term) => {
      byKey.set(`${term.name}:${term.utcTimestamp}`, term);
    });
  });
  while (solarTermsYearCache.size > 12) {
    solarTermsYearCache.delete(solarTermsYearCache.keys().next().value ?? years[0] ?? 0);
  }
  return [...byKey.values()].sort((left, right) => left.utcTimestamp - right.utcTimestamp);
}

function getMonthPillarAtTimestamp(utcTimestamp: number): string {
  const shifted = new Date(utcTimestamp + CHINA_TIME_OFFSET_MS);
  return SolarTime.fromYmdHms(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
  )
    .getLunarHour()
    .getEightChar()
    .getMonth()
    .getName();
}

function buildMonthBoundaries(year: number): MonthPillarBoundary[] {
  const cached = monthBoundaryCache.get(year);
  if (cached) return cached;
  const terms = getSolarTermsForYears([year - 1, year, year + 1]).filter((term) => term.isJie);
  const boundaries = terms.map((term) => ({
    termName: term.name,
    utcTimestamp: term.utcTimestamp,
    chinaDateTime: formatChinaStandardDateTime(term.utcTimestamp),
    beforePillar: getMonthPillarAtTimestamp(term.utcTimestamp - 1_000),
    afterPillar: getMonthPillarAtTimestamp(term.utcTimestamp + 1_000),
  }));
  monthBoundaryCache.set(year, boundaries);
  while (monthBoundaryCache.size > 8) {
    monthBoundaryCache.delete(monthBoundaryCache.keys().next().value ?? year);
  }
  return boundaries;
}

function buildSolarTermMap(terms: readonly SolarTermEvidence[]): Map<string, SolarTermMarker[]> {
  const map = new Map<string, SolarTermMarker[]>();
  terms.forEach((term) => {
    const date = parseChinaDateParts(term.utcTimestamp);
    const dateKey = formatGanzhiCalendarDate(date.year, date.month, date.day);
    const list = map.get(dateKey) ?? [];
    list.push({
      name: term.name,
      isJie: term.isJie,
      utcTimestamp: term.utcTimestamp,
      chinaDateTime: formatChinaStandardDateTime(term.utcTimestamp),
    });
    map.set(dateKey, list);
  });
  return map;
}

function getActiveMonthPillar(
  chinaNoonTimestamp: number,
  boundaries: readonly MonthPillarBoundary[],
  fallback: string,
): string {
  let active = fallback;
  boundaries.forEach((boundary) => {
    if (boundary.utcTimestamp <= chinaNoonTimestamp) active = boundary.afterPillar;
  });
  return active;
}

function getNearestMonthBoundary(
  chinaNoonTimestamp: number,
  boundaries: readonly MonthPillarBoundary[],
  direction: 'before' | 'after',
): MonthPillarBoundary | null {
  const candidates = boundaries.filter((boundary) =>
    direction === 'before'
      ? boundary.utcTimestamp <= chinaNoonTimestamp
      : boundary.utcTimestamp > chinaNoonTimestamp,
  );
  if (!candidates.length) return null;
  return direction === 'before'
    ? (candidates[candidates.length - 1] ?? null)
    : (candidates[0] ?? null);
}

function buildBaseCell(
  dateKey: string,
  currentMonthKey: string,
  todayKey: string,
  termMap: ReadonlyMap<string, SolarTermMarker[]>,
  boundaries: readonly MonthPillarBoundary[],
): GanzhiCalendarCell {
  const { year, month, day } = parseDateKey(dateKey);
  const solarDay = SolarDay.fromYmd(year, month, day);
  const lunar = solarDay.getLunarDay();
  const solarTime = SolarTime.fromYmdHms(year, month, day, 12, 0, 0);
  const eightChar = solarTime.getLunarHour().getEightChar();
  const dayCycle = lunar.getSixtyCycle();
  const valueGod = lunar.getTwelveStar().getName();
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const terms = termMap.get(dateKey) ?? [];

  return {
    date: dateKey,
    year,
    month,
    day,
    weekdayIndex,
    weekday: `星期${WEEKDAY_LABELS[weekdayIndex]}`,
    isCurrentMonth: monthKeyFromDateKey(dateKey) === currentMonthKey,
    isToday: dateKey === todayKey,
    lunarDate: formatLunarMonthDay(lunar),
    dayGanzhi: dayCycle.getName(),
    monthGanzhi: getActiveMonthPillar(
      getChinaNoonTimestamp(dateKey),
      boundaries,
      eightChar.getMonth().getName(),
    ),
    valueGod,
    valueGodFortune: classifyValueGod(valueGod),
    dayOfficer: lunar.getDuty().getName(),
    solarTerms: terms,
  };
}

function createMonthCells(
  year: number,
  month: number,
  todayKey: string,
  boundaries: readonly MonthPillarBoundary[],
  termMap: ReadonlyMap<string, SolarTermMarker[]>,
): GanzhiCalendarCell[] {
  const monthKey = `${year}-${formatNumber(month)}`;
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDateKey = formatUtcDate(first);
  const startDateKey = addCivilDays(firstDateKey, -first.getUTCDay());
  return Array.from({ length: GRID_SIZE }, (_, index) =>
    buildBaseCell(addCivilDays(startDateKey, index), monthKey, todayKey, termMap, boundaries),
  );
}

function getTodayInChina(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return formatGanzhiCalendarDate(Number(values.year), Number(values.month), Number(values.day));
}

export function getBeijingTodayKey(now = new Date()): string {
  return getTodayInChina(now);
}

export function getDefaultGanzhiCalendarMonth(now = new Date()): string {
  return monthKeyFromDateKey(getTodayInChina(now));
}

export function shiftGanzhiCalendarMonth(monthKey: string, amount: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${formatNumber(shifted.getUTCMonth() + 1)}`;
}

export function getGanzhiCalendarMonth(
  monthKey: string,
  todayKey = getBeijingTodayKey(),
): GanzhiCalendarMonth {
  const parsed = parseMonthKey(monthKey);
  const cacheKey = `${monthKey}:${todayKey}`;
  const cached = monthCache.get(cacheKey);
  if (cached) return cached;

  const boundaries = buildMonthBoundaries(parsed.year);
  const terms = getSolarTermsForYears([parsed.year - 1, parsed.year, parsed.year + 1]);
  const termMap = buildSolarTermMap(terms);
  const month: GanzhiCalendarMonth = {
    monthKey,
    year: parsed.year,
    month: parsed.month,
    label: `${parsed.year}年${parsed.month}月`,
    cells: createMonthCells(parsed.year, parsed.month, todayKey, boundaries, termMap),
    monthBoundaries: boundaries,
  };
  monthCache.set(cacheKey, month);
  if (monthCache.size > 8) monthCache.delete(monthCache.keys().next().value ?? cacheKey);
  return month;
}

export function getGanzhiCalendarDayDetail(
  dateKey: string,
  todayKey = getBeijingTodayKey(),
): GanzhiCalendarDayDetail {
  parseDateKey(dateKey);
  const cacheKey = `${dateKey}:${todayKey}`;
  const cached = dayDetailCache.get(cacheKey);
  if (cached) return cached;

  const { year } = parseDateKey(dateKey);
  const boundaries = buildMonthBoundaries(year);
  const terms = getSolarTermsForYears([year - 1, year, year + 1]);
  const termMap = buildSolarTermMap(terms);
  const base = buildBaseCell(dateKey, monthKeyFromDateKey(dateKey), todayKey, termMap, boundaries);
  const almanac = generateAlmanacSelection({
    topic: 'custom',
    startDate: dateKey,
    endDate: dateKey,
  }).days.find((day) => day.date === dateKey);
  if (!almanac) throw new Error(`无法生成 ${dateKey} 的黄历资料。`);

  const chinaNoonTimestamp = getChinaNoonTimestamp(dateKey);
  const detail: GanzhiCalendarDayDetail = {
    ...base,
    almanac,
    monthBoundaryBefore: getNearestMonthBoundary(chinaNoonTimestamp, boundaries, 'before'),
    monthBoundaryAfter: getNearestMonthBoundary(chinaNoonTimestamp, boundaries, 'after'),
    monthBoundaries: boundaries,
  };
  dayDetailCache.set(cacheKey, detail);
  if (dayDetailCache.size > 24)
    dayDetailCache.delete(dayDetailCache.keys().next().value ?? cacheKey);
  return detail;
}

export function clearGanzhiCalendarCache(): void {
  monthCache.clear();
  dayDetailCache.clear();
  solarTermsYearCache.clear();
  monthBoundaryCache.clear();
}

export { WEEKDAY_LABELS };
