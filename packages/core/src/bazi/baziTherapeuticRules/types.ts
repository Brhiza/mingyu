export type ClimateRuleMode = 'reference' | 'within-balance' | 'conditional';

export interface ClimateRuleSource {
  title: string;
  section: string;
  excerpt: string;
  url: string;
}

export interface ClimateRuleEffect {
  /** 作用到的具体天干；没有干级依据的规则不得伪造阴阳功能。 */
  stem: string;
  wuxing: string;
  role: string;
  targetStems?: string[];
  /** 未标主作用时，conditional 规则只能作为参考。 */
  rank?: 'primary' | 'secondary';
}

export interface ClimateRulePolicy {
  mode: ClimateRuleMode;
  source: ClimateRuleSource;
  effects: ClimateRuleEffect[];
}

export interface ClimateRule {
  id: string;
  label: string;
  description: string;
  priority?: number;
  strengths?: string[];
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
  forbiddenFormationWuxings?: string[];
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
  /** 没有 policy 时默认为 reference，不得由 priority 推断覆盖权限。 */
  policy?: ClimateRulePolicy;
  traceHints?: string[];
  /** 提示明确采用的具体天干，用于与本局干级限制核对。 */
  recommendationStems?: string[];
  hint: string;
}

export interface StrengthHintRule {
  id: string;
  label: string;
  description: string;
  priority?: number;
  strengths: string[];
  hint: string;
}

export interface TherapeuticPriorityRule {
  id: string;
  label: string;
  description: string;
  priority?: number;
  months: string[];
  strengths: string[];
  dayMasters?: string[];
  dayStems?: string[];
  useGeneratedElement: boolean;
}
