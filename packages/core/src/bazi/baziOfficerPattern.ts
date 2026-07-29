import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
  type CompleteBranchFormation,
} from './baziFormationUtils';
import {
  areAdjacentPatternStemColumns,
  collectPatternExposedStemFacts,
  type PatternExposedStemFact,
  type PatternExposedStemPosition,
  type PatternGetTenGodFn,
} from './baziPatternStemFacts';
import { getStemWuxing } from './baziRuleMatcher/helpers';
import type { Pillars } from './baziTypes';
import { getTenGod } from './baziUtils';
import { isKe, isTianGanHe } from '../ganzhi/relations';

export type OfficerExposedStemPosition = PatternExposedStemPosition;
export type OfficerExposedStemFact = PatternExposedStemFact;

export interface OfficerWealthResourcePairFact {
  wealth: OfficerExposedStemFact;
  resource: OfficerExposedStemFact;
}

export interface OfficerKillerCombinationFact {
  killer: OfficerExposedStemFact;
  partner: OfficerExposedStemFact;
  method: '劫财合杀' | '伤官合杀' | '其他十神合杀';
}

export interface OfficerPatternStructureSummary {
  isOfficerPattern: boolean;
  patternName: string;
  exposedStems: OfficerExposedStemFact[];
  officerStems: OfficerExposedStemFact[];
  wealthStems: OfficerExposedStemFact[];
  resourceStems: OfficerExposedStemFact[];
  foodStems: OfficerExposedStemFact[];
  hurtStems: OfficerExposedStemFact[];
  outputStems: OfficerExposedStemFact[];
  killerStems: OfficerExposedStemFact[];
  outputFormations: CompleteBranchFormation[];
  hurtFormations: CompleteBranchFormation[];
  wealthResourceCombinedPairs: OfficerWealthResourcePairFact[];
  wealthResourceControllingPairs: OfficerWealthResourcePairFact[];
  wealthResourceSeparatedPairs: OfficerWealthResourcePairFact[];
  killerCombinations: OfficerKillerCombinationFact[];
  unresolvedKillerStems: OfficerExposedStemFact[];
  hasStackedResources: boolean;
}

type GetTenGodFn = PatternGetTenGodFn;

export function isOfficerPatternName(patternName: string): boolean {
  return ['正官格', '杂气正官格', '正官'].includes(patternName);
}

export function areAdjacentOfficerStemColumns(
  left: OfficerExposedStemFact,
  right: OfficerExposedStemFact,
): boolean {
  return areAdjacentPatternStemColumns(left, right);
}

/**
 * 汇总《子平真诠》正官章可由原局四柱客观闭合的结构事实。
 * 这里只识别明透、完整会局、相邻五合和财克印，不判断强弱、合化或最终成败。
 */
export function analyzeOfficerPatternStructure(
  pillars: Pillars,
  patternName: string,
  formations: CompleteBranchFormation[] = collectCompleteBranchFormations(pillars),
  getTenGodFn: GetTenGodFn = getTenGod,
): OfficerPatternStructureSummary {
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const officerStems = select('正官');
  const wealthStems = select('正财', '偏财');
  const resourceStems = select('正印', '偏印');
  const foodStems = select('食神');
  const hurtStems = select('伤官');
  const outputStems = [...foodStems, ...hurtStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const killerStems = select('七杀');
  const outputFormations = formations.filter((formation) =>
    ['食神', '伤官'].includes(
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), pillars.day.gan),
    ),
  );
  const hurtFormations = outputFormations.filter(
    (formation) =>
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), pillars.day.gan) === '伤官',
  );
  const wealthResourcePairs = wealthStems.flatMap((wealth) =>
    resourceStems.map((resource) => ({ wealth, resource })),
  );
  const wealthResourceCombinedPairs = wealthResourcePairs.filter(
    ({ wealth, resource }) =>
      areAdjacentOfficerStemColumns(wealth, resource) && isTianGanHe(wealth.stem, resource.stem),
  );
  const wealthResourceControllingPairs = wealthResourcePairs.filter(
    ({ wealth, resource }) =>
      areAdjacentOfficerStemColumns(wealth, resource) &&
      !isTianGanHe(wealth.stem, resource.stem) &&
      isKe(getStemWuxing(wealth.stem), getStemWuxing(resource.stem)),
  );
  const wealthResourceSeparatedPairs = wealthResourcePairs.filter(
    (pair) =>
      !wealthResourceCombinedPairs.includes(pair) && !wealthResourceControllingPairs.includes(pair),
  );
  const killerCombinations = killerStems.flatMap((killer) => {
    const partner = exposedStems.find(
      (fact) =>
        fact.position !== killer.position &&
        areAdjacentOfficerStemColumns(killer, fact) &&
        isTianGanHe(killer.stem, fact.stem),
    );
    if (!partner) return [];
    const method =
      partner.tenGod === '劫财'
        ? '劫财合杀'
        : partner.tenGod === '伤官'
          ? '伤官合杀'
          : '其他十神合杀';
    return [{ killer, partner, method } satisfies OfficerKillerCombinationFact];
  });
  const combinedKillerPositions = new Set(
    killerCombinations.map((combination) => combination.killer.position),
  );

  return {
    isOfficerPattern: isOfficerPatternName(patternName),
    patternName,
    exposedStems,
    officerStems,
    wealthStems,
    resourceStems,
    foodStems,
    hurtStems,
    outputStems,
    killerStems,
    outputFormations,
    hurtFormations,
    wealthResourceCombinedPairs,
    wealthResourceControllingPairs,
    wealthResourceSeparatedPairs,
    killerCombinations,
    unresolvedKillerStems: killerStems.filter(
      (killer) => !combinedKillerPositions.has(killer.position),
    ),
    hasStackedResources: resourceStems.length >= 2,
  };
}
