import { BASIC_MAPPINGS, SEASON_STATUS } from './baziDefinitions';
import type { Pillars, Wuxing } from './baziTypes';
import { assertPillars } from './baziUtils';

export interface CompleteBranchFormation {
  type: '三合' | '三会';
  branches: string[];
  wuxing: Wuxing;
  includesMonthBranch: boolean;
}

export interface EstablishedBranchFormation extends CompleteBranchFormation {
  monthStatus: string;
  clashBreakBranches: string[];
}

const FORMATION_DEFINITIONS: Array<{
  type: '三合' | '三会';
  branches: string[];
  wuxing: Wuxing;
}> = [
  { type: '三合', branches: ['亥', '卯', '未'], wuxing: '木' },
  { type: '三会', branches: ['寅', '卯', '辰'], wuxing: '木' },
  { type: '三合', branches: ['寅', '午', '戌'], wuxing: '火' },
  { type: '三会', branches: ['巳', '午', '未'], wuxing: '火' },
  { type: '三合', branches: ['巳', '酉', '丑'], wuxing: '金' },
  { type: '三会', branches: ['申', '酉', '戌'], wuxing: '金' },
  { type: '三合', branches: ['申', '子', '辰'], wuxing: '水' },
  { type: '三会', branches: ['亥', '子', '丑'], wuxing: '水' },
];

const REPRESENTATIVE_STEM_BY_WUXING: Record<Wuxing, string> = {
  木: '甲',
  火: '丙',
  土: '戊',
  金: '庚',
  水: '壬',
};

export function getRepresentativeStemByWuxing(wuxing: Wuxing): string {
  return REPRESENTATIVE_STEM_BY_WUXING[wuxing];
}

export function collectCompleteBranchFormations(pillars: Pillars): CompleteBranchFormation[] {
  assertPillars(pillars);
  const uniqueBranches = new Set(Object.values(pillars).map((pillar) => pillar.zhi));

  return FORMATION_DEFINITIONS.filter((formation) =>
    formation.branches.every((branch) => uniqueBranches.has(branch)),
  ).map((formation) => ({
    ...formation,
    includesMonthBranch: formation.branches.includes(pillars.month.zhi),
  }));
}

/**
 * 三支齐全只证明会合结构存在；只有化神得月令且没有被局外地支冲破时，
 * 才把该结构作为旺衰、特殊格和用神判断中的成势力量。
 */
export function collectEstablishedBranchFormations(pillars: Pillars): EstablishedBranchFormation[] {
  const allBranches = Object.values(pillars).map((pillar) => pillar.zhi);

  return collectCompleteBranchFormations(pillars).flatMap((formation) => {
    const monthStatus = SEASON_STATUS[pillars.month.zhi]?.[formation.wuxing];
    const isSeasonSupported = monthStatus === '旺' || monthStatus === '相';
    const externalBranches = allBranches.filter((branch) => !formation.branches.includes(branch));
    const clashBreakBranches = [
      ...new Set(
        externalBranches.filter((branch) =>
          formation.branches.some((member) => BASIC_MAPPINGS.DI_ZHI_CHONG[member] === branch),
        ),
      ),
    ];

    if (!isSeasonSupported || clashBreakBranches.length > 0) {
      return [];
    }

    return [{ ...formation, monthStatus, clashBreakBranches }];
  });
}
