import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { TaiSuiConflict, ZodiacYearFortune } from './index';
import {
  EARTHLY_BRANCHES,
  ZODIACS,
  getBranchWuxing,
  getStemWuxing,
  isKe,
  isLiuhe,
  isSheng,
  isValidGanZhi,
} from '../ganzhi';
import { getTaiSuiConflicts } from './index';
import { getGanZhiRelationTables } from '../ganzhi/relations';

const GANZHI_RELATION_TABLES = getGanZhiRelationTables();

export interface ZodiacRelationEvidence {
  key: string;
  status: '已命中' | '两支同组';
  category: '流年同支' | '地支冲突' | '地支助缘' | '地支成员' | '年干五行';
  relation: string;
  source: string;
  sources: string[];
  role: '主证' | '辅证';
  detail: string;
  operands: Array<{ label: string; value: string; wuxing?: string }>;
  rule: string;
  promptText: string;
  limitation: '生肖年支与流年干支关系只证明传统关系表或五行生克条件命中；不证明现实事件、个人命运、他人行为、吉凶概率、固定应期或化解效果';
}

export interface ZodiacCalculationStep {
  key: string;
  stage: '生肖年支' | '流年拆分' | '地支关系核验' | '年干五行辅助';
  status: '已计算';
  inputs: Record<string, string | number>;
  result: Record<string, string | number>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '生肖计算链只证明生肖、流年干支、固定地支关系与五行辅助关系如何形成当前轻量结果，不证明个人现实事件、完整命理结构、吉凶概率、固定应期或化解效果';
}

export interface ZodiacCounterEvidenceFact {
  key: string;
  type: '太岁关系覆盖' | '三合六合三会覆盖' | '生肖信息量';
  status: '有可用证据' | '未命中' | '固有限制';
  ownerRelationKeys: string[];
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录值、冲、刑、害、破、六合、三合、三会是否命中以及生肖模型固有的信息量限制；未命中不代表现实有利或不利，命中也不证明事件结果';
}

export interface ZodiacCounterSummaryFact {
  key: 'zodiac:counter-summary';
  status: '有未命中关系' | '关系均有命中';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明传统关系表的命中覆盖情况；不得据命中数量生成吉凶总分、成功率、灾祸概率、固定应期或化解效果';
}

export interface ZodiacLimitationFact {
  key: string;
  type: '信息量边界' | '关系表边界' | '五行辅助边界' | '高风险输出边界' | '现实建议边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束生肖年支、流年干支关系和五行辅助可以支持的解释范围，不得被反向当作个人事件、吉凶概率或化解有效性的证据';
}

export interface ZodiacEvidenceAnalysis {
  key: 'zodiac:evidence';
  status: '已计算';
  calculationSteps: ZodiacCalculationStep[];
  calculationChain: string[];
  relations: ZodiacRelationEvidence[];
  primaryEvidence: ZodiacRelationEvidence[];
  supportingEvidence: ZodiacRelationEvidence[];
  counterEvidence: string[];
  counterEvidenceFacts: ZodiacCounterEvidenceFact[];
  counterSummaryFact: ZodiacCounterSummaryFact;
  limitations: string[];
  limitationFacts: ZodiacLimitationFact[];
  summaryFact: ZodiacSummaryFact;
  sources: Array<{ title: string; evidence: string; role: '传统关系表' | '公共算法' }>;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

export interface ZodiacSummaryFact {
  key: 'zodiac:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  relationFactCount: number;
  primaryEvidenceCount: number;
  supportingEvidenceCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '生肖证据汇总只统计生肖年支、流年干支、关系表、五行辅助、反证与限制覆盖；不得按数量生成个人吉凶等级、成功率、灾祸概率、固定应期或化解效果保证';
}

const RELATION_FACT_LIMITATION =
  '生肖年支与流年干支关系只证明传统关系表或五行生克条件命中；不证明现实事件、个人命运、他人行为、吉凶概率、固定应期或化解效果' as const;
const CALCULATION_STEP_LIMITATION =
  '生肖计算链只证明生肖、流年干支、固定地支关系与五行辅助关系如何形成当前轻量结果，不证明个人现实事件、完整命理结构、吉凶概率、固定应期或化解效果' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录值、冲、刑、害、破、六合、三合、三会是否命中以及生肖模型固有的信息量限制；未命中不代表现实有利或不利，命中也不证明事件结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明传统关系表的命中覆盖情况；不得据命中数量生成吉凶总分、成功率、灾祸概率、固定应期或化解效果' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束生肖年支、流年干支关系和五行辅助可以支持的解释范围，不得被反向当作个人事件、吉凶概率或化解有效性的证据' as const;
const SUMMARY_FACT_LIMITATION =
  '生肖证据汇总只统计生肖年支、流年干支、关系表、五行辅助、反证与限制覆盖；不得按数量生成个人吉凶等级、成功率、灾祸概率、固定应期或化解效果保证' as const;

function sameTextList(actual: string[], expected: string[]) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => typeof value === 'string' && value === expected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameConflictList(actual: unknown, expected: TaiSuiConflict[]): boolean {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((conflict, index) => {
      const incoming = actual[index];
      return (
        isRecord(incoming) &&
        incoming.type === conflict.type &&
        incoming.with === conflict.with &&
        incoming.desc === conflict.desc
      );
    })
  );
}

function hasExactKeyCoverage(items: Array<{ key: string }>, expectedKeys: string[]): boolean {
  const actualKeys = items.map((item) => item.key);
  const actual = new Set(actualKeys);
  const expected = new Set(expectedKeys);
  return (
    actual.size === actualKeys.length &&
    expected.size === expectedKeys.length &&
    actual.size === expected.size &&
    [...expected].every((key) => actual.has(key))
  );
}

const REQUIRED_CALCULATION_STEP_KEYS = [
  'zodiac:calculation:branch',
  'zodiac:calculation:year',
  'zodiac:calculation:branch-relations',
  'zodiac:calculation:stem-element',
];
const REQUIRED_COUNTER_EVIDENCE_KEYS = [
  'zodiac:counter:tai-sui-relations',
  'zodiac:counter:noble-relations',
  'zodiac:counter:information-scope',
];
const REQUIRED_LIMITATION_FACT_KEYS = [
  'zodiac:limitation:information-scope',
  'zodiac:limitation:relation-tables',
  'zodiac:limitation:stem-element',
  'zodiac:limitation:high-risk-output',
  'zodiac:limitation:reality-check',
];

function conflictEvidence(conflict: TaiSuiConflict, zodiacBranch: string): ZodiacRelationEvidence {
  const rule =
    conflict.type === '值太岁'
      ? '两支相同'
      : `十二地支${conflict.type.replace('太岁', '')}固定关系表命中`;
  return {
    key: `关系:${conflict.type}:${zodiacBranch}:${conflict.with}`,
    status: '已命中',
    category: conflict.type === '值太岁' ? '流年同支' : '地支冲突',
    relation: conflict.type,
    source: '生肖年支与流年年支的同支、六冲、相刑、六害、六破关系',
    sources: ['十二地支同支、六冲、相刑、六害与六破固定关系表', '干支关系公共规则'],
    role: '主证',
    detail: conflict.desc,
    operands: [
      { label: '生肖年支', value: zodiacBranch, wuxing: getBranchWuxing(zodiacBranch) },
      { label: '流年年支', value: conflict.with, wuxing: getBranchWuxing(conflict.with) },
    ],
    rule,
    promptText: `生肖年支${zodiacBranch}与流年年支${conflict.with}逐项核验，按“${rule}”命中${conflict.type}传统关系分类`,
    limitation: RELATION_FACT_LIMITATION,
  };
}

function buildCounterEvidenceFacts(
  relations: ZodiacRelationEvidence[],
): ZodiacCounterEvidenceFact[] {
  const conflictRelations = relations.filter(
    (relation) => relation.category === '流年同支' || relation.category === '地支冲突',
  );
  const harmonyRelations = relations.filter(
    (relation) => relation.category === '地支助缘' || relation.category === '地支成员',
  );
  return [
    {
      key: 'zodiac:counter:tai-sui-relations',
      type: '太岁关系覆盖',
      status: conflictRelations.length ? '有可用证据' : '未命中',
      ownerRelationKeys: conflictRelations.map((relation) => relation.key),
      ownerFactKeys: conflictRelations.length
        ? conflictRelations.map((relation) => relation.key)
        : ['zodiac:calculation:branch-relations'],
      promptText: conflictRelations.length
        ? `命中${conflictRelations.length}项值、冲、刑、害或破关系，并保留逐项关系事实`
        : '本年未命中值、冲、刑、害、破关系，不应为了形成结论而补造“犯太岁”',
      sources: ['生肖年支与流年年支的同支、六冲、相刑、六害和六破逐项核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'zodiac:counter:noble-relations',
      type: '三合六合三会覆盖',
      status: harmonyRelations.length ? '有可用证据' : '未命中',
      ownerRelationKeys: harmonyRelations.map((relation) => relation.key),
      ownerFactKeys: harmonyRelations.length
        ? harmonyRelations.map((relation) => relation.key)
        : ['zodiac:calculation:branch-relations'],
      promptText: harmonyRelations.length
        ? `核验到${harmonyRelations.length}项六合关系、三合成员关系或三会成员关系，并保留逐项参与地支`
        : '本年未命中六合、三合或三会关系，不补造生肖贵人或会合关系',
      sources: ['生肖年支与流年年支的六合关系、三合组成员和三会组成员逐项核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'zodiac:counter:information-scope',
      type: '生肖信息量',
      status: '固有限制',
      ownerRelationKeys: relations.map((relation) => relation.key),
      ownerFactKeys: ['zodiac:calculation:branch', ...relations.map((relation) => relation.key)],
      promptText: '生肖只取出生年支，同生肖者仍可能因出生月、日、时和现实条件不同而表现完全不同',
      sources: ['生肖模型只使用出生年支的输入范围'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
}

function buildCounterSummaryFact(
  counterEvidenceFacts: ZodiacCounterEvidenceFact[],
): ZodiacCounterSummaryFact {
  const unmatched = counterEvidenceFacts.filter((fact) => fact.status === '未命中');
  return {
    key: 'zodiac:counter-summary',
    status: unmatched.length ? '有未命中关系' : '关系均有命中',
    factKeys: unmatched.map((fact) => fact.key),
    promptText: unmatched.length
      ? `未命中${unmatched.map((fact) => fact.type).join('、')}；未命中不代表现实有利或不利，只按已有关系事实解释`
      : '值冲刑害破与六合、三合成员、三会成员关系均已逐项核验；按各关系的参与地支分别列示',
    sources: ['太岁关系覆盖与三合六合三会覆盖逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(
  calculationSteps: ZodiacCalculationStep[],
  relations: ZodiacRelationEvidence[],
): ZodiacLimitationFact[] {
  const definitions: Array<
    Pick<ZodiacLimitationFact, 'key' | 'type' | 'promptText' | 'ownerFactKeys' | 'sources'>
  > = [
    {
      key: 'zodiac:limitation:information-scope',
      type: '信息量边界',
      promptText: '生肖流年只使用一个出生年支，信息量远低于完整四柱，不得替代八字或现实资料',
      ownerFactKeys: ['zodiac:calculation:branch', ...relations.map((relation) => relation.key)],
      sources: ['生肖模型输入范围与完整四柱信息范围对照'],
    },
    {
      key: 'zodiac:limitation:relation-tables',
      type: '关系表边界',
      promptText:
        '值、冲、刑、害、破、三合、六合和三会是传统关系分类，不是现代统计概率或事件因果证明',
      ownerFactKeys: [
        'zodiac:calculation:branch-relations',
        ...relations
          .filter((relation) => relation.category !== '年干五行')
          .map((relation) => relation.key),
      ],
      sources: ['十二地支固定关系表'],
    },
    {
      key: 'zodiac:limitation:stem-element',
      type: '五行辅助边界',
      promptText: '年干与生肖地支的五行关系不是严格的个人十神关系，不得直接套用个人十神结论',
      ownerFactKeys: [
        'zodiac:calculation:stem-element',
        ...relations
          .filter((relation) => relation.category === '年干五行')
          .map((relation) => relation.key),
      ],
      sources: ['流年年干与生肖年支本气五行辅助关系'],
    },
    {
      key: 'zodiac:limitation:high-risk-output',
      type: '高风险输出边界',
      promptText: '不得输出吉凶总分、成功率、灾祸概率、固定应期或保证有效的化解方案',
      ownerFactKeys: [
        ...calculationSteps.map((step) => step.key),
        ...relations.map((relation) => relation.key),
      ],
      sources: ['传统关系事实与现实结果分离原则'],
    },
    {
      key: 'zodiac:limitation:reality-check',
      type: '现实建议边界',
      promptText:
        '现实建议必须落到合同、健康、出行、财务和沟通等可核验条件，不得仅凭“犯太岁”制造恐惧',
      ownerFactKeys: relations.map((relation) => relation.key),
      sources: ['现实建议可核验性要求'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function buildSummaryFact(args: {
  calculationSteps: ZodiacCalculationStep[];
  relations: ZodiacRelationEvidence[];
  expectedRelationKeys: string[];
  primaryEvidence: ZodiacRelationEvidence[];
  supportingEvidence: ZodiacRelationEvidence[];
  counterEvidenceFacts: ZodiacCounterEvidenceFact[];
  counterSummaryFact: ZodiacCounterSummaryFact;
  limitationFacts: ZodiacLimitationFact[];
  /** 轻量关系复验的差异说明；null 表示复验一致 */
  consistencyGap: string | null;
}): ZodiacSummaryFact {
  const status =
    hasExactKeyCoverage(args.calculationSteps, REQUIRED_CALCULATION_STEP_KEYS) &&
    hasExactKeyCoverage(args.relations, args.expectedRelationKeys) &&
    hasExactKeyCoverage(args.counterEvidenceFacts, REQUIRED_COUNTER_EVIDENCE_KEYS) &&
    hasExactKeyCoverage(args.limitationFacts, REQUIRED_LIMITATION_FACT_KEYS) &&
    !args.consistencyGap
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'zodiac:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        ...args.calculationSteps.map((item) => item.key),
        ...args.relations.map((item) => item.key),
        ...args.counterEvidenceFacts.map((item) => item.key),
        args.counterSummaryFact.key,
        ...args.limitationFacts.map((item) => item.key),
      ]),
    ),
    relationFactCount: args.relations.length,
    primaryEvidenceCount: args.primaryEvidence.length,
    supportingEvidenceCount: args.supportingEvidence.length,
    counterEvidenceCount: args.counterEvidenceFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `证据链状态：${status}（仅表示证据包装字段覆盖与轻量关系复验，不构成对上游计算的独立复算）；关系事实${args.relations.length}项、主证${args.primaryEvidence.length}项、辅证${args.supportingEvidence.length}项、反证${args.counterEvidenceFacts.length}项、限制${args.limitationFacts.length}项${
      args.consistencyGap ? `；关系复验差异：${args.consistencyGap}` : ''
    }`,
    sources: ['生肖年支、流年干支、关系表、五行辅助、反证与限制事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

export function analyzeZodiacEvidence(
  data: Omit<ZodiacYearFortune, 'evidenceAnalysis' | 'prompt'>,
): ZodiacEvidenceAnalysis {
  const zodiacIndex = EARTHLY_BRANCHES.indexOf(
    data.zodiacBranch as (typeof EARTHLY_BRANCHES)[number],
  );
  if (zodiacIndex < 0) throw new TypeError(`生肖地支无效：${data.zodiacBranch}`);
  if (!isValidGanZhi(data.yearGanZhi)) {
    throw new TypeError(`流年干支无效：${data.yearGanZhi}`);
  }

  const normalizedZodiac = ZODIACS[zodiacIndex];
  const normalizedYearBranch = data.yearGanZhi[1];
  const recomputedConflicts = getTaiSuiConflicts(data.zodiacBranch, normalizedYearBranch);
  const sanhe = GANZHI_RELATION_TABLES.BRANCH_SANHE[data.zodiacBranch];
  const expectedNoble = isLiuhe(data.zodiacBranch, normalizedYearBranch)
    ? '六合贵人'
    : sanhe?.partners.includes(normalizedYearBranch)
      ? `三合组成员关系（${sanhe.group}）`
      : null;
  const hasSanheMemberRelation = expectedNoble?.startsWith('三合组成员关系') ?? false;
  const sanhuiGroup = Object.entries(GANZHI_RELATION_TABLES.SANHUI_GROUPS).find(
    ([, members]) =>
      members.includes(data.zodiacBranch) &&
      members.includes(normalizedYearBranch) &&
      data.zodiacBranch !== normalizedYearBranch,
  );
  const expectedMeeting = sanhuiGroup ? `三会组成员关系（${sanhuiGroup[0]}）` : null;
  const yearStemWuxing = getStemWuxing(data.yearGanZhi[0]);
  const zodiacWuxing = getBranchWuxing(data.zodiacBranch);
  const expectedElementRelation = isSheng(yearStemWuxing, zodiacWuxing)
    ? { kind: '年干生生肖', label: '年干五行生生肖地支本气', classification: '有利关系' }
    : isSheng(zodiacWuxing, yearStemWuxing)
      ? { kind: '生肖生年干', label: '生肖地支本气生年干五行', classification: '风险关系' }
      : isKe(yearStemWuxing, zodiacWuxing)
        ? { kind: '年干克生肖', label: '年干五行克生肖地支本气', classification: '风险关系' }
        : isKe(zodiacWuxing, yearStemWuxing)
          ? { kind: '生肖克年干', label: '生肖地支本气克年干五行', classification: '中性关系' }
          : { kind: '同类', label: '年干五行与生肖地支本气同类', classification: '中性关系' };
  const expectedFavorableRelations = [
    expectedNoble && !hasSanheMemberRelation ? expectedNoble : '',
    expectedElementRelation.classification === '有利关系' ? expectedElementRelation.label : '',
  ].filter(Boolean);
  const expectedRiskRelations = [
    ...recomputedConflicts.map((conflict) => `${conflict.type}：${conflict.desc}`),
    expectedElementRelation.classification === '风险关系' ? expectedElementRelation.label : '',
  ].filter(Boolean);
  const expectedActionSignals = [
    recomputedConflicts.some((item) => item.type === '冲太岁') ? '涉及变动时预留备选方案' : '',
    recomputedConflicts.some((item) => item.type === '值太岁') ? '作重要决定时核对现实条件' : '',
    recomputedConflicts.some((item) => item.type === '刑太岁')
      ? '涉及合同、规则或沟通时明确约定并留存记录'
      : '',
    expectedNoble && !hasSanheMemberRelation ? '出现合作或求助机会时核对具体条件与对方可靠性' : '',
  ].filter(Boolean);
  const incomingConflicts: unknown = data.conflicts;
  const incomingElementRelation: unknown = data.elementRelation;
  const hasDefinedInput = (key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) &&
    (data as unknown as Record<string, unknown>)[key] !== undefined;
  const missingRelationInputs = [
    !Array.isArray(incomingConflicts) ? '犯太岁关系' : '',
    !hasDefinedInput('noble') ? '六合、三合与贵人关系' : '',
    !hasDefinedInput('meeting') ? '三会关系' : '',
    !Array.isArray(data.favorableRelations) ? '有利关系列表' : '',
    !Array.isArray(data.riskRelations) ? '风险关系列表' : '',
    !Array.isArray(data.actionSignals) ? '行动提示列表' : '',
    !isRecord(incomingElementRelation) || typeof data.relation !== 'string'
      ? '年干五行辅助关系'
      : '',
  ].filter(Boolean);
  const conflictsConsistent = sameConflictList(incomingConflicts, recomputedConflicts);
  const elementConsistent =
    isRecord(incomingElementRelation) &&
    incomingElementRelation.kind === expectedElementRelation.kind &&
    incomingElementRelation.label === expectedElementRelation.label &&
    incomingElementRelation.classification === expectedElementRelation.classification &&
    incomingElementRelation.yearStemWuxing === yearStemWuxing &&
    incomingElementRelation.zodiacWuxing === zodiacWuxing &&
    data.relation === expectedElementRelation.label;
  let consistencyGap: string | null = null;
  if (missingRelationInputs.length) {
    consistencyGap = `关系输入资料缺失或格式无效（${missingRelationInputs.join('、')}），不能按“未命中”处理`;
  } else if (normalizedZodiac !== data.zodiac) {
    consistencyGap = '生肖名称与出生年支不一致';
  } else if (data.yearBranch !== normalizedYearBranch) {
    consistencyGap = '流年干支与流年年支不一致';
  } else if (!elementConsistent) {
    consistencyGap = '年干与生肖五行关系重算结果与传入资料不一致';
  } else if (!conflictsConsistent) {
    consistencyGap = '犯太岁关系重算结果与传入资料不一致';
  } else if (data.noble !== expectedNoble) {
    consistencyGap = '六合及三合成员关系重算结果与传入资料不一致';
  } else if (data.meeting !== expectedMeeting) {
    consistencyGap = '三会组成员关系重算结果与传入资料不一致';
  } else if (!sameTextList(data.favorableRelations, expectedFavorableRelations)) {
    consistencyGap = '有利关系列表重算结果与传入资料不一致';
  } else if (!sameTextList(data.riskRelations, expectedRiskRelations)) {
    consistencyGap = '风险关系列表重算结果与传入资料不一致';
  } else if (!sameTextList(data.actionSignals, expectedActionSignals)) {
    consistencyGap = '行动提示重算结果与传入资料不一致';
  }

  const relations: ZodiacRelationEvidence[] = [
    ...recomputedConflicts.map((conflict) => conflictEvidence(conflict, data.zodiacBranch)),
    ...(expectedNoble
      ? [
          {
            key: `关系:${expectedNoble}:${data.zodiacBranch}:${normalizedYearBranch}`,
            status: hasSanheMemberRelation ? ('两支同组' as const) : ('已命中' as const),
            category: hasSanheMemberRelation ? ('地支成员' as const) : ('地支助缘' as const),
            relation: expectedNoble,
            source: hasSanheMemberRelation
              ? '生肖年支与流年年支同属一个三合组的成员关系'
              : '生肖年支与流年年支的六合关系',
            sources: ['十二地支六合与三合固定关系表', '干支关系公共规则'],
            role: '辅证' as const,
            detail: hasSanheMemberRelation
              ? `生肖年支${data.zodiacBranch}与流年年支${normalizedYearBranch}同属${sanhe!.group}，当前可核验两支；另一成员${sanhe!.partners.find((branch) => branch !== normalizedYearBranch)}需结合完整四柱核验三支齐备及成化条件。`
              : '只表示传统关系表中的六合条件。',
            operands: [
              {
                label: '生肖年支',
                value: data.zodiacBranch,
                wuxing: getBranchWuxing(data.zodiacBranch),
              },
              {
                label: '流年年支',
                value: normalizedYearBranch,
                wuxing: getBranchWuxing(normalizedYearBranch),
              },
            ],
            rule: hasSanheMemberRelation
              ? '十二地支三合组成员关系；当前两支同组'
              : '十二地支六合表命中',
            promptText: hasSanheMemberRelation
              ? `生肖年支${data.zodiacBranch}与流年年支${normalizedYearBranch}逐项核验，同属${sanhe!.group}三合组，当前可见两支；另一成员${sanhe!.partners.find((branch) => branch !== normalizedYearBranch)}需结合完整四柱核验三支齐备及成化条件`
              : `生肖年支${data.zodiacBranch}与流年年支${normalizedYearBranch}逐项核验，按“十二地支六合表命中”得到${expectedNoble}传统关系分类`,
            limitation: RELATION_FACT_LIMITATION,
          },
        ]
      : []),
    ...(expectedMeeting
      ? [
          {
            key: `关系:${expectedMeeting}:${data.zodiacBranch}:${normalizedYearBranch}`,
            status: '两支同组' as const,
            category: '地支成员' as const,
            relation: expectedMeeting,
            source: '生肖年支与流年年支同属一个三会组的成员关系',
            sources: ['十二地支三会固定关系表', '干支关系公共规则'],
            role: '辅证' as const,
            detail: `生肖年支${data.zodiacBranch}与流年年支${normalizedYearBranch}同属${sanhuiGroup![0]}三会组，当前可核验两支；另一成员${sanhuiGroup![1].find((branch) => branch !== data.zodiacBranch && branch !== normalizedYearBranch)}需结合完整四柱核验三支齐备及成化条件。`,
            operands: [
              {
                label: '生肖年支',
                value: data.zodiacBranch,
                wuxing: getBranchWuxing(data.zodiacBranch),
              },
              {
                label: '流年年支',
                value: normalizedYearBranch,
                wuxing: getBranchWuxing(normalizedYearBranch),
              },
            ],
            rule: '十二地支三会组成员关系；当前两支同组',
            promptText: `生肖年支${data.zodiacBranch}与流年年支${normalizedYearBranch}逐项核验，同属${sanhuiGroup![0]}三会组，当前可见两支；另一成员${sanhuiGroup![1].find((branch) => branch !== data.zodiacBranch && branch !== normalizedYearBranch)}需结合完整四柱核验三支齐备及成化条件`,
            limitation: RELATION_FACT_LIMITATION,
          },
        ]
      : []),
    {
      key: `关系:年干五行:${data.yearGanZhi[0]}:${data.zodiacBranch}`,
      status: '已命中',
      category: '年干五行',
      relation: expectedElementRelation.label,
      source: '流年天干五行与生肖地支本气五行的生克关系',
      sources: ['天干五行与地支本气五行映射表', '五行生克公共规则'],
      role: '辅证',
      detail: '年干五行只作生肖层补充，不等同完整八字十神。',
      operands: [
        { label: '流年年干', value: data.yearGanZhi[0], wuxing: getStemWuxing(data.yearGanZhi[0]) },
        {
          label: '生肖年支本气',
          value: data.zodiacBranch,
          wuxing: getBranchWuxing(data.zodiacBranch),
        },
      ],
      rule: `五行同类、生克方向逐项判断；结构化类型为${expectedElementRelation.kind}，分类为${expectedElementRelation.classification}`,
      promptText: `流年年干${data.yearGanZhi[0]}属${yearStemWuxing}，生肖年支${data.zodiacBranch}本气属${zodiacWuxing}；按五行同类与生克方向逐项判断为“${expectedElementRelation.label}”，结构化类型为${expectedElementRelation.kind}`,
      limitation: RELATION_FACT_LIMITATION,
    },
  ];
  const primaryEvidence = relations.filter((item) => item.role === '主证');
  const supportingEvidence = relations.filter((item) => item.role === '辅证');
  const calculationSteps: ZodiacCalculationStep[] = [
    {
      key: 'zodiac:calculation:branch',
      stage: '生肖年支',
      status: '已计算',
      inputs: { zodiac: data.zodiac },
      result: { zodiacBranch: data.zodiacBranch },
      dependsOnStepKeys: [],
      promptText: `出生年支${data.zodiacBranch}对应生肖${normalizedZodiac}`,
      sources: ['十二生肖与十二地支固定映射', '生肖地支公共数据'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'zodiac:calculation:year',
      stage: '流年拆分',
      status: '已计算',
      inputs: { yearGanZhi: data.yearGanZhi },
      result: { yearStem: data.yearGanZhi[0], yearBranch: normalizedYearBranch },
      dependsOnStepKeys: [],
      promptText: `流年${data.yearGanZhi}拆分为年干${data.yearGanZhi[0]}与年支${normalizedYearBranch}`,
      sources: ['六十甲子干支结构', '干支合法性与拆分规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'zodiac:calculation:branch-relations',
      stage: '地支关系核验',
      status: '已计算',
      inputs: {
        zodiacBranch: data.zodiacBranch,
        yearBranch: normalizedYearBranch,
        incomingYearBranch: data.yearBranch,
      },
      result: {
        conflictCount: recomputedConflicts.length,
        nobleRelation: expectedNoble ?? '未命中',
        meetingRelation: expectedMeeting ?? '未命中',
      },
      dependsOnStepKeys: ['zodiac:calculation:branch', 'zodiac:calculation:year'],
      promptText: `生肖年支${data.zodiacBranch}与由流年干支拆分的年支${normalizedYearBranch}逐项核验同支、六冲、相刑、六害、六破、六合、三合与三会`,
      sources: ['十二地支固定关系表', '干支关系公共规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'zodiac:calculation:stem-element',
      stage: '年干五行辅助',
      status: '已计算',
      inputs: {
        yearStem: data.yearGanZhi[0],
        zodiacBranch: data.zodiacBranch,
      },
      result: {
        yearStemWuxing,
        zodiacBranchWuxing: zodiacWuxing,
        relation: expectedElementRelation.label,
        relationKind: expectedElementRelation.kind,
        relationClassification: expectedElementRelation.classification,
      },
      dependsOnStepKeys: ['zodiac:calculation:branch', 'zodiac:calculation:year'],
      promptText: `流年年干${data.yearGanZhi[0]}五行与生肖年支${data.zodiacBranch}本气五行单独作为辅助关系；复算分类为${expectedElementRelation.kind}`,
      sources: ['天干五行与地支本气五行映射', '五行生克公共规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  const counterEvidenceFacts = buildCounterEvidenceFacts(relations);
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts
    .filter((fact) => fact.status !== '有可用证据')
    .map((fact) => fact.promptText);
  const limitationFacts = buildLimitationFacts(calculationSteps, relations);
  const limitations = limitationFacts.map((fact) => fact.promptText);
  const expectedRelationKeys = [
    ...recomputedConflicts.map(
      (conflict) => `关系:${conflict.type}:${data.zodiacBranch}:${conflict.with}`,
    ),
    ...(expectedNoble
      ? [`关系:${expectedNoble}:${data.zodiacBranch}:${normalizedYearBranch}`]
      : []),
    ...(expectedMeeting
      ? [`关系:${expectedMeeting}:${data.zodiacBranch}:${normalizedYearBranch}`]
      : []),
    `关系:年干五行:${data.yearGanZhi[0]}:${data.zodiacBranch}`,
  ];
  const summaryFact = buildSummaryFact({
    calculationSteps,
    relations,
    expectedRelationKeys,
    primaryEvidence,
    supportingEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitationFacts,
    consistencyGap,
  });
  const sources: ZodiacEvidenceAnalysis['sources'] = [
    {
      title: '十二地支关系表',
      evidence: '同支、六冲、相刑、六害、六破、六合、三合与三会的固定关系',
      role: '传统关系表',
    },
    {
      title: '干支与五行公共规则',
      evidence: '六十甲子合法性、天干地支五行及地支关系函数',
      role: '公共算法',
    },
  ];
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '生肖流年输入与计算链事实',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', normalizedZodiac, data.yearGanZhi],
    },
    ...primaryEvidence.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: item.relation,
      detail: `${item.promptText}；现实复核提示：${item.detail}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.operands.map((operand) => `${operand.label}${operand.value}${operand.wuxing ? `属${operand.wuxing}` : ''}`).join('与')}；规则${item.rule}`,
      tags: [item.category, item.relation],
    })),
    ...supportingEvidence.map((item): PromptEvidenceItem => ({
      level: '辅证',
      title: item.relation,
      detail: `${item.promptText}；现实复核提示：${item.detail}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.operands.map((operand) => `${operand.label}${operand.value}${operand.wuxing ? `属${operand.wuxing}` : ''}`).join('与')}；规则${item.rule}`,
      tags: [item.category, item.relation],
    })),
    ...counterEvidenceFacts
      .filter((fact) => fact.status !== '有可用证据')
      .map((fact): PromptEvidenceItem => ({
        level: '反证',
        title: '生肖层证据缺口',
        detail: `${fact.promptText}；边界：${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: ['反证', fact.type, fact.status],
      })),
    {
      level: '反证',
      title: `关系覆盖汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: summaryFact.status === '证据链完整' ? '辅证' : '反证',
      title: `生肖证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '生肖流年信息量与解释边界',
      detail: `${limitationFacts.map((fact) => fact.promptText).join('；')}；边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((fact) => fact.sources))).join('、'),
      tags: ['轻量模型', '现实复核'],
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '生肖流年关系矩阵结构化证据', items };
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const promptText = [
    '【生肖流年关系矩阵结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `有利关系：${expectedFavorableRelations.join('；') || '暂未列符合有利分类的六合或年干辅助关系'}。`,
    `风险关系：${expectedRiskRelations.join('；') || '未命中值、冲、刑、害、破关系'}。`,
    `反证限制：${counterSummaryFact.promptText}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    key: 'zodiac:evidence',
    status: '已计算',
    calculationSteps,
    calculationChain,
    relations,
    primaryEvidence,
    supportingEvidence,
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    sources,
    evidence,
    promptText,
    methodology: [
      '先只计算生肖年支与流年年支的固定关系，不混入完整八字结论。',
      '冲突关系作为主证，三合、六合、三会与年干五行作为辅证，未命中关系保留反证。',
      '所有传统关系只转换为可观察条件和稳妥行动，不转换为分数、概率或必然事件。',
    ],
  };
}
