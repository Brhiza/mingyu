import type {
  BaziChartResult,
  BaziUnknownTimeBatchMetadata,
  InternalBaziChartResult,
  Person,
  Pillars,
} from './baziTypes';
import { analyzeBaziNatalEvidence } from './natalEvidence';
import { resolveBirthCalendarClockTime } from '../calendar/true-solar-time';
import { getTimeIndexFromClock } from '../calendar/dateUtils';
import { checkChinaDst } from '../calendar/china-dst';
import {
  getHistoricalTimezoneOffsetAt,
  resolveHistoricalTimezone,
} from '../calendar/historical-timezone';
import { MONTH_COMMANDER, TIME_MAP } from './baziDefinitions';
import { resolveShenShaVariantConfig } from './baziShenSha';
import { SolarTerm } from 'tyme4ts';

const SECOND = 1_000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * 60 * 60 * SECOND;
const BEIJING_OFFSET = 8 * 60 * 60 * SECOND;
const JIE_MONTH_BRANCH: Readonly<Record<string, string>> = {
  小寒: '丑',
  立春: '寅',
  惊蛰: '卯',
  清明: '辰',
  立夏: '巳',
  芒种: '午',
  小暑: '未',
  立秋: '申',
  白露: '酉',
  寒露: '戌',
  立冬: '亥',
  大雪: '子',
};

type UnknownTimeScenarioSource =
  | 'day-start'
  | 'shichen-representative'
  | 'day-end'
  | 'solar-term-boundary'
  | 'month-commander-boundary'
  | 'dst-boundary';

export interface UnknownTimeCandidatePoint {
  hour: number;
  minute: number;
  second: number;
  source: UnknownTimeScenarioSource;
  timeName: string;
  boundaryName?: string;
  boundarySide?: 'before' | 'at';
  dstInterpretation?: 'daylight' | 'standard';
  timezone?: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatClock(point: Pick<UnknownTimeCandidatePoint, 'hour' | 'minute' | 'second'>): string {
  return `${pad(point.hour)}:${pad(point.minute)}:${pad(point.second)}`;
}

function getIanaCandidateOffsets(
  clock: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZoneId: string,
): number[] {
  try {
    return resolveHistoricalTimezone({ ...clock, timeZoneId }).possibleOffsetsHours;
  } catch (error) {
    if (error instanceof Error && error.message.includes('不存在，通常由夏令时跳时造成')) {
      return [];
    }
    throw error;
  }
}

function toBeijingTimestamp(time: {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
  getSecond(): number;
}): number {
  return (
    Date.UTC(
      time.getYear(),
      time.getMonth() - 1,
      time.getDay(),
      time.getHour(),
      time.getMinute(),
      time.getSecond(),
    ) - BEIJING_OFFSET
  );
}

function getFirstEffectiveTimestamp(term: ReturnType<typeof SolarTerm.fromIndex>): number {
  const roundedSolarTime = term.getJulianDay().getSolarTime();
  const roundedTimestamp = toBeijingTimestamp(roundedSolarTime);
  return roundedSolarTime.getJulianDay().getDay() < term.getJulianDay().getDay()
    ? roundedTimestamp + SECOND
    : roundedTimestamp;
}

function clockFromTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function wallClockFromStandardTimestamp(timestamp: number, person: Person) {
  if (person.timeZoneId) {
    const offset = getHistoricalTimezoneOffsetAt(new Date(timestamp), person.timeZoneId);
    return {
      timestamp: timestamp + offset * HOUR,
      dstInterpretation: 'standard' as const,
      timezone: offset,
    };
  }
  if (person.timezone !== undefined && !person.applyChinaDst) {
    return {
      timestamp: timestamp + person.timezone * HOUR,
      dstInterpretation: 'standard' as const,
    };
  }
  const beijingClockTimestamp = timestamp + BEIJING_OFFSET;
  const daylightClock = clockFromTimestamp(beijingClockTimestamp + HOUR);
  const daylight = person.applyChinaDst
    ? checkChinaDst(
        daylightClock.year,
        daylightClock.month,
        daylightClock.day,
        daylightClock.hour,
        daylightClock.minute,
      )
    : undefined;
  if (daylight?.inDst && !daylight.nonexistent) {
    return { timestamp: beijingClockTimestamp + HOUR, dstInterpretation: 'daylight' as const };
  }
  return { timestamp: beijingClockTimestamp, dstInterpretation: 'standard' as const };
}

function collectBoundaryCandidatePoints(person: Person): UnknownTimeCandidatePoint[] {
  const solarDate = resolveBirthCalendarClockTime({
    dateType: person.isLunar ? 'lunar' : 'solar',
    year: person.year,
    month: person.month,
    day: person.day,
    hour: 12,
    minute: 0,
    second: 0,
    isLeapMonth: person.isLeapMonth,
  });
  const dayStart =
    Date.UTC(solarDate.year, solarDate.month - 1, solarDate.day, 0, 0, 0) - BEIJING_OFFSET;
  const dayEnd = dayStart + DAY;
  const boundaries = new Map<
    number,
    Array<{ source: Extract<UnknownTimeScenarioSource, `${string}-boundary`>; name: string }>
  >();
  const addBoundary = (
    timestamp: number,
    source: Extract<UnknownTimeScenarioSource, `${string}-boundary`>,
    name: string,
  ) => {
    const existing = boundaries.get(timestamp) ?? [];
    existing.push({ source, name });
    boundaries.set(timestamp, existing);
  };

  for (let year = solarDate.year - 1; year <= solarDate.year + 1; year += 1) {
    for (let index = 0; index < 24; index += 1) {
      const term = SolarTerm.fromIndex(year, index);
      const timestamp = toBeijingTimestamp(term.getJulianDay().getSolarTime());
      const name = term.getName();
      addBoundary(timestamp, 'solar-term-boundary', name);
      const rawEffectiveTimestamp = getFirstEffectiveTimestamp(term);
      if (rawEffectiveTimestamp !== timestamp) {
        addBoundary(rawEffectiveTimestamp, 'solar-term-boundary', `${name}原始节气生效`);
      }

      const monthBranch = JIE_MONTH_BRANCH[name];
      if (!monthBranch) continue;
      const commanderStartTimestamp = rawEffectiveTimestamp;
      if (commanderStartTimestamp !== timestamp) {
        addBoundary(commanderStartTimestamp, 'month-commander-boundary', `${name}月令司权起始`);
      }
      const commanders = MONTH_COMMANDER[monthBranch];
      let elapsedDays = 0;
      for (let commanderIndex = 0; commanderIndex < commanders.length - 1; commanderIndex += 1) {
        elapsedDays += commanders[commanderIndex]![1];
        addBoundary(
          commanderStartTimestamp + elapsedDays * DAY,
          'month-commander-boundary',
          `${name}后第${elapsedDays}日月令司权交接`,
        );
      }
    }
  }

  const points: UnknownTimeCandidatePoint[] = [];
  for (const [timestamp, facts] of [...boundaries].sort((left, right) => left[0] - right[0])) {
    for (const [side, standardTimestamp] of [
      ['before', timestamp - SECOND],
      ['at', timestamp],
    ] as const) {
      const wall = wallClockFromStandardTimestamp(standardTimestamp, person);
      const pointTimestamp = wall.timestamp - BEIJING_OFFSET;
      if (pointTimestamp < dayStart || pointTimestamp >= dayEnd) continue;
      const local = new Date(wall.timestamp);
      const hour = local.getUTCHours();
      const minute = local.getUTCMinutes();
      const second = local.getUTCSeconds();
      for (const fact of facts) {
        const sideLabel = side === 'before' ? '临界前一秒' : '临界时刻';
        const clock = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
        points.push({
          hour,
          minute,
          second,
          source: fact.source,
          boundaryName: fact.name,
          boundarySide: side,
          ...(person.applyChinaDst === true ? { dstInterpretation: wall.dstInterpretation } : {}),
          ...('timezone' in wall ? { timezone: wall.timezone } : {}),
          timeName: `${fact.name}${sideLabel}${clock}候选`,
        });
      }
    }
  }
  return points;
}

function collectDstBoundaryCandidatePoints(
  person: Person,
  solarDate: { year: number; month: number; day: number },
): UnknownTimeCandidatePoint[] {
  if (person.applyChinaDst !== true) return [];
  const gap = checkChinaDst(solarDate.year, solarDate.month, solarDate.day, 2);
  const repeated = checkChinaDst(solarDate.year, solarDate.month, solarDate.day, 1);
  const clocks = gap.nonexistent
    ? ([
        [1, 59, 59, '跳时前'],
        [3, 0, 0, '跳时后'],
      ] as const)
    : repeated.ambiguous
      ? ([
          [0, 59, 59, '回拨前'],
          [1, 0, 0, '重复时段起'],
          [1, 59, 59, '重复时段末'],
          [2, 0, 0, '回拨后'],
        ] as const)
      : [];
  return clocks.map(([hour, minute, second, name]) => ({
    hour,
    minute,
    second,
    source: 'dst-boundary',
    boundaryName: `中国历史夏令时${name}`,
    boundarySide: name.endsWith('前') ? 'before' : 'at',
    timeName: `中国历史夏令时${name}${formatClock({ hour, minute, second })}候选`,
  }));
}

type UnknownTimeScenario = NonNullable<BaziChartResult['unknownTimeAnalysis']>['scenarios'][number];

export interface UnknownTimeCandidate {
  point: UnknownTimeCandidatePoint;
  person: Person;
  scenarioKey: string;
}

/**
 * 年月柱只会在节气临界改变，日柱只会在换日临界改变。
 * 日初、日末与已发现的真实临界前后覆盖这些状态；普通时辰代表点仍作为候选返回，
 * 但无需为判断年月日柱是否待定而逐一重复排盘。
 */
export function selectUnknownTimePillarCheckCandidates(
  candidates: UnknownTimeCandidate[],
): UnknownTimeCandidate[] {
  return candidates.filter((candidate) => candidate.point.source !== 'shichen-representative');
}

function buildScenarioKey(point: UnknownTimeCandidatePoint): string {
  return [
    'bazi:unknown-time',
    point.source,
    formatClock(point),
    point.boundaryName ?? 'point',
    point.boundarySide ?? 'point',
    ...(point.dstInterpretation ? [point.dstInterpretation] : []),
    ...(point.timezone !== undefined ? [point.timezone] : []),
  ].join(':');
}

export function discoverUnknownTimeCandidates(person: Person): UnknownTimeCandidate[] {
  if (person.useTrueSolarTime) {
    throw new Error('出生时辰未知，补齐出生时分后才能校正真太阳时。');
  }
  if (person.applyChinaDst && person.timeZoneId) {
    throw new Error('timeZoneId 已包含历史夏令时规则，不能同时启用 applyChinaDst。');
  }
  const solarDate = resolveBirthCalendarClockTime({
    dateType: person.isLunar ? 'lunar' : 'solar',
    year: person.year,
    month: person.month,
    day: person.day,
    hour: 12,
    minute: 0,
    second: 0,
    isLeapMonth: person.isLeapMonth,
  });
  const candidateInput: Person = {
    ...person,
    isThreePillars: false,
    timeIndex: undefined,
    birthHour: undefined,
    birthMinute: undefined,
    birthSecond: undefined,
  };
  const points: UnknownTimeCandidatePoint[] = [
    {
      hour: 0,
      minute: 0,
      second: 0,
      source: 'day-start',
      timeName: '日初00:00:00候选',
    },
    ...TIME_MAP.flatMap((time) => {
      const timeZoneId = person.timeZoneId;
      const representative = { ...solarDate, hour: time.hour, minute: time.minute, second: 0 };
      const hasAllowedOffset = (clock: Parameters<typeof getIanaCandidateOffsets>[0]) =>
        getIanaCandidateOffsets(clock, timeZoneId!).some(
          (offset) => person.timezone === undefined || Math.abs(offset - person.timezone) <= 1e-6,
        );
      let hour: number = time.hour;
      let minute: number = time.minute;
      if (timeZoneId && !hasAllowedOffset(representative)) {
        // 中点处于跳时缺口或不符合给定偏移时，取同一时辰内有效的钟表时刻。
        const fallback = [
          { hour: time.hour - 1, minute: 30 },
          { hour: time.hour, minute: 30 },
          { hour: time.hour - 1, minute: 0 },
          { hour: time.hour, minute: 0 },
        ].find(
          (candidate) =>
            candidate.hour >= 0 &&
            candidate.hour < 24 &&
            getTimeIndexFromClock(candidate.hour, candidate.minute) === time.index &&
            hasAllowedOffset({ ...solarDate, ...candidate, second: 0 }),
        );
        if (!fallback) return [];
        hour = fallback.hour;
        minute = fallback.minute;
      }
      return [
        {
          hour,
          minute,
          second: 0,
          source: 'shichen-representative' as const,
          timeName:
            hour === time.hour && minute === time.minute
              ? `${time.name}候选`
              : `${time.name}${formatClock({ hour, minute, second: 0 })}候选`,
        },
      ];
    }),
    {
      hour: 23,
      minute: 59,
      second: 59,
      source: 'day-end',
      timeName: '日末23:59:59候选',
    },
    ...collectBoundaryCandidatePoints(person),
    ...collectDstBoundaryCandidatePoints(person, solarDate),
  ];

  const candidates = points.flatMap<UnknownTimeCandidate>((point) => {
    const clock = { ...solarDate, hour: point.hour, minute: point.minute, second: point.second };
    if (person.timeZoneId) {
      const offsets = getIanaCandidateOffsets(clock, person.timeZoneId).filter(
        (offset) =>
          (point.timezone === undefined || Math.abs(offset - point.timezone) <= 1e-6) &&
          (person.timezone === undefined || Math.abs(offset - person.timezone) <= 1e-6),
      );
      return offsets.map((timezone) => {
        const disambiguatedPoint =
          offsets.length > 1
            ? {
                ...point,
                timezone,
                timeName: `${point.timeName}（UTC${timezone >= 0 ? '+' : ''}${timezone}）`,
              }
            : point;
        return {
          point: disambiguatedPoint,
          scenarioKey: buildScenarioKey(disambiguatedPoint),
          person: {
            ...candidateInput,
            isLunar: false,
            isLeapMonth: false,
            year: clock.year,
            month: clock.month,
            day: clock.day,
            birthHour: clock.hour,
            birthMinute: clock.minute,
            birthSecond: clock.second,
            timezone,
          },
        };
      });
    }
    const dst = person.applyChinaDst
      ? checkChinaDst(clock.year, clock.month, clock.day, clock.hour, clock.minute)
      : undefined;
    if (dst?.nonexistent) return [];
    const interpretations = dst?.ambiguous
      ? (['daylight', 'standard'] as const)
      : ([dst?.inDst ? 'daylight' : 'standard'] as const);
    return interpretations
      .filter((interpretation) =>
        point.dstInterpretation ? interpretation === point.dstInterpretation : true,
      )
      .map((interpretation) => {
        const standard = clockFromTimestamp(
          Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second) -
            (interpretation === 'daylight' ? HOUR : 0),
        );
        const disambiguatedPoint = dst?.ambiguous
          ? {
              ...point,
              dstInterpretation: interpretation,
              timeName: `${point.timeName}${interpretation === 'daylight' ? '（回拨前）' : '（回拨后）'}`,
            }
          : point;
        return {
          point: disambiguatedPoint,
          scenarioKey: buildScenarioKey(disambiguatedPoint),
          person: {
            ...candidateInput,
            isLunar: false,
            isLeapMonth: false,
            year: standard.year,
            month: standard.month,
            day: standard.day,
            birthHour: standard.hour,
            birthMinute: standard.minute,
            birthSecond: standard.second,
            ...(point.timezone !== undefined && candidateInput.timezone === undefined
              ? { timezone: point.timezone }
              : {}),
            applyChinaDst: false,
          },
        };
      });
  });
  if (!candidates.length && person.timeZoneId && person.timezone !== undefined) {
    throw new Error(
      `timezone 固定偏移 UTC${person.timezone >= 0 ? '+' : ''}${person.timezone} 与 ${person.timeZoneId} 在该日期所有有效当地时刻的历史偏移不一致。`,
    );
  }
  return candidates;
}

export function buildUnknownTimeScenario(
  chart: BaziChartResult,
  candidate: UnknownTimeCandidate,
): UnknownTimeScenario {
  const { point } = candidate;
  return {
    scenarioKey: candidate.scenarioKey,
    inputClockTime: formatClock(point),
    source: point.source,
    ...(point.boundaryName
      ? {
          boundary: {
            name: point.boundaryName,
            side: point.boundarySide!,
          },
        }
      : {}),
    timeIndex: chart.timeInfo.index,
    timeName: point.timeName,
    solarDate: { ...chart.solarDate },
    lunarDate: { ...chart.lunarDate },
    pillars: chart.pillars,
    strength: chart.analysis.dayMasterStrength.status,
    pattern: chart.analysis.mingGe.pattern,
    ...(chart.analysis.mingGe.fulfillment?.status
      ? { patternStatus: chart.analysis.mingGe.fulfillment.status }
      : {}),
    incrementStatus: chart.analysis.usefulGod.incrementStatus,
    favorableWuxing: chart.analysis.usefulGod.favorableWuxing ?? [],
    unfavorableWuxing: chart.analysis.usefulGod.unfavorableWuxing ?? [],
  };
}

export function getUnknownTimeUncertainPillars(
  pillars: Pillars[],
): Array<'year' | 'month' | 'day'> {
  if (!pillars.length) throw new Error('未知时辰候选目录为空。');
  return (['year', 'month', 'day'] as const).filter((key) =>
    pillars.some((item) => item[key].ganZhi !== pillars[0]![key].ganZhi),
  );
}

export function getUnknownTimeUncertainCalendarDates(
  dates: Array<Pick<BaziChartResult, 'solarDate' | 'lunarDate'>>,
): Array<'solar' | 'lunar'> {
  if (!dates.length) throw new Error('未知时辰候选目录为空。');
  const solarDateKey = (date: BaziChartResult['solarDate']) =>
    `${date.year}-${date.month}-${date.day}`;
  const lunarDateKey = (date: BaziChartResult['lunarDate']) =>
    `${date.year}-${date.month}-${date.day}-${date.monthName}-${date.dayName}`;
  return (['solar', 'lunar'] as const).filter((calendar) =>
    dates.some((item) =>
      calendar === 'solar'
        ? solarDateKey(item.solarDate) !== solarDateKey(dates[0]!.solarDate)
        : lunarDateKey(item.lunarDate) !== lunarDateKey(dates[0]!.lunarDate),
    ),
  );
}

function hashContext(value: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function buildUnknownTimeContextKey(person: Person): string {
  const solarDate = resolveBirthCalendarClockTime({
    dateType: person.isLunar ? 'lunar' : 'solar',
    year: person.year,
    month: person.month,
    day: person.day,
    hour: 12,
    minute: 0,
    second: 0,
    isLeapMonth: person.isLeapMonth,
  });
  const timeZoneId = person.timeZoneId?.trim() || null;
  const normalized = JSON.stringify({
    version: 1,
    solarDate: [solarDate.year, solarDate.month, solarDate.day],
    gender: person.gender,
    age: person.age ?? null,
    useTrueSolarTime: person.useTrueSolarTime === true,
    timezone: person.timezone ?? (timeZoneId ? null : 8),
    timeZoneId,
    applyChinaDst: person.applyChinaDst === true,
    shenShaScope: person.shenShaScope ?? 'common',
    shenShaVariants: resolveShenShaVariantConfig(person.shenShaVariants),
  });
  return `bazi:unknown-time:v1:${hashContext(normalized, 0x811c9dc5)}${hashContext(
    normalized,
    0x9e3779b9,
  )}`;
}

const FULL_UNKNOWN_TIME_SUMMARY =
  '出生时辰待补充。已按早子至晚子代表时刻、日初日末，以及当日节气与月令司权临界前后列出候选场景。每项只代表所列具体输入时刻；本命结构按这些真实临界点比较，起运仍随具体出生秒变化，待出生时分确定后再判。';

function copyPillars(pillars: Pillars): Pillars {
  return {
    year: { ...pillars.year },
    month: { ...pillars.month },
    day: { ...pillars.day },
    hour: { ...pillars.hour },
  };
}

function restoreUnknownInputFacts(result: BaziChartResult, base: BaziChartResult): void {
  result.gender = base.gender;
  result.age = base.age;
  result.solarDate = { ...base.solarDate };
  result.lunarDate = { ...base.lunarDate };
  result.zodiac = base.zodiac;
  result.constellation = base.constellation;
  result.warnings = [...base.warnings];
  result.warningFacts = base.warningFacts.map((fact) => ({
    ...fact,
    referenceKeys: [...fact.referenceKeys],
    sources: [...fact.sources],
  }));
  result.warningSummaryFact = {
    ...base.warningSummaryFact,
    factKeys: [...base.warningSummaryFact.factKeys],
    sources: [...base.warningSummaryFact.sources],
  };
}

export function finalizeUnknownBirthTime(
  result: BaziChartResult,
  scenarios: UnknownTimeScenario[],
  uncertainPillars: Array<'year' | 'month' | 'day'>,
  options: {
    batch?: BaziUnknownTimeBatchMetadata;
    inputResult?: BaziChartResult;
    candidateCalendarDates?: Array<Pick<BaziChartResult, 'solarDate' | 'lunarDate'>>;
  } = {},
): BaziChartResult {
  if (!options.candidateCalendarDates?.length) {
    throw new Error('未知时辰需要完整候选历日资料。');
  }
  const uncertainCalendarDates = getUnknownTimeUncertainCalendarDates(
    options.candidateCalendarDates,
  );
  if (options.inputResult) restoreUnknownInputFacts(result, options.inputResult);
  result.pillars = copyPillars(result.pillars);
  const retainedWarnings = result.warnings.filter(
    (warning) => warning !== '出生时辰待补充，完整判断与岁运待确定出生时分后再排。',
  );
  const retainedWarningFacts = result.warningFacts;
  const summary = options.batch
    ? `出生时辰待补充。本页仅列第 ${options.batch.startIndex + 1}/${options.batch.totalCandidates} 个候选；候选目录按早子至晚子代表时刻、日初日末，以及当日节气与月令司权临界确定。当前资料只代表所列具体输入时刻，起运仍随具体出生秒变化，待续取全部候选或补齐出生时分后再判。`
    : FULL_UNKNOWN_TIME_SUMMARY;
  result.isThreePillars = true;
  result.unknownTimeAnalysis = {
    status: '待补时',
    summary,
    uncertainPillars,
    uncertainCalendarDates,
    scenarios,
    ...(options.batch ? { batch: options.batch } : {}),
  };
  for (const key of [...uncertainPillars, 'hour'] as const) {
    result.pillars[key] = { gan: '', zhi: '', ganZhi: '' };
    result.hiddenStems[key] = [];
    result.nayin[key] = '';
    result.pillarLifeStages[key] = '';
    result.ziZuo[key] = '';
    result.kongWang[key] = [];
  }
  // 日主可能随晚子换日，所有依赖日主或完整四柱的判断均待补时。
  if (uncertainPillars.includes('day')) result.dayMaster = { gan: '', element: '', yinYang: '' };
  result.tenGods = {};
  result.hiddenTenGods = {};
  result.lifeStages = {};
  result.wuxingSeasonStatus = {};
  result.wuxingStrength = { missing: [], present: [], dominantByRule: [], ruleBasis: [summary] };
  result.monthCommander = '';
  result.seasonInfo = {
    currentJieqi: '',
    nextJieqi: '',
    daysSincePrev: undefined,
    daysToNext: undefined,
    currentSeason: '',
    jieqiList: result.seasonInfo.jieqiList,
  };
  if (uncertainPillars.includes('year')) result.mingGua = undefined;
  result.climate = undefined;
  result.mingGong = '';
  result.shenGong = '';
  result.taiYuan = '';
  result.taiXi = '';
  result.luckInfo = { startInfo: '待补时', handoverInfo: '待补时', cycles: [] };
  result.liunian = [];
  result.shensha = { year: [], month: [], day: [], hour: [], global: [] };
  result.shenShaAnalysis = { year: [], month: [], day: [], hour: [], global: [] };
  result.pillarRelations = { fuxin: [], fanyin: [], sameStem: [], sameBranch: [], xingChong: [] };
  result.analysis = {
    dayMasterStrength: {
      status: '未知',
      details: {
        timely: false,
        seasonalEffect: '中性',
        commanderEffect: '中性',
        formationEffect: '中性',
        hasRoot: false,
        hasStrongRoot: false,
        hasSupport: false,
        hasConstraint: false,
        ruleBasis: [summary],
      },
    },
    mingGe: { pattern: '待补时', isSpecial: false, basis: summary },
    usefulGod: {
      favorable: [],
      unfavorable: [],
      favorableWuxing: [],
      unfavorableWuxing: [],
      useful: '待补时',
      avoid: '待补时',
      primaryReason: summary,
    },
  };
  result.timeInfo = { index: -1, name: '时辰未知', range: '待补时', hour: -1, minute: -1 };
  result.timing = undefined;
  result.birthClockTime = undefined;
  result.warnings = [...retainedWarnings, summary];
  result.warningFacts = retainedWarningFacts;
  result.warningSummaryFact = {
    ...result.warningSummaryFact,
    status: '存在需核验事项',
    factKeys: retainedWarningFacts.map((fact) => fact.key),
    promptText: retainedWarningFacts.length
      ? `${result.warningSummaryFact.promptText}；${summary}`
      : summary,
    limitation: '缺时辰说明用于标注待补资料，候选场景分别记录，完整命盘尚未确定',
  };
  result.evidenceAnalysis = analyzeBaziNatalEvidence(result);
  delete (result as InternalBaziChartResult).solarTime;
  delete (result as InternalBaziChartResult).eightChar;
  return result;
}

/** 缺时辰结果保留确定资料，并把完整排盘放在明确标注的候选场景中。 */
export function applyUnknownBirthTime(
  result: BaziChartResult,
  person: Person,
  calculateCandidate: (person: Person) => BaziChartResult,
): BaziChartResult {
  const candidates = discoverUnknownTimeCandidates(person);
  const calculated = candidates.map((candidate) => ({
    candidate,
    chart: calculateCandidate(candidate.person),
  }));
  const firstChart = calculated[0]?.chart;
  if (!firstChart) throw new Error('未知时辰候选目录为空。');
  return finalizeUnknownBirthTime(
    firstChart,
    calculated.map(({ chart, candidate }) => buildUnknownTimeScenario(chart, candidate)),
    getUnknownTimeUncertainPillars(calculated.map(({ chart }) => chart.pillars)),
    {
      inputResult: result,
      candidateCalendarDates: calculated.map(({ chart }) => ({
        solarDate: chart.solarDate,
        lunarDate: chart.lunarDate,
      })),
    },
  );
}
