import { KE_MAP, SHENG_MAP, WUXING } from '../ganzhi-foundation';
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

const PILLAR_ORDER: PillarName[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const GENERATES: Record<string, string> = SHENG_MAP;
const CONTROLS: Record<string, string> = KE_MAP;
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
    trace: '曲直格取水木顺势、火泄秀；土财见火通关可用，无火克印则忌',
    primaryReason: '曲直顺势泄秀',
  },
  {
    id: 'follow-special-strong',
    label: '专旺格顺势规则',
    description: '通用专旺格以印比顺势为确定取向；原局印轻时食伤可泄秀为喜，印重则食伤与印相碍不取，若已有印食具体冲克则按实际作用干限制。',
    priority: 100,
    patterns: ['专旺格'],
    favorable: 'resource_companion',
    unfavorable: 'wealth_officer',
    trace: '专旺格以印比顺势；原局印轻时食伤可泄秀，印重则不取食伤',
    primaryReason: '顺势',
  },
  {
    id: 'follow-conger',
    label: '从儿格顺局规则',
    description: '《滴天髓阐微·顺局》从儿以食伤生财为喜，印星制食伤为首忌，官杀耗财逆局次忌；比劫在财旺时助生食伤可用，财轻时争财转忌。',
    priority: 105,
    patterns: ['从儿格'],
    favorable: 'wealth_output',
    unfavorable: 'resource_officer',
    trace: '从儿格取财星、食伤顺局，忌印星、官杀逆局；比劫财旺可用、财轻争财转忌',
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
    label: '中和动态取用规则',
    description: '中和命局不机械套用整五行扶抑；结合月令寒暖调候、原局生扶/克泄微偏及病药流通给出明确一级主选方向，并随岁运偏枯动态切换。',
    priority: 50,
    strengths: ['中和'],
    favorable: 'none',
    unfavorable: 'none',
    trace: '中和命局先观寒暖调候、次看原局微偏与病药流通定一级主选方向，岁运偏枯再转扶抑',
    primaryReason: '中和流通调候',
  },
];

const TRANSFORMATION_USEFUL_RULE: RuleMetadata = {
  id: 'transformed-element-following',
  label: '化神顺势取用',
  description: '《子平真诠》从化取用以所化之物及生化神者为基础，化神偏旺时以食伤财星疏泄分势；《滴天髓》化土阴寒先取火温养。',
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

export interface MediationPath {
  conflictType: '财印相战' | '官杀混杂' | '伤官见官' | '枭神夺食' | '比劫夺财';
  severity: '显性明透' | '干支暗战';
  involved: string[];
  primaryRemedy: string;
  alternativeRemedy: string;
}

export interface UsefulGodTradeoffAnalysis {
  scenarioTags: string[];
  climateVsBalance: {
    status: '一致' | '冲突' | '调候未触发' | '特殊格从势优先';
    summary: string;
    priorityAdvice: string;
  };
  neutralGuidance?: {
    tendencyNote: string;
    dynamicTrigger: string;
  };
  followEdgeAssessment?: {
    kind: '真从纯格' | '假从/从格边缘' | '扶抑近从边界';
    summary: string;
    fortuneSwitchRule: string;
  };
  mediationPaths: MediationPath[];
  synthesis: string;
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
  incrementStatus: '已判定' | '部分判定';
  conditionalFavorableStems?: string[];
  conditionalUnfavorableStems?: string[];
  conditionalFavorableWuxing?: string[];
  decisionEvidence: UsefulGodDecisionEvidence;
  strategyTrace: string[];
  primaryReason: string;
  matchedRules: RuleMetadata[];
  placement: UsefulGodPlacementProfile;
  tradeoffAnalysis?: UsefulGodTradeoffAnalysis;
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

const WEALTH_TEN_GODS = new Set(['正财', '偏财']);
const OFFICER_TEN_GODS = new Set(['正官', '七杀']);
const COMPANION_TEN_GODS = new Set(['比肩', '劫财']);

function detectMediationPaths(
  pillars: Pillars,
  dmWuxing: string,
  strengthStatus: string,
  isSpecial: boolean,
): MediationPath[] {
  if (isSpecial) return [];
  const isWeak = ['身弱', '偏弱', '极弱'].includes(strengthStatus);
  const resource = previous(GENERATES, dmWuxing);
  const output = GENERATES[dmWuxing];
  const wealth = CONTROLS[dmWuxing];
  const officer = previous(CONTROLS, dmWuxing);

  const visibleEntries = PILLAR_ORDER.filter((p) => p !== 'day').map((p) => ({
    pillar: p,
    label: `${PILLAR_LABELS[p].slice(0, 1)}干${pillars[p].gan}(${pillars[p].tenGod})`,
    tenGod: pillars[p].tenGod,
  }));
  const branchEntries = PILLAR_ORDER.map((p) => {
    const main = pillars[p].hiddenStems[0];
    return {
      pillar: p,
      label: `${PILLAR_LABELS[p].slice(0, 1)}支${pillars[p].zhi}(${main?.tenGod ?? ''})`,
      tenGod: main?.tenGod ?? '',
    };
  });
  const allEntries = [...visibleEntries, ...branchEntries];

  const findGroup = (set: Set<string>) => ({
    visible: visibleEntries.filter((e) => set.has(e.tenGod)),
    all: allEntries.filter((e) => set.has(e.tenGod)),
  });

  const paths: MediationPath[] = [];

  // 1. 财印相战
  const wealthGroup = findGroup(WEALTH_TEN_GODS);
  const resourceGroup = findGroup(RESOURCE_TEN_GODS);
  if (wealthGroup.all.length > 0 && resourceGroup.all.length > 0 && (wealthGroup.visible.length > 0 || resourceGroup.visible.length > 0)) {
    const bothVisible = wealthGroup.visible.length > 0 && resourceGroup.visible.length > 0;
    const involved = [...wealthGroup.all.slice(0, 2), ...resourceGroup.all.slice(0, 2)].map((e) => e.label);
    paths.push({
      conflictType: '财印相战',
      severity: bothVisible ? '显性明透' : '干支暗战',
      involved,
      primaryRemedy: isWeak
        ? `身弱财破印，优先取比劫（${dmWuxing}）制财护印，稳住印星生身之源`
        : `优先取官杀（${officer}）通关（财生官、官生印），化财印相克为连续相生`,
      alternativeRemedy: isWeak
        ? `次选官杀（${officer}）引财生印，但须防官杀泄财反克弱身，需配印星有根`
        : `若官杀无力或忌官杀，可察食伤（${output}）泄身生财，但须避印重夺食`,
    });
  }

  // 2. 官杀混杂
  const zhengGuan = findGroup(new Set(['正官']));
  const qiSha = findGroup(new Set(['七杀']));
  if (zhengGuan.all.length > 0 && qiSha.all.length > 0 && (zhengGuan.visible.length > 0 || qiSha.visible.length > 0)) {
    const bothVisible = zhengGuan.visible.length > 0 && qiSha.visible.length > 0;
    const involved = [...zhengGuan.all.slice(0, 2), ...qiSha.all.slice(0, 2)].map((e) => e.label);
    paths.push({
      conflictType: '官杀混杂',
      severity: bothVisible ? '显性明透' : '干支暗战',
      involved,
      primaryRemedy: isWeak
        ? `身弱遇官杀混杂，宜取印星（${resource}）化杀生身，以印通关化浊为清`
        : `优先取食伤（${output}）制杀留官或合杀留官，去浊留清`,
      alternativeRemedy: isWeak
        ? `次选合杀留官或轻用比劫（${dmWuxing}）抗杀，慎用重食伤再泄弱身`
        : `若原局带印，亦可用印星（${resource}）化杀护身，忌财星再党杀攻身`,
    });
  }

  // 3. 伤官见官
  const shangGuan = findGroup(new Set(['伤官']));
  if (shangGuan.all.length > 0 && zhengGuan.all.length > 0 && (shangGuan.visible.length > 0 || zhengGuan.visible.length > 0)) {
    const bothVisible = shangGuan.visible.length > 0 && zhengGuan.visible.length > 0;
    const involved = [...shangGuan.all.slice(0, 2), ...zhengGuan.all.slice(0, 2)].map((e) => e.label);
    paths.push({
      conflictType: '伤官见官',
      severity: bothVisible ? '显性明透' : '干支暗战',
      involved,
      primaryRemedy: `优先取印星（${resource}）制伤护官（伤官佩印），护住官星清气`,
      alternativeRemedy: `次选财星（${wealth}）通关（伤官生财、财生正官），化相克为相生`,
    });
  }

  // 4. 枭神夺食
  const pianYin = findGroup(new Set(['偏印']));
  const shiShen = findGroup(new Set(['食神']));
  if (pianYin.all.length > 0 && shiShen.all.length > 0 && (pianYin.visible.length > 0 || shiShen.visible.length > 0)) {
    const bothVisible = pianYin.visible.length > 0 && shiShen.visible.length > 0;
    const involved = [...pianYin.all.slice(0, 2), ...shiShen.all.slice(0, 2)].map((e) => e.label);
    paths.push({
      conflictType: '枭神夺食',
      severity: bothVisible ? '显性明透' : '干支暗战',
      involved,
      primaryRemedy: `优先取财星（${wealth}，尤以偏财为佳）制枭护食，解倒食之病`,
      alternativeRemedy: `次选比劫（${dmWuxing}）泄枭生食，缓冲偏印直克食神之势`,
    });
  }

  // 5. 比劫夺财
  const companionGroup = findGroup(COMPANION_TEN_GODS);
  if (wealthGroup.all.length > 0 && (companionGroup.all.length >= 2 || (companionGroup.visible.length > 0 && wealthGroup.visible.length > 0))) {
    const bothVisible = companionGroup.visible.length > 0 && wealthGroup.visible.length > 0;
    const involved = [...companionGroup.all.slice(0, 2), ...wealthGroup.all.slice(0, 2)].map((e) => e.label);
    paths.push({
      conflictType: '比劫夺财',
      severity: bothVisible ? '显性明透' : '干支暗战',
      involved,
      primaryRemedy: isWeak
        ? `身弱比劫原为助身，若财多身弱可借比劫（${dmWuxing}）分担财势，待身健再取食伤生财`
        : `身强比劫争财，优先取食伤（${output}）通关（比劫生食伤、食伤生财）`,
      alternativeRemedy: isWeak
        ? `忌再增重财破印，宜以印比护身后再议求财`
        : `次选官杀（${officer}）制劫护财，约束比劫不夺财星`,
    });
  }

  return paths;
}

function buildUsefulGodTradeoffAnalysis(
  input: UsefulGodInput,
  state: DecisionState,
  dmWuxing: string,
  isSpecial: boolean,
): UsefulGodTradeoffAnalysis {
  const { pillars, strength, patternOverview, patternEvidence, climate, climateDecision } = input;
  const scenarioTags: string[] = [];
  const baseFav = state.decisionEvidence.base.favorable;
  const baseUnfav = state.decisionEvidence.base.unfavorable;

  // 1. 调候 vs 扶抑权衡
  const climateRequestedElements = [
    ...new Set([
      ...climateDecision.referenceOrder,
      ...climate.candidates
        .filter((c) => c.status === '满足' || c.mode === 'reference')
        .flatMap((c) => [...c.favorableOrder, c.usefulElement])
        .filter(Boolean),
    ]),
  ];
  const urgentSeason = ['亥', '子', '丑', '巳', '午', '未'].includes(pillars.month.zhi);

  let climateVsBalance: UsefulGodTradeoffAnalysis['climateVsBalance'];
  if (isSpecial) {
    climateVsBalance = {
      status: '特殊格从势优先',
      summary: `${patternOverview.pattern}以顺从旺势为先，不按常规扶抑倒置喜忌`,
      priorityAdvice: climateRequestedElements.length
        ? `若兼见寒暖需求（${climateRequestedElements.join('、')}），须在不逆破${patternOverview.pattern}气势的前提下顺势配合`
        : `以维护${patternOverview.pattern}纯粹气势为第一要义`,
    };
  } else if (!climateRequestedElements.length) {
    climateVsBalance = {
      status: '调候未触发',
      summary: `月令${pillars.month.zhi}（${strength.month.season}）未触发显性调候条目，以扶抑与格局成败为主线`,
      priorityAdvice: '优先围绕日主扶抑与月令格局相神取用，兼看原局病药通关',
    };
  } else {
    const primaryClimate = climateRequestedElements[0];
    const conflictsWithBase = baseUnfav.includes(primaryClimate) || climateRequestedElements.some((el) => baseUnfav.includes(el));
    const alignedWithBase = baseFav.includes(primaryClimate);
    if (conflictsWithBase) {
      scenarioTags.push('调候与扶抑冲突');
      climateVsBalance = {
        status: '冲突',
        summary: `调候需${climateRequestedElements.join('、')}，与${strength.status}扶抑基线忌神（${baseUnfav.join('、')}）存在张力`,
        priorityAdvice: urgentSeason
          ? `冬夏急候先顾调候（以${primaryClimate}调和寒暖燥湿），但须配扶抑喜用（${baseFav.slice(0, 2).join('、') || '印比/泄耗'}）护身或通关，切忌单用${primaryClimate}而伤日主`
          : `非冬夏极候时以扶抑与格局为本（喜${baseFav.slice(0, 2).join('、') || '流通护格'}），调候${primaryClimate}作辅助润色`,
      };
    } else if (alignedWithBase) {
      climateVsBalance = {
        status: '一致',
        summary: `调候主需（${climateRequestedElements.join('、')}）与${strength.status}扶抑喜用方向一致`,
        priorityAdvice: `调候与扶抑同向共振，优先取${primaryClimate}可一举兼顾寒暖与强弱`,
      };
    } else if (strength.status === '中和') {
      climateVsBalance = {
        status: '一致',
        summary: `中和命局不预设扶抑偏枯，以调候（${climateRequestedElements.join('、')}）作为优先抓手`,
        priorityAdvice: `先取${primaryClimate}调和气候，再随岁运偏枯动态微调扶抑`,
      };
    } else {
      climateVsBalance = {
        status: '一致',
        summary: `调候参考（${climateRequestedElements.join('、')}）未与扶抑基线直接冲突`,
        priorityAdvice: `以扶抑喜用（${baseFav.slice(0, 2).join('、') || '流通护格'}）为主，遇${primaryClimate}岁运可兼顾气候平衡`,
      };
    }
  }

  // 2. 中和命局动态取用指导
  let neutralGuidance: UsefulGodTradeoffAnalysis['neutralGuidance'];
  if (!isSpecial && strength.status === '中和') {
    scenarioTags.push('中和动态取用');
    const supportCount = strength.support.filter((s) => s.actionable).length + strength.roots.filter((r) => r.actionable).length;
    const constraintCount = strength.constraint.filter((c) => c.actionable).length;
    const microBias = supportCount > constraintCount
      ? '微偏生扶侧（印比略多）'
      : constraintCount > supportCount
        ? '微偏克泄耗侧（财官食伤略多）'
        : '生扶与克泄耗大致均衡';
    const resource = previous(GENERATES, dmWuxing);
    const output = GENERATES[dmWuxing];
    neutralGuidance = {
      tendencyNote: `原局中和而${microBias}，不宜机械套用整五行喜忌；应先护持「${patternOverview.pattern}」清气${climateRequestedElements.length ? `及调候${climateRequestedElements[0]}` : ''}`,
      dynamicTrigger: `岁运见印比（${resource}、${dmWuxing}）骤增转强时，顺取食伤财官泄耗；岁运见财官食伤骤增转弱时，转取印比（${resource}、${dmWuxing}）护身；平运宜用${output}或相神疏通流通`,
    };
  }

  // 3. 真假从格边缘评估
  let followEdgeAssessment: UsefulGodTradeoffAnalysis['followEdgeAssessment'];
  const samePartyGods = new Set(['比肩', '劫财', '正印', '偏印']);
  const isStrongExtreme = strength.status === '极强' || ['曲直格', '专旺格', '炎上格', '稼穑格', '从革格', '润下格'].includes(patternOverview.pattern);
  // 专旺格顺势喜食伤吐秀（化神通路），不可把食伤误判为“反向气机”
  const compatibleStrongExtremeGods = new Set(['比肩', '劫财', '正印', '偏印', '食神', '伤官']);
  const opposingVisibleOrMain = PILLAR_ORDER.flatMap((pos) => {
    const p = pillars[pos];
    const items: string[] = [];
    if (pos !== 'day') {
      const isCompatible = isStrongExtreme ? compatibleStrongExtremeGods.has(p.tenGod) : samePartyGods.has(p.tenGod);
      if ((isStrongExtreme && !isCompatible) || (!isStrongExtreme && isCompatible)) {
        items.push(`${PILLAR_LABELS[pos].slice(0, 1)}干${p.gan}${p.tenGod}`);
      }
    }
    const main = p.hiddenStems[0];
    if (main) {
      const isCompatible = isStrongExtreme ? compatibleStrongExtremeGods.has(main.tenGod) : samePartyGods.has(main.tenGod);
      if ((isStrongExtreme && !isCompatible) || (!isStrongExtreme && isCompatible)) {
        items.push(`${PILLAR_LABELS[pos].slice(0, 1)}支${p.zhi}${main.tenGod}`);
      }
    }
    return items;
  });
  const opposingResidual = PILLAR_ORDER.flatMap((pos) =>
    pillars[pos].hiddenStems.slice(1).flatMap((h) => {
      const isCompatible = isStrongExtreme ? compatibleStrongExtremeGods.has(h.tenGod) : samePartyGods.has(h.tenGod);
      return (isStrongExtreme && !isCompatible) || (!isStrongExtreme && isCompatible)
        ? [`${PILLAR_LABELS[pos].slice(0, 1)}支藏${h.stem}${h.tenGod}`]
        : [];
    }),
  );

  if (isSpecial && patternOverview.source !== '五合化气条件模型') {
    if (opposingVisibleOrMain.length === 0 && opposingResidual.length === 0) {
      followEdgeAssessment = {
        kind: '真从纯格',
        summary: `${patternOverview.pattern}气势纯粹，四柱无反向杂气牵制`,
        fortuneSwitchRule: '岁运宜一味顺势（喜用不逆），最忌突逢逆势旺运破局',
      };
    } else {
      scenarioTags.push('真假从格边缘');
      const mixedDesc = [...opposingVisibleOrMain, ...opposingResidual].slice(0, 3).join('、');
      followEdgeAssessment = {
        kind: '假从/从格边缘',
        summary: `虽取「${patternOverview.pattern}」，但原局犹存反向气机（${mixedDesc}），属假从边缘`,
        fortuneSwitchRule: '行顺势岁运可去杂成真；若行逆势岁运引动原局暗藏杂气，易由从转扶抑，切忌死板一味按真从断',
      };
    }
  } else if (
    !isSpecial &&
    (strength.status === '极强' ||
      strength.status === '极弱' ||
      (strength.status === '身弱' &&
        !strength.strongRoot &&
        strength.roots.filter((r) => r.actionable).length === 0 &&
        strength.support.filter((s) => s.actionable).length <= 1))
  ) {
    scenarioTags.push('真假从格边缘');
    followEdgeAssessment = {
      kind: '扶抑近从边界',
      summary: `旺衰已至「${strength.status}」且接近从格边界，因原局仍存微根/反向牵制故暂按扶抑论`,
      fortuneSwitchRule: '若岁运冲拔微根或合去唯一印比，易滑向假从势；若岁运得强根生扶，则仍按普通扶抑起运，须随岁运动态辨真假',
    };
  }

  // 4. 病药与通关路径
  const mediationPaths = detectMediationPaths(pillars, dmWuxing, strength.status, isSpecial);
  for (const path of mediationPaths) {
    if (!scenarioTags.includes(path.conflictType)) scenarioTags.push(path.conflictType);
  }

  // 5. 格局成败张力补充
  const patternBroken = !isSpecial && patternEvidence.decision?.status === '破格';
  if (patternBroken) scenarioTags.push('格局破格待救');

  const synthesisParts: string[] = [];
  if (climateVsBalance.status === '冲突') {
    synthesisParts.push(`调候与扶抑有张力：${climateVsBalance.priorityAdvice}`);
  } else if (climateVsBalance.status === '一致') {
    synthesisParts.push(climateVsBalance.summary);
  }
  if (neutralGuidance) {
    synthesisParts.push(neutralGuidance.tendencyNote);
  }
  if (followEdgeAssessment && followEdgeAssessment.kind !== '真从纯格') {
    synthesisParts.push(`${followEdgeAssessment.kind}：${followEdgeAssessment.summary}`);
  }
  if (mediationPaths.length > 0) {
    synthesisParts.push(
      `原局见${mediationPaths.map((m) => `${m.conflictType}(${m.severity})`).join('、')}，病药宜${mediationPaths[0].primaryRemedy}`,
    );
  }
  if (patternBroken) {
    synthesisParts.push(`普通格局现破格迹象，须先救应格神再议常规扶抑`);
  }
  if (!synthesisParts.length) {
    synthesisParts.push(`${climateVsBalance.summary}；${climateVsBalance.priorityAdvice}`);
  }

  return {
    scenarioTags,
    climateVsBalance,
    ...(neutralGuidance ? { neutralGuidance } : {}),
    ...(followEdgeAssessment ? { followEdgeAssessment } : {}),
    mediationPaths,
    synthesis: synthesisParts.join('；'),
  };
}

function finalizeUsefulGod(
  state: DecisionState,
  pillars: Pillars,
  dmWuxing: string,
  climateCandidates: Climate['candidates'],
  tradeoffAnalysis?: UsefulGodTradeoffAnalysis,
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
  const incrementStatus: '已判定' | '部分判定' =
    decidedWuxing.size === WUXING.length ? '已判定' : '部分判定';

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
        : resolveTenGodCategoryLabel(dmWuxing, primaryFavorableWuxing)
    : '流通护格';
  const avoid = primaryUnfavorableWuxing
    ? resolveTenGodCategoryLabel(dmWuxing, primaryUnfavorableWuxing)
    : '过偏破衡';

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
    ...(tradeoffAnalysis ? { tradeoffAnalysis } : {}),
  };
}

/**
 * 印重身强（土重埋金/母慈灭子）与身强重枭夺食时，官杀生印/生枭反成助病元凶，
 * 须从喜用中剔除官杀，优先保留财星制印/制枭与食伤泄秀。
 */
function applyHeavySealAndXiaoExclusion(
  state: DecisionState,
  pillars: Pillars,
  strengthStatus: string,
  isSpecial: boolean,
  dmWuxing: string,
): DecisionState {
  if (isSpecial || !['身强', '偏强', '极强'].includes(strengthStatus)) return state;
  const officer = previous(CONTROLS, dmWuxing);
  const wealth = CONTROLS[dmWuxing];
  const visStems = (['year', 'month', 'hour'] as PillarName[]).map((p) => pillars[p].tenGod);
  const visSealCount = visStems.filter((g) => g === '正印' || g === '偏印').length;
  const visXiaoCount = visStems.filter((g) => g === '偏印').length;
  const visFoodCount = visStems.filter((g) => g === '食神').length;
  const visWealthCount = visStems.filter((g) => g === '正财' || g === '偏财').length;
  const monthPrincipalGod = pillars.month.hiddenStems[0]?.tenGod ?? '';
  const monthIsSeal = monthPrincipalGod === '正印' || monthPrincipalGod === '偏印';

  const isHeavySeal = visSealCount >= 2 && monthIsSeal;
  const isHeavyXiaoDuoShi = (visXiaoCount >= 2 || (visXiaoCount >= 1 && monthPrincipalGod === '偏印')) && visFoodCount >= 1 && visWealthCount === 0;

  if (!isHeavySeal && !isHeavyXiaoDuoShi) return state;

  let nextFav = state.favorableWuxing.filter((w) => w !== officer);
  if (isHeavyXiaoDuoShi && nextFav.includes(wealth)) {
    nextFav = [wealth, ...nextFav.filter((w) => w !== wealth)];
  }
  const nextUnfav = state.unfavorableWuxing.includes(officer)
    ? state.unfavorableWuxing
    : [...state.unfavorableWuxing, officer];

  if (nextFav.length === 0) return state;

  const reasonTag = isHeavyXiaoDuoShi
    ? `重枭夺食忌官杀生枭:优先取${wealth}制枭、移除${officer}`
    : `印重成病忌官杀生印:移除${officer}`;

  return {
    ...state,
    favorableWuxing: nextFav,
    unfavorableWuxing: nextUnfav,
    trace: [...state.trace, reasonTag],
    decisionEvidence: {
      ...state.decisionEvidence,
      appliedLayers: state.decisionEvidence.appliedLayers.includes('病药')
        ? state.decisionEvidence.appliedLayers
        : [...state.decisionEvidence.appliedLayers, '病药'],
    },
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
      `克化神的${controller}在顺势基线列忌；若化神过亢无泄，方按《滴天髓》权变取泄耗疏通，常规仍以护持化神纯粹为主。`,
    ];
    const transformState: DecisionState = {
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
    };
    return finalizeUsefulGod(
      transformState,
      pillars,
      dmWuxing,
      climate.candidates,
      buildUsefulGodTradeoffAnalysis(input, transformState, dmWuxing, true),
    );
  }

  const matchedRule = isSpecial
    ? BASE_USEFUL_GOD_RULES.find((r) => r.patterns?.includes(patternOverview.pattern))
    : BASE_USEFUL_GOD_RULES.find((r) => r.strengths?.includes(strength.status));
  if (!matchedRule) {
    throw new Error(isSpecial ? `特殊格局缺少取用规则：${patternOverview.pattern}` : `旺衰状态缺少取用规则：${strength.status}`);
  }

  const bundles = buildWuxingBundles(dmWuxing);
  let baseFavorable = bundles[matchedRule.favorable];
  let baseUnfavorable = bundles[matchedRule.unfavorable];
  let initialPrimaryReason = matchedRule.primaryReason;
  const extraNeutralTrace: string[] = [];

  if (!isSpecial && strength.status === '中和') {
    const companion = dmWuxing;
    const resource = previous(GENERATES, dmWuxing);
    const output = GENERATES[dmWuxing];
    const wealth = CONTROLS[dmWuxing];
    const officer = previous(CONTROLS, dmWuxing);
    const isWinter = ['亥', '子', '丑'].includes(monthBranch);
    const isSummer = ['巳', '午', '未'].includes(monthBranch);
    const supportCount = strength.support.filter((s) => s.actionable).length + strength.roots.filter((r) => r.actionable).length;
    const constraintCount = strength.constraint.filter((c) => c.actionable).length;
    const microBias = supportCount > constraintCount ? '偏生扶' : constraintCount > supportCount ? '偏克泄' : '均衡';
    const climateRef = climateDecision.referenceOrder[0];

    if (climateRef) {
      const aux = microBias === '偏克泄' ? resource : output;
      baseFavorable = [...new Set([climateRef, aux])];
      const avoidCandidate = isWinter ? '水' : isSummer ? '火' : microBias === '偏克泄' ? officer : companion;
      baseUnfavorable = [avoidCandidate].filter((el) => !baseFavorable.includes(el));
      initialPrimaryReason = '中和调候';
      extraNeutralTrace.push(`中和命局微${microBias}，优先取调候${climateRef}并辅以${aux}流通`);
    } else if (isWinter) {
      const aux = microBias === '偏克泄' ? resource : output;
      baseFavorable = [...new Set(['火', aux])];
      baseUnfavorable = ['水', microBias === '偏克泄' ? officer : companion].filter((el) => !baseFavorable.includes(el));
      initialPrimaryReason = '中和调候';
      extraNeutralTrace.push(`中和生于冬月（微${microBias}），先取火调候暖局，辅以${aux}流通`);
    } else if (isSummer) {
      const aux = microBias === '偏克泄' ? resource : output;
      baseFavorable = [...new Set(['水', aux])];
      baseUnfavorable = ['火', microBias === '偏克泄' ? officer : companion].filter((el) => !baseFavorable.includes(el));
      initialPrimaryReason = '中和调候';
      extraNeutralTrace.push(`中和生于夏月（微${microBias}），先取水调候润局，辅以${aux}流通`);
    } else if (microBias === '偏生扶') {
      baseFavorable = [output, wealth];
      baseUnfavorable = [companion];
      initialPrimaryReason = '中和流通';
      extraNeutralTrace.push(`中和微偏生扶，主选${output}泄秀、${wealth}疏导，忌${companion}骤增破衡`);
    } else if (microBias === '偏克泄') {
      baseFavorable = [resource, companion];
      baseUnfavorable = [officer];
      initialPrimaryReason = '中和流通';
      extraNeutralTrace.push(`中和微偏克泄，主选${resource}护身、${companion}固本，忌${officer}重压破衡`);
    } else {
      baseFavorable = [output, resource];
      baseUnfavorable = [officer];
      initialPrimaryReason = '中和流通';
      extraNeutralTrace.push(`中和生扶克泄均衡，平运以${output}吐秀流通、${resource}护格为主，忌${officer}骤克破衡`);
    }
  }

  const ordinaryTrace = isSpecial
    ? []
    : [`普通格局:${patternOverview.pattern}，喜忌先按${strength.status}基线裁定，再综合调候、司权与格局救应`];

  let state: DecisionState = applySpecialStrongOutputConditions(
    {
      favorableWuxing: [...baseFavorable],
      unfavorableWuxing: [...baseUnfavorable],
      trace: [...ordinaryTrace, matchedRule.trace, ...extraNeutralTrace],
      primaryReason: initialPrimaryReason,
      matchedRuleIds: [matchedRule.id],
      decisionEvidence: {
        base: { favorable: [...baseFavorable], unfavorable: [...baseUnfavorable], ruleId: matchedRule.id },
        climateCandidates: [],
        appliedLayers: [initialPrimaryReason],
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
  state = applyHeavySealAndXiaoExclusion(state, pillars, strength.status, isSpecial, dmWuxing);
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

  const tradeoffAnalysis = buildUsefulGodTradeoffAnalysis(input, state, dmWuxing, isSpecial);

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
    tradeoffAnalysis,
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
  const tradeoffLines: string[] = [];
  if (result.tradeoffAnalysis) {
    const t = result.tradeoffAnalysis;
    tradeoffLines.push(`权衡要点：${t.synthesis}。`);
    if (t.neutralGuidance) {
      tradeoffLines.push(`中和动态取用：${t.neutralGuidance.dynamicTrigger}。`);
    }
    if (t.followEdgeAssessment && t.followEdgeAssessment.kind !== '真从纯格') {
      tradeoffLines.push(`从格边界提示：${t.followEdgeAssessment.fortuneSwitchRule}。`);
    }
    if (t.mediationPaths.length > 0) {
      const pathsText = t.mediationPaths
        .map((m) => `${m.conflictType}[${m.severity}：${m.involved.join('、')}]→首选${m.primaryRemedy}（备选：${m.alternativeRemedy}）`)
        .join('；');
      tradeoffLines.push(`病药通关路径：${pathsText}。`);
    }
  }
  return [
    `主裁定：${result.primaryReason}（${result.incrementStatus}）；主用神：${result.useful}；主忌神：${result.avoid}。`,
    `喜用五行：${result.favorableWuxing.join('、') || '随运平衡'}（十神：${result.favorable.join('、') || '随运平衡'}）；忌神五行：${result.unfavorableWuxing.join('、') || '随运避偏'}（十神：${result.unfavorable.join('、') || '随运避偏'}）。${conditionalText ? `${conditionalText}。` : ''}`,
    `用神落位（喜用${result.placement.favorableCount}处、忌神${result.placement.unfavorableCount}处）：${placementText}。`,
    `裁定层级：${result.decisionEvidence.appliedLayers.join(' → ')}。`,
    ...tradeoffLines,
  ].join('\n');
}
