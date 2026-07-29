export interface ClimateRule {
  id: string;
  requiresExternalPatternEligibility?: boolean;
  label: string;
  description: string;
  yearStems?: string[];
  months: string[];
  hourBranches?: string[];
  dayMasters: string[];
  dayStems?: string[];
  currentJieqi?: string[];
  requiredVisibleStems?: string[];
  optionalVisibleStems?: string[];
  forbiddenVisibleStems?: string[];
  requiredVisibleStemPillarPairs?: Array<{
    stem: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  optionalVisibleStemPillarPairs?: Array<{
    stem: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  forbiddenVisibleStemPillarPairs?: Array<{
    stem: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  requiredVisibleStemBranchPairs?: Array<{
    stem: string;
    branch: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  optionalVisibleStemBranchPairs?: Array<{
    stem: string;
    branch: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  forbiddenVisibleStemBranchPairs?: Array<{
    stem: string;
    branch: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  requiredVisibleStemDistancePairs?: Array<{
    stems: [string, string];
    minDistance?: number;
    maxDistance?: number;
    leftPillars?: Array<'year' | 'month' | 'day' | 'hour'>;
    rightPillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  forbiddenVisibleStemDistancePairs?: Array<{
    stems: [string, string];
    minDistance?: number;
    maxDistance?: number;
    leftPillars?: Array<'year' | 'month' | 'day' | 'hour'>;
    rightPillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  minVisibleStemCounts?: Record<string, number>;
  maxVisibleStemCounts?: Record<string, number>;
  requiredHiddenStems?: string[];
  optionalHiddenStems?: string[];
  forbiddenHiddenStems?: string[];
  requiredBranchPillarPairs?: Array<{
    branch: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  optionalBranchPillarPairs?: Array<{
    branch: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  forbiddenBranchPillarPairs?: Array<{
    branch: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  requiredHiddenStemBranchPairs?: Array<{
    branch: string;
    stem: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  optionalHiddenStemBranchPairs?: Array<{
    branch: string;
    stem: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  forbiddenHiddenStemBranchPairs?: Array<{
    branch: string;
    stem: string;
    pillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  }>;
  minHiddenStemCounts?: Record<string, number>;
  maxHiddenStemCounts?: Record<string, number>;
  minStemTotalCounts?: Record<string, number>;
  maxStemTotalCounts?: Record<string, number>;
  distinctStemGroupCounts?: Array<{
    stems: string[];
    minDistinctCount?: number;
    maxDistinctCount?: number;
    scope?: 'visible' | 'hidden' | 'total';
  }>;
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
  usefulWuxing: string;
  favorableOrder?: string[];
  traceHints?: string[];
  hint: string;
}

export interface StrengthHintRule {
  id: string;
  label: string;
  description: string;
  strengths: string[];
  hint: string;
}

export interface TherapeuticPriorityRule {
  id: string;
  label: string;
  description: string;
  months: string[];
  strengths: string[];
  dayMasters?: string[];
  dayStems?: string[];
  useGeneratedElement: boolean;
}
