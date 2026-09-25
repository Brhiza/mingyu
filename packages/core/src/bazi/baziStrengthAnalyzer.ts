import { BASIC_MAPPINGS } from './baziDefinitions';
import { collectEstablishedBranchFormations } from './baziFormationUtils';
import { getDirectClashSources, hasStrongRootStage } from './baziRootFacts';
import { collectAdjudicatedRootFacts } from './baziRootAdjudication';
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
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
  score: number;
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
  baseScore?: number;
  commanderStem?: string;
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
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
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    strength: number;
  }>;
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
  totalStrength: number;
}

type GetWuxingFn = (ganOrZhi: string) => Wuxing;
type GetSeasonStatusFn = (zhi: string) => Record<string, string>;

const ROOT_PILLAR_LABELS = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
} as const;

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

type StrengthTendency = '扶身' | '制身' | '相持';

const SUPPORTING_COMMANDER_EFFECTS = new Set(['助身', '生身']);
const CONSTRAINING_COMMANDER_EFFECTS = new Set(['泄身', '耗身', '克身']);
const SUPPORTING_FORMATION_EFFECTS = new Set(['助身', '生身']);

function isActionableEvidence(evidence: { stable?: boolean; actionable?: boolean }): boolean {
  // 新结果区分冲源事实与作用裁决；旧调用方仍沿用原 stable 契约。
  return evidence.actionable ?? evidence.stable !== false;
}

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

/**
 * 与格局根气证据复用同一六冲边界：外支冲到承载根的地支时，
 * 仍可登记为“见根”，但不能把该根作为未受破坏的本气强根。
 */
function formatClashSources(sources: ReturnType<typeof getDirectClashSources>): string[] {
  return [...new Set(sources.map((source) => ROOT_PILLAR_LABELS[source.position] + source.branch))];
}

function compareEvidenceCount(supporting: number, constraining: number): StrengthTendency {
  if (supporting > constraining) return '扶身';
  if (constraining > supporting) return '制身';
  return '相持';
}

function resolveStructureTendency(
  formationAnalysis: FormationAnalysis,
  rootAnalysis: RootAnalysis,
  supportAnalysis: SupportAnalysis,
  constraintAnalysis: ConstraintAnalysis,
): StrengthTendency {
  const supportingFormations = formationAnalysis.formations.filter((formation) =>
    SUPPORTING_FORMATION_EFFECTS.has(formation.effect),
  ).length;
  const constrainingFormations = formationAnalysis.formations.length - supportingFormations;

  const effectiveRoots = rootAnalysis.roots.filter(isActionableEvidence);
  const effectiveSupporters = supportAnalysis.supporters.filter(isActionableEvidence);
  const effectiveConstraints = constraintAnalysis.constraints.filter(isActionableEvidence);

  const directSupporting =
    effectiveRoots.filter((root) => isDirectEvidence(root.branch)).length +
    effectiveSupporters.filter((supporter) => isDirectEvidence(supporter.stem)).length;
  const directConstraining = effectiveConstraints.filter((constraint) =>
    isDirectEvidence(constraint.stem),
  ).length;

  // 成局、明干与本气是第一层证据；只有第一层相持时，才比较藏干余气，
  // 避免把一条浮藏根与明透、本气、成局扁平相加。
  const primarySupporting = supportingFormations + directSupporting;
  const primaryConstraining = constrainingFormations + directConstraining;
  if (primarySupporting !== primaryConstraining) {
    return compareEvidenceCount(primarySupporting, primaryConstraining);
  }

  const hiddenSupporting = effectiveRoots.length + effectiveSupporters.length - directSupporting;
  const hiddenConstraining = effectiveConstraints.length - directConstraining;
  return compareEvidenceCount(hiddenSupporting, hiddenConstraining);
}

export function analyzeRoot(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: GetWuxingFn,
): RootAnalysis {
  assertStrengthPillars(dayMaster, pillars);
  assertHiddenStemsMatchPillars(pillars, hiddenStems);

  const roots: RootAnalysis['roots'] = [];
  let totalStrength = 0;
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
  const rootFacts = collectAdjudicatedRootFacts(pillars, hiddenStems, dayMasterWuxing, getWuxing);

  rootFacts.forEach((root) => {
    const branchWuxing = resolveWuxing(
      getWuxing,
      pillars[root.position].zhi,
      root.position + '柱地支',
    );
    const isMainQiRoot = branchWuxing === dayMasterWuxing && root.hiddenIndex === 0;
    const clashSources = formatClashSources(root.clashSources);
    if (isMainQiRoot) {
      roots.push({
        position: root.position,
        branch: root.branch,
        stable: root.stable,
        actionable: root.actionable,
        clashStatus: root.clashStatus,
        ...(clashSources.length ? { clashSources } : {}),
        strength: 2,
      });
      totalStrength += 2;
      return;
    }

    roots.push({
      position: root.position,
      branch: root.branch + '(' + root.stem + ')',
      stable: root.stable,
      actionable: root.actionable,
      clashStatus: root.clashStatus,
      ...(clashSources.length ? { clashSources } : {}),
      strength: 1,
    });
    totalStrength += 1;
  });

  return {
    roots,
    totalStrength,
    hasRoot: roots.length > 0,
    // 本气同类与日干同名且在长生、临官、帝旺的稳定藏根均属重根；
    // 长生按日干判断，避免乙日借亥中甲木、戊日借午中己土抬高根气。
    strongRoot: rootFacts.some(
      (root) =>
        root.stable &&
        ((root.hiddenIndex === 0 && getWuxing(root.branch) === dayMasterWuxing) ||
          (root.stem === dayMaster &&
            hasStrongRootStage({ stem: dayMaster, branch: root.branch }))),
    ),
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

  const supporters: SupportAnalysis['supporters'] = [];
  let totalStrength = 0;
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
  const generatingElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  const addSupport = (
    position: string,
    stem: string,
    strength: number,
    stable = true,
    clashSources: string[] = [],
    actionable = stable,
  ) => {
    supporters.push({
      position,
      stem,
      stable,
      actionable,
      ...(clashSources.length ? { clashSources } : {}),
      strength,
    });
    totalStrength += strength;
  };

  Object.entries(pillars).forEach(([position, pillar]) => {
    if (position !== 'day') {
      const stemWuxing = resolveWuxing(getWuxing, pillar.gan, `${position}柱天干`);
      const isCompanion = stemWuxing === dayMasterWuxing;
      const isResource = generatingElement ? stemWuxing === generatingElement : false;

      // 透干印比先核同类根的作用条件；无根浮干仍只保留可见事实。
      if (isCompanion || isResource) {
        const rootFacts = collectAdjudicatedRootFacts(pillars, hiddenStems, stemWuxing, getWuxing);
        addSupport(
          position,
          pillar.gan,
          1,
          rootFacts.some((root) => root.stable),
          formatClashSources(rootFacts.flatMap((root) => root.clashSources)),
          rootFacts.some((root) => root.actionable),
        );
      }
    }

    const branchClashSources = getDirectClashSources(
      pillar.zhi,
      position as keyof Pillars,
      pillars,
    );
    const branchStable = branchClashSources.length === 0;
    if (
      generatingElement &&
      resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`) === generatingElement
    ) {
      const roots = collectAdjudicatedRootFacts(pillars, hiddenStems, generatingElement, getWuxing);
      addSupport(
        position,
        pillar.zhi,
        1,
        branchStable,
        formatClashSources(branchClashSources),
        roots.some(
          (root) => root.position === position && root.hiddenIndex === 0 && root.actionable,
        ),
      );
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

      addSupport(
        position,
        `${pillar.zhi}(${stem})`,
        0.5,
        branchStable,
        formatClashSources(branchClashSources),
      );
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

  const constraints: ConstraintAnalysis['constraints'] = [];
  let totalStrength = 0;
  const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
  const generatedElement = BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing];
  const wealthElement = BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing];
  const officerElement = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(
    ([, target]) => target === dayMasterWuxing,
  )?.[0] as Wuxing | undefined;

  const addConstraint = (
    position: string,
    stem: string,
    strength: number,
    stable = true,
    clashSources: string[] = [],
    actionable = stable,
  ) => {
    constraints.push({
      position,
      stem,
      stable,
      actionable,
      ...(clashSources.length ? { clashSources } : {}),
      strength,
    });
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
        const rootFacts = collectAdjudicatedRootFacts(pillars, hiddenStems, stemWuxing, getWuxing);
        addConstraint(
          position,
          pillar.gan,
          stemStrength,
          rootFacts.some((root) => root.stable),
          formatClashSources(rootFacts.flatMap((root) => root.clashSources)),
          rootFacts.some((root) => root.actionable),
        );
      }
    }

    const branchClashSources = getDirectClashSources(
      pillar.zhi,
      position as keyof Pillars,
      pillars,
    );
    const branchStable = branchClashSources.length === 0;
    const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
    const branchStrength = resolveConstraintStrength(branchWuxing, 1, 1.2);
    if (branchStrength > 0) {
      const roots = collectAdjudicatedRootFacts(pillars, hiddenStems, branchWuxing, getWuxing);
      addConstraint(
        position,
        pillar.zhi,
        branchStrength,
        branchStable,
        formatClashSources(branchClashSources),
        roots.some(
          (root) => root.position === position && root.hiddenIndex === 0 && root.actionable,
        ),
      );
    }

    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      const hiddenWuxing = resolveWuxing(getWuxing, stem, `${position}柱藏干`);
      if (index === 0 && branchStrength > 0 && hiddenWuxing === branchWuxing) {
        return;
      }
      const hiddenStrength = resolveConstraintStrength(hiddenWuxing, 0.5, 0.6);
      if (hiddenStrength > 0) {
        addConstraint(
          position,
          pillar.zhi + '(' + stem + ')',
          hiddenStrength,
          branchStable,
          formatClashSources(branchClashSources),
        );
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

/**
 * 日主强弱综合分析。
 *
 * 月令与司令、根气、透藏与成局分别形成倾向，再由下方条件组合分档。
 * 透干两方使用相同的根气核验口径，存在与有效作用分别记录。
 * strength/totalStrength 为旧接口诊断数据，不参与正式旺衰分档与取用。
 */
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
  const structureTendency = resolveStructureTendency(
    formationAnalysis,
    rootAnalysis,
    supportAnalysis,
    constraintAnalysis,
  );
  const tendencies = [monthTendency, rootTendency, structureTendency];
  const supportingConditions = tendencies.filter((item) => item === '扶身').length;
  const constrainingConditions = tendencies.filter((item) => item === '制身').length;
  const hasSupportingFormation = formationAnalysis.formations.some((formation) =>
    SUPPORTING_FORMATION_EFFECTS.has(formation.effect),
  );
  const hasConstrainingFormation = formationAnalysis.formations.some(
    (formation) => !SUPPORTING_FORMATION_EFFECTS.has(formation.effect),
  );
  const effectiveSupporters = supportAnalysis.supporters.filter(isActionableEvidence);
  const effectiveConstraints = constraintAnalysis.constraints.filter(isActionableEvidence);
  const hasExposedConstraint = constraintAnalysis.constraints.some((item) =>
    (BASIC_MAPPINGS.HEAVENLY_STEMS as readonly string[]).includes(item.stem),
  );

  let status: DayMasterStrengthAnalysis['status'] = '中和';
  if (
    monthTendency === '扶身' &&
    rootAnalysis.strongRoot &&
    structureTendency === '扶身' &&
    effectiveConstraints.length === 0 &&
    !hasExposedConstraint &&
    !hasConstrainingFormation
  ) {
    status = '极强';
  } else if (
    !rootAnalysis.hasRoot &&
    monthTendency !== '扶身' &&
    supportAnalysis.supporters.length === 0 &&
    !hasSupportingFormation
  ) {
    status = '极弱';
  } else if (!rootAnalysis.hasRoot && monthTendency !== '扶身') {
    status = '身弱';
  } else if (
    supportingConditions >= 2 &&
    constrainingConditions === 0 &&
    (rootAnalysis.strongRoot || effectiveSupporters.length >= 2)
  ) {
    status = '身强';
  } else if (supportingConditions > constrainingConditions) {
    status = '偏强';
  } else if (constrainingConditions >= 2 && supportingConditions === 0) {
    status = '身弱';
  } else if (constrainingConditions > supportingConditions) {
    status = '偏弱';
  }

  return {
    status,
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
        `月令与司令合看为${monthTendency}；通根条件为${rootTendency}；成局、明根明透及中余气合看为${structureTendency}（明干本气优先，藏气次级）`,
        '先看得令，再看地支明根，随后比较成局、明透本气与中余气；不把旺相休囚死或司令关系换算成小数总分',
        '生扶与克泄耗的透干均核对同类根气；浮干保留可见事实，得势另看有根作用，透干异党尚在时不据此晋为极强。',
        ...rootAnalysis.roots
          .filter((root) => root.clashStatus === '得令本气受失令异类冲')
          .map(
            (root) =>
              `${ROOT_PILLAR_LABELS[root.position as keyof Pillars]}${root.branch}本气得令，冲源失令且异类，保留其结构根气；受冲事实另列。`,
          ),
        ...rootAnalysis.roots
          .filter((root) => root.clashStatus === '库土本气同类冲动')
          .map(
            (root) =>
              `${ROOT_PILLAR_LABELS[root.position as keyof Pillars]}${root.branch}所藏土本气遇同类库土相冲，属于冲动而非异类冲克，保留其结构根气；是否得用另看全局。`,
          ),
      ],
    },
  };
}
