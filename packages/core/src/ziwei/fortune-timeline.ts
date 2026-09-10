import type { ChartInput } from '../types/chart';
import type { IztroAstrolabe, IztroHoroscope } from '../types/iztro';
import { LunarDay, SolarDay } from 'tyme4ts';
import { SHICHEN_PERIODS } from '../calendar/dateUtils';
import { getDefaultHoroscopeContext } from './iztro/runtime-helpers';
import {
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
  shiftLunarYear,
} from './iztro/runtime-helpers';
import {
  buildVerifiedDecadalTimelineOptions,
  type DecadalTimelineOption,
  formatDecadalAgeRange,
} from './iztro/decadal';

/** 紫微任务书可读取的时间范围。范围只描述已有排盘精度，不制造新的周期。 */
export type ZiweiFortuneRangeScope = 'current' | 'all' | 'year' | 'month' | 'day' | 'hour';

export type ZiweiFortuneRangeOptions = {
  scope: ZiweiFortuneRangeScope;
  /** 未提供时使用默认当前时点；网页、API 和 MCP 可传入同一固定日期。 */
  dateStr?: string;
  hourIndex?: number;
};

export type ZiweiFortuneLayer = {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  palaceNames: string[];
  palaceTargets: string[];
  mutagen: string[];
  stars: string[][];
  yearlyDecStars?: {
    jiangqian12: string[];
    suiqian12: string[];
  };
};

export type ZiweiFortuneMonth = {
  month: number;
  dateStr: string;
  layer: ZiweiFortuneLayer;
  /** 流年从节令年首开始但尚未进入本年正月时，保留这一段真实交界资料。 */
  boundaryFragment?: 'previous-year-tail';
};

export type ZiweiFortuneDay = {
  dateStr: string;
  layer: ZiweiFortuneLayer;
};

export type ZiweiFortuneYear = {
  age: number;
  year: number;
  dateStr: string;
  endDateStr?: string;
  label: string;
  ganZhi: string;
  layer: ZiweiFortuneLayer;
  months?: ZiweiFortuneMonth[];
  targetMonth?: ZiweiFortuneMonth;
  targetDay?: ZiweiFortuneDay;
  targetHour?: ZiweiFortuneLayer;
};

export type ZiweiFortunePeriod = DecadalTimelineOption & {
  layer: ZiweiFortuneLayer;
  years: ZiweiFortuneYear[];
};

export type ZiweiFortuneTimeline = {
  scope: ZiweiFortuneRangeScope;
  targetDateStr: string;
  targetHourIndex: number;
  targetAge: number;
  targetYear: number;
  actualStartDateStr: string;
  actualEndDateStr: string;
  selectedPeriodIndex: number;
  periods: ZiweiFortunePeriod[];
};

const MUTAGEN_LABELS = ['禄', '权', '科', '忌'] as const;
const FLOW_MONTH_BRANCHES = [
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
  '子',
  '丑',
];

function parseDateParts(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`紫微运限日期格式无效：${dateStr}。`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function assertHourIndex(hourIndex: number) {
  if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex > 12) {
    throw new Error('紫微运限时辰索引需在 0-12 之间。');
  }
}

function serializeLayer(
  horoscope: IztroHoroscope,
  scope: 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly' | 'age',
  astrolabe: IztroAstrolabe,
): ZiweiFortuneLayer {
  const item = horoscope[scope];
  return {
    name: item.name,
    heavenlyStem: item.heavenlyStem,
    earthlyBranch: item.earthlyBranch,
    palaceNames: item.palaceNames.map(String),
    palaceTargets: astrolabe.palaces.map((palace) => palace.name),
    mutagen: item.mutagen.map(String),
    stars: (item.stars ?? []).map((palaceStars) => palaceStars.map((star) => star.name)),
    ...(scope === 'yearly'
      ? {
          yearlyDecStars: {
            jiangqian12: horoscope.yearly.yearlyDecStar.jiangqian12.map(String),
            suiqian12: horoscope.yearly.yearlyDecStar.suiqian12.map(String),
          },
        }
      : {}),
  };
}

function formatSolarDay(day: SolarDay) {
  return `${day.getYear()}-${String(day.getMonth()).padStart(2, '0')}-${String(day.getDay()).padStart(2, '0')}`;
}

function shiftSolarDay(dateStr: string, amount: number) {
  return formatSolarDay(
    SolarDay.fromYmd(...(dateStr.split('-').map(Number) as [number, number, number])).next(amount),
  );
}

function yearlySignature(horoscope: IztroHoroscope) {
  return `${horoscope.yearly.heavenlyStem}${horoscope.yearly.earthlyBranch}`;
}

function dateToDayNumber(dateStr: string) {
  const { year, month, day } = parseDateParts(dateStr);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dateDistance(startDateStr: string, endDateStr: string) {
  return dateToDayNumber(endDateStr) - dateToDayNumber(startDateStr);
}

function maxDate(left: string, right: string) {
  return left > right ? left : right;
}

function minDate(left: string, right: string) {
  return left < right ? left : right;
}

type HoroscopeCache = Map<string, IztroHoroscope>;

async function getCachedHoroscope(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  dateStr: string,
  hourIndex: number,
  cache: HoroscopeCache,
) {
  const cached = cache.get(dateStr);
  if (cached) return cached;
  const horoscope = await buildHoroscopeFromInput(astrolabe, input, dateStr, hourIndex);
  cache.set(dateStr, horoscope);
  return horoscope;
}

/** 在两个已知不同流年干支之间，用有界二分定位首个新干支日。 */
async function findFirstYearChange(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  startDateStr: string,
  endDateStr: string,
  hourIndex: number,
  cache: HoroscopeCache,
) {
  const distance = dateDistance(startDateStr, endDateStr);
  if (distance <= 0) return null;
  const startHoroscope = await getCachedHoroscope(astrolabe, input, startDateStr, hourIndex, cache);
  const endHoroscope = await getCachedHoroscope(astrolabe, input, endDateStr, hourIndex, cache);
  const startSignature = yearlySignature(startHoroscope);
  if (startSignature === yearlySignature(endHoroscope)) return null;

  let low = 0;
  let high = distance;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    const candidate = shiftSolarDay(startDateStr, middle);
    const horoscope = await getCachedHoroscope(astrolabe, input, candidate, hourIndex, cache);
    if (yearlySignature(horoscope) === startSignature) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return shiftSolarDay(startDateStr, high);
}

/**
 * 年龄分界和流年分界可能不在同一天。按公历每年一月至三月的实际引擎结果
 * 找到流年切换，再把该日期与年龄分界合并；这样不会把两个流年压成一条年龄行。
 */
async function collectYearBoundaryDates(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  startDateStr: string,
  endDateStr: string,
  hourIndex: number,
  cache: HoroscopeCache,
) {
  const boundaries: string[] = [];
  const startYear = parseDateParts(startDateStr).year;
  const endYear = parseDateParts(endDateStr).year;
  for (let year = startYear; year <= endYear; year += 1) {
    const windowStart = maxDate(startDateStr, `${year}-01-01`);
    const windowEnd = minDate(endDateStr, `${year}-03-01`);
    if (dateDistance(windowStart, windowEnd) <= 0) continue;
    const boundary = await findFirstYearChange(
      astrolabe,
      input,
      windowStart,
      windowEnd,
      hourIndex,
      cache,
    );
    if (boundary) boundaries.push(boundary);
  }
  return boundaries;
}

async function findTargetYearBoundary(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  targetDateStr: string,
  targetHourIndex: number,
  targetHoroscope: IztroHoroscope,
  cache: HoroscopeCache,
) {
  const targetSignature = yearlySignature(targetHoroscope);
  const findBoundary = async (direction: -1 | 1) => {
    let sameOffset = 0;
    let differentOffset = 1;
    while (true) {
      const candidate = shiftSolarDay(targetDateStr, direction * differentOffset);
      const horoscope = await getCachedHoroscope(
        astrolabe,
        input,
        candidate,
        targetHourIndex,
        cache,
      );
      if (yearlySignature(horoscope) !== targetSignature) break;
      sameOffset = differentOffset;
      if (differentOffset === 400) return null;
      differentOffset = Math.min(differentOffset * 2, 400);
    }
    while (differentOffset - sameOffset > 1) {
      const middle = Math.floor((sameOffset + differentOffset) / 2);
      const candidate = shiftSolarDay(targetDateStr, direction * middle);
      const horoscope = await getCachedHoroscope(
        astrolabe,
        input,
        candidate,
        targetHourIndex,
        cache,
      );
      if (yearlySignature(horoscope) === targetSignature) {
        sameOffset = middle;
      } else {
        differentOffset = middle;
      }
    }
    return direction === -1
      ? shiftSolarDay(targetDateStr, -(differentOffset - 1))
      : shiftSolarDay(targetDateStr, sameOffset);
  };
  const startDateStr = await findBoundary(-1);
  const endDateStr = await findBoundary(1);
  if (!startDateStr || !endDateStr) {
    throw new Error(`紫微无法在目标日期前后400日内完整定位流年${targetSignature}的边界。`);
  }
  return { startDateStr, endDateStr };
}

/**
 * 年龄边界沿用 iztro 的虚岁口径：普通分界在对应农历年正月初一，
 * 生日分界则从引擎真正返回该虚岁的首日开始。不能用出生日期的公历年直移。
 */
async function buildYearDate(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  age: number,
  hourIndex: number,
) {
  if (age === 1) {
    return formatSolarDay(
      SolarDay.fromYmd(...(astrolabe.solarDate.split('-').map(Number) as [number, number, number])),
    );
  }
  const anniversary = shiftLunarYear(astrolabe.solarDate, age - 1);
  const anniversarySolar = SolarDay.fromYmd(
    ...(anniversary.split('-').map(Number) as [number, number, number]),
  );
  if ((input.ageDivide ?? 'normal') !== 'birthday') {
    const firstDay = anniversarySolar
      .getLunarDay()
      .getLunarMonth()
      .getLunarYear()
      .getFirstMonth()
      .getFirstDay()
      .getSolarDay();
    return formatSolarDay(firstDay);
  }

  for (let offset = 0; offset <= 62; offset += 1) {
    const candidate = formatSolarDay(anniversarySolar.next(offset));
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, candidate, hourIndex);
    if (horoscope.age.nominalAge === age) return candidate;
  }
  throw new Error(`iztro 无法定位虚岁 ${age} 的生日分界。`);
}

async function buildYear(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  age: number,
  hourIndex: number,
  dateOverride?: string,
): Promise<ZiweiFortuneYear> {
  const dateStr = dateOverride ?? (await buildYearDate(astrolabe, input, age, hourIndex));
  const horoscope = await buildHoroscopeFromInput(astrolabe, input, dateStr, hourIndex);
  const year = parseDateParts(dateStr).year;
  return {
    age,
    year,
    dateStr,
    label: `${year}年`,
    ganZhi: `${horoscope.yearly.heavenlyStem}${horoscope.yearly.earthlyBranch}`,
    layer: serializeLayer(horoscope, 'yearly', astrolabe),
  };
}

async function splitYearAtBoundaries(
  year: ZiweiFortuneYear,
  boundaryDates: string[],
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  hourIndex: number,
  cache: HoroscopeCache,
) {
  const startDateStr = year.dateStr;
  const endDateStr = year.endDateStr;
  if (!endDateStr) return [year];
  const starts = Array.from(
    new Set([
      startDateStr,
      ...boundaryDates.filter((dateStr) => dateStr > startDateStr && dateStr <= endDateStr),
    ]),
  ).sort();
  const segments: ZiweiFortuneYear[] = [];
  for (const [index, segmentStart] of starts.entries()) {
    const segmentEnd =
      starts[index + 1] !== undefined ? shiftSolarDay(starts[index + 1]!, -1) : endDateStr;
    const horoscope = await getCachedHoroscope(astrolabe, input, segmentStart, hourIndex, cache);
    const segmentYear = parseDateParts(segmentStart).year;
    segments.push({
      ...year,
      year: segmentYear,
      label: `${segmentYear}年`,
      dateStr: segmentStart,
      endDateStr: segmentEnd,
      ganZhi: yearlySignature(horoscope),
      layer: serializeLayer(horoscope, 'yearly', astrolabe),
    });
  }
  return segments;
}

async function addLowerLayers(
  year: ZiweiFortuneYear,
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  targetDateStr: string,
  targetHourIndex: number,
  includeMonths: boolean,
  includeDay: boolean,
  includeHour: boolean,
  targetHoroscope: IztroHoroscope,
  horoscopeCache: HoroscopeCache,
) {
  if (!includeMonths) return;

  const targetYearlySignature = `${targetHoroscope.yearly.heavenlyStem}${targetHoroscope.yearly.earthlyBranch}`;
  const targetMonthlySignature = `${targetHoroscope.monthly.heavenlyStem}${targetHoroscope.monthly.earthlyBranch}`;
  const monthAnchors: string[] = [];

  if ((input.horoscopeDivide ?? 'normal') === 'exact') {
    // iztro/lunar-lite 的节令切换可能落在节气日的不同一项，不能用固定的
    // “每隔一个节气”猜边界。逐日读取引擎返回的流月干支，记录实际切换首日。
    const { startDateStr: exactYearStart, endDateStr: exactYearEnd } = await findTargetYearBoundary(
      astrolabe,
      input,
      targetDateStr,
      targetHourIndex,
      targetHoroscope,
      horoscopeCache,
    );
    let previousMonthlySignature = '';
    const spanDays = SolarDay.fromYmd(
      ...(exactYearEnd.split('-').map(Number) as [number, number, number]),
    ).subtract(
      SolarDay.fromYmd(...(exactYearStart.split('-').map(Number) as [number, number, number])),
    );
    for (let offset = 0; offset <= spanDays; offset += 1) {
      const dateStr = shiftSolarDay(exactYearStart, offset);
      const horoscope = await buildHoroscopeFromInput(astrolabe, input, dateStr, targetHourIndex);
      const yearlySignature = `${horoscope.yearly.heavenlyStem}${horoscope.yearly.earthlyBranch}`;
      if (yearlySignature !== targetYearlySignature) continue;
      const monthlySignature = `${horoscope.monthly.heavenlyStem}${horoscope.monthly.earthlyBranch}`;
      if (monthlySignature !== previousMonthlySignature) {
        monthAnchors.push(dateStr);
        previousMonthlySignature = monthlySignature;
      }
    }
  } else {
    const targetLunarYear = SolarDay.fromYmd(
      ...(targetDateStr.split('-').map(Number) as [number, number, number]),
    )
      .getLunarDay()
      .getLunarMonth()
      .getLunarYear()
      .getYear();
    for (let month = 1; month <= 12; month += 1) {
      monthAnchors.push(formatSolarDay(LunarDay.fromYmd(targetLunarYear, month, 1).getSolarDay()));
    }
  }

  const months: ZiweiFortuneMonth[] = [];
  let previousMonthlySignature = '';
  for (const [index, dateStr] of monthAnchors.sort().entries()) {
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, dateStr, targetHourIndex);
    const monthlySignature = `${horoscope.monthly.heavenlyStem}${horoscope.monthly.earthlyBranch}`;
    if (monthlySignature === previousMonthlySignature) {
      throw new Error('紫微流月边界未产生新的月干支，不能把重复月份压缩为一层。');
    }
    previousMonthlySignature = monthlySignature;
    const layer = serializeLayer(horoscope, 'monthly', astrolabe);
    const month = getFlowMonthNumber(layer);
    months.push({
      month,
      dateStr,
      layer,
      ...(input.horoscopeDivide === 'exact' && index === 0 && month !== 1
        ? { boundaryFragment: 'previous-year-tail' as const }
        : {}),
    });
  }
  const regularMonths = months.filter((month) => !month.boundaryFragment);
  if (
    regularMonths.length !== 12 ||
    new Set(regularMonths.map((month) => month.month)).size !== 12 ||
    regularMonths.some((month) => month.month < 1 || month.month > 12)
  ) {
    throw new Error(
      `紫微未能按${input.horoscopeDivide === 'exact' ? '节气' : '农历'}边界生成十二个常规流月。`,
    );
  }
  year.months = months;

  const targetMonthIndex = months.findIndex((month) => {
    const horoscopeSignature = `${month.layer.heavenlyStem}${month.layer.earthlyBranch}`;
    return horoscopeSignature === targetMonthlySignature;
  });
  if (targetMonthIndex >= 0) {
    year.targetMonth = {
      ...months[targetMonthIndex],
      dateStr: targetDateStr,
      layer: serializeLayer(targetHoroscope, 'monthly', astrolabe),
    };
  }
  if (!includeDay) return;

  year.targetDay = {
    dateStr: targetDateStr,
    layer: serializeLayer(targetHoroscope, 'daily', astrolabe),
  };
  if (includeHour) {
    year.targetHour = serializeLayer(targetHoroscope, 'hourly', astrolabe);
  }
}

async function buildTimelineFromAstrolabe(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  decadalTimeline: DecadalTimelineOption[],
  options: Required<Pick<ZiweiFortuneRangeOptions, 'scope' | 'dateStr' | 'hourIndex'>>,
): Promise<ZiweiFortuneTimeline> {
  const targetHoroscope = await buildHoroscopeFromInput(
    astrolabe,
    input,
    options.dateStr,
    options.hourIndex,
  );
  const targetAge = targetHoroscope.age.nominalAge;
  const selectedPeriodIndex = decadalTimeline.findIndex(
    (period) => targetAge >= period.startAge && targetAge <= period.endAge,
  );
  if (selectedPeriodIndex < 0) {
    throw new Error(`所选日期对应虚岁 ${targetAge}，超出紫微已支持的运限范围。`);
  }

  const targetYear = parseDateParts(options.dateStr).year;
  const horoscopeCache: HoroscopeCache = new Map([[options.dateStr, targetHoroscope]]);
  // 指定年及其下层范围都以目标流年的真实起止为父范围；当前阶段和全部仍沿用各自的
  // 大限/全量范围，不因目标流年跨段而改变入口语义。
  const targetYearBounds =
    options.scope !== 'all' && options.scope !== 'current'
      ? await findTargetYearBoundary(
          astrolabe,
          input,
          options.dateStr,
          options.hourIndex,
          targetHoroscope,
          horoscopeCache,
        )
      : null;
  const periodIndexes =
    options.scope === 'all'
      ? decadalTimeline.map((_, index) => index)
      : options.scope === 'current'
        ? [selectedPeriodIndex]
        : // 目标流年与大限均按包含起止日的区间判断，跨大限时保留两侧各自的 period.layer。
          decadalTimeline
            .map((period, index) => ({ period, index }))
            .filter(({ period }) => {
              const periodEndDateStr = period.endDateStr ?? period.dateStr;
              return (
                period.dateStr <= targetYearBounds!.endDateStr &&
                periodEndDateStr >= targetYearBounds!.startDateStr
              );
            })
            .map(({ index }) => index);
  if (!periodIndexes.length) {
    throw new Error('所选流年未落入紫微已支持的大限范围。');
  }
  const includeMonths = options.scope !== 'all';
  const includeDay = options.scope === 'day' || options.scope === 'hour';
  const includeHour = options.scope === 'hour';
  const periodDrafts: Array<{
    period: DecadalTimelineOption;
    decadalHoroscope: IztroHoroscope;
    years: ZiweiFortuneYear[];
  }> = [];

  for (const periodIndex of periodIndexes) {
    const period = decadalTimeline[periodIndex];
    if (!period) continue;
    const startYear = period.startAge;
    const endYear = period.endAge;
    const firstYearDate = await buildYearDate(astrolabe, input, startYear, options.hourIndex);
    const decadalHoroscope = await getCachedHoroscope(
      astrolabe,
      input,
      firstYearDate,
      options.hourIndex,
      horoscopeCache,
    );
    const years: ZiweiFortuneYear[] = [];
    for (let age = startYear; age <= endYear; age += 1) {
      years.push(await buildYear(astrolabe, input, age, options.hourIndex));
    }
    if (!years.length) {
      throw new Error(`所选日期对应的流年不在${period.label}支持范围内。`);
    }
    const yearsWithBoundaries = years.map((year, index) => ({
      ...year,
      endDateStr: years[index + 1]?.dateStr
        ? shiftSolarDay(years[index + 1]!.dateStr, -1)
        : period.endDateStr,
    }));
    periodDrafts.push({ period, decadalHoroscope, years: yearsWithBoundaries });
  }

  const firstDraft = periodDrafts[0];
  const lastDraft = periodDrafts.at(-1);
  if (!firstDraft || !lastDraft) throw new Error('紫微未生成可用的运限资料。');
  const shouldSplitYearLayers =
    input.yearDivide === 'exact' ||
    input.horoscopeDivide === 'exact' ||
    input.ageDivide === 'birthday';
  const yearBoundaryDates = shouldSplitYearLayers
    ? await collectYearBoundaryDates(
        astrolabe,
        input,
        firstDraft.years[0]!.dateStr,
        lastDraft.years.at(-1)!.endDateStr ??
          lastDraft.period.endDateStr ??
          lastDraft.years.at(-1)!.dateStr,
        options.hourIndex,
        horoscopeCache,
      )
    : [];
  const periods: ZiweiFortunePeriod[] = [];
  for (const draft of periodDrafts) {
    let splitYears = draft.years;
    if (shouldSplitYearLayers) {
      splitYears = [];
      for (const year of draft.years) {
        splitYears.push(
          ...(await splitYearAtBoundaries(
            year,
            yearBoundaryDates,
            astrolabe,
            input,
            options.hourIndex,
            horoscopeCache,
          )),
        );
      }
    }
    const targetYearEntry = splitYears.find(
      (year) =>
        year.age === targetAge &&
        year.dateStr <= options.dateStr &&
        (year.endDateStr ?? year.dateStr) >= options.dateStr,
    );
    const isTargetPeriod = targetAge >= draft.period.startAge && targetAge <= draft.period.endAge;
    if (options.scope !== 'all' && isTargetPeriod && !targetYearEntry) {
      throw new Error(`所选日期对应的流年不在${draft.period.label}支持范围内。`);
    }
    if (targetYearEntry && isTargetPeriod && options.scope !== 'all') {
      await addLowerLayers(
        targetYearEntry,
        astrolabe,
        input,
        options.dateStr,
        options.hourIndex,
        includeMonths,
        includeDay,
        includeHour,
        targetHoroscope,
        horoscopeCache,
      );
    }
    const visibleYears =
      options.scope !== 'all' && options.scope !== 'current'
        ? // splitYears 也是闭区间；边界相等表示该段确实覆盖目标流年的首/末日。
          splitYears.filter((year) => {
            const yearEndDateStr = year.endDateStr ?? year.dateStr;
            return (
              year.dateStr <= targetYearBounds!.endDateStr &&
              yearEndDateStr >= targetYearBounds!.startDateStr
            );
          })
        : splitYears;
    periods.push({
      ...draft.period,
      layer: serializeLayer(draft.decadalHoroscope, 'decadal', astrolabe),
      years: visibleYears,
    });
  }

  const firstPeriod = periods[0];
  const lastPeriod = periods.at(-1);
  if (!firstPeriod || !lastPeriod) throw new Error('紫微未生成可用的运限资料。');
  const usePeriodBoundaries = options.scope === 'all' || options.scope === 'current';
  const firstYear = firstPeriod.years[0];
  const lastYear = lastPeriod.years.at(-1);
  return {
    scope: options.scope,
    targetDateStr: options.dateStr,
    targetHourIndex: options.hourIndex,
    targetAge,
    targetYear,
    actualStartDateStr: usePeriodBoundaries
      ? firstPeriod.dateStr
      : (firstYear?.dateStr ?? firstPeriod.dateStr),
    actualEndDateStr: usePeriodBoundaries
      ? (lastPeriod.endDateStr ?? lastPeriod.dateStr)
      : (lastYear?.endDateStr ?? lastPeriod.endDateStr ?? lastPeriod.dateStr),
    selectedPeriodIndex,
    periods,
  };
}

/** 从已生成的星盘复用验证过的大限时间线，组织当前、全部或指定下层资料。 */
export async function buildZiweiFortuneTimelineFromAstrolabe(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  decadalTimeline: DecadalTimelineOption[],
  options: ZiweiFortuneRangeOptions,
): Promise<ZiweiFortuneTimeline> {
  const context = options.dateStr
    ? { dateStr: options.dateStr, hourIndex: options.hourIndex ?? input.birthTimeIndex }
    : getDefaultHoroscopeContext();
  const hourIndex = options.hourIndex ?? context.hourIndex;
  assertHourIndex(hourIndex);
  parseDateParts(context.dateStr);
  return buildTimelineFromAstrolabe(astrolabe, input, decadalTimeline, {
    scope: options.scope,
    dateStr: context.dateStr,
    hourIndex,
  });
}

/** 独立使用时生成星盘、时间线和范围资料；网页 worker 与公开入口共用此实现。 */
export async function buildZiweiFortuneTimeline(
  input: ChartInput,
  options: ZiweiFortuneRangeOptions,
): Promise<ZiweiFortuneTimeline> {
  const astrolabe = await buildAstrolabeFromInput(input);
  const decadalTimeline = await buildVerifiedDecadalTimelineOptions(astrolabe, input);
  return buildZiweiFortuneTimelineFromAstrolabe(astrolabe, input, decadalTimeline, options);
}

function formatLayer(layer: ZiweiFortuneLayer) {
  const mutagens = formatMutagens(layer.mutagen);
  const palaces = layer.palaceNames
    .map((dynamicName, index) => {
      const target = layer.palaceTargets[index] ?? '';
      const stars = layer.stars[index]?.length ? `（${layer.stars[index].join('、')}）` : '';
      return `${dynamicName}→${target}${stars}`;
    })
    .join('；');
  const yearlyDecStars = layer.yearlyDecStars
    ? `｜年系星曜：将前十二神${layer.yearlyDecStars.jiangqian12.join('、')}；岁前十二神${layer.yearlyDecStars.suiqian12.join('、')}`
    : '';
  return `${layer.name} ${layer.heavenlyStem}${layer.earthlyBranch}｜四化 ${mutagens || '未标出'}｜${palaces}${yearlyDecStars}`;
}

function formatMutagens(mutagen: string[]) {
  return mutagen
    .map((star, index) => (star ? `${star}化${MUTAGEN_LABELS[index] ?? ''}` : ''))
    .filter(Boolean)
    .join('、');
}

function getFlowMonthNumber(layer: ZiweiFortuneLayer) {
  const month = FLOW_MONTH_BRANCHES.indexOf(layer.earthlyBranch);
  if (month < 0) throw new Error(`紫微流月地支无效：${layer.earthlyBranch}。`);
  return month + 1;
}

function formatDictionaryCode(index: number) {
  return String(index + 1).padStart(2, '0');
}

function stableValueKey(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('紫微运限资料无法建立稳定索引。');
  return serialized;
}

function registerDictionary<T>(values: T[]) {
  const entries: T[] = [];
  const indexes = new Map<string, number>();
  for (const value of values) {
    const key = stableValueKey(value);
    if (key === undefined || indexes.has(key)) continue;
    indexes.set(key, entries.length);
    entries.push(value);
  }
  return { entries, indexes };
}

type ZiweiCompactDictionaries = {
  mutagens: string[][];
  layouts: Array<{ palaceNames: string[]; palaceTargets: string[] }>;
  stars: string[][][];
  starNames: string[];
  yearlyDecStarNames: string[];
  yearlyDecStars: NonNullable<ZiweiFortuneLayer['yearlyDecStars']>[];
  mutagenIndexes: Map<string, number>;
  layoutIndexes: Map<string, number>;
  starIndexes: Map<string, number>;
  yearlyDecStarNameIndexes: Map<string, number>;
  yearlyDecStarIndexes: Map<string, number>;
  starNameIndexes: Map<string, number>;
};

function buildCompactDictionaries(timeline: ZiweiFortuneTimeline): ZiweiCompactDictionaries {
  const layers = timeline.periods.flatMap((period) => [
    period.layer,
    ...period.years.map((year) => year.layer),
  ]);
  const mutagenDictionary = registerDictionary(layers.map((layer) => layer.mutagen));
  const layoutDictionary = registerDictionary(
    layers.map((layer) => ({
      palaceNames: layer.palaceNames,
      palaceTargets: layer.palaceTargets,
    })),
  );
  const starDictionary = registerDictionary(layers.map((layer) => layer.stars));
  const yearlyDecStarDictionary = registerDictionary(
    layers.flatMap((layer) => (layer.yearlyDecStars ? [layer.yearlyDecStars] : [])),
  );
  const starNames: string[] = [];
  const starNameIndexes = new Map<string, number>();
  for (const stars of starDictionary.entries) {
    for (const palaceStars of stars) {
      for (const star of palaceStars) {
        if (starNameIndexes.has(star)) continue;
        starNameIndexes.set(star, starNames.length);
        starNames.push(star);
      }
    }
  }
  const yearlyDecStarNames: string[] = [];
  const yearlyDecStarNameIndexes = new Map<string, number>();
  for (const yearlyDecStars of yearlyDecStarDictionary.entries) {
    for (const star of [...yearlyDecStars.jiangqian12, ...yearlyDecStars.suiqian12]) {
      if (yearlyDecStarNameIndexes.has(star)) continue;
      yearlyDecStarNameIndexes.set(star, yearlyDecStarNames.length);
      yearlyDecStarNames.push(star);
    }
  }
  return {
    mutagens: mutagenDictionary.entries,
    layouts: layoutDictionary.entries,
    stars: starDictionary.entries,
    starNames,
    yearlyDecStarNames,
    yearlyDecStars: yearlyDecStarDictionary.entries,
    mutagenIndexes: mutagenDictionary.indexes,
    layoutIndexes: layoutDictionary.indexes,
    starIndexes: starDictionary.indexes,
    yearlyDecStarNameIndexes,
    yearlyDecStarIndexes: yearlyDecStarDictionary.indexes,
    starNameIndexes,
  };
}

function formatLetterCode(index: number) {
  if (index < 26) return String.fromCharCode(65 + index);
  return String(index + 1);
}

function formatCompactLayout(layout: { palaceNames: string[]; palaceTargets: string[] }) {
  return layout.palaceNames
    .map((palace, index) => `${palace}→${layout.palaceTargets[index] ?? ''}`)
    .join('；');
}

function formatCompactStars(stars: string[][], starNameIndexes: Map<string, number>) {
  return stars
    .map((palaceStars) => {
      if (!palaceStars.length) return '·';
      return palaceStars
        .map((star) => {
          const starIndex = starNameIndexes.get(star);
          if (starIndex === undefined) throw new Error(`紫微星曜未注册：${star}`);
          return formatLetterCode(starIndex);
        })
        .join('、');
    })
    .join(',');
}

function formatCompactYearlyDecStars(
  yearlyDecStars: NonNullable<ZiweiFortuneLayer['yearlyDecStars']>,
  starNameIndexes: Map<string, number>,
) {
  const formatNames = (names: string[]) =>
    names
      .map((name) => {
        const index = starNameIndexes.get(name);
        if (index === undefined) throw new Error(`紫微年系星曜未注册：${name}`);
        return formatLetterCode(index);
      })
      .join('、');
  return `将：${formatNames(yearlyDecStars.jiangqian12)}；岁：${formatNames(yearlyDecStars.suiqian12)}`;
}

function formatCompactLayerReferences(
  layer: ZiweiFortuneLayer,
  dictionaries: ZiweiCompactDictionaries,
) {
  const layout = {
    palaceNames: layer.palaceNames,
    palaceTargets: layer.palaceTargets,
  };
  const mutagenIndex = dictionaries.mutagenIndexes.get(stableValueKey(layer.mutagen));
  const layoutIndex = dictionaries.layoutIndexes.get(stableValueKey(layout));
  const starIndex = dictionaries.starIndexes.get(stableValueKey(layer.stars));
  if (mutagenIndex === undefined || layoutIndex === undefined || starIndex === undefined) {
    throw new Error('紫微紧凑运限资料引用未注册。');
  }
  return {
    mutagen: formatDictionaryCode(mutagenIndex),
    layout: formatDictionaryCode(layoutIndex),
    stars: formatDictionaryCode(starIndex),
  };
}

function formatCompactTimeline(timeline: ZiweiFortuneTimeline) {
  const dictionaries = buildCompactDictionaries(timeline);
  const lines = [
    `范围：童限、大限与逐年运限`,
    `实际覆盖：${timeline.actualStartDateStr} 至 ${timeline.actualEndDateStr}；目标时点：${timeline.targetDateStr}；目标时辰：${SHICHEN_PERIODS[timeline.targetHourIndex]?.name ?? `索引${timeline.targetHourIndex}`}；虚岁${timeline.targetAge}岁；目标年份${timeline.targetYear}年。`,
    '运限表中序号分别对应下列四化、宫位布局、星曜与年系星曜。',
    '四化表：',
    ...dictionaries.mutagens.map(
      (mutagen, index) => `${formatDictionaryCode(index)}=${formatMutagens(mutagen) || '未标出'}`,
    ),
    '宫位布局表（序号依次对应十二宫）：',
    ...dictionaries.layouts.map(
      (layout, index) => `${formatDictionaryCode(index)}=${formatCompactLayout(layout)}`,
    ),
    '星曜名表：',
    ...dictionaries.starNames.map((star, index) => `${formatLetterCode(index)}=${star}`),
    '星曜组合表（按所引用布局顺序列出十二宫，·表示该宫暂无流曜）：',
    ...dictionaries.stars.map(
      (stars, index) =>
        `${formatDictionaryCode(index)}=${formatCompactStars(stars, dictionaries.starNameIndexes)}`,
    ),
    '年系名表：',
    ...dictionaries.yearlyDecStarNames.map((star, index) => `${formatLetterCode(index)}=${star}`),
    '年系组合表：',
    ...dictionaries.yearlyDecStars.map(
      (yearlyDecStars, index) =>
        `${formatDictionaryCode(index)}=${formatCompactYearlyDecStars(yearlyDecStars, dictionaries.yearlyDecStarNameIndexes)}`,
    ),
    '阶段行末引用顺序：四化/布局/星曜；流年行末引用顺序：四化/布局/星曜/年系。',
  ];

  for (const period of timeline.periods) {
    const periodReferences = formatCompactLayerReferences(period.layer, dictionaries);
    lines.push(
      `${period.label}${formatDecadalAgeRange(period)}岁｜${period.dateStr}至${period.endDateStr ?? '未记录结束日期'}｜${period.layer.heavenlyStem}${period.layer.earthlyBranch}｜${periodReferences.mutagen}/${periodReferences.layout}/${periodReferences.stars}`,
    );
    for (const year of period.years) {
      const references = formatCompactLayerReferences(year.layer, dictionaries);
      const yearlyDecStars = year.layer.yearlyDecStars;
      const yearlyDecStarIndex = yearlyDecStars
        ? dictionaries.yearlyDecStarIndexes.get(stableValueKey(yearlyDecStars))
        : undefined;
      if (yearlyDecStarIndex === undefined) throw new Error('紫微流年年系星曜引用未注册。');
      lines.push(
        `  ${year.age}岁｜${year.label}｜${year.dateStr}至${year.endDateStr ?? '未记录结束日期'}｜流年${year.layer.heavenlyStem}${year.layer.earthlyBranch}｜${references.mutagen}/${references.layout}/${references.stars}/${formatDictionaryCode(yearlyDecStarIndex)}`,
      );
    }
  }
  return lines.join('\n');
}

function formatLowerLayers(year: ZiweiFortuneYear) {
  const lines: string[] = [];
  if (year.months?.length) {
    lines.push(
      `    全年流月：${year.months
        .map(
          (month) =>
            `${month.boundaryFragment ? `上一流年${month.month}月交界段` : `${month.month}月`} ${month.dateStr}｜${formatLayer(month.layer)}`,
        )
        .join('\n      ')}`,
    );
  }
  if (year.targetMonth) {
    lines.push(
      `    指定流月：${year.targetMonth.boundaryFragment ? `上一流年${year.targetMonth.month}月交界段` : `${year.targetMonth.month}月`} ${year.targetMonth.dateStr}｜${formatLayer(year.targetMonth.layer)}`,
    );
  }
  if (year.targetDay)
    lines.push(`    指定流日：${year.targetDay.dateStr}｜${formatLayer(year.targetDay.layer)}`);
  if (year.targetHour) lines.push(`    指定流时：${formatLayer(year.targetHour)}`);
  return lines;
}

/** 将范围资料格式化为可直接放入任务书的紧凑事实段。 */
export function formatZiweiFortuneTimeline(timeline: ZiweiFortuneTimeline) {
  if (timeline.scope === 'all') return formatCompactTimeline(timeline);
  const scopeLabel: Record<ZiweiFortuneRangeScope, string> = {
    current: '当前阶段',
    all: '童限、大限与逐年运限',
    year: '指定流年',
    month: '指定流月',
    day: '指定流日',
    hour: '指定流时',
  };
  const lines = [
    `范围：${scopeLabel[timeline.scope]}`,
    `实际覆盖：${timeline.actualStartDateStr} 至 ${timeline.actualEndDateStr}；目标时点：${timeline.targetDateStr}；目标时辰：${SHICHEN_PERIODS[timeline.targetHourIndex]?.name ?? `索引${timeline.targetHourIndex}`}；虚岁${timeline.targetAge}岁；目标年份${timeline.targetYear}年。`,
  ];
  for (const period of timeline.periods) {
    lines.push(
      `${period.label}${formatDecadalAgeRange(period)}岁｜${period.dateStr} 至 ${period.endDateStr ?? '未记录结束日期'}`,
      `  ${formatLayer(period.layer)}`,
    );
    for (const year of period.years) {
      lines.push(
        `${year.age}岁｜${year.label}｜取盘日 ${year.dateStr} 至 ${year.endDateStr ?? '未记录结束日期'}｜${formatLayer(year.layer)}`,
      );
      lines.push(...formatLowerLayers(year));
    }
  }
  return lines.join('\n');
}

export function findZiweiFortunePeriod(timeline: ZiweiFortuneTimeline, nominalAge: number) {
  return (
    timeline.periods.find(
      (period) => nominalAge >= period.startAge && nominalAge <= period.endAge,
    ) ?? null
  );
}
