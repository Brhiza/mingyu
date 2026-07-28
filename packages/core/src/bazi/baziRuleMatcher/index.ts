import {
  buildFormationTenGodCategories,
  excludesAll,
  includesAll,
  includesAny,
  includesOrWildcard,
} from './helpers';
import {
  matchForbiddenVisibleStemBranchPairs,
  matchForbiddenVisibleStemDistancePairs,
  matchForbiddenVisibleStemPillarPairs,
  matchOptionalVisibleStemBranchPairs,
  matchOptionalVisibleStemPillarPairs,
  matchRequiredVisibleStemBranchPairs,
  matchRequiredVisibleStemDistancePairs,
  matchRequiredVisibleStemPillarPairs,
} from './stemPairs';
import {
  matchForbiddenBranchPillarPairs,
  matchForbiddenHiddenStemBranchPairs,
  matchOptionalBranchPillarPairs,
  matchOptionalHiddenStemBranchPairs,
  matchRequiredBranchPillarPairs,
  matchRequiredHiddenStemBranchPairs,
} from './branchPairs';
import {
  matchCompanionVisibleCount,
  matchDistinctStemGroupCounts,
  matchMaxStemCounts,
  matchMaxTenGodCategoryHiddenCounts,
  matchMaxTenGodCategoryTotalCounts,
  matchMaxTenGodCategoryTotalDistinctCounts,
  matchMaxTenGodCategoryVisibleCounts,
  matchMaxTenGodCategoryVisibleDistinctCounts,
  matchMaxTotalStemCounts,
  matchMaxVisibleStemCounts,
  matchMaxWuxingCounts,
  matchMinStemCounts,
  matchMinTenGodCategoryHiddenCounts,
  matchMinTenGodCategoryTotalCounts,
  matchMinTenGodCategoryTotalDistinctCounts,
  matchMinTenGodCategoryVisibleCounts,
  matchMinTenGodCategoryVisibleDistinctCounts,
  matchMinTotalStemCounts,
  matchMinVisibleStemCounts,
  matchMinWuxingCounts,
} from './counts';
import type { MatchableRule, RuleMatchContext } from './types';

export type {
  BranchPillarPairRule,
  DistinctStemGroupCountRule,
  HiddenStemBranchPairRule,
  HiddenStemSource,
  MatchableRule,
  RuleMatchContext,
  VisibleStemBranchPairRule,
  VisibleStemDistancePairRule,
  VisibleStemPillarPairRule,
  VisibleStemSource,
} from './types';

export function matchesRule<T extends MatchableRule>(rule: T, context: RuleMatchContext): boolean {
  const formationTenGodCategories = buildFormationTenGodCategories(
    context.dayStem,
    context.formationWuxings,
  );

  return (
    includesOrWildcard(rule.strengths, context.strengthStatus) &&
    includesOrWildcard(rule.yearStems, context.yearStem) &&
    includesOrWildcard(rule.months, context.monthBranch) &&
    includesOrWildcard(rule.hourBranches, context.hourBranch) &&
    includesOrWildcard(rule.dayMasters, context.dayMaster) &&
    includesOrWildcard(rule.dayStems, context.dayStem) &&
    includesOrWildcard(rule.patterns, context.pattern) &&
    includesOrWildcard(rule.currentJieqi, context.currentJieqi) &&
    includesAll(rule.requiredFormationWuxings, context.formationWuxings) &&
    includesAll(rule.requiredFormationTenGodCategories, formationTenGodCategories) &&
    includesAny(rule.optionalFormationTenGodCategories, formationTenGodCategories) &&
    excludesAll(rule.forbiddenFormationTenGodCategories, formationTenGodCategories) &&
    includesAll(rule.requiredVisibleStems, context.visibleStems) &&
    includesAny(rule.optionalVisibleStems, context.visibleStems) &&
    excludesAll(rule.forbiddenVisibleStems, context.visibleStems) &&
    matchRequiredVisibleStemPillarPairs(
      rule.requiredVisibleStemPillarPairs,
      context.visibleStemSources,
    ) &&
    matchOptionalVisibleStemPillarPairs(
      rule.optionalVisibleStemPillarPairs,
      context.visibleStemSources,
    ) &&
    matchForbiddenVisibleStemPillarPairs(
      rule.forbiddenVisibleStemPillarPairs,
      context.visibleStemSources,
    ) &&
    matchRequiredVisibleStemBranchPairs(
      rule.requiredVisibleStemBranchPairs,
      context.visibleStemSources,
      context.hiddenStemSources,
    ) &&
    matchOptionalVisibleStemBranchPairs(
      rule.optionalVisibleStemBranchPairs,
      context.visibleStemSources,
      context.hiddenStemSources,
    ) &&
    matchForbiddenVisibleStemBranchPairs(
      rule.forbiddenVisibleStemBranchPairs,
      context.visibleStemSources,
      context.hiddenStemSources,
    ) &&
    matchRequiredVisibleStemDistancePairs(
      rule.requiredVisibleStemDistancePairs,
      context.visibleStemSources,
    ) &&
    matchForbiddenVisibleStemDistancePairs(
      rule.forbiddenVisibleStemDistancePairs,
      context.visibleStemSources,
    ) &&
    matchMinVisibleStemCounts(rule.minVisibleStemCounts, context.visibleStems) &&
    matchMaxVisibleStemCounts(rule.maxVisibleStemCounts, context.visibleStems) &&
    includesAll(rule.requiredHiddenStems, context.hiddenStems) &&
    includesAny(rule.optionalHiddenStems, context.hiddenStems) &&
    excludesAll(rule.forbiddenHiddenStems, context.hiddenStems) &&
    matchRequiredBranchPillarPairs(rule.requiredBranchPillarPairs, context.hiddenStemSources) &&
    matchOptionalBranchPillarPairs(rule.optionalBranchPillarPairs, context.hiddenStemSources) &&
    matchForbiddenBranchPillarPairs(rule.forbiddenBranchPillarPairs, context.hiddenStemSources) &&
    matchRequiredHiddenStemBranchPairs(
      rule.requiredHiddenStemBranchPairs,
      context.hiddenStemSources,
    ) &&
    matchOptionalHiddenStemBranchPairs(
      rule.optionalHiddenStemBranchPairs,
      context.hiddenStemSources,
    ) &&
    matchForbiddenHiddenStemBranchPairs(
      rule.forbiddenHiddenStemBranchPairs,
      context.hiddenStemSources,
    ) &&
    matchMinStemCounts(rule.minHiddenStemCounts, context.hiddenStems) &&
    matchMaxStemCounts(rule.maxHiddenStemCounts, context.hiddenStems) &&
    matchMinTotalStemCounts(rule.minStemTotalCounts, context.visibleStems, context.hiddenStems) &&
    matchMaxTotalStemCounts(rule.maxStemTotalCounts, context.visibleStems, context.hiddenStems) &&
    matchDistinctStemGroupCounts(
      rule.distinctStemGroupCounts,
      context.visibleStems,
      context.hiddenStems,
    ) &&
    matchCompanionVisibleCount(
      rule.minCompanionVisibleCount,
      rule.maxCompanionVisibleCount,
      context.dayStem,
      context.visibleStems,
    ) &&
    matchMinWuxingCounts(rule.minWuxingCounts, context.wuxingCounts) &&
    matchMaxWuxingCounts(rule.maxWuxingCounts, context.wuxingCounts) &&
    matchMinTenGodCategoryVisibleCounts(
      rule.minTenGodCategoryVisibleCounts,
      context.dayStem,
      context.visibleStems,
    ) &&
    matchMaxTenGodCategoryVisibleCounts(
      rule.maxTenGodCategoryVisibleCounts,
      context.dayStem,
      context.visibleStems,
    ) &&
    matchMinTenGodCategoryHiddenCounts(
      rule.minTenGodCategoryHiddenCounts,
      context.dayStem,
      context.hiddenStems,
    ) &&
    matchMaxTenGodCategoryHiddenCounts(
      rule.maxTenGodCategoryHiddenCounts,
      context.dayStem,
      context.hiddenStems,
    ) &&
    matchMinTenGodCategoryTotalCounts(
      rule.minTenGodCategoryTotalCounts,
      context.dayStem,
      context.visibleStems,
      context.hiddenStems,
    ) &&
    matchMaxTenGodCategoryTotalCounts(
      rule.maxTenGodCategoryTotalCounts,
      context.dayStem,
      context.visibleStems,
      context.hiddenStems,
    ) &&
    matchMinTenGodCategoryVisibleDistinctCounts(
      rule.minTenGodCategoryVisibleDistinctCounts,
      context.dayStem,
      context.visibleStems,
    ) &&
    matchMaxTenGodCategoryVisibleDistinctCounts(
      rule.maxTenGodCategoryVisibleDistinctCounts,
      context.dayStem,
      context.visibleStems,
    ) &&
    matchMinTenGodCategoryTotalDistinctCounts(
      rule.minTenGodCategoryTotalDistinctCounts,
      context.dayStem,
      context.visibleStems,
      context.hiddenStems,
    ) &&
    matchMaxTenGodCategoryTotalDistinctCounts(
      rule.maxTenGodCategoryTotalDistinctCounts,
      context.dayStem,
      context.visibleStems,
      context.hiddenStems,
    )
  );
}

export function matchFirstRule<T extends MatchableRule>(
  rules: T[],
  context: RuleMatchContext,
): T | undefined {
  return rules.find((rule) => matchesRule(rule, context));
}
