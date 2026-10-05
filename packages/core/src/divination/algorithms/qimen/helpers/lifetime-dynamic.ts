/**
 * @file 奇门终身局动态扫描与事件聚类模块
 * @description 根据用户请求的时间区间（periodRange），按年扫描流年太岁引动、
 * 空亡填实、马星引动与年家盘叠合，并列出可复核的交节日与日支关系。
 */

import { SolarDay, SolarTerm } from 'tyme4ts';
import type {
  QimenData,
  QimenEventCluster,
  QimenLifetimeStage,
  QimenTopic,
} from '../../../../types/divination';
import {
  DEFAULT_CHINA_TIMEZONE_HOURS,
  resolveCivilTime,
  type CivilDateTimeParts,
} from '../../../../calendar/civil-time';
import { getHistoricalTimezoneOffsetAt } from '../../../../calendar/historical-timezone';
import { createUtcTimestamp, daysInGregorianMonth } from '../../../../calendar/date-validation';
import { TimeManager } from '../../../../calendar/timeManager';
import { generateQimen } from '../index';
import { getQimenConstants } from './_constants';

const { diPanPalaces } = getQimenConstants();

export interface QimenDynamicTimeContext {
  /** 固定 UTC 偏移；存在 IANA 时区时由 timeZoneId 优先。 */
  timezone?: number;
  /** 目标年度沿用的 IANA 时区，按年度瞬时点重新读取历史偏移。 */
  timeZoneId?: string;
  /** 出生时间已经解析出的固定偏移，用于日期字符串带偏移但未单独传 timezone 的情况。 */
  fallbackOffsetMinutes?: number;
}

function parseLifetimePeriodDate(value: unknown, field: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${field} 必须是 YYYY-MM-DD 格式。`);
  }
  const [, yearText, monthText, dayText] = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)!;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    throw new Error(`${field} 不是有效日期。`);
  }
  const maxDay = daysInGregorianMonth(year, month);
  if (day < 1 || day > maxDay) throw new Error(`${field} 不是有效日期。`);
  return { year, month, day };
}

/** 校验动态流年区间；扫描能力最多覆盖起始年及其后30年。 */
export function validateLifetimePeriodRange(periodRange: unknown): asserts periodRange is {
  startDate: string;
  endDate: string;
} {
  if (!periodRange || typeof periodRange !== 'object' || Array.isArray(periodRange)) {
    throw new Error('periodRange 必须是包含 startDate 和 endDate 的对象。');
  }
  const value = periodRange as { startDate?: unknown; endDate?: unknown };
  const start = parseLifetimePeriodDate(value.startDate, 'periodRange.startDate');
  const end = parseLifetimePeriodDate(value.endDate, 'periodRange.endDate');
  const startKey = start.year * 10000 + start.month * 100 + start.day;
  const endKey = end.year * 10000 + end.month * 100 + end.day;
  if (endKey < startKey) throw new Error('periodRange.endDate 不能早于 startDate。');
  if (end.year > start.year + 30) {
    throw new Error('periodRange 最多支持连续31个年份。');
  }
}

const OPPOSITE_BRANCHES: Record<string, string> = {
  子: '午',
  丑: '未',
  寅: '申',
  卯: '酉',
  辰: '戌',
  巳: '亥',
  午: '子',
  未: '丑',
  申: '寅',
  酉: '卯',
  戌: '辰',
  亥: '巳',
};

const MONTH_BRANCH_TERM_INDEX: Record<string, number> = {
  寅: 3,
  卯: 5,
  辰: 7,
  巳: 9,
  午: 11,
  未: 13,
  申: 15,
  酉: 17,
  戌: 19,
  亥: 21,
  子: 23,
  丑: 1,
};

type LifetimeDateParts = ReturnType<typeof parseLifetimePeriodDate>;

interface LifetimeDateFact {
  date: string;
  dateTime?: string;
  timestamp?: number;
  ganzhi?: string;
  relation?: string;
}

function formatLifetimeDate(value: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'>): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function formatLifetimeDateTime(value: CivilDateTimeParts): string {
  return `${formatLifetimeDate(value)} ${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}:${String(value.second).padStart(2, '0')}`;
}

function dateKey(value: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'>): number {
  return value.year * 10000 + value.month * 100 + value.day;
}

function isDateWithin(
  value: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'>,
  start: LifetimeDateParts,
  end: LifetimeDateParts,
): boolean {
  const key = dateKey(value);
  return key >= dateKey(start) && key <= dateKey(end);
}

function nextLifetimeDate(value: LifetimeDateParts): LifetimeDateParts {
  const next = new Date(
    createUtcTimestamp(value.year, value.month - 1, value.day, 12, 0, 0) + 86400000,
  );
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function previousLifetimeDate(value: LifetimeDateParts): LifetimeDateParts {
  const previous = new Date(
    createUtcTimestamp(value.year, value.month - 1, value.day, 12, 0, 0) - 86400000,
  );
  return {
    year: previous.getUTCFullYear(),
    month: previous.getUTCMonth() + 1,
    day: previous.getUTCDate(),
  };
}

type IanaNoonValidator = {
  formatter: Intl.DateTimeFormat;
  previousOffsetHours?: number;
  initialized: boolean;
};

type IanaWallClockParts = Pick<
  CivilDateTimeParts,
  'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
>;

function createIanaNoonValidator(
  timeContext: QimenDynamicTimeContext | undefined,
): IanaNoonValidator | undefined {
  const timeZoneId = timeContext?.timeZoneId?.trim();
  if (!timeZoneId) return undefined;
  try {
    return {
      formatter: new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZoneId,
        calendar: 'gregory',
        numberingSystem: 'latn',
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      initialized: false,
    };
  } catch {
    throw new Error(`无法识别 IANA 时区 ${timeZoneId}。`);
  }
}

function getIanaWallClockParts(
  formatter: Intl.DateTimeFormat,
  timestamp: number,
): IanaWallClockParts {
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((item) => item.type !== 'literal')
      .map((item) => [item.type, Number(item.value)]),
  ) as Partial<IanaWallClockParts>;
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
  };
}

function getIanaOffsetHoursAt(formatter: Intl.DateTimeFormat, timestamp: number): number {
  const parts = getIanaWallClockParts(formatter, timestamp);
  const representedAsUtc = createUtcTimestamp(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Number(((representedAsUtc - Math.floor(timestamp / 1000) * 1000) / 3600000).toFixed(6));
}

function sameIanaWallClockParts(first: IanaWallClockParts, second: IanaWallClockParts): boolean {
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day &&
    first.hour === second.hour &&
    first.minute === second.minute &&
    first.second === second.second
  );
}

/**
 * 验证当地正午在 IANA 时区中真实存在，并在异常边界复用完整解析以保留缺失/歧义报错。
 * 正常日期只需两次 Intl 读取，避免逐日构造完整 SolarTime 与 73 个候选时区样本。
 */
function validateIanaNoon(
  value: LifetimeDateParts,
  timeZoneId: string,
  validator: IanaNoonValidator,
): void {
  const target: IanaWallClockParts = { ...value, hour: 12, minute: 0, second: 0 };
  const wallTimestamp = createUtcTimestamp(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  const sampledOffsetHours = getIanaOffsetHoursAt(validator.formatter, wallTimestamp);
  const candidateTimestamp = wallTimestamp - sampledOffsetHours * 3600000;
  const candidate = getIanaWallClockParts(validator.formatter, candidateTimestamp);
  const previousOffsetHours = validator.previousOffsetHours;
  const nearbyOffsets = [
    getIanaOffsetHoursAt(validator.formatter, wallTimestamp - 36 * 3600000),
    getIanaOffsetHoursAt(validator.formatter, wallTimestamp + 36 * 3600000),
  ];
  const offsetChanged =
    (previousOffsetHours !== undefined &&
      Math.abs(previousOffsetHours - sampledOffsetHours) > 1e-6) ||
    nearbyOffsets.some((offsetHours) => Math.abs(offsetHours - sampledOffsetHours) > 1e-6);
  if (!sameIanaWallClockParts(candidate, target) || offsetChanged) {
    const resolved = resolveCivilTime(
      { ...target, timeZoneId },
      { defaultTimezone: DEFAULT_CHINA_TIMEZONE_HOURS },
    );
    validator.previousOffsetHours = resolved.timezone;
  } else {
    validator.previousOffsetHours = sampledOffsetHours;
  }
  validator.initialized = true;
}

function validateLifetimeNoon(
  value: LifetimeDateParts,
  timeContext: QimenDynamicTimeContext | undefined,
  ianaNoonValidator: IanaNoonValidator | undefined,
): void {
  const timeZoneId = timeContext?.timeZoneId?.trim();
  if (!timeZoneId) return;
  if (!ianaNoonValidator) {
    throw new Error(`无法识别 IANA 时区 ${timeZoneId}。`);
  }
  if (!ianaNoonValidator.initialized) {
    const wallTimestamp = createUtcTimestamp(value.year, value.month - 1, value.day, 12, 0, 0);
    ianaNoonValidator.previousOffsetHours = getIanaOffsetHoursAt(
      ianaNoonValidator.formatter,
      wallTimestamp - 86400000,
    );
  }
  validateIanaNoon(value, timeZoneId, ianaNoonValidator);
}

function getTermInstant(termYear: number, termIndex: number): Date {
  const termTime = SolarTerm.fromIndex(termYear, termIndex).getJulianDay().getSolarTime();
  const resolved = resolveCivilTime({
    year: termTime.getYear(),
    month: termTime.getMonth(),
    day: termTime.getDay(),
    hour: termTime.getHour(),
    minute: termTime.getMinute(),
    second: termTime.getSecond(),
    timezone: DEFAULT_CHINA_TIMEZONE_HOURS,
  });
  return new Date(resolved.utcTimestamp);
}

function getLocalTermFact(
  termYear: number,
  termIndex: number,
  timeContext: QimenDynamicTimeContext | undefined,
): LifetimeDateFact {
  const termInstant = getTermInstant(termYear, termIndex);
  const offsetMinutes = getDynamicOffsetMinutes(termInstant, timeContext);
  const localTime = TimeManager.getWallClockParts(termInstant, offsetMinutes);
  return {
    date: formatLifetimeDate(localTime),
    dateTime: formatLifetimeDateTime(localTime),
    timestamp: termInstant.getTime(),
  };
}

function getMonthClashTermFacts(
  branch: string,
  year: number,
  start: LifetimeDateParts,
  end: LifetimeDateParts,
  timeContext: QimenDynamicTimeContext | undefined,
): LifetimeDateFact[] {
  const termIndex = MONTH_BRANCH_TERM_INDEX[branch];
  if (termIndex === undefined) return [];

  // 丑月自次年小寒开始，仍属于本年立春起算的干支年。
  const fact = getLocalTermFact(branch === '丑' ? year + 1 : year, termIndex, timeContext);
  const parts = parseLifetimePeriodDate(fact.date, '交节日期');
  return isDateWithin(parts, start, end) ? [{ ...fact, relation: `${branch}月建交节` }] : [];
}

function getStageIndexForDate(stages: QimenLifetimeStage[], date: string): number | undefined {
  const matched = stages.filter(
    (stage) => stage.calendarStart <= date && stage.calendarEnd >= date,
  );
  return matched.length === 1 ? matched[0].stageIndex : undefined;
}

interface FlowYearSlice {
  civilYear: number;
  flowYear: number;
  phase: 'before-lichun' | 'after-lichun';
  start: LifetimeDateParts;
  end: LifetimeDateParts;
  term: LifetimeDateFact;
}

function getFlowYearSlices(
  year: number,
  start: LifetimeDateParts,
  end: LifetimeDateParts,
  timeContext: QimenDynamicTimeContext | undefined,
): FlowYearSlice[] {
  const term = getLocalTermFact(year, 3, timeContext);
  const termDate = parseLifetimePeriodDate(term.date, '立春日期');
  const beforeEnd = term.dateTime?.endsWith('00:00:00') ? previousLifetimeDate(termDate) : termDate;
  const yearStart = { year, month: 1, day: 1 };
  const yearEnd = { year, month: 12, day: 31 };
  const slices: FlowYearSlice[] = [];
  for (const [phase, flowYear, sliceStart, sliceEnd] of [
    ['before-lichun', year - 1, yearStart, beforeEnd],
    ['after-lichun', year, termDate, yearEnd],
  ] as const) {
    const clippedStart = dateKey(start) > dateKey(sliceStart) ? start : sliceStart;
    const clippedEnd = dateKey(end) < dateKey(sliceEnd) ? end : sliceEnd;
    if (dateKey(clippedStart) > dateKey(clippedEnd)) continue;
    if (flowYear < 1) {
      throw new RangeError('立春前的上一干支年超出公历年份支持范围。');
    }
    slices.push({ civilYear: year, flowYear, phase, start: clippedStart, end: clippedEnd, term });
  }
  return slices;
}

function getSliceStageIndices(stages: QimenLifetimeStage[], slice: FlowYearSlice): number[] {
  const startDate = formatLifetimeDate(slice.start);
  const endDate = formatLifetimeDate(slice.end);
  return stages
    .filter((stage) => {
      if (stage.calendarStart > endDate || stage.calendarEnd < startDate) return false;
      if (stage.startDateTime && stage.endDateTimeExclusive && slice.term.timestamp !== undefined) {
        if (
          slice.phase === 'before-lichun' &&
          Date.parse(stage.startDateTime) >= slice.term.timestamp
        ) {
          return false;
        }
        if (
          slice.phase === 'after-lichun' &&
          Date.parse(stage.endDateTimeExclusive) <= slice.term.timestamp
        ) {
          return false;
        }
      }
      return true;
    })
    .map((stage) => stage.stageIndex);
}

function formatFlowYearSlice(slice: FlowYearSlice, ganzhi: string): string {
  const start = formatLifetimeDate(slice.start);
  const end = formatLifetimeDate(slice.end);
  const boundary = slice.term.dateTime!;
  if (slice.phase === 'before-lichun') {
    const span =
      end === slice.term.date
        ? start === end
          ? `${boundary}前`
          : `${start}至${boundary}前`
        : start === end
          ? start
          : `${start}至${end}`;
    return `${slice.civilYear}年（${ganzhi}）立春前（${span}）`;
  }
  const span =
    start === slice.term.date
      ? start === end
        ? `${boundary}起`
        : `${boundary}起至${end}`
      : start === end
        ? start
        : `${start}至${end}`;
  return `${slice.civilYear}年（${ganzhi}）立春后（${span}）`;
}

function collectDailyRelationFacts(
  start: LifetimeDateParts,
  end: LifetimeDateParts,
  baseChart: QimenData,
  timeContext: QimenDynamicTimeContext | undefined,
  ianaNoonValidator: IanaNoonValidator | undefined,
): Map<string, LifetimeDateFact[]> {
  const groups = new Map<string, LifetimeDateFact[]>();
  const horseBranch = baseChart.horseStar?.branch;
  const voidBranches = new Set(baseChart.voidBranches ?? []);
  let current = start;

  while (dateKey(current) <= dateKey(end)) {
    const dateText = formatLifetimeDate(current);
    validateLifetimeNoon(current, timeContext, ianaNoonValidator);
    const dayGanZhi = SolarDay.fromYmd(current.year, current.month, current.day)
      .getLunarDay()
      .getSixtyCycle()
      .getName();
    const dayBranch = dayGanZhi.charAt(1);
    const relations: Array<[string, string]> = [];

    if (voidBranches.has(dayBranch)) {
      relations.push(['void-fill', `本命空亡填实（${Array.from(voidBranches).join('、')}）`]);
    }
    if (horseBranch && dayBranch === horseBranch) {
      relations.push(['horse-same', `日支同本命驿马（${horseBranch}）`]);
    }
    if (horseBranch && OPPOSITE_BRANCHES[horseBranch] === dayBranch) {
      relations.push(['horse-clash', `日支冲本命驿马（${horseBranch}）`]);
    }

    for (const [kind, relation] of relations) {
      const facts = groups.get(kind) ?? [];
      facts.push({ date: dateText, ganzhi: dayGanZhi, relation });
      groups.set(kind, facts);
    }

    current = nextLifetimeDate(current);
  }

  return groups;
}

function getIanaOffsetMinutesAt(date: Date, timeZoneId: string): number {
  const offsetMinutes = getHistoricalTimezoneOffsetAt(date, timeZoneId) * 60;
  if (!Number.isFinite(offsetMinutes) || offsetMinutes < -720 || offsetMinutes > 840) {
    throw new Error(`IANA 时区 ${timeZoneId} 在目标时刻的偏移无效。`);
  }
  return offsetMinutes;
}

function getDynamicOffsetMinutes(
  date: Date,
  timeContext: QimenDynamicTimeContext | undefined,
): number {
  if (timeContext?.timeZoneId?.trim()) {
    return getIanaOffsetMinutesAt(date, timeContext.timeZoneId.trim());
  }
  if (timeContext?.timezone !== undefined) {
    return timeContext.timezone * 60;
  }
  return timeContext?.fallbackOffsetMinutes ?? DEFAULT_CHINA_TIMEZONE_HOURS * 60;
}

function appendMonthClashCluster(
  clusters: QimenEventCluster[],
  stages: QimenLifetimeStage[],
  year: number,
  flowYearGanZhi: string,
  start: LifetimeDateParts,
  end: LifetimeDateParts,
  timeContext: QimenDynamicTimeContext | undefined,
  getPalaceName: (palace: number) => string,
): void {
  const flowYearBranch = flowYearGanZhi[1];
  const clashBranch = OPPOSITE_BRANCHES[flowYearBranch];
  const clashPalace = clashBranch ? diPanPalaces[clashBranch] : undefined;
  if (!clashPalace) return;

  const termFacts = getMonthClashTermFacts(clashBranch, year, start, end, timeContext);
  if (termFacts.length === 0) return;

  const termDates = termFacts.map((fact) => fact.date);
  clusters.push({
    key: `cluster:${year}:month-clash:${clashBranch}:${termDates.join(',')}`,
    stageIndex: getStageIndexForDate(stages, termFacts[0]!.date),
    timeSpan: `${termDates.join('、')}${clashBranch}月建交节`,
    triggerDates: termFacts,
    topics: ['career', 'relocation'],
    triggerFact: `${year}年流年${flowYearGanZhi}对应的${clashBranch}月建交节日为${termFacts.map((fact) => fact.dateTime ?? fact.date).join('、')}，该月支与年支相冲，落${getPalaceName(clashPalace)}。`,
    interactionAnalysis: `月建${clashBranch}与${flowYearGanZhi}年支${flowYearBranch}构成相冲；交节日期按目标时区的真实当地时间列出。`,
    supportEvidence: [`${clashBranch}月建交节日：${termDates.join('、')}`],
    counterEvidence: [],
    rhythm: '快',
    verificationQuestions: [`交节日前后是否出现阶段性决策、迁动或环境变化？`],
  });
}

/**
 * 扫描指定时间范围内的流年动态事件簇
 */
export function scanLifetimeDynamicEvents(
  baseChart: QimenData,
  stages: QimenLifetimeStage[],
  periodRange: { startDate: string; endDate: string },
  method: 'zhuanpan' | 'feipan' = 'zhuanpan',
  juMethod: 'chaibu' | 'zhirun' = 'chaibu',
  timeContext?: QimenDynamicTimeContext,
): QimenEventCluster[] {
  validateLifetimePeriodRange(periodRange);
  const clusters: QimenEventCluster[] = [];

  const start = parseLifetimePeriodDate(periodRange.startDate, 'periodRange.startDate');
  const end = parseLifetimePeriodDate(periodRange.endDate, 'periodRange.endDate');
  const startYear = start.year;
  const endYear = end.year;
  const maxEndYear = endYear;

  const getPalaceName = (p: number) =>
    baseChart.jiuGongGe.find((item) => item.gong === p)?.name || `${p}宫`;
  let ianaNoonValidator: IanaNoonValidator | undefined;

  for (let y = startYear; y <= maxEndYear; y++) {
    let yearSlices: FlowYearSlice[];
    try {
      yearSlices = getFlowYearSlices(y, start, end, timeContext);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      const message = `${y}年动态年盘生成失败：${detail}`;
      throw cause instanceof RangeError
        ? new RangeError(message, { cause })
        : new Error(message, { cause });
    }
    for (const slice of yearSlices) {
      const midYearDate = new Date(createUtcTimestamp(slice.flowYear, 5, 15, 12, 0, 0));
      let flowYearGanZhi: string;
      let yearQimen: QimenData;
      try {
        const targetOffsetMinutes = getDynamicOffsetMinutes(midYearDate, timeContext);
        yearQimen = generateQimen(
          midYearDate,
          method,
          'year',
          juMethod,
          targetOffsetMinutes,
          timeContext?.timeZoneId,
        );
        flowYearGanZhi = yearQimen.ganzhi.year;
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        const message = `${slice.flowYear}年动态年盘生成失败：${detail}`;
        throw cause instanceof RangeError
          ? new RangeError(message, { cause })
          : new Error(message, { cause });
      }

      const flowYearBranch = flowYearGanZhi[1];
      const taiSuiPalaceNum = diPanPalaces[flowYearBranch];
      if (!taiSuiPalaceNum) continue;

      const basePalace = baseChart.jiuGongGe.find((p) => p.gong === taiSuiPalaceNum);
      if (!basePalace) continue;

      const stageIndices = getSliceStageIndices(stages, slice);
      const stageIndex = stageIndices.length === 1 ? stageIndices[0] : undefined;

      const topics: QimenTopic[] = [];
      const supportEvidence: string[] = [];
      const counterEvidence: string[] = [];
      let rhythm: '快' | '中' | '慢' | '待机' = '中';
      const verificationQuestions: string[] = [];

      let triggerDescription = `${y}年（${flowYearGanZhi}太岁）值临${getPalaceName(taiSuiPalaceNum)}。`;

      // 1. 太岁入局引动本命宫位
      const baseDoor = basePalace.renPan.door;
      const baseGod = basePalace.shenPan.god;

      if (baseDoor === '生门') {
        topics.push('wealth');
        supportEvidence.push('太岁临本命生门，传统门象关联生发与经营');
        verificationQuestions.push('当年是否有重点投资落地、资产买卖或经营收益周转？');
      } else if (baseDoor === '开门') {
        topics.push('career');
        supportEvidence.push('太岁临本命开门，传统门象关联对外事务与启动');
        verificationQuestions.push('当年是否有晋升变动、独立领衔项目或事业新起点？');
      } else if (baseDoor === '休门') {
        topics.push('family', 'marriage');
        supportEvidence.push('太岁临本命休门，传统门象关联休养、交流与家庭议题');
        verificationQuestions.push('当年家庭人际、长辈关系或感情婚姻是否处于和缓推进阶段？');
      } else if (baseDoor === '死门') {
        topics.push('health');
        counterEvidence.push('太岁临本命死门，传统门象涉及收束与停滞');
        verificationQuestions.push('当年是否出现长期劳累、慢性不适或重大阻滞需调整？');
      } else if (baseDoor === '伤门') {
        topics.push('relocation');
        counterEvidence.push('太岁临本命伤门，传统门象涉及冲突、损耗与迁动议题');
        verificationQuestions.push('当年是否出差频繁、奔波操劳或遭遇琐碎争议？');
      } else if (baseDoor === '景门') {
        topics.push('academic', 'career');
        supportEvidence.push('太岁临本命景门，传统门象涉及文书、呈现与声誉议题');
        verificationQuestions.push('当年是否有进修考试、资质评审、文书签约或公开展示？');
      } else if (baseDoor === '杜门') {
        topics.push('career');
        counterEvidence.push('太岁临本命杜门，传统门象涉及闭藏与专注');
        verificationQuestions.push('当年是否处于闭关深耕、技术打磨或遇有事务暂缓？');
      } else if (baseDoor === '惊门') {
        topics.push('career');
        counterEvidence.push('太岁临本命惊门，传统门象涉及突发变化与言语争议');
        verificationQuestions.push('当年是否有关键商务谈判、合同交涉、是非申辩或法律咨询？');
      }

      if (verificationQuestions.length === 0) {
        verificationQuestions.push(
          `当年太岁入临${basePalace.name}，是否有重大生活节奏调整或关键环境变迁？`,
        );
      }

      if (baseGod === '六合') {
        if (!topics.includes('marriage')) topics.push('marriage');
        if (!topics.includes('partnership')) topics.push('partnership');
        supportEvidence.push('太岁宫同见六合，传统神象关联合作与协调');
      }

      // 2. 虚实填实检查
      if (baseChart.voidBranches && baseChart.voidBranches.includes(flowYearBranch)) {
        triggerDescription += `本命空亡地支【${flowYearBranch}】逢流年填实。`;
        supportEvidence.push(`本命旬空支${flowYearBranch}逢太岁同支，构成传统填实条件`);
        verificationQuestions.push('此前悬而未决、等待推进的事宜是否在当年取得实质进展？');
      }

      // 3. 驿马引动检查
      if (baseChart.horseStar) {
        if (baseChart.horseStar.branch === flowYearBranch) {
          triggerDescription += `流年并临本命驿马【${flowYearBranch}】。`;
          rhythm = '快';
          if (!topics.includes('relocation')) topics.push('relocation');
          supportEvidence.push('流年支同本命驿马，传统取象涉及出行与迁动');
          verificationQuestions.push('当年是否发生长途出行、居所搬迁或异地发展？');
        } else if (OPPOSITE_BRANCHES[baseChart.horseStar.branch] === flowYearBranch) {
          triggerDescription += `流年地支【${flowYearBranch}】对冲本命驿马【${baseChart.horseStar.branch}】。`;
          rhythm = '快';
          if (!topics.includes('relocation')) topics.push('relocation');
          supportEvidence.push('流年支冲本命驿马，传统取象涉及变动与节奏变化');
          verificationQuestions.push('当年是否有预期之外的快速差旅、职位调动或环境变迁？');
        }
      }

      // 4. 年家奇门局合参
      if (yearQimen.classicPatterns && yearQimen.classicPatterns.length > 0) {
        for (const yp of yearQimen.classicPatterns) {
          if (yp.palaces.includes(taiSuiPalaceNum)) {
            if (yp.type === 'good') {
              supportEvidence.push(`岁盘吉格「${yp.name}」命中太岁所在宫`);
            } else if (yp.type === 'bad') {
              counterEvidence.push(`岁盘凶格「${yp.name}」命中太岁所在宫`);
            }
          }
        }
      }

      // 若未命中任何特定主题，默认归为事业与大势
      if (topics.length === 0) {
        topics.push('career');
      }

      const key = `cluster:${y}:${flowYearGanZhi}:${slice.phase}:${taiSuiPalaceNum}`;

      clusters.push({
        key,
        stageIndex,
        stageIndices,
        timeSpan: formatFlowYearSlice(slice, flowYearGanZhi),
        topics,
        triggerFact: triggerDescription,
        interactionAnalysis: `流年岁气与本命${getPalaceName(taiSuiPalaceNum)}交织：门星神干产生交互响应。`,
        supportEvidence: Array.from(new Set(supportEvidence)),
        counterEvidence: Array.from(new Set(counterEvidence)),
        rhythm,
        verificationQuestions: Array.from(new Set(verificationQuestions)),
      });

      // 细化年月日关键节点：节令只记录真实交节日，日级只记录已有本命关系命中的当地日期。
      appendMonthClashCluster(
        clusters,
        stages,
        slice.flowYear,
        flowYearGanZhi,
        slice.start,
        slice.end,
        timeContext,
        getPalaceName,
      );
    }

    const yearStart = { year: y, month: 1, day: 1 };
    const yearEnd = { year: y, month: 12, day: 31 };
    const dailyStart = dateKey(start) > dateKey(yearStart) ? start : yearStart;
    const dailyEnd = dateKey(end) < dateKey(yearEnd) ? end : yearEnd;
    ianaNoonValidator ??= createIanaNoonValidator(timeContext);
    const dailyGroups = collectDailyRelationFacts(
      dailyStart,
      dailyEnd,
      baseChart,
      timeContext,
      ianaNoonValidator,
    );
    const dailyRelationMeta: Record<
      string,
      {
        label: string;
        topics: QimenTopic[];
        rhythm: '快' | '中' | '慢' | '待机';
        question: string;
      }
    > = {
      'void-fill': {
        label: '本命空亡填实',
        topics: ['career'],
        rhythm: '中',
        question: '这些日辰是否对应原先悬而未决事项出现实质推进？',
      },
      'horse-same': {
        label: '日支同本命驿马',
        topics: ['relocation'],
        rhythm: '快',
        question: '这些日辰是否对应出行、迁动或跨区域安排？',
      },
      'horse-clash': {
        label: '日支冲本命驿马',
        topics: ['relocation'],
        rhythm: '快',
        question: '这些日辰是否对应行程变化、迁动或节奏加速？',
      },
    };

    for (const [relationKey, facts] of dailyGroups) {
      const relation = dailyRelationMeta[relationKey];
      if (!relation || facts.length === 0) continue;
      const stageGroups = new Map<number | undefined, LifetimeDateFact[]>();
      for (const fact of facts) {
        const dailyStageIndex = getStageIndexForDate(stages, fact.date);
        const stageFacts = stageGroups.get(dailyStageIndex) ?? [];
        stageFacts.push(fact);
        stageGroups.set(dailyStageIndex, stageFacts);
      }
      for (const [dailyStageIndex, stageFacts] of stageGroups) {
        const dateTexts = stageFacts.map((fact) => fact.date);
        clusters.push({
          key: `cluster:${y}:day:${relationKey}:${dateTexts[0]}-${dateTexts[dateTexts.length - 1]}`,
          stageIndex: dailyStageIndex,
          timeSpan: `${y}年${relation.label}`,
          triggerDates: stageFacts,
          topics: relation.topics,
          triggerFact: `${y}年本阶段窗口内有${stageFacts.length}个日干支符合${relation.label}。`,
          interactionAnalysis: `按当地民用日读取日支与本命${relation.label}关系，结合具体日期核验该层时间关系。`,
          supportEvidence: [`日支关系：${stageFacts[0]?.relation}`],
          counterEvidence: [],
          rhythm: relation.rhythm,
          verificationQuestions: [relation.question],
        });
      }
    }
  }

  // 精确交运模型保留窗口覆盖的每一运；整年或交运日可同时涉及前后两运。
  if (stages.some((stage) => stage.startDateTime)) {
    for (const cluster of clusters) {
      // 年度片段已按立春瞬时与请求窗口求交，不能再用整公历年覆盖阶段。
      if (cluster.key.includes(':before-lichun:') || cluster.key.includes(':after-lichun:')) {
        continue;
      }
      const facts = cluster.triggerDates;
      const year = Number(cluster.key.split(':')[1]);
      const rangeStart = [periodRange.startDate, `${year}-01-01`].sort().at(-1)!;
      const rangeEnd = [periodRange.endDate, `${year}-12-31`].sort()[0];
      const matching = stages.filter((stage) =>
        facts?.length
          ? facts.some((fact) =>
              fact.timestamp !== undefined && stage.startDateTime && stage.endDateTimeExclusive
                ? Date.parse(stage.startDateTime) <= fact.timestamp &&
                  fact.timestamp < Date.parse(stage.endDateTimeExclusive)
                : stage.calendarStart <= fact.date && stage.calendarEnd >= fact.date,
            )
          : stage.calendarStart <= rangeEnd && stage.calendarEnd >= rangeStart,
      );
      cluster.stageIndices = matching.map((stage) => stage.stageIndex);
      cluster.stageIndex = matching.length === 1 ? matching[0].stageIndex : undefined;
    }
  }

  // 将事件簇 key 反填至 stages
  for (const st of stages) {
    const matchedKeys = clusters
      .filter((c) => c.stageIndex === st.stageIndex || c.stageIndices?.includes(st.stageIndex))
      .map((c) => c.key);
    if (matchedKeys.length > 0) {
      st.eventClusterKeys = matchedKeys;
    }
  }

  return clusters;
}
