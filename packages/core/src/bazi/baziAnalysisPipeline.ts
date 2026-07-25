import type {
  BaziAnalysisResult,
  ConstraintAnalysis,
  DayMasterStrengthAnalysis,
  HiddenStems,
  PatternAnalysis,
  Pillars,
  RootAnalysis,
  SeasonInfo,
  SupportAnalysis,
  UsefulGodAnalysis,
  Wuxing,
} from './baziTypes';
import { WUXING } from './baziTypes';
import type { FormationAnalysis, SeasonalStatusAnalysis } from './baziStrengthAnalyzer';
import { collectEstablishedBranchFormations } from './baziFormationUtils';
import type { HiddenStemSource, VisibleStemSource } from './baziRuleMatcher';
import { assertHeavenlyStem, assertHiddenStemsMatchPillars } from './baziUtils';

export interface BaziAnalysisPipelineDeps {
  getWuxing: (ganOrZhi: string) => Wuxing;
  getTenGod: (gan: string, dayMaster: string) => string;
  getSeasonStatus: (zhi: string) => Record<string, string>;
  analyzeRoot: (
    dayMaster: string,
    pillars: Pillars,
    hiddenStems: HiddenStems,
    getWuxing: (ganOrZhi: string) => Wuxing,
  ) => RootAnalysis;
  analyzeFormation: (
    dayMaster: string,
    pillars: Pillars,
    getWuxing: (ganOrZhi: string) => Wuxing,
  ) => FormationAnalysis;
  analyzeSupport: (
    dayMaster: string,
    pillars: Pillars,
    hiddenStems: HiddenStems,
    getWuxing: (ganOrZhi: string) => Wuxing,
  ) => SupportAnalysis;
  analyzeConstraint: (
    dayMaster: string,
    pillars: Pillars,
    hiddenStems: HiddenStems,
    getWuxing: (ganOrZhi: string) => Wuxing,
  ) => ConstraintAnalysis;
  analyzeSeasonalStatus: (
    dayMaster: string,
    monthBranch: string,
    getSeasonStatus: (zhi: string) => Record<string, string>,
    getWuxing: (ganOrZhi: string) => Wuxing,
    monthCommander?: string,
  ) => SeasonalStatusAnalysis;
  analyzeDayMasterStrength: (
    seasonalStatus: SeasonalStatusAnalysis,
    formationAnalysis: FormationAnalysis,
    rootAnalysis: RootAnalysis,
    supportAnalysis: SupportAnalysis,
    constraintAnalysis: ConstraintAnalysis,
  ) => DayMasterStrengthAnalysis;
  determinePattern: (
    pillars: Pillars,
    strengthStatus: string,
    getTenGod: (gan: string, dayMaster: string) => string,
    monthCommander?: string,
  ) => PatternAnalysis;
  determineUsefulGod: (
    strengthStatus: string,
    pattern: PatternAnalysis,
    dmWuxing: string,
    monthBranch?: string,
    monthCommander?: string,
    dayMasterStem?: string,
    climateContext?: {
      yearStem?: string;
      hourBranch?: string;
      currentJieqi?: string;
      visibleStems?: string[];
      visibleStemSources?: VisibleStemSource[];
      hiddenStems?: string[];
      hiddenStemSources?: HiddenStemSource[];
      formationWuxings?: string[];
      wuxingCounts?: Record<string, number>;
    },
  ) => UsefulGodAnalysis & { favorableWuxing: string[]; unfavorableWuxing: string[] };
}

export interface BaziAnalysisPipelineInput {
  pillars: Pillars;
  hiddenStems: HiddenStems;
  monthCommander?: string;
  seasonInfo?: Pick<SeasonInfo, 'currentJieqi'>;
}

interface BaziAnalysisPipelineState {
  dayMasterStrength: DayMasterStrengthAnalysis;
  pattern: PatternAnalysis;
  usefulGod: UsefulGodAnalysis & { favorableWuxing: string[]; unfavorableWuxing: string[] };
}

function assertValidWuxing(value: string, label: string): asserts value is Wuxing {
  if (!(WUXING as readonly string[]).includes(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

function assertAnalysisInput(input: BaziAnalysisPipelineInput): void {
  assertHiddenStemsMatchPillars(input.pillars, input.hiddenStems);

  if (input.monthCommander) {
    assertHeavenlyStem(input.monthCommander, '月令司权天干');
  }
}

function buildVisibleStems(pillars: Pillars): string[] {
  return [pillars.year.gan, pillars.month.gan, pillars.day.gan, pillars.hour.gan].filter(Boolean);
}

function buildVisibleStemSources(pillars: Pillars): VisibleStemSource[] {
  return (
    [
      { pillar: 'year', stem: pillars.year.gan },
      { pillar: 'month', stem: pillars.month.gan },
      { pillar: 'day', stem: pillars.day.gan },
      { pillar: 'hour', stem: pillars.hour.gan },
    ] as VisibleStemSource[]
  ).filter((source) => Boolean(source.stem));
}

function buildHiddenStemValues(hiddenStems: HiddenStems): string[] {
  return [
    ...hiddenStems.year,
    ...hiddenStems.month,
    ...hiddenStems.day,
    ...hiddenStems.hour,
  ].filter(Boolean);
}

function buildHiddenStemSources(pillars: Pillars, hiddenStems: HiddenStems): HiddenStemSource[] {
  return [
    { pillar: 'year', branch: pillars.year.zhi, stems: hiddenStems.year.filter(Boolean) },
    { pillar: 'month', branch: pillars.month.zhi, stems: hiddenStems.month.filter(Boolean) },
    { pillar: 'day', branch: pillars.day.zhi, stems: hiddenStems.day.filter(Boolean) },
    { pillar: 'hour', branch: pillars.hour.zhi, stems: hiddenStems.hour.filter(Boolean) },
  ];
}

function buildFormationWuxings(pillars: Pillars): string[] {
  return [
    ...new Set(collectEstablishedBranchFormations(pillars).map((formation) => formation.wuxing)),
  ];
}

function buildWuxingCounts(
  pillars: Pillars,
  getWuxing: (ganOrZhi: string) => Wuxing,
): Record<string, number> {
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const observedValues = [
    pillars.year.gan,
    pillars.month.gan,
    pillars.day.gan,
    pillars.hour.gan,
    pillars.year.zhi,
    pillars.month.zhi,
    pillars.day.zhi,
    pillars.hour.zhi,
  ];

  observedValues.forEach((value, index) => {
    const wuxing = getWuxing(value);
    assertValidWuxing(wuxing, `第${index + 1}个四柱字符`);
    counts[wuxing] = (counts[wuxing] || 0) + 1;
  });

  return counts;
}

function buildPipelineState(
  input: BaziAnalysisPipelineInput,
  deps: BaziAnalysisPipelineDeps,
): BaziAnalysisPipelineState {
  assertAnalysisInput(input);

  const { pillars, hiddenStems, monthCommander, seasonInfo } = input;
  const dayMaster = pillars.day.gan;
  const monthBranch = pillars.month.zhi;
  const dayMasterElement = deps.getWuxing(dayMaster) as string;
  assertValidWuxing(dayMasterElement, '日主');
  const visibleStems = buildVisibleStems(pillars);
  const visibleStemSources = buildVisibleStemSources(pillars);
  const hiddenStemValues = buildHiddenStemValues(hiddenStems);
  const hiddenStemSources = buildHiddenStemSources(pillars, hiddenStems);
  const formationWuxings = buildFormationWuxings(pillars);
  const wuxingCounts = buildWuxingCounts(pillars, deps.getWuxing);

  const rootAnalysis = deps.analyzeRoot(dayMaster, pillars, hiddenStems, deps.getWuxing);
  const formationAnalysis = deps.analyzeFormation(dayMaster, pillars, deps.getWuxing);
  const supportAnalysis = deps.analyzeSupport(dayMaster, pillars, hiddenStems, deps.getWuxing);
  const constraintAnalysis = deps.analyzeConstraint(
    dayMaster,
    pillars,
    hiddenStems,
    deps.getWuxing,
  );
  const seasonalStatus = deps.analyzeSeasonalStatus(
    dayMaster,
    monthBranch,
    deps.getSeasonStatus,
    deps.getWuxing,
    monthCommander,
  );
  const dayMasterStrength = deps.analyzeDayMasterStrength(
    seasonalStatus,
    formationAnalysis,
    rootAnalysis,
    supportAnalysis,
    constraintAnalysis,
  );
  const pattern = deps.determinePattern(
    pillars,
    dayMasterStrength.status,
    deps.getTenGod,
    monthCommander,
  );
  const usefulGod = deps.determineUsefulGod(
    dayMasterStrength.status,
    pattern,
    dayMasterElement,
    monthBranch,
    monthCommander,
    dayMaster,
    {
      yearStem: pillars.year.gan,
      hourBranch: pillars.hour.zhi,
      currentJieqi: seasonInfo?.currentJieqi,
      visibleStems,
      visibleStemSources,
      hiddenStems: hiddenStemValues,
      hiddenStemSources,
      formationWuxings,
      wuxingCounts,
    },
  );

  return {
    dayMasterStrength,
    pattern,
    usefulGod,
  };
}

function buildAnalysisResult(state: BaziAnalysisPipelineState): BaziAnalysisResult {
  return {
    dayMasterStrength: state.dayMasterStrength,
    mingGe: state.pattern,
    usefulGod: state.usefulGod,
  };
}

export function createBaziAnalysisPipeline(deps: BaziAnalysisPipelineDeps) {
  return {
    run(input: BaziAnalysisPipelineInput): BaziAnalysisResult {
      return buildAnalysisResult(buildPipelineState(input, deps));
    },
  };
}
