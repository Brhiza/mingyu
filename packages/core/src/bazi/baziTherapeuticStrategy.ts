import {
  type ClimateRule,
  CLIMATE_RULES,
  STRENGTH_HINT_RULES,
  THERAPEUTIC_PRIORITY_RULES,
} from './baziTherapeuticRules';
import { matchFirstRule, type HiddenStemSource, type VisibleStemSource } from './baziRuleMatcher';

interface UsefulGodDecisionStateLike {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  trace: string[];
  primaryReason: string;
}

function resolveTherapeuticHintRule(
  strengthStatus: string,
  dmWuxing: string,
  yearStem?: string,
  dayMasterStem?: string,
  monthBranch?: string,
  hourBranch?: string,
  currentJieqi?: string,
  visibleStems?: string[],
  visibleStemSources?: VisibleStemSource[],
  hiddenStems?: string[],
  hiddenStemSources?: HiddenStemSource[],
  formationWuxings?: string[],
  wuxingCounts?: Record<string, number>,
  externalPatternEligible?: boolean,
) {
  if (!monthBranch) {
    return null;
  }

  const climateRule = matchFirstRule(CLIMATE_RULES, {
    externalPatternEligible,
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
  if (climateRule) {
    return climateRule;
  }

  return (
    matchFirstRule(STRENGTH_HINT_RULES, {
      strengthStatus,
    }) || null
  );
}

export function resolveTherapeuticHint(
  strengthStatus: string,
  dmWuxing: string,
  yearStem?: string,
  dayMasterStem?: string,
  monthBranch?: string,
  hourBranch?: string,
  currentJieqi?: string,
  visibleStems?: string[],
  visibleStemSources?: VisibleStemSource[],
  hiddenStems?: string[],
  hiddenStemSources?: HiddenStemSource[],
  formationWuxings?: string[],
  wuxingCounts?: Record<string, number>,
  externalPatternEligible?: boolean,
): string {
  return (
    resolveTherapeuticHintRule(
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
      externalPatternEligible,
    )?.hint || ''
  );
}

export function resolveTherapeuticHintRuleId(
  strengthStatus: string,
  dmWuxing: string,
  yearStem?: string,
  dayMasterStem?: string,
  monthBranch?: string,
  hourBranch?: string,
  currentJieqi?: string,
  visibleStems?: string[],
  visibleStemSources?: VisibleStemSource[],
  hiddenStems?: string[],
  hiddenStemSources?: HiddenStemSource[],
  formationWuxings?: string[],
  wuxingCounts?: Record<string, number>,
  externalPatternEligible?: boolean,
): string {
  return (
    resolveTherapeuticHintRule(
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
      externalPatternEligible,
    )?.id || ''
  );
}

function normalizeWuxingOrder(order: string[]): string[] {
  return [...new Set(order.filter(Boolean))];
}

function matchClimateRule(
  dmWuxing: string,
  yearStem: string | undefined,
  dayMasterStem: string | undefined,
  monthBranch: string | undefined,
  hourBranch: string | undefined,
  isPatternSpecial: boolean,
  currentJieqi?: string,
  visibleStems?: string[],
  visibleStemSources?: VisibleStemSource[],
  hiddenStems?: string[],
  hiddenStemSources?: HiddenStemSource[],
  formationWuxings?: string[],
  wuxingCounts?: Record<string, number>,
  externalPatternEligible?: boolean,
): ClimateRule | undefined {
  if (!monthBranch || isPatternSpecial) {
    return undefined;
  }

  return matchFirstRule(CLIMATE_RULES, {
    externalPatternEligible,
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
}

export function resolveTherapeuticPriorityWuxing(
  strengthStatus: string,
  dmWuxing: string,
  dayMasterStem: string | undefined,
  monthBranch: string | undefined,
  isPatternSpecial: boolean,
  wuxingSheng: Record<string, string>,
): string {
  if (!monthBranch || isPatternSpecial) {
    return '';
  }

  const priorityRule = matchFirstRule(THERAPEUTIC_PRIORITY_RULES, {
    monthBranch,
    strengthStatus,
    dayMaster: dmWuxing,
    dayStem: dayMasterStem,
  });

  if (!priorityRule) {
    return '';
  }

  if (priorityRule.useGeneratedElement) {
    return wuxingSheng[dmWuxing] || '';
  }

  return '';
}

export function resolveClimateUsefulWuxing(
  dmWuxing: string,
  yearStem: string | undefined,
  dayMasterStem: string | undefined,
  monthBranch: string | undefined,
  hourBranch: string | undefined,
  isPatternSpecial: boolean,
  currentJieqi?: string,
  visibleStems?: string[],
  visibleStemSources?: VisibleStemSource[],
  hiddenStems?: string[],
  hiddenStemSources?: HiddenStemSource[],
  formationWuxings?: string[],
  wuxingCounts?: Record<string, number>,
  externalPatternEligible?: boolean,
): string {
  return (
    resolveClimateFavorableOrder(
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
      externalPatternEligible,
    )[0] || ''
  );
}

export function resolveClimateFavorableOrder(
  dmWuxing: string,
  yearStem: string | undefined,
  dayMasterStem: string | undefined,
  monthBranch: string | undefined,
  hourBranch: string | undefined,
  isPatternSpecial: boolean,
  currentJieqi?: string,
  visibleStems?: string[],
  visibleStemSources?: VisibleStemSource[],
  hiddenStems?: string[],
  hiddenStemSources?: HiddenStemSource[],
  formationWuxings?: string[],
  wuxingCounts?: Record<string, number>,
  externalPatternEligible?: boolean,
): string[] {
  const climateRule = matchClimateRule(
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
    externalPatternEligible,
  );
  if (!climateRule) {
    return [];
  }

  return normalizeWuxingOrder([...(climateRule.favorableOrder || []), climateRule.usefulWuxing]);
}

export function applyClimateAdjustment<T extends UsefulGodDecisionStateLike>(
  state: T,
  climateFavorableOrder: string[],
): { state: T; adjusted: boolean } {
  const normalizedOrder = normalizeWuxingOrder(climateFavorableOrder);
  if (normalizedOrder.length === 0) {
    return { state, adjusted: false };
  }

  return {
    state: {
      ...state,
      favorableWuxing: [
        ...normalizedOrder,
        ...state.favorableWuxing.filter((wx) => !normalizedOrder.includes(wx)),
      ],
      unfavorableWuxing: state.unfavorableWuxing.filter((wx) => !normalizedOrder.includes(wx)),
      trace: [...state.trace, `调候优先:${normalizedOrder.join(' -> ')}`],
      primaryReason: '调候',
    } as T,
    adjusted: true,
  };
}

export function applyTherapeuticPriority<T extends UsefulGodDecisionStateLike>(
  state: T,
  therapeuticWuxing: string,
): { state: T; adjusted: boolean } {
  if (!therapeuticWuxing || !state.favorableWuxing.includes(therapeuticWuxing)) {
    return { state, adjusted: false };
  }

  return {
    state: {
      ...state,
      favorableWuxing: [
        therapeuticWuxing,
        ...state.favorableWuxing.filter((wx) => wx !== therapeuticWuxing),
      ],
      trace: [...state.trace, `病药优先:${therapeuticWuxing}`],
      primaryReason: '病药',
    } as T,
    adjusted: true,
  };
}
