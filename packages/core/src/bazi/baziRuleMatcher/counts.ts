import type { DistinctStemGroupCountRule } from './types';
import {
  buildTenGodCategoryCounts,
  buildTenGodCategoryDistinctStemCounts,
  buildTenGodCategoryDistinctStemSets,
  getStemWuxing,
  mergeCategoryCounts,
  mergeDistinctCategoryCounts,
} from './helpers';

export function matchMinWuxingCounts(
  requiredCounts: Record<string, number> | undefined,
  actualCounts: Record<string, number> | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!actualCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([wuxing, minCount]) => (actualCounts[wuxing] || 0) >= minCount,
  );
}

export function matchMaxWuxingCounts(
  requiredCounts: Record<string, number> | undefined,
  actualCounts: Record<string, number> | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!actualCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([wuxing, maxCount]) => (actualCounts[wuxing] || 0) <= maxCount,
  );
}

export function matchDistinctStemGroupCounts(
  groupRules: DistinctStemGroupCountRule[] | undefined,
  visibleStems: string[] | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!groupRules || groupRules.length === 0) {
    return true;
  }

  return groupRules.every((groupRule) => {
    if (!groupRule.stems || groupRule.stems.length === 0) {
      return true;
    }

    if (groupRule.scope === 'visible' && !visibleStems) return false;
    if (groupRule.scope === 'hidden' && !hiddenStems) return false;
    if (groupRule.scope !== 'visible' && groupRule.scope !== 'hidden') {
      if (!visibleStems || !hiddenStems) return false;
    }

    const sourceStems =
      groupRule.scope === 'visible'
        ? visibleStems!
        : groupRule.scope === 'hidden'
          ? hiddenStems!
          : [...visibleStems!, ...hiddenStems!];

    const distinctCount = new Set(sourceStems.filter((stem) => groupRule.stems.includes(stem)))
      .size;

    if (
      typeof groupRule.minDistinctCount === 'number' &&
      distinctCount < groupRule.minDistinctCount
    ) {
      return false;
    }

    if (
      typeof groupRule.maxDistinctCount === 'number' &&
      distinctCount > groupRule.maxDistinctCount
    ) {
      return false;
    }

    return true;
  });
}

export function matchMinTenGodCategoryVisibleCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  const categoryCounts = buildTenGodCategoryCounts(dayStem, visibleStems, true);
  if (!categoryCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, minCount]) => (categoryCounts[category] || 0) >= minCount,
  );
}

export function matchMaxTenGodCategoryVisibleCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  const categoryCounts = buildTenGodCategoryCounts(dayStem, visibleStems, true);
  if (!categoryCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, maxCount]) => (categoryCounts[category] || 0) <= maxCount,
  );
}

export function matchMinTenGodCategoryHiddenCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  const categoryCounts = buildTenGodCategoryCounts(dayStem, hiddenStems, false);
  if (!categoryCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, minCount]) => (categoryCounts[category] || 0) >= minCount,
  );
}

export function matchMaxTenGodCategoryHiddenCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  const categoryCounts = buildTenGodCategoryCounts(dayStem, hiddenStems, false);
  if (!categoryCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, maxCount]) => (categoryCounts[category] || 0) <= maxCount,
  );
}

export function matchMinTenGodCategoryTotalCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems || !hiddenStems) return false;

  const categoryCounts = mergeCategoryCounts(
    buildTenGodCategoryCounts(dayStem, visibleStems, true),
    buildTenGodCategoryCounts(dayStem, hiddenStems, false),
  );
  if (!categoryCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, minCount]) => (categoryCounts[category] || 0) >= minCount,
  );
}

export function matchMaxTenGodCategoryTotalCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems || !hiddenStems) return false;

  const categoryCounts = mergeCategoryCounts(
    buildTenGodCategoryCounts(dayStem, visibleStems, true),
    buildTenGodCategoryCounts(dayStem, hiddenStems, false),
  );
  if (!categoryCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, maxCount]) => (categoryCounts[category] || 0) <= maxCount,
  );
}

export function matchMinTenGodCategoryVisibleDistinctCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  const distinctCounts = buildTenGodCategoryDistinctStemCounts(dayStem, visibleStems, true);
  if (!distinctCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, minCount]) => (distinctCounts[category] || 0) >= minCount,
  );
}

export function matchMaxTenGodCategoryVisibleDistinctCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  const distinctCounts = buildTenGodCategoryDistinctStemCounts(dayStem, visibleStems, true);
  if (!distinctCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, maxCount]) => (distinctCounts[category] || 0) <= maxCount,
  );
}

export function matchMinTenGodCategoryTotalDistinctCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems || !hiddenStems) return false;

  const distinctCounts = mergeDistinctCategoryCounts(
    buildTenGodCategoryDistinctStemSets(dayStem, visibleStems, true),
    buildTenGodCategoryDistinctStemSets(dayStem, hiddenStems, false),
  );
  if (!distinctCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, minCount]) => (distinctCounts[category] || 0) >= minCount,
  );
}

export function matchMaxTenGodCategoryTotalDistinctCounts(
  requiredCounts: Record<string, number> | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems || !hiddenStems) return false;

  const distinctCounts = mergeDistinctCategoryCounts(
    buildTenGodCategoryDistinctStemSets(dayStem, visibleStems, true),
    buildTenGodCategoryDistinctStemSets(dayStem, hiddenStems, false),
  );
  if (!distinctCounts) {
    return false;
  }

  return Object.entries(requiredCounts).every(
    ([category, maxCount]) => (distinctCounts[category] || 0) <= maxCount,
  );
}

export function matchMinVisibleStemCounts(
  requiredCounts: Record<string, number> | undefined,
  visibleStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems || visibleStems.length === 0) {
    return false;
  }

  const stemCounts = visibleStems.reduce<Record<string, number>>((counts, stem) => {
    counts[stem] = (counts[stem] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(requiredCounts).every(
    ([stem, minCount]) => (stemCounts[stem] || 0) >= minCount,
  );
}

export function matchMinTotalStemCounts(
  requiredCounts: Record<string, number> | undefined,
  visibleStems: string[] | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems || !hiddenStems) return false;

  const stemCounts = [...(visibleStems || []), ...(hiddenStems || [])].reduce<
    Record<string, number>
  >((counts, stem) => {
    counts[stem] = (counts[stem] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(requiredCounts).every(
    ([stem, minCount]) => (stemCounts[stem] || 0) >= minCount,
  );
}

export function matchMaxTotalStemCounts(
  requiredCounts: Record<string, number> | undefined,
  visibleStems: string[] | undefined,
  hiddenStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems || !hiddenStems) {
    return false;
  }

  const stemCounts = [...(visibleStems || []), ...(hiddenStems || [])].reduce<
    Record<string, number>
  >((counts, stem) => {
    counts[stem] = (counts[stem] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(requiredCounts).every(
    ([stem, maxCount]) => (stemCounts[stem] || 0) <= maxCount,
  );
}

export function matchMaxVisibleStemCounts(
  requiredCounts: Record<string, number> | undefined,
  visibleStems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!visibleStems) {
    return false;
  }

  const stemCounts = visibleStems.reduce<Record<string, number>>((counts, stem) => {
    counts[stem] = (counts[stem] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(requiredCounts).every(
    ([stem, maxCount]) => (stemCounts[stem] || 0) <= maxCount,
  );
}

export function matchMinStemCounts(
  requiredCounts: Record<string, number> | undefined,
  stems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!stems || stems.length === 0) {
    return false;
  }

  const stemCounts = stems.reduce<Record<string, number>>((counts, stem) => {
    counts[stem] = (counts[stem] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(requiredCounts).every(
    ([stem, minCount]) => (stemCounts[stem] || 0) >= minCount,
  );
}

export function matchMaxStemCounts(
  requiredCounts: Record<string, number> | undefined,
  stems: string[] | undefined,
): boolean {
  if (!requiredCounts || Object.keys(requiredCounts).length === 0) {
    return true;
  }

  if (!stems) return false;

  const stemCounts = stems.reduce<Record<string, number>>((counts, stem) => {
    counts[stem] = (counts[stem] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(requiredCounts).every(
    ([stem, maxCount]) => (stemCounts[stem] || 0) <= maxCount,
  );
}

function countExtraCompanionVisible(
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
): number | null {
  if (!dayStem || !visibleStems || visibleStems.length === 0) {
    return null;
  }

  const dayWuxing = getStemWuxing(dayStem);
  if (!dayWuxing) {
    return null;
  }

  const sameWuxingCount = visibleStems.filter((stem) => getStemWuxing(stem) === dayWuxing).length;
  const sameDayStemCount = visibleStems.filter((stem) => stem === dayStem).length;

  return Math.max(sameDayStemCount - 1, 0) + (sameWuxingCount - sameDayStemCount);
}

export function matchCompanionVisibleCount(
  minCount: number | undefined,
  maxCount: number | undefined,
  dayStem: string | undefined,
  visibleStems: string[] | undefined,
): boolean {
  if (typeof minCount !== 'number' && typeof maxCount !== 'number') {
    return true;
  }

  const companionCount = countExtraCompanionVisible(dayStem, visibleStems);
  if (companionCount === null) {
    return false;
  }

  if (typeof minCount === 'number' && companionCount < minCount) {
    return false;
  }

  if (typeof maxCount === 'number' && companionCount > maxCount) {
    return false;
  }

  return true;
}
