import { HIDDEN_STEMS } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
} from './baziFormationUtils';
import {
  areAdjacentPatternStemColumns,
  collectPatternExposedStemFacts,
  type PatternExposedStemFact,
  type PatternGetTenGodFn,
} from './baziPatternStemFacts';
import { getStemWuxing } from './baziRuleMatcher/helpers';
import type { Pillars, Wuxing } from './baziTypes';
import { getTenGod } from './baziUtils';
import { LIUHE_MAP, LIUHE_WUXING, isTianGanHe } from '../ganzhi/relations';

export interface HurtPatternHiddenFact {
  position: keyof Pillars;
  label: string;
  branch: string;
  hiddenStems: string[];
}

export interface HurtPatternBranchTransformationFact {
  type: '三合' | '三会' | '六合';
  branches: string[];
  wuxing: Wuxing;
}

export interface HurtPatternWealthResourcePairFact {
  wealth: PatternExposedStemFact;
  resource: PatternExposedStemFact;
  isAdjacent: boolean;
}

export interface HurtPatternClearingComponentFact {
  method: '伤官制官' | '五合正官' | '五合七杀';
  target: PatternExposedStemFact;
  partner: PatternExposedStemFact;
}

export interface HurtPatternStructureSummary {
  isHurtPattern: boolean;
  isMixedHurtPattern: boolean;
  patternName: string;
  exposedStems: PatternExposedStemFact[];
  hurtStems: PatternExposedStemFact[];
  wealthStems: PatternExposedStemFact[];
  resourceStems: PatternExposedStemFact[];
  directResourceStems: PatternExposedStemFact[];
  indirectResourceStems: PatternExposedStemFact[];
  officerStems: PatternExposedStemFact[];
  killerStems: PatternExposedStemFact[];
  monthHiddenHurtStems: string[];
  monthHiddenWealthStems: string[];
  resourceHiddenFacts: HurtPatternHiddenFact[];
  wealthHiddenFacts: HurtPatternHiddenFact[];
  hurtWealthShareMonth: boolean;
  wealthTransformationFacts: HurtPatternBranchTransformationFact[];
  wealthResourcePairs: HurtPatternWealthResourcePairFact[];
  hasAdjacentWealthResourceConflict: boolean;
  hasSeparatedWealthResources: boolean;
  hasMixedResources: boolean;
  hasOfficerKillerMixture: boolean;
  clearingComponents: HurtPatternClearingComponentFact[];
  isMetalWaterHurt: boolean;
  isSummerWoodHurt: boolean;
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

const SUMMER_BRANCHES = new Set(['巳', '午', '未']);

export function isHurtPatternName(patternName: string): boolean {
  return ['伤官格', '杂气伤官格', '伤官'].includes(patternName);
}

function collectHiddenFacts(
  pillars: Pillars,
  getTenGodFn: PatternGetTenGodFn,
  tenGods: string[],
): HurtPatternHiddenFact[] {
  const dayMaster = pillars.day.gan;
  return BRANCH_POSITIONS.flatMap(({ position, label }) => {
    const branch = pillars[position].zhi;
    const hiddenStems = (HIDDEN_STEMS[branch] ?? []).filter((stem) =>
      tenGods.includes(getTenGodFn(stem, dayMaster)),
    );
    return hiddenStems.length > 0 ? [{ position, label, branch, hiddenStems }] : [];
  });
}

function collectWealthTransformationFacts(
  pillars: Pillars,
  getTenGodFn: PatternGetTenGodFn,
  monthHiddenHurtStems: string[],
): HurtPatternBranchTransformationFact[] {
  if (monthHiddenHurtStems.length === 0) return [];

  const dayMaster = pillars.day.gan;
  const monthBranch = pillars.month.zhi;
  const uniqueBranches = [...new Set(Object.values(pillars).map((pillar) => pillar.zhi))];
  const isWealthWuxing = (wuxing: Wuxing) =>
    ['正财', '偏财'].includes(getTenGodFn(getRepresentativeStemByWuxing(wuxing), dayMaster));
  const completeFacts = collectCompleteBranchFormations(pillars).flatMap((formation) =>
    formation.includesMonthBranch && isWealthWuxing(formation.wuxing)
      ? [
          {
            type: formation.type,
            branches: formation.branches,
            wuxing: formation.wuxing,
          } satisfies HurtPatternBranchTransformationFact,
        ]
      : [],
  );
  const liuhePartner = LIUHE_MAP[monthBranch];
  const liuheWuxing = LIUHE_WUXING[monthBranch] as Wuxing | undefined;
  const liuheFacts =
    liuhePartner &&
    liuheWuxing &&
    uniqueBranches.includes(liuhePartner) &&
    isWealthWuxing(liuheWuxing)
      ? [
          {
            type: '六合',
            branches: [monthBranch, liuhePartner],
            wuxing: liuheWuxing,
          } satisfies HurtPatternBranchTransformationFact,
        ]
      : [];

  return [...completeFacts, ...liuheFacts];
}

/**
 * 汇总《子平真诠》伤官格章节能够由四柱客观闭合的明透、月令同根、
 * 财印隔位、气候类别、固定会合关系与官杀取清组件。
 * 强弱、旺衰、根深、合化结果及最终成败均不由十神数量或单项关系代替。
 */
export function analyzeHurtPatternStructure(
  pillars: Pillars,
  patternName: string,
  getTenGodFn: PatternGetTenGodFn = getTenGod,
): HurtPatternStructureSummary {
  const dayMaster = pillars.day.gan;
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const hurtStems = select('伤官');
  const wealthStems = select('正财', '偏财');
  const directResourceStems = select('正印');
  const indirectResourceStems = select('偏印');
  const resourceStems = [...directResourceStems, ...indirectResourceStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const officerStems = select('正官');
  const killerStems = select('七杀');
  const monthHiddenStems = HIDDEN_STEMS[pillars.month.zhi] ?? [];
  const monthHiddenHurtStems = monthHiddenStems.filter(
    (stem) => getTenGodFn(stem, dayMaster) === '伤官',
  );
  const monthHiddenWealthStems = monthHiddenStems.filter((stem) =>
    ['正财', '偏财'].includes(getTenGodFn(stem, dayMaster)),
  );
  const resourceHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['正印', '偏印']);
  const wealthHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['正财', '偏财']);
  const wealthTransformationFacts = collectWealthTransformationFacts(
    pillars,
    getTenGodFn,
    monthHiddenHurtStems,
  );
  const wealthResourcePairs = wealthStems.flatMap((wealth) =>
    resourceStems.map((resource) => ({
      wealth,
      resource,
      isAdjacent: areAdjacentPatternStemColumns(wealth, resource),
    })),
  );
  const hurtOfficerComponents = hurtStems.flatMap((hurt) =>
    officerStems.map((officer) => ({
      method: '伤官制官' as const,
      target: officer,
      partner: hurt,
    })),
  );
  const combinedComponents = [...officerStems, ...killerStems].flatMap((target) =>
    exposedStems.flatMap((partner) =>
      target.position !== partner.position &&
      areAdjacentPatternStemColumns(target, partner) &&
      isTianGanHe(target.stem, partner.stem)
        ? [
            {
              method: target.tenGod === '正官' ? '五合正官' : '五合七杀',
              target,
              partner,
            } satisfies HurtPatternClearingComponentFact,
          ]
        : [],
    ),
  );
  const isHurtPattern = isHurtPatternName(patternName);

  return {
    isHurtPattern,
    isMixedHurtPattern: patternName === '杂气伤官格',
    patternName,
    exposedStems,
    hurtStems,
    wealthStems,
    resourceStems,
    directResourceStems,
    indirectResourceStems,
    officerStems,
    killerStems,
    monthHiddenHurtStems,
    monthHiddenWealthStems,
    resourceHiddenFacts,
    wealthHiddenFacts,
    hurtWealthShareMonth:
      hurtStems.length > 0 &&
      wealthStems.length > 0 &&
      monthHiddenHurtStems.length > 0 &&
      monthHiddenWealthStems.length > 0,
    wealthTransformationFacts,
    wealthResourcePairs,
    hasAdjacentWealthResourceConflict: wealthResourcePairs.some((pair) => pair.isAdjacent),
    hasSeparatedWealthResources:
      wealthResourcePairs.length > 0 && wealthResourcePairs.every((pair) => !pair.isAdjacent),
    hasMixedResources: directResourceStems.length > 0 && indirectResourceStems.length > 0,
    hasOfficerKillerMixture: officerStems.length > 0 && killerStems.length > 0,
    clearingComponents: [...hurtOfficerComponents, ...combinedComponents],
    isMetalWaterHurt:
      isHurtPattern &&
      getStemWuxing(dayMaster) === '金' &&
      monthHiddenHurtStems.some((stem) => getStemWuxing(stem) === '水'),
    isSummerWoodHurt:
      isHurtPattern &&
      getStemWuxing(dayMaster) === '木' &&
      SUMMER_BRANCHES.has(pillars.month.zhi) &&
      monthHiddenHurtStems.some((stem) => getStemWuxing(stem) === '火'),
  };
}
