import { HIDDEN_STEMS, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
  type CompleteBranchFormation,
} from './baziFormationUtils';
import {
  areAdjacentPatternStemColumns,
  collectPatternExposedStemFacts,
  type PatternExposedStemFact,
  type PatternGetTenGodFn,
} from './baziPatternStemFacts';
import { getStemWuxing } from './baziRuleMatcher/helpers';
import type { Pillars } from './baziTypes';
import { getTenGod } from './baziUtils';
import { isKe, isTianGanHe } from '../ganzhi/relations';

export interface WealthPatternStemPairFact {
  left: PatternExposedStemFact;
  right: PatternExposedStemFact;
}

export interface WealthPatternKillerCombinationFact {
  killer: PatternExposedStemFact;
  partner: PatternExposedStemFact;
}

export interface WealthPatternRootFact {
  position: keyof Pillars;
  label: string;
  branch: string;
  hiddenWealthStems: string[];
}

export interface WealthPatternStructureSummary {
  isWealthPattern: boolean;
  patternName: string;
  exposedStems: PatternExposedStemFact[];
  wealthStems: PatternExposedStemFact[];
  resourceStems: PatternExposedStemFact[];
  foodStems: PatternExposedStemFact[];
  hurtStems: PatternExposedStemFact[];
  outputStems: PatternExposedStemFact[];
  officerStems: PatternExposedStemFact[];
  killerStems: PatternExposedStemFact[];
  peerStems: PatternExposedStemFact[];
  robberyStems: PatternExposedStemFact[];
  foodFormations: CompleteBranchFormation[];
  hurtFormations: CompleteBranchFormation[];
  wealthRootFacts: WealthPatternRootFact[];
  monthHiddenStems: string[];
  monthHiddenWealthStems: string[];
  monthHiddenOfficerStems: string[];
  monthHiddenKillerStems: string[];
  exposedMonthHiddenStems: string[];
  wealthResourceCombinedPairs: WealthPatternStemPairFact[];
  wealthResourceControllingPairs: WealthPatternStemPairFact[];
  wealthResourceUnimpededPairs: WealthPatternStemPairFact[];
  foodResourceTwoSeparatorPairs: WealthPatternStemPairFact[];
  foodResourceCloserPairs: WealthPatternStemPairFact[];
  killerCombinations: WealthPatternKillerCombinationFact[];
  unresolvedKillerStems: PatternExposedStemFact[];
  bladeBranch?: string;
  hasBladeBranch: boolean;
}

const BRANCH_POSITION_LABELS: Array<{
  position: keyof Pillars;
  label: string;
}> = [
  { position: 'year', label: '年支' },
  { position: 'month', label: '月支' },
  { position: 'day', label: '日支' },
  { position: 'hour', label: '时支' },
];

export function isWealthPatternName(patternName: string): boolean {
  return [
    '正财格',
    '偏财格',
    '杂气正财格',
    '杂气偏财格',
    '财格',
    '杂气财格',
    '正财',
    '偏财',
    '财',
  ].includes(patternName);
}

/**
 * 汇总《子平真诠》财格章节可由四柱客观闭合的明透、根气、位置和取清组件。
 * 这里只记录固定结构，不以数量替代根深、财旺、身强、印强弱或最终成败。
 */
export function analyzeWealthPatternStructure(
  pillars: Pillars,
  patternName: string,
  formations: CompleteBranchFormation[] = collectCompleteBranchFormations(pillars),
  getTenGodFn: PatternGetTenGodFn = getTenGod,
): WealthPatternStructureSummary {
  const dayMaster = pillars.day.gan;
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const wealthStems = select('正财', '偏财');
  const resourceStems = select('正印', '偏印');
  const foodStems = select('食神');
  const hurtStems = select('伤官');
  const outputStems = [...foodStems, ...hurtStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const officerStems = select('正官');
  const killerStems = select('七杀');
  const peerStems = select('比肩', '劫财');
  const robberyStems = select('劫财');
  const foodFormations = formations.filter(
    (formation) =>
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), dayMaster) === '食神',
  );
  const hurtFormations = formations.filter(
    (formation) =>
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), dayMaster) === '伤官',
  );
  const wealthRootFacts = BRANCH_POSITION_LABELS.flatMap(({ position, label }) => {
    const branch = pillars[position].zhi;
    const hiddenWealthStems = (HIDDEN_STEMS[branch] ?? []).filter((stem) =>
      ['正财', '偏财'].includes(getTenGodFn(stem, dayMaster)),
    );
    return hiddenWealthStems.length
      ? [{ position, label, branch, hiddenWealthStems } satisfies WealthPatternRootFact]
      : [];
  });
  const monthHiddenStems = HIDDEN_STEMS[pillars.month.zhi] ?? [];
  const visibleStemSymbols = new Set(exposedStems.map((fact) => fact.stem));
  const monthHiddenWealthStems = monthHiddenStems.filter((stem) =>
    ['正财', '偏财'].includes(getTenGodFn(stem, dayMaster)),
  );
  const monthHiddenOfficerStems = monthHiddenStems.filter(
    (stem) => getTenGodFn(stem, dayMaster) === '正官',
  );
  const monthHiddenKillerStems = monthHiddenStems.filter(
    (stem) => getTenGodFn(stem, dayMaster) === '七杀',
  );
  const exposedMonthHiddenStems = monthHiddenStems.filter((stem) => visibleStemSymbols.has(stem));
  const wealthResourcePairs = wealthStems.flatMap((wealth) =>
    resourceStems.map((resource) => ({ left: wealth, right: resource })),
  );
  const wealthResourceCombinedPairs = wealthResourcePairs.filter(
    ({ left, right }) =>
      areAdjacentPatternStemColumns(left, right) && isTianGanHe(left.stem, right.stem),
  );
  const wealthResourceControllingPairs = wealthResourcePairs.filter(
    ({ left, right }) =>
      areAdjacentPatternStemColumns(left, right) &&
      !isTianGanHe(left.stem, right.stem) &&
      isKe(getStemWuxing(left.stem), getStemWuxing(right.stem)),
  );
  const wealthResourceUnimpededPairs = wealthResourcePairs.filter(
    (pair) =>
      !wealthResourceCombinedPairs.includes(pair) && !wealthResourceControllingPairs.includes(pair),
  );
  const foodResourcePairs = foodStems.flatMap((food) =>
    resourceStems.map((resource) => ({ left: food, right: resource })),
  );
  const foodResourceTwoSeparatorPairs = foodResourcePairs.filter(
    ({ left, right }) => Math.abs(left.columnIndex - right.columnIndex) === 3,
  );
  const foodResourceCloserPairs = foodResourcePairs.filter(
    (pair) => !foodResourceTwoSeparatorPairs.includes(pair),
  );
  const killerCombinations = killerStems.flatMap((killer) => {
    const partner = exposedStems.find(
      (fact) =>
        fact.position !== killer.position &&
        areAdjacentPatternStemColumns(killer, fact) &&
        isTianGanHe(killer.stem, fact.stem),
    );
    return partner ? [{ killer, partner } satisfies WealthPatternKillerCombinationFact] : [];
  });
  const combinedKillerPositions = new Set(
    killerCombinations.map((combination) => combination.killer.position),
  );
  const bladeBranch = REN_BRANCH_MAP[dayMaster];

  return {
    isWealthPattern: isWealthPatternName(patternName),
    patternName,
    exposedStems,
    wealthStems,
    resourceStems,
    foodStems,
    hurtStems,
    outputStems,
    officerStems,
    killerStems,
    peerStems,
    robberyStems,
    foodFormations,
    hurtFormations,
    wealthRootFacts,
    monthHiddenStems,
    monthHiddenWealthStems,
    monthHiddenOfficerStems,
    monthHiddenKillerStems,
    exposedMonthHiddenStems,
    wealthResourceCombinedPairs,
    wealthResourceControllingPairs,
    wealthResourceUnimpededPairs,
    foodResourceTwoSeparatorPairs,
    foodResourceCloserPairs,
    killerCombinations,
    unresolvedKillerStems: killerStems.filter(
      (killer) => !combinedKillerPositions.has(killer.position),
    ),
    bladeBranch,
    hasBladeBranch: Boolean(
      bladeBranch && Object.values(pillars).some((pillar) => pillar.zhi === bladeBranch),
    ),
  };
}
