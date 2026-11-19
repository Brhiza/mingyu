// Beijing-time annual, monthly, daily and hourly hexagrams.
import { SolarTerm } from 'tyme4ts';
import { NEXT_AFTER_CARDINAL, getHexagramByShortName, getHexagramByBinary, summarizeHexagram, toBottomUpLines, fromBottomUpLines } from './hexagram';
import { HUANGJI_CIRCLE_HEXAGRAMS, calculateStandardHuangjiForecast, type HuangjiHexagramSummary } from './standard';
const MILLISECONDS_PER_DAY = 86_400_000;

// tyme4ts returns solar terms in China standard time. Preserve years 1–99.
function resolveSolarTermTimestamp(term: ReturnType<typeof SolarTerm.fromIndex>) {
  const time = term.getJulianDay().getSolarTime();
  const date = new Date(0);
  date.setUTCFullYear(time.getYear(), time.getMonth() - 1, time.getDay());
  date.setUTCHours(time.getHour(), time.getMinute(), time.getSecond(), 0);
  return date.getTime() - 8 * 3_600_000;
}

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

export interface HuangjiDerivedHexagram extends HuangjiHexagramSummary {
  derivedFrom?: string;
  changedLine?: number;
  sequenceOffset?: number;
  sequenceStart?: string;
}

export interface HuangjiDateTimeForecast {
  model: '经纬卦年月日时推衍';
  civilTime: {
    dateTime: string;
    /** 真太阳时起盘时，用于确定节气的实际占时。 */
    termReferenceDateTime?: string;
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

export function changeLine(source: HuangjiHexagramSummary, line: number): HuangjiDerivedHexagram {
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
  const sequenceStart = HUANGJI_CIRCLE_HEXAGRAMS[startIndex];
  const targetName = HUANGJI_CIRCLE_HEXAGRAMS[(startIndex + offset) % 60];
  return {
    ...summarizeHexagram(getHexagramByShortName(targetName)),
    derivedFrom: source.shortName,
    sequenceOffset: offset,
    sequenceStart,
  };
}

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function getBeijingDate(date: Date): Date {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

function formatBeijingDateTime(beijing: Date): string {
  const year = beijing.getUTCFullYear();
  const month = beijing.getUTCMonth() + 1;
  const day = beijing.getUTCDate();
  const hour = beijing.getUTCHours();
  const minute = beijing.getUTCMinutes();
  const second = beijing.getUTCSeconds();
  const millisecond = beijing.getUTCMilliseconds();
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}${millisecond ? `.${String(millisecond).padStart(3, '0')}` : ''}`;
}

export function resolveCalendar(
  date: Date,
  termReferenceDate: Date = date,
): HuangjiDateTimeForecast['civilTime'] & HuangjiDateTimeForecast['calendar'] {
  const beijing = getBeijingDate(date);
  const year = beijing.getUTCFullYear();
  const month = beijing.getUTCMonth() + 1;
  const day = beijing.getUTCDate();
  const hour = beijing.getUTCHours();
  const minute = beijing.getUTCMinutes();
  const second = beijing.getUTCSeconds();
  const targetTimestamp = termReferenceDate.getTime();
  const candidates: Array<{
    forecastYear: number;
    index: number;
    name: string;
    utcTimestamp: number;
  }> = [];

  // 索引 0 属于上一公历年的冬至，目标年份只需再查看下一轮的冬至、
  // 小寒。避免为极端年份预取整个下一轮节气而越过历表上界。
  for (const forecastYear of [year, year + 1]) {
    const firstIndex = forecastYear === 1 ? 1 : 0;
    const lastIndex = forecastYear === year ? 23 : 1;
    for (let index = firstIndex; index <= lastIndex; index += 1) {
      const term = SolarTerm.fromIndex(forecastYear, index);
      candidates.push({
        forecastYear,
        index,
        name: term.getName(),
        utcTimestamp: resolveSolarTermTimestamp(term),
      });
    }
  }

  const active = candidates
    .filter((term) => term.utcTimestamp <= targetTimestamp)
    .sort((left, right) => right.utcTimestamp - left.utcTimestamp)[0];
  if (!active) throw new Error('无法定位起盘时间所属的皇极节气。');

  const actualDayInSolarTerm =
    Math.floor((targetTimestamp - active.utcTimestamp) / MILLISECONDS_PER_DAY) + 1;
  const mappedDayInSolarTerm = Math.max(1, Math.min(actualDayInSolarTerm, 15));
  const dayOfYear = active.index * 15 + mappedDayInSolarTerm;
  const monthIndex = Math.floor((dayOfYear - 1) / 30) + 1;
  const dayOfMonth = ((dayOfYear - 1) % 30) + 1;
  const hourSegment = Math.floor(hour / 4) + 1;
  const hourStart = (hourSegment - 1) * 4;
  const hourEnd = hourSegment * 4;

  return {
    dateTime: formatBeijingDateTime(beijing),
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

export function calculateHuangjiDateTimeForecast(
  date: Date,
  termReferenceDate?: Date,
): HuangjiDateTimeForecast {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('皇极经世年月日时起盘时间不是有效日期。');
  }
  if (
    termReferenceDate !== undefined &&
    (!(termReferenceDate instanceof Date) || Number.isNaN(termReferenceDate.getTime()))
  ) {
    throw new Error('皇极经世实际占时不是有效日期。');
  }

  const resolved = resolveCalendar(date, termReferenceDate);
  const referenceDateTime = termReferenceDate
    ? formatBeijingDateTime(getBeijingDate(termReferenceDate))
    : undefined;
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
      ...(referenceDateTime ? { termReferenceDateTime: referenceDateTime } : {}),
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
      `${resolved.dateTime}按${referenceDateTime ? `真太阳时钟表起盘，节气参照实际占时${referenceDateTime}` : '北京时间起盘'}，定位于${resolved.activeSolarTerm}后第${resolved.actualDayInSolarTerm}日，对应皇极${resolved.monthBranch}月第${resolved.dayOfMonth}日`,
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
