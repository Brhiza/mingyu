/**
 * @file 皇极经世年月日时卦
 * @description 按“一六为经、六六为纬”的层级思路推衍，将值年卦继续细分至月经、旬纬、日与时经。
 * @传统依据 《皇极经世书绪言》卷一子半时段、卷三经纬层级。节气十五日映射为本算法采用的日序口径。
 */

import { SolarTerm, SolarTime } from 'tyme4ts';
import { hexagramsData, type HexagramData } from '../divination/hexagram-data';
import {
  assertFixedTimezoneHours,
  createUtcTimestamp,
  formatCivilDateTime,
  formatFixedTimezoneOffset,
  getCivilDateTimeAtFixedOffset,
  getHistoricalTimezoneOffsetAt,
  resolveCivilTime,
  type CivilDateTimeParts,
  type CivilTimeZoneInput,
} from '../calendar';
import { getSixtyCycleIndex } from '../ganzhi';
import {
  HUANGJI_CIRCLE_HEXAGRAMS,
  calculateStandardHuangjiForecast,
  type HuangjiHexagramSummary,
} from './standard';

const HUANGJI_MONTH_BRANCHES = [
  '子',
  '丑',
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
] as const;

const PURE_HEXAGRAM_NAMES: Record<string, string> = {
  乾: '乾为天',
  兑: '兑为泽',
  离: '离为火',
  震: '震为雷',
  巽: '巽为风',
  坎: '坎为水',
  艮: '艮为山',
  坤: '坤为地',
};

const NEXT_AFTER_CARDINAL: Record<string, (typeof HUANGJI_CIRCLE_HEXAGRAMS)[number]> = {
  乾: '姤',
  坤: '复',
  离: '革',
  坎: '蒙',
};

export interface HuangjiDerivedHexagram extends HuangjiHexagramSummary {
  derivedFrom?: string;
  changedLine?: number;
  sequenceOffset?: number;
}

export interface HuangjiSixDayCycleInput {
  /** 原例冬至甲子日子半起复后，已经过的完整日数，限本轮0至359。 */
  elapsedDays: number;
  /** 所求日内的整点小时，0至23；子半对应0时。 */
  hour: number;
}

export interface HuangjiSixDayCycleResult {
  model:
    | '书绪言六日逐爻'
    | '书绪言六日逐爻·显式历元'
    | '书绪言六日逐爻·公历定位'
    | '书绪言六日逐爻·现代冬至岁周换算';
  elapsedDays: number;
  hour: number;
  dayOfCycle: number;
  jingIndex: number;
  dayLine: number;
  hourLine: number;
  hourRange: string;
  hexagrams: {
    jing: HuangjiHexagramSummary;
    daily: HuangjiDerivedHexagram;
    hourly: HuangjiDerivedHexagram;
  };
}

export const HUANGJI_SIX_DAY_CALENDAR_MODEL = 'six-day-explicit-epoch' as const;
/** 以冬至岁周实测跨度按三百六十逻辑日等分的现代比例换算模型。 */
export const HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL = 'six-day-seven-part' as const;
export type HuangjiSixDayCalendarModel =
  | typeof HUANGJI_SIX_DAY_CALENDAR_MODEL
  | typeof HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL;

interface HuangjiSixDayDateInputBase extends CivilDateTimeParts, CivilTimeZoneInput {
  /** 可选毫秒；六日逐爻以秒作为传统时段的最小公开精度。 */
  millisecond?: number;
}

export interface HuangjiSixDayExplicitDateInput extends HuangjiSixDayDateInputBase {
  calendarModel: typeof HUANGJI_SIX_DAY_CALENDAR_MODEL;
  /** 经校定的当地公历子半；该时刻对应 elapsedDays=0、hour=0。 */
  epochDateTime: string;
}

export interface HuangjiSixDayProportionalDateInput extends HuangjiSixDayDateInputBase {
  calendarModel: typeof HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL;
  /** 现代比例模型由冬至岁周自动确定起点，不接受显式历元。 */
  epochDateTime?: never;
}

export type HuangjiSixDayDateInput =
  | HuangjiSixDayExplicitDateInput
  | HuangjiSixDayProportionalDateInput;

interface HuangjiSixDayDateResultBase extends HuangjiSixDayCycleResult {
  civilTime: {
    dateTime: string;
    utcDateTime: string;
    timezone: number;
    timeZoneId?: string;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  };
  calculationChain: string[];
  sources: Array<{ title: string; scope: string }>;
  limitations: string[];
}

export interface HuangjiSixDayExplicitDateResult extends HuangjiSixDayDateResultBase {
  model: '书绪言六日逐爻·显式历元';
  anchor: {
    kind: 'explicit-epoch';
    dateTime: string;
    utcDateTime: string;
    timezone: number;
    timeZoneId?: string;
    dayBoundary: '当地子半';
  };
  calendar: {
    model: typeof HUANGJI_SIX_DAY_CALENDAR_MODEL;
    mapping: 'explicit-epoch-civil-days';
    targetYear: number;
    actualElapsedDays: number;
    actualElapsedSeconds: number;
    logicalElapsedDays: number;
    logicalDayFraction: number;
    coordinateSpanDays: 360;
    cycleDay: number;
  };
}

export interface HuangjiSixDayProportionalDateResult extends HuangjiSixDayDateResultBase {
  model: '书绪言六日逐爻·现代冬至岁周换算';
  anchor: {
    kind: 'winter-solstice-civil-midnight';
    term: '冬至';
    /** tyme4ts 的冬至年标识；例如 2026 指向公历 2025 年冬至。 */
    winterSolsticeYear: number;
    /** 节气真实瞬时按现有节气口径以 UTC+8 回显。 */
    dateTime: string;
    utcDateTime: string;
    timezone: 8;
    /** 同一节气瞬时在目标地点的当地钟表表示。 */
    localDateTime: string;
    localTimezone: number;
    /** 冬至所在当地公历日的子半，用作比例岁周起点。 */
    dayStartDateTime: string;
    dayStartUtcDateTime: string;
    dayStartTimezone: number;
    dayGanZhi: string;
    dayIndex: number;
    dayBoundary: '当地子半';
  };
  calendar: {
    model: typeof HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL;
    mapping: 'winter-solstice-proportional-360';
    winterSolsticeYear: number;
    actualElapsedDays: number;
    actualElapsedMilliseconds: number;
    actualElapsedSeconds: number;
    logicalPosition: number;
    logicalElapsedDays: number;
    logicalDayFraction: number;
    /** 节气前尾段落在下一冬至当地日子半之后时，逻辑位置是否封顶于上一岁周末端。 */
    endpointClamped: boolean;
    coordinateSpanDays: 360;
    yearLengthDays: number;
    yearLengthMilliseconds: number;
    yearLengthSeconds: number;
    logicalDayLengthSeconds: number;
    cycleDay: number;
    cardinalSeason: '冬' | '春' | '夏' | '秋';
    cardinalDay: number;
  };
}

export type HuangjiSixDayDateResult =
  | HuangjiSixDayExplicitDateResult
  | HuangjiSixDayProportionalDateResult;

const HUANGJI_SOLAR_TERM_TIMEZONE = 8;
const HUANGJI_LOGICAL_DAYS = 360;
const MILLISECONDS_PER_DAY = 86400000;

const HUANGJI_SIX_DAY_SOURCES = [
  {
    title: '《皇极经世书绪言》卷一',
    scope: '冬至甲子日子半起复，六日逐爻变，每四小时对应一爻。',
  },
  {
    title: '《皇极经世书绪言》卷八上',
    scope: '以三百六十为正数、另列六日余分；现代公历入口按所选模型表达正数与岁余关系。',
  },
  {
    title: '《皇极经世书解》卷十二',
    scope: '说明余分六藏于六甲；现代比例入口不把余分暗化为固定整日闰位。',
  },
  {
    title: '《皇极经世观物外篇衍义》卷一',
    scope: '三百六十正数与六日余分、六日七分的卦气换算说明。',
  },
] as const;

/** 《皇极经世书绪言》卷一的三百六十日坐标；起点由调用者另行校定。 */
export function calculateHuangjiSixDayCycle(
  input: HuangjiSixDayCycleInput,
): HuangjiSixDayCycleResult {
  if (
    !input ||
    !Number.isInteger(input.elapsedDays) ||
    input.elapsedDays < 0 ||
    input.elapsedDays > 359
  ) {
    throw new Error('六日逐爻已经过日数必须为0至359的整数。');
  }
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error('六日逐爻小时必须为0至23的整数。');
  }
  const jingIndex = Math.floor(input.elapsedDays / 6);
  const dayLine = (input.elapsedDays % 6) + 1;
  const hourLine = Math.floor(input.hour / 4) + 1;
  const jing = summarizeHexagram(getHexagramByShortName(HUANGJI_CIRCLE_HEXAGRAMS[jingIndex]));
  const daily = changeLine(jing, dayLine);
  return {
    model: '书绪言六日逐爻',
    elapsedDays: input.elapsedDays,
    hour: input.hour,
    dayOfCycle: input.elapsedDays + 1,
    jingIndex: jingIndex + 1,
    dayLine,
    hourLine,
    hourRange: `${pad((hourLine - 1) * 4)}:00—${pad(hourLine * 4)}:00`,
    hexagrams: { jing, daily, hourly: changeLine(daily, hourLine) },
  };
}

function assertSixDayMillisecond(value: number | undefined): number {
  const millisecond = value ?? 0;
  if (!Number.isInteger(millisecond) || millisecond < 0 || millisecond > 999) {
    throw new Error('六日逐爻毫秒必须为0至999的整数。');
  }
  return millisecond;
}

function parseSixDayTimezoneOffset(value: string): number {
  if (value === 'Z') return 0;
  const sign = value.startsWith('-') ? -1 : 1;
  const [hoursText, minutesText] = value.slice(1).split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) {
    throw new Error('六日逐爻公历时间的时区偏移无效。');
  }
  const offset = sign * (hours + minutes / 60);
  assertFixedTimezoneHours(offset, '六日逐爻公历时间的 timezone');
  return offset;
}

type ParsedSixDayDateTime = CivilDateTimeParts & {
  millisecond: number;
  embeddedTimezone?: number;
};

function parseSixDayDateTimeParts(value: string, label: string): ParsedSixDayDateTime {
  if (typeof value !== 'string') throw new Error(`${label}必须是 ISO 8601 字符串。`);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/u.exec(
      value,
    );
  if (!match) {
    throw new Error(
      `${label}必须为 YYYY-MM-DDTHH:mm[:ss[.SSS]]，并明确提供时区偏移或 timeZoneId。`,
    );
  }
  const millisecondText = match[7] || '';
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: match[6] ? Number(match[6]) : 0,
    millisecond: millisecondText ? Number(millisecondText.padEnd(3, '0')) : 0,
    ...(match[8] ? { embeddedTimezone: parseSixDayTimezoneOffset(match[8]) } : {}),
  };
}

function assertSixDayDateTimeZones(
  target: ParsedSixDayDateTime,
  epoch: ParsedSixDayDateTime,
  timezone: number | undefined,
  timeZoneId: string | undefined,
): number | undefined {
  if (timezone !== undefined) assertFixedTimezoneHours(timezone, '六日逐爻公历时间的 timezone');
  if (timeZoneId !== undefined && timezone === undefined) {
    if (target.embeddedTimezone !== undefined || epoch.embeddedTimezone !== undefined) {
      throw new Error(
        '使用 timeZoneId 时，sixDayDateTime 与 sixDayEpochDateTime 不得内嵌固定时区偏移。',
      );
    }
    return undefined;
  }

  const inferredTimezone = timezone ?? target.embeddedTimezone ?? epoch.embeddedTimezone;
  if (inferredTimezone === undefined) {
    throw new Error('timezone 与 timeZoneId 至少需要提供一项。');
  }
  if (
    (target.embeddedTimezone !== undefined && target.embeddedTimezone !== inferredTimezone) ||
    (epoch.embeddedTimezone !== undefined && epoch.embeddedTimezone !== inferredTimezone)
  ) {
    throw new Error('sixDayDateTime 与 sixDayEpochDateTime 的时区偏移必须一致。');
  }
  return inferredTimezone;
}

function assertSixDayTargetTimezone(
  target: ParsedSixDayDateTime,
  timezone: number | undefined,
  timeZoneId: string | undefined,
): number | undefined {
  if (timezone !== undefined) assertFixedTimezoneHours(timezone, '六日逐爻公历时间的 timezone');
  if (timeZoneId !== undefined && timezone === undefined) {
    if (target.embeddedTimezone !== undefined) {
      throw new Error('使用 timeZoneId 时，sixDayDateTime 不得内嵌固定时区偏移。');
    }
    return undefined;
  }
  const inferredTimezone = timezone ?? target.embeddedTimezone;
  if (inferredTimezone === undefined) {
    throw new Error('timezone 与 timeZoneId 至少需要提供一项。');
  }
  if (
    target.embeddedTimezone !== undefined &&
    target.embeddedTimezone !== inferredTimezone
  ) {
    throw new Error('六日逐爻公历时间内的时区偏移与 timezone 不一致。');
  }
  return inferredTimezone;
}

/**
 * 解析六日逐爻专用的当地公历时间。
 *
 * 这个入口不改变既有 customDate 的年月日时算法。时间字符串可以自带 ISO 偏移；
 * 未带偏移时必须同时提供 timezone 或 timeZoneId，避免按宿主机时区猜测。显式历元模型
 * 还需提供当地子半历元；现代比例模型以冬至岁周自动确定换算区间。
 */
export function parseHuangjiSixDayDateTime(
  value: string,
  timezone?: number,
  timeZoneId?: string,
  calendarModel?: HuangjiSixDayCalendarModel,
  epochDateTime?: string,
): HuangjiSixDayDateInput {
  if (
    calendarModel !== HUANGJI_SIX_DAY_CALENDAR_MODEL &&
    calendarModel !== HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL
  ) {
    throw new Error(
      `六日逐爻公历换算暂只支持${HUANGJI_SIX_DAY_CALENDAR_MODEL}或${HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL}模型。`,
    );
  }
  const target = parseSixDayDateTimeParts(value, '六日逐爻公历时间');
  if (calendarModel === HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL) {
    if (epochDateTime !== undefined) {
      throw new Error(
        'six-day-seven-part 现代比例模型不使用 sixDayEpochDateTime；需要显式历元时应选择 six-day-explicit-epoch。',
      );
    }
    const inferredTimezone = assertSixDayTargetTimezone(target, timezone, timeZoneId);
    return {
      year: target.year,
      month: target.month,
      day: target.day,
      hour: target.hour,
      minute: target.minute,
      second: target.second,
      millisecond: target.millisecond,
      ...(inferredTimezone !== undefined ? { timezone: inferredTimezone } : {}),
      ...(timeZoneId !== undefined ? { timeZoneId } : {}),
      calendarModel,
    };
  }
  if (typeof epochDateTime !== 'string' || !epochDateTime.trim()) {
    throw new Error('六日逐爻公历时间必须同时提供经校定的 sixDayEpochDateTime。');
  }
  const epoch = parseSixDayDateTimeParts(epochDateTime, '六日逐爻显式历元');
  const inferredTimezone = assertSixDayDateTimeZones(target, epoch, timezone, timeZoneId);
  if (epoch.hour !== 0 || epoch.minute !== 0 || epoch.second !== 0 || epoch.millisecond !== 0) {
    throw new Error('六日逐爻显式历元必须是当地子半（00:00:00.000）。');
  }
  return {
    year: target.year,
    month: target.month,
    day: target.day,
    hour: target.hour,
    minute: target.minute,
    second: target.second,
    millisecond: target.millisecond,
    ...(inferredTimezone !== undefined ? { timezone: inferredTimezone } : {}),
    ...(timeZoneId !== undefined ? { timeZoneId } : {}),
    calendarModel,
    epochDateTime,
  };
}

function formatLocalDateTime(
  value: CivilDateTimeParts,
  millisecond: number,
  timezone: number,
): string {
  return `${formatCivilDateTime(value)}${millisecond ? `.${String(millisecond).padStart(3, '0')}` : ''}${formatFixedTimezoneOffset(timezone)}`;
}

function getSolarTimeParts(solarTime: SolarTime): CivilDateTimeParts {
  return {
    year: solarTime.getYear(),
    month: solarTime.getMonth(),
    day: solarTime.getDay(),
    hour: solarTime.getHour(),
    minute: solarTime.getMinute(),
    second: solarTime.getSecond(),
  };
}

function resolveWinterSolstice(termYear: number) {
  const term = SolarTerm.fromName(termYear, '冬至');
  const solarTime = term.getJulianDay().getSolarTime();
  const civilTime = getSolarTimeParts(solarTime);
  const resolved = resolveCivilTime({ ...civilTime, timezone: HUANGJI_SOLAR_TERM_TIMEZONE });
  return {
    termYear,
    civilTime,
    utcTimestamp: resolved.utcTimestamp,
    utcDateTime: resolved.utcDateTime,
  };
}

function resolveWinterSolsticeDayStart(
  term: ReturnType<typeof resolveWinterSolstice>,
  target: ReturnType<typeof resolveCivilTime>,
) {
  const dayStartTimezone = target.timeZoneId
    ? getHistoricalTimezoneOffsetAt(new Date(term.utcTimestamp), target.timeZoneId)
    : target.timezone;
  const localTermTime = getCivilDateTimeAtFixedOffset(
    new Date(term.utcTimestamp),
    dayStartTimezone,
  );
  const dayStart = resolveCivilTime({
    year: localTermTime.year,
    month: localTermTime.month,
    day: localTermTime.day,
    hour: 0,
    minute: 0,
    second: 0,
    ...(target.timeZoneId ? { timeZoneId: target.timeZoneId } : { timezone: dayStartTimezone }),
  });
  const dayGanZhi = SolarTime.fromYmdHms(
    localTermTime.year,
    localTermTime.month,
    localTermTime.day,
    0,
    0,
    0,
  )
    .getLunarHour()
    .getEightChar()
    .getDay()
    .getName();
  return {
    ...term,
    localTermTime,
    localTermTimezone: dayStartTimezone,
    dayStartCivilTime: dayStart.localTime,
    dayStartUtcTimestamp: dayStart.utcTimestamp,
    dayStartUtcDateTime: dayStart.utcDateTime,
    dayStartTimezone: dayStart.timezone,
    dayGanZhi,
    dayIndex: getSixtyCycleIndex(dayGanZhi),
  };
}

function resolveWinterSolsticeAnchor(
  target: ReturnType<typeof resolveCivilTime>,
  targetTimestamp: number,
) {
  const targetYear = target.localTime.year;
  const candidates = [targetYear - 1, targetYear, targetYear + 1]
    .map(resolveWinterSolstice)
    .map((term) => resolveWinterSolsticeDayStart(term, target));
  const anchor = candidates
    .filter((candidate) => candidate.utcTimestamp <= targetTimestamp)
    .sort((left, right) => right.utcTimestamp - left.utcTimestamp)[0];
  if (!anchor) throw new Error('无法定位六日逐爻公历时间所属的冬至锚点。');
  return anchor;
}

function mapSolarYearToLogicalDay(
  actualElapsedMilliseconds: number,
  yearLengthMilliseconds: number,
) {
  if (
    !Number.isFinite(actualElapsedMilliseconds) ||
    actualElapsedMilliseconds < 0 ||
    !Number.isFinite(yearLengthMilliseconds) ||
    yearLengthMilliseconds <= 0
  ) {
    throw new Error('六日逐爻公历时间不在冬至子半至下一冬至子半的单年范围内。');
  }
  // 冬至发生在当地日子半之后时，冬至当地日期的子半会先于真实节气。
  // 该日期的节气前尾段仍归上一冬至岁周，逻辑位置在上一岁周末端封顶。
  const boundedElapsedMilliseconds = Math.min(
    actualElapsedMilliseconds,
    yearLengthMilliseconds - 1,
  );
  const logicalPosition =
    (boundedElapsedMilliseconds / yearLengthMilliseconds) * HUANGJI_LOGICAL_DAYS;
  const logicalElapsedDays = Math.min(HUANGJI_LOGICAL_DAYS - 1, Math.floor(logicalPosition));
  return {
    logicalPosition,
    logicalElapsedDays,
    logicalDayFraction: logicalPosition - logicalElapsedDays,
    endpointClamped: actualElapsedMilliseconds >= yearLengthMilliseconds,
  };
}

function civilDayNumber(value: CivilDateTimeParts): number {
  return createUtcTimestamp(value.year, value.month - 1, value.day) / MILLISECONDS_PER_DAY;
}

function calculateCivilDateDifference(start: CivilDateTimeParts, end: CivilDateTimeParts): number {
  return civilDayNumber(end) - civilDayNumber(start);
}

function resolveExplicitEpoch(
  input: HuangjiSixDayExplicitDateInput,
  targetMillisecond: number,
) {
  const epochParts = parseSixDayDateTimeParts(input.epochDateTime, '六日逐爻显式历元');
  if (
    input.timeZoneId !== undefined &&
    input.timezone === undefined &&
    epochParts.embeddedTimezone !== undefined
  ) {
    throw new Error('使用 timeZoneId 时，sixDayEpochDateTime 不得内嵌固定时区偏移。');
  }
  if (
    input.timezone !== undefined &&
    epochParts.embeddedTimezone !== undefined &&
    epochParts.embeddedTimezone !== input.timezone
  ) {
    throw new Error('sixDayEpochDateTime 的时区偏移与 timezone 不一致。');
  }
  if (
    epochParts.hour !== 0 ||
    epochParts.minute !== 0 ||
    epochParts.second !== 0 ||
    epochParts.millisecond !== 0
  ) {
    throw new Error('六日逐爻显式历元必须是当地子半（00:00:00.000）。');
  }
  const target = resolveCivilTime({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second,
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.timeZoneId !== undefined ? { timeZoneId: input.timeZoneId } : {}),
  });
  const epoch = resolveCivilTime({
    year: epochParts.year,
    month: epochParts.month,
    day: epochParts.day,
    hour: epochParts.hour,
    minute: epochParts.minute,
    second: epochParts.second,
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.timeZoneId !== undefined ? { timeZoneId: input.timeZoneId } : {}),
  });
  const actualElapsedDays = calculateCivilDateDifference(epoch.localTime, target.localTime);
  if (!Number.isInteger(actualElapsedDays)) {
    throw new Error('六日逐爻公历历元与目标日期无法形成完整的当地公历日坐标。');
  }
  if (actualElapsedDays < 0 || actualElapsedDays >= HUANGJI_LOGICAL_DAYS) {
    throw new Error('六日逐爻公历时间超出显式历元后0至359日的已定义坐标范围。');
  }
  return {
    target,
    epoch,
    epochMillisecond: epochParts.millisecond,
    targetTimestamp: target.utcTimestamp + targetMillisecond,
    epochTimestamp: epoch.utcTimestamp + epochParts.millisecond,
    actualElapsedDays,
  };
}

/** 从经校定历元与当地公历时间直接适配书绪言六日逐爻坐标。 */
function calculateHuangjiSixDayCycleFromExplicitDate(
  input: HuangjiSixDayExplicitDateInput,
): HuangjiSixDayExplicitDateResult {
  const millisecond = assertSixDayMillisecond(input.millisecond);
  const resolved = resolveExplicitEpoch(input, millisecond);
  const { target, epoch, targetTimestamp, epochTimestamp, actualElapsedDays } = resolved;
  const actualElapsedSeconds = Math.floor((targetTimestamp - epochTimestamp) / 1000);
  const cycleElapsedDays = actualElapsedDays;
  const cycle = calculateHuangjiSixDayCycle({
    elapsedDays: cycleElapsedDays,
    hour: target.localTime.hour,
  });
  const targetDateTime = formatLocalDateTime(target.localTime, millisecond, target.timezone);
  const epochDateTime = formatLocalDateTime(
    epoch.localTime,
    resolved.epochMillisecond,
    epoch.timezone,
  );
  const calendar: HuangjiSixDayExplicitDateResult['calendar'] = {
    model: HUANGJI_SIX_DAY_CALENDAR_MODEL,
    mapping: 'explicit-epoch-civil-days',
    targetYear: target.localTime.year,
    actualElapsedDays,
    actualElapsedSeconds,
    logicalElapsedDays: actualElapsedDays,
    logicalDayFraction: 0,
    coordinateSpanDays: HUANGJI_LOGICAL_DAYS,
    cycleDay: cycleElapsedDays + 1,
  };
  return {
    ...cycle,
    model: '书绪言六日逐爻·显式历元',
    civilTime: {
      dateTime: targetDateTime,
      utcDateTime: new Date(targetTimestamp).toISOString(),
      timezone: target.timezone,
      ...(target.timeZoneId ? { timeZoneId: target.timeZoneId } : {}),
      ...target.localTime,
      millisecond,
    },
    anchor: {
      kind: 'explicit-epoch',
      dateTime: epochDateTime,
      utcDateTime: new Date(epochTimestamp).toISOString(),
      timezone: epoch.timezone,
      ...(epoch.timeZoneId ? { timeZoneId: epoch.timeZoneId } : {}),
      dayBoundary: '当地子半',
    },
    calendar,
    calculationChain: [
      `${targetDateTime}解析为 UTC${target.timezone >= 0 ? '+' : ''}${target.timezone} 的当地公历时刻，保留真实 UTC 瞬时点。`,
      `${epochDateTime}是经校定的当地子半起点，对应六日逐爻已过日数0、子半时刻。`,
      `按当地公历日期从显式历元至目标时间经过${actualElapsedDays}个完整日，直接取得六日逐爻坐标第${cycleElapsedDays + 1}日；实际 UTC 瞬时相隔${actualElapsedSeconds}秒。`,
      `第${cycle.jingIndex}经卦第${cycle.dayLine}爻当日，第${cycle.hourLine}个四小时段取${cycle.hexagrams.hourly.shortName}卦。`,
    ],
    sources: HUANGJI_SIX_DAY_SOURCES.map((source) => ({ ...source })),
    limitations: [
      '原典的冬至甲子子半是抽象条件，并未给出现代公历唯一历元；本入口要求调用者提供已经校定的公历子半起点。',
      '公历适配直接使用显式历元与目标当地日期的整数日差，未使用太阳年比例压缩，也未把日干支序号加入六日坐标。',
      '三百六十日坐标之后的六日余分没有在本入口定义换算，目标时间必须位于显式历元后第0至359个当地公历日。',
      '小时爻沿用当地子半起的四小时段；分钟、秒和毫秒保留在真实时刻资料中，不改变四小时段。',
    ],
  };
}

/**
 * 以实际冬至岁周承载“六日七分”的现代公历比例换算。
 *
 * 节气瞬时用于决定所属冬至岁周；该冬至所在地点的当地公历日子半作为
 * 现代换算起点，至下一冬至当地公历日子半的真实 UTC 间隔等分为360个逻辑日。
 */
function calculateHuangjiSixDayCycleFromProportionalDate(
  input: HuangjiSixDayProportionalDateInput,
): HuangjiSixDayProportionalDateResult {
  const millisecond = assertSixDayMillisecond(input.millisecond);
  const target = resolveCivilTime({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second,
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.timeZoneId !== undefined ? { timeZoneId: input.timeZoneId } : {}),
  });
  const targetTimestamp = target.utcTimestamp + millisecond;
  const anchor = resolveWinterSolsticeAnchor(target, targetTimestamp);
  const nextAnchor = resolveWinterSolsticeDayStart(
    resolveWinterSolstice(anchor.termYear + 1),
    target,
  );
  const yearLengthMilliseconds = nextAnchor.dayStartUtcTimestamp - anchor.dayStartUtcTimestamp;
  const actualElapsedMilliseconds = targetTimestamp - anchor.dayStartUtcTimestamp;
  const actualElapsedDays = Math.floor(actualElapsedMilliseconds / MILLISECONDS_PER_DAY);
  const actualElapsedSeconds = Math.floor(actualElapsedMilliseconds / 1000);
  const mapped = mapSolarYearToLogicalDay(actualElapsedMilliseconds, yearLengthMilliseconds);
  const cycleElapsedDays =
    (anchor.dayIndex + mapped.logicalElapsedDays) % HUANGJI_LOGICAL_DAYS;
  const cycle = calculateHuangjiSixDayCycle({
    elapsedDays: cycleElapsedDays,
    hour: target.localTime.hour,
  });
  const cardinalSeasons: Array<'冬' | '春' | '夏' | '秋'> = ['冬', '春', '夏', '秋'];
  const cardinalIndex = Math.floor(mapped.logicalElapsedDays / 90);
  const targetDateTime = formatLocalDateTime(target.localTime, millisecond, target.timezone);
  const anchorDateTime = `${formatCivilDateTime(anchor.civilTime)}${formatFixedTimezoneOffset(HUANGJI_SOLAR_TERM_TIMEZONE)}`;
  const anchorLocalDateTime = formatLocalDateTime(
    anchor.localTermTime,
    0,
    anchor.localTermTimezone,
  );
  const anchorDayStartDateTime = formatLocalDateTime(
    anchor.dayStartCivilTime,
    0,
    anchor.dayStartTimezone,
  );
  const calendar: HuangjiSixDayProportionalDateResult['calendar'] = {
    model: HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL,
    mapping: 'winter-solstice-proportional-360',
    winterSolsticeYear: anchor.termYear,
    actualElapsedDays,
    actualElapsedMilliseconds,
    actualElapsedSeconds,
    logicalPosition: mapped.logicalPosition,
    logicalElapsedDays: mapped.logicalElapsedDays,
    logicalDayFraction: mapped.logicalDayFraction,
    endpointClamped: mapped.endpointClamped,
    coordinateSpanDays: HUANGJI_LOGICAL_DAYS,
    yearLengthDays: yearLengthMilliseconds / MILLISECONDS_PER_DAY,
    yearLengthMilliseconds,
    yearLengthSeconds: yearLengthMilliseconds / 1000,
    logicalDayLengthSeconds: yearLengthMilliseconds / 1000 / HUANGJI_LOGICAL_DAYS,
    cycleDay: cycleElapsedDays + 1,
    cardinalSeason: cardinalSeasons[Math.min(cardinalIndex, cardinalSeasons.length - 1)],
    cardinalDay: (mapped.logicalElapsedDays % 90) + 1,
  };
  return {
    ...cycle,
    model: '书绪言六日逐爻·现代冬至岁周换算',
    civilTime: {
      dateTime: targetDateTime,
      utcDateTime: new Date(targetTimestamp).toISOString(),
      timezone: target.timezone,
      ...(target.timeZoneId ? { timeZoneId: target.timeZoneId } : {}),
      ...target.localTime,
      millisecond,
    },
    anchor: {
      kind: 'winter-solstice-civil-midnight',
      term: '冬至',
      winterSolsticeYear: anchor.termYear,
      dateTime: anchorDateTime,
      utcDateTime: anchor.utcDateTime,
      timezone: HUANGJI_SOLAR_TERM_TIMEZONE,
      localDateTime: anchorLocalDateTime,
      localTimezone: anchor.localTermTimezone,
      dayStartDateTime: anchorDayStartDateTime,
      dayStartUtcDateTime: anchor.dayStartUtcDateTime,
      dayStartTimezone: anchor.dayStartTimezone,
      dayGanZhi: anchor.dayGanZhi,
      dayIndex: anchor.dayIndex,
      dayBoundary: '当地子半',
    },
    calendar,
    calculationChain: [
      `${targetDateTime}解析为 UTC${target.timezone >= 0 ? '+' : ''}${target.timezone} 的当地公历时刻，保留真实 UTC 瞬时点。`,
      `以${anchorDateTime}的冬至天文时刻确定所属${anchor.termYear}冬至岁周；该瞬时在目标地点为${anchorLocalDateTime}。`,
      `以冬至所在当地公历日${anchorDayStartDateTime}子半为起点，至下一冬至当地公历日子半的实际跨度为${(yearLengthMilliseconds / MILLISECONDS_PER_DAY).toFixed(6)}日（${yearLengthMilliseconds}毫秒），按三百六十逻辑日比例映射。`,
      `目标距当地子半起点实际经过${actualElapsedSeconds}秒（${actualElapsedDays}个完整UTC日），逻辑位置为${mapped.logicalPosition.toFixed(9)}日，即第${mapped.logicalElapsedDays + 1}个逻辑日的${mapped.logicalDayFraction.toFixed(9)}。`,
      `以冬至日子半的${anchor.dayGanZhi}（六十甲子序号${anchor.dayIndex}）接续六日逐爻周期，得到周期第${cycleElapsedDays + 1}日；每四小时取一爻，当前为${cycle.hourRange}。`,
    ],
    sources: HUANGJI_SIX_DAY_SOURCES.map((source) => ({ ...source })),
    limitations: [
      '原典给出冬至甲子日子半、六日逐爻和六日七分的传统条件，没有给出现代公历唯一对应的甲子历元；本结果是明确标注的现代比例换算，不宣称古籍唯一算法。',
      '本模型以实际冬至瞬时确定所属冬至岁周，以该冬至所在当地公历日子半至下一冬至当地公历日子半的实测 UTC 间隔等分三百六十逻辑日；不同地点的民用日界和历史时区规则会改变子半锚点。',
      '六日七分的传统余分有不同传承；本模型不把六个余分硬插为六个公历整日，也不以该比例换算替代既有年月日时十五日节气链。',
      '若下一冬至发生在其当地公历日子半之后，该日期子半至真实节气前仍属上一岁周；因下一岁周的子半端点已先到，逻辑位置封顶在上一岁周最后一个逻辑日，并保留实际跨度字段。',
      '小时爻沿用目标地点当地钟表从子半开始的四小时段；分钟、秒和毫秒保留在真实时刻资料中，不改变已取的四小时段。',
      '节气时刻采用 tyme4ts 历表的 UTC+8 表达，实际精度受所用历表与 IANA 时区数据库版本边界影响。',
    ],
  };
}

/** 从带时区的真实公历时间定位六日逐爻坐标；两种模型共用此入口。 */
export function calculateHuangjiSixDayCycleFromDate(
  input: HuangjiSixDayDateInput,
): HuangjiSixDayDateResult {
  if (!input || typeof input !== 'object') throw new Error('六日逐爻公历输入不能为空。');
  if (input.calendarModel === HUANGJI_SIX_DAY_CALENDAR_MODEL) {
    return calculateHuangjiSixDayCycleFromExplicitDate(input);
  }
  if (input.calendarModel === HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL) {
    return calculateHuangjiSixDayCycleFromProportionalDate(input);
  }
  throw new Error(
    `六日逐爻公历换算暂只支持${HUANGJI_SIX_DAY_CALENDAR_MODEL}或${HUANGJI_SIX_DAY_PROPORTIONAL_CALENDAR_MODEL}模型。`,
  );
}

export interface HuangjiDateTimeForecast {
  model: '经纬卦年月日时推衍';
  civilTime: {
    dateTime: string;
    timezone: '北京时间（UTC+8）';
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
  calendar: {
    forecastYear: number;
    activeSolarTerm: string;
    actualDayInSolarTerm: number;
    mappedDayInSolarTerm: number;
    monthIndex: number;
    monthBranch: string;
    dayOfMonth: number;
    dayOfYear: number;
    hourSegment: number;
    hourRange: string;
  };
  hexagrams: {
    annual: HuangjiHexagramSummary & { year: number; ganzhi: string };
    monthJing: HuangjiDerivedHexagram;
    xunWei: HuangjiDerivedHexagram;
    daily: HuangjiDerivedHexagram;
    hourJing: HuangjiDerivedHexagram;
  };
  calculationChain: string[];
  sources: Array<{ title: string; scope: string }>;
  limitations: string[];
}

function getHexagramByShortName(shortName: string): HexagramData {
  const fullName = PURE_HEXAGRAM_NAMES[shortName];
  const found = hexagramsData.find((item) =>
    fullName ? item.name === fullName : item.name.endsWith(shortName),
  );
  if (!found) throw new Error(`缺少皇极经世卦象资料：${shortName}。`);
  return found;
}

function getHexagramByBinary(binarySymbol: string): HexagramData {
  const found = hexagramsData.find((item) => item.binarySymbol === binarySymbol);
  if (!found) throw new Error(`缺少皇极经世卦画资料：${binarySymbol}。`);
  return found;
}

function shortHexagramName(hexagram: HexagramData): string {
  const pure = Object.entries(PURE_HEXAGRAM_NAMES).find(([, name]) => name === hexagram.name);
  return pure?.[0] || hexagram.name.slice(2);
}

function summarizeHexagram(hexagram: HexagramData): HuangjiHexagramSummary {
  return {
    id: hexagram.id,
    name: hexagram.name,
    shortName: shortHexagramName(hexagram),
    symbol: hexagram.symbol,
    upper: hexagram.upper,
    lower: hexagram.lower,
    judgment: hexagram.description,
  };
}

function toBottomUpLines(binarySymbol: string): string[] {
  return [
    binarySymbol[3],
    binarySymbol[4],
    binarySymbol[5],
    binarySymbol[0],
    binarySymbol[1],
    binarySymbol[2],
  ];
}

function fromBottomUpLines(lines: string[]): string {
  return `${lines.slice(3, 6).join('')}${lines.slice(0, 3).join('')}`;
}

function changeLine(source: HuangjiHexagramSummary, line: number): HuangjiDerivedHexagram {
  if (!Number.isInteger(line) || line < 1 || line > 6) throw new Error('变爻必须介于1至6。');
  const hexagram = getHexagramByShortName(source.shortName);
  const lines = toBottomUpLines(hexagram.binarySymbol);
  lines[line - 1] = lines[line - 1] === '1' ? '0' : '1';
  return {
    ...summarizeHexagram(getHexagramByBinary(fromBottomUpLines(lines))),
    derivedFrom: source.shortName,
    changedLine: line,
  };
}

function getCircleStartIndex(source: HuangjiHexagramSummary): number {
  const normalizedName = NEXT_AFTER_CARDINAL[source.shortName] || source.shortName;
  const index = HUANGJI_CIRCLE_HEXAGRAMS.indexOf(
    normalizedName as (typeof HUANGJI_CIRCLE_HEXAGRAMS)[number],
  );
  if (index < 0) throw new Error(`先天六十卦序缺少${source.shortName}卦。`);
  return index;
}

function advanceInCircle(source: HuangjiHexagramSummary, offset: number): HuangjiDerivedHexagram {
  if (!Number.isInteger(offset) || offset < 0 || offset >= 60) {
    throw new Error('皇极六十卦序偏移必须介于0至59。');
  }
  const startIndex = getCircleStartIndex(source);
  const targetName = HUANGJI_CIRCLE_HEXAGRAMS[(startIndex + offset) % 60];
  return {
    ...summarizeHexagram(getHexagramByShortName(targetName)),
    derivedFrom: source.shortName,
    sequenceOffset: offset,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function resolveCalendar(
  date: Date,
): HuangjiDateTimeForecast['civilTime'] & HuangjiDateTimeForecast['calendar'] {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = beijing.getUTCFullYear();
  const month = beijing.getUTCMonth() + 1;
  const day = beijing.getUTCDate();
  const hour = beijing.getUTCHours();
  const minute = beijing.getUTCMinutes();
  const second = beijing.getUTCSeconds();
  const millisecond = beijing.getUTCMilliseconds();
  const solarTime = SolarTime.fromYmdHms(year, month, day, hour, minute, second);
  const targetJulianDay = solarTime.getJulianDay().getDay() + millisecond / 86400000;
  const candidates: Array<{
    forecastYear: number;
    index: number;
    name: string;
    julianDay: number;
  }> = [];

  for (const forecastYear of [year, year + 1]) {
    for (let index = 0; index < 24; index += 1) {
      const term = SolarTerm.fromIndex(forecastYear, index);
      candidates.push({
        forecastYear,
        index,
        name: term.getName(),
        julianDay: term.getJulianDay().getDay(),
      });
    }
  }

  const active = candidates
    .filter((term) => term.julianDay <= targetJulianDay)
    .sort((left, right) => right.julianDay - left.julianDay)[0];
  if (!active) throw new Error('无法定位起盘时间所属的皇极节气。');

  const actualDayInSolarTerm = Math.floor(targetJulianDay - active.julianDay) + 1;
  const mappedDayInSolarTerm = Math.max(1, Math.min(actualDayInSolarTerm, 15));
  const dayOfYear = active.index * 15 + mappedDayInSolarTerm;
  const monthIndex = Math.floor((dayOfYear - 1) / 30) + 1;
  const dayOfMonth = ((dayOfYear - 1) % 30) + 1;
  const hourSegment = Math.floor(hour / 4) + 1;
  const hourStart = (hourSegment - 1) * 4;
  const hourEnd = hourSegment * 4;

  return {
    dateTime: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}${millisecond ? `.${String(millisecond).padStart(3, '0')}` : ''}`,
    timezone: '北京时间（UTC+8）',
    year,
    month,
    day,
    hour,
    minute,
    second,
    forecastYear: active.forecastYear,
    activeSolarTerm: active.name,
    actualDayInSolarTerm,
    mappedDayInSolarTerm,
    monthIndex,
    monthBranch: HUANGJI_MONTH_BRANCHES[monthIndex - 1],
    dayOfMonth,
    dayOfYear,
    hourSegment,
    hourRange: `${pad(hourStart)}:00—${pad(hourEnd)}:00`,
  };
}

export function calculateHuangjiDateTimeForecast(date: Date): HuangjiDateTimeForecast {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('皇极经世年月日时起盘时间不是有效日期。');
  }

  const resolved = resolveCalendar(date);
  const annualForecast = calculateStandardHuangjiForecast(resolved.forecastYear);
  const annual = annualForecast.hexagrams.annual;
  const dayIndex = resolved.dayOfYear - 1;
  const monthJingLine = Math.floor(dayIndex / 60) + 1;
  const monthJing = changeLine(annual, monthJingLine);
  const dayInJing = dayIndex % 60;
  const xunWeiLine = Math.floor(dayInJing / 10) + 1;
  const xunWei = changeLine(monthJing, xunWeiLine);
  const daily = advanceInCircle(monthJing, dayInJing);
  const hourJing = changeLine(daily, resolved.hourSegment);

  return {
    model: '经纬卦年月日时推衍',
    civilTime: {
      dateTime: resolved.dateTime,
      timezone: resolved.timezone,
      year: resolved.year,
      month: resolved.month,
      day: resolved.day,
      hour: resolved.hour,
      minute: resolved.minute,
      second: resolved.second,
    },
    calendar: {
      forecastYear: resolved.forecastYear,
      activeSolarTerm: resolved.activeSolarTerm,
      actualDayInSolarTerm: resolved.actualDayInSolarTerm,
      mappedDayInSolarTerm: resolved.mappedDayInSolarTerm,
      monthIndex: resolved.monthIndex,
      monthBranch: resolved.monthBranch,
      dayOfMonth: resolved.dayOfMonth,
      dayOfYear: resolved.dayOfYear,
      hourSegment: resolved.hourSegment,
      hourRange: resolved.hourRange,
    },
    hexagrams: { annual, monthJing, xunWei, daily, hourJing },
    calculationChain: [
      `${resolved.dateTime}按北京时间定位于${resolved.activeSolarTerm}后第${resolved.actualDayInSolarTerm}日，对应皇极${resolved.monthBranch}月第${resolved.dayOfMonth}日`,
      `${annual.shortName}值年卦第${monthJingLine}爻变为${monthJing.shortName}月经卦，统${monthJingLine * 2 - 1}至${monthJingLine * 2}月`,
      `${monthJing.shortName}月经卦第${xunWeiLine}爻变为${xunWei.shortName}旬纬卦，日卦再由月经卦顺行六十卦序第${dayInJing + 1}位得${daily.shortName}卦`,
      `${daily.shortName}日卦第${resolved.hourSegment}爻变为${hourJing.shortName}时经卦，对应${resolved.hourRange}`,
    ],
    sources: [
      {
        title: '《皇极经世书绪言》卷三',
        scope: '以运经世段提出由年卦推求月日时分直卦的经纬层级思路。',
      },
      {
        title: '《皇极经世书绪言》卷三值年卦例',
        scope: '原例由小畜起甲子，依六十卦序逐年顺行；本算法将同序应用于月经卦下的日序。',
      },
      {
        title: '《皇极经世书绪言》卷一子半时段',
        scope: '时经卦自子半起，每四小时对应一爻。',
      },
    ],
    limitations: [
      '年月日时层以冬至为年界，并将每个节气映射为十五个皇极日；实际节气超过十五日的尾段沿用第十五日位置。',
      '年月日时卦用于具体时点取象，长期背景仍以元会运世、统卦、运卦、十年卦和值年卦为准。',
    ],
  };
}
