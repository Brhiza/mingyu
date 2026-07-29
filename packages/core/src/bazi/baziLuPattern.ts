import { HIDDEN_STEMS, LU_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
} from './baziFormationUtils';
import {
  collectPatternExposedStemFacts,
  type PatternExposedStemFact,
  type PatternGetTenGodFn,
} from './baziPatternStemFacts';
import type { Pillars, Wuxing } from './baziTypes';
import { getTenGod } from './baziUtils';
import { SANHE_GROUPS, isTianGanHe } from '../ganzhi/relations';

export interface LuPatternHiddenFact {
  position: keyof Pillars;
  label: string;
  branch: string;
  hiddenStems: string[];
}

export interface LuPatternBranchFormationFact {
  type: '三合' | '三会' | '半合' | '拱局';
  branches: string[];
  wuxing: Wuxing;
  includesMonthBranch: boolean;
}

export interface LuPatternStemCombinationFact {
  target: PatternExposedStemFact;
  partner: PatternExposedStemFact;
}

export interface LuPatternOfficerSeparationFact {
  wealth: PatternExposedStemFact;
  officer: PatternExposedStemFact;
  resource: PatternExposedStemFact;
}

export interface LuPatternStructureSummary {
  isLuPattern: boolean;
  isMonthRobPattern: boolean;
  isLuMonthRobPattern: boolean;
  patternName: string;
  luBranch?: string;
  exposedStems: PatternExposedStemFact[];
  peerStems: PatternExposedStemFact[];
  wealthStems: PatternExposedStemFact[];
  resourceStems: PatternExposedStemFact[];
  foodStems: PatternExposedStemFact[];
  hurtStems: PatternExposedStemFact[];
  outputStems: PatternExposedStemFact[];
  officerStems: PatternExposedStemFact[];
  killerStems: PatternExposedStemFact[];
  wealthHiddenFacts: LuPatternHiddenFact[];
  resourceHiddenFacts: LuPatternHiddenFact[];
  wealthFormationFacts: LuPatternBranchFormationFact[];
  outputFormationFacts: LuPatternBranchFormationFact[];
  monthWealthTransformationFacts: LuPatternBranchFormationFact[];
  monthOutputTransformationFacts: LuPatternBranchFormationFact[];
  officerSeparationFacts: LuPatternOfficerSeparationFact[];
  killerCombinationFacts: LuPatternStemCombinationFact[];
  wealthCombinationFacts: LuPatternStemCombinationFact[];
  resourceHurtCombinationFacts: LuPatternStemCombinationFact[];
  hasOfficerKillerMixture: boolean;
  isSpringWood: boolean;
  isAutumnMetal: boolean;
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

const SPRING_BRANCHES = new Set(['寅', '卯', '辰']);
const AUTUMN_BRANCHES = new Set(['申', '酉', '戌']);

function collectHiddenFacts(
  pillars: Pillars,
  getTenGodFn: PatternGetTenGodFn,
  tenGods: string[],
): LuPatternHiddenFact[] {
  const dayMaster = pillars.day.gan;
  return BRANCH_POSITIONS.flatMap(({ position, label }) => {
    const branch = pillars[position].zhi;
    const hiddenStems = (HIDDEN_STEMS[branch] ?? []).filter((stem) =>
      tenGods.includes(getTenGodFn(stem, dayMaster)),
    );
    return hiddenStems.length > 0 ? [{ position, label, branch, hiddenStems }] : [];
  });
}

function collectBranchFormationFacts(pillars: Pillars): LuPatternBranchFormationFact[] {
  const uniqueBranches = [...new Set(Object.values(pillars).map((pillar) => pillar.zhi))];
  const completeFacts = collectCompleteBranchFormations(pillars).map(
    (formation) =>
      ({
        type: formation.type,
        branches: formation.branches,
        wuxing: formation.wuxing,
        includesMonthBranch: formation.includesMonthBranch,
      }) satisfies LuPatternBranchFormationFact,
  );
  const pairFacts = Object.entries(SANHE_GROUPS).flatMap(([group, members]) => {
    const present = members.filter((branch) => uniqueBranches.includes(branch));
    if (present.length !== 2) return [];
    return [
      {
        type: present.includes(members[1]) ? '半合' : '拱局',
        branches: present,
        wuxing: group[0] as Wuxing,
        includesMonthBranch: present.includes(pillars.month.zhi),
      } satisfies LuPatternBranchFormationFact,
    ];
  });
  return [...completeFacts, ...pairFacts];
}

function collectCombinations(
  targets: PatternExposedStemFact[],
  partners: PatternExposedStemFact[],
): LuPatternStemCombinationFact[] {
  return targets.flatMap((target) =>
    partners.flatMap((partner) =>
      target.position !== partner.position && isTianGanHe(target.stem, partner.stem)
        ? [{ target, partner }]
        : [],
    ),
  );
}

/**
 * 汇总《子平真诠》“论建禄月劫”能够由四柱客观闭合的财官杀食取用、
 * 财印相随、固定会合、制伏与取清组件。强弱、根多、合化、去留和贵贱另审。
 */
export function analyzeLuPatternStructure(
  pillars: Pillars,
  patternName: string,
  getTenGodFn: PatternGetTenGodFn = getTenGod,
): LuPatternStructureSummary {
  const dayMaster = pillars.day.gan;
  const luBranch = LU_BRANCH_MAP[dayMaster];
  const exposedStems = collectPatternExposedStemFacts(pillars, getTenGodFn);
  const select = (...tenGods: string[]) =>
    exposedStems.filter((fact) => tenGods.includes(fact.tenGod));
  const peerStems = select('比肩', '劫财');
  const wealthStems = select('正财', '偏财');
  const resourceStems = select('正印', '偏印');
  const foodStems = select('食神');
  const hurtStems = select('伤官');
  const outputStems = [...foodStems, ...hurtStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  const officerStems = select('正官');
  const killerStems = select('七杀');
  const wealthHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['正财', '偏财']);
  const resourceHiddenFacts = collectHiddenFacts(pillars, getTenGodFn, ['正印', '偏印']);
  const branchFormationFacts = collectBranchFormationFacts(pillars);
  const isFormationTenGod = (fact: LuPatternBranchFormationFact, tenGods: string[]) =>
    tenGods.includes(getTenGodFn(getRepresentativeStemByWuxing(fact.wuxing), dayMaster));
  const wealthFormationFacts = branchFormationFacts.filter((fact) =>
    isFormationTenGod(fact, ['正财', '偏财']),
  );
  const outputFormationFacts = branchFormationFacts.filter((fact) =>
    isFormationTenGod(fact, ['食神', '伤官']),
  );
  const officerSeparationFacts = wealthStems.flatMap((wealth) =>
    officerStems.flatMap((officer) =>
      resourceStems.flatMap((resource) =>
        (wealth.columnIndex < officer.columnIndex && officer.columnIndex < resource.columnIndex) ||
        (resource.columnIndex < officer.columnIndex && officer.columnIndex < wealth.columnIndex)
          ? [{ wealth, officer, resource }]
          : [],
      ),
    ),
  );
  const isLuPattern =
    patternName === '建禄格' && Boolean(luBranch && pillars.month.zhi === luBranch);
  const monthPrincipalStem = HIDDEN_STEMS[pillars.month.zhi]?.[0];
  const isMonthRobPattern =
    patternName === '劫财格' &&
    Boolean(monthPrincipalStem && getTenGodFn(monthPrincipalStem, dayMaster) === '劫财');

  return {
    isLuPattern,
    isMonthRobPattern,
    isLuMonthRobPattern: isLuPattern || isMonthRobPattern,
    patternName,
    luBranch,
    exposedStems,
    peerStems,
    wealthStems,
    resourceStems,
    foodStems,
    hurtStems,
    outputStems,
    officerStems,
    killerStems,
    wealthHiddenFacts,
    resourceHiddenFacts,
    wealthFormationFacts,
    outputFormationFacts,
    monthWealthTransformationFacts: wealthFormationFacts.filter((fact) => fact.includesMonthBranch),
    monthOutputTransformationFacts: outputFormationFacts.filter((fact) => fact.includesMonthBranch),
    officerSeparationFacts,
    killerCombinationFacts: collectCombinations(killerStems, exposedStems),
    wealthCombinationFacts: collectCombinations(wealthStems, exposedStems),
    resourceHurtCombinationFacts: collectCombinations(hurtStems, resourceStems),
    hasOfficerKillerMixture: officerStems.length > 0 && killerStems.length > 0,
    isSpringWood: ['甲', '乙'].includes(dayMaster) && SPRING_BRANCHES.has(pillars.month.zhi),
    isAutumnMetal: ['庚', '辛'].includes(dayMaster) && AUTUMN_BRANCHES.has(pillars.month.zhi),
  };
}
