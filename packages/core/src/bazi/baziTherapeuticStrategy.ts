import { BASIC_MAPPINGS } from './baziDefinitions';
import {
  type ClimateRule,
  type ClimateRuleEffect,
  type ClimateRuleMode,
  type StrengthHintRule,
  CLIMATE_RULES,
  STRENGTH_HINT_RULES,
  THERAPEUTIC_PRIORITY_RULES,
} from './baziTherapeuticRules';
import {
  assessRuleMatch,
  matchFirstRule,
  type HiddenStemSource,
  type RuleMatchContext,
  type VisibleStemSource,
} from './baziRuleMatcher';

export type ClimateRuleMatchStatus = '满足' | '不满足' | '资料不足';

export interface ClimateRuleCandidate {
  rule: ClimateRule;
  status: ClimateRuleMatchStatus;
  missingInputs: string[];
  mode: ClimateRuleMode;
  requestedOrder: string[];
  primaryEffects: ClimateRuleEffect[];
  actionable: boolean;
  policyIssue?: string;
}

interface UsefulGodDecisionStateLike {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  trace: string[];
  primaryReason: string;
  conditionalFavorableStems?: string[];
  conditionalUnfavorableStems?: string[];
  conditionalFavorableWuxing?: string[];
}

export interface ClimateApplication<T extends UsefulGodDecisionStateLike> {
  state: T;
  adjusted: boolean;
  appliedCandidate?: ClimateRuleCandidate;
  appliedCandidates?: ClimateRuleCandidate[];
  appliedCandidateIds?: string[];
  referenceOrder: string[];
  conflicts: string[];
  conflictRuleIds?: string[];
}

function normalizeWuxingOrder(order: string[]): string[] {
  return [...new Set(order.filter(Boolean))];
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPolicySourceComplete(rule: ClimateRule): boolean {
  const source = rule.policy?.source;
  return Boolean(
    source &&
    hasText(source.title) &&
    hasText(source.section) &&
    hasText(source.excerpt) &&
    hasText(source.url),
  );
}

function isEffectComplete(effect: ClimateRuleEffect): boolean {
  const stemIndex = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(effect.stem as never);
  const expectedWuxing = stemIndex >= 0 ? BASIC_MAPPINGS.STEM_WUXING[stemIndex] : undefined;
  return (
    hasText(effect.stem) &&
    hasText(effect.wuxing) &&
    expectedWuxing === effect.wuxing &&
    hasText(effect.role) &&
    (effect.targetStems || []).every(
      (stem) => hasText(stem) && BASIC_MAPPINGS.HEAVENLY_STEMS.includes(stem as never),
    )
  );
}

function getPrimaryEffects(rule: ClimateRule): ClimateRuleEffect[] {
  return (rule.policy?.effects || []).filter(
    (effect) => effect.rank === 'primary' && isEffectComplete(effect),
  );
}

function describePolicyIssue(rule: ClimateRule): string | undefined {
  if (!rule.policy || rule.policy.mode !== 'conditional') return undefined;
  if (!isPolicySourceComplete(rule)) return 'conditional规则缺少完整来源核验字段';
  if (
    !rule.policy.effects.length ||
    rule.policy.effects.some((effect) => !isEffectComplete(effect))
  ) {
    return 'conditional规则存在不完整作用项';
  }
  if (!getPrimaryEffects(rule).length) return 'conditional规则未声明主作用';
  return undefined;
}

function buildClimateCandidate(rule: ClimateRule, context: RuleMatchContext): ClimateRuleCandidate {
  const assessment = assessRuleMatch(rule, context);
  const mode = rule.policy?.mode || 'reference';
  const requestedOrder = normalizeWuxingOrder([...(rule.favorableOrder || []), rule.usefulWuxing]);
  const policyIssue = describePolicyIssue(rule);
  const actionable =
    assessment.status === '满足' &&
    ((mode === 'within-balance' && !policyIssue) || (mode === 'conditional' && !policyIssue));

  return {
    rule,
    status: assessment.status,
    missingInputs: assessment.missingInputs.map(String),
    mode,
    requestedOrder,
    primaryEffects: getPrimaryEffects(rule),
    actionable,
    policyIssue,
  };
}

/**
 * 收集所有规则的三态调候候选。
 * 没有 policy 的旧规则固定为 reference，priority 只用于候选展示顺序，不能获得覆盖权限。
 */
export function collectClimateRuleCandidates(
  context: RuleMatchContext,
  options: { isPatternSpecial?: boolean; rules?: ClimateRule[] } = {},
): ClimateRuleCandidate[] {
  if (!context.monthBranch || options.isPatternSpecial) return [];

  return (options.rules || CLIMATE_RULES)
    .map((rule) => buildClimateCandidate(rule, context))
    .sort((left, right) => (right.rule.priority || 0) - (left.rule.priority || 0));
}

export function selectTherapeuticHintRule(
  candidates: ClimateRuleCandidate[],
  strengthStatus: string,
): ClimateRule | StrengthHintRule | undefined {
  return (
    candidates.find((candidate) => candidate.status === '满足')?.rule ||
    matchFirstRule(STRENGTH_HINT_RULES, { strengthStatus })
  );
}

function modeRank(mode: ClimateRuleMode): number {
  if (mode === 'conditional') return 2;
  if (mode === 'within-balance') return 1;
  return 0;
}

function orderSignature(order: string[]): string {
  return order.join('>');
}

function effectSignature(effect: ClimateRuleEffect): string {
  return [
    effect.stem,
    effect.wuxing,
    effect.role,
    [...(effect.targetStems || [])].sort().join(','),
  ].join('|');
}

function pickClimateCandidate(candidates: ClimateRuleCandidate[]): {
  candidates: ClimateRuleCandidate[];
  conflicts: string[];
  conflictRuleIds: string[];
} {
  const applicable = candidates.filter(
    (candidate) => candidate.status === '满足' && candidate.actionable,
  );
  if (!applicable.length) return { candidates: [], conflicts: [], conflictRuleIds: [] };

  const topRank = Math.max(...applicable.map((candidate) => modeRank(candidate.mode)));
  const sameMode = applicable.filter((candidate) => modeRank(candidate.mode) === topRank);
  const topPriority = Math.max(...sameMode.map((candidate) => candidate.rule.priority || 0));
  const top = sameMode.filter((candidate) => (candidate.rule.priority || 0) === topPriority);

  if (top[0].mode !== 'conditional') {
    const signatures = new Set(top.map((candidate) => orderSignature(candidate.requestedOrder)));
    if (signatures.size > 1) {
      return {
        candidates: [],
        conflicts: [`同权限调候候选冲突:${top.map((candidate) => candidate.rule.id).join('、')}`],
        conflictRuleIds: top.map((candidate) => candidate.rule.id),
      };
    }
    return { candidates: [top[0]], conflicts: [], conflictRuleIds: [] };
  }

  // conditional 规则可以在同一权限层并列采用：不同天干的作用并不冲突。
  // 只有针对同一干却给出不同作用、目标或五行时，才阻断并留下冲突证据。
  const seenByStem = new Map<string, string>();
  for (const candidate of top) {
    for (const effect of candidate.primaryEffects) {
      const signature = effectSignature(effect);
      const previous = seenByStem.get(effect.stem);
      if (previous && previous !== signature) {
        return {
          candidates: [],
          conflicts: [`同权限调候作用冲突:${top.map((item) => item.rule.id).join('、')}`],
          conflictRuleIds: top.map((item) => item.rule.id),
        };
      }
      seenByStem.set(effect.stem, signature);
    }
  }

  return { candidates: top, conflicts: [], conflictRuleIds: [] };
}

function isWholeWuxingCovered(wuxing: string, stems: string[]): boolean {
  const requiredStems = BASIC_MAPPINGS.HEAVENLY_STEMS.filter(
    (_, index) => BASIC_MAPPINGS.STEM_WUXING[index] === wuxing,
  );
  return requiredStems.length > 0 && requiredStems.every((stem) => stems.includes(stem));
}

function resolveEffectReason(effects: ClimateRuleEffect[], fallback: string): string {
  const role = effects[0]?.role || '';
  if (role.includes('制化') || role.includes('裁') || role.includes('通关')) return '制化';
  if (role.includes('调候') || role.includes('暖') || role.includes('润') || role.includes('燥')) {
    return '调候';
  }
  return fallback;
}

/**
 * 应用拥有权限的调候候选：within-balance 只重排基线，conditional 只采用主作用干。
 * 一条丁火作用不能自动把丙火也宣称为综合喜用；整五行只有在阴阳两干均被主作用覆盖时才加入兼容集合。
 */
export function applyClimateCandidates<T extends UsefulGodDecisionStateLike>(
  state: T,
  candidates: ClimateRuleCandidate[],
): ClimateApplication<T> {
  const referenceOrder =
    candidates.find((candidate) => candidate.status === '满足')?.requestedOrder || [];
  const picked = pickClimateCandidate(candidates);
  if (!picked.candidates.length) {
    const missing = candidates.filter((candidate) => candidate.status === '资料不足');
    const trace = missing.length
      ? `调候候选资料不足:${missing.map((candidate) => candidate.rule.id).join('、')}`
      : '';
    return {
      state: trace ? { ...state, trace: [...state.trace, trace] } : state,
      adjusted: false,
      referenceOrder,
      conflicts: picked.conflicts,
      conflictRuleIds: picked.conflictRuleIds,
    };
  }

  const candidate = picked.candidates[0];
  if (candidate.mode === 'within-balance') {
    const compatibleOrder = candidate.requestedOrder.filter((wx) =>
      state.favorableWuxing.includes(wx),
    );
    if (!compatibleOrder.length) {
      return {
        state: {
          ...state,
          trace: [
            ...state.trace,
            `调候参照:${candidate.requestedOrder.join(' -> ')}，扶抑喜神无交集`,
          ],
        },
        adjusted: false,
        appliedCandidate: candidate,
        referenceOrder,
        conflicts: picked.conflicts,
      };
    }
    return {
      state: {
        ...state,
        favorableWuxing: [
          ...compatibleOrder,
          ...state.favorableWuxing.filter((wx) => !compatibleOrder.includes(wx)),
        ],
        trace: [
          ...state.trace,
          `调候参照:${candidate.requestedOrder.join(' -> ')}，结合扶抑采用:${compatibleOrder.join(' -> ')}`,
        ],
      },
      adjusted: true,
      appliedCandidate: candidate,
      appliedCandidates: picked.candidates,
      appliedCandidateIds: picked.candidates.map((item) => item.rule.id),
      referenceOrder,
      conflicts: picked.conflicts,
      conflictRuleIds: picked.conflictRuleIds,
    };
  }

  const primaryEffects = picked.candidates.flatMap((item) => item.primaryEffects);
  const stems = [...new Set(primaryEffects.map((effect) => effect.stem))];
  const effectWuxings = [...new Set(primaryEffects.map((effect) => effect.wuxing))];
  const wholeWuxings = effectWuxings.filter((wuxing) => isWholeWuxingCovered(wuxing, stems));
  const scopedWuxings = effectWuxings.filter((wuxing) => !wholeWuxings.includes(wuxing));
  const favorableWuxing = [
    ...wholeWuxings,
    ...state.favorableWuxing.filter((wuxing) => !wholeWuxings.includes(wuxing)),
  ];
  const affectedUnfavorableWuxings = effectWuxings.filter((wuxing) =>
    state.unfavorableWuxing.includes(wuxing),
  );
  const unfavorableWuxing = state.unfavorableWuxing.filter(
    (wuxing) => !affectedUnfavorableWuxings.includes(wuxing),
  );
  const conditionalFavorableStems = [
    ...new Set([...(state.conditionalFavorableStems || []), ...stems]),
  ];
  const conditionalUnfavorableStems = [
    ...new Set([
      ...(state.conditionalUnfavorableStems || []),
      ...scopedWuxings.flatMap((wuxing) =>
        state.unfavorableWuxing.includes(wuxing)
          ? BASIC_MAPPINGS.HEAVENLY_STEMS.filter(
              (_, index) =>
                BASIC_MAPPINGS.STEM_WUXING[index] === wuxing &&
                !stems.includes(BASIC_MAPPINGS.HEAVENLY_STEMS[index]),
            )
          : [],
      ),
    ]),
  ];
  const conditionalFavorableWuxing = [
    ...new Set([...(state.conditionalFavorableWuxing || []), ...effectWuxings]),
  ];
  const functionalText = primaryEffects
    .map((effect) => `${effect.stem}${effect.wuxing}${effect.role}`)
    .join('、');
  const nextState = {
    ...state,
    favorableWuxing,
    unfavorableWuxing,
    conditionalFavorableStems,
    conditionalUnfavorableStems,
    conditionalFavorableWuxing,
    trace: [
      ...state.trace,
      `调候条件采用:${functionalText}${
        scopedWuxings.length ? `（干级作用，未将${scopedWuxings.join('、')}整五行改喜）` : ''
      }`,
    ],
    primaryReason: resolveEffectReason(primaryEffects, state.primaryReason),
  } as T;

  return {
    state: nextState,
    adjusted:
      wholeWuxings.length > 0 ||
      scopedWuxings.some(
        (wuxing) =>
          state.favorableWuxing.includes(wuxing) || state.unfavorableWuxing.includes(wuxing),
      ),
    appliedCandidate: candidate,
    appliedCandidates: picked.candidates,
    appliedCandidateIds: picked.candidates.map((item) => item.rule.id),
    referenceOrder,
    conflicts: picked.conflicts,
    conflictRuleIds: picked.conflictRuleIds,
  };
}

function buildClimateContext(
  strengthStatus: string | undefined,
  yearStem: string | undefined,
  dayMasterStem: string | undefined,
  monthBranch: string | undefined,
  hourBranch: string | undefined,
  currentJieqi: string | undefined,
  visibleStems: string[] | undefined,
  visibleStemSources: VisibleStemSource[] | undefined,
  hiddenStems: string[] | undefined,
  hiddenStemSources: HiddenStemSource[] | undefined,
  formationWuxings: string[] | undefined,
  wuxingCounts: Record<string, number> | undefined,
  dmWuxing: string,
): RuleMatchContext {
  return {
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
) {
  if (!monthBranch) return null;

  const climateRule = matchFirstRule(CLIMATE_RULES, {
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
  });
  return climateRule || matchFirstRule(STRENGTH_HINT_RULES, { strengthStatus }) || null;
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
    )?.id || ''
  );
}

export function resolveTherapeuticPriorityWuxing(
  strengthStatus: string,
  dmWuxing: string,
  dayMasterStem: string | undefined,
  monthBranch: string | undefined,
  isPatternSpecial: boolean,
  wuxingSheng: Record<string, string>,
): string {
  if (!monthBranch || isPatternSpecial) return '';
  const priorityRule = matchFirstRule(THERAPEUTIC_PRIORITY_RULES, {
    monthBranch,
    strengthStatus,
    dayMaster: dmWuxing,
    dayStem: dayMasterStem,
  });
  if (!priorityRule) return '';
  return priorityRule.useGeneratedElement ? wuxingSheng[dmWuxing] || '' : '';
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
  strengthStatus?: string,
): string[] {
  const candidates = collectClimateRuleCandidates(
    buildClimateContext(
      strengthStatus,
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
      dmWuxing,
    ),
    { isPatternSpecial },
  );
  return candidates.find((candidate) => candidate.status === '满足')?.requestedOrder || [];
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
  strengthStatus?: string,
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
      strengthStatus,
    )[0] || ''
  );
}

/**
 * 兼容旧调用的低层函数。新决策链使用 applyClimateCandidates；这里不再允许默认调候覆盖。
 */
export function applyClimateAdjustment<T extends UsefulGodDecisionStateLike>(
  state: T,
  climateFavorableOrder: string[],
  mode: ClimateRuleMode = 'reference',
): { state: T; adjusted: boolean } {
  if (mode !== 'within-balance' || !climateFavorableOrder.length) {
    return { state, adjusted: false };
  }
  const compatibleOrder = climateFavorableOrder.filter((wx) => state.favorableWuxing.includes(wx));
  if (!compatibleOrder.length) return { state, adjusted: false };
  return {
    state: {
      ...state,
      favorableWuxing: [
        ...compatibleOrder,
        ...state.favorableWuxing.filter((wx) => !compatibleOrder.includes(wx)),
      ],
      trace: [
        ...state.trace,
        `调候参照:${climateFavorableOrder.join(' -> ')}，结合扶抑采用:${compatibleOrder.join(' -> ')}`,
      ],
    },
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
