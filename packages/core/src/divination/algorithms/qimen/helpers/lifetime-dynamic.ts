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
import { TimeManager, getDivinationTime } from '../../../../calendar/timeManager';
import { generateQimen } from '../index';
import { diPanPalaces } from './_constants';

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
  const offsetChanged =
    previousOffsetHours !== undefined && Math.abs(previousOffsetHours - sampledOffsetHours) > 1e-6;
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
  const matched = stages.find((stage) => stage.calendarStart <= date && stage.calendarEnd >= date);
  return matched?.stageIndex;
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

  // 查询从一月开始时，补查上一干支年的丑月小寒节点；该节点落在当前公历年一月。
  if (start.month === 1 && startYear > 1) {
    const previousFlowYear = startYear - 1;
    const previousMidYearDate = new Date(createUtcTimestamp(previousFlowYear, 5, 15, 12, 0, 0));
    const previousYearGanZhi = getDivinationTime(
      previousMidYearDate,
      DEFAULT_CHINA_TIMEZONE_HOURS * 60,
    ).ganzhi.year;
    if (previousYearGanZhi[1] === '未') {
      appendMonthClashCluster(
        clusters,
        stages,
        previousFlowYear,
        previousYearGanZhi,
        start,
        end,
        timeContext,
        getPalaceName,
      );
    }
  }

  for (let y = startYear; y <= maxEndYear; y++) {
    const midYearDate = new Date(createUtcTimestamp(y, 5, 15, 12, 0, 0));
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
      throw new Error(`${y}年动态年盘生成失败：${detail}`, { cause });
    }

    const flowYearBranch = flowYearGanZhi[1];
    const taiSuiPalaceNum = diPanPalaces[flowYearBranch];
    if (!taiSuiPalaceNum) continue;

    const basePalace = baseChart.jiuGongGe.find((p) => p.gong === taiSuiPalaceNum);
    if (!basePalace) continue;

    // 用请求范围内的年度代表日匹配阶段卡，避免年初或年末窗口落到代表日之外。
    const yearRepresentative = { year: y, month: 6, day: 15 };
    const representativeDate =
      dateKey(yearRepresentative) < dateKey(start)
        ? start
        : dateKey(yearRepresentative) > dateKey(end)
          ? end
          : yearRepresentative;
    const stageIndex = getStageIndexForDate(stages, formatLifetimeDate(representativeDate));

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
      supportEvidence.push(`太岁落临生门财帛宫，生机旺相，利于资产沉淀与收益变现`);
      verificationQuestions.push('当年是否有重点投资落地、资产买卖或经营收益周转？');
    } else if (baseDoor === '开门') {
      topics.push('career');
      supportEvidence.push(`太岁引动开门事业之宫，主新局开展、职权扩张或平台转换`);
      verificationQuestions.push('当年是否有晋升变动、独立领衔项目或事业新起点？');
    } else if (baseDoor === '休门') {
      topics.push('family', 'marriage');
      supportEvidence.push(`太岁引动休门贵人家庭之宫，利于安顿调养、婚恋交好`);
      verificationQuestions.push('当年家庭人际、长辈关系或感情婚姻是否处于和缓推进阶段？');
    } else if (baseDoor === '死门') {
      topics.push('health');
      counterEvidence.push(`太岁引动死门滞塞之宫，防气机滞缓或精力透支`);
      verificationQuestions.push('当年是否出现长期劳累、慢性不适或重大阻滞需调整？');
    } else if (baseDoor === '伤门') {
      topics.push('relocation');
      counterEvidence.push(`太岁临伤门，主车马奔波与变动磨耗`);
      verificationQuestions.push('当年是否出差频繁、奔波操劳或遭遇琐碎争议？');
    } else if (baseDoor === '景门') {
      topics.push('academic', 'career');
      supportEvidence.push(`太岁引动景门文书声誉之宫，利于学术考察、资质认证与名气外显`);
      verificationQuestions.push('当年是否有进修考试、资质评审、文书签约或公开展示？');
    } else if (baseDoor === '杜门') {
      topics.push('career');
      counterEvidence.push(`太岁临杜门，主隐秘积蓄与潜沉防守，多有技术钻研或暂时等待`);
      verificationQuestions.push('当年是否处于闭关深耕、技术打磨或遇有事务暂缓？');
    } else if (baseDoor === '惊门') {
      topics.push('career');
      counterEvidence.push(`太岁临惊门，防口舌是非、法律咨询或突发谈判`);
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
      supportEvidence.push('太岁同值六合，促成合作契约或婚盟机缘');
    }

    // 2. 虚实填实检查
    if (baseChart.voidBranches && baseChart.voidBranches.includes(flowYearBranch)) {
      triggerDescription += `本命空亡地支【${flowYearBranch}】逢流年填实，该宫潜藏势能全面激活。`;
      supportEvidence.push(`原局逢空之${basePalace.name}得太岁填实，虚转为实`);
      verificationQuestions.push('此前悬而未决、等待推进的事宜是否在当年取得实质进展？');
    }

    // 3. 驿马引动检查
    if (baseChart.horseStar) {
      if (baseChart.horseStar.branch === flowYearBranch) {
        triggerDescription += `流年并临本命驿马【${flowYearBranch}】。`;
        rhythm = '快';
        if (!topics.includes('relocation')) topics.push('relocation');
        supportEvidence.push(`流年同值驿马，主主动出行、跨区域拓展或生活节奏加速`);
        verificationQuestions.push('当年是否发生长途出行、居所搬迁或异地发展？');
      } else if (OPPOSITE_BRANCHES[baseChart.horseStar.branch] === flowYearBranch) {
        triggerDescription += `流年地支【${flowYearBranch}】对冲本命驿马【${baseChart.horseStar.branch}】。`;
        rhythm = '快';
        if (!topics.includes('relocation')) topics.push('relocation');
        supportEvidence.push(`驿马星逢岁支相冲（马星逢冲事必速），多突发性变动与快速推进`);
        verificationQuestions.push('当年是否有预期之外的快速差旅、职位调动或环境变迁？');
      }
    }

    // 4. 年家奇门局合参
    if (yearQimen.classicPatterns && yearQimen.classicPatterns.length > 0) {
      for (const yp of yearQimen.classicPatterns) {
        if (yp.palaces.includes(taiSuiPalaceNum)) {
          if (yp.type === 'good') {
            supportEvidence.push(`岁盘吉格「${yp.name}」叠合临宫：${yp.summary}`);
          } else if (yp.type === 'bad') {
            counterEvidence.push(`岁盘凶格「${yp.name}」叠合临宫：${yp.summary}`);
          }
        }
      }
    }

    // 若未命中任何特定主题，默认归为事业与大势
    if (topics.length === 0) {
      topics.push('career');
    }

    const key = `cluster:${y}:${flowYearGanZhi}:${taiSuiPalaceNum}`;

    clusters.push({
      key,
      stageIndex,
      timeSpan: `${y}年（${flowYearGanZhi}）`,
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
      y,
      flowYearGanZhi,
      start,
      end,
      timeContext,
      getPalaceName,
    );

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

  // 将事件簇 key 反填至 stages
  for (const st of stages) {
    const matchedKeys = clusters.filter((c) => c.stageIndex === st.stageIndex).map((c) => c.key);
    if (matchedKeys.length > 0) {
      st.eventClusterKeys = matchedKeys;
    }
  }

  return clusters;
}
