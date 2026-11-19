import type { BaziPillar, PillarName } from './pillars';
import { collectTraditionalRoots, type buildDayMasterStrength } from './strength';
import type { summarizePattern } from './pattern';
import type { buildTransformation } from './transformation';
import type { buildPatternEvidence } from './pattern-evidence';
import type { buildClimateCandidates } from './climate';
import type { resolveClimate } from './climate-decision';
import { stemElementOf } from './natal-facts';

type Pillars = Record<PillarName, BaziPillar>;
type Strength = ReturnType<typeof buildDayMasterStrength>;
type PatternOverview = ReturnType<typeof summarizePattern>;
type Transformation = ReturnType<typeof buildTransformation>;
type PatternEvidence = ReturnType<typeof buildPatternEvidence>;
type Climate = ReturnType<typeof buildClimateCandidates>;
type ClimateDecision = ReturnType<typeof resolveClimate>;

const WUXING = ['木', '火', '土', '金', '水'] as const;
const PILLAR_ORDER: PillarName[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const GENERATES: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const previous = (map: Record<string, string>, element: string) => Object.keys(map).find((k) => map[k] === element) || '';

const RESOURCE_TEN_GODS = new Set(['正印', '偏印']);
const OUTPUT_TEN_GODS = new Set(['食神', '伤官']);

export interface RuleMetadata {
  id: string;
  label: string;
  description: string;
}

type WuxingBundle =
  | 'none'
  | 'resource_companion_output'
  | 'wealth_officer'
  | 'officer_wealth'
  | 'output_wealth_officer'
  | 'output_resource_companion'
  | 'resource_companion'
  | 'wealth_output'
  | 'resource_officer'
  | 'officer';

interface BaseUsefulGodRule extends RuleMetadata {
  priority: number;
  patterns?: string[];
  strengths?: string[];
  favorable: WuxingBundle;
  unfavorable: WuxingBundle;
  trace: string;
  primaryReason: string;
}

const BASE_USEFUL_GOD_RULES: BaseUsefulGodRule[] = [
  {
    id: 'quzhi-follow-wood',
    label: '曲直格顺势泄秀规则',
    description: '曲直格以水木顺势、火泄木秀，金为制破；土财只按实际作用另论，不因出现便列为破格或固定忌神。',
    priority: 110,
    patterns: ['曲直格'],
    favorable: 'resource_companion_output',
    unfavorable: 'officer',
    trace: '曲直格取水木顺势、火泄秀，土财另核作用',
    primaryReason: '曲直顺势泄秀',
  },
  {
    id: 'follow-special-strong',
    label: '专旺格顺势规则',
    description: '通用专旺格以印比顺势为确定取向；食伤须原局印轻且泄秀作用成立时方可纳入喜用，若已有印食具体冲克则按实际作用干限制。',
    priority: 100,
    patterns: ['专旺格'],
    favorable: 'resource_companion',
    unfavorable: 'wealth_officer',
    trace: '专旺格以印比顺势，食伤另核印轻与实际作用',
    primaryReason: '顺势',
  },
  {
    id: 'follow-conger',
    label: '从儿格顺局规则',
    description: '《滴天髓阐微·顺局》从儿以食伤生财为喜，印星制食伤为首忌，官杀耗财逆局次忌；比劫须按生食伤或争财的实际作用另论。',
    priority: 105,
    patterns: ['从儿格'],
    favorable: 'wealth_output',
    unfavorable: 'resource_officer',
    trace: '从儿格取财星、食伤顺局，忌印星、官杀逆局，比劫另核实际作用',
    primaryReason: '从儿顺局',
  },
  {
    id: 'follow-kill',
    label: '从杀格顺杀规则',
    description: '从杀格以官杀顺势为主，财星生杀为辅；食伤制杀、印比扶身逆势。',
    priority: 105,
    patterns: ['从杀格'],
    favorable: 'officer_wealth',
    unfavorable: 'output_resource_companion',
    trace: '从杀格取官杀顺势、财星生杀，忌食伤制杀与印比扶身',
    primaryReason: '从杀顺势',
  },
  {
    id: 'follow-wealth',
    label: '从财格顺财规则',
    description: '从财格以财星为主，食伤生财为辅；印比扶身逆势。',
    priority: 105,
    patterns: ['从财格'],
    favorable: 'wealth_output',
    unfavorable: 'resource_companion',
    trace: '从财格取财星顺势、食伤生财，忌印比扶身',
    primaryReason: '从财顺势',
  },
  {
    id: 'follow-special-weak',
    label: '从格从势规则',
    description: '混杂从势格保留食伤、财星与官杀多种异党取向，具体作用仍按原局核验。',
    priority: 100,
    patterns: ['从格', '从势格'],
    favorable: 'output_wealth_officer',
    unfavorable: 'resource_companion',
    trace: '从格从势取用',
    primaryReason: '从势',
  },
  {
    id: 'balance-strong',
    label: '身强扶抑规则',
    description: '普通身强命局以泄耗克为先，抑其太过。',
    priority: 50,
    strengths: ['身强', '偏强', '极强'],
    favorable: 'output_wealth_officer',
    unfavorable: 'resource_companion',
    trace: '身强取泄耗克',
    primaryReason: '扶抑',
  },
  {
    id: 'balance-weak',
    label: '身弱扶抑规则',
    description: '普通身弱命局以印比扶助为先，培元固本。',
    priority: 50,
    strengths: ['身弱', '偏弱', '极弱'],
    favorable: 'resource_companion',
    unfavorable: 'output_wealth_officer',
    trace: '身弱取印比',
    primaryReason: '扶抑',
  },
  {
    id: 'balance-neutral',
    label: '中和基础取用规则',
    description: '中和不预设整五行喜忌；原局格局作用、调候与具体干条件分别核验。',
    priority: 50,
    strengths: ['中和'],
    favorable: 'none',
    unfavorable: 'none',
    trace: '中和不预设增补五行喜忌，按调候与具体作用另判',
    primaryReason: '中和待判',
  },
];

const TRANSFORMATION_USEFUL_RULE: RuleMetadata = {
  id: 'transformed-element-following',
  label: '化神顺势取用',
  description: '《子平真诠》从化取用以所化之物及生化神者为基础，财伤与过旺制化另核条件；《滴天髓》化土阴寒先取火温养。',
};

const THERAPEUTIC_PRIORITY_RULE: RuleMetadata = {
  id: 'earth-month-release-output',
  label: '土月疏泄病药规则',
  description: '辰戌丑未月土日主身强而土重壅滞时，优先取食伤以疏泄。',
};

const STRENGTH_HINT_RULES: Array<RuleMetadata & { strengths: string[]; hint: string }> = [
  {
    id: 'strength-strong-stagnation',
    label: '身强壅滞病药提示',
    description: '身强多壅，宜疏泄流通。',
    strengths: ['身强', '偏强', '极强'],
    hint: '病在壅滞，宜疏泄流通',
  },
  {
    id: 'strength-weak-deficiency',
    label: '身弱不足病药提示',
    description: '身弱多虚，宜扶助培元。',
    strengths: ['身弱', '偏弱', '极弱'],
    hint: '病在不足，宜扶助培元',
  },
];

const RULE_CATALOG: Record<string, RuleMetadata> = Object.fromEntries(
  [...BASE_USEFUL_GOD_RULES, TRANSFORMATION_USEFUL_RULE, THERAPEUTIC_PRIORITY_RULE, ...STRENGTH_HINT_RULES].map((rule) => [
    rule.id,
    { id: rule.id, label: rule.label, description: rule.description },
  ]),
);

export interface UsefulGodPlacementItem {
  pillar: PillarName;
  branch?: string;
  stem: string;
  tenGod: string;
  status: '喜用五行透出' | '喜用五行藏支' | '忌神五行透出' | '忌神五行藏支' | '喜忌冲突' | '中性';
  evidence: string;
}

export interface UsefulGodPlacementProfile {
  items: UsefulGodPlacementItem[];
  favorableCount: number;
  unfavorableCount: number;
  summary: string;
}

export interface UsefulGodDecisionEvidence {
  base: { favorable: string[]; unfavorable: string[]; ruleId?: string };
  climateCandidates: Array<{
    ruleId: string;
    mode: string;
    status: string;
    requestedOrder: string[];
    missingInputs: string[];
    adopted: boolean;
  }>;
  climateReferenceOrder?: string[];
  climateAppliedRuleIds?: string[];
  conditionalFavorableStems?: string[];
  conditionalUnfavorableStems?: string[];
  conditionalFavorableWuxing?: string[];
  patternBreakerRestrictions?: Array<{
    label: string;
    repairStatus: string;
    stems: Array<{ position: PillarName; stem: string; tenGod: string }>;
  }>;
  balanceAdjustment?: { reason: string; favorableOrder: string[] };
  transformation?: { element: string; basis: string; conditions: string[] };
  appliedLayers: string[];
  conflicts: string[];
}

export interface UsefulGodResult {
  favorable: string[];
  unfavorable: string[];
  primaryFavorable: string[];
  secondaryFavorable: string[];
  primaryUnfavorable: string[];
  secondaryUnfavorable: string[];
  useful: string;
  avoid: string;
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  primaryFavorableWuxing: string;
  secondaryFavorableWuxing: string[];
  primaryUnfavorableWuxing: string;
  secondaryUnfavorableWuxing: string[];
  primaryUseful: string;
  primaryAvoid: string;
  incrementStatus: '已判定' | '部分判定' | '待判';
  conditionalFavorableStems?: string[];
  conditionalUnfavorableStems?: string[];
  conditionalFavorableWuxing?: string[];
  decisionEvidence: UsefulGodDecisionEvidence;
  strategyTrace: string[];
  primaryReason: string;
  matchedRules: RuleMetadata[];
  placement: UsefulGodPlacementProfile;
}

interface DecisionState {
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

function buildWuxingBundles(dmWuxing: string): Record<WuxingBundle, string[]> {
  const companion = dmWuxing;
  const output = GENERATES[dmWuxing];
  const wealth = CONTROLS[dmWuxing];
  const officer = previous(CONTROLS, dmWuxing);
  const resource = previous(GENERATES, dmWuxing);
  return {
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
}

function resolveTenGodCategoryLabel(dmWuxing: string, targetWuxing: string): string {
  if (targetWuxing === dmWuxing) return '比劫';
  if (targetWuxing === GENERATES[dmWuxing]) return '食伤';
  if (targetWuxing === CONTROLS[dmWuxing]) return '财星';
  if (targetWuxing === previous(CONTROLS, dmWuxing)) return '官杀';
  if (targetWuxing === previous(GENERATES, dmWuxing)) return '印星';
  return '待定';
}

function buildWuxingToTenGodMap(dmWuxing: string): Record<string, string[]> {
  return {
    [dmWuxing]: ['比肩', '劫财'],
    [GENERATES[dmWuxing]]: ['食神', '伤官'],
    [CONTROLS[dmWuxing]]: ['正财', '偏财'],
    [previous(CONTROLS, dmWuxing)]: ['正官', '七杀'],
    [previous(GENERATES, dmWuxing)]: ['正印', '偏印'],
  };
}

function resolveRuleMetadataList(ruleIds: string[], climateCandidates: Climate['candidates']): RuleMetadata[] {
  const climateMap = new Map(
    climateCandidates.map((c) => [c.id, { id: c.id, label: c.label, description: c.hint }]),
  );
  return ruleIds
    .map((id) => RULE_CATALOG[id] ?? climateMap.get(id))
    .filter((item): item is RuleMetadata => Boolean(item))
    .map((item) => ({ ...item }));
}

function applySpecialStrongOutputConditions(
  state: DecisionState,
  patternOverview: PatternOverview,
  patternEvidence: PatternEvidence,
  dmWuxing: string,
): DecisionState {
  if (patternOverview.source === '普通月令取格候选' || patternOverview.pattern !== '专旺格') return state;
  const outputWuxing = GENERATES[dmWuxing];
  const provenResourceOutputPaths = patternEvidence.paths.filter(
    (path) =>
      path.status === '满足' &&
      path.pairs.length > 0 &&
      path.pairs.every(
        (pair) => RESOURCE_TEN_GODS.has(pair.source.tenGod) && OUTPUT_TEN_GODS.has(pair.target.tenGod),
      ),
  );
  const restrictedOutputStems = [
    ...new Set(provenResourceOutputPaths.flatMap((path) => path.pairs.map((pair) => pair.target.stem))),
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
  const conflictText = provenResourceOutputPaths
    .map(
      (path) =>
        `${path.label}[${[...new Set(path.pairs.map((p) => p.source.stem))].join('、')} -> ${[...new Set(path.pairs.map((p) => p.target.stem))].join('、')}]`,
    )
    .join('；');
  const appliedLayers = state.decisionEvidence.appliedLayers.includes('专旺食伤条件')
    ? state.decisionEvidence.appliedLayers
    : [...state.decisionEvidence.appliedLayers, '专旺食伤条件'];
  return {
    ...state,
    conditionalFavorableStems,
    conditionalUnfavorableStems,
    conditionalFavorableWuxing,
    trace: [
      ...state.trace,
      `食伤条件:${outputWuxing}仅在原局印轻且食伤泄秀作用成立时纳入喜用`,
      ...(conflictText ? [`印食作用限制:${conflictText}，只限制已证作用对象干，不扩大为${outputWuxing}忌`] : []),
    ],
    decisionEvidence: {
      ...state.decisionEvidence,
      conditionalFavorableStems,
      conditionalUnfavorableStems,
      conditionalFavorableWuxing,
      appliedLayers,
      conflicts: conflictText
        ? [...state.decisionEvidence.conflicts, `印食具体作用:${conflictText}`]
        : state.decisionEvidence.conflicts,
    },
  };
}

function applyResourceProtection(
  state: DecisionState,
  pillars: Pillars,
  strengthStatus: string,
  isSpecial: boolean,
  dmWuxing: string,
): DecisionState {
  if (isSpecial || !['身弱', '偏弱', '极弱'].includes(strengthStatus)) return state;
  const resource = previous(GENERATES, dmWuxing);
  const wealth = CONTROLS[dmWuxing];
  if (!resource || !state.favorableWuxing.includes(resource) || !state.favorableWuxing.includes(dmWuxing)) {
    return state;
  }
  const monthPrincipal = pillars.month.hiddenStems[0]?.stem;
  if (!monthPrincipal || stemElementOf(monthPrincipal) !== wealth) return state;

  const usableRoots = (element: string) =>
    collectTraditionalRoots(pillars, element).filter((root) => root.actionable && root.kind !== '弱藏');
  const resourceRoots = usableRoots(resource).filter((root) => ['本气', '生禄'].includes(root.kind));
  const companionRoots = usableRoots(dmWuxing);
  const resourceStems = PILLAR_ORDER.filter((pos) => pillars[pos].stemElement === resource).map((pos) => ({
    pillar: pos,
    stem: pillars[pos].gan,
  }));
  if (!resourceStems.length || resourceRoots.length) return state;
  if (
    !resourceStems.every(({ pillar }) => {
      const seatMain = pillars[pillar].hiddenStems[0]?.stem;
      return seatMain && stemElementOf(seatMain) === wealth;
    })
  ) {
    return state;
  }
  const rootedCompanions = PILLAR_ORDER.filter(
    (pos) => pos !== 'day' && pillars[pos].stemElement === dmWuxing && companionRoots.length > 0,
  ).map((pos) => pillars[pos].gan);
  if (!rootedCompanions.length) return state;

  const favorableOrder = [dmWuxing, ...state.favorableWuxing.filter((w) => w !== dmWuxing)];
  const companionRootKinds = [
    ...new Set(companionRoots.map((root) => (root.kind === '正库' || root.kind === '余气' ? `${root.kind}轻根` : root.kind))),
  ].join('、');
  const reason = `月令本气为财，${resourceStems.map((s) => s.stem).join('、')}印坐财受制且缺少可用结构根；${rootedCompanions.join('、')}比劫透而有根（${companionRootKinds}），先以${dmWuxing}扶身制财护印，再取${resource}生身，印比配合`;
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

function applyPatternBreakerRestrictions(
  state: DecisionState,
  isSpecial: boolean,
  patternEvidence: PatternEvidence,
): DecisionState {
  if (isSpecial || patternEvidence.decision?.status !== '破格') return state;
  const restrictions = patternEvidence.decision.breakers.filter(
    (breaker) => breaker.repairStatus === '不满足' && breaker.stems.length > 0,
  );
  if (!restrictions.length) return state;

  const restrictedStems = [...new Set(restrictions.flatMap((b) => b.stems.map((s) => s.stem)))];
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
    .map((b) => `${b.label}:${b.stems.map((s) => `${s.stem}${s.tenGod}`).join('、')}`)
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
      patternBreakerRestrictions: restrictions.map((b) => ({
        label: b.label,
        repairStatus: b.repairStatus,
        stems: b.stems,
      })),
      appliedLayers,
    },
  };
}

/** 登记四柱透干与藏干的喜忌归属落位；不超出盘面事实推断力量强弱。 */
export function analyzeUsefulGodPlacement(
  pillars: Pillars,
  favorableWuxing: string[],
  unfavorableWuxing: string[],
): UsefulGodPlacementProfile {
  const items: UsefulGodPlacementItem[] = [];
  const classify = (element: string, location: '透出' | '藏支'): UsefulGodPlacementItem['status'] => {
    const isFav = element !== '' && favorableWuxing.includes(element);
    const isUnfav = element !== '' && unfavorableWuxing.includes(element);
    if (isFav && isUnfav) return '喜忌冲突';
    if (isFav) return location === '透出' ? '喜用五行透出' : '喜用五行藏支';
    if (isUnfav) return location === '透出' ? '忌神五行透出' : '忌神五行藏支';
    return '中性';
  };

  for (const pillarName of PILLAR_ORDER) {
    const pillar = pillars[pillarName];
    items.push({
      pillar: pillarName,
      stem: pillar.gan,
      tenGod: pillar.tenGod,
      status: classify(pillar.stemElement, '透出'),
      evidence: `${pillar.gan}透于${pillarName}`,
    });
    for (const hidden of pillar.hiddenStems) {
      items.push({
        pillar: pillarName,
        branch: pillar.zhi,
        stem: hidden.stem,
        tenGod: hidden.tenGod,
        status: classify(stemElementOf(hidden.stem), '藏支'),
        evidence: `${hidden.stem}藏于${pillar.zhi}`,
      });
    }
  }

  const favorableCount = items.filter((i) => i.status.startsWith('喜用')).length;
  const unfavorableCount = items.filter((i) => i.status.startsWith('忌神')).length;
  return { items, favorableCount, unfavorableCount, summary: '用神落点分析' };
}

function finalizeUsefulGod(
  state: DecisionState,
  pillars: Pillars,
  dmWuxing: string,
  climateCandidates: Climate['candidates'],
): UsefulGodResult {
  const wuxingToTenGodMap = buildWuxingToTenGodMap(dmWuxing);
  const restrictedTenGods = new Set(
    (state.decisionEvidence.patternBreakerRestrictions ?? []).flatMap((b) => b.stems.map((s) => s.tenGod)),
  );
  const excludeRestricted = (gods: string[]) => gods.filter((god) => !restrictedTenGods.has(god));
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

  const favorable = excludeRestricted(state.favorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []));
  const unfavorable = [
    ...new Set([
      ...state.unfavorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []),
      ...restrictedTenGods,
    ]),
  ];
  const primaryFavorable = primaryFavorableWuxing
    ? excludeRestricted(wuxingToTenGodMap[primaryFavorableWuxing] || [])
    : [];
  const secondaryFavorable = excludeRestricted(
    secondaryFavorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []),
  );
  const primaryUnfavorable = primaryUnfavorableWuxing
    ? wuxingToTenGodMap[primaryUnfavorableWuxing] || []
    : [];
  const secondaryUnfavorable = [
    ...new Set([
      ...secondaryUnfavorableWuxing.flatMap((wx) => wuxingToTenGodMap[wx] || []),
      ...[...restrictedTenGods].filter((god) => !primaryUnfavorable.includes(god)),
    ]),
  ];

  const useful = primaryFavorableWuxing
    ? primaryFavorable.length === 1
      ? primaryFavorable[0]
      : primaryFavorable.length > 1
        ? resolveTenGodCategoryLabel(dmWuxing, primaryFavorableWuxing)
        : '待判'
    : '待判';
  const avoid = primaryUnfavorableWuxing
    ? resolveTenGodCategoryLabel(dmWuxing, primaryUnfavorableWuxing)
    : '待判';

  return {
    favorable,
    unfavorable,
    primaryFavorable,
    secondaryFavorable,
    primaryUnfavorable,
    secondaryUnfavorable,
    useful,
    avoid,
    favorableWuxing: state.favorableWuxing,
    unfavorableWuxing: state.unfavorableWuxing,
    primaryFavorableWuxing,
    secondaryFavorableWuxing,
    primaryUnfavorableWuxing,
    secondaryUnfavorableWuxing,
    primaryUseful: useful,
    primaryAvoid: avoid,
    incrementStatus,
    ...(state.conditionalFavorableStems !== undefined
      ? { conditionalFavorableStems: state.conditionalFavorableStems }
      : {}),
    ...(state.conditionalUnfavorableStems !== undefined
      ? { conditionalUnfavorableStems: state.conditionalUnfavorableStems }
      : {}),
    ...(state.conditionalFavorableWuxing !== undefined
      ? { conditionalFavorableWuxing: state.conditionalFavorableWuxing }
      : {}),
    decisionEvidence: state.decisionEvidence,
    strategyTrace: state.trace,
    primaryReason: state.primaryReason,
    matchedRules: resolveRuleMetadataList(state.matchedRuleIds, climateCandidates),
    placement: analyzeUsefulGodPlacement(pillars, state.favorableWuxing, state.unfavorableWuxing),
  };
}

export interface UsefulGodInput {
  pillars: Pillars;
  strength: Strength;
  patternOverview: PatternOverview;
  patternEvidence: PatternEvidence;
  transformation: Transformation;
  climate: Climate;
  climateDecision: ClimateDecision;
  monthCommander: { stem: string };
}

/** 综合扶抑、特殊格、化神、调候、司权、病药、护印与破格限制，裁定最终用神与落位。 */
export function determineUsefulGod(input: UsefulGodInput): UsefulGodResult {
  const { pillars, strength, patternOverview, patternEvidence, transformation, climate, climateDecision, monthCommander } = input;
  const dmWuxing = pillars.day.stemElement;
  const monthBranch = pillars.month.zhi;
  const isSpecial = patternOverview.source !== '普通月令取格候选';

  if (patternOverview.source === '五合化气条件模型' && transformation?.status === '成化') {
    const element = transformation.element;
    const resource = previous(GENERATES, element);
    const output = GENERATES[element];
    const wealth = CONTROLS[element];
    const controller = previous(CONTROLS, element);
    const coldEarth = element === '土' && ['亥', '子', '丑'].includes(monthBranch);
    const favorable = coldEarth ? [resource, element] : [element, resource];
    const unfavorable = [controller];
    const basis =
      `按《子平真诠》从化口径，以化神${element}为取用主体，` +
      (coldEarth ? '化土生于冬月，先取火温土，再论土气承接。' : `以${element}同气与${resource}生化神为顺势基础。`) +
      '原日主旺衰保留作本命事实，十神称谓仍按原日干对应。';
    const conditions = [
      `日干与配干${transformation.adjacent ? '紧贴' : '隔位'}；月令本气${transformation.monthSupported ? '支持' : '不支持'}`,
      `${output}泄化神、${wealth}为化神所克，须核对化神能否承受泄耗及岁运配合，再定是否可用。`,
      `克化神的${controller}在顺势基线列忌；若化神太过，须另核《滴天髓》的泄耗制化条件，不能只凭成化格名决定增补。`,
    ];
    return finalizeUsefulGod(
      {
        favorableWuxing: favorable,
        unfavorableWuxing: unfavorable,
        trace: [basis, ...conditions],
        primaryReason: '化神顺势',
        matchedRuleIds: [TRANSFORMATION_USEFUL_RULE.id],
        decisionEvidence: {
          base: { favorable: [...favorable], unfavorable: [...unfavorable], ruleId: TRANSFORMATION_USEFUL_RULE.id },
          climateCandidates: [],
          transformation: { element, basis, conditions },
          appliedLayers: ['化神顺势'],
          conflicts: [],
        },
      },
      pillars,
      dmWuxing,
      climate.candidates,
    );
  }

  const matchedRule = isSpecial
    ? BASE_USEFUL_GOD_RULES.find((r) => r.patterns?.includes(patternOverview.pattern))
    : BASE_USEFUL_GOD_RULES.find((r) => r.strengths?.includes(strength.status));
  if (!matchedRule) {
    throw new Error(isSpecial ? `特殊格局缺少取用规则：${patternOverview.pattern}` : `旺衰状态缺少取用规则：${strength.status}`);
  }

  const bundles = buildWuxingBundles(dmWuxing);
  const baseFavorable = bundles[matchedRule.favorable];
  const baseUnfavorable = bundles[matchedRule.unfavorable];
  const ordinaryTrace = isSpecial
    ? []
    : [`普通格局:${patternOverview.pattern}，喜忌先按${strength.status}扶抑登记基线，不因格名直接改判`];

  let state: DecisionState = applySpecialStrongOutputConditions(
    {
      favorableWuxing: [...baseFavorable],
      unfavorableWuxing: [...baseUnfavorable],
      trace: [...ordinaryTrace, matchedRule.trace],
      primaryReason: matchedRule.primaryReason,
      matchedRuleIds: [matchedRule.id],
      decisionEvidence: {
        base: { favorable: [...baseFavorable], unfavorable: [...baseUnfavorable], ruleId: matchedRule.id },
        climateCandidates: [],
        appliedLayers: [matchedRule.primaryReason],
        conflicts: [],
      },
    },
    patternOverview,
    patternEvidence,
    dmWuxing,
  );

  const conflictSet = new Set(climateDecision.conflicts);
  const appliedSet = new Set(climateDecision.applied);
  const climateEvidence = climate.candidates.map((c) => ({
    ruleId: c.id,
    mode: c.mode,
    status: conflictSet.has(c.id) ? '冲突' : c.status,
    requestedOrder: [...new Set([...c.favorableOrder, c.usefulElement].filter(Boolean))],
    missingInputs: c.missingInputs,
    adopted: appliedSet.has(c.id),
  }));

  const appliedCandidates = climate.candidates.filter((c) => appliedSet.has(c.id));
  const nextLayers = [...state.decisionEvidence.appliedLayers];
  let nextPrimaryReason = state.primaryReason;
  if (appliedCandidates.length) {
    const hasConditional = appliedCandidates.some((c) => c.mode === 'conditional');
    const layer = hasConditional ? '调候' : '调候参考';
    if (!nextLayers.includes(layer)) nextLayers.push(layer);
    if (hasConditional) {
      const role = (appliedCandidates[0].effects as Array<{ role?: string }> | undefined)?.[0]?.role ?? '';
      if (role.includes('制化') || role.includes('裁') || role.includes('通关')) nextPrimaryReason = '制化';
      else if (role.includes('调候') || role.includes('暖') || role.includes('润') || role.includes('燥')) nextPrimaryReason = '调候';
    }
  }

  const climateConflicts = climateDecision.conflicts.length
    ? [`同权限调候候选冲突:${climateDecision.conflicts.join('、')}`]
    : [];
  const nextTrace = [
    ...state.trace,
    ...(climateDecision.referenceOrder.length ? [`调候参考:${climateDecision.referenceOrder.join(' -> ')}`] : []),
    ...climateConflicts,
  ];
  const mergedFavStems = climateDecision.conditionalFavorableStems.length
    ? [...new Set([...(state.conditionalFavorableStems ?? []), ...climateDecision.conditionalFavorableStems])].filter(
        (s) => !(state.conditionalUnfavorableStems ?? []).includes(s),
      )
    : state.conditionalFavorableStems;
  const mergedUnfavStems = climateDecision.conditionalUnfavorableStems.length
    ? [...new Set([...(state.conditionalUnfavorableStems ?? []), ...climateDecision.conditionalUnfavorableStems])]
    : state.conditionalUnfavorableStems;
  const mergedFavWuxing = climateDecision.conditionalFavorableElements.length
    ? [...new Set([...(state.conditionalFavorableWuxing ?? []), ...climateDecision.conditionalFavorableElements])]
    : state.conditionalFavorableWuxing;

  const primarySatisfied = climate.candidates.find((c) => c.status === '满足');
  const climateRuleIds = appliedSet.size
    ? [...appliedSet]
    : primarySatisfied
      ? [primarySatisfied.id]
      : [];

  state = {
    ...state,
    favorableWuxing: climateDecision.applied.length ? [...climateDecision.favorable] : state.favorableWuxing,
    unfavorableWuxing: climateDecision.applied.length ? [...climateDecision.unfavorable] : state.unfavorableWuxing,
    primaryReason: nextPrimaryReason,
    trace: nextTrace,
    matchedRuleIds: [...new Set([...state.matchedRuleIds, ...climateRuleIds])],
    conditionalFavorableStems: mergedFavStems,
    conditionalUnfavorableStems: mergedUnfavStems,
    conditionalFavorableWuxing: mergedFavWuxing,
    decisionEvidence: {
      ...state.decisionEvidence,
      climateCandidates: climateEvidence,
      ...(climateDecision.referenceOrder.length ? { climateReferenceOrder: [...climateDecision.referenceOrder] } : {}),
      ...(climateDecision.applied.length ? { climateAppliedRuleIds: [...climateDecision.applied] } : {}),
      conditionalFavorableStems: mergedFavStems,
      conditionalUnfavorableStems: mergedUnfavStems,
      conditionalFavorableWuxing: mergedFavWuxing,
      appliedLayers: nextLayers,
      conflicts: [...state.decisionEvidence.conflicts, ...climateConflicts],
    },
  };

  const commanderWuxing = isSpecial ? '' : stemElementOf(monthCommander.stem);
  if (commanderWuxing && state.favorableWuxing.includes(commanderWuxing)) {
    const appliedLayers = state.decisionEvidence.appliedLayers.includes('司令')
      ? state.decisionEvidence.appliedLayers
      : [...state.decisionEvidence.appliedLayers, '司令'];
    state = {
      ...state,
      favorableWuxing: [commanderWuxing, ...state.favorableWuxing.filter((w) => w !== commanderWuxing)],
      trace: [...state.trace, `司令排序:${commanderWuxing}`],
      primaryReason: state.primaryReason === '调候' ? state.primaryReason : '司令',
      decisionEvidence: { ...state.decisionEvidence, appliedLayers },
    };
  }

  if (
    !isSpecial &&
    dmWuxing === '土' &&
    ['辰', '戌', '丑', '未'].includes(monthBranch) &&
    ['身强', '偏强', '极强'].includes(strength.status)
  ) {
    const therapeuticWuxing = GENERATES[dmWuxing];
    if (state.favorableWuxing.includes(therapeuticWuxing)) {
      const appliedLayers = state.decisionEvidence.appliedLayers.includes('病药')
        ? state.decisionEvidence.appliedLayers
        : [...state.decisionEvidence.appliedLayers, '病药'];
      state = {
        ...state,
        favorableWuxing: [therapeuticWuxing, ...state.favorableWuxing.filter((w) => w !== therapeuticWuxing)],
        trace: [...state.trace, `病药优先:${therapeuticWuxing}`],
        primaryReason: '病药',
        matchedRuleIds: [...new Set([...state.matchedRuleIds, THERAPEUTIC_PRIORITY_RULE.id])],
        decisionEvidence: { ...state.decisionEvidence, appliedLayers },
      };
    }
  }

  state = applyResourceProtection(state, pillars, strength.status, isSpecial, dmWuxing);
  state = applyPatternBreakerRestrictions(state, isSpecial, patternEvidence);

  const hintClimate = !isSpecial ? climate.candidates.find((c) => c.status === '满足') : undefined;
  const hintStrength = !isSpecial && !hintClimate
    ? STRENGTH_HINT_RULES.find((r) => r.strengths.includes(strength.status))
    : undefined;
  const hintText = hintClimate?.hint ?? hintStrength?.hint ?? '';
  const hintRuleId = hintClimate?.id ?? hintStrength?.id ?? '';

  const restrictedStems = new Set(
    (state.decisionEvidence.patternBreakerRestrictions ?? []).flatMap((b) => b.stems.map((s) => s.stem)),
  );
  const hintRecStems = hintClimate
    ? [
        ...new Set([
          ...hintClimate.recommendationStems,
          ...((hintClimate.effects as Array<{ stem: string }> | undefined)?.map((e) => e.stem) ?? []),
        ]),
      ]
    : [];
  const hintBlocked = hintRecStems.some((stem) => restrictedStems.has(stem));

  if (hintBlocked && hintRuleId) {
    state = { ...state, matchedRuleIds: state.matchedRuleIds.filter((id) => id !== hintRuleId) };
  } else if (hintRuleId && !state.matchedRuleIds.includes(hintRuleId)) {
    state = { ...state, matchedRuleIds: [...state.matchedRuleIds, hintRuleId] };
  }

  return finalizeUsefulGod(
    {
      ...state,
      trace: [
        ...state.trace,
        ...(hintText && !hintBlocked ? [`病药提示:${hintText}`] : []),
        `最终取用:${state.favorableWuxing.join(' -> ')}`,
      ],
    },
    pillars,
    dmWuxing,
    climate.candidates,
  );
}

export function formatUsefulGod(result: UsefulGodResult): string {
  const favItems = result.placement.items
    .filter((item) => item.status.startsWith('喜用') || item.status.startsWith('主用'))
    .map((item) => `${PILLAR_LABELS[item.pillar]}${item.branch ?? ''}${item.stem}（${item.tenGod}）`);
  const unfavItems = result.placement.items
    .filter((item) => item.status.startsWith('忌神'))
    .map((item) => `${PILLAR_LABELS[item.pillar]}${item.branch ?? ''}${item.stem}（${item.tenGod}）`);
  const conflictItems = result.placement.items
    .filter((item) => item.status === '喜忌冲突')
    .map((item) => `${PILLAR_LABELS[item.pillar]}${item.branch ?? ''}${item.stem}（${item.tenGod}）`);
  const placementText = [
    favItems.length ? `喜用［${favItems.join('、')}］` : '',
    unfavItems.length ? `忌神［${unfavItems.join('、')}］` : '',
    conflictItems.length ? `喜忌冲突［${conflictItems.join('、')}］` : '',
  ].filter(Boolean).join('；') || '未见明显喜忌落位';
  const conditionalText = [
    result.conditionalFavorableStems?.length ? `条件有利干${result.conditionalFavorableStems.join('、')}` : '',
    result.conditionalUnfavorableStems?.length ? `条件不利干${result.conditionalUnfavorableStems.join('、')}` : '',
  ].filter(Boolean).join('；');
  return [
    `主裁定：${result.primaryReason}（${result.incrementStatus}）；主用神：${result.useful}；主忌神：${result.avoid}。`,
    `喜用五行：${result.favorableWuxing.join('、') || '待判'}（十神：${result.favorable.join('、') || '待判'}）；忌神五行：${result.unfavorableWuxing.join('、') || '待判'}（十神：${result.unfavorable.join('、') || '待判'}）。${conditionalText ? `${conditionalText}。` : ''}`,
    `用神落位（喜用${result.placement.favorableCount}处、忌神${result.placement.unfavorableCount}处）：${placementText}。`,
    `裁定层级：${result.decisionEvidence.appliedLayers.join(' → ')}。`,
  ].join('\n');
}
