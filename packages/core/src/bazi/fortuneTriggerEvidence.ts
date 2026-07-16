import { BASIC_MAPPINGS } from './baziMappingsData';
import type { BaziChartResult } from './baziTypes';
import { assertGanZhiPair } from './baziUtils';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { SANHE_GROUPS, SANHUI_GROUPS } from '../ganzhi/relations';

export type FortuneLayerType = 'natal' | 'dayun' | 'year' | 'month' | 'day' | 'hour';
export type FortuneTriggerRelationType =
  | 'stem-same'
  | 'stem-combine'
  | 'stem-clash'
  | 'branch-same'
  | 'branch-combine'
  | 'branch-clash'
  | 'branch-punishment'
  | 'branch-harm'
  | 'branch-break'
  | 'pillar-fuyin'
  | 'tianke-dichong'
  | 'suiyun-binglin';

export interface FortuneTriggerLayer {
  /** 兼容旧调用的层级标识；输出时同时提供稳定 key。 */
  id: string;
  key?: string;
  status?: '已计算';
  type: FortuneLayerType;
  label: string;
  ganZhi: string;
  pillar?: 'year' | 'month' | 'day' | 'hour';
  timeRange?: string;
}

export interface FortuneTriggerResolvedLayer extends FortuneTriggerLayer {
  key: string;
  status: '已计算';
}

export interface FortuneTriggerCalculationStep {
  key: string;
  stage: '层级干支校验' | '层级关系比对' | '三支成局核验' | '关系汇总';
  status: '已计算';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明所列干支经过固定关系表逐项比对并形成关系事实，不证明关系对应现实事件、吉凶方向、发生概率或固定应期';
}

export interface FortuneTriggerFormationFact {
  key: string;
  status: '已命中';
  type: 'branch-sanhe' | 'branch-sanhui';
  label: string;
  group: string;
  branches: string[];
  participantLayerKeys: string[];
  natalLayerKeys: string[];
  activeLayerKeys: string[];
  triggerLayerKeys: string[];
  calculationStepKey: string;
  sources: string[];
  interpretationLimit: string;
}

export interface FortuneTriggerRelation {
  key: string;
  status: '已命中';
  type: FortuneTriggerRelationType;
  label: string;
  source: FortuneTriggerResolvedLayer;
  target: FortuneTriggerResolvedLayer;
  sourceLayerKey: string;
  targetLayerKey: string;
  calculationStepKey: string;
  dependsOnStepKeys: string[];
  stemRelation?: 'same' | 'combine' | 'clash';
  branchRelation?: 'same' | 'combine' | 'clash' | 'punishment' | 'harm' | 'break';
  rule: string;
  sources: string[];
  interpretationLimit: string;
}

export interface FortuneTriggerCounterEvidenceFact {
  key: string;
  type: '主要关系覆盖';
  status: '已命中主要关系' | '未见主要关系';
  ownerFactKeys: string[];
  sourceLayerKey: string;
  targetLayerKey: string;
  sourceLabel: string;
  targetLabel: string;
  relationKeys: string[];
  majorRelationKeys: string[];
  supportingRelationKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只说明当前层级对是否命中岁运并临、天克地冲或同柱伏吟；未见主要关系不等于没有较弱关系、没有现实触发或必然平稳';
}

export interface FortuneTriggerRelationSummaryFact {
  key: 'bazi:fortune-trigger:relation-summary';
  status: '有关系事实' | '未见列入关系' | '无可比较层级';
  factKeys: string[];
  calculationStepKeys: string[];
  relationKeys: string[];
  formationKeys: string[];
  comparisonStepKeys: string[];
  relationCount: number;
  formationCount: number;
  majorRelationCount: number;
  supportingRelationCount: number;
  comparedPairCount: number;
  noMajorRelationPairCount: number;
  relationTypeCounts: Partial<Record<FortuneTriggerRelationType, number>>;
  promptText: string;
  sources: string[];
  limitation: '关系汇总只统计固定干支关系的命中与层级覆盖，不得按关系数量生成命运总分、吉凶概率、事件概率或唯一应期';
}

export interface FortuneTriggerLimitationFact {
  key: string;
  type: '关系解释边界' | '层级应期边界' | '反证边界' | '上下文边界' | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束岁运干支关系能够支持的解释范围，不得被反向当作现实事件、必然吉凶、发生概率或固定应期的证据';
}

export interface FortuneTriggerEvidenceResult {
  key: 'bazi:fortune-trigger:evidence';
  status: '已计算' | '无可比较层级';
  calculationSteps: FortuneTriggerCalculationStep[];
  calculationChain: string[];
  layers: FortuneTriggerResolvedLayer[];
  relations: FortuneTriggerRelation[];
  formations: FortuneTriggerFormationFact[];
  primaryRelations: FortuneTriggerRelation[];
  supportingRelations: FortuneTriggerRelation[];
  counterEvidence: string[];
  counterEvidenceFacts: FortuneTriggerCounterEvidenceFact[];
  relationSummaryFact: FortuneTriggerRelationSummaryFact;
  limitations: string[];
  limitationFacts: FortuneTriggerLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: { notes: string[] };
}

const PILLAR_LABELS = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' } as const;
const LAYER_TYPES = new Set<FortuneLayerType>(['natal', 'dayun', 'year', 'month', 'day', 'hour']);
const MAJOR_RELATION_TYPES = new Set<FortuneTriggerRelationType>([
  'suiyun-binglin',
  'tianke-dichong',
  'pillar-fuyin',
]);
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明所列干支经过固定关系表逐项比对并形成关系事实，不证明关系对应现实事件、吉凶方向、发生概率或固定应期' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只说明当前层级对是否命中岁运并临、天克地冲或同柱伏吟；未见主要关系不等于没有较弱关系、没有现实触发或必然平稳' as const;
const RELATION_SUMMARY_LIMITATION =
  '关系汇总只统计固定干支关系的命中与层级覆盖，不得按关系数量生成命运总分、吉凶概率、事件概率或唯一应期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束岁运干支关系能够支持的解释范围，不得被反向当作现实事件、必然吉凶、发生概率或固定应期的证据' as const;

function splitGanZhi(ganZhi: string) {
  if (ganZhi.length !== 2) throw new Error(`岁运干支必须是两个字符：${ganZhi}`);
  assertGanZhiPair(ganZhi[0], ganZhi[1], '岁运干支');
  return { gan: ganZhi[0], zhi: ganZhi[1] };
}

function getLayerKey(layer: FortuneTriggerLayer) {
  return layer.key?.trim() || `bazi:fortune-trigger:layer:${layer.type}:${layer.id}`;
}

function resolveLayer(layer: FortuneTriggerLayer): FortuneTriggerResolvedLayer {
  if (!layer.id.trim()) throw new Error('岁运层级 id 不能为空');
  if (!layer.label.trim()) throw new Error(`岁运层级 ${layer.id} 的 label 不能为空`);
  if (!LAYER_TYPES.has(layer.type)) throw new Error(`岁运层级类型无效：${layer.type}`);
  splitGanZhi(layer.ganZhi);
  return {
    ...layer,
    key: getLayerKey(layer),
    status: '已计算',
  };
}

function relation(
  type: FortuneTriggerRelationType,
  label: string,
  source: FortuneTriggerResolvedLayer,
  target: FortuneTriggerResolvedLayer,
  calculationStepKey: string,
  rule: string,
  extras: Pick<FortuneTriggerRelation, 'stemRelation' | 'branchRelation'> = {},
): FortuneTriggerRelation {
  return {
    key: `bazi:fortune-trigger:relation:${type}:${source.type}:${source.id}:${target.type}:${target.id}`,
    status: '已命中',
    type,
    label,
    source,
    target,
    sourceLayerKey: source.key,
    targetLayerKey: target.key,
    calculationStepKey,
    dependsOnStepKeys: [calculationStepKey],
    rule,
    sources: ['天干地支固定关系表', '原局与岁运层级干支逐项比对'],
    interpretationLimit: '只表示干支关系成立及其所在时间层级，不单独决定吉凶或具体事件。',
    ...extras,
  };
}

function compareLayers(
  source: FortuneTriggerResolvedLayer,
  target: FortuneTriggerResolvedLayer,
  calculationStepKey: string,
) {
  const sourceParts = splitGanZhi(source.ganZhi);
  const targetParts = splitGanZhi(target.ganZhi);
  const items: FortuneTriggerRelation[] = [];
  const prefix = `${source.label}${source.ganZhi}与${target.label}${target.ganZhi}`;
  const stemSame = sourceParts.gan === targetParts.gan;
  const stemClash = BASIC_MAPPINGS.TIAN_GAN_CHONG[sourceParts.gan] === targetParts.gan;
  const branchSame = sourceParts.zhi === targetParts.zhi;
  const branchClash = BASIC_MAPPINGS.DI_ZHI_CHONG[sourceParts.zhi] === targetParts.zhi;

  if (source.ganZhi === target.ganZhi) {
    items.push(
      relation(
        'pillar-fuyin',
        `${prefix}同柱伏吟`,
        source,
        target,
        calculationStepKey,
        '两层干支完全相同',
      ),
    );
    if (
      (source.type === 'dayun' && target.type === 'year') ||
      (source.type === 'year' && target.type === 'dayun')
    ) {
      items.push(
        relation(
          'suiyun-binglin',
          `${prefix}构成岁运并临`,
          source,
          target,
          calculationStepKey,
          '大运干支与流年干支完全相同',
        ),
      );
    }
  }
  if (stemClash && branchClash) {
    items.push(
      relation(
        'tianke-dichong',
        `${prefix}构成天克地冲`,
        source,
        target,
        calculationStepKey,
        '两层天干相冲且地支相冲',
        { stemRelation: 'clash', branchRelation: 'clash' },
      ),
    );
  }
  if (stemSame) {
    items.push(
      relation(
        'stem-same',
        `${prefix}天干同干`,
        source,
        target,
        calculationStepKey,
        '两层天干相同',
        { stemRelation: 'same' },
      ),
    );
  }
  if (BASIC_MAPPINGS.TIAN_GAN_WU_HE[sourceParts.gan] === targetParts.gan) {
    items.push(
      relation(
        'stem-combine',
        `${prefix}天干五合`,
        source,
        target,
        calculationStepKey,
        '天干五合配对成立',
        { stemRelation: 'combine' },
      ),
    );
  }
  if (stemClash) {
    items.push(
      relation(
        'stem-clash',
        `${prefix}天干相冲`,
        source,
        target,
        calculationStepKey,
        '天干相冲配对成立',
        { stemRelation: 'clash' },
      ),
    );
  }
  if (branchSame) {
    items.push(
      relation(
        'branch-same',
        `${prefix}地支伏吟`,
        source,
        target,
        calculationStepKey,
        '两层地支相同',
        { branchRelation: 'same' },
      ),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_LIU_HE[sourceParts.zhi] === targetParts.zhi) {
    items.push(
      relation(
        'branch-combine',
        `${prefix}地支六合`,
        source,
        target,
        calculationStepKey,
        '地支六合配对成立',
        { branchRelation: 'combine' },
      ),
    );
  }
  if (branchClash) {
    items.push(
      relation(
        'branch-clash',
        `${prefix}地支相冲`,
        source,
        target,
        calculationStepKey,
        '地支六冲配对成立',
        { branchRelation: 'clash' },
      ),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_XING[sourceParts.zhi]?.includes(targetParts.zhi)) {
    items.push(
      relation(
        'branch-punishment',
        `${prefix}地支相刑`,
        source,
        target,
        calculationStepKey,
        '地支刑关系成立',
        { branchRelation: 'punishment' },
      ),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_HAI[sourceParts.zhi] === targetParts.zhi) {
    items.push(
      relation(
        'branch-harm',
        `${prefix}地支相害`,
        source,
        target,
        calculationStepKey,
        '地支六害配对成立',
        { branchRelation: 'harm' },
      ),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_PO[sourceParts.zhi] === targetParts.zhi) {
    items.push(
      relation(
        'branch-break',
        `${prefix}地支相破`,
        source,
        target,
        calculationStepKey,
        '地支六破配对成立',
        { branchRelation: 'break' },
      ),
    );
  }
  return items;
}

function buildNatalLayers(result: BaziChartResult): FortuneTriggerResolvedLayer[] {
  if (!result.pillars) return [];
  return (Object.keys(PILLAR_LABELS) as Array<keyof typeof PILLAR_LABELS>).map((pillar) =>
    resolveLayer({
      id: `natal-${pillar}`,
      type: 'natal',
      pillar,
      label: `原局${PILLAR_LABELS[pillar]}`,
      ganZhi: result.pillars[pillar].ganZhi,
    }),
  );
}

function buildLayerCalculationStep(
  layer: FortuneTriggerResolvedLayer,
): FortuneTriggerCalculationStep {
  const { gan, zhi } = splitGanZhi(layer.ganZhi);
  return {
    key: `bazi:fortune-trigger:calculation:layer:${layer.type}:${layer.id}`,
    stage: '层级干支校验',
    status: '已计算',
    inputs: {
      layerKey: layer.key,
      layerType: layer.type,
      ganZhi: layer.ganZhi,
    },
    result: { gan, zhi, valid: true },
    dependsOnStepKeys: [],
    promptText: `${layer.label}${layer.ganZhi}已拆分为天干${gan}、地支${zhi}并通过合法性校验`,
    sources: ['六十甲子干支合法性规则', '原局与所选岁运层级资料'],
    limitation: CALCULATION_STEP_LIMITATION,
  };
}

function buildComparisonStep(params: {
  source: FortuneTriggerResolvedLayer;
  target: FortuneTriggerResolvedLayer;
  relations: FortuneTriggerRelation[];
}): FortuneTriggerCalculationStep {
  const { source, target, relations } = params;
  return {
    key: `bazi:fortune-trigger:calculation:compare:${source.type}:${source.id}:${target.type}:${target.id}`,
    stage: '层级关系比对',
    status: '已计算',
    inputs: {
      sourceLayerKey: source.key,
      sourceGanZhi: source.ganZhi,
      targetLayerKey: target.key,
      targetGanZhi: target.ganZhi,
    },
    result: {
      relationCount: relations.length,
      relationTypes: relations.map((item) => item.type),
      majorRelationCount: relations.filter((item) => MAJOR_RELATION_TYPES.has(item.type)).length,
    },
    dependsOnStepKeys: [
      `bazi:fortune-trigger:calculation:layer:${source.type}:${source.id}`,
      `bazi:fortune-trigger:calculation:layer:${target.type}:${target.id}`,
    ],
    promptText: `${source.label}${source.ganZhi}与${target.label}${target.ganZhi}已逐项核验同干、五合、天干冲、同支、六合、六冲、刑、害、破、同柱伏吟、天克地冲与岁运并临，命中${relations.length}项关系`,
    sources: ['天干同干、五合与相冲固定关系', '地支同支、六合、六冲、刑、害、破固定关系'],
    limitation: CALCULATION_STEP_LIMITATION,
  };
}

function buildCounterEvidenceFact(params: {
  source: FortuneTriggerResolvedLayer;
  target: FortuneTriggerResolvedLayer;
  relations: FortuneTriggerRelation[];
}): FortuneTriggerCounterEvidenceFact {
  const majorRelations = params.relations.filter((item) => MAJOR_RELATION_TYPES.has(item.type));
  const supportingRelations = params.relations.filter(
    (item) => !MAJOR_RELATION_TYPES.has(item.type),
  );
  return {
    key: `bazi:fortune-trigger:counter:major-coverage:${params.source.type}:${params.source.id}:${params.target.type}:${params.target.id}`,
    type: '主要关系覆盖',
    status: majorRelations.length ? '已命中主要关系' : '未见主要关系',
    ownerFactKeys: [
      `bazi:fortune-trigger:calculation:compare:${params.source.type}:${params.source.id}:${params.target.type}:${params.target.id}`,
      ...params.relations.map((item) => item.key),
    ],
    sourceLayerKey: params.source.key,
    targetLayerKey: params.target.key,
    sourceLabel: params.source.label,
    targetLabel: params.target.label,
    relationKeys: params.relations.map((item) => item.key),
    majorRelationKeys: majorRelations.map((item) => item.key),
    supportingRelationKeys: supportingRelations.map((item) => item.key),
    promptText: majorRelations.length
      ? `${params.source.label}与${params.target.label}命中${majorRelations.map((item) => item.label).join('、')}，仍须结合原局喜忌与现实问题解释`
      : `${params.source.label}与${params.target.label}未见岁运并临、天克地冲或同柱伏吟${supportingRelations.length ? `，但另有${supportingRelations.length}项同干、合冲刑害破等辅助关系` : '，也未命中当前规则列入的辅助关系'}；未见主要关系不等于没有较弱触发或必然平稳`,
    sources: ['岁运并临、天克地冲与同柱伏吟逐项覆盖核验'],
    limitation: COUNTER_FACT_LIMITATION,
  };
}

function buildFormationFacts(params: {
  natalLayers: FortuneTriggerResolvedLayer[];
  activeLayers: FortuneTriggerResolvedLayer[];
  calculationStepKey: string;
}): FortuneTriggerFormationFact[] {
  const natalBranches = new Set(params.natalLayers.map((layer) => splitGanZhi(layer.ganZhi).zhi));
  const allLayers = [...params.natalLayers, ...params.activeLayers];
  const allBranches = new Set(allLayers.map((layer) => splitGanZhi(layer.ganZhi).zhi));
  const definitions = [
    ...Object.entries(SANHE_GROUPS).map(([group, branches]) => ({
      type: 'branch-sanhe' as const,
      group,
      branches,
    })),
    ...Object.entries(SANHUI_GROUPS).map(([group, branches]) => ({
      type: 'branch-sanhui' as const,
      group,
      branches,
    })),
  ];

  return definitions.flatMap((definition) => {
    const natalComplete = definition.branches.every((branch) => natalBranches.has(branch));
    const complete = definition.branches.every((branch) => allBranches.has(branch));
    if (natalComplete || !complete) return [];

    const participants = definition.branches.map((branch) => {
      const natalLayer = params.natalLayers.find(
        (layer) => splitGanZhi(layer.ganZhi).zhi === branch,
      );
      return (
        natalLayer ?? params.activeLayers.find((layer) => splitGanZhi(layer.ganZhi).zhi === branch)
      );
    });
    if (participants.some((layer) => !layer)) return [];

    const resolvedParticipants = participants as FortuneTriggerResolvedLayer[];
    const natalParticipants = resolvedParticipants.filter((layer) => layer.type === 'natal');
    const activeParticipants = resolvedParticipants.filter((layer) => layer.type !== 'natal');
    if (!activeParticipants.length) return [];

    const triggerLabels = activeParticipants.map((layer) => layer.label);
    const formationLabel =
      definition.type === 'branch-sanhe'
        ? `${definition.branches.join('')}三合${definition.group}`
        : `${definition.branches.join('')}${definition.group}三会`;
    const triggerPrefix =
      triggerLabels.length > 1 ? `${triggerLabels.join('、')}共同补全` : `${triggerLabels[0]}补全`;

    return [
      {
        key: `bazi:fortune-trigger:formation:${definition.type}:${definition.group}`,
        status: '已命中' as const,
        type: definition.type,
        label: `${triggerPrefix}${formationLabel}`,
        group: definition.group,
        branches: [...definition.branches],
        participantLayerKeys: resolvedParticipants.map((layer) => layer.key),
        natalLayerKeys: natalParticipants.map((layer) => layer.key),
        activeLayerKeys: activeParticipants.map((layer) => layer.key),
        triggerLayerKeys: activeParticipants.map((layer) => layer.key),
        calculationStepKey: params.calculationStepKey,
        sources:
          definition.type === 'branch-sanhe'
            ? ['地支三合固定关系表', '原局与所选岁运层级地支汇总核验']
            : ['地支三会固定关系表', '原局与所选岁运层级地支汇总核验'],
        interpretationLimit:
          '只记录原局与所选岁运层级合计具备完整三支成局结构，不等于已经成化，也不单独决定吉凶、事件或应期。',
      },
    ];
  });
}

function buildFormationCalculationStep(params: {
  layers: FortuneTriggerResolvedLayer[];
  formations: FortuneTriggerFormationFact[];
}): FortuneTriggerCalculationStep {
  return {
    key: 'bazi:fortune-trigger:calculation:formation-scan',
    stage: '三支成局核验',
    status: '已计算',
    inputs: {
      layerKeys: params.layers.map((layer) => layer.key),
      branches: params.layers.map((layer) => splitGanZhi(layer.ganZhi).zhi),
      sanheGroups: Object.keys(SANHE_GROUPS),
      sanhuiGroups: Object.keys(SANHUI_GROUPS),
    },
    result: {
      formationCount: params.formations.length,
      formationKeys: params.formations.map((item) => item.key),
    },
    dependsOnStepKeys: params.layers.map(
      (layer) => `bazi:fortune-trigger:calculation:layer:${layer.type}:${layer.id}`,
    ),
    promptText: params.formations.length
      ? `已汇总原局与所选岁运地支，命中${params.formations.length}项由岁运补全的完整三合或三会结构`
      : '已汇总原局与所选岁运地支，未见由岁运补全的完整三合或三会结构',
    sources: ['地支三合、三会固定关系表', '原局与所选岁运层级地支汇总核验'],
    limitation: CALCULATION_STEP_LIMITATION,
  };
}

function buildRelationSummaryFact(params: {
  calculationSteps: FortuneTriggerCalculationStep[];
  relations: FortuneTriggerRelation[];
  formations: FortuneTriggerFormationFact[];
  comparisonSteps: FortuneTriggerCalculationStep[];
  counterEvidenceFacts: FortuneTriggerCounterEvidenceFact[];
}): FortuneTriggerRelationSummaryFact {
  const relationTypeCounts: Partial<Record<FortuneTriggerRelationType, number>> = {};
  params.relations.forEach((item) => {
    relationTypeCounts[item.type] = (relationTypeCounts[item.type] ?? 0) + 1;
  });
  const majorRelationCount = params.relations.filter((item) =>
    MAJOR_RELATION_TYPES.has(item.type),
  ).length;
  const noMajorRelationPairCount = params.counterEvidenceFacts.filter(
    (item) => item.status === '未见主要关系',
  ).length;
  const status = !params.comparisonSteps.length
    ? '无可比较层级'
    : params.relations.length || params.formations.length
      ? '有关系事实'
      : '未见列入关系';
  return {
    key: 'bazi:fortune-trigger:relation-summary',
    status,
    factKeys: [
      ...params.calculationSteps.map((item) => item.key),
      ...params.relations.map((item) => item.key),
      ...params.formations.map((item) => item.key),
      ...params.counterEvidenceFacts.map((item) => item.key),
    ],
    calculationStepKeys: params.calculationSteps.map((item) => item.key),
    relationKeys: params.relations.map((item) => item.key),
    formationKeys: params.formations.map((item) => item.key),
    comparisonStepKeys: params.comparisonSteps.map((item) => item.key),
    relationCount: params.relations.length,
    formationCount: params.formations.length,
    majorRelationCount,
    supportingRelationCount: params.relations.length - majorRelationCount,
    comparedPairCount: params.comparisonSteps.length,
    noMajorRelationPairCount,
    relationTypeCounts,
    promptText:
      status === '无可比较层级'
        ? '当前没有可供逐层比对的原局与岁运层级，不生成关系结论'
        : `共比对${params.comparisonSteps.length}组层级，记录${params.relations.length}项两层关系，其中主要关系${majorRelationCount}项、辅助关系${params.relations.length - majorRelationCount}项；另记录${params.formations.length}项岁运补全三合三会结构；${noMajorRelationPairCount}组层级未见主要关系`,
    sources: ['全部层级关系比对步骤与关系事实逐项汇总'],
    limitation: RELATION_SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(params: {
  relations: FortuneTriggerRelation[];
  formations: FortuneTriggerFormationFact[];
  counterEvidenceFacts: FortuneTriggerCounterEvidenceFact[];
  relationSummaryFact: FortuneTriggerRelationSummaryFact;
}): FortuneTriggerLimitationFact[] {
  const relationKeys = params.relations.map((item) => item.key);
  const formationKeys = params.formations.map((item) => item.key);
  const counterKeys = params.counterEvidenceFacts.map((item) => item.key);
  const definitions: Array<
    Pick<FortuneTriggerLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'bazi:fortune-trigger:limitation:relation-meaning',
      type: '关系解释边界',
      ownerFactKeys: [params.relationSummaryFact.key, ...relationKeys, ...formationKeys],
      promptText:
        '合、冲、刑、害、破、伏吟、岁运并临、天克地冲与三合三会补全只记录结构关系，不单独决定吉凶、事件类型或结果；三支齐备也不等于已经成化',
      sources: ['干支关系事实与命理解释分离原则'],
    },
    {
      key: 'bazi:fortune-trigger:limitation:timing-level',
      type: '层级应期边界',
      ownerFactKeys: [params.relationSummaryFact.key, ...relationKeys, ...formationKeys],
      promptText:
        '大运、流年、流月、流日和流时只表示触发所在时间层级；未选择更细层级时，不得补造月份、日期、时辰或唯一应期',
      sources: ['岁运层级范围与所选分析对象'],
    },
    {
      key: 'bazi:fortune-trigger:limitation:counter-evidence',
      type: '反证边界',
      ownerFactKeys: [params.relationSummaryFact.key, ...counterKeys],
      promptText:
        '未见岁运并临、天克地冲或同柱伏吟，不等于没有同干、合冲刑害破等较弱关系，也不证明现实必然平稳',
      sources: ['主要关系覆盖与辅助关系事实对照'],
    },
    {
      key: 'bazi:fortune-trigger:limitation:context',
      type: '上下文边界',
      ownerFactKeys: [params.relationSummaryFact.key, ...relationKeys, ...formationKeys],
      promptText:
        '关系解释必须结合原局喜忌、十神、旺衰、宫位及现实问题；当前关系核验不独立提供完整断事结论',
      sources: ['八字原局、岁运层级与现实问题联合解释要求'],
    },
    {
      key: 'bazi:fortune-trigger:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [params.relationSummaryFact.key, ...params.relationSummaryFact.factKeys],
      promptText:
        '不得按关系数量生成命运总分、吉凶概率、灾祸概率、事件发生率、必然结论或保证有效的趋避方案',
      sources: ['传统关系事实与现实结果分离原则'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function buildEvidence(params: {
  calculationSteps: FortuneTriggerCalculationStep[];
  relations: FortuneTriggerRelation[];
  formations: FortuneTriggerFormationFact[];
  counterEvidenceFacts: FortuneTriggerCounterEvidenceFact[];
  relationSummaryFact: FortuneTriggerRelationSummaryFact;
  limitationFacts: FortuneTriggerLimitationFact[];
}): PromptEvidenceBundle {
  const layerSteps = params.calculationSteps.filter((item) => item.stage === '层级干支校验');
  const comparisonSteps = params.calculationSteps.filter((item) => item.stage === '层级关系比对');
  const noMajorFacts = params.counterEvidenceFacts.filter((item) => item.status === '未见主要关系');
  const noMajorWithSupporting = noMajorFacts.filter((item) => item.supportingRelationKeys.length);
  const noMajorPairLabels = noMajorFacts
    .map((item) => `${item.sourceLabel}与${item.targetLabel}`)
    .join('、');
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '岁运触发计算链',
      detail: `已校验${layerSteps.length}个原局与岁运层级的干支合法性，完成${comparisonSteps.length}组层级逐项比对；${params.relationSummaryFact.promptText}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(params.calculationSteps.flatMap((item) => item.sources))).join(
        '、',
      ),
      tags: ['八字岁运', '计算链'],
    },
    ...params.relations.map((item): PromptEvidenceItem => ({
      level: MAJOR_RELATION_TYPES.has(item.type) ? '主证' : '辅证',
      title: item.label,
      detail: `规则：${item.rule}。${item.interpretationLimit}`,
      source: `${item.sources.join('、')}；层级：${item.source.label}与${item.target.label}；计算：${item.source.ganZhi}与${item.target.ganZhi}逐项比对`,
      tags: ['八字岁运', item.source.type, item.target.type, item.type],
    })),
    ...params.formations.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: item.label,
      detail: `${item.branches.join('、')}三支已由原局与所选岁运层级共同备齐。${item.interpretationLimit}`,
      source: item.sources.join('、'),
      tags: ['八字岁运', '三支成局', item.type, item.group],
    })),
    ...(noMajorFacts.length
      ? [
          {
            level: '反证',
            title: '未见主要岁运关系',
            detail: `共${noMajorFacts.length}组层级未见岁运并临、天克地冲或同柱伏吟，其中${noMajorWithSupporting.length}组仍有同干、合冲刑害破等辅助关系；层级对：${noMajorPairLabels}。未见主要关系不等于没有较弱触发、没有现实触发或必然平稳；边界：${COUNTER_FACT_LIMITATION}`,
            source: '岁运并临、天克地冲与同柱伏吟逐项覆盖核验',
            tags: ['反证', '未见主要关系'],
          } satisfies PromptEvidenceItem,
        ]
      : []),
    {
      level: '辅证',
      title: `岁运关系汇总：${params.relationSummaryFact.status}`,
      detail: `${params.relationSummaryFact.promptText}；边界：${params.relationSummaryFact.limitation}`,
      source: params.relationSummaryFact.sources.join('、'),
      tags: ['关系汇总', params.relationSummaryFact.status],
    },
    {
      level: '应期',
      title: '岁运层级与应期边界',
      detail: `${params.limitationFacts.find((item) => item.type === '层级应期边界')?.promptText ?? ''}；关系成立只证明当前时间层级存在结构触发，不证明该层级内的固定日期或事件必然发生。`,
      source: '岁运层级范围与所选分析对象',
      tags: ['应期边界', '时间层级'],
    },
    {
      level: '限制',
      title: '岁运触发解释边界',
      detail: `${params.limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(params.limitationFacts.flatMap((item) => item.sources))).join(
        '、',
      ),
      tags: ['解释边界', '现实复核'],
    },
  ];
  return { title: '八字岁运触发结构化证据', items };
}

export function analyzeFortuneTriggers(
  result: BaziChartResult,
  activeLayers: FortuneTriggerLayer[],
): FortuneTriggerEvidenceResult {
  const natalLayers = buildNatalLayers(result);
  const resolvedActiveLayers = activeLayers.map(resolveLayer);
  const layers = [...natalLayers, ...resolvedActiveLayers];
  const layerKeys = new Set<string>();
  layers.forEach((layer) => {
    if (layerKeys.has(layer.key)) throw new Error(`岁运层级稳定 key 重复：${layer.key}`);
    layerKeys.add(layer.key);
  });

  const calculationSteps: FortuneTriggerCalculationStep[] = layers.map(buildLayerCalculationStep);
  const relations: FortuneTriggerRelation[] = [];
  const comparisonFacts: Array<{
    source: FortuneTriggerResolvedLayer;
    target: FortuneTriggerResolvedLayer;
    relations: FortuneTriggerRelation[];
  }> = [];

  resolvedActiveLayers.forEach((source, sourceIndex) => {
    const targets = [...natalLayers, ...resolvedActiveLayers.slice(0, sourceIndex)];
    targets.forEach((target) => {
      const stepKey = `bazi:fortune-trigger:calculation:compare:${source.type}:${source.id}:${target.type}:${target.id}`;
      const pairRelations = compareLayers(source, target, stepKey);
      relations.push(...pairRelations);
      comparisonFacts.push({ source, target, relations: pairRelations });
      calculationSteps.push(buildComparisonStep({ source, target, relations: pairRelations }));
    });
  });

  const relationKeys = new Set<string>();
  relations.forEach((item) => {
    if (relationKeys.has(item.key)) throw new Error(`岁运关系稳定 key 重复：${item.key}`);
    relationKeys.add(item.key);
  });

  const counterEvidenceFacts = comparisonFacts.map(buildCounterEvidenceFact);
  const comparisonSteps = calculationSteps.filter((item) => item.stage === '层级关系比对');
  const formationCalculationStepKey = 'bazi:fortune-trigger:calculation:formation-scan';
  const formations = buildFormationFacts({
    natalLayers,
    activeLayers: resolvedActiveLayers,
    calculationStepKey: formationCalculationStepKey,
  });
  calculationSteps.push(buildFormationCalculationStep({ layers, formations }));
  const relationSummaryFact = buildRelationSummaryFact({
    calculationSteps,
    relations,
    formations,
    comparisonSteps,
    counterEvidenceFacts,
  });
  calculationSteps.push({
    key: 'bazi:fortune-trigger:calculation:summary',
    stage: '关系汇总',
    status: '已计算',
    inputs: {
      comparedPairCount: relationSummaryFact.comparedPairCount,
      relationKeys: relationSummaryFact.relationKeys,
      formationKeys: relationSummaryFact.formationKeys,
    },
    result: {
      status: relationSummaryFact.status,
      relationCount: relationSummaryFact.relationCount,
      formationCount: relationSummaryFact.formationCount,
      majorRelationCount: relationSummaryFact.majorRelationCount,
      supportingRelationCount: relationSummaryFact.supportingRelationCount,
      noMajorRelationPairCount: relationSummaryFact.noMajorRelationPairCount,
    },
    dependsOnStepKeys: [...relationSummaryFact.comparisonStepKeys, formationCalculationStepKey],
    promptText: relationSummaryFact.promptText,
    sources: relationSummaryFact.sources,
    limitation: CALCULATION_STEP_LIMITATION,
  });

  const limitationFacts = buildLimitationFacts({
    relations,
    formations,
    counterEvidenceFacts,
    relationSummaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status === '未见主要关系')
    .map((item) => item.promptText);
  const evidence = buildEvidence({
    calculationSteps,
    relations,
    formations,
    counterEvidenceFacts,
    relationSummaryFact,
    limitationFacts,
  });
  const primaryRelations = relations.filter((item) => MAJOR_RELATION_TYPES.has(item.type));
  const supportingRelations = relations.filter((item) => !MAJOR_RELATION_TYPES.has(item.type));
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const noMajorFacts = counterEvidenceFacts.filter((item) => item.status === '未见主要关系');
  const noMajorWithSupporting = noMajorFacts.filter((item) => item.supportingRelationKeys.length);
  const calculationOverview = `已校验${layers.length}个原局与岁运层级，完成${comparisonSteps.length}组逐项比对和三合三会汇总核验；${relationSummaryFact.promptText}`;
  const counterOverview = noMajorFacts.length
    ? `共${noMajorFacts.length}组层级未见岁运并临、天克地冲或同柱伏吟，其中${noMajorWithSupporting.length}组仍有辅助关系；未见主要关系不等于没有较弱关系、没有现实触发或必然平稳`
    : '所有已比较层级均已记录主要关系；仍不得据命中数量生成吉凶或概率结论';
  return {
    key: 'bazi:fortune-trigger:evidence',
    status: comparisonSteps.length ? '已计算' : '无可比较层级',
    calculationSteps,
    calculationChain,
    layers,
    relations,
    formations,
    primaryRelations,
    supportingRelations,
    counterEvidence,
    counterEvidenceFacts,
    relationSummaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText: [
      '【八字岁运触发结构化证据】',
      ...formatPromptEvidenceBundle(evidence),
      `计算链概览：${calculationOverview}。`,
      `关系汇总：${relationSummaryFact.promptText}。`,
      `反证核验：${counterOverview}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: {
      notes: [
        '原局四柱与所选大运、流年、流月、流日逐层比对天干同干、五合、相冲及地支同支、六合、六冲、刑、害、破。',
        '大运与流年干支完全相同时单列岁运并临；两层天干相冲且地支相冲时单列天克地冲。',
        '汇总原局与所选岁运层级的地支；仅在原局尚未完整、岁运补齐第三支时记录完整三合或三会结构，不据此断定成化。',
        '每个层级和关系均保留稳定键、计算步骤依赖及来源层级，未见主要关系时保留反证，不补造候选应期。',
        '关系成立与吉凶解释分离，不对不同关系设置命运总分，也不从单条关系直接推断事件。',
      ],
    },
  };
}
