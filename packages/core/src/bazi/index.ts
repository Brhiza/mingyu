/**
 * @file Bazi algorithms barrel
 */
export { baziCalculator, BaziCalculator } from './baziCalculator';
export { formatBaziForPrompt } from './baziAnalysisFormatter';
export {
  generateCompatibilityEnhancedSection,
  generateEnhancedAnalysisSection,
} from './baziPromptEnhancement';
export {
  buildFortuneSelectionContext,
  normalizeFortuneSelection,
} from './fortuneSelection/index';
export type {
  BaziFortuneSelectionValue,
  FortuneSelectionContext,
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
  getTenGod,
  getTenGodForBranch,
  getWuxing,
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
export { calculateTrueSolarTime } from './trueSolarTime';
export { LuckCalculator } from './LuckCalculator';
export {
  formatSolarDateTime,
  getLuckCycleForDate,
  isDateWithinLuckCycle,
  shiftSolarDateTimeYears,
  toNativeDate,
  toSolarDateTimeInfo,
} from './luckTiming';

// Enhanced analysis modules (from vibebazi integration)
export { analyzeTenGodStructure, analyzeTenGodFlow } from './tenGodAnalysis';
export { analyzeStemRootProfile, analyzeExposedStemProfile } from './stemRootAnalysis';
export { analyzeRelationStructure } from './relationStructure';
export { analyzeKongWangProfile } from './kongWangAnalysis';
export { analyzeTombStorage } from './tombStorage';
export { analyzeLifeStageProfile, analyzeTenGodLifeStageProfile } from './lifeStageAnalysis';
export { analyzeUsefulGodPlacement } from './usefulGodPlacement';
export { calculateMingGua } from './mingGua';
export { calculateXiaoYunProfile, buildLuckDirectionProfile } from './luckDetails';
export { analyzeMatterFocusProfile } from './matterFocus';
export { analyzeNayinProfile } from './nayinAnalysis';
export { analyzeMonthQiProfile } from './monthCommand';
export { getLifeStage } from './baziValues';
