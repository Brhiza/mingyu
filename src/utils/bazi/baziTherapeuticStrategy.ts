import {
  CLIMATE_RULES,
  STRENGTH_HINT_RULES,
  THERAPEUTIC_PRIORITY_RULES
} from './baziTherapeuticRules'
import { matchFirstRule } from './baziRuleMatcher'

interface UsefulGodDecisionStateLike {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  trace: string[];
  primaryReason: string;
}

function resolveTherapeuticHintRule(
  strengthStatus: string,
  dmWuxing: string,
  monthBranch?: string
) {
  if (!monthBranch) {
    return null
  }

  const climateRule = matchFirstRule(CLIMATE_RULES, {
    monthBranch,
    dayMaster: dmWuxing
  })
  if (climateRule) {
    return climateRule
  }

  return matchFirstRule(STRENGTH_HINT_RULES, {
    strengthStatus
  }) || null
}

export function resolveTherapeuticHint(
  strengthStatus: string,
  dmWuxing: string,
  monthBranch?: string
): string {
  return resolveTherapeuticHintRule(strengthStatus, dmWuxing, monthBranch)?.hint || ''
}

export function resolveTherapeuticHintRuleId(
  strengthStatus: string,
  dmWuxing: string,
  monthBranch?: string
): string {
  return resolveTherapeuticHintRule(strengthStatus, dmWuxing, monthBranch)?.id || ''
}

export function resolveTherapeuticPriorityWuxing(
  strengthStatus: string,
  dmWuxing: string,
  monthBranch: string | undefined,
  isPatternSpecial: boolean,
  wuxingSheng: Record<string, string>
): string {
  if (!monthBranch || isPatternSpecial) {
    return ''
  }

  const priorityRule = matchFirstRule(THERAPEUTIC_PRIORITY_RULES, {
    monthBranch,
    strengthStatus
  })

  if (!priorityRule) {
    return ''
  }

  if (priorityRule.useGeneratedElement) {
    return wuxingSheng[dmWuxing] || ''
  }

  return ''
}

export function resolveClimateUsefulWuxing(
  dmWuxing: string,
  monthBranch: string | undefined,
  isPatternSpecial: boolean
): string {
  if (!monthBranch || isPatternSpecial) {
    return ''
  }

  return matchFirstRule(CLIMATE_RULES, {
    monthBranch,
    dayMaster: dmWuxing
  })?.usefulWuxing || ''
}

export function applyClimateAdjustment<T extends UsefulGodDecisionStateLike>(
  state: T,
  climateUsefulWuxing: string
): { state: T; adjusted: boolean } {
  if (!climateUsefulWuxing) {
    return { state, adjusted: false }
  }

  return {
    state: {
      ...state,
      favorableWuxing: [
        climateUsefulWuxing,
        ...state.favorableWuxing.filter(wx => wx !== climateUsefulWuxing)
      ],
      unfavorableWuxing: state.unfavorableWuxing.filter(wx => wx !== climateUsefulWuxing),
      trace: [...state.trace, `调候优先:${climateUsefulWuxing}`],
      primaryReason: '调候'
    } as T,
    adjusted: true
  }
}

export function applyTherapeuticPriority<T extends UsefulGodDecisionStateLike>(
  state: T,
  therapeuticWuxing: string
): { state: T; adjusted: boolean } {
  if (!therapeuticWuxing || !state.favorableWuxing.includes(therapeuticWuxing)) {
    return { state, adjusted: false }
  }

  return {
    state: {
      ...state,
      favorableWuxing: [
        therapeuticWuxing,
        ...state.favorableWuxing.filter(wx => wx !== therapeuticWuxing)
      ],
      trace: [...state.trace, `病药优先:${therapeuticWuxing}`],
      primaryReason: '病药'
    } as T,
    adjusted: true
  }
}
