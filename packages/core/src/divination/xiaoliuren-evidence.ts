import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { XiaoliurenData, XiaoliurenPalaceDetail } from '../types/divination';

export interface XiaoliurenStageEvidence {
  key: string;
  status: '已计算';
  stage: '起因' | '过程' | '结果';
  palace: XiaoliurenPalaceDetail;
  seasonState: string;
  role: string;
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '三宫阶段事实只记录起因、过程、结果宫位、五行、月令旺衰与支持限制；阶段名称和宫位倾向不得直接解释为现实起因、经过、结果、吉凶或成功率';
}

export interface XiaoliurenTransitionFact {
  key: string;
  status: '支持' | '限制' | '中性';
  fromStageKey: string;
  toStageKey: string;
  fromStage: '起因' | '过程';
  toStage: '过程' | '结果';
  fromPalace: string;
  toPalace: string;
  fromElement: string;
  toElement: string;
  relation: string;
  promptText: string;
  sources: string[];
  limitation: '三宫推进事实只描述相邻宫位的五行生克与先后次序；不得把盘内推进直接写成现实事件必然顺利、受阻、成功、失败或按同样顺序发生';
}

export interface XiaoliurenCounterEvidenceFact {
  key: string;
  ownerStageKey: string;
  stage: XiaoliurenStageEvidence['stage'];
  type: '宫位倾向限制' | '月令限制' | '空亡核验' | '沟通冲突核验' | '现实复核限制';
  status: '已触发';
  detail: string;
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示某一阶段存在等待、反复、争执、落空、休囚死或现实待核验条件；不得把单项反证直接写成现实失败、灾祸、疾病、损失或必然结果';
}

export interface XiaoliurenCounterSummaryFact {
  key: 'xiaoliuren:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明三宫核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶总分或成功率';
}

export interface XiaoliurenTimingBasisFact {
  key: string;
  order: number;
  type: '结果宫节奏' | '过程结果关系' | '结果宫旺衰' | '补充依据';
  sourceStatus: '原结果提供' | '由盘面补齐';
  ownerFactKeys: string[];
  rawText?: string;
  promptText: string;
  sources: string[];
  limitation: '节奏依据只用于说明相对快慢、反复与条件成熟度；不得把宫名、五行关系、旺衰或传统快慢属性换算固定日数、公历日期或事件概率';
}

export interface XiaoliurenTriggerConditionFact {
  key: string;
  order: number;
  type: '原触发条件' | '相对节奏' | '现实事件复核' | '期限边界';
  sourceStatus: '原结果提供' | '由盘面补齐' | '统一边界';
  ownerFactKeys: string[];
  rhythm: '偏快' | '平稳' | '偏缓' | '反复' | '不定' | null;
  rawText?: string;
  promptText: string;
  sources: string[];
  limitation: '触发条件只提供消息、沟通、资源、手续、目标落实与相对节奏等观察点；不得由宫数、传统数目或节奏标签生成固定日期，也不证明事件必然发生';
}

export interface XiaoliurenTimingSummaryFact {
  key: 'xiaoliuren:timing-summary';
  status: '已提供节奏与触发条件' | '仅有期限边界';
  rhythm: string | null;
  basisFactKeys: string[];
  triggerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只说明当前保存了哪些相对节奏、触发与期限边界；不得按条件数量、宫数、五行或旺衰生成固定天数、绝对日期或事件概率';
}

export interface XiaoliurenTraditionalFact {
  key: string;
  status: '已映射';
  palace: XiaoliurenPalaceDetail['name'];
  stages: Array<'起因' | '过程' | '结果'>;
  kind: '宫位解释' | '传统属性';
  originalText: string;
  promptText: string;
  sources: string[];
  limitation: '六宫宫义与传统属性只用于当前课式的近事情境分类，不证明现实中的结果、疾病、身体问题、方位吉凶或固定应期';
}

export interface XiaoliurenCalculationStep {
  key: string;
  stage: '起因' | '过程' | '结果';
  expression: string;
  seed: number;
  modulo: 6;
  palaceIndex: number;
  palace: string;
  promptText: string;
}

export interface XiaoliurenCalculationFact {
  key: string;
  status: '完整' | '缺少中间参数';
  method: XiaoliurenData['method'];
  methodLabel: string;
  inputBase?: number;
  inputBaseSource?: string;
  lunarDay: number;
  hourNumber?: number;
  steps: XiaoliurenCalculationStep[];
  promptText: string;
  sources: string[];
  limitation: '逐宫顺数只证明起课基数、农历日数和时辰数如何定位起因、过程、结果三宫，不证明宫义预测有效性、现实吉凶或固定应期';
}

export interface XiaoliurenEvidenceCalculationStep {
  key: string;
  stage:
    | '起课来源核验'
    | '三宫定位核验'
    | '三宫阶段计算'
    | '五行推进核验'
    | '反证与应期核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明起课来源、三宫定位、阶段事实、五行推进、反证与应期条件如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期';
}

export interface XiaoliurenSummaryFact {
  key: 'xiaoliuren:evidence-summary';
  status: '证据链完整' | '起课资料缺失';
  factKeys: string[];
  stageFactCount: number;
  transitionFactCount: number;
  traditionalFactCount: number;
  counterEvidenceCount: number;
  timingBasisFactCount: number;
  triggerConditionFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '小六壬证据汇总只统计起课、三宫、五行推进、传统宫义、反证、节奏与触发条件的覆盖情况；不得按数量生成吉凶总分、成功率、方位保证、身体结论或唯一日期';
}

export interface XiaoliurenLimitationFact {
  key: string;
  type:
    | '起课与随机来源边界'
    | '三宫资料边界'
    | '五行推进边界'
    | '传统宫义边界'
    | '反证与应期边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束小六壬起课、三宫、五行推进、传统宫义、方位神煞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、疾病身体、方位保证、事件概率或固定应期的证据';
}

export interface XiaoliurenEvidenceAnalysis {
  key: 'xiaoliuren:evidence';
  status: '已计算';
  sources: Array<{ title: string; evidence: string; role: '传统规则来源' | '历法计算来源' }>;
  calculationFact: XiaoliurenCalculationFact;
  calculationFacts: string[];
  calculationSteps: XiaoliurenEvidenceCalculationStep[];
  calculationChain: string[];
  stages: XiaoliurenStageEvidence[];
  transitionFacts: XiaoliurenTransitionFact[];
  transitions: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  counterEvidenceFacts: XiaoliurenCounterEvidenceFact[];
  counterSummaryFact: XiaoliurenCounterSummaryFact;
  counterEvidence: string[];
  timingBasisFacts: XiaoliurenTimingBasisFact[];
  timingBasis: string[];
  triggerConditionFacts: XiaoliurenTriggerConditionFact[];
  timingSummaryFact: XiaoliurenTimingSummaryFact;
  triggerConditions: string[];
  limitations: string[];
  limitationFacts: XiaoliurenLimitationFact[];
  summaryFact: XiaoliurenSummaryFact;
  traditionalFacts: XiaoliurenTraditionalFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const SUPPORT_TENDENCIES = new Set(['宜推进', '有助力']);
const CONSTRAINT_TENDENCIES = new Set(['宜等待', '易反复', '易争执', '易落空']);
const TRADITIONAL_FACT_LIMITATION =
  '六宫宫义与传统属性只用于当前课式的近事情境分类，不证明现实中的结果、疾病、身体问题、方位吉凶或固定应期' as const;
const CALCULATION_FACT_LIMITATION =
  '逐宫顺数只证明起课基数、农历日数和时辰数如何定位起因、过程、结果三宫，不证明宫义预测有效性、现实吉凶或固定应期' as const;
const STAGE_FACT_LIMITATION =
  '三宫阶段事实只记录起因、过程、结果宫位、五行、月令旺衰与支持限制；阶段名称和宫位倾向不得直接解释为现实起因、经过、结果、吉凶或成功率' as const;
const TRANSITION_FACT_LIMITATION =
  '三宫推进事实只描述相邻宫位的五行生克与先后次序；不得把盘内推进直接写成现实事件必然顺利、受阻、成功、失败或按同样顺序发生' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示某一阶段存在等待、反复、争执、落空、休囚死或现实待核验条件；不得把单项反证直接写成现实失败、灾祸、疾病、损失或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明三宫核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶总分或成功率' as const;
const TIMING_BASIS_FACT_LIMITATION =
  '节奏依据只用于说明相对快慢、反复与条件成熟度；不得把宫名、五行关系、旺衰或传统快慢属性换算固定日数、公历日期或事件概率' as const;
const TRIGGER_FACT_LIMITATION =
  '触发条件只提供消息、沟通、资源、手续、目标落实与相对节奏等观察点；不得由宫数、传统数目或节奏标签生成固定日期，也不证明事件必然发生' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只说明当前保存了哪些相对节奏、触发与期限边界；不得按条件数量、宫数、五行或旺衰生成固定天数、绝对日期或事件概率' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明起课来源、三宫定位、阶段事实、五行推进、反证与应期条件如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '小六壬证据汇总只统计起课、三宫、五行推进、传统宫义、反证、节奏与触发条件的覆盖情况；不得按数量生成吉凶总分、成功率、方位保证、身体结论或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束小六壬起课、三宫、五行推进、传统宫义、方位神煞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、疾病身体、方位保证、事件概率或固定应期的证据' as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function conditionXiaoliurenTraditionalText(text: string): string {
  return text
    .replace(/吉凶凶（大凶）/g, '传统分类高风险')
    .replace(/吉凶平（偏凶）/g, '传统分类混合偏风险')
    .replace(/吉凶凶/g, '传统分类风险')
    .replace(/吉凶吉/g, '传统分类有利')
    .replace(/身体部位/g, '传统身体类象')
    .replace(/(^|；)方位/g, '$1传统方位')
    .replace(/(^|；)神煞/g, '$1传统神煞标签')
    .replace(/传统应期/g, '传统节奏属性')
    .replace(/局势偏稳/g, '传统宫义提示局势偏稳')
    .replace(/事情容易拖延反复/g, '传统宫义提示事情可能拖延反复')
    .replace(/消息与进展来得较快/g, '传统宫义提示消息与进展可能较快出现')
    .replace(
      /容易出现争执、误会、口舌或情绪冲撞/g,
      '传统宫义提示可能出现争执、误会、口舌或情绪冲撞',
    )
    .replace(/事情整体可成/g, '传统宫义提示具备推进线索')
    .replace(
      /当前信息虚、时机虚或目标虚，容易白忙一场/g,
      '传统宫义提示信息、时机或目标可能尚未落实，投入可能暂未形成有效结果',
    )
    .replace(/当前容易落空或判断失真/g, '传统宫义提示线索可能尚未落实或判断依据不足')
    .replace(/当前有较快起色/g, '传统宫义提示可留意较快出现的进展线索')
    .replace(/当前整体偏可成/g, '传统宫义提示可关注渐进推进条件')
    .replace(/凶（大凶）/g, '传统高风险分类')
    .replace(/平（偏凶）/g, '传统混合偏风险分类')
    .replace(/(^|[；，。])凶(?=$|[；，。])/g, '$1传统风险分类')
    .replace(/(^|[；，。])吉(?=$|[；，。])/g, '$1传统有利分类')
    .replace(/应期不定或落空，需重新评估/g, '传统节奏不定，须以目标、信息和承诺是否落实为复核条件')
    .replace(/必然/g, '可能')
    .replace(/必定/g, '较可能');
}

function buildTraditionalFacts(stages: XiaoliurenStageEvidence[]): XiaoliurenTraditionalFact[] {
  const facts = new Map<string, XiaoliurenTraditionalFact>();
  for (const stage of stages) {
    const meaningKey = `${stage.palace.name}:meaning`;
    const previousMeaning = facts.get(meaningKey);
    facts.set(meaningKey, {
      key: `palace:${stage.palace.name}:meaning`,
      status: '已映射',
      palace: stage.palace.name,
      stages: [...(previousMeaning?.stages ?? []), stage.stage],
      kind: '宫位解释',
      originalText: stage.palace.meaning,
      promptText: conditionXiaoliurenTraditionalText(stage.palace.meaning),
      sources: ['《小六壬金口诀》《李淳风六壬时课》六宫取象'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
    const attributeKey = `${stage.palace.name}:attributes`;
    const previousAttribute = facts.get(attributeKey);
    const originalText = [
      stage.palace.fortune ? `吉凶${stage.palace.fortune}` : '',
      stage.palace.direction ? `方位${stage.palace.direction}` : '',
      stage.palace.shenSha ? `神煞${stage.palace.shenSha}` : '',
      stage.palace.yinYang ? `${stage.palace.yinYang}宫` : '',
      stage.palace.number ? `传统宫数${stage.palace.number}` : '',
      stage.palace.seasonProsper ? `传统旺季${stage.palace.seasonProsper}` : '',
      stage.palace.bodyPart ? `身体部位${stage.palace.bodyPart}` : '',
      stage.palace.timing ? `传统应期${stage.palace.timing}` : '',
    ]
      .filter(Boolean)
      .join('；');
    facts.set(attributeKey, {
      key: `palace:${stage.palace.name}:attributes`,
      status: '已映射',
      palace: stage.palace.name,
      stages: [...(previousAttribute?.stages ?? []), stage.stage],
      kind: '传统属性',
      originalText: originalText || '未列传统属性',
      promptText: originalText
        ? `${conditionXiaoliurenTraditionalText(originalText)}；身体部位仅为传统类象，不作健康判断；方位与应期须结合现实条件复核`
        : '未列传统属性',
      sources: ['小六壬六宫传统吉凶、方位、神煞、身体部位与应期属性表'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  }
  return Array.from(facts.values());
}

function buildStage(
  stage: XiaoliurenStageEvidence['stage'],
  palace: XiaoliurenPalaceDetail,
  seasonState: string,
): XiaoliurenStageEvidence {
  const role =
    stage === '起因'
      ? '说明事情的起点与既有条件'
      : stage === '过程'
        ? '说明推进方式与中段变化'
        : '作为当前课式的主要落点';
  const support = unique([
    SUPPORT_TENDENCIES.has(palace.tendency) ? `宫位倾向为${palace.tendency}` : '',
    seasonState === '旺' || seasonState === '相' ? `月令${seasonState}` : '',
    palace.keywords.length ? `关键词${palace.keywords.join('、')}` : '',
  ]);
  const constraints = unique([
    CONSTRAINT_TENDENCIES.has(palace.tendency) ? `宫位倾向为${palace.tendency}` : '',
    seasonState === '休' || seasonState === '囚' || seasonState === '死'
      ? `月令${seasonState}`
      : '',
    palace.name === '空亡' ? '空亡提示信息、目标或时机可能尚未落实，须先核实' : '',
    palace.name === '赤口' ? '赤口提示沟通冲突风险，须以现实互动复核' : '',
  ]);
  const key = `xiaoliuren:stage:${stage === '起因' ? 'start' : stage === '过程' ? 'process' : 'result'}`;
  return {
    key,
    status: '已计算',
    stage,
    palace,
    seasonState,
    role,
    support,
    constraints,
    promptText: `${stage}${palace.name}：${role}；五行${palace.element}，月令${seasonState}；支持${support.join('、') || '未见独立增强条件'}；限制${constraints.join('、') || '未见明确盘内限制'}`,
    sources: ['六宫顺数定位', '三段课式阶段规则', '月支与宫位五行旺相休囚死关系'],
    limitation: STAGE_FACT_LIMITATION,
  };
}

function buildXiaoliurenCalculationFact(data: XiaoliurenData): XiaoliurenCalculationFact {
  const calculation = data.calculation;
  const steps: XiaoliurenCalculationStep[] = calculation
    ? [
        {
          key: 'xiaoliuren:calculation:start',
          stage: '起因',
          expression: `${calculation.startSeed}-1`,
          seed: calculation.startSeed,
          modulo: 6,
          palaceIndex: calculation.startPalaceIndex,
          palace: data.sequence.start.name,
          promptText: `起因宫：基数${calculation.startSeed}，减1后按6取余为${calculation.startPalaceIndex}，落${data.sequence.start.name}`,
        },
        {
          key: 'xiaoliuren:calculation:process',
          stage: '过程',
          expression: `${calculation.inputBase}+${calculation.lunarDay}-1`,
          seed: calculation.processSeed,
          modulo: 6,
          palaceIndex: calculation.processPalaceIndex,
          palace: data.sequence.process.name,
          promptText: `过程宫：${calculation.inputBase}+农历日数${calculation.lunarDay}-1=${calculation.processSeed}，减1后按6取余为${calculation.processPalaceIndex}，落${data.sequence.process.name}`,
        },
        {
          key: 'xiaoliuren:calculation:result',
          stage: '结果',
          expression: `${calculation.inputBase}+${calculation.lunarDay}+${calculation.hourNumber}-2`,
          seed: calculation.resultSeed,
          modulo: 6,
          palaceIndex: calculation.resultPalaceIndex,
          palace: data.sequence.result.name,
          promptText: `结果宫：${calculation.inputBase}+农历日数${calculation.lunarDay}+时辰数${calculation.hourNumber}-2=${calculation.resultSeed}，减1后按6取余为${calculation.resultPalaceIndex}，落${data.sequence.result.name}`,
        },
      ]
    : [];
  const promptText = calculation
    ? `起课方式：${data.methodLabel}；起课基数取${calculation.inputBaseSource}${calculation.inputBase}；时辰换算：${data.hourLabel}对应传统时辰数${calculation.hourNumber}（子1至亥12）；${steps.map((item) => item.promptText).join('；')}`
    : `${data.methodLabel}确定起课基数；现有资料未附逐宫顺数中间参数，仅保留已确定三宫${data.sequence.start.name}、${data.sequence.process.name}、${data.sequence.result.name}`;
  return {
    key: `calculation:xiaoliuren:${data.method}`,
    status: calculation ? '完整' : '缺少中间参数',
    method: data.method,
    methodLabel: data.methodLabel,
    inputBase: calculation?.inputBase,
    inputBaseSource: calculation?.inputBaseSource,
    lunarDay: data.lunarDay,
    hourNumber: calculation?.hourNumber,
    steps,
    promptText,
    sources: ['起课方式、农历日数与传统时辰数', '大安至空亡六宫循环取余规则'],
    limitation: CALCULATION_FACT_LIMITATION,
  };
}

function classifyTransitionStatus(relation: string): XiaoliurenTransitionFact['status'] {
  if (relation === '比和') return '中性';
  if (relation === '得生' || relation === '所生') return '支持';
  if (relation === '被克' || relation === '所克') return '限制';
  return '中性';
}

function buildTransitionFacts(
  data: XiaoliurenData,
  stages: XiaoliurenStageEvidence[],
): XiaoliurenTransitionFact[] {
  const definitions = [
    {
      key: 'xiaoliuren:transition:start:process',
      from: stages[0],
      to: stages[1],
      relation: data.wuxingRelations.startToProcess,
    },
    {
      key: 'xiaoliuren:transition:process:result',
      from: stages[1],
      to: stages[2],
      relation: data.wuxingRelations.processToResult,
    },
  ];
  return definitions.map(({ key, from, to, relation }) => ({
    key,
    status: classifyTransitionStatus(relation),
    fromStageKey: from.key,
    toStageKey: to.key,
    fromStage: from.stage as '起因' | '过程',
    toStage: to.stage as '过程' | '结果',
    fromPalace: from.palace.name,
    toPalace: to.palace.name,
    fromElement: from.palace.element,
    toElement: to.palace.element,
    relation,
    promptText: `${from.stage}${from.palace.name}${from.palace.element} → ${to.stage}${to.palace.name}${to.palace.element}：${relation}`,
    sources: ['相邻三宫五行生克关系逐段核验'],
    limitation: TRANSITION_FACT_LIMITATION,
  }));
}

function classifyCounterType(detail: string): XiaoliurenCounterEvidenceFact['type'] {
  if (detail.startsWith('宫位倾向')) return '宫位倾向限制';
  if (detail.startsWith('月令')) return '月令限制';
  if (detail.startsWith('空亡')) return '空亡核验';
  if (detail.startsWith('赤口')) return '沟通冲突核验';
  return '现实复核限制';
}

function buildCounterEvidenceFacts(
  stages: XiaoliurenStageEvidence[],
): XiaoliurenCounterEvidenceFact[] {
  return stages.flatMap((stage) =>
    stage.constraints.map((detail, index) => ({
      key: `xiaoliuren:counter:${stage.stage === '起因' ? 'start' : stage.stage === '过程' ? 'process' : 'result'}:${index + 1}`,
      ownerStageKey: stage.key,
      stage: stage.stage,
      type: classifyCounterType(detail),
      status: '已触发',
      detail,
      promptText: `${stage.stage}${stage.palace.name}：${detail}`,
      sources: ['对应阶段宫位倾向、月令旺衰与特殊宫位条件核验'],
      limitation: COUNTER_FACT_LIMITATION,
    })),
  );
}

function buildTimingBasisFacts(
  data: XiaoliurenData,
  stages: XiaoliurenStageEvidence[],
  transitionFacts: XiaoliurenTransitionFact[],
): XiaoliurenTimingBasisFact[] {
  const input = unique(data.timingEvidence?.primaryBasis ?? []);
  const consumed = new Set<string>();
  const definitions: Array<{
    type: Exclude<XiaoliurenTimingBasisFact['type'], '补充依据'>;
    matcher: (text: string) => boolean;
    computed: string;
    ownerFactKeys: string[];
    sources: string[];
  }> = [
    {
      type: '结果宫节奏',
      matcher: (text) => text.startsWith('结果宫为'),
      computed: `结果宫为${data.sequence.result.name}${data.timingEvidence ? `，宫义节奏为${data.timingEvidence.rhythm}` : ''}`,
      ownerFactKeys: [stages[2].key],
      sources: ['结果宫名称与相对节奏属性'],
    },
    {
      type: '过程结果关系',
      matcher: (text) => text.startsWith('过程至结果五行关系为'),
      computed: `过程至结果五行关系为${data.wuxingRelations.processToResult}：${data.wuxingRelations.description}`,
      ownerFactKeys: [transitionFacts[1].key],
      sources: ['过程宫至结果宫五行生克关系'],
    },
    {
      type: '结果宫旺衰',
      matcher: (text) => text.startsWith('结果宫') && text.includes('只作条件成熟度辅助'),
      computed: `结果宫${data.sequence.result.element}月令${data.seasonStates?.result ?? '未定'}，只作条件成熟度辅助`,
      ownerFactKeys: [stages[2].key],
      sources: ['结果宫五行与月支旺相休囚死关系'],
    },
  ];
  const facts = definitions.map((definition, index): XiaoliurenTimingBasisFact => {
    const rawText = input.find((text) => !consumed.has(text) && definition.matcher(text));
    if (rawText) consumed.add(rawText);
    return {
      key: `xiaoliuren:timing-basis:${index + 1}:${definition.type}`,
      order: index + 1,
      type: definition.type,
      sourceStatus: rawText ? '原结果提供' : '由盘面补齐',
      ownerFactKeys: definition.ownerFactKeys,
      ...(rawText ? { rawText } : {}),
      promptText: rawText ?? definition.computed,
      sources: rawText ? ['当前课式已保存的节奏依据', ...definition.sources] : definition.sources,
      limitation: TIMING_BASIS_FACT_LIMITATION,
    };
  });
  input
    .filter((text) => !consumed.has(text))
    .forEach((text) => {
      facts.push({
        key: `xiaoliuren:timing-basis:supplement:${facts.length + 1}`,
        order: facts.length + 1,
        type: '补充依据',
        sourceStatus: '原结果提供',
        ownerFactKeys: stages.map((item) => item.key),
        rawText: text,
        promptText: text,
        sources: ['当前课式已保存的补充节奏依据'],
        limitation: TIMING_BASIS_FACT_LIMITATION,
      });
    });
  return facts;
}

function buildTriggerConditionFacts(
  data: XiaoliurenData,
  stages: XiaoliurenStageEvidence[],
): XiaoliurenTriggerConditionFact[] {
  const facts: XiaoliurenTriggerConditionFact[] = [];
  const rhythm = data.timingEvidence?.rhythm ?? null;
  const add = (fact: Omit<XiaoliurenTriggerConditionFact, 'order'>) => {
    if (facts.some((item) => item.promptText === fact.promptText)) return;
    facts.push({ ...fact, order: facts.length + 1 });
  };
  (data.timingEvidence?.triggerConditions ?? []).forEach((promptText, index) =>
    add({
      key: `xiaoliuren:trigger:input:${index + 1}`,
      type: '原触发条件',
      sourceStatus: '原结果提供',
      ownerFactKeys: [stages[2].key],
      rhythm,
      rawText: promptText,
      promptText,
      sources: ['当前课式已保存的结果宫触发条件'],
      limitation: TRIGGER_FACT_LIMITATION,
    }),
  );
  if (rhythm) {
    add({
      key: 'xiaoliuren:trigger:rhythm',
      type: '相对节奏',
      sourceStatus: '由盘面补齐',
      ownerFactKeys: [stages[2].key],
      rhythm,
      promptText: `盘内相对节奏为${rhythm}，只用于安排观察频率和复核顺序`,
      sources: ['结果宫传统快慢属性'],
      limitation: TRIGGER_FACT_LIMITATION,
    });
  }
  add({
    key: 'xiaoliuren:trigger:reality-check',
    type: '现实事件复核',
    sourceStatus: '由盘面补齐',
    ownerFactKeys: stages.map((item) => item.key),
    rhythm,
    promptText: '以消息、沟通、资源、手续或目标是否落实等现实事件复核，不只依据宫名判断',
    sources: ['三宫传统取象与现实事件分离原则'],
    limitation: TRIGGER_FACT_LIMITATION,
  });
  add({
    key: 'xiaoliuren:trigger:deadline-boundary',
    type: '期限边界',
    sourceStatus: '统一边界',
    ownerFactKeys: stages.map((item) => item.key),
    rhythm,
    promptText: '未给现实期限时，不把六宫次序、宫数、传统数目或节奏标签换算固定日期',
    sources: ['相对节奏与现实日期分离原则'],
    limitation: TRIGGER_FACT_LIMITATION,
  });
  return facts;
}

function buildSummaryFact(params: {
  calculationFact: XiaoliurenCalculationFact;
  randomFact: RandomTraceFact;
  stages: XiaoliurenStageEvidence[];
  transitionFacts: XiaoliurenTransitionFact[];
  traditionalFacts: XiaoliurenTraditionalFact[];
  counterEvidenceFacts: XiaoliurenCounterEvidenceFact[];
  counterSummaryFact: XiaoliurenCounterSummaryFact;
  timingBasisFacts: XiaoliurenTimingBasisFact[];
  triggerConditionFacts: XiaoliurenTriggerConditionFact[];
  timingSummaryFact: XiaoliurenTimingSummaryFact;
}): XiaoliurenSummaryFact {
  const factKeys = Array.from(
    new Set([
      params.calculationFact.key,
      params.randomFact.key,
      ...params.stages.map((item) => item.key),
      ...params.transitionFacts.map((item) => item.key),
      ...params.traditionalFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      params.timingSummaryFact.key,
      ...params.timingBasisFacts.map((item) => item.key),
      ...params.triggerConditionFacts.map((item) => item.key),
    ]),
  );
  const status = params.calculationFact.status === '完整' ? '证据链完整' : '起课资料缺失';
  return {
    key: 'xiaoliuren:evidence-summary',
    status,
    factKeys,
    stageFactCount: params.stages.length,
    transitionFactCount: params.transitionFacts.length,
    traditionalFactCount: params.traditionalFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingBasisFactCount: params.timingBasisFacts.length,
    triggerConditionFactCount: params.triggerConditionFacts.length,
    promptText: `证据状态${status}：三宫阶段${params.stages.length}项、五行推进${params.transitionFacts.length}项、传统宫义${params.traditionalFacts.length}项、反证${params.counterEvidenceFacts.length}项、节奏依据${params.timingBasisFacts.length}项、触发条件${params.triggerConditionFacts.length}项`,
    sources: ['全部起课、三宫、五行推进、传统宫义、反证、节奏与触发条件逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  calculationFact: XiaoliurenCalculationFact;
  randomFact: RandomTraceFact;
  stages: XiaoliurenStageEvidence[];
  transitionFacts: XiaoliurenTransitionFact[];
  counterEvidenceFacts: XiaoliurenCounterEvidenceFact[];
  timingBasisFacts: XiaoliurenTimingBasisFact[];
  triggerConditionFacts: XiaoliurenTriggerConditionFact[];
  summaryFact: XiaoliurenSummaryFact;
}): XiaoliurenEvidenceCalculationStep[] {
  return [
    {
      key: 'xiaoliuren:calculation:generation',
      stage: '起课来源核验',
      status: params.calculationFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        method: params.calculationFact.methodLabel,
        lunarDay: params.calculationFact.lunarDay,
      },
      result: {
        calculationStatus: params.calculationFact.status,
        inputBase: params.calculationFact.inputBase ?? '未记录',
        hourNumber: params.calculationFact.hourNumber ?? '未记录',
        randomTraceStatus: params.randomFact.status,
      },
      dependsOnStepKeys: [],
      promptText: `${params.calculationFact.promptText}；随机轨迹${params.randomFact.status === '不适用' ? '不适用' : params.randomFact.status}`,
      sources: Array.from(
        new Set([...params.calculationFact.sources, ...params.randomFact.sources]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'xiaoliuren:calculation:palaces',
      stage: '三宫定位核验',
      status: params.calculationFact.steps.length === 3 ? '已计算' : '资料不足',
      inputs: {
        stepCount: params.calculationFact.steps.length,
        stages: ['起因', '过程', '结果'],
      },
      result: {
        palaces: params.stages.map((item) => item.palace.name),
        recordedStepCount: params.calculationFact.steps.length,
      },
      dependsOnStepKeys: ['xiaoliuren:calculation:generation'],
      promptText: `三宫定位为${params.stages.map((item) => `${item.stage}${item.palace.name}`).join('、')}；${params.calculationFact.steps.length === 3 ? '逐宫顺数参数完整' : '缺少逐宫顺数中间参数'}`,
      sources: ['六宫顺序、起课基数、农历日数与时辰数逐宫定位'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'xiaoliuren:calculation:stages',
      stage: '三宫阶段计算',
      status: params.stages.length === 3 ? '已计算' : '资料不足',
      inputs: { palaceCount: params.stages.length },
      result: {
        stageFactCount: params.stages.length,
        seasonStates: params.stages.map((item) => `${item.stage}:${item.seasonState}`),
      },
      dependsOnStepKeys: ['xiaoliuren:calculation:palaces'],
      promptText: `已记录起因、过程、结果三宫的宫位、五行、月令旺衰、支持与限制事实`,
      sources: ['三宫宫位资料与月支五行旺相休囚死关系'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'xiaoliuren:calculation:transitions',
      stage: '五行推进核验',
      status: params.transitionFacts.length === 2 ? '已计算' : '资料不足',
      inputs: { stageFactCount: params.stages.length },
      result: {
        transitionFactCount: params.transitionFacts.length,
        relations: params.transitionFacts.map((item) => item.relation),
      },
      dependsOnStepKeys: ['xiaoliuren:calculation:stages'],
      promptText: params.transitionFacts.map((item) => item.promptText).join('；'),
      sources: ['起因至过程、过程至结果的相邻宫位五行关系'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'xiaoliuren:calculation:counter-timing',
      stage: '反证与应期核验',
      status: '已计算',
      inputs: { stageFactCount: params.stages.length },
      result: {
        counterEvidenceCount: params.counterEvidenceFacts.length,
        timingBasisFactCount: params.timingBasisFacts.length,
        triggerConditionFactCount: params.triggerConditionFacts.length,
      },
      dependsOnStepKeys: ['xiaoliuren:calculation:stages', 'xiaoliuren:calculation:transitions'],
      promptText: `逐项核验三宫限制${params.counterEvidenceFacts.length}项，并记录节奏依据${params.timingBasisFacts.length}项、触发条件${params.triggerConditionFacts.length}项`,
      sources: ['三宫限制、结果宫节奏、五行推进、月令旺衰与现实触发条件'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'xiaoliuren:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        stageFactCount: params.summaryFact.stageFactCount,
        transitionFactCount: params.summaryFact.transitionFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
        triggerConditionFactCount: params.summaryFact.triggerConditionFactCount,
      },
      dependsOnStepKeys: [
        'xiaoliuren:calculation:generation',
        'xiaoliuren:calculation:palaces',
        'xiaoliuren:calculation:stages',
        'xiaoliuren:calculation:transitions',
        'xiaoliuren:calculation:counter-timing',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  calculationFact: XiaoliurenCalculationFact;
  randomFact: RandomTraceFact;
  stages: XiaoliurenStageEvidence[];
  transitionFacts: XiaoliurenTransitionFact[];
  traditionalFacts: XiaoliurenTraditionalFact[];
  counterEvidenceFacts: XiaoliurenCounterEvidenceFact[];
  counterSummaryFact: XiaoliurenCounterSummaryFact;
  timingBasisFacts: XiaoliurenTimingBasisFact[];
  triggerConditionFacts: XiaoliurenTriggerConditionFact[];
  timingSummaryFact: XiaoliurenTimingSummaryFact;
  summaryFact: XiaoliurenSummaryFact;
  inputLimitations: string[];
}): XiaoliurenLimitationFact[] {
  const definitions: Array<
    Pick<XiaoliurenLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'xiaoliuren:limitation:generation-random',
      type: '起课与随机来源边界',
      ownerFactKeys: [params.calculationFact.key, params.randomFact.key],
      promptText:
        '时间、数字与随机起课只改变起课输入；顺数算式和随机轨迹仅用于核验生成过程，不代表其中一种方式具有更高预测准确率，也不证明现实结果',
      sources: ['起课方式、逐宫顺数参数与随机轨迹'],
    },
    {
      key: 'xiaoliuren:limitation:stages',
      type: '三宫资料边界',
      ownerFactKeys: params.stages.map((item) => item.key),
      promptText:
        '起因、过程、结果三宫只记录当前课式的宫位、五行、月令旺衰与支持限制；结果宫是当前主轴，但不得跳过起因与过程直接套用固定吉凶断语',
      sources: ['三宫阶段事实与结果宫主轴规则'],
    },
    {
      key: 'xiaoliuren:limitation:transitions',
      type: '五行推进边界',
      ownerFactKeys: params.transitionFacts.map((item) => item.key),
      promptText:
        '三宫五行推进只描述起因至过程、过程至结果的盘内生克与先后；不得直接写成现实事件必然顺利、受阻、成功、失败或按同样顺序发生',
      sources: ['相邻三宫五行推进事实'],
    },
    {
      key: 'xiaoliuren:limitation:tradition',
      type: '传统宫义边界',
      ownerFactKeys: params.traditionalFacts.map((item) => item.key),
      promptText:
        '六宫、五行、旺衰、方位、身体部位和神煞属于传统取象规则，不是现代统计预测模型；传统宫义与属性不得单独证明现实事件、疾病身体或方位吉凶',
      sources: ['六宫传统宫义、属性、方位、身体类象与神煞条件化事实'],
    },
    {
      key: 'xiaoliuren:limitation:counter-timing',
      type: '反证与应期边界',
      ownerFactKeys: [
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
        params.timingSummaryFact.key,
        ...params.timingBasisFacts.map((item) => item.key),
        ...params.triggerConditionFacts.map((item) => item.key),
      ],
      promptText: `等待、反复、争执、落空、休囚死等反证须与支持条件并列；节奏和触发只供现实复核，不得换算固定日期或事件概率${params.inputLimitations.length ? `；原结果限制：${params.inputLimitations.join('；')}` : ''}`,
      sources: ['三宫反证、节奏依据、触发条件与原结果应期限制'],
    },
    {
      key: 'xiaoliuren:limitation:high-risk',
      type: '高风险输出边界',
      ownerFactKeys: [params.summaryFact.key],
      promptText:
        '不得按宫位、支持、反证、旺衰或传统吉凶标签生成总分与成功率；不得输出医疗、身体、法律、财务、方位安全或保证有效结论，也不得生成唯一日期',
      sources: ['小六壬证据汇总与高风险解释约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeXiaoliurenEvidence(data: XiaoliurenData): XiaoliurenEvidenceAnalysis {
  const sources: XiaoliurenEvidenceAnalysis['sources'] = [
    {
      title: '《小六壬金口诀》《李淳风六壬时课》传统掌诀体系',
      evidence: '月、日、时或数字顺数六宫及大安、留连、速喜、赤口、小吉、空亡取象',
      role: '传统规则来源',
    },
    {
      title: '公共干支与五行关系',
      evidence: '时辰序、月支及五行旺相休囚死关系的统一计算',
      role: '历法计算来源',
    },
  ];
  const stages = [
    buildStage('起因', data.sequence.start, data.seasonStates?.start ?? '未定'),
    buildStage('过程', data.sequence.process, data.seasonStates?.process ?? '未定'),
    buildStage('结果', data.sequence.result, data.seasonStates?.result ?? '未定'),
  ];
  const traditionalFacts = buildTraditionalFacts(stages);
  const transitionFacts = buildTransitionFacts(data, stages);
  const transitions = transitionFacts.map((item) => item.promptText);
  const calculationFact = buildXiaoliurenCalculationFact(data);
  const calculationFacts = data.calculation
    ? [
        `起课方式：${data.methodLabel}；起课基数取${data.calculation.inputBaseSource}${data.calculation.inputBase}`,
        `时辰换算：${data.hourLabel}对应传统时辰数${data.calculation.hourNumber}（子1至亥12）`,
        `起因宫：基数${data.calculation.startSeed}，减1后按6取余为${data.calculation.startPalaceIndex}，落${data.sequence.start.name}`,
        `过程宫：${data.calculation.inputBase}+农历日数${data.calculation.lunarDay}-1=${data.calculation.processSeed}，减1后按6取余为${data.calculation.processPalaceIndex}，落${data.sequence.process.name}`,
        `结果宫：${data.calculation.inputBase}+农历日数${data.calculation.lunarDay}+时辰数${data.calculation.hourNumber}-2=${data.calculation.resultSeed}，减1后按6取余为${data.calculation.resultPalaceIndex}，落${data.sequence.result.name}`,
      ]
    : [
        `${data.methodLabel}确定起课基数；当前课式记录农历${data.lunarMonth}月${data.lunarDay}日、${data.hourLabel}`,
        `现有资料未附逐宫顺数中间参数，仅保留已确定三宫${data.sequence.start.name}、${data.sequence.process.name}、${data.sequence.result.name}`,
      ];
  const calculationChain = [
    ...calculationFacts,
    '按六宫顺序分别定位起因、过程与结果三宫',
    `三宫定位为${data.sequence.start.name} → ${data.sequence.process.name} → ${data.sequence.result.name}`,
    `比较起因至过程、过程至结果的五行关系：${data.wuxingRelations.startToProcess}、${data.wuxingRelations.processToResult}`,
    '以结果宫为主要落点，月令旺衰、方位、神煞和传统应期属性只作辅助资料',
  ];
  const counterEvidenceFacts = buildCounterEvidenceFacts(stages);
  const counterEvidence = unique(counterEvidenceFacts.map((item) => item.detail));
  const counterSummaryFact: XiaoliurenCounterSummaryFact = {
    key: 'xiaoliuren:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `三宫共记录${counterEvidenceFacts.length}项明确限制，须逐项与现实条件复核`
      : '三宫未见明确等待、反复、争执、落空或休囚死限制，但仍须核实现实风险',
    sources: ['各阶段限制条件逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const isRandomMethod = data.method === 'random';
  const trace = data.meta?.random;
  const randomFact = buildRandomTraceFact({
    key: `random:xiaoliuren:${data.method}`,
    applicable: isRandomMethod,
    trace,
    processLabel: `${data.methodLabel}的起课基数生成过程`,
    sources: ['小六壬起课方式与基数记录', '随机起课样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const timingBasisFacts = buildTimingBasisFacts(data, stages, transitionFacts);
  const timingBasis = timingBasisFacts.map((item) => item.promptText);
  const triggerConditionFacts = buildTriggerConditionFacts(data, stages);
  const triggerConditions = unique([
    ...(data.timingEvidence?.triggerConditions ?? []),
    data.timingEvidence ? `盘内相对节奏为${data.timingEvidence.rhythm}` : '',
    '以消息、沟通、资源、手续或目标是否落实等现实事件复核，不只依据宫名判断',
  ]);
  const timingSummaryFact: XiaoliurenTimingSummaryFact = {
    key: 'xiaoliuren:timing-summary',
    status:
      timingBasisFacts.length && triggerConditionFacts.some((item) => item.type !== '期限边界')
        ? '已提供节奏与触发条件'
        : '仅有期限边界',
    rhythm: data.timingEvidence?.rhythm ?? null,
    basisFactKeys: timingBasisFacts.map((item) => item.key),
    triggerFactKeys: triggerConditionFacts.map((item) => item.key),
    promptText: `应期状态：${data.timingEvidence?.rhythm ? `相对节奏${data.timingEvidence.rhythm}；` : ''}已记录${timingBasisFacts.length}项节奏依据与${triggerConditionFacts.length}项触发边界`,
    sources: ['节奏依据与触发条件逐项汇总'],
    limitation: TIMING_SUMMARY_LIMITATION,
  };
  const summaryFact = buildSummaryFact({
    calculationFact,
    randomFact,
    stages,
    transitionFacts,
    traditionalFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingBasisFacts,
    triggerConditionFacts,
    timingSummaryFact,
  });
  const calculationSteps = buildCalculationSteps({
    calculationFact,
    randomFact,
    stages,
    transitionFacts,
    counterEvidenceFacts,
    timingBasisFacts,
    triggerConditionFacts,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const limitationFacts = buildLimitationFacts({
    calculationFact,
    randomFact,
    stages,
    transitionFacts,
    traditionalFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingBasisFacts,
    triggerConditionFacts,
    timingSummaryFact,
    summaryFact,
    inputLimitations: data.timingEvidence?.limitations ?? [],
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '小六壬计算链',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status],
    },
    {
      level: calculationFact.status === '完整' ? '主证' : '反证',
      title: '起课输入与逐宫顺数',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['起课算式', data.method, calculationFact.status],
    },
    ...stages.map((item, index): PromptEvidenceItem => ({
      level: index === 2 ? '主证' : '辅证',
      title: `${item.stage}${item.palace.name}`,
      detail: `${item.promptText}；宫义${traditionalFacts.find((fact) => fact.palace === item.palace.name && fact.kind === '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(item.palace.meaning)}；传统辅证${traditionalFacts.find((fact) => fact.palace === item.palace.name && fact.kind === '传统属性')?.promptText ?? '未列'}；边界：${item.limitation}；传统类象边界：${TRADITIONAL_FACT_LIMITATION}。`,
      source: item.sources.join('、'),
      tags: [item.stage, item.palace.name, item.palace.element],
    })),
  ];
  items.push(
    {
      level: '主证',
      title: '三宫五行推进',
      detail: `${transitionFacts.map((item) => `${item.promptText}；边界：${item.limitation}`).join('；')}；综合描述：${data.wuxingRelations.description}。`,
      source: Array.from(new Set(transitionFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['五行推进'],
    },
    ...(timingBasis.length
      ? [
          {
            level: '辅证' as const,
            title: '盘内节奏依据',
            detail: `${timingSummaryFact.promptText}；${timingBasisFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
            source: Array.from(new Set(timingBasisFacts.flatMap((item) => item.sources))).join(
              '、',
            ),
            tags: ['节奏', data.timingEvidence?.rhythm ?? '未定'],
          },
        ]
      : []),
    ...(isRandomMethod
      ? [
          {
            level: randomFact.status === '可重放' ? ('辅证' as const) : ('反证' as const),
            title: randomFact.status === '可重放' ? '随机起课重放记录' : '随机轨迹缺失',
            detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
            source: randomFact.sources.join('、'),
            tags: ['随机起课', randomFact.status, '不代表预测有效性'],
          },
        ]
      : []),
    {
      level: counterSummaryFact.status === '有明确反证' ? '反证' : '辅证',
      title: '三宫反证覆盖状态',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    ...counterEvidenceFacts.map((fact): PromptEvidenceItem => ({
      level: '反证',
      title: `${fact.stage}${fact.type}`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['反证', fact.type, fact.stage],
    })),
    {
      level: '应期',
      title: '现实触发与期限边界',
      detail: `${timingSummaryFact.promptText}；${triggerConditionFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
      source: Array.from(new Set(triggerConditionFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['应期', '触发条件', '不换算固定日期'],
    },
    {
      level: '辅证',
      title: `小六壬证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '小六壬解释边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['传统模型', '证据边界'],
    },
  );
  const evidence: PromptEvidenceBundle = {
    title: '小六壬三宫推进结构化证据',
    items,
  };
  const promptText = [
    '【小六壬三宫推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `推进关系：${transitionFacts.map((item) => item.promptText).join('；')}。`,
    `反证限制：${counterEvidenceFacts.map((item) => item.promptText).join('；') || '未见明确休囚、争执、反复或落空标签，仍须现实进展复核'}。`,
    `触发条件：${triggerConditionFacts.map((item) => item.promptText).join('；')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');

  return {
    key: 'xiaoliuren:evidence',
    status: '已计算',
    sources,
    calculationFact,
    calculationFacts,
    calculationSteps,
    calculationChain,
    stages,
    transitionFacts,
    transitions,
    randomFact,
    randomFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    timingBasisFacts,
    timingBasis,
    triggerConditionFacts,
    timingSummaryFact,
    triggerConditions,
    limitations,
    limitationFacts,
    summaryFact,
    traditionalFacts,
    evidence,
    promptText,
    methodology: [
      '先按起课方式复核输入，再依六宫顺序定位起因、过程和结果。',
      '结果宫作为主要落点，起因与过程用于解释来源和推进过程。',
      '逐段比较三宫五行关系，并以月令旺衰补充条件成熟度。',
      '宫位限制与不利状态作为反证明确列出，不只罗列支持信息。',
      '方位、神煞、身体部位与应期属性只作传统辅助，不生成概率、总分或绝对日期。',
    ],
  };
}
