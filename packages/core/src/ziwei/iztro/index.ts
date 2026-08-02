/**
 * @file Ziwei (紫微斗数) iztro integration barrel
 */
export {
  buildAstrolabeFromInput,
  buildHoroscope,
  buildHoroscopeFromInput,
  buildZiweiCalculationConfig,
  DEFAULT_ZIWEI_CALCULATION_CONFIG,
  getDefaultHoroscopeContext,
} from './runtime-helpers';
export { shiftLocalDate, shiftLunarYear } from './runtime-helpers';
export type { DecadalTimelineOption } from './decadal';
export {
  buildDecadalTimelineOptions,
  buildVerifiedDecadalTimelineOptions,
  findCurrentDecadalOption,
  formatDecadalAgeRange,
  getChildhoodAgeRange,
} from './decadal';
export { buildAnalysisPayloadV1 } from './build-analysis-payload/index';
export { buildActiveScope, buildBasicInfo } from './build-analysis-payload/helpers/builders';
export { mapStarFact } from './build-analysis-payload/helpers/mappers';
export { getCurrentScopeItem } from './build-analysis-payload/helpers/scope';
export {
  buildPatternAnalysis,
  detectPatterns,
  isVerifiedZiweiPatternKey,
  selectVerifiedZiweiPatterns,
  VERIFIED_ZIWEI_PATTERN_RULE_COUNT,
  ZIWEI_PATTERN_AUDIT_NOTICE,
  ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES,
  ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT,
} from './pattern-detection';
export { buildEvidenceAnalysis, buildEvidencePool } from './build-evidence-pool';
export {
  buildScopeFocusPalaces,
  collectMutagenStars,
  dedupePalaces,
  getAllStars,
  getBodyPalace,
  getOppositePalace,
  getPalaceByIndex,
  getPalaceByName,
  getSurroundedPalaces,
} from './palace-helpers';
export {
  resolveZiweiTrueSolarBirth,
  type ZiweiTrueSolarBirth,
  type ZiweiTrueSolarInput,
} from '../true-solar-input';
export {
  buildZiweiChartInputFromSources,
  createZiweiBirthSource,
  createZiweiCalculationSource,
  createZiweiGenerationSource,
  normalizeZiweiBirthSource,
  normalizeZiweiCalculationSource,
  normalizeZiweiGenerationSource,
} from '../generation';
export type {
  ZiweiBirthSource,
  ZiweiCalculationSource,
  ZiweiGenerationSource,
  ZiweiHoroscopeReference,
  ZiweiTraditionalBirthSource,
  ZiweiTrueSolarBirthSource,
} from '../../types/chart';
export { analyzeZiweiCompatibility } from './compatibility-evidence';
export type {
  ZiweiCompatibilityCalculationStep,
  ZiweiCompatibilityCounterEvidenceFact,
  ZiweiCompatibilityEvidenceResult,
  ZiweiCompatibilityLimitationFact,
  ZiweiCompatibilityOptions,
  ZiweiCompatibilitySummaryFact,
  ZiweiCrossMutagenPlacement,
  ZiweiPalaceOverlay,
} from './compatibility-evidence';
