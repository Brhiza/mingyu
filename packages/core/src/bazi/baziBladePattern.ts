import { HIDDEN_STEMS, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
  type CompleteBranchFormation,
} from './baziFormationUtils';
import {
  collectPatternExposedStemFacts,
  type PatternExposedStemFact,
  type PatternGetTenGodFn,
} from './baziPatternStemFacts';
import type { Pillars } from './baziTypes';
import { getTenGod } from './baziUtils';
import { isTianGanHe } from '../ganzhi/relations';

export interface BladePatternHiddenFact {
  position: keyof Pillars;
  label: string;
  branch: string;
  hiddenStems: string[];
}

export interface BladePatternStemCombinationFact {
  left: PatternExposedStemFact;
  right: PatternExposedStemFact;
}

export interface BladePatternClearingComponentFact {
  method: '伤官制官' | '五合正官';
  officer: PatternExposedStemFact;
  output: PatternExposedStemFact;
}

export interface BladePatternStructureSummary {
  isBladePattern: boolean;
  patternName: string;
  bladeBranch?: string;
  bladeStem?: string;
  exposedStems: PatternExposedStemFact[];
  bladeStems: PatternExposedStemFact[];
  wealthStems: PatternExposedStemFact[];
  resourceStems: PatternExposedStemFact[];
  foodStems: PatternExposedStemFact[];
  hurtStems: PatternExposedStemFact[];
  outputStems: PatternExposedStemFact[];
  officerStems: PatternExposedStemFact[];
  killerStems: PatternExposedStemFact[];
  officerKillerHiddenFacts: BladePatternHiddenFact[];
  wealthHiddenFacts: BladePatternHiddenFact[];
  bladeKillerCombinationFacts: BladePatternStemCombinationFact[];
  resourceOutputCombinationFacts: BladePatternStemCombinationFact[];
  officerOutputCombinationFacts: BladePatternStemCombinationFact[];
  clearingComponents: BladePatternClearingComponentFact[];
  wealthFormationFacts: CompleteBranchFormation[];
  outputFormationFacts: CompleteBranchFormation[];
  fireFormationFacts: CompleteBranchFormation[];
  hasOfficerKillerMixture: boolean;
  isBingWuBlade: boolean;
  isWuWuBlade: boolean;
  hasWuFireTransformationCandidate: boolean;
}

const BRANCH_POSITIONS: Array<{
  position: keyof Pillars;
  label: string;
}> = [
  { position: 'year', label: '年支' },
  { position: 'month', label: '月支' },
  { position: 'day', label: '日支' },
  { position: 'hour', label: '时支' },
];

export function isBladePatternName(patternName: string): boolean {
  return ['月刃格', '阳刃格', '阳刃'].includes(patternName);
}

function collectHiddenFacts(
  pillars: Pillars,
  getTenGodFn: PatternGetTenGodFn,
  tenGods: string[],
): BladePatternHiddenFact[] {
  const dayMaster = pillars.day.gan;
  return BRANCH_POSITIONS.flatMap(({ position, label }) => {
    const branch = pillars[position].zhi;
    const hiddenStems = (HIDDEN_STEMS[branch] ?? []).filter((stem) =>
      tenGods.includes(getTenGodFn(stem, dayMaster)),
    );
    return hiddenStems.length > 0 ? [{ position, label, branch, hiddenStems }] : [];
  });
}

function collectStemCombinations(
  leftFacts: PatternExposedStemFact[],
  rightFacts: PatternExposedStemFact[],
): BladePatternStemCombinationFact[] {
  return leftFacts.flatMap((left) =>
    rightFacts.flatMap((right) => (isTianGanHe(left.stem, right.stem) ? [{ left, right }] : [])),
  );
}

/**
 * 汇总《子平真诠》“论阳刃”能够由四柱客观闭合的真刃、官杀制刃、
 * 透刃五合、财印伤食配合、化刃为印固定结构与用财转生组件。
 * 根深、轻重、合化、贪合忘克、制刃力度及最终成败均须另行复核。
 */
export function analyzeBladePatternStructure(
  pillars: Pillars,
  patternName: string,
  getTenGodFn: PatternGetTenGodFn = getTenGod,
): BladePatternStructureSummary {
  const dayMaster = pillars.day.gan;
  const bladeBranch = REN_BRANCH_MAP[dayMaster];
  const bladeStem = bladeBranch
    ? (HIDDEN_STEMS[bladeBranch] ?? []).find((stem) => getTenGodFn(stem, dayMaster) === '劫财')
    : undefined;
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const bladeStems = bladeStem
    ? exposedStems.filter((fact) => fact.stem === bladeStem && fact.tenGod === '劫财')
    : [];
  const wealthStems = select('正财', '偏财');
  const resourceStems = select('正印', '偏印');
  const foodStems = select('食神');
  const hurtStems = select('伤官');
  const outputStems = [...foodStems, ...hurtStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const officerStems = select('正官');
  const killerStems = select('七杀');
  const officerKillerHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['正官', '七杀']);
  const wealthHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['正财', '偏财']);
  const completeFormations = collectCompleteBranchFormations(pillars);
  const wealthFormationFacts = completeFormations.filter((formation) =>
    ['正财', '偏财'].includes(
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), dayMaster),
    ),
  );
  const outputFormationFacts = completeFormations.filter((formation) =>
    ['食神', '伤官'].includes(
      getTenGodFn(getRepresentativeStemByWuxing(formation.wuxing), dayMaster),
    ),
  );
  const fireFormationFacts = completeFormations.filter(
    (formation) => formation.includesMonthBranch && formation.wuxing === '火',
  );
  const bladeKillerCombinationFacts = collectStemCombinations(bladeStems, killerStems);
  const resourceOutputCombinationFacts = collectStemCombinations(resourceStems, outputStems);
  const officerOutputCombinationFacts = collectStemCombinations(officerStems, outputStems);
  const clearingComponents: BladePatternClearingComponentFact[] = [
    ...hurtStems.flatMap((output) =>
      officerStems.map((officer) => ({
        method: '伤官制官' as const,
        officer,
        output,
      })),
    ),
    ...officerOutputCombinationFacts.map(({ left: officer, right: output }) => ({
      method: '五合正官' as const,
      officer,
      output,
    })),
  ];
  const isBladePattern =
    isBladePatternName(patternName) && Boolean(bladeBranch && pillars.month.zhi === bladeBranch);
  const isBingWuBlade = isBladePattern && dayMaster === '丙' && pillars.month.zhi === '午';
  const isWuWuBlade = isBladePattern && dayMaster === '戊' && pillars.month.zhi === '午';
  const hasWuFireTransformationCandidate =
    isWuWuBlade &&
    exposedStems.some((fact) => fact.stem === '丙' && fact.tenGod === '偏印') &&
    fireFormationFacts.length > 0;

  return {
    isBladePattern,
    patternName,
    bladeBranch,
    bladeStem,
    exposedStems,
    bladeStems,
    wealthStems,
    resourceStems,
    foodStems,
    hurtStems,
    outputStems,
    officerStems,
    killerStems,
    officerKillerHiddenFacts,
    wealthHiddenFacts,
    bladeKillerCombinationFacts,
    resourceOutputCombinationFacts,
    officerOutputCombinationFacts,
    clearingComponents,
    wealthFormationFacts,
    outputFormationFacts,
    fireFormationFacts,
    hasOfficerKillerMixture: officerStems.length > 0 && killerStems.length > 0,
    isBingWuBlade,
    isWuWuBlade,
    hasWuFireTransformationCandidate,
  };
}
