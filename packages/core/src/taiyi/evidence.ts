import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { TaiyiModelInfo, TaiyiScope } from '../types/divination';

export interface TaiyiEvidenceInput {
  scope: TaiyiScope;
  dateTime: string;
  ganZhi: string;
  accumulatedLabel: '积年' | '积月' | '积日' | '积时';
  accumulatedValue: number;
  entryYears: number;
  yuan: number;
  ji: number;
  yinYang: '阳遁' | '阴遁';
  bureau: number;
  taiyiPosition: string;
  taiyiPalace: number;
  wenChangPosition: string;
  wenChangPalace: number;
  shiJiPosition: string;
  shiJiPalace: number;
  jiShenPosition: string;
  jiShenPalace: number;
  lordCount: number;
  guestCount: number;
  setCount: number;
  countNatures?: {
    lord?: string;
    guest?: string;
    set?: string;
  };
  lordGeneral: number;
  lordAssistant: number;
  guestGeneral: number;
  guestAssistant: number;
  setGeneral: number;
  setAssistant: number;
  sixteenGods: { branch: string; god: string }[];
  model: TaiyiModelInfo;
}

export interface TaiyiEvidenceAnalysis {
  key: 'taiyi:evidence';
  status: '已计算';
  calculationChain: string[];
  calculationSteps: TaiyiCalculationStep[];
  positionFacts: TaiyiPositionFact[];
  forceFacts: TaiyiForceFact[];
  sixteenGodFacts: TaiyiSixteenGodFact[];
  conditionFacts: TaiyiConditionFact[];
  primaryFacts: string[];
  supportingFacts: string[];
  counterEvidence: string[];
  counterEvidenceFacts: TaiyiCounterEvidenceFact[];
  counterSummaryFact: TaiyiCounterSummaryFact;
  limitations: string[];
  limitationFacts: TaiyiLimitationFact[];
  summaryFact: TaiyiSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

export interface TaiyiPositionFact {
  key: string;
  status: '已计算';
  role: '太乙' | '文昌（主目）' | '始击（客目）' | '计神';
  position: string;
  palace: number;
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '核心定位字段是七十二局立成与计神规则的计算事实，只限定太乙盘面取证位置，不单独证明现实吉凶、攻守结果、人物处境或固定应期';
}

export interface TaiyiForceFact {
  key: string;
  status: '已计算';
  side: '主' | '客' | '定';
  count: number;
  nature?: string;
  generalPalace: number;
  assistantPalace: number;
  generalInCenter: boolean;
  assistantInCenter: boolean;
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '主客定算、算数属性与将参宫位是传统规则计算结果，只用于比较三方盘面条件，不直接证明现实胜负、行动成败、吉凶比例或人物强弱';
}

export interface TaiyiSixteenGodFact {
  key: string;
  status: '已计算';
  index: number;
  branch: string;
  god: string;
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '十六神固定定位只作为太乙基础盘辅助索引，未结合具体类神和完整古法细目时不得单独生成现实结论';
}

export interface TaiyiConditionFact {
  key: string;
  status: '已命中' | '未命中';
  kind: '掩' | '囚' | '主将参中宫' | '客将参中宫';
  matched: boolean;
  calculationStepKeys: string[];
  calculationText: string;
  promptText: string;
  sources: string[];
  limitation: '掩、囚与将参中宫只证明盘面满足对应位置条件；传统动静或攻守解释须结合所问事项与现实资料，不代表必然结果';
}

export interface TaiyiCalculationStep {
  key: string;
  name: '360周期余数' | '72数段' | '60数段' | '局数';
  status: '已复算';
  input: number;
  operation: string;
  result: number;
  dependsOnStepKeys: string[];
  basis: string;
  promptText: string;
  sources: string[];
  limitation: '积数算式只证明本计积数如何折算360周期余数、72数段、60数段与七十二局；数段序号不等同于已经统一版本口径的元纪，也不证明传统解释有效性、现实胜负、吉凶比例、人物强弱或固定应期';
}

export interface TaiyiCounterEvidenceFact {
  key: string;
  type: '掩' | '囚' | '主将参中宫' | '客将参中宫';
  status: '已命中' | '未命中';
  ownerConditionKey: string;
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录掩、囚与主客将参中宫条件是否命中；未命中不代表现实有利，命中也不证明攻守、胜负或固定应期';
}

export interface TaiyiCounterSummaryFact {
  key: 'taiyi:counter-summary';
  status: '存在未命中条件' | '条件均有命中';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明传统条件覆盖情况；不得据命中数量生成吉凶总分、成功率、人物强弱或固定应期';
}

export interface TaiyiLimitationFact {
  key: string;
  type: '时间尺度边界' | '传统模型边界' | '实证范围边界' | '古法覆盖边界' | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束太乙年计、七十二局、主客定算和十六神可以支持的解释范围，不得被反向当作现实结果或概率证据';
}

export interface TaiyiSummaryFact {
  key: 'taiyi:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  positionFactCount: number;
  forceFactCount: number;
  sixteenGodFactCount: number;
  conditionFactCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '太乙证据汇总只统计积数计算、核心定位、主客定算、十六神、条件、反证与限制覆盖；不得按数量生成吉凶总分、成功率、人物强弱、攻守胜负或固定应期';
}

const POSITION_FACT_LIMITATION =
  '核心定位字段是七十二局立成与计神规则的计算事实，只限定太乙盘面取证位置，不单独证明现实吉凶、攻守结果、人物处境或固定应期' as const;

const FORCE_FACT_LIMITATION =
  '主客定算、算数属性与将参宫位是传统规则计算结果，只用于比较三方盘面条件，不直接证明现实胜负、行动成败、吉凶比例或人物强弱' as const;

const SIXTEEN_GOD_FACT_LIMITATION =
  '十六神固定定位只作为太乙基础盘辅助索引，未结合具体类神和完整古法细目时不得单独生成现实结论' as const;

const CONDITION_FACT_LIMITATION =
  '掩、囚与将参中宫只证明盘面满足对应位置条件；传统动静或攻守解释须结合所问事项与现实资料，不代表必然结果' as const;
const CALCULATION_STEP_LIMITATION =
  '积数算式只证明本计积数如何折算360周期余数、72数段、60数段与七十二局；数段序号不等同于已经统一版本口径的元纪，也不证明传统解释有效性、现实胜负、吉凶比例、人物强弱或固定应期' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录掩、囚与主客将参中宫条件是否命中；未命中不代表现实有利，命中也不证明攻守、胜负或固定应期' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明传统条件覆盖情况；不得据命中数量生成吉凶总分、成功率、人物强弱或固定应期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束太乙年计、七十二局、主客定算和十六神可以支持的解释范围，不得被反向当作现实结果或概率证据' as const;
const SUMMARY_FACT_LIMITATION =
  '太乙证据汇总只统计积数计算、核心定位、主客定算、十六神、条件、反证与限制覆盖；不得按数量生成吉凶总分、成功率、人物强弱、攻守胜负或固定应期' as const;

const SCOPE_LABELS: Record<TaiyiScope, string> = {
  year: '年计',
  month: '月计',
  day: '日计',
  hour: '时计',
};

function palaceText(position: string, palace: number) {
  return `${position}（第${palace}宫）`;
}

function positiveOneBased(value: number, cycle: number) {
  return ((value - 1) % cycle) + 1;
}

function buildPositionFacts(data: TaiyiEvidenceInput): TaiyiPositionFact[] {
  return [
    ['太乙', data.taiyiPosition, data.taiyiPalace, '七十二局太乙行宫立成表'],
    ['文昌（主目）', data.wenChangPosition, data.wenChangPalace, '七十二局文昌位置立成表'],
    ['始击（客目）', data.shiJiPosition, data.shiJiPalace, '七十二局始击位置立成表'],
    ['计神', data.jiShenPosition, data.jiShenPalace, '本计阴阳遁与周期地支计神定位规则'],
  ].map(([role, position, palace, source]) => ({
    key: `核心定位:${role}`,
    status: '已计算' as const,
    role,
    position,
    palace,
    calculationStepKeys: ['taiyi:calculation:bureau'],
    promptText: `${role}在${position}（第${palace}宫）`,
    sources: [source, `${data.model.name}当前第${data.bureau}局结果`],
    limitation: POSITION_FACT_LIMITATION,
  })) as TaiyiPositionFact[];
}

function buildForceFacts(data: TaiyiEvidenceInput): TaiyiForceFact[] {
  return [
    ['主', data.lordCount, data.countNatures?.lord, data.lordGeneral, data.lordAssistant],
    ['客', data.guestCount, data.countNatures?.guest, data.guestGeneral, data.guestAssistant],
    ['定', data.setCount, data.countNatures?.set, data.setGeneral, data.setAssistant],
  ].map(([side, count, nature, generalPalace, assistantPalace]) => ({
    key: `三方算将参:${side}`,
    status: '已计算' as const,
    side,
    count,
    nature,
    generalPalace,
    assistantPalace,
    generalInCenter: generalPalace === 5,
    assistantInCenter: assistantPalace === 5,
    calculationStepKeys: ['taiyi:calculation:bureau'],
    promptText: `${side}算${count}${nature ? `（传统算数属性${nature}）` : '（未列算数属性）'}；${side}大将第${generalPalace}宫，${side}参将第${assistantPalace}宫${generalPalace === 5 || assistantPalace === 5 ? '；将或参落中宫' : ''}`,
    sources: ['七十二局主算、客算、定算立成表', '定算余数定位大将与大将乘三定位参将规则'],
    limitation: FORCE_FACT_LIMITATION,
  })) as TaiyiForceFact[];
}

function buildSixteenGodFacts(data: TaiyiEvidenceInput): TaiyiSixteenGodFact[] {
  return data.sixteenGods.map((item, index) => ({
    key: `十六神:${index + 1}:${item.god}`,
    status: '已计算' as const,
    index: index + 1,
    branch: item.branch,
    god: item.god,
    calculationStepKeys: ['taiyi:calculation:bureau'],
    promptText: `第${index + 1}位${item.branch}${item.god}`,
    sources: ['太乙十六神固定定位表', `${data.model.name}基础盘辅助定位`],
    limitation: SIXTEEN_GOD_FACT_LIMITATION,
  }));
}

function buildConditionFacts(data: TaiyiEvidenceInput): TaiyiConditionFact[] {
  const imprisonedRoles = [
    data.wenChangPalace === data.taiyiPalace ? '文昌' : undefined,
    data.lordGeneral === data.taiyiPalace ? '主大将' : undefined,
    data.lordAssistant === data.taiyiPalace ? '主参将' : undefined,
    data.guestGeneral === data.taiyiPalace ? '客大将' : undefined,
    data.guestAssistant === data.taiyiPalace ? '客参将' : undefined,
  ].filter((item): item is string => item !== undefined);
  const facts: Array<{
    kind: TaiyiConditionFact['kind'];
    matched: boolean;
    calculationText: string;
    matchedText: string;
    unmatchedText: string;
  }> = [
    {
      kind: '掩',
      matched: data.shiJiPalace === data.taiyiPalace,
      calculationText: `始击第${data.shiJiPalace}宫与太乙第${data.taiyiPalace}宫比较`,
      matchedText: '始击与太乙同宫，传统称掩；只作为客目与太乙位置重合的条件提示',
      unmatchedText: '始击与太乙不同宫，未形成掩的位置条件',
    },
    {
      kind: '囚',
      matched: imprisonedRoles.length > 0,
      calculationText: `文昌第${data.wenChangPalace}宫、主将参第${data.lordGeneral}/${data.lordAssistant}宫、客将参第${data.guestGeneral}/${data.guestAssistant}宫与太乙第${data.taiyiPalace}宫逐项比较`,
      matchedText: `${imprisonedRoles.join('、')}与太乙同宫，传统称囚；只作为对应目将与太乙位置重合的条件提示`,
      unmatchedText: '文昌、主客大小将均与太乙不同宫，未形成囚的位置条件',
    },
    {
      kind: '主将参中宫',
      matched: data.lordGeneral === 5 || data.lordAssistant === 5,
      calculationText: `主大将第${data.lordGeneral}宫、主参将第${data.lordAssistant}宫与中五宫比较`,
      matchedText:
        '主大将或主参将落中宫，传统上提示主方行动条件受限，须结合现实条件复核，不直接断宜守或成败',
      unmatchedText: '主大将与主参将均未落中宫',
    },
    {
      kind: '客将参中宫',
      matched: data.guestGeneral === 5 || data.guestAssistant === 5,
      calculationText: `客大将第${data.guestGeneral}宫、客参将第${data.guestAssistant}宫与中五宫比较`,
      matchedText:
        '客大将或客参将落中宫，传统上提示客方行动条件受限，须结合现实条件复核，不直接断宜守或成败',
      unmatchedText: '客大将与客参将均未落中宫',
    },
  ];
  return facts.map((item) => ({
    key: `条件:${item.kind}`,
    status: item.matched ? ('已命中' as const) : ('未命中' as const),
    kind: item.kind,
    matched: item.matched,
    calculationStepKeys: ['taiyi:calculation:bureau'],
    calculationText: item.calculationText,
    promptText: item.matched ? item.matchedText : item.unmatchedText,
    sources: ['盘面宫位逐项比较', '太乙掩囚与将参中宫传统条件'],
    limitation: CONDITION_FACT_LIMITATION,
  }));
}

function buildCounterEvidenceFacts(
  conditionFacts: TaiyiConditionFact[],
): TaiyiCounterEvidenceFact[] {
  return conditionFacts.map((condition) => ({
    key: `taiyi:counter:${condition.kind}`,
    type: condition.kind,
    status: condition.status,
    ownerConditionKey: condition.key,
    ownerFactKeys: [condition.key],
    promptText: condition.matched
      ? `${condition.kind}条件已命中：${condition.promptText}`
      : `未见${condition.kind}：${condition.promptText}`,
    sources: condition.sources,
    limitation: COUNTER_FACT_LIMITATION,
  }));
}

function buildCounterSummaryFact(
  counterEvidenceFacts: TaiyiCounterEvidenceFact[],
): TaiyiCounterSummaryFact {
  const unmatched = counterEvidenceFacts.filter((item) => item.status === '未命中');
  return {
    key: 'taiyi:counter-summary',
    status: unmatched.length ? '存在未命中条件' : '条件均有命中',
    factKeys: unmatched.map((item) => item.key),
    promptText: unmatched.length
      ? `未见${unmatched.map((item) => item.type).join('、')}；未命中不代表现实有利或不利，只保留条件事实`
      : '掩、囚与主客将参中宫条件均有命中记录；不得据命中数量生成综合判断',
    sources: ['掩、囚与主客将参中宫条件逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(
  calculationSteps: TaiyiCalculationStep[],
  positionFacts: TaiyiPositionFact[],
  forceFacts: TaiyiForceFact[],
  sixteenGodFacts: TaiyiSixteenGodFact[],
): TaiyiLimitationFact[] {
  const allFactKeys = [
    ...calculationSteps.map((item) => item.key),
    ...positionFacts.map((item) => item.key),
    ...forceFacts.map((item) => item.key),
    ...sixteenGodFacts.map((item) => item.key),
  ];
  const definitions: Array<
    Pick<TaiyiLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'taiyi:limitation:time-scale',
      type: '时间尺度边界',
      ownerFactKeys: calculationSteps.map((item) => item.key),
      promptText:
        '年计只适用于年度时间尺度；月、日、时计尚未完成节气时刻、章月、月法、日法、气应与小余的古籍历法链校勘，当前不得据年计结果替代推断',
      sources: ['《太乙金镜式经》卷一年计积年及月日时计历法条文'],
    },
    {
      key: 'taiyi:limitation:traditional-model',
      type: '传统模型边界',
      ownerFactKeys: allFactKeys,
      promptText: '七十二局立成、宫位、算数与十六神属于传统规则模型，不是现代统计预测模型',
      sources: ['太乙七十二局立成与传统定位规则'],
    },
    {
      key: 'taiyi:limitation:evidence-scope',
      type: '实证范围边界',
      ownerFactKeys: allFactKeys,
      promptText: '古籍与公开实现用于说明规则来源和交叉校验，不代表吉凶解释经过现代实证验证',
      sources: ['传统文献与现代实证范围区分'],
    },
    {
      key: 'taiyi:limitation:classic-coverage',
      type: '古法覆盖边界',
      ownerFactKeys: allFactKeys,
      promptText:
        '本盘是太乙基础盘的结构化计算，未覆盖全部古法细目，不得据此声称完整复原所有太乙法门',
      sources: ['七十二局基础盘与古法细目范围对照'],
    },
    {
      key: 'taiyi:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: allFactKeys,
      promptText: '宫位、算数、掩囚及十六神不得换算为吉凶总分、成功率、匹配率、必然事件或唯一应期',
      sources: ['盘面事实与现实结果分离原则'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function buildSummaryFact(args: {
  calculationSteps: TaiyiCalculationStep[];
  positionFacts: TaiyiPositionFact[];
  forceFacts: TaiyiForceFact[];
  sixteenGodFacts: TaiyiSixteenGodFact[];
  conditionFacts: TaiyiConditionFact[];
  counterEvidenceFacts: TaiyiCounterEvidenceFact[];
  counterSummaryFact: TaiyiCounterSummaryFact;
  limitationFacts: TaiyiLimitationFact[];
}): TaiyiSummaryFact {
  const status =
    args.calculationSteps.length === 4 &&
    args.positionFacts.length === 4 &&
    args.forceFacts.length === 3 &&
    args.sixteenGodFacts.length === 16 &&
    args.conditionFacts.length === 4
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'taiyi:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        ...args.calculationSteps.map((item) => item.key),
        ...args.positionFacts.map((item) => item.key),
        ...args.forceFacts.map((item) => item.key),
        ...args.sixteenGodFacts.map((item) => item.key),
        ...args.conditionFacts.map((item) => item.key),
        ...args.counterEvidenceFacts.map((item) => item.key),
        args.counterSummaryFact.key,
        ...args.limitationFacts.map((item) => item.key),
      ]),
    ),
    positionFactCount: args.positionFacts.length,
    forceFactCount: args.forceFacts.length,
    sixteenGodFactCount: args.sixteenGodFacts.length,
    conditionFactCount: args.conditionFacts.length,
    counterEvidenceCount: args.counterEvidenceFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `证据链状态：${status}；核心定位${args.positionFacts.length}项、主客定算${args.forceFacts.length}项、十六神${args.sixteenGodFacts.length}项、条件${args.conditionFacts.length}项、反证${args.counterEvidenceFacts.length}项、限制${args.limitationFacts.length}项`,
    sources: ['太乙积数计算、核心定位、主客定算、十六神、条件、反证与限制事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

export function buildTaiyiEvidence(data: TaiyiEvidenceInput): TaiyiEvidenceAnalysis {
  const scopeLabel = SCOPE_LABELS[data.scope];
  const isCover = data.shiJiPalace === data.taiyiPalace;
  const isImprison =
    data.wenChangPalace === data.taiyiPalace ||
    data.lordGeneral === data.taiyiPalace ||
    data.lordAssistant === data.taiyiPalace ||
    data.guestGeneral === data.taiyiPalace ||
    data.guestAssistant === data.taiyiPalace;
  const positionFacts = buildPositionFacts(data);
  const forceFacts = buildForceFacts(data);
  const sixteenGodFacts = buildSixteenGodFacts(data);
  const conditionFacts = buildConditionFacts(data);
  const calculationSteps: TaiyiCalculationStep[] = [
    {
      key: 'taiyi:calculation:entry',
      name: '360周期余数',
      status: '已复算',
      input: data.accumulatedValue,
      operation: `(${data.accumulatedValue} - 1) mod 360 + 1`,
      result: data.entryYears,
      dependsOnStepKeys: [],
      basis:
        '积数按三百六十数循环，余零按三百六十计；这里只记录周期余数，不命名为统一版本的入纪元数',
      promptText: `360周期余数：${data.accumulatedValue}按三百六十循环得${data.entryYears}`,
      sources: [`${scopeLabel}${data.accumulatedLabel}规则`, '太乙三百六十数入纪循环规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'taiyi:calculation:yuan',
      name: '72数段',
      status: '已复算',
      input: data.entryYears,
      operation: `ceil(${data.entryYears} / 72)`,
      result: data.yuan,
      dependsOnStepKeys: ['taiyi:calculation:entry'],
      basis: '三百六十周期余数每七十二数分段；不据此宣称已经统一“元”的版本口径',
      promptText: `72数段：360周期余数${data.entryYears}落在第${data.yuan}段`,
      sources: ['太乙七十二局循环规则', data.model.name],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'taiyi:calculation:ji',
      name: '60数段',
      status: '已复算',
      input: data.entryYears,
      operation: `ceil(${data.entryYears} / 60)`,
      result: data.ji,
      dependsOnStepKeys: ['taiyi:calculation:entry'],
      basis: '三百六十周期余数每六十数分段；不据此宣称已经统一“纪”的版本口径',
      promptText: `60数段：360周期余数${data.entryYears}落在第${data.ji}段`,
      sources: ['太乙六十数循环规则', data.model.name],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'taiyi:calculation:bureau',
      name: '局数',
      status: '已复算',
      input: data.accumulatedValue,
      operation: `(${data.accumulatedValue} - 1) mod 72 + 1`,
      result: data.bureau,
      dependsOnStepKeys: ['taiyi:calculation:entry'],
      basis: '积数按七十二局循环，余零按第七十二局计',
      promptText: `局数：${data.accumulatedValue}按七十二局循环得${data.yinYang}第${data.bureau}局`,
      sources: [`${scopeLabel}${data.accumulatedLabel}与阴阳遁规则`, '太乙七十二局循环规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  if (
    positiveOneBased(data.accumulatedValue, 360) !== data.entryYears ||
    Math.ceil(data.entryYears / 72) !== data.yuan ||
    Math.ceil(data.entryYears / 60) !== data.ji ||
    positiveOneBased(data.accumulatedValue, 72) !== data.bureau
  ) {
    throw new Error('太乙积数、360周期余数、数段或局数计算链不一致。');
  }
  const calculationChain = [
    `${scopeLabel}以${data.dateTime}及本计干支${data.ganZhi}作为时间输入`,
    `按${scopeLabel}独立规则得到${data.accumulatedLabel}${data.accumulatedValue}，折算360周期余数${data.entryYears}`,
    `360周期余数${data.entryYears}分别落在第${data.yuan}个72数段、第${data.ji}个60数段；数段不冒充已统一口径的元纪`,
    `积数按七十二局循环定位${data.yinYang}第${data.bureau}局`,
    '按对应阴阳遁七十二局立成表读取太乙、文昌、始击及主客定算',
    '由主客定算余数定位主客定大将与参将，计神及十六神作为辅助定位资料',
  ];
  const primaryFacts = [
    `${data.yinYang}第${data.bureau}局，太乙在${palaceText(data.taiyiPosition, data.taiyiPalace)}`,
    `文昌（主目）在${palaceText(data.wenChangPosition, data.wenChangPalace)}，始击（客目）在${palaceText(data.shiJiPosition, data.shiJiPalace)}`,
    `主算${data.lordCount}、客算${data.guestCount}、定算${data.setCount}`,
    `主大将${data.lordGeneral}宫、主参将${data.lordAssistant}宫；客大将${data.guestGeneral}宫、客参将${data.guestAssistant}宫；定大将${data.setGeneral}宫、定参将${data.setAssistant}宫`,
  ];
  if (isCover) primaryFacts.push('掩成立：始击与太乙同宫');
  if (isImprison) primaryFacts.push('囚成立：文昌或主客大小将至少一项与太乙同宫');

  const supportingFacts = [
    `计神在${palaceText(data.jiShenPosition, data.jiShenPalace)}`,
    `十六神固定定位：${data.sixteenGods.map((item) => `${item.branch}${item.god}`).join('、')}`,
  ];
  const counterEvidenceFacts = buildCounterEvidenceFacts(conditionFacts);
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status === '未命中')
    .map((item) => item.promptText);
  const limitationFacts = buildLimitationFacts(
    calculationSteps,
    positionFacts,
    forceFacts,
    sixteenGodFacts,
  );
  const limitations = limitationFacts.map((item) => item.promptText);
  const summaryFact = buildSummaryFact({
    calculationSteps,
    positionFacts,
    forceFacts,
    sixteenGodFacts,
    conditionFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    limitationFacts,
  });
  const sourceText = data.model.sources
    .map((source) => `${source.title}：${source.evidence}`)
    .join('；');
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: `${scopeLabel}积数与七十二局`,
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: `${sourceText}；${Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、')}`,
      tags: [scopeLabel, data.yinYang, `第${data.bureau}局`],
    },
    {
      level: '主证',
      title: '太乙、主目与客目定位',
      detail: `${positionFacts.map((item) => item.promptText).join('；')}；统一边界：${POSITION_FACT_LIMITATION}`,
      source: '七十二局太乙、文昌、始击位置立成表及同宫比较',
      tags: ['太乙', '文昌', '始击', ...(isCover ? ['掩'] : []), ...(isImprison ? ['囚'] : [])],
    },
    {
      level: '主证',
      title: '主客定算与将参',
      detail: `${forceFacts.map((item) => item.promptText).join('；')}；统一边界：${FORCE_FACT_LIMITATION}`,
      source: '七十二局主算、客算、定算立成表及将参定位规则',
      tags: ['主算', '客算', '定算', '将参'],
    },
    {
      level: '辅证',
      title: '计神与十六神定位',
      detail: `${sixteenGodFacts.map((item) => item.promptText).join('；')}；统一边界：${SIXTEEN_GOD_FACT_LIMITATION}`,
      source: '计神逐支定位规则与十六神固定宫位表',
      tags: ['计神', '十六神'],
    },
    ...conditionFacts.map((item): PromptEvidenceItem => ({
      level: item.matched ? '辅证' : '反证',
      title: `${item.kind}${item.matched ? '条件成立' : '条件未成立'}`,
      detail: `${item.calculationText}；${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('；'),
      tags: [item.kind, item.matched ? '条件成立' : '条件未成立'],
    })),
    {
      level: '反证',
      title: `太乙反证汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: summaryFact.status === '证据链完整' ? '辅证' : '反证',
      title: `太乙证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '太乙年计解释边界',
      detail: `${limitations.join('；')}；边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['传统模型', '证据边界'],
    },
  ];
  const evidence: PromptEvidenceBundle = {
    title: '太乙年计七十二局结构化证据',
    items,
  };
  const promptText = [
    '【太乙年计七十二局结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `算式核验：${calculationSteps.map((step) => `${step.key} ${step.name}${step.operation}=${step.result}`).join('；')}。`,
    `反证核验：${counterSummaryFact.promptText}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制（方法限制）：${limitations.join('；')}。`,
  ].join('\n');

  return {
    key: 'taiyi:evidence',
    status: '已计算',
    calculationChain,
    calculationSteps,
    positionFacts,
    forceFacts,
    sixteenGodFacts,
    conditionFacts,
    primaryFacts,
    supportingFacts,
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先按所选计式独立计算积数、360周期余数、72/60数段、阴阳遁与七十二局；数段只用于复算，不替代尚未统一版本口径的元纪。',
      '再读取太乙、文昌、始击及主客定算立成，比较同宫结构并定位将参。',
      '计神和十六神只列为辅助定位，不覆盖局数、主客目与主客定算主线。',
      '同时输出成立与不成立的结构，避免只罗列支持证据。',
      '保留传统规则来源与现代实证边界，不生成分数、概率或绝对应期。',
    ],
  };
}
