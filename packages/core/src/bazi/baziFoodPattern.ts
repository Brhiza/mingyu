import { HIDDEN_STEMS } from './baziDefinitions';
import {
  areAdjacentPatternStemColumns,
  collectPatternExposedStemFacts,
  type PatternExposedStemFact,
  type PatternGetTenGodFn,
} from './baziPatternStemFacts';
import { getStemWuxing } from './baziRuleMatcher/helpers';
import type { Pillars } from './baziTypes';
import { getTenGod } from './baziUtils';
import { isTianGanHe } from '../ganzhi/relations';

export interface FoodPatternWealthRootFact {
  position: keyof Pillars;
  label: string;
  branch: string;
  hiddenWealthStems: string[];
}

export interface FoodPatternKillerCombinationFact {
  killer: PatternExposedStemFact;
  partner: PatternExposedStemFact;
}

export interface FoodPatternWealthFoodKillerOrderFact {
  wealth: PatternExposedStemFact;
  food: PatternExposedStemFact;
  killer: PatternExposedStemFact;
}

export interface FoodPatternStructureSummary {
  isFoodPattern: boolean;
  patternName: string;
  exposedStems: PatternExposedStemFact[];
  foodStems: PatternExposedStemFact[];
  hurtStems: PatternExposedStemFact[];
  wealthStems: PatternExposedStemFact[];
  directWealthStems: PatternExposedStemFact[];
  indirectWealthStems: PatternExposedStemFact[];
  resourceStems: PatternExposedStemFact[];
  officerStems: PatternExposedStemFact[];
  killerStems: PatternExposedStemFact[];
  peerStems: PatternExposedStemFact[];
  monthHiddenFoodStems: string[];
  wealthRootFacts: FoodPatternWealthRootFact[];
  killerCombinations: FoodPatternKillerCombinationFact[];
  wealthFoodKillerOrderFacts: FoodPatternWealthFoodKillerOrderFact[];
  isMetalWaterFood: boolean;
  isSummerWoodFood: boolean;
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

const SUMMER_BRANCHES = new Set(['巳', '午', '未']);

export function isFoodPatternName(patternName: string): boolean {
  return ['食神格', '杂气食神格', '食神'].includes(patternName);
}

/**
 * 汇总《子平真诠》食神格章节可由四柱客观闭合的财根、明透、气候类别与取清组件。
 * 这里只记录固定结构，不以十神数量替代身强、食旺、火炎木焦、食神有气或最终成败。
 */
export function analyzeFoodPatternStructure(
  pillars: Pillars,
  patternName: string,
  getTenGodFn: PatternGetTenGodFn = getTenGod,
): FoodPatternStructureSummary {
  const dayMaster = pillars.day.gan;
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const foodStems = select('食神');
  const hurtStems = select('伤官');
  const directWealthStems = select('正财');
  const indirectWealthStems = select('偏财');
  const wealthStems = [...directWealthStems, ...indirectWealthStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const resourceStems = select('正印', '偏印');
  const officerStems = select('正官');
  const killerStems = select('七杀');
  const peerStems = select('比肩', '劫财');
  const monthHiddenFoodStems = (HIDDEN_STEMS[pillars.month.zhi] ?? []).filter(
    (stem) => getTenGodFn(stem, dayMaster) === '食神',
  );
  const wealthRootFacts = BRANCH_POSITION_LABELS.flatMap(({ position, label }) => {
    const branch = pillars[position].zhi;
    const hiddenWealthStems = (HIDDEN_STEMS[branch] ?? []).filter((stem) =>
      ['正财', '偏财'].includes(getTenGodFn(stem, dayMaster)),
    );
    return hiddenWealthStems.length
      ? [{ position, label, branch, hiddenWealthStems } satisfies FoodPatternWealthRootFact]
      : [];
  });
  const killerCombinations = killerStems.flatMap((killer) =>
    exposedStems.flatMap((partner) =>
      partner.position !== killer.position &&
      areAdjacentPatternStemColumns(killer, partner) &&
      isTianGanHe(killer.stem, partner.stem)
        ? [{ killer, partner } satisfies FoodPatternKillerCombinationFact]
        : [],
    ),
  );
  const wealthFoodKillerOrderFacts = wealthStems.flatMap((wealth) =>
    foodStems.flatMap((food) =>
      killerStems.flatMap((killer) =>
        wealth.columnIndex < food.columnIndex && food.columnIndex < killer.columnIndex
          ? [{ wealth, food, killer } satisfies FoodPatternWealthFoodKillerOrderFact]
          : [],
      ),
    ),
  );
  const isFoodPattern = isFoodPatternName(patternName);

  return {
    isFoodPattern,
    patternName,
    exposedStems,
    foodStems,
    hurtStems,
    wealthStems,
    directWealthStems,
    indirectWealthStems,
    resourceStems,
    officerStems,
    killerStems,
    peerStems,
    monthHiddenFoodStems,
    wealthRootFacts,
    killerCombinations,
    wealthFoodKillerOrderFacts,
    isMetalWaterFood:
      isFoodPattern &&
      getStemWuxing(dayMaster) === '金' &&
      monthHiddenFoodStems.some((stem) => getStemWuxing(stem) === '水'),
    isSummerWoodFood:
      isFoodPattern && getStemWuxing(dayMaster) === '木' && SUMMER_BRANCHES.has(pillars.month.zhi),
  };
}
