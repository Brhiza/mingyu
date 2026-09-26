import { BASIC_MAPPINGS } from './baziDefinitions';
import {
  WUXING,
  type HiddenStems,
  type PatternAnalysis,
  type UsefulGodControlFunctionEvidence,
  type UsefulGodAnalysis,
  type UsefulGodDecisionEvidence,
  type Wuxing,
} from './baziTypes';
import { collectAdjudicatedRootFacts } from './baziRootAdjudication';
import { getRootTraditionalKind, isStructuralRoot, type RootPillars } from './baziRootFacts';
import {
  applyClimateCandidates,
  applyTherapeuticPriority,
  collectClimateRuleCandidates,
  resolveTherapeuticPriorityWuxing,
  selectTherapeuticHintRule,
  type ClimateRuleCandidate,
} from './baziTherapeuticStrategy';
import { BASE_USEFUL_GOD_RULES, type UsefulGodWuxingBundle } from './baziUsefulGodRules';
import {
  matchFirstRule,
  type HiddenStemSource,
  type RuleMatchContext,
  type VisibleStemSource,
} from './baziRuleMatcher';
import { assertEarthlyBranch, assertHeavenlyStem, getWuxing } from './baziUtils';
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

const TRANSFORMATION_USEFUL_RULE: RuleMetadata = {
  id: 'transformed-element-following',
  label: '化神顺势取用',
  description:
    '《子平真诠》从化取用以所化之物及生化神者为基础，财伤与过旺制化另核条件；《滴天髓》化土阴寒先取火温养。',
};

const RULE_CATALOG = [
  ...BASE_USEFUL_GOD_RULES,
  ...CLIMATE_RULES,
  ...STRENGTH_HINT_RULES,
  ...THERAPEUTIC_PRIORITY_RULES,
  TRANSFORMATION_USEFUL_RULE,
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

/** 财旺身弱而印受财制时，先核比劫能否护印，再排列印比次序。 */
function applyResourceProtection(
  state: UsefulGodDecisionState,
  strengthStatus: string,
  pattern: PatternAnalysis,
  dmWuxing: string,
  context?: UsefulGodClimateContext,
): UsefulGodDecisionState {
  if (pattern.isSpecial || !['身弱', '偏弱', '极弱'].includes(strengthStatus)) return state;
  const visible = context?.visibleStemSources;
  const hidden = context?.hiddenStemSources;
  if (!visible || !hidden) return state;
  if (
    !(['year', 'month', 'day', 'hour'] as const).every(
      (pillar) =>
        visible.some((source) => source.pillar === pillar) &&
        hidden.some((source) => source.pillar === pillar && source.stems.length),
    )
  )
    return state;
  const element = (stem: string) =>
    BASIC_MAPPINGS.STEM_WUXING[BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(stem as never)];
  const resource = Object.keys(BASIC_MAPPINGS.WUXING_SHENG).find(
    (wuxing) => BASIC_MAPPINGS.WUXING_SHENG[wuxing] === dmWuxing,
  );
  const wealth = BASIC_MAPPINGS.WUXING_KE[dmWuxing];
  if (
    !resource ||
    !state.favorableWuxing.includes(resource) ||
    !state.favorableWuxing.includes(dmWuxing)
  )
    return state;
  const month = hidden.find((source) => source.pillar === 'month');
  if (!month?.stems[0] || element(month.stems[0]) !== wealth) return state;
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const rootPillars = Object.fromEntries(
    pillarKeys.map((pillar) => [
      pillar,
      { zhi: hidden.find((source) => source.pillar === pillar)!.branch },
    ]),
  ) as unknown as RootPillars;
  const rootHiddenStems = Object.fromEntries(
    pillarKeys.map((pillar) => [pillar, hidden.find((source) => source.pillar === pillar)!.stems]),
  ) as unknown as HiddenStems;
  const collectUsableRoots = (target: string) => {
    assertWuxing(target, '根气');
    return collectAdjudicatedRootFacts(rootPillars, rootHiddenStems, target, getWuxing).filter(
      (root) => root.actionable && isStructuralRoot(root),
    );
  };
  // 财旺身弱且印坐财时，墓库与余气只证明“有根”，不能直接把受制的印
  // 当成已具承接力。只有本气或生禄等实根才足以跳过护印次序；这与
  // 格局路径中的根气分层保持一致。
  const resourceRoots = collectUsableRoots(resource).filter((root) =>
    ['本气', '生禄'].includes(getRootTraditionalKind(root)),
  );
  const companionRoots = collectUsableRoots(dmWuxing);
  const resourceStems = visible.filter((source) => element(source.stem) === resource);
  // 任一印有共享裁决可用的结构根，或并未坐财受制，均不套用弱印待护的次序。
  if (!resourceStems.length || resourceRoots.length) return state;
  if (
    !resourceStems.every((source) => {
      const seat = hidden.find((candidate) => candidate.pillar === source.pillar);
      return seat?.stems[0] && element(seat.stems[0]) === wealth;
    })
  )
    return state;
  const rootedCompanions = visible.filter(
    (source) =>
      source.pillar !== 'day' && element(source.stem) === dmWuxing && companionRoots.length > 0,
  );
  if (!rootedCompanions.length) return state;
  const favorableOrder = [
    dmWuxing,
    ...state.favorableWuxing.filter((wuxing) => wuxing !== dmWuxing),
  ];
  const companionRootKinds = [
    ...new Set(
      companionRoots.map((root) => {
        const kind = getRootTraditionalKind(root);
        return kind === '正库' || kind === '余气' ? `${kind}轻根` : kind;
      }),
    ),
  ].join('、');
  const reason = `月令本气为财，${resourceStems.map((source) => source.stem).join('、')}印坐财受制且缺少可用结构根；${rootedCompanions.map((source) => source.stem).join('、')}比劫透而有根（${companionRootKinds}），先以${dmWuxing}扶身制财护印，再取${resource}生身，印比配合`;
  return {
    ...state,
    favorableWuxing: favorableOrder,
    primaryReason: '扶抑护印',
    trace: [...state.trace, `取用调整:${reason}`],
    decisionEvidence: {
      ...state.decisionEvidence,
      balanceAdjustment: { reason, favorableOrder },
      appliedLayers: [...state.decisionEvidence.appliedLayers, '扶抑护印'],
    },
  };
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
    natalFunctions: collectNatalPatternFunctions(pattern),
    controlPaths: pattern.fulfillment?.pathEvaluations,
    controlRemedies: pattern.fulfillment?.remedies,
    appliedLayers: [],
    conflicts: [],
  };
}

function collectNatalPatternFunctions(
  pattern: PatternAnalysis,
): NonNullable<UsefulGodDecisionEvidence['natalFunctions']> {
  const fulfillment = pattern.fulfillment;
  if (pattern.isSpecial || !fulfillment || !['成格', '破而复成'].includes(fulfillment.status)) {
    return [];
  }

  const functions: NonNullable<UsefulGodDecisionEvidence['natalFunctions']> = [];
  const rootEvidence = fulfillment.rootEvidence ?? [];
  const monthGate = fulfillment.conditionFacts?.find((fact) => fact.key === 'pattern.month-gate');
  const target = fulfillment.conditionFacts?.find((fact) => fact.key === 'pattern.target');
  const targetGod = ['正官', '七杀', '正财', '偏财', '正印', '偏印', '食神', '伤官'].find((god) =>
    pattern.pattern.includes(god),
  );

  if (monthGate?.status === '满足' && target?.status === '满足' && targetGod) {
    for (const evidence of rootEvidence) {
      if (evidence.tenGod !== targetGod || evidence.placement !== '透干' || !evidence.rooted) {
        continue;
      }
      functions.push({
        stem: evidence.stem,
        tenGod: evidence.tenGod,
        pillar: evidence.pillar,
        placement: evidence.placement,
        role: '格神',
        detail: target.detail,
      });
    }
  }

  for (const path of fulfillment.pathEvaluations ?? []) {
    if (path.status !== '满足') continue;
    const endpoints = path.effectivePairs?.length
      ? path.effectivePairs.flatMap((pair) => [
          { stem: pair.sourceStem, pillar: pair.sourcePillar, role: '制化来源' as const },
          { stem: pair.targetStem, pillar: pair.targetPillar, role: '制化对象' as const },
        ])
      : [
          ...path.sourceStems.map((stem) => ({ stem, role: '制化来源' as const })),
          ...path.targetStems.map((stem) => ({ stem, role: '制化对象' as const })),
        ];
    for (const endpoint of endpoints) {
      const evidence =
        'pillar' in endpoint
          ? rootEvidence.find(
              (item) =>
                item.stem === endpoint.stem &&
                item.pillar === endpoint.pillar &&
                item.placement === '透干',
            )
          : (rootEvidence.find(
              (item) => item.stem === endpoint.stem && item.placement === '透干',
            ) ?? rootEvidence.find((item) => item.stem === endpoint.stem));
      if (!evidence) continue;
      functions.push({
        stem: endpoint.stem,
        tenGod: evidence.tenGod,
        pillar: evidence.pillar,
        placement: evidence.placement,
        role: endpoint.role,
        pathKey: path.key,
        detail: path.detail,
      });
    }
  }

  return functions.filter(
    (item, index) =>
      functions.findIndex(
        (candidate) =>
          candidate.stem === item.stem &&
          candidate.pillar === item.pillar &&
          candidate.placement === item.placement &&
          candidate.role === item.role &&
          candidate.pathKey === item.pathKey,
      ) === index,
  );
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
      path.status === '满足' && path.effectivePairs?.length
        ? path.effectivePairs.some(
            (pair) => pair.sourceStem === evidence.stem && pair.sourcePillar === evidence.pillar,
          ) && evidence.placement === '透干'
        : sourceStems.includes(evidence.stem),
    );
    const targetRootEvidence = rootEvidence.filter((evidence) =>
      path.status === '满足' && path.effectivePairs?.length
        ? path.effectivePairs.some(
            (pair) => pair.targetStem === evidence.stem && pair.targetPillar === evidence.pillar,
          ) && evidence.placement === '透干'
        : targetStems.includes(evidence.stem),
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

const RESOURCE_TEN_GODS = new Set(['正印', '偏印']);
const OUTPUT_TEN_GODS = new Set(['食神', '伤官']);

/**
 * 通用专旺只把印比作为已确定的顺势基础。食伤沿用《滴天髓阐微》的条件结论：
 * 原局印轻且泄秀作用成立时方可取；已有结构化印食作用链时只限制具体对象干。
 */
function applySpecialStrongOutputConditions(
  state: UsefulGodDecisionState,
  pattern: PatternAnalysis,
  dmWuxing: string,
): UsefulGodDecisionState {
  if (!pattern.isSpecial || pattern.pattern !== '专旺格') return state;

  const outputWuxing = BASIC_MAPPINGS.WUXING_SHENG[dmWuxing];
  const isProvenResourceOutputPath = (path: UsefulGodControlFunctionEvidence) => {
    if (path.status !== '满足' || !path.sourceStems.length || !path.targetStems.length) {
      return false;
    }
    return (
      path.sourceStems.every((stem) =>
        path.sourceRootEvidence.some(
          (evidence) => evidence.stem === stem && RESOURCE_TEN_GODS.has(evidence.tenGod),
        ),
      ) &&
      path.targetStems.every((stem) =>
        path.targetRootEvidence.some(
          (evidence) => evidence.stem === stem && OUTPUT_TEN_GODS.has(evidence.tenGod),
        ),
      )
    );
  };
  const resourceOutputPaths = (state.decisionEvidence.controlFunctions ?? []).filter(
    isProvenResourceOutputPath,
  );
  const restrictedOutputStems = [
    ...new Set(resourceOutputPaths.flatMap((path) => path.targetStems)),
  ];
  const conditionalFavorableStems = (state.conditionalFavorableStems ?? []).filter(
    (stem) => !restrictedOutputStems.includes(stem),
  );
  const conditionalUnfavorableStems = [
    ...new Set([...(state.conditionalUnfavorableStems ?? []), ...restrictedOutputStems]),
  ];
  const conditionalFavorableWuxing = [
    ...new Set([...(state.conditionalFavorableWuxing ?? []), outputWuxing]),
  ];
  const appliedLayers = state.decisionEvidence.appliedLayers.includes('专旺食伤条件')
    ? state.decisionEvidence.appliedLayers
    : [...state.decisionEvidence.appliedLayers, '专旺食伤条件'];
  const conflictText = resourceOutputPaths
    .map(
      (path) => `${path.label}[${path.sourceStems.join('、')} -> ${path.targetStems.join('、')}]`,
    )
    .join('；');
  const trace = [
    ...state.trace,
    `食伤条件:${outputWuxing}仅在原局印轻且食伤泄秀作用成立时纳入喜用`,
    ...(conflictText
      ? [`印食作用限制:${conflictText}，只限制已证作用对象干，不扩大为${outputWuxing}忌`]
      : []),
  ];
  const conflicts = conflictText
    ? [...state.decisionEvidence.conflicts, `印食具体作用:${conflictText}`]
    : state.decisionEvidence.conflicts;

  return {
    ...state,
    conditionalFavorableStems,
    conditionalUnfavorableStems,
    conditionalFavorableWuxing,
    trace,
    decisionEvidence: {
      ...state.decisionEvidence,
      conditionalFavorableStems,
      conditionalUnfavorableStems,
      conditionalFavorableWuxing,
      appliedLayers,
      conflicts,
    },
  };
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
    none: [],
    resource_companion_output: [resource, companion, output].filter(Boolean),
    wealth_officer: [wealth, officer].filter(Boolean),
    officer_wealth: [officer, wealth].filter(Boolean),
    output_wealth_officer: [output, wealth, officer].filter(Boolean),
    output_resource_companion: [output, resource, companion].filter(Boolean),
    resource_companion: [resource, companion].filter(Boolean),
    wealth_output: [wealth, output].filter(Boolean),
    resource_officer: [resource, officer].filter(Boolean),
    officer: [officer].filter(Boolean),
  };

  const ordinaryPatternTrace = pattern.isSpecial
    ? []
    : [`普通格局:${pattern.pattern}，喜忌先按${strengthStatus}扶抑登记基线，不因格名直接改判`];
  const matchedRule = resolveBaseUsefulGodRule(strengthStatus, pattern);
  if (!matchedRule) {
    throw new Error(
      pattern.isSpecial
        ? `特殊格局缺少取用规则：${pattern.pattern}`
        : `旺衰状态缺少取用规则：${strengthStatus}`,
    );
  }
  const favorable = bundles[matchedRule.favorable];
  const unfavorable = bundles[matchedRule.unfavorable];
  const trace = [...ordinaryPatternTrace, matchedRule.trace];
  const primaryReason = matchedRule.primaryReason;
  const decisionEvidence = buildDecisionEvidence(favorable, unfavorable, matchedRule.id, pattern);
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

  return applySpecialStrongOutputConditions(
    {
      favorableWuxing: [...favorable],
      unfavorableWuxing: [...unfavorable],
      trace,
      primaryReason,
      matchedRuleIds: [matchedRule.id],
      decisionEvidence,
    },
    pattern,
    dmWuxing,
  );
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

/**
 * 普通格局已明确破格且救应明确不成立时，只限制实际有效的具体破格干。
 * 五行扶抑基线保持不变，同五行另一阴阳十神仍可按原基线判断。
 */
function applyPatternBreakerRestrictions(
  state: UsefulGodDecisionState,
  pattern: PatternAnalysis,
): UsefulGodDecisionState {
  if (pattern.isSpecial || pattern.fulfillment?.status !== '破格') return state;
  const restrictions = (pattern.fulfillment.activeBreakers ?? []).filter(
    (breaker) => breaker.repairStatus === '不满足' && breaker.stems.length > 0,
  );
  if (!restrictions.length) return state;

  const restrictedStems = [
    ...new Set(restrictions.flatMap((breaker) => breaker.stems.map((item) => item.stem))),
  ];
  const conditionalFavorableStems = (state.conditionalFavorableStems ?? []).filter(
    (stem) => !restrictedStems.includes(stem),
  );
  const conditionalUnfavorableStems = [
    ...new Set([...(state.conditionalUnfavorableStems ?? []), ...restrictedStems]),
  ];
  const appliedLayers = state.decisionEvidence.appliedLayers.includes('格局成败')
    ? state.decisionEvidence.appliedLayers
    : [...state.decisionEvidence.appliedLayers, '格局成败'];
  const restrictionText = restrictions
    .map(
      (breaker) =>
        `${breaker.label}:${breaker.stems.map((item) => `${item.stem}${item.tenGod}`).join('、')}`,
    )
    .join('；');

  return {
    ...state,
    conditionalFavorableStems,
    conditionalUnfavorableStems,
    trace: [...state.trace, `格局破格限制:${restrictionText}，救应明确不成立`],
    decisionEvidence: {
      ...state.decisionEvidence,
      conditionalFavorableStems,
      conditionalUnfavorableStems,
      patternBreakerRestrictions: restrictions,
      appliedLayers,
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
  const restrictedTenGods = new Set(
    (state.decisionEvidence.patternBreakerRestrictions ?? []).flatMap((breaker) =>
      breaker.stems.map((item) => item.tenGod),
    ),
  );
  const excludeRestrictedGods = (gods: string[]) =>
    gods.filter((god) => !restrictedTenGods.has(god));
  const primaryFavorableWuxing = state.favorableWuxing[0] || '';
  const secondaryFavorableWuxing = state.favorableWuxing.slice(1);
  const primaryUnfavorableWuxing = state.unfavorableWuxing[0] || '';
  const secondaryUnfavorableWuxing = state.unfavorableWuxing.slice(1);
  const decidedWuxing = new Set([...state.favorableWuxing, ...state.unfavorableWuxing]);
  const hasSpecificDecision = Boolean(
    state.conditionalFavorableStems?.length || state.conditionalUnfavorableStems?.length,
  );
  const incrementStatus =
    decidedWuxing.size === WUXING.length
      ? '已判定'
      : decidedWuxing.size || hasSpecificDecision
        ? '部分判定'
        : '待判';
  const favorableGods = excludeRestrictedGods(
    state.favorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []),
  );
  const unfavorableGods = [
    ...new Set([
      ...state.unfavorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []),
      ...restrictedTenGods,
    ]),
  ];
  const primaryFavorableGods = primaryFavorableWuxing
    ? excludeRestrictedGods(wuxingToTenGodMap[primaryFavorableWuxing] || [])
    : [];
  const secondaryFavorableGods = excludeRestrictedGods(
    secondaryFavorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []),
  );
  const primaryUnfavorableGods = primaryUnfavorableWuxing
    ? wuxingToTenGodMap[primaryUnfavorableWuxing] || []
    : [];
  const secondaryUnfavorableGods = [
    ...new Set([
      ...secondaryUnfavorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []),
      ...[...restrictedTenGods].filter((god) => !primaryUnfavorableGods.includes(god)),
    ]),
  ];
  const usefulGod = primaryFavorableWuxing
    ? primaryFavorableGods.length === 1
      ? primaryFavorableGods[0]
      : primaryFavorableGods.length > 1
        ? resolveTenGodCategoryLabel(dmWuxing, primaryFavorableWuxing)
        : '待判'
    : '待判';
  const avoidGod = primaryUnfavorableWuxing
    ? resolveTenGodCategoryLabel(dmWuxing, primaryUnfavorableWuxing)
    : '待判';

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
    incrementStatus,
    conditionalFavorableStems: state.conditionalFavorableStems,
    conditionalUnfavorableStems: state.conditionalUnfavorableStems,
    conditionalFavorableWuxing: state.conditionalFavorableWuxing,
    decisionEvidence: state.decisionEvidence,
    strategyTrace: state.trace,
    primaryReason: state.primaryReason,
    matchedRules: resolveRuleMetadataList(state.matchedRuleIds),
  };
}

/** 真化以化神另论取用；原日主的强弱与十神仍保留为本命事实。 */
function buildTransformedDecisionState(
  pattern: PatternAnalysis,
  monthBranch?: string,
): UsefulGodDecisionState {
  const transformation = pattern.transformation!;
  const element = transformation.element;
  assertWuxing(element, '化神');
  const resource = Object.keys(BASIC_MAPPINGS.WUXING_SHENG).find(
    (candidate) => BASIC_MAPPINGS.WUXING_SHENG[candidate] === element,
  )!;
  const output = BASIC_MAPPINGS.WUXING_SHENG[element];
  const wealth = BASIC_MAPPINGS.WUXING_KE[element];
  const controller = Object.keys(BASIC_MAPPINGS.WUXING_KE).find(
    (candidate) => BASIC_MAPPINGS.WUXING_KE[candidate] === element,
  )!;
  const coldEarth = element === '土' && ['亥', '子', '丑'].includes(monthBranch ?? '');
  const favorable = coldEarth ? [resource, element] : [element, resource];
  const unfavorable = [controller];
  const basis =
    `按《子平真诠》从化口径，以化神${element}为取用主体，` +
    (coldEarth
      ? '化土生于冬月，先取火温土，再论土气承接。'
      : `以${element}同气与${resource}生化神为顺势基础。`) +
    '原日主旺衰保留作本命事实，十神称谓仍按原日干对应。';
  const conditions = [
    ...transformation.conditions,
    `${output}泄化神、${wealth}为化神所克，须核对化神能否承受泄耗及岁运配合，再定是否可用。`,
    `克化神的${controller}在顺势基线列忌；若化神太过，须另核《滴天髓》的泄耗制化条件，不能只凭成化格名决定增补。`,
  ];
  const decisionEvidence = buildDecisionEvidence(
    favorable,
    unfavorable,
    TRANSFORMATION_USEFUL_RULE.id,
    pattern,
  );
  decisionEvidence.transformation = { element, basis, conditions };
  decisionEvidence.appliedLayers = ['化神顺势'];
  return {
    favorableWuxing: favorable,
    unfavorableWuxing: unfavorable,
    trace: [basis, ...conditions],
    primaryReason: '化神顺势',
    matchedRuleIds: [TRANSFORMATION_USEFUL_RULE.id],
    decisionEvidence,
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

  if (pattern.isSpecial && pattern.transformation?.status === '成化') {
    return finalizeUsefulGodAnalysis(buildTransformedDecisionState(pattern, monthBranch), dmWuxing);
  }

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

  state = applyResourceProtection(state, strengthStatus, pattern, dmWuxing, climateContext);

  const therapeuticHintRule =
    !isPatternSpecial && monthBranch
      ? selectTherapeuticHintRule(climateCandidates, strengthStatus)
      : undefined;
  const therapeuticHintClimateRule =
    therapeuticHintRule && 'months' in therapeuticHintRule ? therapeuticHintRule : undefined;
  const therapeuticHint = therapeuticHintRule?.hint || '';
  const therapeuticHintRuleId = therapeuticHintRule?.id || '';
  state = applyPatternBreakerRestrictions(state, pattern);

  const restrictedStems = new Set(
    (state.decisionEvidence.patternBreakerRestrictions ?? []).flatMap((breaker) =>
      breaker.stems.map((item) => item.stem),
    ),
  );
  const therapeuticRecommendationStems = [
    ...new Set([
      ...(therapeuticHintClimateRule?.recommendationStems ?? []),
      ...(therapeuticHintClimateRule?.policy?.effects.map((effect) => effect.stem) ?? []),
    ]),
  ];
  const therapeuticHintBlocked = Boolean(
    therapeuticRecommendationStems.some((stem) => restrictedStems.has(stem)),
  );
  if (therapeuticHintBlocked) {
    state = {
      ...state,
      matchedRuleIds: state.matchedRuleIds.filter((ruleId) => ruleId !== therapeuticHintRuleId),
    };
  } else if (therapeuticHintRuleId && !state.matchedRuleIds.includes(therapeuticHintRuleId)) {
    state.matchedRuleIds.push(therapeuticHintRuleId);
  }

  const finalTrace = [
    ...state.trace,
    ...(therapeuticHint && !therapeuticHintBlocked ? [`病药提示:${therapeuticHint}`] : []),
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
