import type { MatchableRule, RuleMatchContext } from './types';

type ConditionKey = Exclude<keyof MatchableRule, 'id' | 'priority' | 'distinctStemGroupCounts'>;

const CONDITION_INPUTS: Record<ConditionKey, readonly (keyof RuleMatchContext)[]> = {
  strengths: ['strengthStatus'],
  yearStems: ['yearStem'],
  months: ['monthBranch'],
  hourBranches: ['hourBranch'],
  dayMasters: ['dayMaster'],
  dayStems: ['dayStem'],
  patterns: ['pattern'],
  currentJieqi: ['currentJieqi'],
  requiredVisibleStems: ['visibleStems'],
  optionalVisibleStems: ['visibleStems'],
  forbiddenVisibleStems: ['visibleStems'],
  requiredVisibleStemPillarPairs: ['visibleStemSources'],
  optionalVisibleStemPillarPairs: ['visibleStemSources'],
  forbiddenVisibleStemPillarPairs: ['visibleStemSources'],
  requiredVisibleStemBranchPairs: ['visibleStemSources', 'hiddenStemSources'],
  optionalVisibleStemBranchPairs: ['visibleStemSources', 'hiddenStemSources'],
  forbiddenVisibleStemBranchPairs: ['visibleStemSources', 'hiddenStemSources'],
  requiredVisibleStemDistancePairs: ['visibleStemSources'],
  forbiddenVisibleStemDistancePairs: ['visibleStemSources'],
  minVisibleStemCounts: ['visibleStems'],
  maxVisibleStemCounts: ['visibleStems'],
  requiredHiddenStems: ['hiddenStems'],
  optionalHiddenStems: ['hiddenStems'],
  forbiddenHiddenStems: ['hiddenStems'],
  requiredBranchPillarPairs: ['hiddenStemSources'],
  optionalBranchPillarPairs: ['hiddenStemSources'],
  forbiddenBranchPillarPairs: ['hiddenStemSources'],
  requiredHiddenStemBranchPairs: ['hiddenStemSources'],
  optionalHiddenStemBranchPairs: ['hiddenStemSources'],
  forbiddenHiddenStemBranchPairs: ['hiddenStemSources'],
  minHiddenStemCounts: ['hiddenStems'],
  maxHiddenStemCounts: ['hiddenStems'],
  minStemTotalCounts: ['visibleStems', 'hiddenStems'],
  maxStemTotalCounts: ['visibleStems', 'hiddenStems'],
  requiredFormationWuxings: ['formationWuxings'],
  forbiddenFormationWuxings: ['formationWuxings'],
  requiredFormationTenGodCategories: ['dayStem', 'formationWuxings'],
  optionalFormationTenGodCategories: ['dayStem', 'formationWuxings'],
  forbiddenFormationTenGodCategories: ['dayStem', 'formationWuxings'],
  minCompanionVisibleCount: ['dayStem', 'visibleStems'],
  maxCompanionVisibleCount: ['dayStem', 'visibleStems'],
  minWuxingCounts: ['wuxingCounts'],
  maxWuxingCounts: ['wuxingCounts'],
  minTenGodCategoryVisibleCounts: ['dayStem', 'visibleStems'],
  maxTenGodCategoryVisibleCounts: ['dayStem', 'visibleStems'],
  minTenGodCategoryHiddenCounts: ['dayStem', 'hiddenStems'],
  maxTenGodCategoryHiddenCounts: ['dayStem', 'hiddenStems'],
  minTenGodCategoryTotalCounts: ['dayStem', 'visibleStems', 'hiddenStems'],
  maxTenGodCategoryTotalCounts: ['dayStem', 'visibleStems', 'hiddenStems'],
  minTenGodCategoryVisibleDistinctCounts: ['dayStem', 'visibleStems'],
  maxTenGodCategoryVisibleDistinctCounts: ['dayStem', 'visibleStems'],
  minTenGodCategoryTotalDistinctCounts: ['dayStem', 'visibleStems', 'hiddenStems'],
  maxTenGodCategoryTotalDistinctCounts: ['dayStem', 'visibleStems', 'hiddenStems'],
};

/** 空数组表示已核查未见；未提供字段表示尚无证据，二者不可混同。 */
export function getMissingRuleInputs(
  rule: MatchableRule,
  context: RuleMatchContext,
): (keyof RuleMatchContext)[] {
  const required = new Set<keyof RuleMatchContext>();
  for (const key of Object.keys(CONDITION_INPUTS) as ConditionKey[]) {
    const condition = rule[key];
    if (condition === undefined) continue;
    if (typeof condition === 'object' && Object.keys(condition).length === 0) continue;
    for (const input of CONDITION_INPUTS[key]) required.add(input);
  }
  for (const group of rule.distinctStemGroupCounts ?? []) {
    if (group.scope !== 'hidden') required.add('visibleStems');
    if (group.scope !== 'visible') required.add('hiddenStems');
  }
  return [...required].filter((key) => context[key] === undefined);
}
