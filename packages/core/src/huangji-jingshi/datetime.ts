/**
 * @file 皇极经世年月日时卦
 * @description 按“一六为经、六六为纬”的层级思路推衍，将值年卦继续细分至月经、旬纬、日与时经。
 * @传统依据 《皇极经世书绪言》卷一子半时段、卷三经纬层级。节气十五日映射为本算法采用的日序口径。
 */

import { SolarTerm, SolarTime } from 'tyme4ts';
import { hexagramsData, type HexagramData } from '../divination/hexagram-data';
import {
  assertFixedTimezoneHours,
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
  model: '书绪言六日逐爻' | '书绪言六日逐爻·公历定位';
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

export const HUANGJI_SIX_DAY_CALENDAR_MODEL = 'six-day-seven-part' as const;
export type HuangjiSixDayCalendarModel = typeof HUANGJI_SIX_DAY_CALENDAR_MODEL;

export interface HuangjiSixDayDateInput extends CivilDateTimeParts, CivilTimeZoneInput {
  /** 明确选择以实岁比例承载“六日七分”的现代公历换算模型。 */
  calendarModel: HuangjiSixDayCalendarModel;
  /** 可选毫秒；六日逐爻以秒作为传统时段的最小公开精度。 */
  millisecond?: number;
}

export interface HuangjiSixDayDateResult extends HuangjiSixDayCycleResult {
  model: '书绪言六日逐爻·公历定位';
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
    term: '冬至';
    forecastYear: number;
    dateTime: string;
    utcDateTime: string;
    timezone: 8;
    dayStartDateTime: string;
    dayStartUtcDateTime: string;
    dayStartTimezone: number;
    dayGanZhi: string;
    dayIndex: number;
    dayBoundary: '当地子半';
  };
  calendar: {
    model: HuangjiSixDayCalendarModel;
    mapping: 'solar-year-proportional';
    forecastYear: number;
    actualElapsedDays: number;
    actualElapsedSeconds: number;
    logicalElapsedDays: number;
    logicalDayFraction: number;
    yearLengthDays: number;
    yearLengthSeconds: number;
    logicalDayLengthSeconds: number;
    cycleDay: number;
    cardinalSeason: '冬' | '春' | '夏' | '秋';
    cardinalDay: number;
  };
  calculationChain: string[];
  sources: Array<{ title: string; scope: string }>;
  limitations: string[];
}

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
    scope: '以三百六十为正数、另列六日余分；本公历入口保留其正数与余分关系，不预设整日闰位。',
  },
  {
    title: '《皇极经世书解》卷十二',
    scope: '说明余分六藏于六甲；本公历入口不把它暗化为固定整日闰位。',
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

/**
 * 解析六日逐爻专用的当地公历时间。
 *
 * 这个入口不改变既有 customDate 的年月日时算法。时间字符串可以自带 ISO 偏移；
 * 未带偏移时必须同时提供 timezone 或 timeZoneId，避免按宿主机时区猜测。
 */
export function parseHuangjiSixDayDateTime(
  value: string,
  timezone?: number,
  timeZoneId?: string,
  calendarModel?: HuangjiSixDayCalendarModel,
): HuangjiSixDayDateInput {
  if (calendarModel !== HUANGJI_SIX_DAY_CALENDAR_MODEL) {
    throw new Error(`六日逐爻公历换算暂只支持${HUANGJI_SIX_DAY_CALENDAR_MODEL}模型。`);
  }
  if (typeof value !== 'string') throw new Error('六日逐爻公历时间必须是 ISO 8601 字符串。');
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/u.exec(
      value,
    );
  if (!match) {
    throw new Error(
      '六日逐爻公历时间必须为 YYYY-MM-DDTHH:mm[:ss[.SSS]]，并明确提供时区偏移或 timeZoneId。',
    );
  }
  const embeddedTimezone = match[8] ? parseSixDayTimezoneOffset(match[8]) : undefined;
  if (timezone !== undefined && embeddedTimezone !== undefined && timezone !== embeddedTimezone) {
    throw new Error('六日逐爻公历时间内的时区偏移与 timezone 不一致。');
  }
  const millisecondText = match[7] || '';
  const millisecond = millisecondText ? Number(millisecondText.padEnd(3, '0')) : 0;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: match[6] ? Number(match[6]) : 0,
    millisecond,
    ...(timezone !== undefined ? { timezone } : {}),
    ...(embeddedTimezone !== undefined && timezone === undefined
      ? { timezone: embeddedTimezone }
      : {}),
    ...(timeZoneId !== undefined ? { timeZoneId } : {}),
    calendarModel,
  };
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
  const localDate = getCivilDateTimeAtFixedOffset(new Date(term.utcTimestamp), dayStartTimezone);
  const dayStart = resolveCivilTime({
    year: localDate.year,
    month: localDate.month,
    day: localDate.day,
    hour: 0,
    minute: 0,
    second: 0,
    ...(target.timeZoneId ? { timeZoneId: target.timeZoneId } : { timezone: dayStartTimezone }),
  });
  const dayGanZhi = SolarTime.fromYmdHms(localDate.year, localDate.month, localDate.day, 0, 0, 0)
    .getLunarHour()
    .getEightChar()
    .getDay()
    .getName();
  return {
    ...term,
    dayStartCivilTime: dayStart.localTime,
    dayStartUtcTimestamp: dayStart.utcTimestamp,
    dayStartUtcDateTime: dayStart.utcDateTime,
    dayStartTimezone: dayStart.timezone,
    dayGanZhi,
    dayIndex: getSixtyCycleIndex(dayGanZhi),
  };
}

function resolveWinterSolsticeAnchor(target: ReturnType<typeof resolveCivilTime>) {
  const targetYear = target.localTime.year;
  const candidates = [targetYear - 1, targetYear, targetYear + 1]
    .map(resolveWinterSolstice)
    .map((term) => resolveWinterSolsticeDayStart(term, target));
  const anchor = candidates
    .filter((candidate) => candidate.utcTimestamp <= target.utcTimestamp)
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
    actualElapsedMilliseconds >= yearLengthMilliseconds
  ) {
    throw new Error('六日逐爻公历时间不在冬至子半至下一冬至子半的单年范围内。');
  }
  const logicalPosition =
    (actualElapsedMilliseconds / yearLengthMilliseconds) * HUANGJI_LOGICAL_DAYS;
  const logicalElapsedDays = Math.min(HUANGJI_LOGICAL_DAYS - 1, Math.floor(logicalPosition));
  return {
    logicalElapsedDays,
    logicalDayFraction: logicalPosition - logicalElapsedDays,
  };
}

function formatLocalDateTime(
  value: CivilDateTimeParts,
  millisecond: number,
  timezone: number,
): string {
  return `${formatCivilDateTime(value)}${millisecond ? `.${String(millisecond).padStart(3, '0')}` : ''}${formatFixedTimezoneOffset(timezone)}`;
}

/** 从带时区的真实公历时间定位书绪言六日逐爻坐标。 */
export function calculateHuangjiSixDayCycleFromDate(
  input: HuangjiSixDayDateInput,
): HuangjiSixDayDateResult {
  if (!input || typeof input !== 'object') throw new Error('六日逐爻公历输入不能为空。');
  if (input.calendarModel !== HUANGJI_SIX_DAY_CALENDAR_MODEL) {
    throw new Error(`六日逐爻公历换算暂只支持${HUANGJI_SIX_DAY_CALENDAR_MODEL}模型。`);
  }
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
  const anchor = resolveWinterSolsticeAnchor({ ...target, utcTimestamp: targetTimestamp });
  const nextAnchor = resolveWinterSolsticeDayStart(
    resolveWinterSolstice(anchor.termYear + 1),
    target,
  );
  const yearLengthMilliseconds = nextAnchor.dayStartUtcTimestamp - anchor.dayStartUtcTimestamp;
  const actualElapsedMilliseconds = targetTimestamp - anchor.dayStartUtcTimestamp;
  const actualElapsedDays = Math.floor(actualElapsedMilliseconds / MILLISECONDS_PER_DAY);
  const actualElapsedSeconds = Math.floor(actualElapsedMilliseconds / 1000);
  const mapped = mapSolarYearToLogicalDay(actualElapsedMilliseconds, yearLengthMilliseconds);
  const cycleElapsedDays = (anchor.dayIndex + mapped.logicalElapsedDays) % HUANGJI_LOGICAL_DAYS;
  const cycle = calculateHuangjiSixDayCycle({
    elapsedDays: cycleElapsedDays,
    hour: target.localTime.hour,
  });
  const cardinalIndex = Math.floor(mapped.logicalElapsedDays / 90);
  const cardinalSeasons: Array<'冬' | '春' | '夏' | '秋'> = ['冬', '春', '夏', '秋'];
  const targetDateTime = formatLocalDateTime(target.localTime, millisecond, target.timezone);
  const anchorDateTime = `${formatCivilDateTime(anchor.civilTime)}${formatFixedTimezoneOffset(HUANGJI_SOLAR_TERM_TIMEZONE)}`;
  const anchorDayStartDateTime = formatLocalDateTime(
    anchor.dayStartCivilTime,
    0,
    anchor.dayStartTimezone,
  );
  const calendar = {
    model: HUANGJI_SIX_DAY_CALENDAR_MODEL,
    mapping: 'solar-year-proportional',
    forecastYear: anchor.termYear,
    actualElapsedDays,
    actualElapsedSeconds,
    logicalElapsedDays: mapped.logicalElapsedDays,
    logicalDayFraction: mapped.logicalDayFraction,
    yearLengthDays: yearLengthMilliseconds / MILLISECONDS_PER_DAY,
    yearLengthSeconds: Math.floor(yearLengthMilliseconds / 1000),
    logicalDayLengthSeconds: yearLengthMilliseconds / 1000 / HUANGJI_LOGICAL_DAYS,
    cycleDay: cycleElapsedDays + 1,
    cardinalSeason: cardinalSeasons[Math.min(cardinalIndex, cardinalSeasons.length - 1)],
    cardinalDay: (mapped.logicalElapsedDays % 90) + 1,
  } as HuangjiSixDayDateResult['calendar'];
  return {
    ...cycle,
    model: '书绪言六日逐爻·公历定位',
    civilTime: {
      dateTime: targetDateTime,
      utcDateTime: new Date(targetTimestamp).toISOString(),
      timezone: target.timezone,
      ...(target.timeZoneId ? { timeZoneId: target.timeZoneId } : {}),
      ...target.localTime,
      millisecond,
    },
    anchor: {
      term: '冬至',
      forecastYear: anchor.termYear,
      dateTime: anchorDateTime,
      utcDateTime: anchor.utcDateTime,
      timezone: HUANGJI_SOLAR_TERM_TIMEZONE,
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
      `以${anchorDateTime}的冬至天文时刻核定${anchor.termYear}皇极年，并以当地${anchorDayStartDateTime}子半作为公历换算起点；起点日干支为${anchor.dayGanZhi}，甲子序号${anchor.dayIndex}。`,
      `以当地冬至子半至下一冬至子半的实测间隔${(yearLengthMilliseconds / MILLISECONDS_PER_DAY).toFixed(6)}日，按三百六十日正数等分；实际已过${actualElapsedDays}个完整公历日，对应当地年内正数坐标第${mapped.logicalElapsedDays + 1}日，结合起点日干支后为周期坐标第${cycleElapsedDays + 1}日。`,
      `第${cycle.jingIndex}经卦第${cycle.dayLine}爻当日，第${cycle.hourLine}个四小时段取${cycle.hexagrams.hourly.shortName}卦。`,
    ],
    sources: HUANGJI_SIX_DAY_SOURCES.map((source) => ({ ...source })),
    limitations: [
      '原典的冬至甲子子半是抽象条件，并未给出现代公历唯一甲子纪元；本入口明确以实际冬至节气核定年份、以该冬至所在当地公历日子半作换算起点，并回显起点日干支与甲子序号。',
      '六日七分存在按回归年等分的不同传承；本入口不插入六个虚构整日，而按本次冬至子半至下一冬至子半的实测间隔等分三百六十日正数，实测年长与传统三百六十五又四分之一日模型的差异由结果字段显式保留。',
      '小时爻沿用当地子半起的四小时段；该小时口径与公历日子半共用同一当地民用日边界，不将当地时钟改写成北京时间。',
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
