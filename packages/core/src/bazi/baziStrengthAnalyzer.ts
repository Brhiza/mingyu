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
  commanderStem?: string;
  commanderEffect?: '助身' | '生身' | '泄身' | '耗身' | '克身' | '中性';
  isTimely: boolean;
}

export interface FormationAnalysis {
  formations: Array<{
    type: string;
    branches: string[];
    wuxing: Wuxing;
    effect: '助身' | '生身' | '泄身' | '耗身' | '克身';
  }>;
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
): NonNullable<SeasonalStatusAnalysis['commanderEffect']> {
  if (commanderWuxing === dayMasterWuxing) {
    return '助身';
  }

  if (BASIC_MAPPINGS.WUXING_SHENG[commanderWuxing] === dayMasterWuxing) {
    return '生身';
  }

  if (BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing] === commanderWuxing) {
    return '泄身';
  }

  if (BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing] === commanderWuxing) {
    return '耗身';
  }

  if (BASIC_MAPPINGS.WUXING_KE[commanderWuxing] === dayMasterWuxing) {
    return '克身';
  }

  return '中性';
}

type StrengthTendency = '扶身' | '制身' | '相持';

const SUPPORTING_COMMANDER_EFFECTS = new Set(['助身', '生身']);
const CONSTRAINING_COMMANDER_EFFECTS = new Set(['泄身', '耗身', '克身']);
const SUPPORTING_FORMATION_EFFECTS = new Set(['助身', '生身']);

function resolveMonthTendency(seasonalStatus: SeasonalStatusAnalysis): StrengthTendency {
  const seasonTendency: StrengthTendency =
    seasonalStatus.status === '旺' || seasonalStatus.status === '相'
      ? '扶身'
      : seasonalStatus.status === '囚' || seasonalStatus.status === '死'
        ? '制身'
        : '相持';
  const commanderEffect = seasonalStatus.commanderEffect ?? '中性';
  const commanderTendency: StrengthTendency = SUPPORTING_COMMANDER_EFFECTS.has(commanderEffect)
    ? '扶身'
    : CONSTRAINING_COMMANDER_EFFECTS.has(commanderEffect)
      ? '制身'
      : '相持';

  if (seasonTendency === '相持') return commanderTendency;
  if (commanderTendency === '相持') return seasonTendency;
  return seasonTendency === commanderTendency ? seasonTendency : '相持';
}

function isDirectEvidence(value: string): boolean {
  return !value.includes('(');
}

export function analyzeRoot(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: GetWuxingFn,
): RootAnalysis {
  assertStrengthPillars(dayMaster, pillars);
  assertHiddenStemsMatchPillars(pillars, hiddenStems);

  const roots: { position: string; branch: string }[] = [];
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');

  Object.entries(pillars).forEach(([position, pillar]) => {
    const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
    const hasMainQiRoot = branchWuxing === dayMasterWuxing;
    if (branchWuxing === dayMasterWuxing) {
      roots.push({ position, branch: pillar.zhi });
    }
    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      if (hasMainQiRoot && index === 0) {
        return;
      }
      if (resolveWuxing(getWuxing, stem, `${position}柱藏干`) === dayMasterWuxing) {
        roots.push({ position, branch: `${pillar.zhi}(${stem})` });
      }
    });
  });

  return {
    roots,
    hasRoot: roots.length > 0,
    // 地支本气与日主同气即为明根；只在中余气中见同气者仍记有根，不抬成强根。
    strongRoot: roots.some((root) => isDirectEvidence(root.branch)),
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

  const supporters: { position: string; stem: string }[] = [];
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
        supporters.push({ position, stem: pillar.gan });
      }
    }

    if (
      generatingElement &&
      resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`) === generatingElement
    ) {
      supporters.push({ position, stem: pillar.zhi });
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

      supporters.push({ position, stem: `${pillar.zhi}(${stem})` });
    });
  });

  return {
    supporters,
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

  const constraints: { position: string; stem: string }[] = [];
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
  const generatedElement = BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing];
  const wealthElement = BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing];
  const officerElement = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  const addConstraint = (position: string, stem: string) => {
    constraints.push({ position, stem });
  };

  const isConstraintElement = (wuxing: Wuxing): boolean =>
    wuxing === officerElement || wuxing === wealthElement || wuxing === generatedElement;

  Object.entries(pillars).forEach(([position, pillar]) => {
    if (position !== 'day') {
      const stemWuxing = resolveWuxing(getWuxing, pillar.gan, `${position}柱天干`);
      if (isConstraintElement(stemWuxing)) {
        addConstraint(position, pillar.gan);
      }
    }

    const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
    const branchIsConstraint = isConstraintElement(branchWuxing);
    if (branchIsConstraint) {
      addConstraint(position, pillar.zhi);
    }

    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      const hiddenWuxing = resolveWuxing(getWuxing, stem, `${position}柱藏干`);
      if (index === 0 && branchIsConstraint && hiddenWuxing === branchWuxing) {
        return;
      }
      if (isConstraintElement(hiddenWuxing)) {
        addConstraint(position, `${pillar.zhi}(${stem})`);
      }
    });
  });

  return {
    constraints,
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
  if (!['旺', '相', '休', '囚', '死'].includes(seasonStatus)) {
    throw new Error(`月令旺衰状态无效：${monthBranch}/${dayMasterWuxing}/${seasonStatus}`);
  }
  const commanderWuxing = monthCommander
    ? resolveWuxing(getWuxing, monthCommander, '月令司权天干')
    : undefined;
  const commanderEffect = commanderWuxing
    ? resolveCommanderEffect(dayMasterWuxing, commanderWuxing)
    : '中性';

  return {
    status: seasonStatus,
    commanderStem: monthCommander,
    commanderEffect,
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

  const formations = collectEstablishedBranchFormations(pillars).map((formation) => {
    if (formation.wuxing === dayMasterWuxing) {
      return {
        ...formation,
        effect: '助身' as const,
      };
    }

    if (resourceElement && formation.wuxing === resourceElement) {
      return {
        ...formation,
        effect: '生身' as const,
      };
    }

    if (formation.wuxing === generatedElement) {
      return {
        ...formation,
        effect: '泄身' as const,
      };
    }

    if (formation.wuxing === wealthElement) {
      return {
        ...formation,
        effect: '耗身' as const,
      };
    }

    if (officerElement && formation.wuxing === officerElement) {
      return {
        ...formation,
        effect: '克身' as const,
      };
    }

    return {
      ...formation,
      effect: '泄身' as const,
    };
  });

  return { formations };
}

export function analyzeDayMasterStrength(
  seasonalStatus: SeasonalStatusAnalysis,
  formationAnalysis: FormationAnalysis,
  rootAnalysis: RootAnalysis,
  supportAnalysis: SupportAnalysis,
  constraintAnalysis: ConstraintAnalysis,
): DayMasterStrengthAnalysis {
  const monthTendency = resolveMonthTendency(seasonalStatus);
  const rootTendency: StrengthTendency = rootAnalysis.strongRoot
    ? '扶身'
    : rootAnalysis.hasRoot
      ? '相持'
      : '制身';
  const hasSupportingFormation = formationAnalysis.formations.some((formation) =>
    SUPPORTING_FORMATION_EFFECTS.has(formation.effect),
  );
  const hasConstrainingFormation = formationAnalysis.formations.some(
    (formation) => !SUPPORTING_FORMATION_EFFECTS.has(formation.effect),
  );

  return {
    status: '待综合判断',
    details: {
      timely: seasonalStatus.isTimely,
      seasonalEffect:
        seasonalStatus.status === '旺' || seasonalStatus.status === '相'
          ? '支持'
          : seasonalStatus.status === '囚' || seasonalStatus.status === '死'
            ? '削弱'
            : '中性',
      commanderEffect: seasonalStatus.commanderEffect ?? '中性',
      formationEffect: hasSupportingFormation
        ? hasConstrainingFormation
          ? '中性'
          : '支持'
        : hasConstrainingFormation
          ? '削弱'
          : '中性',
      hasRoot: rootAnalysis.hasRoot,
      hasStrongRoot: rootAnalysis.strongRoot,
      hasSupport: supportAnalysis.hasSupport,
      hasConstraint: constraintAnalysis.hasConstraint,
      ruleBasis: [
        `月令与司令合看为${monthTendency}；通根条件为${rootTendency}；成局、帮扶与克泄耗分别登记`,
        '日主整体旺衰涉及月令、司令、根气、透干、成局、生克制化与位置层级的全局取舍；底层不按条件数量或少量布尔组合自动裁定身强、身弱及极端状态，固定交由后续综合判断',
      ],
    },
  };
}
