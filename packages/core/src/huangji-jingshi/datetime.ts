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
  resolveCivilTime,
  type CivilDateTimeParts,
  type CivilTimeZoneInput,
} from '../calendar';
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
  model: '书绪言六日逐爻' | '书绪言六日逐爻·显式历元';
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
export type HuangjiSixDayCalendarModel = typeof HUANGJI_SIX_DAY_CALENDAR_MODEL;

export interface HuangjiSixDayDateInput extends CivilDateTimeParts, CivilTimeZoneInput {
  /** 明确选择以校定公历历元直接适配六日逐爻坐标的模型。 */
  calendarModel: HuangjiSixDayCalendarModel;
  /** 经校定的当地公历子半；该时刻对应 elapsedDays=0、hour=0。 */
  epochDateTime: string;
  /** 可选毫秒；六日逐爻以秒作为传统时段的最小公开精度。 */
  millisecond?: number;
}

export interface HuangjiSixDayDateResult extends HuangjiSixDayCycleResult {
  model: '书绪言六日逐爻·显式历元';
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
  anchor: {
    kind: 'explicit-epoch';
    dateTime: string;
    utcDateTime: string;
    timezone: number;
    timeZoneId?: string;
    dayBoundary: '当地子半';
  };
  calendar: {
    model: HuangjiSixDayCalendarModel;
    mapping: 'explicit-epoch-civil-days';
    targetYear: number;
    actualElapsedDays: number;
    actualElapsedSeconds: number;
    logicalElapsedDays: number;
    logicalDayFraction: 0;
    coordinateSpanDays: 360;
    cycleDay: number;
  };
  calculationChain: string[];
  sources: Array<{ title: string; scope: string }>;
  limitations: string[];
}

const HUANGJI_LOGICAL_DAYS = 360;
const MILLISECONDS_PER_DAY = 86400000;

const HUANGJI_SIX_DAY_SOURCES = [
  {
    title: '《皇极经世书绪言》卷一',
    scope: '冬至甲子日子半起复，六日逐爻变，每四小时对应一爻。',
  },
  {
    title: '《皇极经世书绪言》卷八上',
    scope: '以三百六十为正数、另列六日余分；公历入口只适配已给出的正数坐标。',
  },
  {
    title: '《皇极经世书解》卷十二',
    scope: '说明余分六藏于六甲；公历入口不把未校定的余分暗化为整日坐标。',
  },
  {
    title: '《皇极经世观物外篇衍义》卷一',
    scope: '三百六十正数与六日余分、六日七分的卦气换算说明；未据此推定现代公历历元。',
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

/**
 * 解析六日逐爻专用的当地公历时间。
 *
 * 这个入口不改变既有 customDate 的年月日时算法。时间字符串可以自带 ISO 偏移；
 * 未带偏移时必须同时提供 timezone 或 timeZoneId，避免按宿主机时区猜测。历元必须
 * 由调用者明确提供，并表示当地子半对应的 elapsedDays=0。
 */
export function parseHuangjiSixDayDateTime(
  value: string,
  timezone?: number,
  timeZoneId?: string,
  calendarModel?: HuangjiSixDayCalendarModel,
  epochDateTime?: string,
): HuangjiSixDayDateInput {
  if (calendarModel !== HUANGJI_SIX_DAY_CALENDAR_MODEL) {
    throw new Error(`六日逐爻公历换算暂只支持${HUANGJI_SIX_DAY_CALENDAR_MODEL}模型。`);
  }
  if (typeof epochDateTime !== 'string' || !epochDateTime.trim()) {
    throw new Error('六日逐爻公历时间必须同时提供经校定的 sixDayEpochDateTime。');
  }
  const target = parseSixDayDateTimeParts(value, '六日逐爻公历时间');
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

function civilDayNumber(value: CivilDateTimeParts): number {
  return createUtcTimestamp(value.year, value.month - 1, value.day) / MILLISECONDS_PER_DAY;
}

function calculateCivilDateDifference(start: CivilDateTimeParts, end: CivilDateTimeParts): number {
  return civilDayNumber(end) - civilDayNumber(start);
}

function resolveExplicitEpoch(input: HuangjiSixDayDateInput, targetMillisecond: number) {
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
export function calculateHuangjiSixDayCycleFromDate(
  input: HuangjiSixDayDateInput,
): HuangjiSixDayDateResult {
  if (!input || typeof input !== 'object') throw new Error('六日逐爻公历输入不能为空。');
  if (input.calendarModel !== HUANGJI_SIX_DAY_CALENDAR_MODEL) {
    throw new Error(`六日逐爻公历换算暂只支持${HUANGJI_SIX_DAY_CALENDAR_MODEL}模型。`);
  }
  if (typeof input.epochDateTime !== 'string' || !input.epochDateTime.trim()) {
    throw new Error('六日逐爻公历时间必须同时提供经校定的 sixDayEpochDateTime。');
  }
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
  const calendar = {
    model: HUANGJI_SIX_DAY_CALENDAR_MODEL,
    mapping: 'explicit-epoch-civil-days',
    targetYear: target.localTime.year,
    actualElapsedDays,
    actualElapsedSeconds,
    logicalElapsedDays: actualElapsedDays,
    logicalDayFraction: 0,
    coordinateSpanDays: HUANGJI_LOGICAL_DAYS,
    cycleDay: cycleElapsedDays + 1,
  } as HuangjiSixDayDateResult['calendar'];
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
