import { SolarTime, SolarTerm } from 'tyme4ts';
import {
  calculateSolarTermEvidence,
  type SolarTermEvidence,
} from '../calendar/solar-term-evidence';
import { EARTHLY_BRANCHES, ZODIACS } from './baziMappingsData';
import type { LocalTimeRange } from './baziTypes';
import { createLocalTimeRange } from './luckTiming';

type SolarTermInstance = ReturnType<typeof SolarTerm.fromIndex>;
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;

export interface BaziMonthInfo {
  index: number;
  month: string;
  ganZhi: string;
  startDate: string;
  endDate: string;
  startDateTime?: string;
  endDateTime?: string;
  startTermName?: string;
  endTermName?: string;
  startTermEvidence?: SolarTermEvidence;
  endTermEvidence?: SolarTermEvidence;
  timeRange: LocalTimeRange;
}

export interface BaziMonthDayInfo {
  day: number;
  solarDate: string;
  solarLabel: string;
  ganZhi: string;
  lunar: string;
  term?: string;
  startDateTime?: string;
  endDateTime?: string;
  boundaryNote?: string;
  timeRange: LocalTimeRange;
}

export interface CalendarInfo {
  solarDate: string;
  lunarDate: string;
  ganZhi: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  jieQi: {
    prev: string;
    next: string;
  };
  festival: string;
}

interface DetailedBaziMonthInfo extends BaziMonthInfo {
  startAt: Date;
  endAt: Date;
}

interface DetailedBaziMonthDayInfo extends BaziMonthDayInfo {
  startAt: Date;
  endAt: Date;
}

function formatNumber(value: number): string {
  return String(value).padStart(2, '0');
}

function formatSolarDateKey(year: number, month: number, day: number): string {
  return `${year}-${formatNumber(month)}-${formatNumber(day)}`;
}

function assertYear(year: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error('年份需在 1900-2100 之间。');
  }
}

function assertBaziMonthIndex(month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('节令月序号需在 1-12 之间。');
  }
}

function assertValidDate(date: Date, label: string) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`${label}不是有效日期。`);
  }
}

function formatSolarDayKey(solarDay: {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
}): string {
  return formatSolarDateKey(solarDay.getYear(), solarDay.getMonth(), solarDay.getDay());
}

function createLocalDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function toNativeDate(time: {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
  getSecond(): number;
}) {
  return createLocalDate(
    time.getYear(),
    time.getMonth(),
    time.getDay(),
    time.getHour(),
    time.getMinute(),
    time.getSecond(),
  );
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${formatNumber(date.getMonth() + 1)}-${formatNumber(date.getDate())} ${formatNumber(date.getHours())}:${formatNumber(date.getMinutes())}`;
}

function formatHourMinute(date: Date): string {
  return `${formatNumber(date.getHours())}:${formatNumber(date.getMinutes())}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

function minDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function buildTermDateMap(years: number[]): Map<string, string> {
  const map = new Map<string, string>();

  years.forEach((year) => {
    for (let i = 0; i < 24; i++) {
      const term = SolarTerm.fromIndex(year, i);
      map.set(formatSolarDayKey(term.getJulianDay().getSolarDay()), term.getName());
    }
  });

  return map;
}

function collectSolarTerms(years: number[]): Array<{
  name: string;
  jd: number;
  date: string;
}> {
  const termMap = new Map<string, { name: string; jd: number; date: string }>();

  years.forEach((year) => {
    for (let i = 0; i < 24; i++) {
      const term = SolarTerm.fromIndex(year, i);
      const solarDay = term.getJulianDay().getSolarDay();
      const entry = {
        name: term.getName(),
        jd: term.getJulianDay().getDay(),
        date: formatSolarDayKey(solarDay),
      };

      termMap.set(`${entry.name}-${entry.date}`, entry);
    }
  });

  return Array.from(termMap.values()).sort((left, right) => left.jd - right.jd);
}

function buildBaziMonthInfoFromTerm(
  term: SolarTermInstance,
  index: number,
  termYear: number,
  termIndex: number,
): DetailedBaziMonthInfo {
  const nextTerm = term.next(2);
  const startSolarTime = term.getJulianDay().getSolarTime() as SolarTimeInstance;
  const endSolarTime = nextTerm.getJulianDay().getSolarTime() as SolarTimeInstance;
  const startAt = toNativeDate(startSolarTime);
  const endAt = toNativeDate(endSolarTime);
  const monthColumn = startSolarTime.next(60).getLunarHour().getEightChar().getMonth();
  const zhi = monthColumn.getEarthBranch().getName();

  return {
    index,
    month: `${zhi}月`,
    ganZhi: monthColumn.getName(),
    startDate: formatSolarDayKey(startSolarTime.getSolarDay()),
    endDate: formatSolarDayKey(endSolarTime.getSolarDay()),
    startDateTime: formatDateTime(startAt),
    endDateTime: formatDateTime(endAt),
    startTermName: term.getName(),
    endTermName: nextTerm.getName(),
    startTermEvidence: calculateSolarTermEvidence(
      termYear + Math.floor(termIndex / 24),
      termIndex % 24,
    ),
    endTermEvidence: calculateSolarTermEvidence(
      termYear + Math.floor((termIndex + 2) / 24),
      (termIndex + 2) % 24,
    ),
    timeRange: createLocalTimeRange(startAt, endAt),
    startAt,
    endAt,
  };
}

function getYearMonthsGanZhiDetailed(year: number): DetailedBaziMonthInfo[] {
  assertYear(year);
  return Array.from({ length: 12 }, (_, offset) => {
    const termIndex = 3 + offset * 2;
    return buildBaziMonthInfoFromTerm(
      SolarTerm.fromIndex(year, termIndex),
      offset + 1,
      year,
      termIndex,
    );
  });
}

function getMonthDaysInfoDetailed(year: number, month: number): DetailedBaziMonthDayInfo[] {
  assertYear(year);
  assertBaziMonthIndex(month);
  const monthInfo = getYearMonthsGanZhiDetailed(year)[month - 1];

  const termDateMap = buildTermDateMap([year - 1, year, year + 1, year + 2]);
  const firstDay = startOfLocalDay(monthInfo.startAt);
  const lastDay = startOfLocalDay(monthInfo.endAt);
  const lastDayInclusive =
    monthInfo.endAt.getHours() === 0 &&
    monthInfo.endAt.getMinutes() === 0 &&
    monthInfo.endAt.getSeconds() === 0
      ? addLocalDays(lastDay, -1)
      : lastDay;
  const list: DetailedBaziMonthDayInfo[] = [];

  for (
    let cursor = new Date(firstDay.getTime());
    cursor.getTime() <= lastDayInclusive.getTime();
    cursor = addLocalDays(cursor, 1)
  ) {
    const nextDay = addLocalDays(cursor, 1);
    const sliceStart = maxDate(cursor, monthInfo.startAt);
    const sliceEnd = minDate(nextDay, monthInfo.endAt);

    if (sliceStart.getTime() >= sliceEnd.getTime()) {
      continue;
    }

    const currentYear = cursor.getFullYear();
    const currentMonth = cursor.getMonth() + 1;
    const currentDay = cursor.getDate();
    const solarTime = SolarTime.fromYmdHms(currentYear, currentMonth, currentDay, 12, 0, 0);
    const lunarHour = solarTime.getLunarHour();
    const lunarDay = lunarHour.getLunarDay();
    const solarDate = formatSolarDateKey(currentYear, currentMonth, currentDay);
    const boundaryNotes: string[] = [];

    if (cursor.getTime() === firstDay.getTime() && sliceStart.getTime() > cursor.getTime()) {
      boundaryNotes.push(
        `${monthInfo.startTermName}于${formatHourMinute(monthInfo.startAt)}交节，本日自该刻起进入${monthInfo.month}`,
      );
    }
    if (cursor.getTime() === lastDay.getTime() && sliceEnd.getTime() < nextDay.getTime()) {
      boundaryNotes.push(
        `${monthInfo.endTermName}于${formatHourMinute(monthInfo.endAt)}交节，本日到该刻前仍属${monthInfo.month}`,
      );
    }

    list.push({
      day: list.length + 1,
      solarDate,
      solarLabel: `${currentMonth}/${currentDay}`,
      ganZhi: lunarHour.getEightChar().getDay().getName(),
      lunar: `${lunarDay.getLunarMonth().getMonth()}月${lunarDay.getName()}`,
      term: termDateMap.get(solarDate) || '',
      startDateTime: formatDateTime(sliceStart),
      endDateTime: formatDateTime(new Date(sliceEnd.getTime() - 1000)),
      boundaryNote: boundaryNotes.join('；'),
      timeRange: createLocalTimeRange(sliceStart, sliceEnd),
      startAt: sliceStart,
      endAt: sliceEnd,
    });
  }

  return list;
}

export function getCalendarInfo(date: Date = new Date()): CalendarInfo {
  assertValidDate(date, '时间');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const solarTime = SolarTime.fromYmdHms(year, month, day, hour, minute, second);
  const lunarHour = solarTime.getLunarHour();
  const lunarDay = lunarHour.getLunarDay();
  const lunarMonth = lunarDay.getLunarMonth();
  const lunarYear = lunarMonth.getLunarYear();

  const eightChar = lunarHour.getEightChar();
  const yearPillar = eightChar.getYear().getName();
  const monthPillar = eightChar.getMonth().getName();
  const dayPillar = eightChar.getDay().getName();
  const hourPillar = eightChar.getHour().getName();

  let prevJieQiName = '未知';
  let nextJieQiName = '未知';
  let prevJieQiDate = '';
  let nextJieQiDate = '';

  const currentYear = year;
  const terms = collectSolarTerms([currentYear - 1, currentYear, currentYear + 1]);
  const currentJd = solarTime.getJulianDay().getDay();
  let minDiffPrev = 999;
  let minDiffNext = 999;

  for (const term of terms) {
    const termJd = term.jd;
    const diff = termJd - currentJd;

    if (diff <= 0) {
      if (Math.abs(diff) < minDiffPrev) {
        minDiffPrev = Math.abs(diff);
        prevJieQiName = term.name;
        prevJieQiDate = term.date;
      }
    } else {
      if (diff < minDiffNext) {
        minDiffNext = diff;
        nextJieQiName = term.name;
        nextJieQiDate = term.date;
      }
    }
  }

  return {
    solarDate: `${year}年${month}月${day}日 ${hour}时`,
    lunarDate: `${lunarYear.getYear()}年${lunarMonth.getName()}${lunarDay.getName()}`,
    ganZhi: {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar,
    },
    jieQi: {
      prev: `${prevJieQiName} (${prevJieQiDate})`,
      next: `${nextJieQiName} (${nextJieQiDate})`,
    },
    festival: '',
  };
}

export function getCurrentTimeDescription(): string {
  const info = getCalendarInfo();
  return [
    '【当前时令】',
    `公历：${info.solarDate}`,
    `农历：${info.lunarDate}`,
    `四柱：${info.ganZhi.year}年 ${info.ganZhi.month}月 ${info.ganZhi.day}日 ${info.ganZhi.hour}时`,
    `节气：${info.jieQi.prev} 至 ${info.jieQi.next}`,
  ].join('\n');
}

export function getYearMonthsGanZhi(year: number): BaziMonthInfo[] {
  return getYearMonthsGanZhiDetailed(year).map(
    ({ startAt: _startAt, endAt: _endAt, ...item }) => item,
  );
}

export function getBaziMonthIndexByDate(
  year: number,
  referenceDate: Date = new Date(),
): number | undefined {
  assertYear(year);
  assertValidDate(referenceDate, '参考时间');
  return getYearMonthsGanZhiDetailed(year).find(
    (item) =>
      referenceDate.getTime() >= item.startAt.getTime() &&
      referenceDate.getTime() < item.endAt.getTime(),
  )?.index;
}

export function getBaziDayIndexByDate(
  year: number,
  monthIndex: number,
  referenceDate: Date = new Date(),
): number | undefined {
  assertYear(year);
  assertBaziMonthIndex(monthIndex);
  assertValidDate(referenceDate, '参考时间');
  return getMonthDaysInfoDetailed(year, monthIndex).find(
    (item) =>
      referenceDate.getTime() >= item.startAt.getTime() &&
      referenceDate.getTime() < item.endAt.getTime(),
  )?.day;
}

export function getYearInfo(year: number): {
  year: number;
  yearGanZhi: string;
  zodiac: string;
  months: BaziMonthInfo[];
} {
  assertYear(year);
  const midYear = SolarTime.fromYmdHms(year, 6, 15, 12, 0, 0);
  const eightChar = midYear.getLunarHour().getEightChar();
  const yearGanZhi = eightChar.getYear().getName();

  const yearZhi = eightChar.getYear().getEarthBranch().getName();
  const zodiacIndex = EARTHLY_BRANCHES.indexOf(yearZhi as (typeof EARTHLY_BRANCHES)[number]);
  const zodiac = zodiacIndex >= 0 ? ZODIACS[zodiacIndex] : '';

  return {
    year,
    yearGanZhi,
    zodiac,
    months: getYearMonthsGanZhi(year),
  };
}

export function getMonthDaysInfo(year: number, month: number): BaziMonthDayInfo[] {
  assertYear(year);
  assertBaziMonthIndex(month);
  return getMonthDaysInfoDetailed(year, month).map(
    ({ startAt: _startAt, endAt: _endAt, ...item }) => item,
  );
}
