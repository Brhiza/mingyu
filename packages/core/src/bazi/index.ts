/**
 * @file Bazi algorithms barrel
 */
export { baziCalculator, BaziCalculator } from './baziCalculator';
export { formatBaziForPrompt } from './baziAnalysisFormatter';
export { generateEnhancedAnalysisSection } from './baziPromptEnhancement';
export { buildFortuneSelectionContext, normalizeFortuneSelection } from './fortuneSelection/index';
export type { BaziFortuneSelectionValue, FortuneSelectionContext } from './fortuneSelection/index';
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
} from './baziShenSha/index';
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
export { LuckCalculator } from './LuckCalculator';
export {
  formatSolarDateTime,
  getLuckCycleForDate,
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
export type {
  FortuneLayerType,
  FortuneTriggerEvidenceResult,
  FortuneTriggerLayer,
  FortuneTriggerRelation,
  FortuneTriggerRelationType,
} from './fortuneTriggerEvidence';
export type {
  BaziCompatibilityEvidenceResult,
  BaziCompatibilityOptions,
  BaziCrossBranchCombination,
  BaziCrossPillarRelation,
  BaziDayMasterRelation,
  BaziTenGodMapping,
  BaziUsefulGodCoverage,
} from './compatibilityEvidence';
