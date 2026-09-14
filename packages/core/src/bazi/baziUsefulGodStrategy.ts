import { BASIC_MAPPINGS } from './baziDefinitions';
import {
  WUXING,
  type PatternAnalysis,
  type UsefulGodControlFunctionEvidence,
  type UsefulGodAnalysis,
  type UsefulGodDecisionEvidence,
  type Wuxing,
} from './baziTypes';
import {
  applyClimateCandidates,
  applyTherapeuticPriority,
  collectClimateRuleCandidates,
  resolveTherapeuticHint,
  resolveTherapeuticHintRuleId,
  resolveTherapeuticPriorityWuxing,
  type ClimateRuleCandidate,
} from './baziTherapeuticStrategy';
import { BASE_USEFUL_GOD_RULES, type UsefulGodWuxingBundle } from './baziUsefulGodRules';
import {
  matchFirstRule,
  type HiddenStemSource,
  type RuleMatchContext,
  type VisibleStemSource,
} from './baziRuleMatcher';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';
import {
  CLIMATE_RULES,
  STRENGTH_HINT_RULES,
  THERAPEUTIC_PRIORITY_RULES,
} from './baziTherapeuticRules';

interface RuleMetadata {
  id: string;
  label: string;
  description: string;
}

const RULE_CATALOG = [
  ...BASE_USEFUL_GOD_RULES,
  ...CLIMATE_RULES,
  ...STRENGTH_HINT_RULES,
  ...THERAPEUTIC_PRIORITY_RULES,
].reduce<Record<string, RuleMetadata>>((catalog, rule) => {
  catalog[rule.id] = {
    id: rule.id,
    label: rule.label,
    description: rule.description,
  };
  return catalog;
}, {});

function resolveRuleMetadata(ruleId: string): RuleMetadata | null {
  return RULE_CATALOG[ruleId] || null;
}

function resolveRuleMetadataList(ruleIds: string[]): RuleMetadata[] {
  return ruleIds
    .map((ruleId) => resolveRuleMetadata(ruleId))
    .filter((rule): rule is RuleMetadata => Boolean(rule));
}

interface UsefulGodDecisionState {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  trace: string[];
  primaryReason: string;
  matchedRuleIds: string[];
  conditionalFavorableStems?: string[];
  conditionalUnfavorableStems?: string[];
  conditionalFavorableWuxing?: string[];
  decisionEvidence: UsefulGodDecisionEvidence;
}

interface UsefulGodClimateContext {
  strengthStatus?: string;
  yearStem?: string;
  hourBranch?: string;
  currentJieqi?: string;
  visibleStems?: string[];
  visibleStemSources?: VisibleStemSource[];
  hiddenStems?: string[];
  hiddenStemSources?: HiddenStemSource[];
  formationWuxings?: string[];
  wuxingCounts?: Record<string, number>;
}

function assertWuxing(value: string, label: string): asserts value is Wuxing {
  if (!(WUXING as readonly string[]).includes(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

function assertWuxingList(values: string[] | undefined, label: string): void {
  values?.forEach((value) => assertWuxing(value, label));
}

function assertUsefulGodClimateContext(context?: UsefulGodClimateContext): void {
  if (!context) return;

  if (context.yearStem) assertHeavenlyStem(context.yearStem, '年干');
  if (context.hourBranch) assertEarthlyBranch(context.hourBranch, '时支');
  context.visibleStems?.forEach((stem) => assertHeavenlyStem(stem, '明透天干'));
  context.visibleStemSources?.forEach((source) =>
    assertHeavenlyStem(source.stem, `${source.pillar}柱明透天干`),
  );
  context.hiddenStems?.forEach((stem) => assertHeavenlyStem(stem, '藏干'));
  context.hiddenStemSources?.forEach((source) => {
    assertEarthlyBranch(source.branch, `${source.pillar}柱地支`);
    source.stems.forEach((stem) => assertHeavenlyStem(stem, `${source.pillar}柱藏干`));
  });
  assertWuxingList(context.formationWuxings, '成局');
  Object.entries(context.wuxingCounts || {}).forEach(([wuxing, count]) => {
    assertWuxing(wuxing, '五行统计');
    if (!Number.isFinite(count) || count < 0) {
      throw new Error(`五行统计数值无效：${wuxing}=${count}`);
    }
  });
}

function resolveBaseUsefulGodRule(strengthStatus: string, pattern: PatternAnalysis) {
  const specialPatternRules = BASE_USEFUL_GOD_RULES.filter(
    (rule) => Array.isArray(rule.patterns) && rule.patterns.length > 0,
  );
  const ordinaryStrengthRules = BASE_USEFUL_GOD_RULES.filter(
    (rule) => Array.isArray(rule.strengths) && rule.strengths.length > 0,
  );

  if (pattern.isSpecial) {
    return matchFirstRule(specialPatternRules, {
      pattern: pattern.pattern,
      strengthStatus,
    });
  }
  return matchFirstRule(ordinaryStrengthRules, { strengthStatus });
}

function buildDecisionEvidence(
  favorable: string[],
  unfavorable: string[],
  ruleId: string | undefined,
  pattern: PatternAnalysis,
): UsefulGodDecisionEvidence {
  const controlFunctions = buildControlFunctionEvidence(pattern, favorable, unfavorable);
  return {
    base: { favorable: [...favorable], unfavorable: [...unfavorable], ruleId },
    climateCandidates: [],
    controlFunctions,
    controlPaths: pattern.fulfillment?.pathEvaluations,
    controlRemedies: pattern.fulfillment?.remedies,
    appliedLayers: [],
    conflicts: [],
  };
}

function buildControlFunctionEvidence(
  pattern: PatternAnalysis,
  favorableWuxing: string[],
  unfavorableWuxing: string[],
): UsefulGodControlFunctionEvidence[] {
  const fulfillment = pattern.fulfillment;
  if (!fulfillment?.pathEvaluations?.length) return [];

  const rootEvidence = fulfillment.rootEvidence || [];
  const remedies = fulfillment.remedies || [];
  const interactions = fulfillment.interactionEvidence || [];
  const stemWuxing = (stem: string): string => {
    const index = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(stem as never);
    return index >= 0 ? BASIC_MAPPINGS.STEM_WUXING[index] : '';
  };

  return fulfillment.pathEvaluations.map((path) => {
    const sourceStems = [...new Set(path.sourceStems || [])];
    const targetStems = [...new Set(path.targetStems || [])];
    const pathStems = new Set([...sourceStems, ...targetStems]);
    const pathInteractions = interactions.filter(
      (interaction) => interaction.relation === path.key,
    );
    const sourceRootEvidence = rootEvidence.filter((evidence) =>
      sourceStems.includes(evidence.stem),
    );
    const targetRootEvidence = rootEvidence.filter((evidence) =>
      targetStems.includes(evidence.stem),
    );
    const evidenceGaps = [
      ...(path.status === '满足' ? [] : [`路径:${path.status}`]),
      ...(sourceStems.length && !sourceRootEvidence.length ? ['来源根气'] : []),
      ...(targetStems.length && !targetRootEvidence.length ? ['对象根气'] : []),
      ...(path.position === '紧贴' ? [] : [`位置:${path.position}`]),
      ...pathInteractions
        .filter((interaction) => interaction.status !== '满足')
        .map((interaction) => `作用:${interaction.relation}:${interaction.status}`),
    ];
    return {
      key: path.key,
      label: path.label,
      status: path.status,
      sourceStems,
      targetStems,
      position: path.position,
      positionPairs: [...path.positionPairs],
      sourceRootEvidence,
      targetRootEvidence,
      remedies: remedies.filter((remedy) => pathStems.has(remedy.stem)),
      interactionEvidence: pathInteractions,
      baseFavorableStems: [...pathStems].filter((stem) =>
        favorableWuxing.includes(stemWuxing(stem)),
      ),
      baseUnfavorableStems: [...pathStems].filter((stem) =>
        unfavorableWuxing.includes(stemWuxing(stem)),
      ),
      evidenceGaps,
      detail: path.detail,
    };
  });
}

function buildBaseDecisionState(
  strengthStatus: string,
  pattern: PatternAnalysis,
  dmWuxing: string,
): UsefulGodDecisionState {
  const sheng = BASIC_MAPPINGS.WUXING_SHENG;
  const ke = BASIC_MAPPINGS.WUXING_KE;
  const getKeMe = (me: string) => Object.keys(ke).find((key) => ke[key] === me) || '';
  const getShengMe = (me: string) => Object.keys(sheng).find((key) => sheng[key] === me) || '';

  const companion = dmWuxing;
  const output = sheng[dmWuxing];
  const wealth = ke[dmWuxing];
  const officer = getKeMe(dmWuxing);
  const resource = getShengMe(dmWuxing);
  const bundles: Record<UsefulGodWuxingBundle, string[]> = {
    resource_companion_output: [resource, companion, output].filter(Boolean),
    wealth_officer: [wealth, officer].filter(Boolean),
    output_wealth_officer: [output, wealth, officer].filter(Boolean),
    resource_companion: [resource, companion].filter(Boolean),
  };

  const ordinaryPatternTrace = pattern.isSpecial
    ? []
    : [`普通格局:${pattern.pattern}，喜忌先按${strengthStatus}扶抑登记基线，不因格名直接改判`];
  const matchedRule = resolveBaseUsefulGodRule(strengthStatus, pattern);
  const favorable = matchedRule ? bundles[matchedRule.favorable] : bundles.output_wealth_officer;
  const unfavorable = matchedRule ? bundles[matchedRule.unfavorable] : bundles.resource_companion;
  const trace = matchedRule
    ? [...ordinaryPatternTrace, matchedRule.trace]
    : [...ordinaryPatternTrace, '默认取泄耗克'];
  const primaryReason = matchedRule?.primaryReason || '扶抑';
  const decisionEvidence = buildDecisionEvidence(favorable, unfavorable, matchedRule?.id, pattern);
  decisionEvidence.appliedLayers.push(primaryReason);

  const validPaths = (pattern.fulfillment?.pathEvaluations || []).filter(
    (path) => path.status === '满足',
  );
  if (validPaths.length) {
    const functionSummaries = decisionEvidence.controlFunctions
      ?.filter((candidate) => candidate.status === '满足')
      .map(
        (candidate) =>
          `${candidate.key}[${candidate.sourceStems.join('、')} -> ${candidate.targetStems.join('、')}]` +
          `${candidate.baseFavorableStems.length ? `，涉及基础喜神${candidate.baseFavorableStems.join('、')}` : ''}` +
          `${candidate.baseUnfavorableStems.length ? `，涉及基础忌神${candidate.baseUnfavorableStems.join('、')}` : ''}`,
      )
      .join('；');
    trace.push(
      `制化证据满足:${functionSummaries || validPaths.map((path) => path.key).join('、')}`,
    );
  }
  const uncertainPaths = (pattern.fulfillment?.pathEvaluations || []).filter(
    (path) => path.status === '资料不足',
  );
  if (uncertainPaths.length) {
    trace.push(`制化证据待核:${uncertainPaths.map((path) => path.key).join('、')}；不直接改喜忌`);
  }

  return {
    favorableWuxing: [...favorable],
    unfavorableWuxing: [...unfavorable],
    trace,
    primaryReason,
    matchedRuleIds: matchedRule ? [matchedRule.id] : [],
    decisionEvidence,
  };
}

function resolveCommanderWuxing(monthCommander?: string, isPatternSpecial?: boolean): string {
  if (!monthCommander || isPatternSpecial) return '';
  const stemIndex = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(monthCommander as never);
  return stemIndex === -1 ? '' : BASIC_MAPPINGS.STEM_WUXING[stemIndex];
}

function applyCommanderAdjustment(
  state: UsefulGodDecisionState,
  commanderWuxing: string,
): { state: UsefulGodDecisionState; adjusted: boolean } {
  if (!commanderWuxing || !state.favorableWuxing.includes(commanderWuxing)) {
    return { state, adjusted: false };
  }

  const favorableWuxing = [
    commanderWuxing,
    ...state.favorableWuxing.filter((wx) => wx !== commanderWuxing),
  ];
  const appliedLayers = state.decisionEvidence.appliedLayers.includes('司令')
    ? state.decisionEvidence.appliedLayers
    : [...state.decisionEvidence.appliedLayers, '司令'];
  return {
    state: {
      ...state,
      favorableWuxing,
      trace: [...state.trace, `司令排序:${commanderWuxing}`],
      primaryReason: state.primaryReason === '调候' ? state.primaryReason : '司令',
      decisionEvidence: {
        ...state.decisionEvidence,
        appliedLayers,
      },
    },
    adjusted: true,
  };
}

function buildWuxingToTenGodMap(dmWuxing: string): Record<string, string[]> {
  const sheng = BASIC_MAPPINGS.WUXING_SHENG;
  const ke = BASIC_MAPPINGS.WUXING_KE;
  const getKeMe = (me: string) => Object.keys(ke).find((key) => ke[key] === me) || '';
  const getShengMe = (me: string) => Object.keys(sheng).find((key) => sheng[key] === me) || '';
  const output = sheng[dmWuxing];
  const wealth = ke[dmWuxing];
  const officer = getKeMe(dmWuxing);
  const resource = getShengMe(dmWuxing);

  return {
    [dmWuxing]: ['比肩', '劫财'],
    [output]: ['食神', '伤官'],
    [wealth]: ['正财', '偏财'],
    [officer]: ['正官', '七杀'],
    [resource]: ['正印', '偏印'],
  };
}

function resolveTenGodCategoryLabel(dmWuxing: string, targetWuxing: string): string {
  const sheng = BASIC_MAPPINGS.WUXING_SHENG;
  const ke = BASIC_MAPPINGS.WUXING_KE;
  const generated = sheng[dmWuxing];
  const wealth = ke[dmWuxing];
  const officer = Object.keys(ke).find((key) => ke[key] === dmWuxing) || '';
  const resource = Object.keys(sheng).find((key) => sheng[key] === dmWuxing) || '';

  if (targetWuxing === dmWuxing) return '比劫';
  if (targetWuxing === generated) return '食伤';
  if (targetWuxing === wealth) return '财星';
  if (targetWuxing === officer) return '官杀';
  if (targetWuxing === resource) return '印星';
  return '待定';
}

function addClimateEvidence(
  state: UsefulGodDecisionState,
  candidates: ClimateRuleCandidate[],
  climateAppliedRuleIds: string[],
  referenceOrder: string[],
  conflicts: string[],
  conflictRuleIds: string[],
): UsefulGodDecisionState {
  const appliedRuleIds = new Set(climateAppliedRuleIds);
  const conflictIds = new Set(conflictRuleIds);
  const climateCandidates = candidates.map((candidate) => ({
    ruleId: candidate.rule.id,
    mode: candidate.mode,
    status: conflictIds.has(candidate.rule.id) ? ('冲突' as const) : candidate.status,
    requestedOrder: [...candidate.requestedOrder],
    missingInputs: candidate.missingInputs,
    effects: candidate.rule.policy?.effects,
    adopted: appliedRuleIds.has(candidate.rule.id),
  }));
  const nextConflicts = [...state.decisionEvidence.conflicts, ...conflicts];
  const nextTrace = [...state.trace];
  if (referenceOrder.length) {
    nextTrace.push(`调候参考:${referenceOrder.join(' -> ')}`);
  }
  if (conflicts.length) nextTrace.push(...conflicts);
  const appliedCandidate = candidates.find((candidate) => appliedRuleIds.has(candidate.rule.id));
  const appliedLayers = [...state.decisionEvidence.appliedLayers];
  if (appliedCandidate && appliedCandidate.mode !== 'reference') {
    const layer = appliedCandidate.mode === 'conditional' ? '调候' : '调候参考';
    if (!appliedLayers.includes(layer)) appliedLayers.push(layer);
  }
  return {
    ...state,
    trace: nextTrace,
    matchedRuleIds: appliedRuleIds.size
      ? [...new Set([...state.matchedRuleIds, ...appliedRuleIds])]
      : state.matchedRuleIds,
    decisionEvidence: {
      ...state.decisionEvidence,
      climateCandidates,
      climateReferenceOrder: referenceOrder.length ? [...referenceOrder] : undefined,
      climateAppliedRuleId: climateAppliedRuleIds[0],
      climateAppliedRuleIds: climateAppliedRuleIds.length ? [...climateAppliedRuleIds] : undefined,
      conditionalFavorableStems: state.conditionalFavorableStems,
      conditionalUnfavorableStems: state.conditionalUnfavorableStems,
      conditionalFavorableWuxing: state.conditionalFavorableWuxing,
      appliedLayers,
      conflicts: nextConflicts,
    },
  };
}

function finalizeUsefulGodAnalysis(
  state: UsefulGodDecisionState,
  dmWuxing: string,
): UsefulGodAnalysis & {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  strategyTrace: string[];
  primaryReason: string;
} {
  const wuxingToTenGodMap = buildWuxingToTenGodMap(dmWuxing);
  const primaryFavorableWuxing = state.favorableWuxing[0] || '';
  const secondaryFavorableWuxing = state.favorableWuxing.slice(1);
  const primaryUnfavorableWuxing = state.unfavorableWuxing[0] || '';
  const secondaryUnfavorableWuxing = state.unfavorableWuxing.slice(1);
  const favorableGods = state.favorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []);
  const unfavorableGods = state.unfavorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []);
  const primaryFavorableGods = primaryFavorableWuxing
    ? wuxingToTenGodMap[primaryFavorableWuxing] || []
    : [];
  const secondaryFavorableGods = secondaryFavorableWuxing.flatMap(
    (wx) => wuxingToTenGodMap[wx] || [],
  );
  const primaryUnfavorableGods = primaryUnfavorableWuxing
    ? wuxingToTenGodMap[primaryUnfavorableWuxing] || []
    : [];
  const secondaryUnfavorableGods = secondaryUnfavorableWuxing.flatMap(
    (wx) => wuxingToTenGodMap[wx] || [],
  );
  const usefulGod = primaryFavorableWuxing
    ? resolveTenGodCategoryLabel(dmWuxing, primaryFavorableWuxing)
    : '暂无';
  const avoidGod = primaryUnfavorableWuxing
    ? resolveTenGodCategoryLabel(dmWuxing, primaryUnfavorableWuxing)
    : '暂无';

  return {
    favorable: favorableGods,
    unfavorable: unfavorableGods,
    primaryFavorable: primaryFavorableGods,
    secondaryFavorable: secondaryFavorableGods,
    primaryUnfavorable: primaryUnfavorableGods,
    secondaryUnfavorable: secondaryUnfavorableGods,
    useful: usefulGod,
    avoid: avoidGod,
    favorableWuxing: state.favorableWuxing,
    unfavorableWuxing: state.unfavorableWuxing,
    primaryFavorableWuxing,
    secondaryFavorableWuxing,
    primaryUnfavorableWuxing,
    secondaryUnfavorableWuxing,
    primaryUseful: usefulGod,
    primaryAvoid: avoidGod,
    conditionalFavorableStems: state.conditionalFavorableStems,
    conditionalUnfavorableStems: state.conditionalUnfavorableStems,
    conditionalFavorableWuxing: state.conditionalFavorableWuxing,
    decisionEvidence: state.decisionEvidence,
    strategyTrace: state.trace,
    primaryReason: state.primaryReason,
    matchedRules: resolveRuleMetadataList(state.matchedRuleIds),
  };
}

export function determineUsefulGod(
  strengthStatus: string,
  pattern: PatternAnalysis,
  dmWuxing: string,
  monthBranch?: string,
  monthCommander?: string,
  dayMasterStem?: string,
  climateContext?: UsefulGodClimateContext,
): UsefulGodAnalysis & {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  strategyTrace: string[];
  primaryReason: string;
} {
  assertWuxing(dmWuxing, '日主');
  if (monthBranch) assertEarthlyBranch(monthBranch, '月支');
  if (monthCommander) assertHeavenlyStem(monthCommander, '月令司权天干');
  if (dayMasterStem) assertHeavenlyStem(dayMasterStem, '日主天干');
  assertUsefulGodClimateContext(climateContext);

  const isPatternSpecial = pattern.isSpecial;
  const baseState = buildBaseDecisionState(strengthStatus, pattern, dmWuxing);
  const yearStem = climateContext?.yearStem;
  const hourBranch = climateContext?.hourBranch;
  const currentJieqi = climateContext?.currentJieqi;
  const visibleStems = climateContext?.visibleStems;
  const visibleStemSources = climateContext?.visibleStemSources;
  const hiddenStems = climateContext?.hiddenStems;
  const hiddenStemSources = climateContext?.hiddenStemSources;
  const formationWuxings = climateContext?.formationWuxings;
  const wuxingCounts = climateContext?.wuxingCounts;
  const climateContextWithStrength: RuleMatchContext = {
    strengthStatus,
    yearStem,
    monthBranch,
    hourBranch,
    dayMaster: dmWuxing,
    dayStem: dayMasterStem,
    currentJieqi,
    visibleStems,
    visibleStemSources,
    hiddenStems,
    hiddenStemSources,
    formationWuxings,
    wuxingCounts,
  };
  const climateCandidates = collectClimateRuleCandidates(climateContextWithStrength, {
    isPatternSpecial,
  });
  const climateDecision = applyClimateCandidates(baseState, climateCandidates);
  const climatePrimaryCandidate =
    climateDecision.appliedCandidate ||
    climateCandidates.find((candidate) => candidate.status === '满足');
  let state = addClimateEvidence(
    climateDecision.state,
    climateCandidates,
    climateDecision.appliedCandidateIds || [],
    climateDecision.referenceOrder,
    climateDecision.conflicts,
    climateDecision.conflictRuleIds || [],
  );
  if (climatePrimaryCandidate && !(climateDecision.appliedCandidateIds || []).length) {
    state = {
      ...state,
      matchedRuleIds: [...new Set([...state.matchedRuleIds, climatePrimaryCandidate.rule.id])],
    };
  }

  const commanderWuxing = resolveCommanderWuxing(monthCommander, isPatternSpecial);
  const commanderDecision = applyCommanderAdjustment(state, commanderWuxing);
  state = commanderDecision.state;

  // 参考型调候不能屏蔽病药；病药只在当前综合喜神中排序，不会把忌神加入喜用。
  const therapeuticRule = matchFirstRule(THERAPEUTIC_PRIORITY_RULES, {
    monthBranch,
    strengthStatus,
    dayMaster: dmWuxing,
    dayStem: dayMasterStem,
  });
  const therapeuticPriorityWuxing = resolveTherapeuticPriorityWuxing(
    strengthStatus,
    dmWuxing,
    dayMasterStem,
    monthBranch,
    isPatternSpecial,
    BASIC_MAPPINGS.WUXING_SHENG,
  );
  const therapeuticDecision = applyTherapeuticPriority(state, therapeuticPriorityWuxing);
  state = therapeuticDecision.state;
  if (therapeuticDecision.adjusted) {
    state.matchedRuleIds = therapeuticRule?.id
      ? [...new Set([...state.matchedRuleIds, therapeuticRule.id])]
      : state.matchedRuleIds;
    if (!state.decisionEvidence.appliedLayers.includes('病药')) {
      state.decisionEvidence.appliedLayers.push('病药');
    }
  }

  const therapeuticHint = resolveTherapeuticHint(
    strengthStatus,
    dmWuxing,
    yearStem,
    dayMasterStem,
    monthBranch,
    hourBranch,
    currentJieqi,
    visibleStems,
    visibleStemSources,
    hiddenStems,
    hiddenStemSources,
    formationWuxings,
    wuxingCounts,
  );
  const therapeuticHintRuleId = resolveTherapeuticHintRuleId(
    strengthStatus,
    dmWuxing,
    yearStem,
    dayMasterStem,
    monthBranch,
    hourBranch,
    currentJieqi,
    visibleStems,
    visibleStemSources,
    hiddenStems,
    hiddenStemSources,
    formationWuxings,
    wuxingCounts,
  );
  if (therapeuticHintRuleId && !state.matchedRuleIds.includes(therapeuticHintRuleId)) {
    state.matchedRuleIds.push(therapeuticHintRuleId);
  }

  const finalTrace = [
    ...state.trace,
    ...(therapeuticHint ? [`病药提示:${therapeuticHint}`] : []),
    `最终取用:${state.favorableWuxing.join(' -> ')}`,
  ];
  return finalizeUsefulGodAnalysis(
    {
      ...state,
      trace: finalTrace,
    },
    dmWuxing,
  );
}
