export interface RuleMatchContext {
  strengthStatus?: string;
  yearStem?: string;
  monthBranch?: string;
  hourBranch?: string;
  dayMaster?: string;
  dayStem?: string;
  pattern?: string;
  currentJieqi?: string;
  visibleStems?: string[];
  visibleStemSources?: VisibleStemSource[];
  hiddenStems?: string[];
  hiddenStemSources?: HiddenStemSource[];
  formationWuxings?: string[];
  wuxingCounts?: Record<string, number>;
}

export interface DistinctStemGroupCountRule {
  stems: string[];
  minDistinctCount?: number;
  maxDistinctCount?: number;
  scope?: 'visible' | 'hidden' | 'total';
}

export interface HiddenStemSource {
  pillar: 'year' | 'month' | 'day' | 'hour';
  branch: string;
  stems: string[];
}

export interface VisibleStemSource {
  pillar: 'year' | 'month' | 'day' | 'hour';
  stem: string;
}

export interface VisibleStemPillarPairRule {
  stem: string;
  pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
}

export interface VisibleStemBranchPairRule {
  stem: string;
  branch: string;
  pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
}

export interface VisibleStemDistancePairRule {
  stems: [string, string];
  minDistance?: number;
  maxDistance?: number;
  leftPillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  rightPillars?: Array<'year' | 'month' | 'day' | 'hour'>;
}

export interface BranchPillarPairRule {
  branch: string;
  pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
}

export interface HiddenStemBranchPairRule {
  branch: string;
  stem: string;
  pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
}

export interface MatchableRule {
  id: string;
  strengths?: string[];
  yearStems?: string[];
  months?: string[];
  hourBranches?: string[];
  dayMasters?: string[];
  dayStems?: string[];
  patterns?: string[];
  currentJieqi?: string[];
  requiredVisibleStems?: string[];
  optionalVisibleStems?: string[];
  forbiddenVisibleStems?: string[];
  requiredVisibleStemPillarPairs?: VisibleStemPillarPairRule[];
  optionalVisibleStemPillarPairs?: VisibleStemPillarPairRule[];
  forbiddenVisibleStemPillarPairs?: VisibleStemPillarPairRule[];
  requiredVisibleStemBranchPairs?: VisibleStemBranchPairRule[];
  optionalVisibleStemBranchPairs?: VisibleStemBranchPairRule[];
  forbiddenVisibleStemBranchPairs?: VisibleStemBranchPairRule[];
  requiredVisibleStemDistancePairs?: VisibleStemDistancePairRule[];
  forbiddenVisibleStemDistancePairs?: VisibleStemDistancePairRule[];
  minVisibleStemCounts?: Record<string, number>;
  maxVisibleStemCounts?: Record<string, number>;
  requiredHiddenStems?: string[];
  optionalHiddenStems?: string[];
  forbiddenHiddenStems?: string[];
  requiredBranchPillarPairs?: BranchPillarPairRule[];
  optionalBranchPillarPairs?: BranchPillarPairRule[];
  forbiddenBranchPillarPairs?: BranchPillarPairRule[];
  requiredHiddenStemBranchPairs?: HiddenStemBranchPairRule[];
  optionalHiddenStemBranchPairs?: HiddenStemBranchPairRule[];
  forbiddenHiddenStemBranchPairs?: HiddenStemBranchPairRule[];
  minHiddenStemCounts?: Record<string, number>;
  maxHiddenStemCounts?: Record<string, number>;
  minStemTotalCounts?: Record<string, number>;
  maxStemTotalCounts?: Record<string, number>;
  distinctStemGroupCounts?: DistinctStemGroupCountRule[];
  requiredFormationWuxings?: string[];
  requiredFormationTenGodCategories?: string[];
  optionalFormationTenGodCategories?: string[];
  forbiddenFormationTenGodCategories?: string[];
  minCompanionVisibleCount?: number;
  maxCompanionVisibleCount?: number;
  minWuxingCounts?: Record<string, number>;
  maxWuxingCounts?: Record<string, number>;
  minTenGodCategoryVisibleCounts?: Record<string, number>;
  maxTenGodCategoryVisibleCounts?: Record<string, number>;
  minTenGodCategoryHiddenCounts?: Record<string, number>;
  maxTenGodCategoryHiddenCounts?: Record<string, number>;
  minTenGodCategoryTotalCounts?: Record<string, number>;
  maxTenGodCategoryTotalCounts?: Record<string, number>;
  minTenGodCategoryVisibleDistinctCounts?: Record<string, number>;
  maxTenGodCategoryVisibleDistinctCounts?: Record<string, number>;
  minTenGodCategoryTotalDistinctCounts?: Record<string, number>;
  maxTenGodCategoryTotalDistinctCounts?: Record<string, number>;
}
