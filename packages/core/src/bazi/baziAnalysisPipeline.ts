import type {
  BaziAnalysisResult,
  ConstraintAnalysis,
  DayMasterStrengthAnalysis,
  HiddenStems,
  PatternAnalysis,
  Pillars,
  RootAnalysis,
  SupportAnalysis,
  Wuxing,
} from './baziTypes';
import type { FormationAnalysis, SeasonalStatusAnalysis } from './baziStrengthAnalyzer';
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
}

export interface BaziAnalysisPipelineInput {
  pillars: Pillars;
  hiddenStems: HiddenStems;
  monthCommander?: string;
}

interface BaziAnalysisPipelineState {
  dayMasterStrength: DayMasterStrengthAnalysis;
  pattern: PatternAnalysis;
}

function assertAnalysisInput(input: BaziAnalysisPipelineInput): void {
  assertHiddenStemsMatchPillars(input.pillars, input.hiddenStems);

  if (input.monthCommander) {
    assertHeavenlyStem(input.monthCommander, '月令司权天干');
  }
}

function buildPipelineState(
  input: BaziAnalysisPipelineInput,
  deps: BaziAnalysisPipelineDeps,
): BaziAnalysisPipelineState {
  assertAnalysisInput(input);

  const { pillars, hiddenStems, monthCommander } = input;
  const dayMaster = pillars.day.gan;
  const monthBranch = pillars.month.zhi;

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

  return {
    dayMasterStrength,
    pattern,
  };
}

function buildAnalysisResult(state: BaziAnalysisPipelineState): BaziAnalysisResult {
  return {
    dayMasterStrength: state.dayMasterStrength,
    mingGe: state.pattern,
  };
}

export function createBaziAnalysisPipeline(deps: BaziAnalysisPipelineDeps) {
  return {
    run(input: BaziAnalysisPipelineInput): BaziAnalysisResult {
      return buildAnalysisResult(buildPipelineState(input, deps));
    },
  };
}
