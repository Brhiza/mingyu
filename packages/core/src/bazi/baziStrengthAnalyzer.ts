import { BASIC_MAPPINGS } from './baziDefinitions';
import { collectCompleteBranchFormations } from './baziFormationUtils';
import type {
  ConstraintAnalysis,
  DayMasterStrengthAnalysis,
  HiddenStems,
  Pillars,
  RootAnalysis,
  SupportAnalysis,
  Wuxing,
} from './baziTypes';

export interface SeasonalStatusAnalysis {
  status: string;
  score: number;
  isTimely: boolean;
}

export interface FormationAnalysis {
  formations: Array<{
    type: string;
    branches: string[];
    wuxing: Wuxing;
    effect: '助身' | '生身' | '泄身' | '耗身' | '克身';
    strength: number;
  }>;
  totalStrength: number;
}

type GetWuxingFn = (ganOrZhi: string) => Wuxing;
type GetSeasonStatusFn = (zhi: string) => Record<string, string>;

export function analyzeRoot(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: GetWuxingFn,
): RootAnalysis {
  const roots: { position: string; branch: string; strength: number }[] = [];
  let totalStrength = 0;
  const dayMasterWuxing = getWuxing(dayMaster);

  Object.entries(pillars).forEach(([position, pillar]) => {
    const branchWuxing = getWuxing(pillar.zhi);
    const hasMainQiRoot = branchWuxing === dayMasterWuxing;
    if (branchWuxing === dayMasterWuxing) {
      roots.push({ position, branch: pillar.zhi, strength: 2 });
      totalStrength += 2;
    }
    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      if (hasMainQiRoot && index === 0) {
        return;
      }
      if (getWuxing(stem) === dayMasterWuxing) {
        roots.push({ position, branch: `${pillar.zhi}(${stem})`, strength: 1 });
        totalStrength += 1;
      }
    });
  });

  return {
    roots,
    totalStrength,
    hasRoot: roots.length > 0,
    strongRoot: totalStrength >= 3,
  };
}

export function analyzeSupport(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: GetWuxingFn,
): SupportAnalysis {
  const supporters: { position: string; stem: string; strength: number }[] = [];
  let totalStrength = 0;
  const dayMasterWuxing = getWuxing(dayMaster);
  const generatingElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  Object.entries(pillars).forEach(([position, pillar]) => {
    if (position !== 'day') {
      const stemWuxing = getWuxing(pillar.gan);
      const isCompanion = stemWuxing === dayMasterWuxing;
      const isResource = generatingElement ? stemWuxing === generatingElement : false;

      if (isCompanion || isResource) {
        supporters.push({ position, stem: pillar.gan, strength: 1 });
        totalStrength += 1;
      }
    }

    if (generatingElement && getWuxing(pillar.zhi) === generatingElement) {
      supporters.push({ position, stem: pillar.zhi, strength: 1 });
      totalStrength += 1;
    }

    const branchWuxing = getWuxing(pillar.zhi);
    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      if (
        index === 0 &&
        generatingElement &&
        branchWuxing === generatingElement &&
        getWuxing(stem) === generatingElement
      ) {
        return;
      }
      if (!generatingElement || getWuxing(stem) !== generatingElement) {
        return;
      }

      supporters.push({ position, stem: `${pillar.zhi}(${stem})`, strength: 0.5 });
      totalStrength += 0.5;
    });
  });

  return {
    supporters,
    totalStrength,
    hasSupport: supporters.length > 0,
  };
}

export function analyzeConstraint(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: GetWuxingFn,
): ConstraintAnalysis {
  const constraints: { position: string; stem: string; strength: number }[] = [];
  let totalStrength = 0;
  const dayMasterWuxing = getWuxing(dayMaster);
  const generatedElement = BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing];
  const wealthElement = BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing];
  const officerElement = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  const addConstraint = (position: string, stem: string, strength: number) => {
    constraints.push({ position, stem, strength });
    totalStrength += strength;
  };

  const resolveConstraintStrength = (
    wuxing: Wuxing | undefined,
    stemStrength: number,
    branchStrength: number,
  ) => {
    if (!wuxing) {
      return 0;
    }

    if (wuxing === officerElement) {
      return branchStrength + 0.4;
    }

    if (wuxing === wealthElement) {
      return branchStrength;
    }

    if (wuxing === generatedElement) {
      return stemStrength;
    }

    return 0;
  };

  Object.entries(pillars).forEach(([position, pillar]) => {
    if (position !== 'day') {
      const stemWuxing = getWuxing(pillar.gan);
      const stemStrength = resolveConstraintStrength(stemWuxing, 1, 1.2);
      if (stemStrength > 0) {
        addConstraint(position, pillar.gan, stemStrength);
      }
    }

    const branchWuxing = getWuxing(pillar.zhi);
    const branchStrength = resolveConstraintStrength(branchWuxing, 1, 1.2);
    if (branchStrength > 0) {
      addConstraint(position, pillar.zhi, branchStrength);
    }

    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      const hiddenWuxing = getWuxing(stem);
      if (index === 0 && branchStrength > 0 && hiddenWuxing === branchWuxing) {
        return;
      }
      const hiddenStrength = resolveConstraintStrength(hiddenWuxing, 0.5, 0.6);
      if (hiddenStrength > 0) {
        addConstraint(position, `${pillar.zhi}(${stem})`, hiddenStrength);
      }
    });
  });

  return {
    constraints,
    totalStrength,
    hasConstraint: constraints.length > 0,
  };
}

export function analyzeSeasonalStatus(
  dayMaster: string,
  monthBranch: string,
  getSeasonStatus: GetSeasonStatusFn,
  getWuxing: GetWuxingFn,
): SeasonalStatusAnalysis {
  const season = getSeasonStatus(monthBranch);
  const dayMasterWuxing = getWuxing(dayMaster);
  const seasonStatus = season[dayMasterWuxing as string];
  const scoreMap: Record<string, number> = {
    旺: 4,
    相: 2,
    休: 0,
    囚: -2,
    死: -4,
  };

  return {
    status: seasonStatus || '未知',
    score: scoreMap[seasonStatus] ?? 0,
    isTimely: seasonStatus === '旺' || seasonStatus === '相',
  };
}

export function analyzeFormation(
  dayMaster: string,
  pillars: Pillars,
  getWuxing: GetWuxingFn,
): FormationAnalysis {
  const dayMasterWuxing = getWuxing(dayMaster);
  const generatedElement = BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing];
  const wealthElement = BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing];
  const officerElement = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;
  const resourceElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  const formations = collectCompleteBranchFormations(pillars)
    .map((formation) => {
      const monthBonus = formation.includesMonthBranch ? 0.4 : 0;

      if (formation.wuxing === dayMasterWuxing) {
        return {
          ...formation,
          effect: '助身' as const,
          strength: Number((2.6 + monthBonus).toFixed(1)),
        };
      }

      if (resourceElement && formation.wuxing === resourceElement) {
        return {
          ...formation,
          effect: '生身' as const,
          strength: Number((2.2 + monthBonus).toFixed(1)),
        };
      }

      if (formation.wuxing === generatedElement) {
        return {
          ...formation,
          effect: '泄身' as const,
          strength: Number((-2.0 - monthBonus).toFixed(1)),
        };
      }

      if (formation.wuxing === wealthElement) {
        return {
          ...formation,
          effect: '耗身' as const,
          strength: Number((-2.2 - monthBonus).toFixed(1)),
        };
      }

      if (officerElement && formation.wuxing === officerElement) {
        return {
          ...formation,
          effect: '克身' as const,
          strength: Number((-2.6 - monthBonus).toFixed(1)),
        };
      }

      return {
        ...formation,
        effect: '泄身' as const,
        strength: 0,
      };
    })
    .filter((formation) => formation.strength !== 0);

  return {
    formations,
    totalStrength: Number(
      formations.reduce((sum, formation) => sum + formation.strength, 0).toFixed(1),
    ),
  };
}

export function analyzeDayMasterStrength(
  seasonalStatus: SeasonalStatusAnalysis,
  formationAnalysis: FormationAnalysis,
  rootAnalysis: RootAnalysis,
  supportAnalysis: SupportAnalysis,
  constraintAnalysis: ConstraintAnalysis,
): DayMasterStrengthAnalysis {
  const score = Number(
    (
      seasonalStatus.score +
      formationAnalysis.totalStrength +
      rootAnalysis.totalStrength +
      supportAnalysis.totalStrength -
      constraintAnalysis.totalStrength
    ).toFixed(1),
  );

  let status = '中和';
  if (score >= 6) status = '身强';
  if (score >= 4 && score < 6) status = '偏强';
  if (score > 1 && score <= 2.5) status = '偏弱';
  if (score <= 1) status = '身弱';
  if (
    rootAnalysis.strongRoot &&
    seasonalStatus.score >= 2 &&
    formationAnalysis.totalStrength >= 0 &&
    constraintAnalysis.totalStrength <= 1.5
  ) {
    status = '极强';
  }
  if (
    !rootAnalysis.hasRoot &&
    seasonalStatus.score <= 0 &&
    (supportAnalysis.totalStrength <= 0.5 || score <= 0)
  ) {
    status = '极弱';
  }

  return {
    score,
    status,
    details: {
      seasonalScore: seasonalStatus.score,
      timely: seasonalStatus.isTimely,
      formationStrength: formationAnalysis.totalStrength,
      rootStrength: rootAnalysis.totalStrength,
      supportStrength: supportAnalysis.totalStrength,
      constraintStrength: constraintAnalysis.totalStrength,
    },
  };
}
