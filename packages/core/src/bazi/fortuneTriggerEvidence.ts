import { BASIC_MAPPINGS, HIDDEN_STEMS } from './baziMappingsData';
import { analyzeOfficerPatternStructure } from './baziOfficerPattern';
import { analyzeWealthPatternStructure } from './baziWealthPattern';
import type { BaziChartResult } from './baziTypes';
import { assertGanZhiPair, getTenGod } from './baziUtils';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { STEM_WUXING } from '../ganzhi/data';
import {
  BRANCH_WUXING,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  isLiuchong,
  isSanxing,
  isTianGanHe,
} from '../ganzhi/relations';

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
  stage:
    | '层级干支校验'
    | '干支分层核验'
    | '层级关系比对'
    | '三支成局核验'
    | '藏干透出对应核验'
    | '正官取运核验'
    | '财格取运核验'
    | '关系汇总';
  status: '已计算';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明所列干支经过固定关系表逐项比对并形成关系事实，不证明关系对应现实事件、吉凶方向、发生概率或固定应期';
}

export type FortuneDirectPreference =
  | '喜用五行直接对应候选'
  | '忌神五行直接对应候选'
  | '喜忌五行同时列入待复核'
  | '未列入原局直接喜忌候选'
  | '原局喜忌资料不足';

export interface FortuneLayerComponentFact {
  symbol: string;
  wuxing: string;
  tenGod: string;
  directPreference: FortuneDirectPreference;
}

export interface FortuneLayerHiddenStemFact extends FortuneLayerComponentFact {
  rank: '本气' | '中气' | '余气';
}

export interface FortuneLayerStructureFact {
  key: string;
  status: '已计算';
  type: '岁运干支分层';
  layerKey: string;
  layerId: string;
  layerType: Exclude<FortuneLayerType, 'natal'>;
  layerLabel: string;
  ganZhi: string;
  stem: FortuneLayerComponentFact;
  branch: {
    symbol: string;
    wuxing: string;
    directPreference: FortuneDirectPreference;
    mainHiddenStem: FortuneLayerHiddenStemFact;
    hiddenStems: FortuneLayerHiddenStemFact[];
  };
  calculationStepKey: string;
  promptText: string;
  sources: string[];
  limitation: '分层事实只记录岁运天干、地支主五行与全部藏干的固定映射及原局喜忌五行直接对应候选；不得把运干、运支或同类五行机械等价，也不得据单项候选判定最终喜忌、成格变格、现实事件或吉凶';
}

export interface FortuneHiddenStemRevealFact {
  key: string;
  status: '已命中';
  type: '藏干透出对应候选';
  branchLayerKey: string;
  branchLayerLabel: string;
  branch: string;
  hiddenStem: string;
  hiddenStemRank: '本气' | '中气' | '余气';
  visibleLayerKeys: string[];
  visibleLayerLabels: string[];
  activeLayerKeys: string[];
  calculationStepKey: string;
  promptText: string;
  sources: string[];
  limitation: '透出对应候选只证明某支藏干与原局或所选岁运明透天干同字；是否透清、能否发用及其喜忌仍须结合月令格局、合冲会局与全局复核，不得直接认定成格、变格或吉凶';
}

export type FortuneOfficerPatternRuleType =
  | '官星逢合候选'
  | '七杀复露候选'
  | '正官重露候选'
  | '正官月令刑冲候选'
  | '正官用财印取运候选'
  | '正官用财取运候选'
  | '正官佩印取运候选'
  | '带伤食用印取运候选'
  | '正官带杀取运候选'
  | '劫财合杀取运候选'
  | '伤官合杀取运候选';

export interface FortuneOfficerPatternRuleFact {
  key: string;
  status: '支持候选' | '带忌候选' | '条件待复核';
  type: FortuneOfficerPatternRuleType;
  layerKey: string;
  layerLabel: string;
  ganZhi: string;
  natalStructure: string;
  trigger: string;
  calculationStepKey: string;
  dependsOnFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '正官取运事实只把原局已闭合的子结构与当前运字逐项对应；身轻、官轻、财轻、官重、身旺及合化成败仍须按全局另审，不得把单项候选定为最终喜运、忌运、吉凶或现实事件';
}

export type FortuneWealthPatternRuleType =
  | '财旺生官取运候选'
  | '财官后透印取运候选'
  | '财生官带食取运候选'
  | '财用食生取运候选'
  | '财格佩印取运候选'
  | '财用食印取运候选'
  | '财带伤官取运候选'
  | '财带七杀取运候选'
  | '财用杀印取运候选';

export interface FortuneWealthPatternRuleFact {
  key: string;
  status: '支持候选' | '带忌候选' | '条件待复核';
  type: FortuneWealthPatternRuleType;
  layerKey: string;
  layerLabel: string;
  ganZhi: string;
  natalStructure: string;
  trigger: string;
  calculationStepKey: string;
  dependsOnFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '财格取运事实只把原局已闭合的子结构与当前运字逐项对应；财旺、身旺、身轻、财食轻重与印旺仍须按全局另审，不得把单项候选定为最终喜运、忌运、吉凶或现实事件';
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
  type:
    | '关系解释边界'
    | '层级应期边界'
    | '反证边界'
    | '上下文边界'
    | '喜忌候选边界'
    | '干支分看边界'
    | '成格变格边界'
    | '正官取运边界'
    | '财格取运边界'
    | '高风险输出边界';
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
  layerStructureFacts: FortuneLayerStructureFact[];
  hiddenStemRevealFacts: FortuneHiddenStemRevealFact[];
  officerPatternRuleFacts: FortuneOfficerPatternRuleFact[];
  wealthPatternRuleFacts: FortuneWealthPatternRuleFact[];
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
const LAYER_STRUCTURE_LIMITATION =
  '分层事实只记录岁运天干、地支主五行与全部藏干的固定映射及原局喜忌五行直接对应候选；不得把运干、运支或同类五行机械等价，也不得据单项候选判定最终喜忌、成格变格、现实事件或吉凶' as const;
const HIDDEN_STEM_REVEAL_LIMITATION =
  '透出对应候选只证明某支藏干与原局或所选岁运明透天干同字；是否透清、能否发用及其喜忌仍须结合月令格局、合冲会局与全局复核，不得直接认定成格、变格或吉凶' as const;
const OFFICER_PATTERN_RULE_LIMITATION =
  '正官取运事实只把原局已闭合的子结构与当前运字逐项对应；身轻、官轻、财轻、官重、身旺及合化成败仍须按全局另审，不得把单项候选定为最终喜运、忌运、吉凶或现实事件' as const;
const WEALTH_PATTERN_RULE_LIMITATION =
  '财格取运事实只把原局已闭合的子结构与当前运字逐项对应；财旺、身旺、身轻、财食轻重与印旺仍须按全局另审，不得把单项候选定为最终喜运、忌运、吉凶或现实事件' as const;
const HIDDEN_STEM_RANKS = ['本气', '中气', '余气'] as const;
const WUXING_VALUES = new Set(['木', '火', '土', '金', '水']);

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

function resolveUsefulWuxing(result: BaziChartResult) {
  const usefulGod = result.analysis?.usefulGod;
  const favorableAvailable = Array.isArray(usefulGod?.favorableWuxing);
  const unfavorableAvailable = Array.isArray(usefulGod?.unfavorableWuxing);
  return {
    available: favorableAvailable && unfavorableAvailable,
    favorable: new Set(
      favorableAvailable
        ? usefulGod.favorableWuxing?.filter((item) => WUXING_VALUES.has(item))
        : [],
    ),
    unfavorable: new Set(
      unfavorableAvailable
        ? usefulGod.unfavorableWuxing?.filter((item) => WUXING_VALUES.has(item))
        : [],
    ),
  };
}

function resolveDirectPreference(
  wuxing: string,
  usefulWuxing: ReturnType<typeof resolveUsefulWuxing>,
): FortuneDirectPreference {
  if (!usefulWuxing.available) return '原局喜忌资料不足';
  const favorable = usefulWuxing.favorable.has(wuxing);
  const unfavorable = usefulWuxing.unfavorable.has(wuxing);
  if (favorable && unfavorable) return '喜忌五行同时列入待复核';
  if (favorable) return '喜用五行直接对应候选';
  if (unfavorable) return '忌神五行直接对应候选';
  return '未列入原局直接喜忌候选';
}

function resolveTenGod(symbol: string, result: BaziChartResult) {
  const dayMaster = result.dayMaster?.gan;
  return dayMaster && BASIC_MAPPINGS.HEAVENLY_STEMS.some((stem) => stem === dayMaster)
    ? getTenGod(symbol, dayMaster)
    : '日主资料不足';
}

function buildLayerStructureFact(
  result: BaziChartResult,
  layer: FortuneTriggerResolvedLayer,
  usefulWuxing: ReturnType<typeof resolveUsefulWuxing>,
): FortuneLayerStructureFact {
  if (layer.type === 'natal') throw new Error('原局层级不得生成岁运干支分层事实');
  const { gan, zhi } = splitGanZhi(layer.ganZhi);
  const hiddenStems = HIDDEN_STEMS[zhi];
  if (!hiddenStems?.length) throw new Error(`岁运地支藏干数据缺失：${zhi}`);
  const hiddenStemFacts = hiddenStems.map((symbol, index): FortuneLayerHiddenStemFact => {
    const wuxing = STEM_WUXING[symbol];
    if (!wuxing) throw new Error(`岁运藏干五行数据缺失：${symbol}`);
    return {
      rank: HIDDEN_STEM_RANKS[index] ?? '余气',
      symbol,
      wuxing,
      tenGod: resolveTenGod(symbol, result),
      directPreference: resolveDirectPreference(wuxing, usefulWuxing),
    };
  });
  const stemWuxing = STEM_WUXING[gan];
  const branchWuxing = BRANCH_WUXING[zhi];
  if (!stemWuxing) throw new Error(`岁运天干五行数据缺失：${gan}`);
  if (!branchWuxing) throw new Error(`岁运地支五行数据缺失：${zhi}`);
  const stem: FortuneLayerComponentFact = {
    symbol: gan,
    wuxing: stemWuxing,
    tenGod: resolveTenGod(gan, result),
    directPreference: resolveDirectPreference(stemWuxing, usefulWuxing),
  };
  const calculationStepKey = `bazi:fortune-trigger:calculation:structure:${layer.type}:${layer.id}`;
  const hiddenText = hiddenStemFacts
    .map(
      (item) =>
        `${item.rank}${item.symbol}${item.wuxing}（${item.tenGod}，${item.directPreference}）`,
    )
    .join('、');
  return {
    key: `bazi:fortune-trigger:structure:${layer.type}:${layer.id}`,
    status: '已计算',
    type: '岁运干支分层',
    layerKey: layer.key,
    layerId: layer.id,
    layerType: layer.type,
    layerLabel: layer.label,
    ganZhi: layer.ganZhi,
    stem,
    branch: {
      symbol: zhi,
      wuxing: branchWuxing,
      directPreference: resolveDirectPreference(branchWuxing, usefulWuxing),
      mainHiddenStem: hiddenStemFacts[0],
      hiddenStems: hiddenStemFacts,
    },
    calculationStepKey,
    promptText: `${layer.label}${layer.ganZhi}分层：天干${gan}${stemWuxing}为${stem.tenGod}（${stem.directPreference}）；地支${zhi}主五行${branchWuxing}（${resolveDirectPreference(branchWuxing, usefulWuxing)}），藏干${hiddenText}`,
    sources: ['天干地支五行与地支藏干固定表', '十神固定映射', '原局结构化喜忌五行'],
    limitation: LAYER_STRUCTURE_LIMITATION,
  };
}

function buildLayerStructureCalculationStep(
  fact: FortuneLayerStructureFact,
): FortuneTriggerCalculationStep {
  return {
    key: fact.calculationStepKey,
    stage: '干支分层核验',
    status: '已计算',
    inputs: {
      layerKey: fact.layerKey,
      ganZhi: fact.ganZhi,
    },
    result: {
      stem: fact.stem.symbol,
      stemWuxing: fact.stem.wuxing,
      stemTenGod: fact.stem.tenGod,
      branch: fact.branch.symbol,
      branchWuxing: fact.branch.wuxing,
      hiddenStems: fact.branch.hiddenStems.map((item) => item.symbol),
      hiddenTenGods: fact.branch.hiddenStems.map((item) => item.tenGod),
    },
    dependsOnStepKeys: [`bazi:fortune-trigger:calculation:layer:${fact.layerType}:${fact.layerId}`],
    promptText: `${fact.promptText}；天干、地支与藏干已分开保留，不作机械等价`,
    sources: fact.sources,
    limitation: CALCULATION_STEP_LIMITATION,
  };
}

function buildHiddenStemRevealFacts(params: {
  layers: FortuneTriggerResolvedLayer[];
  activeLayers: FortuneTriggerResolvedLayer[];
  calculationStepKey: string;
}): FortuneHiddenStemRevealFact[] {
  const activeLayerKeys = new Set(params.activeLayers.map((layer) => layer.key));
  return params.layers.flatMap((branchLayer) => {
    const { zhi } = splitGanZhi(branchLayer.ganZhi);
    return (HIDDEN_STEMS[zhi] ?? []).flatMap((hiddenStem, index) => {
      const visibleLayers = params.layers.filter(
        (candidate) => splitGanZhi(candidate.ganZhi).gan === hiddenStem,
      );
      if (!visibleLayers.length) return [];
      const activeParticipants = new Set<string>();
      if (activeLayerKeys.has(branchLayer.key)) activeParticipants.add(branchLayer.key);
      visibleLayers.forEach((layer) => {
        if (activeLayerKeys.has(layer.key)) activeParticipants.add(layer.key);
      });
      if (!activeParticipants.size) return [];
      const hiddenStemRank = HIDDEN_STEM_RANKS[index] ?? '余气';
      const visibleLayerLabels = visibleLayers.map((layer) => `${layer.label}${layer.ganZhi[0]}`);
      return [
        {
          key: `bazi:fortune-trigger:hidden-reveal:${branchLayer.type}:${branchLayer.id}:${hiddenStem}`,
          status: '已命中' as const,
          type: '藏干透出对应候选' as const,
          branchLayerKey: branchLayer.key,
          branchLayerLabel: branchLayer.label,
          branch: zhi,
          hiddenStem,
          hiddenStemRank,
          visibleLayerKeys: visibleLayers.map((layer) => layer.key),
          visibleLayerLabels,
          activeLayerKeys: [...activeParticipants],
          calculationStepKey: params.calculationStepKey,
          promptText: `${branchLayer.label}${zhi}所藏${hiddenStemRank}${hiddenStem}，与${visibleLayerLabels.join('、')}同字，列为藏干透出对应候选`,
          sources: ['地支藏干固定表', '原局与所选岁运明透天干逐层核验'],
          limitation: HIDDEN_STEM_REVEAL_LIMITATION,
        },
      ];
    });
  });
}

function buildHiddenStemRevealCalculationStep(params: {
  layers: FortuneTriggerResolvedLayer[];
  facts: FortuneHiddenStemRevealFact[];
}): FortuneTriggerCalculationStep {
  return {
    key: 'bazi:fortune-trigger:calculation:hidden-reveal-scan',
    stage: '藏干透出对应核验',
    status: '已计算',
    inputs: {
      layerKeys: params.layers.map((layer) => layer.key),
      visibleStems: params.layers.map((layer) => splitGanZhi(layer.ganZhi).gan),
      branches: params.layers.map((layer) => splitGanZhi(layer.ganZhi).zhi),
    },
    result: {
      candidateCount: params.facts.length,
      candidateKeys: params.facts.map((item) => item.key),
    },
    dependsOnStepKeys: params.layers.map(
      (layer) => `bazi:fortune-trigger:calculation:layer:${layer.type}:${layer.id}`,
    ),
    promptText: params.facts.length
      ? `已逐支展开藏干并与全部明透天干核验，记录${params.facts.length}项涉及所选岁运的透出对应候选`
      : '已逐支展开藏干并与全部明透天干核验，未见涉及所选岁运的透出对应候选',
    sources: ['地支藏干固定表', '原局与所选岁运明透天干逐层核验'],
    limitation: CALCULATION_STEP_LIMITATION,
  };
}

function describeLayerTenGods(fact: FortuneLayerStructureFact, tenGods: string[]): string[] {
  return [
    ...(tenGods.includes(fact.stem.tenGod) ? [`运干${fact.stem.symbol}${fact.stem.tenGod}`] : []),
    ...fact.branch.hiddenStems
      .filter((item) => tenGods.includes(item.tenGod))
      .map((item) => `运支${fact.branch.symbol}${item.rank}藏干${item.symbol}${item.tenGod}`),
  ];
}

function formatNatalStems(
  facts: ReturnType<typeof analyzeOfficerPatternStructure>['exposedStems'],
): string {
  return facts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、');
}

function buildOfficerPatternRuleAnalysis(params: {
  result: BaziChartResult;
  layerStructureFacts: FortuneLayerStructureFact[];
}): {
  facts: FortuneOfficerPatternRuleFact[];
  calculationStep?: FortuneTriggerCalculationStep;
  applicable: boolean;
} {
  const patternName = params.result.analysis?.mingGe?.pattern ?? '';
  const structure = analyzeOfficerPatternStructure(params.result.pillars, patternName);
  if (!structure.isOfficerPattern) return { facts: [], applicable: false };

  const facts: FortuneOfficerPatternRuleFact[] = [];
  const calculationStepKey = 'bazi:fortune-trigger:calculation:officer-pattern-rules';
  const addFact = (
    layer: FortuneLayerStructureFact,
    slug: string,
    type: FortuneOfficerPatternRuleType,
    status: FortuneOfficerPatternRuleFact['status'],
    natalStructure: string,
    trigger: string,
  ) => {
    facts.push({
      key: `bazi:fortune-trigger:officer-pattern:${layer.layerType}:${layer.layerId}:${slug}`,
      status,
      type,
      layerKey: layer.layerKey,
      layerLabel: layer.layerLabel,
      ganZhi: layer.ganZhi,
      natalStructure,
      trigger,
      calculationStepKey,
      dependsOnFactKeys: [layer.key],
      promptText: `${layer.layerLabel}${layer.ganZhi}：${natalStructure}；${trigger}，列为${status}`,
      sources: ['《子平真诠评注》“论正官取运”', '原局正官子结构与岁运干支分层事实逐项核验'],
      limitation: OFFICER_PATTERN_RULE_LIMITATION,
    });
  };

  params.layerStructureFacts.forEach((layer) => {
    const activeStem = layer.stem;
    const activeBranch = layer.branch.symbol;
    const monthBranch = params.result.pillars.month.zhi;
    const combinedOfficers = structure.officerStems.filter((officer) =>
      isTianGanHe(activeStem.symbol, officer.stem),
    );
    if (combinedOfficers.length > 0) {
      addFact(
        layer,
        'officer-combine',
        '官星逢合候选',
        '带忌候选',
        `原局${formatNatalStems(combinedOfficers)}明透`,
        `运干${activeStem.symbol}${activeStem.tenGod}与其五合；这里只闭合“官露逢合”事实，不认定合化`,
      );
    }
    if (activeStem.tenGod === '七杀') {
      addFact(
        layer,
        'killer-reveal',
        '七杀复露候选',
        '带忌候选',
        '原局为正官格',
        `运干${activeStem.symbol}七杀明透，构成官格岁运杂杀候选`,
      );
    }
    if (activeStem.tenGod === '正官') {
      addFact(
        layer,
        'officer-repeat',
        '正官重露候选',
        '带忌候选',
        '原局为正官格',
        `运干${activeStem.symbol}正官再次明透，构成重官候选`,
      );
    }
    const branchRelations = [
      ...(isSanxing(monthBranch, activeBranch) ? ['相刑'] : []),
      ...(isLiuchong(monthBranch, activeBranch) ? ['相冲'] : []),
    ];
    if (branchRelations.length > 0) {
      addFact(
        layer,
        'month-branch-punish-clash',
        '正官月令刑冲候选',
        '带忌候选',
        `原局月令${monthBranch}取正官格`,
        `运支${activeBranch}与月令${monthBranch}${branchRelations.join('、')}；不因另成合局而忽略此刑冲事实`,
      );
    }

    const resourceTriggers = describeLayerTenGods(layer, ['正印', '偏印']);
    const peerTriggers = describeLayerTenGods(layer, ['比肩', '劫财']);
    const outputTriggers = describeLayerTenGods(layer, ['食神', '伤官']);
    const wealthTriggers = describeLayerTenGods(layer, ['正财', '偏财']);
    const officerTriggers = describeLayerTenGods(layer, ['正官']);
    const natalWealth = formatNatalStems(structure.wealthStems);
    const natalResources = formatNatalStems(structure.resourceStems);
    const natalOutputs = [
      formatNatalStems(structure.outputStems),
      ...structure.outputFormations.map(
        (formation) => `${formation.branches.join('')}完整${formation.type}${formation.wuxing}局`,
      ),
    ]
      .filter(Boolean)
      .join('、');

    if (structure.wealthStems.length > 0 && structure.resourceStems.length > 0) {
      const natalStructure = `原局${natalWealth}与${natalResources}同见，具正官用财印局部结构`;
      const supportingBody = [...resourceTriggers, ...peerTriggers];
      if (supportingBody.length > 0) {
        addFact(
          layer,
          'wealth-resource-support-body',
          '正官用财印取运候选',
          '条件待复核',
          natalStructure,
          `${supportingBody.join('、')}只在“身稍轻”另经全局闭合时，对应助身方向候选`,
        );
      }
      const supportingOfficer = [...wealthTriggers, ...officerTriggers];
      if (supportingOfficer.length > 0) {
        addFact(
          layer,
          'wealth-resource-support-officer',
          '正官用财印取运候选',
          '条件待复核',
          natalStructure,
          `${supportingOfficer.join('、')}只在“官稍轻”另经全局闭合时，对应助官方向候选`,
        );
      }
    }

    if (structure.wealthStems.length > 0) {
      const natalStructure = `原局${natalWealth}明透，具正官用财局部结构`;
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'wealth-use-resource',
          '正官用财取运候选',
          '支持候选',
          natalStructure,
          `${resourceTriggers.join('、')}对应原典所喜印绶`,
        );
      }
      if (peerTriggers.length > 0) {
        addFact(
          layer,
          'wealth-use-peer',
          '正官用财取运候选',
          '条件待复核',
          natalStructure,
          `${peerTriggers.join('、')}可作助身组件，但单个运字不直接等于“身旺之地”`,
        );
      }
      if (outputTriggers.length > 0) {
        addFact(
          layer,
          'wealth-use-output',
          '正官用财取运候选',
          '带忌候选',
          natalStructure,
          `${outputTriggers.join('、')}对应原典所忌食伤`,
        );
      }
      const conditionalWealthOfficer = [...wealthTriggers, ...officerTriggers];
      if (conditionalWealthOfficer.length > 0) {
        addFact(
          layer,
          'wealth-use-wealth-officer',
          '正官用财取运候选',
          '条件待复核',
          natalStructure,
          `${conditionalWealthOfficer.join('、')}只有在“身旺而财轻官弱”另经全局闭合时，才对应财官运例外`,
        );
      }
    }

    if (structure.resourceStems.length > 0) {
      const natalStructure = `原局${natalResources}明透，具正官佩印局部结构`;
      if (wealthTriggers.length > 0) {
        addFact(
          layer,
          'resource-use-wealth',
          '正官佩印取运候选',
          '支持候选',
          natalStructure,
          `${wealthTriggers.join('、')}对应原典一般所喜财乡；若属官重身轻仍须改按助身复核`,
        );
      }
      if (outputTriggers.length > 0) {
        addFact(
          layer,
          'resource-use-output',
          '正官佩印取运候选',
          '支持候选',
          natalStructure,
          `${outputTriggers.join('、')}对应原典“伤食反吉”的局部候选`,
        );
      }
      if (peerTriggers.length > 0) {
        addFact(
          layer,
          'resource-use-peer',
          '正官佩印取运候选',
          '条件待复核',
          natalStructure,
          `${peerTriggers.join('、')}可作助身组件，但须先闭合“官重身轻”，不据此直接判身旺`,
        );
      }
    }

    const hasNatalOutput =
      structure.outputStems.length > 0 || structure.outputFormations.length > 0;
    if (structure.resourceStems.length > 0 && hasNatalOutput) {
      const natalStructure = `原局${natalOutputs}与${natalResources}同见，具带伤食用印局部结构`;
      if (officerTriggers.length > 0) {
        addFact(
          layer,
          'output-resource-officer',
          '带伤食用印取运候选',
          '支持候选',
          natalStructure,
          `${officerTriggers.join('、')}对应官旺方向候选；一项官星不直接证明官旺`,
        );
      }
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'output-resource-resource',
          '带伤食用印取运候选',
          '支持候选',
          natalStructure,
          `${resourceTriggers.join('、')}对应印旺方向候选；一项印星不直接证明印旺`,
        );
      }
      if (wealthTriggers.length > 0) {
        addFact(
          layer,
          'output-resource-wealth',
          '带伤食用印取运候选',
          structure.hasStackedResources ? '条件待复核' : '带忌候选',
          natalStructure,
          structure.hasStackedResources
            ? `${wealthTriggers.join('、')}虽属一般所忌财运，但原局印绶两处以上明透，另列“印绶叠出，财运无害”例外候选`
            : `${wealthTriggers.join('、')}对应原典一般所忌财运`,
        );
      }
    }

    if (structure.killerStems.length > 0 && outputTriggers.length > 0) {
      addFact(
        layer,
        'killer-output',
        '正官带杀取运候选',
        '支持候选',
        `原局${formatNatalStems(structure.killerStems)}明透，具正官带杀局部结构`,
        `${outputTriggers.join('、')}对应原典“伤食反为不碍”的候选`,
      );
    }

    const robberyCombinations = structure.killerCombinations.filter(
      (item) => item.method === '劫财合杀',
    );
    if (robberyCombinations.length > 0) {
      const natalStructure = `原局${robberyCombinations
        .map(
          ({ killer, partner }) =>
            `${killer.label}${killer.stem}七杀与${partner.label}${partner.stem}劫财相邻五合`,
        )
        .join('、')}，具劫财合杀局部结构`;
      if (wealthTriggers.length > 0) {
        addFact(
          layer,
          'robbery-combine-wealth',
          '劫财合杀取运候选',
          '支持候选',
          natalStructure,
          `${wealthTriggers.join('、')}对应原典可行财运`,
        );
      }
      if (outputTriggers.length > 0) {
        addFact(
          layer,
          'robbery-combine-output',
          '劫财合杀取运候选',
          '支持候选',
          natalStructure,
          `${outputTriggers.join('、')}对应原典可行伤食运`,
        );
      }
      if (peerTriggers.length > 0) {
        addFact(
          layer,
          'robbery-combine-peer',
          '劫财合杀取运候选',
          '条件待复核',
          natalStructure,
          `${peerTriggers.join('、')}可作助身组件，但不直接等于身旺`,
        );
      }
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'robbery-combine-resource',
          '劫财合杀取运候选',
          '支持候选',
          natalStructure,
          `${resourceTriggers.join('、')}对应原典可行印运，同时保留“复露七杀”的复核边界`,
        );
      }
    }

    const hurtCombinations = structure.killerCombinations.filter(
      (item) => item.method === '伤官合杀',
    );
    if (hurtCombinations.length > 0) {
      const natalStructure = `原局${hurtCombinations
        .map(
          ({ killer, partner }) =>
            `${killer.label}${killer.stem}七杀与${partner.label}${partner.stem}伤官相邻五合`,
        )
        .join('、')}，具伤官合杀局部结构`;
      if (outputTriggers.length > 0) {
        addFact(
          layer,
          'hurt-combine-output',
          '伤官合杀取运候选',
          '支持候选',
          natalStructure,
          `${outputTriggers.join('、')}对应原典可行伤食运`,
        );
      }
      if (wealthTriggers.length > 0) {
        addFact(
          layer,
          'hurt-combine-wealth',
          '伤官合杀取运候选',
          '支持候选',
          natalStructure,
          `${wealthTriggers.join('、')}对应原典可行财运`,
        );
      }
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'hurt-combine-resource',
          '伤官合杀取运候选',
          '带忌候选',
          natalStructure,
          `${resourceTriggers.join('、')}对应原典所忌印运`,
        );
      }
    }
  });

  const calculationStep: FortuneTriggerCalculationStep = {
    key: calculationStepKey,
    stage: '正官取运核验',
    status: '已计算',
    inputs: {
      patternName,
      activeLayerKeys: params.layerStructureFacts.map((item) => item.layerKey),
      natalExposedTenGods: structure.exposedStems.map((item) => item.tenGod),
      hasStackedResources: structure.hasStackedResources,
    },
    result: {
      candidateCount: facts.length,
      candidateKeys: facts.map((item) => item.key),
    },
    dependsOnStepKeys: params.layerStructureFacts.map((item) => item.calculationStepKey),
    promptText: facts.length
      ? `已按正官原局子结构逐字核验所选岁运，记录${facts.length}项支持、带忌或条件待复核候选`
      : '已按正官原局子结构逐字核验所选岁运，当前未命中可客观闭合的专属取运候选',
    sources: ['《子平真诠评注》“论正官取运”', '原局正官子结构与岁运干支分层事实'],
    limitation: CALCULATION_STEP_LIMITATION,
  };
  return { facts, calculationStep, applicable: true };
}

function buildWealthPatternRuleAnalysis(params: {
  result: BaziChartResult;
  layerStructureFacts: FortuneLayerStructureFact[];
}): {
  facts: FortuneWealthPatternRuleFact[];
  calculationStep?: FortuneTriggerCalculationStep;
  applicable: boolean;
} {
  const patternName = params.result.analysis?.mingGe?.pattern ?? '';
  const structure = analyzeWealthPatternStructure(params.result.pillars, patternName);
  if (!structure.isWealthPattern) return { facts: [], applicable: false };

  const facts: FortuneWealthPatternRuleFact[] = [];
  const calculationStepKey = 'bazi:fortune-trigger:calculation:wealth-pattern-rules';
  const addFact = (
    layer: FortuneLayerStructureFact,
    slug: string,
    type: FortuneWealthPatternRuleType,
    status: FortuneWealthPatternRuleFact['status'],
    natalStructure: string,
    trigger: string,
  ) => {
    facts.push({
      key: `bazi:fortune-trigger:wealth-pattern:${layer.layerType}:${layer.layerId}:${slug}`,
      status,
      type,
      layerKey: layer.layerKey,
      layerLabel: layer.layerLabel,
      ganZhi: layer.ganZhi,
      natalStructure,
      trigger,
      calculationStepKey,
      dependsOnFactKeys: [layer.key],
      promptText: `${layer.layerLabel}${layer.ganZhi}：${natalStructure}；${trigger}，列为${status}`,
      sources: ['《子平真诠评注》“论财取运”', '原局财格子结构与岁运干支分层事实逐项核验'],
      limitation: WEALTH_PATTERN_RULE_LIMITATION,
    });
  };

  const natalWealth = formatNatalStems(structure.wealthStems);
  const natalResources = formatNatalStems(structure.resourceStems);
  const natalFoods = [
    formatNatalStems(structure.foodStems),
    ...structure.foodFormations.map(
      (formation) => `${formation.branches.join('')}完整${formation.type}${formation.wuxing}局`,
    ),
  ]
    .filter(Boolean)
    .join('、');
  const natalHurts = [
    formatNatalStems(structure.hurtStems),
    ...structure.hurtFormations.map(
      (formation) => `${formation.branches.join('')}完整${formation.type}${formation.wuxing}局`,
    ),
  ]
    .filter(Boolean)
    .join('、');
  const natalOfficers = formatNatalStems(structure.officerStems);
  const natalKillers = formatNatalStems(structure.killerStems);
  const postposedResources = structure.resourceStems.filter((resource) =>
    structure.officerStems.some((officer) => officer.columnIndex < resource.columnIndex),
  );
  const hasFood = structure.foodStems.length > 0 || structure.foodFormations.length > 0;
  const hasHurt = structure.hurtStems.length > 0 || structure.hurtFormations.length > 0;
  const hasWealthGeneratingOfficer =
    structure.wealthStems.length > 0 && structure.officerStems.length > 0;
  const hasUnimpededResource =
    structure.resourceStems.length > 0 &&
    structure.wealthResourceCombinedPairs.length === 0 &&
    structure.wealthResourceControllingPairs.length === 0;
  const hasSeparatedFoodResource =
    structure.foodResourceTwoSeparatorPairs.length > 0 &&
    structure.foodResourceCloserPairs.length === 0;
  const hasKillerResourceWithoutExposedWealth =
    structure.killerStems.length > 0 &&
    structure.resourceStems.length > 0 &&
    structure.wealthStems.length === 0;

  params.layerStructureFacts.forEach((layer) => {
    const resourceTriggers = describeLayerTenGods(layer, ['正印', '偏印']);
    const peerTriggers = describeLayerTenGods(layer, ['比肩', '劫财']);
    const foodTriggers = describeLayerTenGods(layer, ['食神']);
    const hurtTriggers = describeLayerTenGods(layer, ['伤官']);
    const outputTriggers = [...foodTriggers, ...hurtTriggers];
    const wealthTriggers = describeLayerTenGods(layer, ['正财', '偏财']);
    const officerTriggers = describeLayerTenGods(layer, ['正官']);
    const killerTriggers = describeLayerTenGods(layer, ['七杀']);

    if (hasWealthGeneratingOfficer) {
      const natalStructure = `原局${natalWealth}与${natalOfficers}明透，具财生官局部结构`;
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'wealth-officer-resource',
          '财旺生官取运候选',
          '支持候选',
          natalStructure,
          `${resourceTriggers.join('、')}对应原典所喜印绶`,
        );
      }
      if (peerTriggers.length > 0) {
        addFact(
          layer,
          'wealth-officer-peer',
          '财旺生官取运候选',
          '条件待复核',
          natalStructure,
          `${peerTriggers.join('、')}只作身旺方向组件，单个比劫运字不直接证明身旺`,
        );
      }
      if (killerTriggers.length > 0) {
        addFact(
          layer,
          'wealth-officer-killer',
          '财旺生官取运候选',
          '带忌候选',
          natalStructure,
          `${killerTriggers.join('、')}对应原典一般所不利七杀`,
        );
      }
      if (hurtTriggers.length > 0) {
        addFact(
          layer,
          'wealth-officer-hurt',
          '财旺生官取运候选',
          '带忌候选',
          natalStructure,
          `${hurtTriggers.join('、')}对应原典一般所不利伤官`,
        );
      }
    }

    if (hasWealthGeneratingOfficer && postposedResources.length > 0 && hurtTriggers.length > 0) {
      addFact(
        layer,
        'wealth-officer-post-resource-hurt',
        '财官后透印取运候选',
        '条件待复核',
        `原局官星先见，${formatNatalStems(postposedResources)}后透，并有${natalWealth}明透`,
        `${hurtTriggers.join('、')}另列“后透印则伤官不甚有害”例外；仍与一般伤官带忌候选并存`,
      );
    }

    if (hasWealthGeneratingOfficer && hasFood) {
      const natalStructure = `原局${natalWealth}、${natalOfficers}与${natalFoods}同见，具财生官带食局部结构`;
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'wealth-officer-food-resource',
          '财生官带食取运候选',
          '支持候选',
          natalStructure,
          `${resourceTriggers.join('、')}对应原典带食破局时所喜印绶`,
        );
      }
      if (killerTriggers.length > 0) {
        addFact(
          layer,
          'wealth-officer-food-killer',
          '财生官带食取运候选',
          '条件待复核',
          natalStructure,
          `${killerTriggers.join('、')}另列原典“逢杀反吉”例外；仍与财生官一般忌杀候选并存`,
        );
      }
    }

    if (structure.wealthStems.length > 0 && hasFood) {
      const natalStructure = `原局${natalWealth}与${natalFoods}同见，具财用食生局部结构`;
      if (peerTriggers.length > 0) {
        addFact(
          layer,
          'wealth-food-peer',
          '财用食生取运候选',
          '条件待复核',
          natalStructure,
          `${peerTriggers.join('、')}只在“财食重而身轻”另经全局闭合时，对应助身方向`,
        );
      }
      const conditionalWealthFood = [...wealthTriggers, ...foodTriggers];
      if (conditionalWealthFood.length > 0) {
        addFact(
          layer,
          'wealth-food-wealth-food',
          '财用食生取运候选',
          '条件待复核',
          natalStructure,
          `${conditionalWealthFood.join('、')}只在“财食轻而身重”另经全局闭合时，对应仍行财食`,
        );
      }
      if (killerTriggers.length > 0) {
        addFact(
          layer,
          'wealth-food-killer',
          '财用食生取运候选',
          '支持候选',
          natalStructure,
          `${killerTriggers.join('、')}对应原典“杀不忌”的局部候选`,
        );
      }
      const obscuringTriggers = [...officerTriggers, ...resourceTriggers];
      if (obscuringTriggers.length > 0) {
        addFact(
          layer,
          'wealth-food-officer-resource',
          '财用食生取运候选',
          '带忌候选',
          natalStructure,
          `${obscuringTriggers.join('、')}对应原典官印反晦；印不得在此结构中机械归入助身`,
        );
      }
    }

    if (hasUnimpededResource) {
      const natalStructure = `原局${natalResources}明透，财印未见相邻五合或直接财克印，具财格佩印局部结构`;
      if (officerTriggers.length > 0) {
        addFact(
          layer,
          'resource-officer',
          '财格佩印取运候选',
          '支持候选',
          natalStructure,
          `${officerTriggers.join('、')}对应原典所喜官星`,
        );
      }
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'resource-resource',
          '财格佩印取运候选',
          '条件待复核',
          natalStructure,
          `${resourceTriggers.join('、')}只在“身弱且印旺”另经全局闭合时列入所喜印旺方向`,
        );
      }
    }

    if (hasSeparatedFoodResource) {
      const natalStructure = `原局${structure.foodResourceTwoSeparatorPairs
        .map(
          ({ left, right }) =>
            `${left.label}${left.stem}${left.tenGod}与${right.label}${right.stem}${right.tenGod}隔两位`,
        )
        .join('、')}，具财用食印两不相碍局部结构`;
      const conditionalWealthFood = [...wealthTriggers, ...foodTriggers];
      if (conditionalWealthFood.length > 0) {
        addFact(
          layer,
          'food-resource-wealth-food',
          '财用食印取运候选',
          '条件待复核',
          natalStructure,
          `${conditionalWealthFood.join('、')}只在“财轻”另经全局闭合时，对应财食方向`,
        );
      }
      const conditionalBody = [...peerTriggers, ...resourceTriggers];
      if (conditionalBody.length > 0) {
        addFact(
          layer,
          'food-resource-body',
          '财用食印取运候选',
          '条件待复核',
          natalStructure,
          `${conditionalBody.join('、')}只在“身轻”另经全局闭合时，对应比印方向`,
        );
      }
      if (officerTriggers.length > 0) {
        addFact(
          layer,
          'food-resource-officer',
          '财用食印取运候选',
          '带忌候选',
          natalStructure,
          `${officerTriggers.join('、')}对应原典官星有碍`,
        );
      }
      if (killerTriggers.length > 0) {
        addFact(
          layer,
          'food-resource-killer',
          '财用食印取运候选',
          '支持候选',
          natalStructure,
          `${killerTriggers.join('、')}对应原典七杀不忌`,
        );
      }
    }

    if (hasHurt) {
      const natalStructure = `原局${natalHurts}成明透或完整会局，具财带伤官局部结构`;
      if (wealthTriggers.length > 0) {
        addFact(
          layer,
          'hurt-wealth',
          '财带伤官取运候选',
          '支持候选',
          natalStructure,
          `${wealthTriggers.join('、')}对应原典财运可取`,
        );
      }
      const adverseTriggers = [...killerTriggers, ...officerTriggers, ...resourceTriggers];
      if (adverseTriggers.length > 0) {
        addFact(
          layer,
          'hurt-killer-officer-resource',
          '财带伤官取运候选',
          '带忌候选',
          natalStructure,
          `${adverseTriggers.join('、')}对应原典杀运不利、官印未见其美`,
        );
      }
    }

    if (structure.killerStems.length > 0) {
      const killerState = structure.killerCombinations.length
        ? `已见${structure.killerCombinations.length}组相邻五合`
        : structure.unresolvedKillerStems.length
          ? '未见相邻五合取清'
          : '另有制化待全局复核';
      const natalStructure = `原局${natalKillers}明透（${killerState}），具财带七杀局部结构`;
      if (outputTriggers.length > 0) {
        addFact(
          layer,
          'killer-output',
          '财带七杀取运候选',
          '支持候选',
          natalStructure,
          `${outputTriggers.join('、')}对应食伤方向；不因原局已合杀、食制或尚未取清而省略`,
        );
      }
      if (peerTriggers.length > 0) {
        addFact(
          layer,
          'killer-peer',
          '财带七杀取运候选',
          '条件待复核',
          natalStructure,
          `${peerTriggers.join('、')}只作身旺方向组件，单个比劫运字不直接证明身旺`,
        );
      }
    }

    if (hasKillerResourceWithoutExposedWealth) {
      const natalStructure = `原局${natalKillers}与${natalResources}明透且财星未明透，具财用杀印局部结构`;
      if (resourceTriggers.length > 0) {
        addFact(
          layer,
          'killer-resource-resource',
          '财用杀印取运候选',
          '条件待复核',
          natalStructure,
          `${resourceTriggers.join('、')}只作印旺方向候选，单个印星运字不直接证明印旺`,
        );
      }
      if (wealthTriggers.length > 0) {
        addFact(
          layer,
          'killer-resource-wealth',
          '财用杀印取运候选',
          '带忌候选',
          natalStructure,
          `${wealthTriggers.join('、')}对应原典逢财所忌`,
        );
      }
      if (outputTriggers.length > 0) {
        addFact(
          layer,
          'killer-resource-output',
          '财用杀印取运候选',
          '条件待复核',
          natalStructure,
          `${outputTriggers.join('、')}只记录原典“伤食任意”的非固定忌边界，不宣称为喜运`,
        );
      }
    }
  });

  const calculationStep: FortuneTriggerCalculationStep = {
    key: calculationStepKey,
    stage: '财格取运核验',
    status: '已计算',
    inputs: {
      patternName,
      activeLayerKeys: params.layerStructureFacts.map((item) => item.layerKey),
      natalExposedTenGods: structure.exposedStems.map((item) => item.tenGod),
      hasFoodFormation: structure.foodFormations.length > 0,
      hasHurtFormation: structure.hurtFormations.length > 0,
      hasKillerCombination: structure.killerCombinations.length > 0,
    },
    result: {
      candidateCount: facts.length,
      candidateKeys: facts.map((item) => item.key),
    },
    dependsOnStepKeys: params.layerStructureFacts.map((item) => item.calculationStepKey),
    promptText: facts.length
      ? `已按财格原局子结构逐字核验所选岁运，记录${facts.length}项支持、带忌或条件待复核候选`
      : '已按财格原局子结构逐字核验所选岁运，当前未命中可客观闭合的专属取运候选',
    sources: ['《子平真诠评注》“论财取运”', '原局财格子结构与岁运干支分层事实'],
    limitation: CALCULATION_STEP_LIMITATION,
  };
  return { facts, calculationStep, applicable: true };
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
  layerStructureFacts: FortuneLayerStructureFact[];
  hiddenStemRevealFacts: FortuneHiddenStemRevealFact[];
  officerPatternRuleFacts: FortuneOfficerPatternRuleFact[];
  wealthPatternRuleFacts: FortuneWealthPatternRuleFact[];
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
      ...params.layerStructureFacts.map((item) => item.key),
      ...params.hiddenStemRevealFacts.map((item) => item.key),
      ...params.officerPatternRuleFacts.map((item) => item.key),
      ...params.wealthPatternRuleFacts.map((item) => item.key),
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
  layerStructureFacts: FortuneLayerStructureFact[];
  hiddenStemRevealFacts: FortuneHiddenStemRevealFact[];
  officerPatternRuleFacts: FortuneOfficerPatternRuleFact[];
  officerPatternRulesApplicable: boolean;
  wealthPatternRuleFacts: FortuneWealthPatternRuleFact[];
  wealthPatternRulesApplicable: boolean;
  relations: FortuneTriggerRelation[];
  formations: FortuneTriggerFormationFact[];
  counterEvidenceFacts: FortuneTriggerCounterEvidenceFact[];
  relationSummaryFact: FortuneTriggerRelationSummaryFact;
}): FortuneTriggerLimitationFact[] {
  const relationKeys = params.relations.map((item) => item.key);
  const formationKeys = params.formations.map((item) => item.key);
  const counterKeys = params.counterEvidenceFacts.map((item) => item.key);
  const structureKeys = params.layerStructureFacts.map((item) => item.key);
  const revealKeys = params.hiddenStemRevealFacts.map((item) => item.key);
  const officerRuleKeys = params.officerPatternRuleFacts.map((item) => item.key);
  const wealthRuleKeys = params.wealthPatternRuleFacts.map((item) => item.key);
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
      key: 'bazi:fortune-trigger:limitation:direct-preference',
      type: '喜忌候选边界',
      ownerFactKeys: [params.relationSummaryFact.key, ...structureKeys],
      promptText:
        '岁运五行与原局喜用或忌神五行直接同类，只能列为待复核候选；似喜实忌、似忌实喜均可能存在，不得据单个五行、十神、运干或运支直接标成最终喜运或忌运',
      sources: ['《子平真诠评注》“论行运”与原局结构化喜忌五行'],
    },
    {
      key: 'bazi:fortune-trigger:limitation:stem-branch-separation',
      type: '干支分看边界',
      ownerFactKeys: [params.relationSummaryFact.key, ...structureKeys, ...revealKeys],
      promptText:
        '岁运天干主动明透，地支包含本气、中气、余气并须结合合冲会局或透出对应复核；同五行、同十神的运干与运支也不得机械视为同一作用或同一结果',
      sources: ['《子平真诠评注》“论喜忌干支有别”“论支中喜忌逢运透清”'],
    },
    {
      key: 'bazi:fortune-trigger:limitation:pattern-transformation',
      type: '成格变格边界',
      ownerFactKeys: [
        params.relationSummaryFact.key,
        ...formationKeys,
        ...structureKeys,
        ...revealKeys,
      ],
      promptText:
        '岁运补全三合三会、藏干见同字或五行对应只证明局部结构；成格、变格及其最终喜忌必须重新结合月令格局、原局透藏与全局制化核验，当前证据不得直接认定成格或变格',
      sources: ['《子平真诠评注》“论行运成格变格”与岁运结构事实'],
    },
    ...(params.officerPatternRulesApplicable
      ? [
          {
            key: 'bazi:fortune-trigger:limitation:officer-pattern-rules',
            type: '正官取运边界' as const,
            ownerFactKeys: [params.relationSummaryFact.key, ...officerRuleKeys],
            promptText:
              '正官取运只能按当前八字的具体子结构逐字研究；身稍轻、官稍轻、财轻、官重身轻、官旺、印旺与身旺之地均不得用十神数量或单个运字硬判，多个子结构候选相反时须保留冲突并结合全局取舍，不可拘泥成固定喜忌表',
            sources: ['《子平真诠评注》“论正官取运”及“变化在人，不可泥也”'],
          },
        ]
      : []),
    ...(params.wealthPatternRulesApplicable
      ? [
          {
            key: 'bazi:fortune-trigger:limitation:wealth-pattern-rules',
            type: '财格取运边界' as const,
            ownerFactKeys: [params.relationSummaryFact.key, ...wealthRuleKeys],
            promptText:
              '财格取运只能按当前八字的具体子结构逐字研究；财旺、身旺、身轻、财食轻重与印旺均不得用十神数量或单个运字硬判，多个子结构候选相反时须全部保留并结合全局取舍，不可拘泥成固定喜忌表',
            sources: ['《子平真诠评注》“论财取运”及“变化在人，不可泥也”'],
          },
        ]
      : []),
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
  layerStructureFacts: FortuneLayerStructureFact[];
  hiddenStemRevealFacts: FortuneHiddenStemRevealFact[];
  officerPatternRuleFacts: FortuneOfficerPatternRuleFact[];
  wealthPatternRuleFacts: FortuneWealthPatternRuleFact[];
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
    ...(params.layerStructureFacts.length
      ? [
          {
            level: '主证',
            title: '岁运干支分层与喜忌候选',
            detail: `${params.layerStructureFacts.map((item) => item.promptText).join('；')}。统一边界：${LAYER_STRUCTURE_LIMITATION}`,
            source: Array.from(
              new Set(params.layerStructureFacts.flatMap((item) => item.sources)),
            ).join('、'),
            tags: ['八字岁运', '干支分层', '喜忌候选'],
          } satisfies PromptEvidenceItem,
        ]
      : []),
    ...(params.officerPatternRuleFacts.length
      ? [
          {
            level: '主证',
            title: '正官格逐字取运候选',
            detail: `${params.officerPatternRuleFacts
              .map(
                (item) =>
                  `${item.layerLabel}${item.ganZhi}${item.type}：${item.trigger}（${item.status}）`,
              )
              .join('；')}。统一边界：${OFFICER_PATTERN_RULE_LIMITATION}`,
            source: Array.from(
              new Set(params.officerPatternRuleFacts.flatMap((item) => item.sources)),
            ).join('、'),
            tags: ['八字岁运', '正官格', '逐字取运候选'],
          } satisfies PromptEvidenceItem,
        ]
      : []),
    ...(params.wealthPatternRuleFacts.length
      ? [
          {
            level: '主证',
            title: '财格逐字取运候选',
            detail: `${params.wealthPatternRuleFacts
              .map(
                (item) =>
                  `${item.layerLabel}${item.ganZhi}${item.type}：${item.trigger}（${item.status}）`,
              )
              .join('；')}。统一边界：${WEALTH_PATTERN_RULE_LIMITATION}`,
            source: Array.from(
              new Set(params.wealthPatternRuleFacts.flatMap((item) => item.sources)),
            ).join('、'),
            tags: ['八字岁运', '财格', '逐字取运候选'],
          } satisfies PromptEvidenceItem,
        ]
      : []),
    {
      level: params.hiddenStemRevealFacts.length ? '辅证' : '反证',
      title: '藏干透出对应候选',
      detail: params.hiddenStemRevealFacts.length
        ? `${params.hiddenStemRevealFacts.map((item) => item.promptText).join('；')}。统一边界：${HIDDEN_STEM_REVEAL_LIMITATION}`
        : `当前所选岁运与原局未见藏干和明透天干同字的透出对应候选；未见候选不等于地支不起作用，也不代表已经完成格局喜忌判断。统一边界：${HIDDEN_STEM_REVEAL_LIMITATION}`,
      source: '地支藏干固定表、原局与所选岁运明透天干逐层核验',
      tags: ['八字岁运', '藏干', '透出对应候选'],
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
  const usefulWuxing = resolveUsefulWuxing(result);
  const layerStructureFacts = resolvedActiveLayers.map((layer) =>
    buildLayerStructureFact(result, layer, usefulWuxing),
  );
  calculationSteps.push(...layerStructureFacts.map(buildLayerStructureCalculationStep));
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
  const hiddenStemRevealCalculationStepKey = 'bazi:fortune-trigger:calculation:hidden-reveal-scan';
  const hiddenStemRevealFacts = buildHiddenStemRevealFacts({
    layers,
    activeLayers: resolvedActiveLayers,
    calculationStepKey: hiddenStemRevealCalculationStepKey,
  });
  calculationSteps.push(
    buildHiddenStemRevealCalculationStep({ layers, facts: hiddenStemRevealFacts }),
  );
  const officerPatternRuleAnalysis = buildOfficerPatternRuleAnalysis({
    result,
    layerStructureFacts,
  });
  const officerPatternRuleFacts = officerPatternRuleAnalysis.facts;
  if (officerPatternRuleAnalysis.calculationStep) {
    calculationSteps.push(officerPatternRuleAnalysis.calculationStep);
  }
  const wealthPatternRuleAnalysis = buildWealthPatternRuleAnalysis({
    result,
    layerStructureFacts,
  });
  const wealthPatternRuleFacts = wealthPatternRuleAnalysis.facts;
  if (wealthPatternRuleAnalysis.calculationStep) {
    calculationSteps.push(wealthPatternRuleAnalysis.calculationStep);
  }
  const relationSummaryFact = buildRelationSummaryFact({
    calculationSteps,
    layerStructureFacts,
    hiddenStemRevealFacts,
    officerPatternRuleFacts,
    wealthPatternRuleFacts,
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
    layerStructureFacts,
    hiddenStemRevealFacts,
    officerPatternRuleFacts,
    officerPatternRulesApplicable: officerPatternRuleAnalysis.applicable,
    wealthPatternRuleFacts,
    wealthPatternRulesApplicable: wealthPatternRuleAnalysis.applicable,
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
    layerStructureFacts,
    hiddenStemRevealFacts,
    officerPatternRuleFacts,
    wealthPatternRuleFacts,
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
  const calculationOverview = `已校验${layers.length}个原局与岁运层级，形成${layerStructureFacts.length}项岁运干支分层事实、${hiddenStemRevealFacts.length}项藏干透出对应候选、${officerPatternRuleFacts.length}项正官取运候选、${wealthPatternRuleFacts.length}项财格取运候选，完成${comparisonSteps.length}组逐项比对和三合三会汇总核验；${relationSummaryFact.promptText}`;
  const counterOverview = noMajorFacts.length
    ? `共${noMajorFacts.length}组层级未见岁运并临、天克地冲或同柱伏吟，其中${noMajorWithSupporting.length}组仍有辅助关系；未见主要关系不等于没有较弱关系、没有现实触发或必然平稳`
    : '所有已比较层级均已记录主要关系；仍不得据命中数量生成吉凶或概率结论';
  return {
    key: 'bazi:fortune-trigger:evidence',
    status: comparisonSteps.length ? '已计算' : '无可比较层级',
    calculationSteps,
    calculationChain,
    layers,
    layerStructureFacts,
    hiddenStemRevealFacts,
    officerPatternRuleFacts,
    wealthPatternRuleFacts,
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
        '所选岁运逐层拆分天干、地支主五行与全部藏干，分别记录十神及与原局喜忌五行的直接对应候选；候选不等于最终喜运或忌运。',
        '逐支核验藏干与原局、所选岁运明透天干是否同字，只记录透出对应候选，不直接认定透清、成格或变格。',
        '正官格另按原局用财、佩印、带伤食用印、带杀及合杀结构逐字列取运候选；无法客观闭合的强弱条件保留待复核，不固化为喜忌表。',
        '财格另按财生官、用食生、佩印、用食印、带伤官、带七杀及用杀印结构逐字列取运候选；财旺、身旺、身轻、财食轻重与印旺保留待复核，不以数量硬判。',
        '运干与运支分别保留，地支关系与三合三会另行核验；同五行或同十神不得据此机械等价。',
        '每个层级和关系均保留稳定键、计算步骤依赖及来源层级，未见主要关系时保留反证，不补造候选应期。',
        '关系成立与吉凶解释分离，不对不同关系设置命运总分，也不从单条关系直接推断事件。',
      ],
    },
  };
}
