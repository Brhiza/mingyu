import {
  LIUCHONG_MAP,
  LIUHAI_MAP,
  LIUHE_MAP,
  LIUPO_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  TIAN_GAN_CHONG,
  TIAN_GAN_HE,
  BRANCH_HIDDEN_STEMS,
  isKe,
  isSanxing,
  isSheng,
} from '../ganzhi/relations';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { BaziChartResult, Pillar, Wuxing } from './baziTypes';
import { assertPillars, getTenGod, getTenGodForBranch, getWuxing } from './baziUtils';

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS: Record<PillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

type PillarKey = (typeof PILLAR_KEYS)[number];
type ElementRelation = '同类' | '生对方' | '受对方生' | '克对方' | '受对方克';
type StemRelationType = '五合候选' | '天干冲';
type BranchRelationType = '同支' | '六合' | '六冲' | '三刑' | '六害' | '六破';
type BaziCrossPillarRelationDraft = Omit<
  BaziCrossPillarRelation,
  | 'key'
  | 'status'
  | 'sourceLayerKey'
  | 'targetLayerKey'
  | 'calculationStepKey'
  | 'promptText'
  | 'sources'
  | 'limitation'
>;

export interface BaziCompatibilityOptions {
  person1Name?: string;
  person2Name?: string;
}

export interface BaziDayMasterRelation {
  key: 'bazi:compatibility:day-master-relation';
  status: '已计算';
  calculationStepKey: 'bazi:compatibility:calculation:day-master';
  person1Gan: string;
  person1Wuxing: Wuxing;
  person2Gan: string;
  person2Wuxing: Wuxing;
  person1ToPerson2: ElementRelation;
  person2ToPerson1: ElementRelation;
  person2GanAsPerson1TenGod: string;
  person1GanAsPerson2TenGod: string;
  promptText: string;
  sources: string[];
  limitation: '日主五行生克与双向十神只证明两种日干之间的固定关系，不证明双方现实关系结果、相处质量、婚恋成败或合作收益';
}

export interface BaziCrossPillarRelation {
  key: string;
  status: '已命中';
  layer: '天干' | '地支';
  type: StemRelationType | BranchRelationType;
  person1Pillar: PillarKey;
  person2Pillar: PillarKey;
  person1Value: string;
  person2Value: string;
  transformWuxing?: string;
  note?: string;
  sourceLayerKey: string;
  targetLayerKey: string;
  calculationStepKey: 'bazi:compatibility:calculation:cross-pillars';
  promptText: string;
  sources: string[];
  limitation: '跨盘干支关系只证明固定关系表在指定柱位命中；合不等于合化，冲刑害破不等于现实冲突、伤害、分离或失败';
}

export interface BaziCrossBranchCombination {
  key: string;
  status: '组合齐备';
  type: '三合' | '三会';
  name: string;
  members: Array<{
    branch: string;
    sources: Array<{ person: 'person1' | 'person2'; pillar: PillarKey }>;
  }>;
  note: string;
  sourceLayerKeys: string[];
  calculationStepKey: 'bazi:compatibility:calculation:branch-combinations';
  promptText: string;
  sources: string[];
  limitation: '跨盘三合三会只证明三个地支成员齐备且来源跨越双方，不证明成局、成化、关系稳定或现实结果';
}

export interface BaziTenGodMapping {
  key: string;
  status: '已计算';
  observer: 'person1' | 'person2';
  source: 'person1' | 'person2';
  pillar: PillarKey;
  stem: string;
  stemTenGod: string;
  branch: string;
  branchMainQiTenGod: string;
  sourceLayerKey: string;
  calculationStepKey: 'bazi:compatibility:calculation:ten-god-mappings';
  promptText: string;
  sources: string[];
  limitation: '双向十神映射只证明对方干支相对观察方日干的十神分类，不等于角色定性、人格标签、情感结果或行为因果';
}

export interface BaziUsefulGodCoverage {
  key: string;
  status: '已计算' | '资料不足';
  beneficiary: 'person1' | 'person2';
  provider: 'person1' | 'person2';
  favorable: BaziUsefulGodCoverageItem[];
  unfavorable: BaziUsefulGodCoverageItem[];
  unavailableReason?: string;
  calculationStepKey: 'bazi:compatibility:calculation:useful-god-coverage';
  promptText: string;
  sources: string[];
  limitation: '喜忌覆盖只证明提供方盘面是否出现受益方既有喜用或忌神五行，不比较伪精确强度，不证明互补、克制、婚配或合作结果';
}

export interface BaziUsefulGodCoverageItem {
  key: string;
  status: '已命中';
  role: '喜用' | '忌神';
  wuxing: string;
  sources: Array<{
    pillar: PillarKey;
    layer: '天干' | '地支' | '藏干';
    value: string;
  }>;
  sourceLayerKeys: string[];
}

export interface BaziCompatibilityCalculationStep {
  key: string;
  stage:
    | '双盘输入校验'
    | '日主双向关系'
    | '四柱交叉比对'
    | '跨盘组合核验'
    | '双向十神映射'
    | '喜忌五行覆盖'
    | '证据汇总';
  status: '已计算';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明两份命盘经过固定干支、五行、十神与喜忌覆盖规则形成当前事实，不证明现实关系、婚恋成败、合作收益、发生概率或固定应期';
}

export interface BaziCompatibilityCounterEvidenceFact {
  key: string;
  type: '夫妻宫关系覆盖' | '跨盘组合覆盖' | '喜用资料覆盖' | '喜忌并存';
  status: '有可用证据' | '未命中' | '资料不足' | '存在双向条件';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录夫妻宫关系、跨盘组合、喜用资料和喜忌并存的覆盖情况；未命中不等于关系有利或不利，命中也不证明现实结果';
}

export interface BaziCompatibilitySummaryFact {
  key: 'bazi:compatibility:evidence-summary';
  status: '证据完整' | '存在资料缺口';
  factKeys: string[];
  crossPillarRelationCount: number;
  spousePalaceRelationCount: number;
  crossBranchCombinationCount: number;
  tenGodMappingCount: number;
  favorableCoverageCount: number;
  unfavorableCoverageCount: number;
  unavailableCoverageCount: number;
  promptText: string;
  sources: string[];
  limitation: '双盘证据汇总只统计已计算事实与资料缺口，不得按命中数量生成匹配分、成功率、婚恋概率、合作收益或必然结论';
}

export interface BaziCompatibilityLimitationFact {
  key: string;
  type: '关系因果边界' | '合化边界' | '十神边界' | '喜忌覆盖边界' | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束双盘干支、十神和喜忌覆盖能够支持的解释范围，不得被反向当作现实关系结果、吉凶概率或保证有效建议的证据';
}

export interface BaziCompatibilityEvidenceResult {
  key: 'bazi:compatibility:evidence';
  status: '已计算' | '存在资料缺口';
  people: { person1: string; person2: string };
  calculationSteps: BaziCompatibilityCalculationStep[];
  calculationChain: string[];
  dayMasterRelation: BaziDayMasterRelation;
  spousePalaceRelations: BaziCrossPillarRelation[];
  crossPillarRelations: BaziCrossPillarRelation[];
  crossBranchCombinations: BaziCrossBranchCombination[];
  tenGodMappings: BaziTenGodMapping[];
  usefulGodCoverage: BaziUsefulGodCoverage[];
  counterEvidence: string[];
  counterEvidenceFacts: BaziCompatibilityCounterEvidenceFact[];
  summaryFact: BaziCompatibilitySummaryFact;
  limitations: string[];
  limitationFacts: BaziCompatibilityLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: { notes: string[] };
}

const DAY_MASTER_LIMITATION =
  '日主五行生克与双向十神只证明两种日干之间的固定关系，不证明双方现实关系结果、相处质量、婚恋成败或合作收益' as const;
const CROSS_PILLAR_LIMITATION =
  '跨盘干支关系只证明固定关系表在指定柱位命中；合不等于合化，冲刑害破不等于现实冲突、伤害、分离或失败' as const;
const COMBINATION_LIMITATION =
  '跨盘三合三会只证明三个地支成员齐备且来源跨越双方，不证明成局、成化、关系稳定或现实结果' as const;
const TEN_GOD_LIMITATION =
  '双向十神映射只证明对方干支相对观察方日干的十神分类，不等于角色定性、人格标签、情感结果或行为因果' as const;
const USEFUL_GOD_LIMITATION =
  '喜忌覆盖只证明提供方盘面是否出现受益方既有喜用或忌神五行，不比较伪精确强度，不证明互补、克制、婚配或合作结果' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明两份命盘经过固定干支、五行、十神与喜忌覆盖规则形成当前事实，不证明现实关系、婚恋成败、合作收益、发生概率或固定应期' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录夫妻宫关系、跨盘组合、喜用资料和喜忌并存的覆盖情况；未命中不等于关系有利或不利，命中也不证明现实结果' as const;
const SUMMARY_LIMITATION =
  '双盘证据汇总只统计已计算事实与资料缺口，不得按命中数量生成匹配分、成功率、婚恋概率、合作收益或必然结论' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束双盘干支、十神和喜忌覆盖能够支持的解释范围，不得被反向当作现实关系结果、吉凶概率或保证有效建议的证据' as const;

function layerFactKey(person: 'person1' | 'person2', pillar: PillarKey) {
  return `bazi:compatibility:layer:${person}:${pillar}`;
}

function asWuxing(value: string): Wuxing {
  const result = getWuxing(value);
  if (result === '未知') throw new Error(`无法识别五行：${value}`);
  return result;
}

function getElementRelation(source: Wuxing, target: Wuxing): ElementRelation {
  if (source === target) return '同类';
  if (isSheng(source, target)) return '生对方';
  if (isSheng(target, source)) return '受对方生';
  if (isKe(source, target)) return '克对方';
  return '受对方克';
}

function collectStemRelations(left: Pillar, right: Pillar): BaziCrossPillarRelationDraft[] {
  const result: BaziCrossPillarRelationDraft[] = [];
  if (TIAN_GAN_HE[left.gan]?.partner === right.gan) {
    result.push({
      layer: '天干',
      type: '五合候选',
      person1Pillar: 'year',
      person2Pillar: 'year',
      person1Value: left.gan,
      person2Value: right.gan,
      transformWuxing: TIAN_GAN_HE[left.gan].wuxing,
      note: '只确认天干五合关系；是否合化需另看月令、透干、根气和制化条件。',
    });
  }
  if (TIAN_GAN_CHONG[left.gan] === right.gan) {
    result.push({
      layer: '天干',
      type: '天干冲',
      person1Pillar: 'year',
      person2Pillar: 'year',
      person1Value: left.gan,
      person2Value: right.gan,
    });
  }
  return result;
}

function collectBranchRelations(left: Pillar, right: Pillar): BaziCrossPillarRelationDraft[] {
  const relations: BranchRelationType[] = [];
  if (left.zhi === right.zhi) relations.push('同支');
  if (LIUHE_MAP[left.zhi] === right.zhi) relations.push('六合');
  if (LIUCHONG_MAP[left.zhi] === right.zhi) relations.push('六冲');
  if (isSanxing(left.zhi, right.zhi)) relations.push('三刑');
  if (LIUHAI_MAP[left.zhi] === right.zhi) relations.push('六害');
  if (LIUPO_MAP[left.zhi] === right.zhi) relations.push('六破');
  return relations.map((type) => ({
    layer: '地支',
    type,
    person1Pillar: 'year',
    person2Pillar: 'year',
    person1Value: left.zhi,
    person2Value: right.zhi,
  }));
}

function calculateCrossRelations(chart1: BaziChartResult, chart2: BaziChartResult) {
  const result: BaziCrossPillarRelation[] = [];
  for (const person1Pillar of PILLAR_KEYS) {
    for (const person2Pillar of PILLAR_KEYS) {
      const left = chart1.pillars[person1Pillar];
      const right = chart2.pillars[person2Pillar];
      const relations = [
        ...collectStemRelations(left, right),
        ...collectBranchRelations(left, right),
      ];
      for (const relation of relations) {
        const resolved: BaziCrossPillarRelation = {
          ...relation,
          key: `bazi:compatibility:cross-pillar:${relation.layer}:${relation.type}:person1:${person1Pillar}:person2:${person2Pillar}`,
          status: '已命中',
          person1Pillar,
          person2Pillar,
          sourceLayerKey: layerFactKey('person1', person1Pillar),
          targetLayerKey: layerFactKey('person2', person2Pillar),
          calculationStepKey: 'bazi:compatibility:calculation:cross-pillars',
          promptText: `第一人${PILLAR_LABELS[person1Pillar]}${relation.person1Value}与第二人${PILLAR_LABELS[person2Pillar]}${relation.person2Value}命中${relation.type}`,
          sources:
            relation.layer === '天干'
              ? ['天干五合与相冲固定关系', '双方四柱天干逐项交叉']
              : ['地支同支、六合、六冲、三刑、六害与六破固定关系', '双方四柱地支逐项交叉'],
          limitation: CROSS_PILLAR_LIMITATION,
        };
        result.push(resolved);
      }
    }
  }
  return result;
}

function calculateCombinations(chart1: BaziChartResult, chart2: BaziChartResult) {
  const sources = new Map<string, Array<{ person: 'person1' | 'person2'; pillar: PillarKey }>>();
  for (const [person, chart] of [
    ['person1', chart1],
    ['person2', chart2],
  ] as const) {
    for (const pillar of PILLAR_KEYS) {
      const branch = chart.pillars[pillar].zhi;
      sources.set(branch, [...(sources.get(branch) ?? []), { person, pillar }]);
    }
  }
  const combinations: BaziCrossBranchCombination[] = [];
  for (const [type, groups] of [
    ['三合', SANHE_GROUPS],
    ['三会', SANHUI_GROUPS],
  ] as const) {
    for (const [name, branches] of Object.entries(groups)) {
      if (!branches.every((branch) => sources.has(branch))) continue;
      const members = branches.map((branch) => ({ branch, sources: sources.get(branch) ?? [] }));
      const people = new Set(
        members.flatMap((member) => member.sources.map((source) => source.person)),
      );
      if (people.size < 2) continue;
      const sourceLayerKeys = Array.from(
        new Set(
          members.flatMap((member) =>
            member.sources.map((source) => layerFactKey(source.person, source.pillar)),
          ),
        ),
      );
      combinations.push({
        key: `bazi:compatibility:branch-combination:${type}:${name}`,
        status: '组合齐备',
        type,
        name,
        members,
        note: `两盘地支共同构成${type}组合；只记录组合齐备，不直接判定成局或成化。`,
        sourceLayerKeys,
        calculationStepKey: 'bazi:compatibility:calculation:branch-combinations',
        promptText: `双方八个地支共同提供${branches.join('、')}，命中${name}${type}组合`,
        sources: ['地支三合与三会固定成员表', '双方八个地支联合枚举'],
        limitation: COMBINATION_LIMITATION,
      });
    }
  }
  return combinations;
}

function calculateTenGodMappings(
  observer: 'person1' | 'person2',
  source: 'person1' | 'person2',
  observerChart: BaziChartResult,
  sourceChart: BaziChartResult,
) {
  return PILLAR_KEYS.map((pillar): BaziTenGodMapping => {
    const value = sourceChart.pillars[pillar];
    const stemTenGod = getTenGod(value.gan, observerChart.dayMaster.gan);
    const branchMainQiTenGod = getTenGodForBranch(value.zhi, observerChart.dayMaster.gan);
    return {
      key: `bazi:compatibility:ten-god:${observer}:observes:${source}:${pillar}`,
      status: '已计算',
      observer,
      source,
      pillar,
      stem: value.gan,
      stemTenGod,
      branch: value.zhi,
      branchMainQiTenGod,
      sourceLayerKey: layerFactKey(source, pillar),
      calculationStepKey: 'bazi:compatibility:calculation:ten-god-mappings',
      promptText: `${source === 'person1' ? '第一人' : '第二人'}${PILLAR_LABELS[pillar]}天干${value.gan}、地支${value.zhi}相对${observer === 'person1' ? '第一人' : '第二人'}日主分别映射为${stemTenGod}与${branchMainQiTenGod}`,
      sources: ['观察方日干与对方天干十神映射', '观察方日干与对方地支本气十神映射'],
      limitation: TEN_GOD_LIMITATION,
    };
  });
}

function calculateUsefulGodCoverage(
  beneficiary: 'person1' | 'person2',
  provider: 'person1' | 'person2',
  beneficiaryChart: BaziChartResult,
  providerChart: BaziChartResult,
): BaziUsefulGodCoverage {
  const favorable = beneficiaryChart.analysis?.usefulGod?.favorableWuxing;
  const unfavorable = beneficiaryChart.analysis?.usefulGod?.unfavorableWuxing;
  if (!favorable?.length && !unfavorable?.length) {
    return {
      key: `bazi:compatibility:useful-god-coverage:${beneficiary}:from:${provider}`,
      status: '资料不足',
      beneficiary,
      provider,
      favorable: [],
      unfavorable: [],
      unavailableReason: '命盘未提供结构化喜忌五行。',
      calculationStepKey: 'bazi:compatibility:calculation:useful-god-coverage',
      promptText: `${beneficiary === 'person1' ? '第一人' : '第二人'}命盘未提供结构化喜忌五行，无法核验${provider === 'person1' ? '第一人' : '第二人'}盘面的喜忌覆盖`,
      sources: ['受益方命盘结构化喜忌五行'],
      limitation: USEFUL_GOD_LIMITATION,
    };
  }
  const sourcesByWuxing = new Map<string, BaziUsefulGodCoverageItem['sources']>();
  for (const pillar of PILLAR_KEYS) {
    const value = providerChart.pillars[pillar];
    for (const [layer, symbol] of [
      ['天干', value.gan],
      ['地支', value.zhi],
    ] as const) {
      const wuxing = asWuxing(symbol);
      sourcesByWuxing.set(wuxing, [
        ...(sourcesByWuxing.get(wuxing) ?? []),
        { pillar, layer, value: symbol },
      ]);
    }
    for (const hiddenStem of BRANCH_HIDDEN_STEMS[value.zhi] ?? []) {
      const wuxing = asWuxing(hiddenStem);
      sourcesByWuxing.set(wuxing, [
        ...(sourcesByWuxing.get(wuxing) ?? []),
        { pillar, layer: '藏干', value: hiddenStem },
      ]);
    }
  }
  const match = (role: '喜用' | '忌神', elements: string[] | undefined) =>
    [...new Set(elements ?? [])]
      .filter((wuxing) => sourcesByWuxing.has(wuxing))
      .map((wuxing): BaziUsefulGodCoverageItem => {
        const sources = sourcesByWuxing.get(wuxing) ?? [];
        return {
          key: `bazi:compatibility:useful-god:${beneficiary}:from:${provider}:${role}:${wuxing}`,
          status: '已命中',
          role,
          wuxing,
          sources,
          sourceLayerKeys: Array.from(
            new Set(sources.map((source) => layerFactKey(provider, source.pillar))),
          ),
        };
      });
  const favorableCoverage = match('喜用', favorable);
  const unfavorableCoverage = match('忌神', unfavorable);
  return {
    key: `bazi:compatibility:useful-god-coverage:${beneficiary}:from:${provider}`,
    status: '已计算',
    beneficiary,
    provider,
    favorable: favorableCoverage,
    unfavorable: unfavorableCoverage,
    calculationStepKey: 'bazi:compatibility:calculation:useful-god-coverage',
    promptText: `${provider === 'person1' ? '第一人' : '第二人'}盘面命中${beneficiary === 'person1' ? '第一人' : '第二人'}喜用五行${favorableCoverage.map((item) => item.wuxing).join('、') || '无'}，忌神五行${unfavorableCoverage.map((item) => item.wuxing).join('、') || '无'}`,
    sources: ['受益方结构化喜忌五行', '提供方四柱天干、地支与藏干五行来源'],
    limitation: USEFUL_GOD_LIMITATION,
  };
}

function sourceLabel(person: string, pillar: PillarKey) {
  return `${person}${PILLAR_LABELS[pillar]}`;
}

function buildBaseCalculationSteps(params: {
  people: BaziCompatibilityEvidenceResult['people'];
  dayMasterRelation: BaziDayMasterRelation;
  relations: BaziCrossPillarRelation[];
  combinations: BaziCrossBranchCombination[];
  tenGodMappings: BaziTenGodMapping[];
  coverage: BaziUsefulGodCoverage[];
}): BaziCompatibilityCalculationStep[] {
  const missingCoverageCount = params.coverage.filter((item) => item.status === '资料不足').length;
  return [
    {
      key: 'bazi:compatibility:calculation:input',
      stage: '双盘输入校验',
      status: '已计算',
      inputs: { person1: params.people.person1, person2: params.people.person2 },
      result: { validChartCount: 2, validPillarCount: 8 },
      dependsOnStepKeys: [],
      promptText: `已校验${params.people.person1}与${params.people.person2}两份命盘共八柱干支`,
      sources: ['双方四柱干支合法性校验'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:compatibility:calculation:day-master',
      stage: '日主双向关系',
      status: '已计算',
      inputs: {
        person1DayMaster: params.dayMasterRelation.person1Gan,
        person2DayMaster: params.dayMasterRelation.person2Gan,
      },
      result: {
        person1ToPerson2: params.dayMasterRelation.person1ToPerson2,
        person2ToPerson1: params.dayMasterRelation.person2ToPerson1,
        person2AsPerson1TenGod: params.dayMasterRelation.person2GanAsPerson1TenGod,
        person1AsPerson2TenGod: params.dayMasterRelation.person1GanAsPerson2TenGod,
      },
      dependsOnStepKeys: ['bazi:compatibility:calculation:input'],
      promptText: `${params.people.person1}日主${params.dayMasterRelation.person1Gan}与${params.people.person2}日主${params.dayMasterRelation.person2Gan}已完成双向五行生克和十神映射`,
      sources: params.dayMasterRelation.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:compatibility:calculation:cross-pillars',
      stage: '四柱交叉比对',
      status: '已计算',
      inputs: { person1PillarCount: 4, person2PillarCount: 4, comparedPairCount: 16 },
      result: {
        relationCount: params.relations.length,
        spousePalaceRelationCount: params.relations.filter(
          (item) => item.person1Pillar === 'day' && item.person2Pillar === 'day',
        ).length,
      },
      dependsOnStepKeys: ['bazi:compatibility:calculation:input'],
      promptText: `双方四柱完成16组交叉比对，命中${params.relations.length}项天干五合候选、天干冲、同支、六合、六冲、三刑、六害或六破关系`,
      sources: ['双方年、月、日、时四柱逐项交叉', '天干地支固定关系表'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:compatibility:calculation:branch-combinations',
      stage: '跨盘组合核验',
      status: '已计算',
      inputs: { combinedBranchCount: 8 },
      result: {
        combinationCount: params.combinations.length,
        combinationNames: params.combinations.map((item) => `${item.name}${item.type}`),
      },
      dependsOnStepKeys: ['bazi:compatibility:calculation:cross-pillars'],
      promptText: `双方八个地支已联合核验三合与三会成员，记录${params.combinations.length}项跨盘组合`,
      sources: ['地支三合与三会固定成员表', '双方八个地支联合枚举'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:compatibility:calculation:ten-god-mappings',
      stage: '双向十神映射',
      status: '已计算',
      inputs: { directionCount: 2, sourcePillarCountPerDirection: 4 },
      result: { mappingCount: params.tenGodMappings.length },
      dependsOnStepKeys: [
        'bazi:compatibility:calculation:input',
        'bazi:compatibility:calculation:day-master',
      ],
      promptText: `以双方各自日干为观察点，完成对方四柱天干和地支本气共${params.tenGodMappings.length}组双向十神映射`,
      sources: ['十神固定映射', '地支本气藏干表'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:compatibility:calculation:useful-god-coverage',
      stage: '喜忌五行覆盖',
      status: '已计算',
      inputs: { directionCount: 2 },
      result: {
        favorableCoverageCount: params.coverage.reduce(
          (count, item) => count + item.favorable.length,
          0,
        ),
        unfavorableCoverageCount: params.coverage.reduce(
          (count, item) => count + item.unfavorable.length,
          0,
        ),
        missingCoverageCount,
      },
      dependsOnStepKeys: ['bazi:compatibility:calculation:input'],
      promptText: `双方喜忌五行与对方天干、地支、藏干已完成双向覆盖核验${missingCoverageCount ? `，其中${missingCoverageCount}个方向资料不足` : ''}`,
      sources: ['双方既有结构化喜忌五行', '双方四柱与藏干五行来源'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildCounterEvidenceFacts(params: {
  spousePalaceRelations: BaziCrossPillarRelation[];
  combinations: BaziCrossBranchCombination[];
  coverage: BaziUsefulGodCoverage[];
}): BaziCompatibilityCounterEvidenceFact[] {
  const facts: BaziCompatibilityCounterEvidenceFact[] = [
    {
      key: 'bazi:compatibility:counter:spouse-palace-relations',
      type: '夫妻宫关系覆盖',
      status: params.spousePalaceRelations.length ? '有可用证据' : '未命中',
      ownerFactKeys: [
        'bazi:compatibility:calculation:cross-pillars',
        ...params.spousePalaceRelations.map((item) => item.key),
      ],
      promptText: params.spousePalaceRelations.length
        ? `双方日支命中${params.spousePalaceRelations.map((item) => item.type).join('、')}关系，已保留逐项夫妻宫事实`
        : '双方日支未命中同支、六合、六冲、三刑、六害或六破；未命中不代表夫妻关系有利或不利',
      sources: ['双方日柱地支固定关系逐项核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazi:compatibility:counter:branch-combinations',
      type: '跨盘组合覆盖',
      status: params.combinations.length ? '有可用证据' : '未命中',
      ownerFactKeys: [
        'bazi:compatibility:calculation:branch-combinations',
        ...params.combinations.map((item) => item.key),
      ],
      promptText: params.combinations.length
        ? `双方八个地支共同命中${params.combinations.map((item) => `${item.name}${item.type}`).join('、')}`
        : '双方八个地支未共同凑齐跨盘三合或三会成员；未命中不代表缺乏其他互动关系',
      sources: ['地支三合三会成员与双方来源联合核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
  params.coverage.forEach((item) => {
    const direction = `${item.provider === 'person1' ? '第一人' : '第二人'}对${item.beneficiary === 'person1' ? '第一人' : '第二人'}`;
    facts.push({
      key: `bazi:compatibility:counter:useful-god-data:${item.beneficiary}:from:${item.provider}`,
      type: '喜用资料覆盖',
      status:
        item.status === '资料不足' ? '资料不足' : item.favorable.length ? '有可用证据' : '未命中',
      ownerFactKeys: [
        'bazi:compatibility:calculation:useful-god-coverage',
        item.key,
        ...item.favorable.map((entry) => entry.key),
      ],
      promptText:
        item.status === '资料不足'
          ? `${direction}缺少受益方结构化喜忌资料，不生成互补结论`
          : item.favorable.length
            ? `${direction}命中喜用五行${item.favorable.map((entry) => entry.wuxing).join('、')}`
            : `${direction}未命中受益方已列喜用五行；未命中不等于关系不利`,
      sources: item.sources,
      limitation: COUNTER_FACT_LIMITATION,
    });
    facts.push({
      key: `bazi:compatibility:counter:mixed-coverage:${item.beneficiary}:from:${item.provider}`,
      type: '喜忌并存',
      status: item.favorable.length && item.unfavorable.length ? '存在双向条件' : '未命中',
      ownerFactKeys: [
        'bazi:compatibility:calculation:useful-god-coverage',
        item.key,
        ...item.favorable.map((entry) => entry.key),
        ...item.unfavorable.map((entry) => entry.key),
      ],
      promptText:
        item.favorable.length && item.unfavorable.length
          ? `${direction}同时命中喜用${item.favorable.map((entry) => entry.wuxing).join('、')}与忌神${item.unfavorable.map((entry) => entry.wuxing).join('、')}，必须并列解释，不得只取有利一侧`
          : `${direction}未形成喜用与忌神同时命中的双向条件；不得据此推断单向有利或不利`,
      sources: ['喜用覆盖与忌神覆盖逐项对照'],
      limitation: COUNTER_FACT_LIMITATION,
    });
  });
  return facts;
}

function buildSummaryFact(params: {
  dayMasterRelation: BaziDayMasterRelation;
  relations: BaziCrossPillarRelation[];
  spousePalaceRelations: BaziCrossPillarRelation[];
  combinations: BaziCrossBranchCombination[];
  tenGodMappings: BaziTenGodMapping[];
  coverage: BaziUsefulGodCoverage[];
}): BaziCompatibilitySummaryFact {
  const favorableCoverageCount = params.coverage.reduce(
    (count, item) => count + item.favorable.length,
    0,
  );
  const unfavorableCoverageCount = params.coverage.reduce(
    (count, item) => count + item.unfavorable.length,
    0,
  );
  const unavailableCoverageCount = params.coverage.filter(
    (item) => item.status === '资料不足',
  ).length;
  const factKeys = [
    'bazi:compatibility:calculation:input',
    'bazi:compatibility:calculation:day-master',
    'bazi:compatibility:calculation:cross-pillars',
    'bazi:compatibility:calculation:branch-combinations',
    'bazi:compatibility:calculation:ten-god-mappings',
    'bazi:compatibility:calculation:useful-god-coverage',
    params.dayMasterRelation.key,
    ...params.relations.map((item) => item.key),
    ...params.combinations.map((item) => item.key),
    ...params.tenGodMappings.map((item) => item.key),
    ...params.coverage.flatMap((item) => [
      item.key,
      ...item.favorable.map((entry) => entry.key),
      ...item.unfavorable.map((entry) => entry.key),
    ]),
  ];
  return {
    key: 'bazi:compatibility:evidence-summary',
    status: unavailableCoverageCount ? '存在资料缺口' : '证据完整',
    factKeys,
    crossPillarRelationCount: params.relations.length,
    spousePalaceRelationCount: params.spousePalaceRelations.length,
    crossBranchCombinationCount: params.combinations.length,
    tenGodMappingCount: params.tenGodMappings.length,
    favorableCoverageCount,
    unfavorableCoverageCount,
    unavailableCoverageCount,
    promptText: `已记录跨柱关系${params.relations.length}项（其中双方日支${params.spousePalaceRelations.length}项）、跨盘三合三会${params.combinations.length}项、双向十神${params.tenGodMappings.length}组、喜用覆盖${favorableCoverageCount}项、忌神覆盖${unfavorableCoverageCount}项${unavailableCoverageCount ? `；另有${unavailableCoverageCount}个喜忌覆盖方向资料不足` : ''}`,
    sources: ['全部双盘关系、组合、十神与喜忌覆盖事实汇总'],
    limitation: SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(params: {
  dayMasterRelation: BaziDayMasterRelation;
  relations: BaziCrossPillarRelation[];
  combinations: BaziCrossBranchCombination[];
  tenGodMappings: BaziTenGodMapping[];
  coverage: BaziUsefulGodCoverage[];
  summaryFact: BaziCompatibilitySummaryFact;
}): BaziCompatibilityLimitationFact[] {
  const definitions: Array<
    Pick<
      BaziCompatibilityLimitationFact,
      'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'
    >
  > = [
    {
      key: 'bazi:compatibility:limitation:causality',
      type: '关系因果边界',
      ownerFactKeys: [
        'bazi:compatibility:calculation:day-master',
        'bazi:compatibility:calculation:cross-pillars',
        params.dayMasterRelation.key,
        ...params.relations.map((item) => item.key),
      ],
      promptText:
        '日主生克、日支关系及跨柱合冲刑害破只证明盘面结构，不等于现实吸引、冲突、伤害、分离、忠诚或关系成败',
      sources: ['盘面关系事实与现实因果分离原则'],
    },
    {
      key: 'bazi:compatibility:limitation:transformation',
      type: '合化边界',
      ownerFactKeys: [
        'bazi:compatibility:calculation:cross-pillars',
        'bazi:compatibility:calculation:branch-combinations',
        ...params.relations.filter((item) => item.type === '五合候选').map((item) => item.key),
        ...params.combinations.map((item) => item.key),
      ],
      promptText:
        '天干五合、地支六合、三合与三会只记录关系或成员齐备；是否合化、成局及实际作用必须结合双方原局月令、透干、根气和制化',
      sources: ['合关系与合化成立条件分离原则'],
    },
    {
      key: 'bazi:compatibility:limitation:ten-god',
      type: '十神边界',
      ownerFactKeys: [
        'bazi:compatibility:calculation:ten-god-mappings',
        ...params.tenGodMappings.map((item) => item.key),
      ],
      promptText:
        '双向十神是相对各自日干的分类，不得把单个十神直接当作人格标签、关系角色或行为因果',
      sources: ['十神相对映射规则'],
    },
    {
      key: 'bazi:compatibility:limitation:useful-god',
      type: '喜忌覆盖边界',
      ownerFactKeys: [
        'bazi:compatibility:calculation:useful-god-coverage',
        ...params.coverage.flatMap((item) => [
          item.key,
          ...item.favorable.map((entry) => entry.key),
          ...item.unfavorable.map((entry) => entry.key),
        ]),
      ],
      promptText:
        '喜用或忌神五行在对方盘面出现只说明符号覆盖，不比较伪精确强度，不等于必然互补、克制或适合婚配合作',
      sources: ['双方既有喜忌结论与对方五行来源交叉'],
    },
    {
      key: 'bazi:compatibility:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [params.summaryFact.key, ...params.summaryFact.factKeys],
      promptText:
        '不输出匹配总分、成功率、离婚概率、出轨判断、合作收益保证、必然断语，也不只凭盘面关系替代现实沟通与风险核验',
      sources: ['传统盘面事实与现实决策分离原则'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function createEvidence(
  people: BaziCompatibilityEvidenceResult['people'],
  calculationSteps: BaziCompatibilityCalculationStep[],
  dayMaster: BaziDayMasterRelation,
  relations: BaziCrossPillarRelation[],
  combinations: BaziCrossBranchCombination[],
  coverage: BaziUsefulGodCoverage[],
  counterEvidenceFacts: BaziCompatibilityCounterEvidenceFact[],
  summaryFact: BaziCompatibilitySummaryFact,
  limitationFacts: BaziCompatibilityLimitationFact[],
): PromptEvidenceBundle {
  const dayBranchRelations = relations.filter(
    (item) => item.layer === '地支' && item.person1Pillar === 'day' && item.person2Pillar === 'day',
  );
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '八字双盘计算链',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['八字合盘', '计算链'],
    },
    {
      level: '主证',
      title: `双方日主为${dayMaster.person1Gan}${dayMaster.person1Wuxing}与${dayMaster.person2Gan}${dayMaster.person2Wuxing}`,
      detail: `${dayMaster.promptText}；边界：${dayMaster.limitation}`,
      source: dayMaster.sources.join('、'),
      tags: ['八字合盘', '日主关系', '双向十神'],
    },
    ...dayBranchRelations.map((relation): PromptEvidenceItem => ({
      level: '主证',
      title: `双方日支${relation.person1Value}${relation.type}${relation.person2Value}`,
      detail: `${relation.promptText}；日支关系可作为双方互动结构的重要盘面证据；边界：${relation.limitation}`,
      source: relation.sources.join('、'),
      tags: ['八字合盘', '日支', '夫妻宫', relation.type],
    })),
    ...relations
      .filter((item) => !dayBranchRelations.includes(item))
      .slice(0, 24)
      .map((relation): PromptEvidenceItem => ({
        level:
          relation.person1Pillar === 'day' || relation.person2Pillar === 'day' ? '主证' : '辅证',
        title: `${sourceLabel(people.person1, relation.person1Pillar)}${relation.person1Value}与${sourceLabel(people.person2, relation.person2Pillar)}${relation.person2Value}构成${relation.type}`,
        detail: `${relation.note ?? relation.promptText}；边界：${relation.limitation}`,
        source: relation.sources.join('、'),
        tags: ['八字合盘', '跨盘关系', relation.layer, relation.type],
      })),
    ...combinations.map((combination): PromptEvidenceItem => ({
      level: '辅证',
      title: `两盘共同构成${combination.name}${combination.type}`,
      detail: `${combination.members.map((member) => `${member.branch}来自${member.sources.map((source) => sourceLabel(source.person === 'person1' ? people.person1 : people.person2, source.pillar)).join('、')}`).join('；')}。${combination.note}；边界：${combination.limitation}`,
      source: combination.sources.join('、'),
      tags: ['八字合盘', combination.type, '组合候选'],
    })),
    ...coverage.flatMap((item): PromptEvidenceItem[] => {
      const beneficiary = people[item.beneficiary];
      const provider = people[item.provider];
      const evidenceItems: PromptEvidenceItem[] = [];
      if (item.favorable.length) {
        evidenceItems.push({
          level: '辅证',
          title: `${provider}盘面包含${beneficiary}的喜用五行`,
          detail:
            item.favorable
              .map(
                (entry) =>
                  `${entry.wuxing}（${entry.sources.map((source) => `${PILLAR_LABELS[source.pillar]}${source.layer}${source.value}`).join('、')}）`,
              )
              .join('；') +
            `；这里只确认盘面出现该五行，不比较伪精确强度，也不等同于必然互补；边界：${item.limitation}`,
          source: item.sources.join('、'),
          tags: ['八字合盘', '喜用覆盖'],
        });
      }
      if (item.unfavorable.length) {
        evidenceItems.push({
          level: '反证',
          title: `${provider}盘面也包含${beneficiary}的忌神五行`,
          detail:
            item.unfavorable
              .map(
                (entry) =>
                  `${entry.wuxing}（${entry.sources.map((source) => `${PILLAR_LABELS[source.pillar]}${source.layer}${source.value}`).join('、')}）`,
              )
              .join('；') +
            `；这里只确认盘面出现该五行，需结合双方原局结构判断实际影响；边界：${item.limitation}`,
          source: item.sources.join('、'),
          tags: ['八字合盘', '忌神覆盖'],
        });
      }
      return evidenceItems;
    }),
    ...counterEvidenceFacts
      .filter((item) => item.status !== '有可用证据')
      .map((item): PromptEvidenceItem => ({
        level: '反证',
        title: `${item.type}：${item.status}`,
        detail: `${item.promptText}；边界：${item.limitation}`,
        source: item.sources.join('、'),
        tags: ['八字合盘', '反证', item.type, item.status],
      })),
    {
      level: '辅证',
      title: `双盘证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['八字合盘', '证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '八字合盘证据边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['解释边界'],
    },
  ];
  return { title: '八字双盘结构化证据', items, emptyText: '当前两盘未发现已纳入规则的跨盘关系。' };
}

export function analyzeBaziCompatibility(
  chart1: BaziChartResult,
  chart2: BaziChartResult,
  options: BaziCompatibilityOptions = {},
): BaziCompatibilityEvidenceResult {
  if (!chart1?.pillars || !chart2?.pillars) throw new Error('八字合盘需要两份完整命盘。');
  assertPillars(chart1.pillars);
  assertPillars(chart2.pillars);
  const people = {
    person1: options.person1Name?.trim() || '第一人',
    person2: options.person2Name?.trim() || '第二人',
  };
  const person1Wuxing = asWuxing(chart1.dayMaster.gan);
  const person2Wuxing = asWuxing(chart2.dayMaster.gan);
  const dayMasterRelation: BaziDayMasterRelation = {
    key: 'bazi:compatibility:day-master-relation',
    status: '已计算',
    calculationStepKey: 'bazi:compatibility:calculation:day-master',
    person1Gan: chart1.dayMaster.gan,
    person1Wuxing,
    person2Gan: chart2.dayMaster.gan,
    person2Wuxing,
    person1ToPerson2: getElementRelation(person1Wuxing, person2Wuxing),
    person2ToPerson1: getElementRelation(person2Wuxing, person1Wuxing),
    person2GanAsPerson1TenGod: getTenGod(chart2.dayMaster.gan, chart1.dayMaster.gan),
    person1GanAsPerson2TenGod: getTenGod(chart1.dayMaster.gan, chart2.dayMaster.gan),
    promptText: `${people.person1}日主${chart1.dayMaster.gan}${person1Wuxing}对${people.person2}日主${chart2.dayMaster.gan}${person2Wuxing}为“${getElementRelation(person1Wuxing, person2Wuxing)}”，反向为“${getElementRelation(person2Wuxing, person1Wuxing)}”；对方日干分别映射为${getTenGod(chart2.dayMaster.gan, chart1.dayMaster.gan)}与${getTenGod(chart1.dayMaster.gan, chart2.dayMaster.gan)}`,
    sources: ['双方日干五行生克关系', '双方日干双向十神映射'],
    limitation: DAY_MASTER_LIMITATION,
  };
  const crossPillarRelations = calculateCrossRelations(chart1, chart2);
  const spousePalaceRelations = crossPillarRelations.filter(
    (item) => item.person1Pillar === 'day' && item.person2Pillar === 'day',
  );
  const crossBranchCombinations = calculateCombinations(chart1, chart2);
  const tenGodMappings = [
    ...calculateTenGodMappings('person1', 'person2', chart1, chart2),
    ...calculateTenGodMappings('person2', 'person1', chart2, chart1),
  ];
  const usefulGodCoverage = [
    calculateUsefulGodCoverage('person1', 'person2', chart1, chart2),
    calculateUsefulGodCoverage('person2', 'person1', chart2, chart1),
  ];
  const calculationSteps = buildBaseCalculationSteps({
    people,
    dayMasterRelation,
    relations: crossPillarRelations,
    combinations: crossBranchCombinations,
    tenGodMappings,
    coverage: usefulGodCoverage,
  });
  const counterEvidenceFacts = buildCounterEvidenceFacts({
    spousePalaceRelations,
    combinations: crossBranchCombinations,
    coverage: usefulGodCoverage,
  });
  const summaryFact = buildSummaryFact({
    dayMasterRelation,
    relations: crossPillarRelations,
    spousePalaceRelations,
    combinations: crossBranchCombinations,
    tenGodMappings,
    coverage: usefulGodCoverage,
  });
  calculationSteps.push({
    key: 'bazi:compatibility:calculation:summary',
    stage: '证据汇总',
    status: '已计算',
    inputs: { factCount: summaryFact.factKeys.length },
    result: {
      status: summaryFact.status,
      crossPillarRelationCount: summaryFact.crossPillarRelationCount,
      spousePalaceRelationCount: summaryFact.spousePalaceRelationCount,
      crossBranchCombinationCount: summaryFact.crossBranchCombinationCount,
      favorableCoverageCount: summaryFact.favorableCoverageCount,
      unfavorableCoverageCount: summaryFact.unfavorableCoverageCount,
      unavailableCoverageCount: summaryFact.unavailableCoverageCount,
    },
    dependsOnStepKeys: [
      'bazi:compatibility:calculation:day-master',
      'bazi:compatibility:calculation:cross-pillars',
      'bazi:compatibility:calculation:branch-combinations',
      'bazi:compatibility:calculation:ten-god-mappings',
      'bazi:compatibility:calculation:useful-god-coverage',
    ],
    promptText: summaryFact.promptText,
    sources: summaryFact.sources,
    limitation: CALCULATION_STEP_LIMITATION,
  });
  const limitationFacts = buildLimitationFacts({
    dayMasterRelation,
    relations: crossPillarRelations,
    combinations: crossBranchCombinations,
    tenGodMappings,
    coverage: usefulGodCoverage,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据')
    .map((item) => item.promptText);
  const evidence = createEvidence(
    people,
    calculationSteps,
    dayMasterRelation,
    crossPillarRelations,
    crossBranchCombinations,
    usefulGodCoverage,
    counterEvidenceFacts,
    summaryFact,
    limitationFacts,
  );
  return {
    key: 'bazi:compatibility:evidence',
    status: summaryFact.status === '证据完整' ? '已计算' : '存在资料缺口',
    people,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    dayMasterRelation,
    spousePalaceRelations,
    crossPillarRelations,
    crossBranchCombinations,
    tenGodMappings,
    usefulGodCoverage,
    counterEvidence,
    counterEvidenceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText: [
      '【八字双盘结构化证据】',
      ...formatPromptEvidenceBundle(evidence),
      `计算链概览：${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `反证与缺口：${counterEvidence.length ? counterEvidence.join('；') : '当前未见需要单列的资料缺口；仍不得据命中数量生成匹配结论'}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: {
      notes: [
        '逐项比较双方年、月、日、时四柱，记录天干五合与冲、地支同支及合冲刑害破。',
        '三合、三会仅在三个成员齐备且来源跨越双方时记录，不直接判定成局或合化。',
        '双向十神按各自日干分别映射对方四柱天干及地支本气。',
        '喜忌覆盖沿用受益方命盘已有喜忌五行，并逐柱核验提供方天干、地支与藏干的五行来源；只记录是否出现，不另造权重、强度或匹配总分。',
      ],
    },
  };
}
