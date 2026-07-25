import { BASIC_MAPPINGS } from './baziDefinitions';
import { collectEstablishedBranchFormations } from './baziFormationUtils';
import type {
  ConstraintAnalysis,
  DayMasterStrengthAnalysis,
  HiddenStems,
  Pillars,
  RootAnalysis,
  SupportAnalysis,
  Wuxing,
} from './baziTypes';
import { WUXING } from './baziTypes';
import {
  assertEarthlyBranch,
  assertHeavenlyStem,
  assertHiddenStemsMatchPillars,
  assertPillars,
} from './baziUtils';

export interface SeasonalStatusAnalysis {
  status: string;
  score: number;
  baseScore?: number;
  commanderStem?: string;
  commanderScore?: number;
  commanderEffect?: '助身' | '生身' | '泄身' | '耗身' | '克身' | '中性';
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

function assertValidWuxing(value: string, label: string): asserts value is Wuxing {
  if (!(WUXING as readonly string[]).includes(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

function resolveWuxing(getWuxing: GetWuxingFn, value: string, label: string): Wuxing {
  const wuxing = getWuxing(value);
  assertValidWuxing(wuxing, label);
  return wuxing;
}

function assertStrengthPillars(dayMaster: string, pillars: Pillars): void {
  assertHeavenlyStem(dayMaster, '日主');
  assertPillars(pillars);

  if (dayMaster !== pillars.day.gan) {
    throw new Error(`日主与日柱天干不一致：${dayMaster}/${pillars.day.gan}`);
  }
}

function resolveCommanderEffect(
  dayMasterWuxing: Wuxing,
  commanderWuxing: Wuxing,
): Pick<SeasonalStatusAnalysis, 'commanderScore' | 'commanderEffect'> {
  if (commanderWuxing === dayMasterWuxing) {
    return { commanderScore: 1.5, commanderEffect: '助身' };
  }

  if (BASIC_MAPPINGS.WUXING_SHENG[commanderWuxing] === dayMasterWuxing) {
    return { commanderScore: 1, commanderEffect: '生身' };
  }

  if (BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing] === commanderWuxing) {
    return { commanderScore: -0.8, commanderEffect: '泄身' };
  }

  if (BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing] === commanderWuxing) {
    return { commanderScore: -1, commanderEffect: '耗身' };
  }

  if (BASIC_MAPPINGS.WUXING_KE[commanderWuxing] === dayMasterWuxing) {
    return { commanderScore: -1.3, commanderEffect: '克身' };
  }

  return { commanderScore: 0, commanderEffect: '中性' };
}

export function analyzeRoot(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: GetWuxingFn,
): RootAnalysis {
  assertStrengthPillars(dayMaster, pillars);
  assertHiddenStemsMatchPillars(pillars, hiddenStems);

  const roots: { position: string; branch: string; strength: number }[] = [];
  let totalStrength = 0;
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');

  Object.entries(pillars).forEach(([position, pillar]) => {
    const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
    const hasMainQiRoot = branchWuxing === dayMasterWuxing;
    if (branchWuxing === dayMasterWuxing) {
      roots.push({ position, branch: pillar.zhi, strength: 2 });
      totalStrength += 2;
    }
    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      if (hasMainQiRoot && index === 0) {
        return;
      }
      if (resolveWuxing(getWuxing, stem, `${position}柱藏干`) === dayMasterWuxing) {
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
  assertStrengthPillars(dayMaster, pillars);
  assertHiddenStemsMatchPillars(pillars, hiddenStems);

  const supporters: { position: string; stem: string; strength: number }[] = [];
  let totalStrength = 0;
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
  const generatingElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  Object.entries(pillars).forEach(([position, pillar]) => {
    if (position !== 'day') {
      const stemWuxing = resolveWuxing(getWuxing, pillar.gan, `${position}柱天干`);
      const isCompanion = stemWuxing === dayMasterWuxing;
      const isResource = generatingElement ? stemWuxing === generatingElement : false;

      if (isCompanion || isResource) {
        supporters.push({ position, stem: pillar.gan, strength: 1 });
        totalStrength += 1;
      }
    }

    if (
      generatingElement &&
      resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`) === generatingElement
    ) {
      supporters.push({ position, stem: pillar.zhi, strength: 1 });
      totalStrength += 1;
    }

    const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      const hiddenWuxing = resolveWuxing(getWuxing, stem, `${position}柱藏干`);
      if (
        index === 0 &&
        generatingElement &&
        branchWuxing === generatingElement &&
        hiddenWuxing === generatingElement
      ) {
        return;
      }
      if (!generatingElement || hiddenWuxing !== generatingElement) {
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
  assertStrengthPillars(dayMaster, pillars);
  assertHiddenStemsMatchPillars(pillars, hiddenStems);

  const constraints: { position: string; stem: string; strength: number }[] = [];
  let totalStrength = 0;
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
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
      const stemWuxing = resolveWuxing(getWuxing, pillar.gan, `${position}柱天干`);
      const stemStrength = resolveConstraintStrength(stemWuxing, 1, 1.2);
      if (stemStrength > 0) {
        addConstraint(position, pillar.gan, stemStrength);
      }
    }

    const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
    const branchStrength = resolveConstraintStrength(branchWuxing, 1, 1.2);
    if (branchStrength > 0) {
      addConstraint(position, pillar.zhi, branchStrength);
    }

    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      const hiddenWuxing = resolveWuxing(getWuxing, stem, `${position}柱藏干`);
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
  monthCommander?: string,
): SeasonalStatusAnalysis {
  assertHeavenlyStem(dayMaster, '日主');
  assertEarthlyBranch(monthBranch, '月支');
  if (monthCommander) assertHeavenlyStem(monthCommander, '月令司权天干');

  const season = getSeasonStatus(monthBranch);
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
  const seasonStatus = season[dayMasterWuxing as string];
  if (!seasonStatus) {
    throw new Error(`月令旺衰数据缺失：${monthBranch}/${dayMasterWuxing}`);
  }
  const scoreMap: Record<string, number> = {
    旺: 4,
    相: 2,
    休: 0,
    囚: -2,
    死: -4,
  };

  if (!Object.hasOwn(scoreMap, seasonStatus)) {
    throw new Error(`月令旺衰状态无效：${monthBranch}/${dayMasterWuxing}/${seasonStatus}`);
  }
  const baseScore = scoreMap[seasonStatus];
  const commanderWuxing = monthCommander
    ? resolveWuxing(getWuxing, monthCommander, '月令司权天干')
    : undefined;
  const commander = commanderWuxing
    ? resolveCommanderEffect(dayMasterWuxing, commanderWuxing)
    : { commanderScore: 0, commanderEffect: '中性' as const };

  return {
    status: seasonStatus,
    score: Number((baseScore + (commander.commanderScore ?? 0)).toFixed(1)),
    baseScore,
    commanderStem: monthCommander,
    commanderScore: commander.commanderScore,
    commanderEffect: commander.commanderEffect,
    isTimely: seasonStatus === '旺' || seasonStatus === '相',
  };
}

export function analyzeFormation(
  dayMaster: string,
  pillars: Pillars,
  getWuxing: GetWuxingFn,
): FormationAnalysis {
  assertStrengthPillars(dayMaster, pillars);

  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
  const generatedElement = BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing];
  const wealthElement = BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing];
  const officerElement = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;
  const resourceElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  const formations = collectEstablishedBranchFormations(pillars)
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
  const seasonalBaseScore = seasonalStatus.baseScore ?? seasonalStatus.score;
  const commanderScore = seasonalStatus.commanderScore ?? 0;
  const seasonalTotalScore =
    seasonalStatus.baseScore === undefined
      ? seasonalStatus.score
      : seasonalBaseScore + commanderScore;
  const score = Number(
    (
      seasonalTotalScore +
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
    seasonalTotalScore >= 2 &&
    formationAnalysis.totalStrength >= 0 &&
    constraintAnalysis.totalStrength <= 1.5
  ) {
    status = '极强';
  }
  if (
    !rootAnalysis.hasRoot &&
    seasonalTotalScore <= 0 &&
    (supportAnalysis.totalStrength <= 0.5 || score <= 0)
  ) {
    status = '极弱';
  }

  return {
    status,
    details: {
      timely: seasonalStatus.isTimely,
      seasonalEffect: seasonalBaseScore > 0 ? '支持' : seasonalBaseScore < 0 ? '削弱' : '中性',
      commanderEffect: seasonalStatus.commanderEffect ?? '中性',
      formationEffect:
        formationAnalysis.totalStrength > 0
          ? '支持'
          : formationAnalysis.totalStrength < 0
            ? '削弱'
            : '中性',
      hasRoot: rootAnalysis.hasRoot,
      hasStrongRoot: rootAnalysis.strongRoot,
      hasSupport: supportAnalysis.hasSupport,
      hasConstraint: constraintAnalysis.hasConstraint,
      ruleBasis: [
        '综合月令、司令、成局、通根、帮扶与克泄耗条件判定旺衰状态',
        '内部权重仅用于规则分类，不作为概率、吉凶分或现实结果公开',
      ],
    },
  };
}
