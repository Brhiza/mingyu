import { SolarDay } from 'tyme4ts';
import type { ChartInput } from '../types/chart';
import type { DecadalTimelineOption } from './iztro/decadal';
import { buildAstrolabeFromInput } from './iztro/runtime-helpers';
import { createZiweiHoroscopeResolver } from './iztro/decadal';
import { buildYearDate, buildZiweiFlowMonths, collectYearBoundaryDates } from './fortune-timeline';

export interface ZiweiYearOption {
  year: number;
  age: number;
  dateStr: string;
  endDateStr: string;
  label: string;
  ganZhi: string;
}

export interface ZiweiMonthOption {
  month: number;
  dateStr: string;
  endDateStr: string;
  label: string;
  ganZhi: string;
}

export interface ZiweiDayOption {
  day: number;
  dateStr: string;
  label: string;
  ganZhi: string;
}

export interface ZiweiFortuneOptionsBuildOptions {
  /** 可省略；省略时从紫微命盘取得换算后的公历出生日期。 */
  birthSolarDate?: string;
  hourIndex?: number;
  selectedYearDateStr?: string;
  selectedMonthDateStr?: string;
}

export interface ZiweiFortuneOptions {
  yearOptions: ZiweiYearOption[];
  monthOptions: ZiweiMonthOption[];
  dayOptions: ZiweiDayOption[];
  effectiveYearDateStr: string;
  effectiveMonthDateStr: string;
}

function parseDateParts(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`日期格式无效：${dateStr}。`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > maxDay) {
    throw new Error(`日期无效：${dateStr}。`);
  }
  return { year, month, day };
}

function assertDecadal(selected: Pick<DecadalTimelineOption, 'startAge' | 'endAge'>): void {
  if (
    !Number.isInteger(selected.startAge) ||
    !Number.isInteger(selected.endAge) ||
    selected.startAge < 1 ||
    selected.endAge < selected.startAge
  ) {
    throw new Error('紫微童限或大限年龄范围无效。');
  }
}

function formatSolarDay(day: SolarDay): string {
  return `${day.getYear()}-${String(day.getMonth()).padStart(2, '0')}-${String(day.getDay()).padStart(2, '0')}`;
}

function toSolarDay(dateStr: string): SolarDay {
  const { year, month, day } = parseDateParts(dateStr);
  return SolarDay.fromYmd(year, month, day);
}

/** 从一个童限或大限直接生成流年、流月、流日选项及其干支。 */
export async function buildZiweiFortuneOptions(
  input: ChartInput,
  selectedDecadal: Pick<DecadalTimelineOption, 'startAge' | 'endAge'>,
  options: ZiweiFortuneOptionsBuildOptions = {},
): Promise<ZiweiFortuneOptions> {
  assertDecadal(selectedDecadal);
  const astrolabe = await buildAstrolabeFromInput(input);
  const birthSolarDate = options.birthSolarDate?.trim() || astrolabe.solarDate;
  parseDateParts(birthSolarDate);
  const hourIndex = options.hourIndex ?? input.birthTimeIndex;
  if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex > 12) {
    throw new Error('紫微运限时辰索引需在 0-12 之间。');
  }

  const yearOptions: ZiweiYearOption[] = [];
  const resolveHoroscope = createZiweiHoroscopeResolver(astrolabe, input);
  for (let age = selectedDecadal.startAge; age <= selectedDecadal.endAge; age += 1) {
    const ageStartDateStr = await buildYearDate(
      astrolabe,
      input,
      age,
      hourIndex,
      resolveHoroscope,
      birthSolarDate,
    );
    const nextAgeDateStr = await buildYearDate(
      astrolabe,
      input,
      age + 1,
      hourIndex,
      resolveHoroscope,
      birthSolarDate,
    );
    const ageEndDateStr = formatSolarDay(toSolarDay(nextAgeDateStr).next(-1));
    const yearBoundaries = await collectYearBoundaryDates(
      ageStartDateStr,
      ageEndDateStr,
      hourIndex,
      resolveHoroscope,
    );
    const segmentStarts = [ageStartDateStr, ...yearBoundaries];
    for (const [index, dateStr] of segmentStarts.entries()) {
      const endDateStr = segmentStarts[index + 1]
        ? formatSolarDay(toSolarDay(segmentStarts[index + 1]!).next(-1))
        : ageEndDateStr;
      const horoscope = await resolveHoroscope(dateStr, hourIndex);
      const year = parseDateParts(dateStr).year;
      yearOptions.push({
        year,
        age,
        dateStr,
        endDateStr,
        label: `${year}年`,
        ganZhi: `${horoscope.yearly.heavenlyStem}${horoscope.yearly.earthlyBranch}`,
      });
    }
  }

  const effectiveYearDateStr =
    yearOptions.find(
      (item) =>
        options.selectedYearDateStr !== undefined &&
        item.dateStr <= options.selectedYearDateStr &&
        options.selectedYearDateStr <= item.endDateStr,
    )?.dateStr ??
    yearOptions[0]?.dateStr ??
    '';
  const selectedYearOption = yearOptions.find((item) => item.dateStr === effectiveYearDateStr);
  const selectedYearHoroscope = selectedYearOption
    ? await resolveHoroscope(effectiveYearDateStr, hourIndex)
    : undefined;
  const flowMonths = selectedYearHoroscope
    ? await buildZiweiFlowMonths(
        astrolabe,
        input,
        effectiveYearDateStr,
        hourIndex,
        selectedYearHoroscope,
        resolveHoroscope,
      )
    : [];
  const monthOptions: ZiweiMonthOption[] = [];
  for (const [index, item] of flowMonths.entries()) {
    const nextMonthStart = flowMonths[index + 1]?.dateStr;
    const nextMonthlySignature = `${item.layer.heavenlyStem}${item.layer.earthlyBranch}`;
    let monthEndDateStr: string;
    if (nextMonthStart) {
      monthEndDateStr = formatSolarDay(toSolarDay(nextMonthStart).next(-1));
    } else {
      let nextStart: string | undefined;
      for (let offset = 1; offset <= 70; offset += 1) {
        const candidate = formatSolarDay(toSolarDay(item.dateStr).next(offset));
        const horoscope = await resolveHoroscope(candidate, hourIndex);
        if (
          `${horoscope.monthly.heavenlyStem}${horoscope.monthly.earthlyBranch}` !==
          nextMonthlySignature
        ) {
          nextStart = candidate;
          break;
        }
      }
      if (!nextStart) throw new Error('紫微无法定位流月的结束日期。');
      monthEndDateStr = formatSolarDay(toSolarDay(nextStart).next(-1));
    }
    const clippedStart =
      item.dateStr > selectedYearOption!.dateStr ? item.dateStr : selectedYearOption!.dateStr;
    const clippedEnd =
      monthEndDateStr < selectedYearOption!.endDateStr
        ? monthEndDateStr
        : selectedYearOption!.endDateStr;
    if (clippedStart > clippedEnd) continue;
    monthOptions.push({
      month: item.month,
      dateStr: clippedStart,
      endDateStr: clippedEnd,
      label: item.boundaryFragment ? `上年${item.month}月末` : `${item.month}月`,
      ganZhi: nextMonthlySignature,
    });
  }

  const effectiveMonthDateStr =
    monthOptions.find(
      (item) =>
        options.selectedMonthDateStr !== undefined &&
        item.dateStr <= options.selectedMonthDateStr &&
        options.selectedMonthDateStr <= item.endDateStr,
    )?.dateStr ??
    monthOptions[0]?.dateStr ??
    '';
  const selectedMonthIndex = monthOptions.findIndex(
    (item) => item.dateStr === effectiveMonthDateStr,
  );
  const dayOptions: ZiweiDayOption[] = [];
  if (selectedMonthIndex >= 0) {
    const selectedMonthOption = monthOptions[selectedMonthIndex]!;
    const monthStart = toSolarDay(selectedMonthOption.dateStr);
    const dayCount = toSolarDay(selectedMonthOption.endDateStr).subtract(monthStart) + 1;
    for (let offset = 0; offset < dayCount; offset += 1) {
      const dateStr = formatSolarDay(monthStart.next(offset));
      const { month, day } = parseDateParts(dateStr);
      const horoscope = await resolveHoroscope(dateStr, hourIndex);
      dayOptions.push({
        day,
        dateStr,
        label: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
        ganZhi: `${horoscope.daily.heavenlyStem}${horoscope.daily.earthlyBranch}`,
      });
    }
  }

  return {
    yearOptions,
    monthOptions,
    dayOptions,
    effectiveYearDateStr,
    effectiveMonthDateStr,
  };
}
