import { HIDDEN_STEMS } from './baziDefinitions';
import {
  collectPatternExposedStemFacts,
  type PatternExposedStemFact,
  type PatternGetTenGodFn,
} from './baziPatternStemFacts';
import type { Pillars } from './baziTypes';
import { getTenGod } from './baziUtils';
import { isLiuchong, isLiuhe } from '../ganzhi/relations';

export type KillerPatternStemOrder = 'left-before-right' | 'right-before-left' | 'interleaved';

export interface KillerPatternHiddenFact {
  position: keyof Pillars;
  label: string;
  branch: string;
  hiddenStems: string[];
}

export interface KillerPatternBranchPairFact {
  leftPosition: keyof Pillars;
  leftLabel: string;
  leftBranch: string;
  rightPosition: keyof Pillars;
  rightLabel: string;
  rightBranch: string;
}

export interface KillerPatternStructureSummary {
  isKillerPattern: boolean;
  isMixedKillerPattern: boolean;
  patternName: string;
  exposedStems: PatternExposedStemFact[];
  foodStems: PatternExposedStemFact[];
  hurtStems: PatternExposedStemFact[];
  outputStems: PatternExposedStemFact[];
  wealthStems: PatternExposedStemFact[];
  resourceStems: PatternExposedStemFact[];
  officerStems: PatternExposedStemFact[];
  killerStems: PatternExposedStemFact[];
  peerStems: PatternExposedStemFact[];
  monthHiddenKillerStems: string[];
  monthHiddenResourceStems: string[];
  killerStemsFromMonth: PatternExposedStemFact[];
  resourceStemsFromMonth: PatternExposedStemFact[];
  killerResourceShareMonth: boolean;
  resourceHiddenFacts: KillerPatternHiddenFact[];
  outputHiddenFacts: KillerPatternHiddenFact[];
  wealthOutputOrder?: KillerPatternStemOrder;
  resourceOutputOrder?: KillerPatternStemOrder;
  clashingOutputFacts: KillerPatternHiddenFact[];
  branchCombinationFacts: KillerPatternBranchPairFact[];
  hasOfficerKillerMixture: boolean;
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

export function isKillerPatternName(patternName: string): boolean {
  return ['七杀格', '杂气七杀格', '七杀', '偏官格', '杂气偏官格', '偏官'].includes(patternName);
}

function getStemOrder(
  left: PatternExposedStemFact[],
  right: PatternExposedStemFact[],
): KillerPatternStemOrder | undefined {
  if (left.length === 0 || right.length === 0) return undefined;
  const leftIndexes = left.map((fact) => fact.columnIndex);
  const rightIndexes = right.map((fact) => fact.columnIndex);
  if (Math.max(...leftIndexes) < Math.min(...rightIndexes)) return 'left-before-right';
  if (Math.max(...rightIndexes) < Math.min(...leftIndexes)) return 'right-before-left';
  return 'interleaved';
}

function collectHiddenFacts(
  pillars: Pillars,
  getTenGodFn: PatternGetTenGodFn,
  tenGods: string[],
): KillerPatternHiddenFact[] {
  const dayMaster = pillars.day.gan;
  return BRANCH_POSITIONS.flatMap(({ position, label }) => {
    const branch = pillars[position].zhi;
    const hiddenStems = (HIDDEN_STEMS[branch] ?? []).filter((stem) =>
      tenGods.includes(getTenGodFn(stem, dayMaster)),
    );
    return hiddenStems.length > 0 ? [{ position, label, branch, hiddenStems }] : [];
  });
}

/**
 * 汇总《子平真诠》七杀格章节能够由四柱客观闭合的明透、月令藏干、先后、
 * 官杀取清组件与地支固定关系。这里只记录结构，不以数量替代强弱，也不认定合化或最终成败。
 */
export function analyzeKillerPatternStructure(
  pillars: Pillars,
  patternName: string,
  getTenGodFn: PatternGetTenGodFn = getTenGod,
): KillerPatternStructureSummary {
  const dayMaster = pillars.day.gan;
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const foodStems = select('食神');
  const hurtStems = select('伤官');
  const outputStems = [...foodStems, ...hurtStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const wealthStems = select('正财', '偏财');
  const resourceStems = select('正印', '偏印');
  const officerStems = select('正官');
  const killerStems = select('七杀');
  const peerStems = select('比肩', '劫财');
  const monthHiddenStems = HIDDEN_STEMS[pillars.month.zhi] ?? [];
  const monthHiddenKillerStems = monthHiddenStems.filter(
    (stem) => getTenGodFn(stem, dayMaster) === '七杀',
  );
  const monthHiddenResourceStems = monthHiddenStems.filter((stem) =>
    ['正印', '偏印'].includes(getTenGodFn(stem, dayMaster)),
  );
  const killerStemsFromMonth = killerStems.filter((fact) =>
    monthHiddenKillerStems.includes(fact.stem),
  );
  const resourceStemsFromMonth = resourceStems.filter((fact) =>
    monthHiddenResourceStems.includes(fact.stem),
  );
  const resourceHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['正印', '偏印']);
  const outputHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['食神', '伤官']);
  const clashingOutputFacts = outputHiddenFacts.filter(
    (fact) => fact.position !== 'month' && isLiuchong(pillars.month.zhi, fact.branch),
  );
  const branchCombinationFacts = BRANCH_POSITIONS.flatMap((left, leftIndex) =>
    BRANCH_POSITIONS.slice(leftIndex + 1).flatMap((right) => {
      const leftBranch = pillars[left.position].zhi;
      const rightBranch = pillars[right.position].zhi;
      return isLiuhe(leftBranch, rightBranch)
        ? [
            {
              leftPosition: left.position,
              leftLabel: left.label,
              leftBranch,
              rightPosition: right.position,
              rightLabel: right.label,
              rightBranch,
            },
          ]
        : [];
    }),
  );
  const isKillerPattern = isKillerPatternName(patternName);

  return {
    isKillerPattern,
    isMixedKillerPattern: patternName === '杂气七杀格' || patternName === '杂气偏官格',
    patternName,
    exposedStems,
    foodStems,
    hurtStems,
    outputStems,
    wealthStems,
    resourceStems,
    officerStems,
    killerStems,
    peerStems,
    monthHiddenKillerStems,
    monthHiddenResourceStems,
    killerStemsFromMonth,
    resourceStemsFromMonth,
    killerResourceShareMonth: killerStemsFromMonth.length > 0 && resourceStemsFromMonth.length > 0,
    resourceHiddenFacts,
    outputHiddenFacts,
    wealthOutputOrder: getStemOrder(wealthStems, outputStems),
    resourceOutputOrder: getStemOrder(resourceStems, outputStems),
    clashingOutputFacts,
    branchCombinationFacts,
    hasOfficerKillerMixture:
      officerStems.length > 0 && (killerStems.length > 0 || monthHiddenKillerStems.length > 0),
  };
}
