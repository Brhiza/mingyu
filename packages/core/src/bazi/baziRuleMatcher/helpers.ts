import { BASIC_MAPPINGS } from '../baziDefinitions';

export function getStemWuxing(stem: string): string {
  const stemIndex = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(stem as never);
  if (stemIndex === -1) {
    return '';
  }

  return BASIC_MAPPINGS.STEM_WUXING[stemIndex];
}

export function includesOrWildcard(
  values: string[] | undefined,
  target: string | undefined,
): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!target) {
    return false;
  }

  return values.includes(target);
}

export function includesAll(values: string[] | undefined, targets: string[] | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!targets || targets.length === 0) {
    return false;
  }

  return values.every((value) => targets.includes(value));
}

export function includesAny(values: string[] | undefined, targets: string[] | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!targets || targets.length === 0) {
    return false;
  }

  return values.some((value) => targets.includes(value));
}

export function excludesAll(values: string[] | undefined, targets: string[] | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!targets) {
    return false;
  }

  if (targets.length === 0) {
    return true;
  }

  return values.every((value) => !targets.includes(value));
}

export function getWuxingTenGodCategory(dayStem: string, targetWuxing: string): string {
  const dayWuxing = getStemWuxing(dayStem);

  if (!dayWuxing || !targetWuxing) {
    return '';
  }

  if (targetWuxing === dayWuxing) {
    return '比劫';
  }

  if (BASIC_MAPPINGS.WUXING_SHENG[dayWuxing] === targetWuxing) {
    return '食伤';
  }

  if (BASIC_MAPPINGS.WUXING_KE[dayWuxing] === targetWuxing) {
    return '财星';
  }

  if (BASIC_MAPPINGS.WUXING_KE[targetWuxing] === dayWuxing) {
    return '官杀';
  }

  if (BASIC_MAPPINGS.WUXING_SHENG[targetWuxing] === dayWuxing) {
    return '印星';
  }

  return '';
}

export function getStemTenGodCategory(dayStem: string, targetStem: string): string {
  const dayWuxing = getStemWuxing(dayStem);
  const targetWuxing = getStemWuxing(targetStem);

  if (!dayWuxing || !targetWuxing) {
    return '';
  }

  return getWuxingTenGodCategory(dayStem, targetWuxing);
}

export function buildFormationTenGodCategories(
  dayStem: string | undefined,
  formationWuxings: string[] | undefined,
): string[] | undefined {
  if (!formationWuxings) {
    return undefined;
  }

  if (formationWuxings.length === 0) return [];
  if (!dayStem) return undefined;

  const categories = [
    ...new Set(
      formationWuxings.map((wuxing) => getWuxingTenGodCategory(dayStem, wuxing)).filter(Boolean),
    ),
  ];

  return categories.length > 0 ? categories : undefined;
}

export function buildTenGodCategoryCounts(
  dayStem: string | undefined,
  stems: string[] | undefined,
  excludeDayStemSelf: boolean,
): Record<string, number> | null {
  if (!dayStem || !stems) {
    return null;
  }

  if (stems.length === 0) return {};

  const categoryCounts = stems.reduce<Record<string, number>>((counts, stem) => {
    const category = getStemTenGodCategory(dayStem, stem);
    if (category) {
      counts[category] = (counts[category] || 0) + 1;
    }
    return counts;
  }, {});

  if (excludeDayStemSelf && stems.includes(dayStem) && categoryCounts.比劫) {
    categoryCounts.比劫 = Math.max(categoryCounts.比劫 - 1, 0);
  }

  return categoryCounts;
}

export function mergeCategoryCounts(
  ...countMaps: Array<Record<string, number> | null>
): Record<string, number> | null {
  const validMaps = countMaps.filter((countMap): countMap is Record<string, number> =>
    Boolean(countMap),
  );
  if (validMaps.length === 0) {
    return null;
  }

  return validMaps.reduce<Record<string, number>>((merged, current) => {
    Object.entries(current).forEach(([category, count]) => {
      merged[category] = (merged[category] || 0) + count;
    });
    return merged;
  }, {});
}

export function buildTenGodCategoryDistinctStemSets(
  dayStem: string | undefined,
  stems: string[] | undefined,
  excludeDayStemSelf: boolean,
): Record<string, Set<string>> | null {
  if (!dayStem || !stems) {
    return null;
  }

  if (stems.length === 0) return {};

  const categoryStemSets = stems.reduce<Record<string, Set<string>>>((sets, stem) => {
    if (excludeDayStemSelf && stem === dayStem) {
      return sets;
    }

    const category = getStemTenGodCategory(dayStem, stem);
    if (!category) {
      return sets;
    }

    if (!sets[category]) {
      sets[category] = new Set<string>();
    }
    sets[category].add(stem);
    return sets;
  }, {});

  return categoryStemSets;
}

export function buildTenGodCategoryDistinctStemCounts(
  dayStem: string | undefined,
  stems: string[] | undefined,
  excludeDayStemSelf: boolean,
): Record<string, number> | null {
  const categoryStemSets = buildTenGodCategoryDistinctStemSets(dayStem, stems, excludeDayStemSelf);
  if (!categoryStemSets) {
    return null;
  }

  return Object.entries(categoryStemSets).reduce<Record<string, number>>(
    (counts, [category, stemSet]) => {
      counts[category] = stemSet.size;
      return counts;
    },
    {},
  );
}

export function mergeDistinctCategoryCounts(
  ...setMaps: Array<Record<string, Set<string>> | null>
): Record<string, number> | null {
  const validMaps = setMaps.filter((setMap): setMap is Record<string, Set<string>> =>
    Boolean(setMap),
  );
  if (validMaps.length === 0) {
    return null;
  }

  const categoryStemSets: Record<string, Set<string>> = {};

  validMaps.forEach((setMap) => {
    Object.entries(setMap).forEach(([category, stemSet]) => {
      if (!categoryStemSets[category]) {
        categoryStemSets[category] = new Set<string>();
      }

      stemSet.forEach((stem) => categoryStemSets[category].add(stem));
    });
  });

  return Object.entries(categoryStemSets).reduce<Record<string, number>>(
    (counts, [category, markerSet]) => {
      counts[category] = markerSet.size;
      return counts;
    },
    {},
  );
}
