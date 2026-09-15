import type { BaziChartResult, InternalBaziChartResult, Person } from './baziTypes';
import { analyzeBaziNatalEvidence } from './natalEvidence';

/** 缺时辰结果保留确定资料，并把完整排盘放在明确标注的候选场景中。 */
export function applyUnknownBirthTime(
  result: InternalBaziChartResult,
  person: Person,
  calculateCandidate: (person: Person) => BaziChartResult,
): BaziChartResult {
  if (person.useTrueSolarTime) {
    throw new Error('出生时辰未知，补齐出生时分后才能校正真太阳时。');
  }
  const candidateInput: Person = {
    ...person,
    isThreePillars: false,
    birthHour: undefined,
    birthMinute: undefined,
    birthSecond: undefined,
  };
  const charts = Array.from({ length: 13 }, (_, timeIndex) =>
    calculateCandidate({ ...candidateInput, timeIndex }),
  );
  // 早子、晚子的代表时刻分别为00:30、23:30，额外检查日初与日末交节。
  charts.unshift(
    calculateCandidate({
      ...candidateInput,
      timeIndex: 0,
      birthHour: 0,
      birthMinute: 0,
      birthSecond: 0,
    }),
  );
  charts.push(
    calculateCandidate({
      ...candidateInput,
      timeIndex: 12,
      birthHour: 23,
      birthMinute: 59,
      birthSecond: 59,
    }),
  );
  const summary =
    '出生时辰待补充。已按早子至晚子及日初、日末时刻列出候选场景；交节、子初换日及分日司令可能改变柱与判断。候选仅用于比较，旺衰、格局、喜忌、命身宫与起运待出生时分确定后再判。';
  const uncertainPillars = (['year', 'month', 'day'] as const).filter((key) =>
    charts.some((chart) => chart.pillars[key].ganZhi !== charts[0].pillars[key].ganZhi),
  );
  result.unknownTimeAnalysis = {
    status: '待补时',
    summary,
    uncertainPillars,
    scenarios: charts.map((chart, index) => ({
      timeIndex: chart.timeInfo.index,
      timeName:
        index === 0
          ? '日初00:00:00候选'
          : index === 14
            ? '日末23:59:59候选'
            : `${chart.timeInfo.name}候选`,
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
  result.warnings = [summary];
  result.warningFacts = [];
  result.warningSummaryFact = {
    ...result.warningSummaryFact,
    status: '存在需核验事项',
    factKeys: [],
    promptText: summary,
    limitation: '缺时辰说明用于标注待补资料，候选场景分别记录，完整命盘尚未确定',
  };
  result.evidenceAnalysis = analyzeBaziNatalEvidence(result);
  delete result.solarTime;
  delete result.eightChar;
  return result;
}
