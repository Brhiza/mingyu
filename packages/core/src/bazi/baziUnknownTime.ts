import type { BaziChartResult, InternalBaziChartResult, Person } from './baziTypes';
import { analyzeBaziNatalEvidence } from './natalEvidence';
import { resolveBirthCalendarClockTime } from '../calendar/true-solar-time';
import { MONTH_COMMANDER } from './baziDefinitions';
import { SolarTerm } from 'tyme4ts';

const SECOND = 1_000;
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
  | 'month-commander-boundary';

interface CandidatePoint {
  hour: number;
  minute: number;
  second: number;
  source: UnknownTimeScenarioSource;
  timeName: string;
  boundaryName?: string;
  boundarySide?: 'before' | 'at';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatClock(point: Pick<CandidatePoint, 'hour' | 'minute' | 'second'>): string {
  return `${pad(point.hour)}:${pad(point.minute)}:${pad(point.second)}`;
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

function collectBoundaryCandidatePoints(person: Person): CandidatePoint[] {
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
    if (timestamp <= dayStart || timestamp >= dayEnd) return;
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

  const points: CandidatePoint[] = [];
  for (const [timestamp, facts] of [...boundaries].sort((left, right) => left[0] - right[0])) {
    for (const [side, pointTimestamp] of [
      ['before', timestamp - SECOND],
      ['at', timestamp],
    ] as const) {
      const local = new Date(pointTimestamp + BEIJING_OFFSET);
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
          timeName: `${fact.name}${sideLabel}${clock}候选`,
        });
      }
    }
  }
  return points;
}

/** 缺时辰结果保留确定资料，并把完整排盘放在明确标注的候选场景中。 */
export function applyUnknownBirthTime(
  result: InternalBaziChartResult,
  person: Person,
  calculateCandidate: (person: Person) => BaziChartResult,
): BaziChartResult {
  if (person.useTrueSolarTime) {
    throw new Error('出生时辰未知，补齐出生时分后才能校正真太阳时。');
  }
  const retainedWarnings = result.warnings.filter(
    (warning) => warning !== '出生时辰待补充，完整判断与岁运待确定出生时分后再排。',
  );
  const retainedWarningFacts = result.warningFacts;
  const candidateInput: Person = {
    ...person,
    isThreePillars: false,
    birthHour: undefined,
    birthMinute: undefined,
    birthSecond: undefined,
  };
  const dayStartChart = calculateCandidate({
    ...candidateInput,
    timeIndex: 0,
    birthHour: 0,
    birthMinute: 0,
    birthSecond: 0,
  });
  const representativeCharts = Array.from({ length: 13 }, (_, timeIndex) =>
    calculateCandidate({ ...candidateInput, timeIndex }),
  );
  const dayEndChart = calculateCandidate({
    ...candidateInput,
    timeIndex: 12,
    birthHour: 23,
    birthMinute: 59,
    birthSecond: 59,
  });
  const scenarios: Array<{ chart: BaziChartResult; point: CandidatePoint }> = [
    {
      chart: dayStartChart,
      point: {
        hour: 0,
        minute: 0,
        second: 0,
        source: 'day-start' as const,
        timeName: '日初00:00:00候选',
      },
    },
    ...representativeCharts.map((chart) => ({
      chart,
      point: {
        hour: chart.timeInfo.hour,
        minute: chart.timeInfo.minute,
        second: 0,
        source: 'shichen-representative' as const,
        timeName: `${chart.timeInfo.name}候选`,
      },
    })),
    {
      chart: dayEndChart,
      point: {
        hour: 23,
        minute: 59,
        second: 59,
        source: 'day-end' as const,
        timeName: '日末23:59:59候选',
      },
    },
    ...collectBoundaryCandidatePoints(person).map((point) => ({
      point,
      chart: calculateCandidate({
        ...candidateInput,
        birthHour: point.hour,
        birthMinute: point.minute,
        birthSecond: point.second,
      }),
    })),
  ];
  const charts = scenarios.map((scenario) => scenario.chart);
  const summary =
    '出生时辰待补充。已按早子至晚子代表时刻、日初日末，以及当日节气与月令司权临界前后列出候选场景。每项只代表所列具体输入时刻；本命结构按这些真实临界点比较，起运仍随具体出生秒变化，待出生时分确定后再判。';
  const uncertainPillars = (['year', 'month', 'day'] as const).filter((key) =>
    charts.some((chart) => chart.pillars[key].ganZhi !== charts[0].pillars[key].ganZhi),
  );
  result.unknownTimeAnalysis = {
    status: '待补时',
    summary,
    uncertainPillars,
    scenarios: scenarios.map(({ chart, point }) => ({
      scenarioKey: [
        'bazi:unknown-time',
        point.source,
        formatClock(point),
        point.boundaryName ?? 'point',
        point.boundarySide ?? 'point',
      ].join(':'),
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
      pillars: chart.pillars,
      strength: chart.analysis.dayMasterStrength.status,
      pattern: chart.analysis.mingGe.pattern,
      favorableWuxing: chart.analysis.usefulGod.favorableWuxing ?? [],
      unfavorableWuxing: chart.analysis.usefulGod.unfavorableWuxing ?? [],
    })),
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
  delete result.solarTime;
  delete result.eightChar;
  return result;
}
