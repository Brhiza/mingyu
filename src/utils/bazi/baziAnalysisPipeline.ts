import type {
  BaziAnalysisResult,
  DayMasterStrengthAnalysis,
  HiddenStems,
  PatternAnalysis,
  Pillars,
  RootAnalysis,
  SupportAnalysis,
  UsefulGodAnalysis,
  Wuxing
} from './baziTypes'
import type { SeasonalStatusAnalysis } from './baziAnalyzerHelpers'

export interface BaziAnalysisPipelineDeps {
  getWuxing: (ganOrZhi: string) => Wuxing;
  getTenGod: (gan: string, dayMaster: string) => string;
  getSeasonStatus: (zhi: string) => Record<string, string>;
  analyzeRoot: (dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: (ganOrZhi: string) => Wuxing) => RootAnalysis;
  analyzeSupport: (dayMaster: string, pillars: Pillars, getWuxing: (ganOrZhi: string) => Wuxing) => SupportAnalysis;
  analyzeSeasonalStatus: (
    dayMaster: string,
    monthBranch: string,
    getSeasonStatus: (zhi: string) => Record<string, string>,
    getWuxing: (ganOrZhi: string) => Wuxing
  ) => SeasonalStatusAnalysis;
  analyzeDayMasterStrength: (
    seasonalStatus: SeasonalStatusAnalysis,
    rootAnalysis: RootAnalysis,
    supportAnalysis: SupportAnalysis
  ) => DayMasterStrengthAnalysis;
  determinePattern: (pillars: Pillars, strengthStatus: string, getTenGod: (gan: string, dayMaster: string) => string) => PatternAnalysis;
  determineUsefulGod: (
    strengthStatus: string,
    pattern: PatternAnalysis,
    dmWuxing: string,
    monthBranch?: string,
    monthCommander?: string
  ) => UsefulGodAnalysis & { favorableWuxing: string[]; unfavorableWuxing: string[] };
}

export interface BaziAnalysisPipelineInput {
  pillars: Pillars;
  hiddenStems: HiddenStems;
  monthCommander?: string;
}

interface BaziAnalysisPipelineState {
  dayMasterStrength: DayMasterStrengthAnalysis;
  pattern: PatternAnalysis;
  usefulGod: UsefulGodAnalysis & { favorableWuxing: string[]; unfavorableWuxing: string[] };
}

function buildPipelineState(
  input: BaziAnalysisPipelineInput,
  deps: BaziAnalysisPipelineDeps
): BaziAnalysisPipelineState {
  const { pillars, hiddenStems, monthCommander } = input
  const dayMaster = pillars.day.gan
  const monthBranch = pillars.month.zhi
  const dayMasterElement = deps.getWuxing(dayMaster) as string

  const rootAnalysis = deps.analyzeRoot(dayMaster, pillars, hiddenStems, deps.getWuxing)
  const supportAnalysis = deps.analyzeSupport(dayMaster, pillars, deps.getWuxing)
  const seasonalStatus = deps.analyzeSeasonalStatus(dayMaster, monthBranch, deps.getSeasonStatus, deps.getWuxing)
  const dayMasterStrength = deps.analyzeDayMasterStrength(seasonalStatus, rootAnalysis, supportAnalysis)
  const pattern = deps.determinePattern(pillars, dayMasterStrength.status, deps.getTenGod)
  const usefulGod = deps.determineUsefulGod(dayMasterStrength.status, pattern, dayMasterElement, monthBranch, monthCommander)

  return {
    dayMasterStrength,
    pattern,
    usefulGod
  }
}

function buildAnalysisResult(state: BaziAnalysisPipelineState): BaziAnalysisResult {
  return {
    dayMasterStrength: state.dayMasterStrength,
    mingGe: state.pattern,
    usefulGod: state.usefulGod
  }
}

export function createBaziAnalysisPipeline(deps: BaziAnalysisPipelineDeps) {
  return {
    run(input: BaziAnalysisPipelineInput): BaziAnalysisResult {
      return buildAnalysisResult(buildPipelineState(input, deps))
    }
  }
}
