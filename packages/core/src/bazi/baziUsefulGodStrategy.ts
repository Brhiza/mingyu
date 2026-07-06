import { BASIC_MAPPINGS } from './baziDefinitions';
import { WUXING, type PatternAnalysis, type UsefulGodAnalysis, type Wuxing } from './baziTypes';
import {
  applyClimateAdjustment,
  applyTherapeuticPriority,
  resolveClimateFavorableOrder,
  resolveClimateUsefulWuxing,
  resolveTherapeuticHint,
  resolveTherapeuticHintRuleId,
  resolveTherapeuticPriorityWuxing,
} from './baziTherapeuticStrategy';
import { BASE_USEFUL_GOD_RULES, type UsefulGodWuxingBundle } from './baziUsefulGodRules';
import { matchFirstRule, type HiddenStemSource, type VisibleStemSource } from './baziRuleMatcher';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';
import {
  CLIMATE_RULES,
  STRENGTH_HINT_RULES,
  THERAPEUTIC_PRIORITY_RULES,
} from './baziTherapeuticRules';
// ---- 规则元数据目录（从 baziRuleCatalog 合并） ----

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

// ---- 用神决策逻辑 ----

interface UsefulGodDecisionState {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  trace: string[];
  primaryReason: string;
  matchedRuleIds: string[];
}

interface UsefulGodClimateContext {
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
  if (!context) {
    return;
  }

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

  return matchFirstRule(ordinaryStrengthRules, {
    strengthStatus,
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
    : [`普通格局:${pattern.pattern}，喜忌先按${strengthStatus}扶抑，不因格名直接改判`];
  const matchedRule = resolveBaseUsefulGodRule(strengthStatus, pattern);

  if (!matchedRule) {
    return {
      favorableWuxing: bundles.output_wealth_officer,
      unfavorableWuxing: bundles.resource_companion,
      trace: [...ordinaryPatternTrace, '默认取泄耗克'],
      primaryReason: '扶抑',
      matchedRuleIds: [],
    };
  }

  return {
    favorableWuxing: bundles[matchedRule.favorable],
    unfavorableWuxing: bundles[matchedRule.unfavorable],
    trace: [...ordinaryPatternTrace, matchedRule.trace],
    primaryReason: matchedRule.primaryReason,
    matchedRuleIds: [matchedRule.id],
  };
}

function resolveCommanderWuxing(monthCommander?: string, isPatternSpecial?: boolean): string {
  if (!monthCommander || isPatternSpecial) {
    return '';
  }

  const stemIndex = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(monthCommander as never);
  if (stemIndex === -1) {
    return '';
  }

  return BASIC_MAPPINGS.STEM_WUXING[stemIndex];
}

function applyCommanderAdjustment(
  state: UsefulGodDecisionState,
  commanderWuxing: string,
  climateUsefulWuxing: string,
  climateAdjusted: boolean,
): { state: UsefulGodDecisionState; adjusted: boolean } {
  if (!commanderWuxing || !state.favorableWuxing.includes(commanderWuxing)) {
    return { state, adjusted: false };
  }

  const reordered = state.favorableWuxing.filter((wx) => wx !== commanderWuxing);
  const favorableWuxing =
    climateAdjusted && climateUsefulWuxing && commanderWuxing !== climateUsefulWuxing
      ? [
          climateUsefulWuxing,
          commanderWuxing,
          ...reordered.filter((wx) => wx !== climateUsefulWuxing),
        ]
      : [commanderWuxing, ...reordered];

  return {
    state: {
      ...state,
      favorableWuxing,
      trace: [...state.trace, `司令排序:${commanderWuxing}`],
      primaryReason: state.primaryReason === '调候' ? state.primaryReason : '司令',
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

  if (targetWuxing === dmWuxing) {
    return '比劫';
  }
  if (targetWuxing === generated) {
    return '食伤';
  }
  if (targetWuxing === wealth) {
    return '财星';
  }
  if (targetWuxing === officer) {
    return '官杀';
  }
  if (targetWuxing === resource) {
    return '印星';
  }

  return '待定';
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
  const climateRule = matchFirstRule(CLIMATE_RULES, {
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
  });
  const climateFavorableOrder = resolveClimateFavorableOrder(
    dmWuxing,
    yearStem,
    dayMasterStem,
    monthBranch,
    hourBranch,
    isPatternSpecial,
    currentJieqi,
    visibleStems,
    visibleStemSources,
    hiddenStems,
    hiddenStemSources,
    formationWuxings,
    wuxingCounts,
  );
  const climateUsefulWuxing =
    climateFavorableOrder[0] ||
    resolveClimateUsefulWuxing(
      dmWuxing,
      yearStem,
      dayMasterStem,
      monthBranch,
      hourBranch,
      isPatternSpecial,
      currentJieqi,
      visibleStems,
      visibleStemSources,
      hiddenStems,
      hiddenStemSources,
      formationWuxings,
      wuxingCounts,
    );
  const climateDecision = applyClimateAdjustment(baseState, climateFavorableOrder);
  if (
    climateDecision.adjusted &&
    climateRule?.id &&
    !climateDecision.state.matchedRuleIds.includes(climateRule.id)
  ) {
    climateDecision.state.matchedRuleIds.push(climateRule.id);
  }
  if (climateDecision.adjusted && climateRule?.traceHints?.length) {
    climateDecision.state.trace.push(...climateRule.traceHints);
  }

  const commanderWuxing = resolveCommanderWuxing(monthCommander, isPatternSpecial);
  const commanderDecision = applyCommanderAdjustment(
    climateDecision.state,
    commanderWuxing,
    climateUsefulWuxing,
    climateDecision.adjusted,
  );

  const therapeuticRule = climateDecision.adjusted
    ? undefined
    : matchFirstRule(THERAPEUTIC_PRIORITY_RULES, {
        monthBranch,
        strengthStatus,
        dayMaster: dmWuxing,
        dayStem: dayMasterStem,
      });
  const therapeuticPriorityWuxing = climateDecision.adjusted
    ? ''
    : resolveTherapeuticPriorityWuxing(
        strengthStatus,
        dmWuxing,
        dayMasterStem,
        monthBranch,
        isPatternSpecial,
        BASIC_MAPPINGS.WUXING_SHENG,
      );
  const therapeuticDecision = applyTherapeuticPriority(
    commanderDecision.state,
    therapeuticPriorityWuxing,
  );
  if (
    therapeuticDecision.adjusted &&
    therapeuticRule?.id &&
    !therapeuticDecision.state.matchedRuleIds.includes(therapeuticRule.id)
  ) {
    therapeuticDecision.state.matchedRuleIds.push(therapeuticRule.id);
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
  if (
    therapeuticHintRuleId &&
    !therapeuticDecision.state.matchedRuleIds.includes(therapeuticHintRuleId)
  ) {
    therapeuticDecision.state.matchedRuleIds.push(therapeuticHintRuleId);
  }

  return finalizeUsefulGodAnalysis(
    {
      ...therapeuticDecision.state,
      trace: [
        ...therapeuticDecision.state.trace,
        ...(therapeuticHint ? [`病药提示:${therapeuticHint}`] : []),
        `最终取用:${therapeuticDecision.state.favorableWuxing.join(' -> ')}`,
      ],
    },
    dmWuxing,
  );
}
