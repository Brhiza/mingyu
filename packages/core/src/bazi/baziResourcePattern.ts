import { HIDDEN_STEMS } from './baziDefinitions';
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
import type { Pillars } from './baziTypes';
import { getTenGod } from './baziUtils';
import { isTianGanHe } from '../ganzhi/relations';

export interface ResourcePatternStemPairFact {
  left: PatternExposedStemFact;
  right: PatternExposedStemFact;
}

export interface ResourcePatternKillerCombinationFact {
  killer: PatternExposedStemFact;
  partner: PatternExposedStemFact;
}

export interface ResourcePatternWealthRootFact {
  position: keyof Pillars;
  label: string;
  branch: string;
  hiddenWealthStems: string[];
}

export interface ResourcePatternStructureSummary {
  isResourcePattern: boolean;
  patternName: string;
  exposedStems: PatternExposedStemFact[];
  resourceStems: PatternExposedStemFact[];
  officerStems: PatternExposedStemFact[];
  killerStems: PatternExposedStemFact[];
  foodStems: PatternExposedStemFact[];
  hurtStems: PatternExposedStemFact[];
  outputStems: PatternExposedStemFact[];
  wealthStems: PatternExposedStemFact[];
  peerStems: PatternExposedStemFact[];
  robberyStems: PatternExposedStemFact[];
  outputFormations: CompleteBranchFormation[];
  foodFormations: CompleteBranchFormation[];
  hurtFormations: CompleteBranchFormation[];
  wealthRootFacts: ResourcePatternWealthRootFact[];
  resourceFoodCombinedPairs: ResourcePatternStemPairFact[];
  resourceWealthCombinedPairs: ResourcePatternStemPairFact[];
  killerCombinations: ResourcePatternKillerCombinationFact[];
  unresolvedKillerStems: PatternExposedStemFact[];
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

export function isResourcePatternName(patternName: string): boolean {
  return [
    '正印格',
    '偏印格',
    '杂气正印格',
    '杂气偏印格',
    '印格',
    '杂气印格',
    '正印',
    '偏印',
    '印',
  ].includes(patternName);
}

/**
 * 汇总《子平真诠》印格章节可由四柱客观闭合的明透、完整会局、财根与取清组件。
 * 这里只记录固定结构，不以十神数量替代身、印、财的强弱，也不认定五合已经成化；半合与拱局条件不足时不登记。
 */
export function analyzeResourcePatternStructure(
  pillars: Pillars,
  patternName: string,
  formations: CompleteBranchFormation[] = collectCompleteBranchFormations(pillars),
  getTenGodFn: PatternGetTenGodFn = getTenGod,
): ResourcePatternStructureSummary {
  const dayMaster = pillars.day.gan;
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const resourceStems = select('正印', '偏印');
  const officerStems = select('正官');
  const killerStems = select('七杀');
  const foodStems = select('食神');
  const hurtStems = select('伤官');
  const outputStems = [...foodStems, ...hurtStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const wealthStems = select('正财', '偏财');
  const peerStems = select('比肩', '劫财');
  const robberyStems = select('劫财');
  const outputFormations = formations.filter((formation) =>
    ['食神', '伤官'].includes(
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), dayMaster),
    ),
  );
  const foodFormations = outputFormations.filter(
    (formation) =>
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), dayMaster) === '食神',
  );
  const hurtFormations = outputFormations.filter(
    (formation) =>
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), dayMaster) === '伤官',
  );
  const wealthRootFacts = BRANCH_POSITION_LABELS.flatMap(({ position, label }) => {
    const branch = pillars[position].zhi;
    const hiddenWealthStems = (HIDDEN_STEMS[branch] ?? []).filter((stem) =>
      ['正财', '偏财'].includes(getTenGodFn(stem, dayMaster)),
    );
    return hiddenWealthStems.length
      ? [{ position, label, branch, hiddenWealthStems } satisfies ResourcePatternWealthRootFact]
      : [];
  });
  const collectCombinedPairs = (
    leftFacts: PatternExposedStemFact[],
    rightFacts: PatternExposedStemFact[],
  ) =>
    leftFacts.flatMap((left) =>
      rightFacts.flatMap((right) =>
        areAdjacentPatternStemColumns(left, right) && isTianGanHe(left.stem, right.stem)
          ? [{ left, right } satisfies ResourcePatternStemPairFact]
          : [],
      ),
    );
  const resourceFoodCombinedPairs = collectCombinedPairs(resourceStems, foodStems);
  const resourceWealthCombinedPairs = collectCombinedPairs(resourceStems, wealthStems);
  const killerCombinations = killerStems.flatMap((killer) => {
    const partner = exposedStems.find(
      (fact) =>
        fact.position !== killer.position &&
        areAdjacentPatternStemColumns(killer, fact) &&
        isTianGanHe(killer.stem, fact.stem),
    );
    return partner ? [{ killer, partner } satisfies ResourcePatternKillerCombinationFact] : [];
  });
  const combinedKillerPositions = new Set(
    killerCombinations.map((combination) => combination.killer.position),
  );

  return {
    isResourcePattern: isResourcePatternName(patternName),
    patternName,
    exposedStems,
    resourceStems,
    officerStems,
    killerStems,
    foodStems,
    hurtStems,
    outputStems,
    wealthStems,
    peerStems,
    robberyStems,
    outputFormations,
    foodFormations,
    hurtFormations,
    wealthRootFacts,
    resourceFoodCombinedPairs,
    resourceWealthCombinedPairs,
    killerCombinations,
    unresolvedKillerStems: killerStems.filter(
      (killer) => !combinedKillerPositions.has(killer.position),
    ),
  };
}
