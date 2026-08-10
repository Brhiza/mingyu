/**
 * @file Bazi algorithms barrel
 */
export { baziCalculator, BaziCalculator } from './baziCalculator';
export { buildBaziPersonInput, calculateBaziChartFromInput } from './input';
export type { BaziChartInputDraft, BaziInputText } from './input';
export { formatBaziForPrompt } from './baziAnalysisFormatter';
export type { PromptChartScene } from './baziAnalysisFormatter';
export { generateEnhancedAnalysisSection } from './baziPromptEnhancement';
export {
  buildCurrentBaziFortuneSelection,
  buildFortuneSelectionContext,
  buildRecentBaziFortuneSelection,
  getCurrentBaziLuckCycle,
  normalizeFortuneSelection,
} from './fortuneSelection/index';
export type {
  BaziFortuneSelectionValue,
  FortuneHourMode,
  FortuneSelectionContext,
  FortuneSelectionOptions,
} from './fortuneSelection/index';
export {
  isFortuneModalDetailOptionActive,
  isFortuneModalParentOptionActive,
} from './fortuneModalSelection';
export type {
  BaziFortuneScope,
  FortuneModalParentRow,
  FortuneModalRow,
} from './fortuneModalSelection';
export type {
  Person,
  Pillar,
  Pillars,
  BaziChartResult,
  BaziAnalysisResult,
  BaziWarningFact,
  BaziWarningSummaryFact,
  SolarDateTimeInfo,
  LocalTimeRange,
  TimingInfo,
  Wuxing,
} from './baziTypes';
export {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getCalendarInfo,
  getCurrentTimeDescription,
  getMonthDaysInfo,
  getYearInfo,
  getYearMonthsGanZhi,
} from './calendarTool';
export type { BaziMonthDayInfo, BaziMonthInfo, CalendarInfo } from './calendarTool';
export { BASIC_MAPPINGS, EARTHLY_BRANCHES, HEAVENLY_STEMS, SIXTY_CYCLE } from './baziMappingsData';
export {
  assertBaziGender,
  assertEarthlyBranch,
  assertGanZhiName,
  assertGanZhiPair,
  assertHeavenlyStem,
  assertPillars,
  getTenGod,
  getTenGodForBranch,
  getShenShaType,
  getWuxing,
  isEarthlyBranch,
  isGanZhiPair,
  isHeavenlyStem,
} from './baziUtils';
export {
  DEFAULT_SHENSHA_VARIANT_CONFIG,
  ShenShaCalculator,
  resolveShenShaVariantConfig,
} from './baziShenSha/index';
export type {
  ShenShaCalculatorOptions,
  ShenShaKongWangBasis,
  ShenShaTongZiScope,
  ShenShaVariantConfig,
  ShenShaYangRenMode,
  ShenShaScope,
} from './baziShenSha/index';
export { COMMON_BAZI_SHENSHA_NAMES, filterCommonBaziShenSha } from './baziShenSha/index';
export { matchesRule } from './baziRuleMatcher/index';
export { determinePattern } from './baziPatternStrategy';
export { determineUsefulGod } from './baziUsefulGodStrategy';
export {
  calculateEquationOfTimeMinutes,
  calculateTrueSolarTime,
  convertTrueSolarTime,
  formatSolarDateTimeParts,
  parseLocalDateTime,
} from './trueSolarTime';
export type {
  SolarDateTimeParts,
  TrueSolarTimeConversionInput,
  TrueSolarTimeConversionResult,
  TrueSolarTimeResult,
} from './trueSolarTime';
export { checkChinaDst, isDateInChinaDstRange } from './chinaDst';
export type { ChinaDstCheckResult } from './chinaDst';
export {
  collectBoundaryWarnings,
  checkJieqiBoundary,
  checkShichenBoundary,
  BOUNDARY_THRESHOLD_MINUTES,
} from './paipanWarnings';
export type { BoundaryCheckInput } from './paipanWarnings';
export { buildBaziWarningEvidence } from './paipanWarnings';
export { LuckCalculator } from './LuckCalculator';
export { CHILD_LIMIT_METHOD, createChildLimit } from './childLimit';
export {
  formatSolarDateTime,
  createLocalTimeRange,
  fromNativeDate,
  getLuckCycleForDate,
  getLuckCycleTimeRange,
  intersectLocalTimeRanges,
  isDateWithinLuckCycle,
  shiftSolarDateTimeYears,
  toNativeDate,
  toSolarDateTimeInfo,
} from './luckTiming';

export { analyzeTenGodStructure, analyzeTenGodFlow } from './tenGodAnalysis';
export { analyzeStemRootProfile, analyzeExposedStemProfile } from './stemRootAnalysis';
export { analyzeRelationStructure } from './relationStructure';
export { analyzeKongWangProfile } from './kongWangAnalysis';
export { analyzeTombStorage } from './tombStorage';
export { analyzeLifeStageProfile, analyzeTenGodLifeStageProfile } from './lifeStageAnalysis';
export { analyzeUsefulGodPlacement } from './usefulGodPlacement';
export { calculateMingGua } from './mingGua';
export { calculateXiaoYunProfile, buildLuckDirectionProfile } from './luckDetails';
export { analyzeNayinProfile } from './nayinAnalysis';
export { analyzeMonthQiProfile } from './monthCommand';
export {
  assessAllHarmonyTransforms,
  assessBranchHarmonyTransform,
  assessStemHarmonyTransform,
  formatHarmonyTransformProfile,
} from './harmonyTransform';
export type { HarmonyPillarInput } from './harmonyTransform';
export { getLifeStage } from './baziValues';
export { analyzeBaziCompatibility } from './compatibilityEvidence';
export { analyzeFortuneTriggers } from './fortuneTriggerEvidence';
export { analyzeBaziNatalEvidence } from './natalEvidence';
export type {
  BaziNatalAnalysisFact,
  BaziNatalCalculationStep,
  BaziNatalCounterEvidenceFact,
  BaziNatalCounterSummaryFact,
  BaziNatalEvidenceAnalysis,
  BaziNatalLimitationFact,
  BaziNatalPillarFact,
  BaziNatalRelationFact,
  BaziNatalSummaryFact,
} from './natalEvidence';
export type {
  FortuneLayerType,
  FortuneTriggerEvidenceResult,
  FortuneTriggerFormationFact,
  FortuneTriggerLayer,
  FortuneTriggerRelation,
  FortuneTriggerRelationType,
} from './fortuneTriggerEvidence';
export type {
  BaziCompatibilityCalculationStep,
  BaziCompatibilityCounterEvidenceFact,
  BaziCompatibilityEvidenceResult,
  BaziCompatibilityLimitationFact,
  BaziCompatibilityOptions,
  BaziCompatibilitySummaryFact,
  BaziCrossBranchCombination,
  BaziCrossPillarRelation,
  BaziDayMasterRelation,
  BaziTenGodMapping,
  BaziUsefulGodCoverage,
  BaziUsefulGodCoverageItem,
} from './compatibilityEvidence';
