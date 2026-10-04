import type { MeihuaData, MeihuaDivinationMethod } from '../types/divination';
import { getTrigramsByIndex } from './hexagram-data';
import { dizhi } from './divination-data';
import { MEIHUA_DIRECTION_OPTIONS, MEIHUA_OBJECT_OPTIONS } from './config';
import { getBranchWuxing, getSeasonState, isKe, isSheng } from '../ganzhi';
import { getDivinationTime } from '../calendar/timeManager';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import { MingyuCoreError } from '../shared/result';
import {
  hasCompleteCharacterCalculation,
  resolveRandomMethod,
} from './algorithms/meihua/helpers/methods';
import { findHexagramByTrigrams } from './algorithms/meihua/helpers/hexagram';
import { estimateYingQi } from './algorithms/meihua/helpers/timing';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';

const trigramsByIndex = getTrigramsByIndex();

export type MeihuaEvidenceStageKey = 'origin' | 'process' | 'result';

export interface MeihuaStageEvidence {
  key: string;
  status: '已计算' | '卦象资料缺失';
  stage: MeihuaEvidenceStageKey;
  label: string;
  hexagram: string;
  hexagramFactKey: string | null;
  ti: { name: string; element: string; seasonState: string };
  yong: { name: string; element: string; seasonState: string };
  relation: string;
  support: string[];
  constraints: string[];
  basis: string;
  promptText: string;
  sources: string[];
  limitation: '阶段体用事实只描述主卦、互卦或变卦中的体用五行关系与月令旺衰；阶段标签、支持或限制不得直接解释为现实起因、过程、结果、吉凶或成功率';
}

export interface MeihuaHexagramFact {
  key: string;
  status: '已记录';
  stage: MeihuaEvidenceStageKey;
  label: '主卦' | '互卦' | '变卦';
  hexagram: string;
  symbol: string;
  upperTrigram: string;
  lowerTrigram: string;
  promptText: string;
  sources: string[];
  limitation: '主互变卦象事实只记录当前上下经卦、卦名与卦符；不得由卦名或阶段位置直接推断现实事件、人物、吉凶、成败或应期';
}

export interface MeihuaYaoFact {
  key: string;
  status: '已计算';
  position: number;
  yaoType: string;
  tiYong: '体' | '用';
  isChanging: boolean;
  promptText: string;
  sources: string[];
  limitation: '逐爻事实只记录主卦自下而上的阴阳、体用归属与动爻位置；不得按爻位、阴阳数量或体用数量换算吉凶、概率、人物身份或固定日期';
}

export interface MeihuaYaoCoverageFact {
  key: 'meihua:yao-coverage';
  status: '完整' | '缺少爻位' | '爻位异常' | '动爻异常';
  expectedPositions: number[];
  actualPositions: number[];
  missingPositions: number[];
  duplicatePositions: number[];
  invalidPositions: number[];
  changingPositions: number[];
  yaoFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '六爻覆盖状态只说明当前主卦是否完整保存初爻至上爻且仅有一个动爻；缺少、重复、越界或动爻异常时不得补造阴阳、体用归属、互卦或变卦';
}

export interface MeihuaStageCoverageFact {
  key: 'meihua:stage-coverage';
  status: '完整' | '阶段缺失' | '阶段资料不完整';
  expectedStages: MeihuaEvidenceStageKey[];
  actualStages: MeihuaEvidenceStageKey[];
  missingStages: MeihuaEvidenceStageKey[];
  incompleteStages: MeihuaEvidenceStageKey[];
  stageFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '阶段覆盖状态只说明主卦、互卦、变卦体用事实是否齐全；阶段缺失或卦象资料不完整时不得反推互卦过程、变卦结果、卦名或上下经卦';
}

export interface MeihuaTransitionFact {
  key: string;
  status: '连续' | '跨阶段缺口';
  fromStageKey: string;
  toStageKey: string;
  fromStage: MeihuaEvidenceStageKey;
  toStage: MeihuaEvidenceStageKey;
  fromRelation: string;
  toRelation: string;
  promptText: string;
  sources: string[];
  limitation: '阶段推进事实只比较相邻已记录阶段的体用关系变化；不得把卦内先后直接写成现实事件必然按同样顺序发生，跨阶段缺口时更不得补造中间过程';
}

export interface MeihuaCounterEvidenceFact {
  key: string;
  ownerStageKey: string;
  stage: MeihuaEvidenceStageKey;
  type: '体用关系限制' | '体卦月令限制' | '用卦月令限制' | '现实复核限制';
  status: '已触发';
  detail: string;
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示某一阶段存在泄耗、受克、休囚死或待现实复核等限制；不得把单项反证直接写成现实失败、灾祸、伤病、损失或必然结果';
}

export interface MeihuaCounterSummaryFact {
  key: 'meihua:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明当前阶段核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶总分或成功率';
}

export interface MeihuaTimingFact {
  key: string;
  order: number;
  type: '动爻层位' | '月建旺衰' | '体卦状态' | '原应期条件' | '期限边界';
  sourceStatus: '原结果提供' | '由盘面补齐' | '统一边界';
  ownerFactKeys: string[];
  rawText?: string;
  promptText: string;
  sources: string[];
  limitation: '应期事实只提供动爻层位、体用生克、月令旺衰与现实条件的相对触发；不得把爻位、卦数、阶段数量或旺衰换算唯一日期，也不证明事件必然发生';
}

export interface MeihuaTimingSummaryFact {
  key: 'meihua:timing-summary';
  status: '已提供触发条件' | '仅有期限边界';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只说明当前保存了哪些相对触发与期限边界；不得按条件数量、动爻、卦数或旺衰生成固定天数、绝对日期或事件概率';
}

export interface MeihuaTraditionalFact {
  key: string;
  status: '已映射';
  stage: '主卦' | '互卦' | '变卦';
  hexagram: string;
  kind: '卦辞' | '爻辞' | '用辞';
  yaoPosition?: number;
  applicability: '当前卦辞辅助' | '当前动爻辅助' | '未发动背景' | '特殊用辞背景';
  originalText: string;
  promptText: string;
  traditionalSignals: string[];
  topicTags: string[];
  sources: string[];
  limitation: '卦辞与爻辞是《周易》传统取象原文，只用于当前主互变结构和动爻层位的辅助解释，不证明现实吉凶、婚育、疾病、伤亡、诉讼、财物得失、人物意图或固定时间结果';
}

export interface MeihuaCalculationStep {
  key: string;
  target: '上卦' | '下卦' | '动爻';
  expression: string;
  modulus?: 6 | 8;
  remainder?: number;
  result?: number;
  promptText: string;
}

export interface MeihuaCalculationFact {
  key: string;
  status: '完整' | '缺少中间参数' | '计算不一致';
  methodKey: MeihuaDivinationMethod | '未记录';
  methodLabel: string;
  inputs: Record<string, string | number>;
  steps: MeihuaCalculationStep[];
  resolvedResult: {
    upperTrigram: string;
    lowerTrigram: string;
    movingYao: number;
  };
  compatibilityNote?: string;
  promptText: string;
  sources: string[];
  limitation: '取数算式只证明当前上下卦与动爻索引如何由输入或随机取数得到，不证明卦象预测有效性、现实吉凶或固定应期';
}

export interface MeihuaEvidenceCalculationStep {
  key: string;
  stage:
    | '起卦取数核验'
    | '主互变卦象构造'
    | '六爻与动爻核验'
    | '阶段体用计算'
    | '阶段推进核验'
    | '反证与应期核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明起卦取数、主互变卦象、六爻动爻、阶段体用、推进、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期';
}

export interface MeihuaSummaryFact {
  key: 'meihua:evidence-summary';
  status: '证据链完整' | '部分资料缺失' | '阶段链不完整';
  factKeys: string[];
  hexagramFactCount: number;
  yaoFactCount: number;
  stageFactCount: number;
  transitionFactCount: number;
  traditionalFactCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '梅花证据汇总只统计起卦、主互变卦象、六爻动爻、阶段体用、推进、传统文本、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图或唯一日期';
}

export interface MeihuaLimitationFact {
  key: string;
  type:
    | '起卦与随机来源边界'
    | '卦象与逐爻资料边界'
    | '阶段体用边界'
    | '阶段推进与反证边界'
    | '应期边界'
    | '传统文本与高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束梅花起卦、卦象、逐爻、体用、推进、传统卦爻辞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、婚育疾病、伤亡诉讼、事件概率或固定应期的证据';
}

export interface MeihuaEvidenceAnalysis {
  key: 'meihua:evidence';
  status: '已计算';
  calculationFact: MeihuaCalculationFact;
  calculationFacts: string[];
  calculationSteps: MeihuaEvidenceCalculationStep[];
  calculationChain: string[];
  hexagramStructureFacts: MeihuaHexagramFact[];
  hexagramFacts: string[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  yaoFacts: string[];
  monthBranch: string;
  movingYao: number;
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  transitionFacts: MeihuaTransitionFact[];
  transitions: string[];
  timingFacts: MeihuaTimingFact[];
  timingSummaryFact: MeihuaTimingSummaryFact;
  timingConditions: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  counterSummaryFact: MeihuaCounterSummaryFact;
  counterEvidence: string[];
  traditionalFacts: MeihuaTraditionalFact[];
  summaryFact: MeihuaSummaryFact;
  limitations: string[];
  limitationFacts: MeihuaLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const TRADITIONAL_FACT_LIMITATION =
  '卦辞与爻辞是《周易》传统取象原文，只用于当前主互变结构和动爻层位的辅助解释，不证明现实吉凶、婚育、疾病、伤亡、诉讼、财物得失、人物意图或固定时间结果' as const;
const CALCULATION_FACT_LIMITATION =
  '取数算式只证明当前上下卦与动爻索引如何由输入或随机取数得到，不证明卦象预测有效性、现实吉凶或固定应期' as const;
const STAGE_FACT_LIMITATION =
  '阶段体用事实只描述主卦、互卦或变卦中的体用五行关系与月令旺衰；阶段标签、支持或限制不得直接解释为现实起因、过程、结果、吉凶或成功率' as const;
const HEXAGRAM_FACT_LIMITATION =
  '主互变卦象事实只记录当前上下经卦、卦名与卦符；不得由卦名或阶段位置直接推断现实事件、人物、吉凶、成败或应期' as const;
const YAO_FACT_LIMITATION =
  '逐爻事实只记录主卦自下而上的阴阳、体用归属与动爻位置；不得按爻位、阴阳数量或体用数量换算吉凶、概率、人物身份或固定日期' as const;
const YAO_COVERAGE_LIMITATION =
  '六爻覆盖状态只说明当前主卦是否完整保存初爻至上爻且仅有一个动爻；缺少、重复、越界或动爻异常时不得补造阴阳、体用归属、互卦或变卦' as const;
const STAGE_COVERAGE_LIMITATION =
  '阶段覆盖状态只说明主卦、互卦、变卦体用事实是否齐全；阶段缺失或卦象资料不完整时不得反推互卦过程、变卦结果、卦名或上下经卦' as const;
const TRANSITION_FACT_LIMITATION =
  '阶段推进事实只比较相邻已记录阶段的体用关系变化；不得把卦内先后直接写成现实事件必然按同样顺序发生，跨阶段缺口时更不得补造中间过程' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示某一阶段存在泄耗、受克、休囚死或待现实复核等限制；不得把单项反证直接写成现实失败、灾祸、伤病、损失或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前阶段核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶总分或成功率' as const;
const TIMING_FACT_LIMITATION =
  '应期事实只提供动爻层位、体用生克、月令旺衰与现实条件的相对触发；不得把爻位、卦数、阶段数量或旺衰换算唯一日期，也不证明事件必然发生' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只说明当前保存了哪些相对触发与期限边界；不得按条件数量、动爻、卦数或旺衰生成固定天数、绝对日期或事件概率' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明起卦取数、主互变卦象、六爻动爻、阶段体用、推进、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '梅花证据汇总只统计起卦、主互变卦象、六爻动爻、阶段体用、推进、传统文本、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束梅花起卦、卦象、逐爻、体用、推进、传统卦爻辞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、婚育疾病、伤亡诉讼、事件概率或固定应期的证据' as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function classifyTraditionalSignals(text: string): string[] {
  const riskText = text.replace(/无咎|无悔|悔亡|无不利/g, '');
  const signals = unique([
    /吉|亨|利|无咎|悔亡|无悔|无不利/.test(text) ? '传统有利或通达标签' : '',
    /凶|厉|吝|悔|咎|灾|不利|无攸利/.test(riskText) ? '传统风险或受限标签' : '',
    /贞|永贞/.test(text) ? '守正与持续条件标签' : '',
    /往|征|涉|行|进|退|出|入/.test(text) ? '行动与进退标签' : '',
  ]);
  return signals.length ? signals : ['未见明确吉凶或进退标签'];
}

function classifyTraditionalTopics(text: string): string[] {
  const topics = unique([
    /女|妇|婚|归妹|孕|夫|妻/.test(text) ? '关系与婚育类象' : '',
    /死|疾|病|灾|伤|血|丧|亡/.test(text) ? '健康伤亡与损失类象' : '',
    /讼|狱|刑|伐|师|寇|攻/.test(text) ? '争议、刑罚与攻守类象' : '',
    /财|资|获|得|食|畜|货/.test(text) ? '资源与得失类象' : '',
    /年|月|日|岁|旬|三年|八月/.test(text) ? '传统时间措辞' : '',
    /王|君子|大人|小人|侯/.test(text) ? '身份与角色类象' : '',
  ]);
  return topics.length ? topics : ['通用处境类象'];
}

export function conditionMeihuaTraditionalText(
  text: string,
  context: {
    stage: MeihuaTraditionalFact['stage'];
    hexagram: string;
    kind: MeihuaTraditionalFact['kind'];
    yaoPosition?: number;
    isMoving?: boolean;
  },
): Pick<MeihuaTraditionalFact, 'promptText' | 'traditionalSignals' | 'topicTags'> {
  const traditionalSignals = classifyTraditionalSignals(text);
  const topicTags = classifyTraditionalTopics(text);
  const location =
    context.kind === '卦辞'
      ? `${context.stage}${context.hexagram}卦辞`
      : context.kind === '用辞'
        ? `${context.stage}${context.hexagram}特殊用辞`
        : `${context.stage}${context.hexagram}第${context.yaoPosition ?? '?'}爻爻辞`;
  const promptText =
    context.kind === '用辞'
      ? `${location}：仅六爻皆变时使用；当前不满足六爻皆变，不作为本次判断依据`
      : context.kind === '卦辞'
        ? `${location}：${traditionalSignals.join('、')}；${topicTags.join('、')}`
        : `${location}：${context.isMoving ? '当前爻位已发动；' : ''}${traditionalSignals.join('、')}；${topicTags.join('、')}`;
  return {
    promptText,
    traditionalSignals,
    topicTags,
  };
}

function buildTraditionalFacts(data: MeihuaData): MeihuaTraditionalFact[] {
  const stages = [
    ['主卦', data.mainHexagram],
    ['互卦', data.interHexagram],
    ['变卦', data.changedHexagram],
  ] as const;
  return stages.flatMap(([stage, hexagram]) => {
    if (!hexagram) return [];
    const description = conditionMeihuaTraditionalText(hexagram.description, {
      stage,
      hexagram: hexagram.name,
      kind: '卦辞',
    });
    const guaFact: MeihuaTraditionalFact = {
      key: `${stage}:${hexagram.name}:卦辞`,
      status: '已映射',
      stage,
      hexagram: hexagram.name,
      kind: '卦辞',
      applicability: '当前卦辞辅助',
      originalText: hexagram.description,
      promptText: description.promptText,
      traditionalSignals: description.traditionalSignals,
      topicTags: description.topicTags,
      sources: ['《周易》卦辞', '当前六十四卦原文资料'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    };
    const yaoFacts = (hexagram.yaoCi ?? []).map((originalText, index): MeihuaTraditionalFact => {
      const yaoPosition = index + 1;
      const isMoving = stage === '主卦' && yaoPosition === data.movingYao.position;
      const conditioned = conditionMeihuaTraditionalText(originalText, {
        stage,
        hexagram: hexagram.name,
        kind: '爻辞',
        yaoPosition,
        isMoving,
      });
      return {
        key: `${stage}:${hexagram.name}:爻辞:${yaoPosition}`,
        status: '已映射',
        stage,
        hexagram: hexagram.name,
        kind: '爻辞',
        yaoPosition,
        applicability: isMoving ? '当前动爻辅助' : '未发动背景',
        originalText,
        promptText: conditioned.promptText,
        traditionalSignals: conditioned.traditionalSignals,
        topicTags: conditioned.topicTags,
        sources: ['《周易》爻辞', '当前六十四卦逐爻原文资料'],
        limitation: TRADITIONAL_FACT_LIMITATION,
      };
    });
    const yongFact = hexagram.yongCi
      ? (() => {
          const conditioned = conditionMeihuaTraditionalText(hexagram.yongCi, {
            stage,
            hexagram: hexagram.name,
            kind: '用辞',
          });
          return {
            key: `${stage}:${hexagram.name}:用辞`,
            status: '已映射',
            stage,
            hexagram: hexagram.name,
            kind: '用辞',
            applicability: '特殊用辞背景',
            originalText: hexagram.yongCi,
            promptText: conditioned.promptText,
            traditionalSignals: conditioned.traditionalSignals,
            topicTags: conditioned.topicTags,
            sources: ['《周易》乾坤用九用六', '当前六十四卦特殊用辞资料'],
            limitation: TRADITIONAL_FACT_LIMITATION,
          } satisfies MeihuaTraditionalFact;
        })()
      : null;
    return [guaFact, ...yaoFacts, ...(yongFact ? [yongFact] : [])];
  });
}

const trigramByName = new Map(
  Object.values(trigramsByIndex)
    .filter(Boolean)
    .map((item) => [item.name, item]),
);

function relationOf(yong: string, ti: string) {
  if (yong === ti) return '比和';
  if (isSheng(yong, ti)) return '用生体';
  if (isSheng(ti, yong)) return '体生用';
  if (isKe(yong, ti)) return '用克体';
  if (isKe(ti, yong)) return '体克用';
  return '关系未定';
}

function relationToOriginalTi(label: '体互' | '用互', source: string, originalTi: string) {
  if (source === originalTi) return `${label}与原体比和`;
  if (isSheng(source, originalTi)) return `${label}生原体`;
  if (isSheng(originalTi, source)) return `原体生${label}`;
  if (isKe(source, originalTi)) return `${label}克原体`;
  if (isKe(originalTi, source)) return `原体克${label}`;
  return '关系未定';
}

function relationEvidence(relation: string) {
  switch (relation) {
    case '用生体':
      return { support: ['外部条件生扶体卦'], constraints: [] };
    case '比和':
      return { support: ['体用同五行，关系同气'], constraints: ['仍须结合旺衰与现实条件'] };
    case '体克用':
      return { support: ['体卦对用卦具有制约能力'], constraints: ['主动推进可能伴随消耗'] };
    case '体生用':
      return { support: ['体卦向事项一方投入'], constraints: ['体卦存在泄耗'] };
    case '用克体':
      return { support: [], constraints: ['外部事项对体卦形成压力'] };
    default:
      return { support: [], constraints: ['现有资料不足以确定五行关系'] };
  }
}

function stateEvidence(role: '体' | '用', state: string) {
  if (state === '旺' || state === '相')
    return { support: [`${role}卦得月令${state}`], constraints: [] };
  if (state === '休' || state === '囚' || state === '死') {
    return { support: [], constraints: [`${role}卦月令${state}`] };
  }
  return { support: [], constraints: [] };
}

function createStage(params: {
  stage: MeihuaEvidenceStageKey;
  label: string;
  hexagram: string;
  hexagramFactKey: string | null;
  ti: { name: string; element: string };
  yong: { name: string; element: string };
  monthBranch: string;
  basis: string;
}): MeihuaStageEvidence {
  const relation = relationOf(params.yong.element, params.ti.element);
  const relationItems = relationEvidence(relation);
  const tiState = getSeasonState(params.ti.element, params.monthBranch);
  const yongState = getSeasonState(params.yong.element, params.monthBranch);
  const tiItems = stateEvidence('体', tiState);
  const yongItems = stateEvidence('用', yongState);
  const stage: MeihuaStageEvidence = {
    key: `meihua:stage:${params.stage}`,
    status: params.hexagramFactKey ? '已计算' : '卦象资料缺失',
    stage: params.stage,
    label: params.label,
    hexagram: params.hexagram,
    hexagramFactKey: params.hexagramFactKey,
    ti: { ...params.ti, seasonState: tiState },
    yong: { ...params.yong, seasonState: yongState },
    relation,
    support: [...relationItems.support, ...tiItems.support, ...yongItems.support],
    constraints: [...relationItems.constraints, ...tiItems.constraints, ...yongItems.constraints],
    basis: params.basis,
    promptText: '',
    sources: [
      '动爻所在经卦定体用规则',
      '主卦、互卦、变卦上下经卦五行',
      `月建${params.monthBranch}与五行旺相休囚死关系`,
    ],
    limitation: STAGE_FACT_LIMITATION,
  };
  stage.promptText = `${formatStage(stage)}；依据：${stage.basis}${stage.status === '卦象资料缺失' ? '；卦象结构资料未记录' : ''}`;
  return stage;
}

function formatStage(stage: MeihuaStageEvidence) {
  return `${stage.label}${stage.hexagram}：体卦${stage.ti.name}${stage.ti.element}，用卦${stage.yong.name}${stage.yong.element}，关系${stage.relation}`;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedRemainder(value: number, modulus: 6 | 8): number {
  return value % modulus || modulus;
}

function formatRemainderCalculation(
  target: MeihuaCalculationStep['target'],
  expression: string,
  value: unknown,
  modulus: 6 | 8,
  index: unknown,
): string {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(index)) {
    return `${target}取数资料不完整`;
  }
  const remainder = (value as number) % modulus;
  const zeroRemainderNote = remainder === 0 ? `（余0按${modulus}计索引）` : '';
  return `${target}=(${expression})除以${modulus}，余数为${remainder}${zeroRemainderNote}，索引为${index as number}`;
}

function sumSafeIntegers(...values: unknown[]): number | undefined {
  if (!values.every(Number.isSafeInteger)) return undefined;
  const total = values.reduce<number>((current, value) => current + (value as number), 0);
  return Number.isSafeInteger(total) ? total : undefined;
}

function safeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) ? (value as number) : undefined;
}

function hasCharacterCalculationInputs(
  calculation: NonNullable<MeihuaData['calculation']>,
): boolean {
  const count = calculation.characterCount;
  if (!Number.isSafeInteger(count) || count! < 1 || count! > 100) return false;
  if (count === 1) {
    return (
      Number.isSafeInteger(calculation.characterLeftStrokes) &&
      calculation.characterLeftStrokes! > 0 &&
      Number.isSafeInteger(calculation.characterRightStrokes) &&
      calculation.characterRightStrokes! > 0
    );
  }
  if (count! <= 3) {
    const strokeCounts = calculation.characterStrokeCounts;
    return (
      strokeCounts !== undefined &&
      strokeCounts.length === count &&
      strokeCounts.every((value) => Number.isSafeInteger(value) && value > 0)
    );
  }
  if (count! <= 10) {
    const tones = calculation.characterTones;
    return (
      tones !== undefined &&
      tones.length === count &&
      tones.every((value) => Number.isInteger(value) && value >= 1 && value <= 4)
    );
  }
  return true;
}

function getExpectedCharacterNumbers(
  calculation: NonNullable<MeihuaData['calculation']>,
): { upper: number; lower: number; total: number } | undefined {
  if (!hasCharacterCalculationInputs(calculation)) return undefined;
  const count = calculation.characterCount as number;
  let upper: number | undefined;
  let lower: number | undefined;
  if (count === 1) {
    upper = calculation.characterLeftStrokes;
    lower = calculation.characterRightStrokes;
  } else if (count <= 3) {
    const strokeCounts = calculation.characterStrokeCounts as number[];
    const split = Math.floor(count / 2);
    upper = sumSafeIntegers(...strokeCounts.slice(0, split));
    lower = sumSafeIntegers(...strokeCounts.slice(split));
  } else if (count <= 10) {
    const tones = calculation.characterTones as number[];
    const split = Math.floor(count / 2);
    upper = sumSafeIntegers(...tones.slice(0, split));
    lower = sumSafeIntegers(...tones.slice(split));
  } else {
    upper = Math.floor(count / 2);
    lower = count - upper;
  }
  if (upper === undefined || lower === undefined) return undefined;
  const total = sumSafeIntegers(upper, lower);
  return total === undefined ? undefined : { upper, lower, total };
}

function validateMeihuaCalculation(data: MeihuaData): {
  missing: string[];
  mismatches: string[];
} {
  const calculation = data.calculation;
  const missing: string[] = [];
  const mismatches: string[] = [];
  if (!calculation) missing.push('起卦计算记录');

  const requireSafeInteger = (value: unknown, label: string): number | undefined => {
    if (!Number.isSafeInteger(value)) {
      missing.push(label);
      return undefined;
    }
    return value as number;
  };
  const compare = (label: string, recorded: unknown, expected: number | undefined) => {
    if (expected !== undefined && recorded !== expected) {
      mismatches.push(`${label}记录${recorded ?? '缺失'}，按输入应为${expected}`);
    }
  };
  const branchIndex = (branch: unknown): number | undefined => {
    if (typeof branch !== 'string') return undefined;
    const index = dizhi.indexOf(branch);
    return index < 0 ? undefined : index + 1;
  };
  const compareRemainder = (
    label: string,
    recorded: unknown,
    value: number | undefined,
    modulus: 6 | 8,
  ) => {
    if (value !== undefined) compare(label, recorded, normalizedRemainder(value, modulus));
  };
  const sum = (...values: Array<number | undefined>): number | undefined => {
    if (values.some((value) => value === undefined)) return undefined;
    const total = values.reduce<number>((current, value) => current + (value as number), 0);
    if (!Number.isSafeInteger(total)) return undefined;
    return total;
  };

  if (calculation) {
    switch (calculation.methodKey) {
      case 'time':
      case 'timeTrigram': {
        const yearZhiIndex = branchIndex(calculation.yearZhi);
        const timeZhiIndex = branchIndex(calculation.timeZhi);
        const month = requireSafeInteger(calculation.month, '农历月份');
        const day = requireSafeInteger(calculation.day, '农历日期');
        if (yearZhiIndex === undefined) missing.push('有效的农历年支');
        if (timeZhiIndex === undefined) missing.push('有效的时支');
        if (month !== undefined && (month < 1 || month > 12)) missing.push('有效的农历月份');
        if (day !== undefined && (day < 1 || day > 30)) missing.push('有效的农历日期');
        compare('年支序', calculation.yearZhiIndex, yearZhiIndex);
        compare('时支序', calculation.timeZhiIndex, timeZhiIndex);
        const upperTotal = sum(yearZhiIndex, month, day);
        const fullTotal = sum(upperTotal, timeZhiIndex);
        compareRemainder('上卦索引', calculation.upperTrigramIndex, upperTotal, 8);
        compareRemainder('下卦索引', calculation.lowerTrigramIndex, fullTotal, 8);
        compareRemainder('动爻索引', calculation.movingYaoIndex, fullTotal, 6);
        break;
      }
      case 'number':
      case 'sound': {
        const sourceValue = requireSafeInteger(
          calculation.methodKey === 'number' ? calculation.number : calculation.soundCount,
          calculation.methodKey === 'number' ? '起卦数字' : '声音数',
        );
        if (sourceValue !== undefined && sourceValue <= 0) {
          missing.push(calculation.methodKey === 'number' ? '正起卦数字' : '正声音数');
        }
        const timeZhiIndex = branchIndex(calculation.timeZhi);
        if (timeZhiIndex === undefined) missing.push('有效的时支');
        compare('时支序', calculation.timeZhiIndex, timeZhiIndex);
        const totalWithTime = sum(sourceValue, timeZhiIndex);
        compare('数字与时支合数', calculation.totalWithTime, totalWithTime);
        compareRemainder('上卦索引', calculation.upperTrigramIndex, sourceValue, 8);
        compareRemainder(
          '下卦索引',
          calculation.lowerTrigramIndex,
          calculation.methodKey === 'number' ? timeZhiIndex : totalWithTime,
          8,
        );
        compareRemainder('动爻索引', calculation.movingYaoIndex, totalWithTime, 6);
        break;
      }
      case 'character': {
        const expected = getExpectedCharacterNumbers(calculation);
        if (!expected) {
          missing.push('字占原始分段、笔画或声类取数');
          break;
        }
        if (
          calculation.characterText !== undefined &&
          Array.from(calculation.characterText).length !== calculation.characterCount
        ) {
          mismatches.push('字占原文字符数与记录数量不一致');
          break;
        }
        const compareCharacterCache = (label: string, recorded: unknown, value: number) => {
          if (recorded === undefined || recorded === null) {
            missing.push(label);
          } else if (!Number.isSafeInteger(recorded)) {
            mismatches.push(`${label}记录值无效`);
          } else {
            compare(label, recorded, value);
          }
        };
        compareCharacterCache('字占上卦取数', calculation.characterUpperNumber, expected.upper);
        compareCharacterCache('字占下卦取数', calculation.characterLowerNumber, expected.lower);
        compareCharacterCache(
          '上卦索引',
          calculation.upperTrigramIndex,
          normalizedRemainder(expected.upper, 8),
        );
        compareCharacterCache(
          '下卦索引',
          calculation.lowerTrigramIndex,
          normalizedRemainder(expected.lower, 8),
        );
        compareCharacterCache(
          '动爻索引',
          calculation.movingYaoIndex,
          normalizedRemainder(expected.total, 6),
        );
        break;
      }
      case 'direction': {
        const objectIndex =
          MEIHUA_OBJECT_OPTIONS.findIndex((item) => item.value === calculation.objectType) + 1;
        const directionIndex =
          MEIHUA_DIRECTION_OPTIONS.findIndex((item) => item.value === calculation.direction) + 1;
        const timeZhiIndex = branchIndex(calculation.timeZhi);
        if (!objectIndex) missing.push('有效的所见物类');
        if (!directionIndex) missing.push('有效的后天方位');
        if (timeZhiIndex === undefined) missing.push('有效的时支');
        compare('所见物类卦数', calculation.objectTrigramIndex, objectIndex || undefined);
        compare('方位卦数', calculation.directionTrigramIndex, directionIndex || undefined);
        compare('时支序', calculation.timeZhiIndex, timeZhiIndex);
        const total = sum(objectIndex || undefined, directionIndex || undefined, timeZhiIndex);
        compare('物类、方位与时支合数', calculation.totalWithTime, total);
        compare('上卦索引', calculation.upperTrigramIndex, objectIndex || undefined);
        compare('下卦索引', calculation.lowerTrigramIndex, directionIndex || undefined);
        compareRemainder('动爻索引', calculation.movingYaoIndex, total, 6);
        break;
      }
      case 'random': {
        const upper = requireSafeInteger(calculation.upperTrigramIndex, '随机上卦索引');
        const lower = requireSafeInteger(calculation.lowerTrigramIndex, '随机下卦索引');
        const moving = requireSafeInteger(calculation.movingYaoIndex, '随机动爻索引');
        if (upper !== undefined && (upper < 1 || upper > 8))
          mismatches.push(`随机上卦索引${upper}超出1-8`);
        if (lower !== undefined && (lower < 1 || lower > 8))
          mismatches.push(`随机下卦索引${lower}超出1-8`);
        if (moving !== undefined && (moving < 1 || moving > 6))
          mismatches.push(`随机动爻索引${moving}超出1-6`);
        break;
      }
      default:
        missing.push('可识别的梅花起卦方式');
    }

    const usesClockInCalculation =
      calculation.methodKey === 'time' ||
      calculation.methodKey === 'timeTrigram' ||
      calculation.methodKey === 'number' ||
      calculation.methodKey === 'sound' ||
      calculation.methodKey === 'direction';
    if (usesClockInCalculation || calculation.timezoneOffsetMinutes !== undefined) {
      const offset = calculation.timezoneOffsetMinutes;
      if (
        typeof offset !== 'number' ||
        !Number.isInteger(offset) ||
        offset < -720 ||
        offset > 840
      ) {
        missing.push('起卦民用时区偏移');
      } else if (!Number.isSafeInteger(data.timestamp)) {
        missing.push('有效的起卦时间戳');
      } else if (
        data.termReferenceTimestamp !== undefined &&
        !Number.isSafeInteger(data.termReferenceTimestamp)
      ) {
        missing.push('有效的节气参考时间戳');
      } else {
        try {
          const sourceTime = getDivinationTime(
            new Date(data.timestamp),
            offset,
            data.termReferenceTimestamp === undefined
              ? undefined
              : new Date(data.termReferenceTimestamp),
          );
          const sourceHourBranch = sourceTime.ganzhi.hour.slice(-1);
          const pillarLabels = {
            year: '年柱',
            month: '月柱',
            day: '日柱',
            hour: '时柱',
          } as const;
          for (const pillar of Object.keys(pillarLabels) as Array<keyof typeof pillarLabels>) {
            if (data.ganzhi[pillar] !== sourceTime.ganzhi[pillar]) {
              mismatches.push(`盘面${pillarLabels[pillar]}与时间戳重算结果不一致`);
            }
          }
          if (usesClockInCalculation && calculation.timeZhi !== sourceHourBranch) {
            mismatches.push('起卦时支与时间戳重算结果不一致');
          }
          if (calculation.methodKey === 'time' || calculation.methodKey === 'timeTrigram') {
            const sourceLunar = sourceTime.timeInfo.lunar;
            const sourceYearZhi = sourceLunar.yearInChinese.replace(/^农历/, '').charAt(1);
            if (
              calculation.yearZhi !== sourceYearZhi ||
              calculation.month !== sourceLunar.monthNumber ||
              calculation.day !== sourceLunar.dayNumber
            ) {
              mismatches.push('农历年支、月、日与时间戳重算结果不一致');
            }
          }
        } catch {
          missing.push('可重算的起卦时间资料');
        }
      }
      if (usesClockInCalculation) {
        const chartHourBranch = data.ganzhi.hour.slice(-1);
        if (!dizhi.includes(chartHourBranch) || calculation.timeZhi !== chartHourBranch) {
          mismatches.push('起卦时支与盘面时柱不一致');
        }
      }
    }

    const checkBoardTrigram = (label: string, index: unknown, name: string) => {
      if (!Number.isSafeInteger(index)) return;
      const trigram = trigramsByIndex[index as number];
      if (!trigram || trigram.name !== name) {
        mismatches.push(`${label}记录索引${index}与主卦${name}不一致`);
      }
    };
    checkBoardTrigram('上卦', calculation.upperTrigramIndex, data.mainHexagram.upper);
    checkBoardTrigram('下卦', calculation.lowerTrigramIndex, data.mainHexagram.lower);
    compare('主卦动爻位置', data.movingYao.position, calculation.movingYaoIndex);
  }

  const upper = trigramByName.get(data.mainHexagram.upper);
  const lower = trigramByName.get(data.mainHexagram.lower);
  const moving = data.movingYao.position;
  if (upper && lower && Number.isInteger(moving) && moving >= 1 && moving <= 6) {
    const mainLines = [...lower.lines, ...upper.lines];
    const expectedYaoName = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][moving - 1];
    if (data.movingYao.yaoName !== expectedYaoName) {
      mismatches.push('动爻名称与爻位不一致');
    }
    for (const line of data.yaosDetail ?? []) {
      const position = line.position;
      if (!Number.isInteger(position) || position < 1 || position > 6) {
        mismatches.push('逐爻记录含无效爻位');
        continue;
      }
      const expectedType = mainLines[position - 1] === 1 ? '阳' : '阴';
      const expectedRole = position <= 3 === moving <= 3 ? '用' : '体';
      if (
        line.yaoType !== expectedType ||
        line.tiYong !== expectedRole ||
        line.isChanging !== (position === moving)
      ) {
        mismatches.push(`第${position}爻记录与主卦、动爻体用不一致`);
      }
    }
    const recordedPositions = (data.yaosDetail ?? []).map((line) => line.position);
    if (new Set(recordedPositions).size !== recordedPositions.length) {
      mismatches.push('逐爻记录含重复爻位');
    }
    const changedLines = [...mainLines];
    changedLines[moving - 1] = 1 - changedLines[moving - 1];
    const isPureQianOrKun =
      upper.name === lower.name && (upper.name === '乾' || upper.name === '坤');
    const interSource = isPureQianOrKun ? changedLines : mainLines;
    const findTrigram = (lines: number[]) =>
      Object.values(trigramsByIndex).find(
        (item) => item && item.lines.every((line, index) => line === lines[index]),
      );
    const interLower = findTrigram(interSource.slice(1, 4));
    const interUpper = findTrigram(interSource.slice(2, 5));
    const changedLower = findTrigram(changedLines.slice(0, 3));
    const changedUpper = findTrigram(changedLines.slice(3, 6));
    if (interLower && interUpper && changedLower && changedUpper) {
      const checkHexagram = (
        label: string,
        recorded:
          | {
              name: string;
              symbol: string;
              upper: string;
              lower: string;
              description: string;
              yaoCi?: string[];
              yongCi?: string;
              movingYaoCi?: string;
            }
          | null
          | undefined,
        alias: string | undefined,
        expectedUpper: typeof upper,
        expectedLower: typeof lower,
      ) => {
        const expected = findHexagramByTrigrams(
          Number(Object.entries(trigramsByIndex).find(([, item]) => item === expectedUpper)?.[0]),
          Number(Object.entries(trigramsByIndex).find(([, item]) => item === expectedLower)?.[0]),
        );
        if (alias?.trim() && alias !== expected.name) {
          mismatches.push(`${label}别名与主卦六爻推得的${expected.name}不一致`);
        }
        if (
          recorded &&
          (recorded.name !== expected.name ||
            recorded.symbol !== expected.symbol ||
            recorded.upper !== expectedUpper.name ||
            recorded.lower !== expectedLower.name)
        ) {
          mismatches.push(`${label}记录与主卦六爻推得的${expected.name}不一致`);
        }
        if (
          recorded &&
          ((recorded.description && recorded.description !== expected.description) ||
            (recorded.yaoCi &&
              (recorded.yaoCi.length !== expected.yaoCi?.length ||
                recorded.yaoCi.some((line, index) => line !== expected.yaoCi?.[index]))) ||
            (recorded.yongCi && recorded.yongCi !== expected.yongCi) ||
            (recorded.movingYaoCi && recorded.movingYaoCi !== expected.yaoCi?.[moving - 1]))
        ) {
          mismatches.push(`${label}${expected.name}卦爻辞与固定文本不一致`);
        }
      };
      checkHexagram('主卦', data.mainHexagram, data.originalName, upper, lower);
      checkHexagram('互卦', data.interHexagram, data.interName, interUpper, interLower);
      checkHexagram('变卦', data.changedHexagram, data.changedName, changedUpper, changedLower);

      const movingInLower = moving <= 3;
      const checkGua = (
        label: string,
        recorded: { name: string; element: string } | null | undefined,
        expected: typeof upper,
      ) => {
        if (
          recorded &&
          (recorded.name !== expected.name || recorded.element !== expected.element)
        ) {
          mismatches.push(`${label}记录与动爻及卦象不一致`);
        }
      };
      checkGua('体卦', data.tiGua, movingInLower ? upper : lower);
      checkGua('用卦', data.yongGua, movingInLower ? lower : upper);
      checkGua('体互', data.interTiGua, movingInLower ? interUpper : interLower);
      checkGua('用互', data.interYongGua, movingInLower ? interLower : interUpper);
      checkGua('变后体卦', data.changedTiGua, movingInLower ? changedUpper : changedLower);
      checkGua('变后用卦', data.changedYongGua, movingInLower ? changedLower : changedUpper);

      const expectedTi = movingInLower ? upper : lower;
      const expectedYong = movingInLower ? lower : upper;
      const expectedRelation = relationOf(expectedYong.element, expectedTi.element);
      const expectedDisplayRelation = expectedRelation === '比和' ? '体用比和' : expectedRelation;
      if (
        data.analysis.tiYongRelation &&
        data.analysis.tiYongRelation !== expectedDisplayRelation
      ) {
        mismatches.push('主卦体用关系记录与卦象不一致');
      }
      if (data.analysis.tiYongRaw && data.analysis.tiYongRaw !== expectedRelation) {
        mismatches.push('主卦体用原始关系记录与卦象不一致');
      }
      const expectedInterTi = movingInLower ? interUpper : interLower;
      const expectedInterYong = movingInLower ? interLower : interUpper;
      if (
        data.analysis.inter1Relation &&
        data.analysis.inter1Relation !==
          relationToOriginalTi('体互', expectedInterTi.element, expectedTi.element)
      ) {
        mismatches.push('体互对原体关系记录与互卦不一致');
      }
      if (
        data.analysis.inter2Relation &&
        data.analysis.inter2Relation !==
          relationToOriginalTi('用互', expectedInterYong.element, expectedTi.element)
      ) {
        mismatches.push('用互对原体关系记录与互卦不一致');
      }
      const expectedChangedRelation = relationOf(
        (movingInLower ? changedLower : changedUpper).element,
        (movingInLower ? changedUpper : changedLower).element,
      );
      const expectedChangedDisplay =
        expectedChangedRelation === '比和' ? '体用比和' : expectedChangedRelation;
      if (
        (data.analysis.changedRelation &&
          data.analysis.changedRelation !== expectedChangedDisplay) ||
        (data.analysis.changedTiYongRelation &&
          data.analysis.changedTiYongRelation !== expectedChangedDisplay)
      ) {
        mismatches.push('变卦体用关系记录与卦象不一致');
      }

      const monthBranch = data.ganzhi.month.slice(-1);
      if (dizhi.includes(monthBranch)) {
        const ti = movingInLower ? upper : lower;
        const yong = movingInLower ? lower : upper;
        const tiSeasonState = getSeasonState(ti.element, monthBranch);
        if (
          data.analysis.monthBranch !== monthBranch ||
          data.analysis.monthElement !== getBranchWuxing(monthBranch) ||
          data.analysis.tiSeasonState !== tiSeasonState ||
          data.analysis.yongSeasonState !== getSeasonState(yong.element, monthBranch)
        ) {
          mismatches.push('体用月令旺衰记录与月建及主卦不一致');
        }
        if (data.analysis.yingQi !== undefined) {
          const expected = estimateYingQi({
            movingYaoIndex: moving,
            tiElement: ti.element,
            yongElement: yong.element,
            seasonState: tiSeasonState,
          });
          if (
            !Array.isArray(data.analysis.yingQi) ||
            data.analysis.yingQi.length !== expected.length ||
            data.analysis.yingQi.some((item, index) => item !== expected[index])
          ) {
            mismatches.push('原应期条件与动爻、体用和月令重算结果不一致');
          }
        }
      }
    }
  }

  return { missing: Array.from(new Set(missing)), mismatches: Array.from(new Set(mismatches)) };
}

function appendResolvedResultFacts(facts: string[], data: MeihuaData) {
  facts.push(
    `已确定起卦结果：上卦${data.mainHexagram.upper}、下卦${data.mainHexagram.lower}、动爻第${data.movingYao.position}爻`,
  );
}

function buildCalculationFacts(data: MeihuaData): string[] {
  const calculation = data.calculation;
  if (!calculation) return ['起卦计算过程未附，无法复核上下卦与动爻索引来源'];
  const facts = [`起卦方式：${calculation.method}`];
  if (calculation.methodKey === 'time' || calculation.methodKey === 'timeTrigram') {
    const hasCompleteTimeInputs =
      hasText(calculation.yearZhi) &&
      hasFiniteNumber(calculation.yearZhiIndex) &&
      hasFiniteNumber(calculation.month) &&
      hasFiniteNumber(calculation.day) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteTimeInputs) {
      facts.push(
        `时间取数：农历年支${calculation.yearZhi}序${calculation.yearZhiIndex}、月数${calculation.month}、日数${calculation.day}、时支${calculation.timeZhi}序${calculation.timeZhiIndex}`,
        formatRemainderCalculation(
          '上卦',
          `${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}`,
          sumSafeIntegers(calculation.yearZhiIndex, calculation.month, calculation.day),
          8,
          calculation.upperTrigramIndex,
        ),
        formatRemainderCalculation(
          '下卦',
          `${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}+${calculation.timeZhiIndex}`,
          sumSafeIntegers(
            calculation.yearZhiIndex,
            calculation.month,
            calculation.day,
            calculation.timeZhiIndex,
          ),
          8,
          calculation.lowerTrigramIndex,
        ),
        formatRemainderCalculation(
          '动爻',
          `${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}+${calculation.timeZhiIndex}`,
          sumSafeIntegers(
            calculation.yearZhiIndex,
            calculation.month,
            calculation.day,
            calculation.timeZhiIndex,
          ),
          6,
          calculation.movingYaoIndex,
        ),
      );
    } else {
      facts.push('现有资料未附完整时间取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'number') {
    if (hasFiniteNumber(calculation.number)) facts.push(`输入数字：${calculation.number}`);
    const hasCompleteNumberInputs =
      hasFiniteNumber(calculation.number) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteNumberInputs) {
      facts.push(
        `数字取数：输入${calculation.number}，时支${calculation.timeZhi}序${calculation.timeZhiIndex}，合计${calculation.totalWithTime}`,
        formatRemainderCalculation(
          '上卦',
          String(calculation.number),
          calculation.number,
          8,
          calculation.upperTrigramIndex,
        ),
        formatRemainderCalculation(
          '下卦',
          String(calculation.timeZhiIndex),
          calculation.timeZhiIndex,
          8,
          calculation.lowerTrigramIndex,
        ),
        formatRemainderCalculation(
          '动爻',
          String(calculation.totalWithTime),
          calculation.totalWithTime,
          6,
          calculation.movingYaoIndex,
        ),
      );
    } else {
      facts.push('现有资料未附完整数字取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'sound') {
    const hasCompleteSoundInputs =
      hasFiniteNumber(calculation.soundCount) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteSoundInputs) {
      facts.push(
        `声音取数：所闻声音数${calculation.soundCount}，时支${calculation.timeZhi}序${calculation.timeZhiIndex}，合计${calculation.totalWithTime}`,
        formatRemainderCalculation(
          '上卦',
          String(calculation.soundCount),
          calculation.soundCount,
          8,
          calculation.upperTrigramIndex,
        ),
        formatRemainderCalculation(
          '下卦',
          String(calculation.totalWithTime),
          calculation.totalWithTime,
          8,
          calculation.lowerTrigramIndex,
        ),
        formatRemainderCalculation(
          '动爻',
          String(calculation.totalWithTime),
          calculation.totalWithTime,
          6,
          calculation.movingYaoIndex,
        ),
      );
    } else {
      facts.push('现有资料未附完整声音取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'character') {
    const hasCharacterNumbers = hasCompleteCharacterCalculation(calculation);
    if (hasCharacterNumbers) {
      const toneText = Array.isArray(calculation.characterTones)
        ? `，传统平上去入声数${calculation.characterTones.join('、')}（不等同于普通话一至四声）`
        : Array.isArray(calculation.characterStrokeCounts)
          ? `，逐字笔画数${calculation.characterStrokeCounts.join('、')}`
          : '';
      facts.push(
        `字数取数：字符数${calculation.characterCount}${toneText}；上卦取数${calculation.characterUpperNumber}，下卦取数${calculation.characterLowerNumber}`,
        formatRemainderCalculation(
          '上卦',
          String(calculation.characterUpperNumber),
          calculation.characterUpperNumber,
          8,
          calculation.upperTrigramIndex,
        ),
        formatRemainderCalculation(
          '下卦',
          String(calculation.characterLowerNumber),
          calculation.characterLowerNumber,
          8,
          calculation.lowerTrigramIndex,
        ),
        formatRemainderCalculation(
          '动爻',
          `${calculation.characterUpperNumber}+${calculation.characterLowerNumber}`,
          sumSafeIntegers(calculation.characterUpperNumber, calculation.characterLowerNumber),
          6,
          calculation.movingYaoIndex,
        ),
      );
    } else {
      facts.push('现有资料未附完整字数取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'direction') {
    const hasCompleteDirectionInputs =
      hasText(calculation.direction) &&
      hasText(calculation.objectType) &&
      hasFiniteNumber(calculation.objectTrigramIndex) &&
      hasFiniteNumber(calculation.directionTrigramIndex) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteDirectionInputs) {
      facts.push(
        `方位取象：所见物类${MEIHUA_OBJECT_OPTIONS.find((item) => item.value === calculation.objectType)?.label ?? data.mainHexagram.upper}取数${calculation.objectTrigramIndex}，方位${MEIHUA_DIRECTION_OPTIONS.find((item) => item.value === calculation.direction)?.label ?? data.mainHexagram.lower}取数${calculation.directionTrigramIndex}，时支${calculation.timeZhi}序${calculation.timeZhiIndex}`,
        `上卦=${calculation.objectTrigramIndex}`,
        `下卦=${calculation.directionTrigramIndex}`,
        `动爻=(${calculation.objectTrigramIndex}+${calculation.directionTrigramIndex}+${calculation.timeZhiIndex})除6取余为${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('现有资料未附完整方位取象中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'random') {
    if (
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      facts.push(
        `随机取数结果：上卦索引${calculation.upperTrigramIndex}、下卦索引${calculation.lowerTrigramIndex}、动爻${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('现有资料未附完整随机取数索引，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  }
  if (hasText(calculation.compatibilityNote)) {
    facts.push(`兼容口径：${calculation.compatibilityNote}`);
  }
  return facts;
}

function buildMeihuaCalculationFact(
  data: MeihuaData,
  validation = validateMeihuaCalculation(data),
): MeihuaCalculationFact {
  const calculation = data.calculation;
  const methodKey = calculation?.methodKey ?? '未记录';
  const inputs: Record<string, string | number> = {};
  if (typeof calculation?.timezoneOffsetMinutes === 'number') {
    inputs.timezoneOffsetMinutes = calculation.timezoneOffsetMinutes;
  }
  const steps: MeihuaCalculationStep[] = [];
  if (calculation && (methodKey === 'time' || methodKey === 'timeTrigram')) {
    if (hasText(calculation.yearZhi)) inputs.yearZhi = calculation.yearZhi;
    if (hasFiniteNumber(calculation.yearZhiIndex)) inputs.yearZhiIndex = calculation.yearZhiIndex;
    if (hasFiniteNumber(calculation.month)) inputs.lunarMonth = calculation.month;
    if (hasFiniteNumber(calculation.day)) inputs.lunarDay = calculation.day;
    if (hasText(calculation.timeZhi)) inputs.timeZhi = calculation.timeZhi;
    if (hasFiniteNumber(calculation.timeZhiIndex)) inputs.timeZhiIndex = calculation.timeZhiIndex;
    if (
      hasFiniteNumber(calculation.yearZhiIndex) &&
      hasFiniteNumber(calculation.month) &&
      hasFiniteNumber(calculation.day) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      const upperExpression = `${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}`;
      const totalExpression = `${upperExpression}+${calculation.timeZhiIndex}`;
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: upperExpression,
          modulus: 8,
          remainder: (calculation.yearZhiIndex + calculation.month + calculation.day) % 8,
          result: calculation.upperTrigramIndex,
          promptText: formatRemainderCalculation(
            '上卦',
            upperExpression,
            calculation.yearZhiIndex + calculation.month + calculation.day,
            8,
            calculation.upperTrigramIndex,
          ),
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: totalExpression,
          modulus: 8,
          remainder:
            (calculation.yearZhiIndex +
              calculation.month +
              calculation.day +
              calculation.timeZhiIndex) %
            8,
          result: calculation.lowerTrigramIndex,
          promptText: formatRemainderCalculation(
            '下卦',
            totalExpression,
            calculation.yearZhiIndex +
              calculation.month +
              calculation.day +
              calculation.timeZhiIndex,
            8,
            calculation.lowerTrigramIndex,
          ),
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: totalExpression,
          modulus: 6,
          remainder:
            (calculation.yearZhiIndex +
              calculation.month +
              calculation.day +
              calculation.timeZhiIndex) %
            6,
          result: calculation.movingYaoIndex,
          promptText: formatRemainderCalculation(
            '动爻',
            totalExpression,
            calculation.yearZhiIndex +
              calculation.month +
              calculation.day +
              calculation.timeZhiIndex,
            6,
            calculation.movingYaoIndex,
          ),
        },
      );
    }
  } else if (calculation && methodKey === 'number') {
    if (hasFiniteNumber(calculation.number)) inputs.number = calculation.number;
    if (hasText(calculation.timeZhi)) inputs.timeZhi = calculation.timeZhi;
    if (hasFiniteNumber(calculation.timeZhiIndex)) inputs.timeZhiIndex = calculation.timeZhiIndex;
    if (hasFiniteNumber(calculation.totalWithTime))
      inputs.totalWithTime = calculation.totalWithTime;
    if (
      hasFiniteNumber(calculation.number) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: String(calculation.number),
          modulus: 8,
          remainder: calculation.number % 8,
          result: calculation.upperTrigramIndex,
          promptText: formatRemainderCalculation(
            '上卦',
            String(calculation.number),
            calculation.number,
            8,
            calculation.upperTrigramIndex,
          ),
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: String(calculation.timeZhiIndex),
          modulus: 8,
          remainder: calculation.timeZhiIndex % 8,
          result: calculation.lowerTrigramIndex,
          promptText: formatRemainderCalculation(
            '下卦',
            String(calculation.timeZhiIndex),
            calculation.timeZhiIndex,
            8,
            calculation.lowerTrigramIndex,
          ),
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: String(calculation.totalWithTime),
          modulus: 6,
          remainder: calculation.totalWithTime % 6,
          result: calculation.movingYaoIndex,
          promptText: formatRemainderCalculation(
            '动爻',
            String(calculation.totalWithTime),
            calculation.totalWithTime,
            6,
            calculation.movingYaoIndex,
          ),
        },
      );
    }
  } else if (calculation && methodKey === 'sound') {
    if (hasFiniteNumber(calculation.soundCount)) inputs.soundCount = calculation.soundCount;
    if (hasText(calculation.timeZhi)) inputs.timeZhi = calculation.timeZhi;
    if (hasFiniteNumber(calculation.timeZhiIndex)) inputs.timeZhiIndex = calculation.timeZhiIndex;
    if (hasFiniteNumber(calculation.totalWithTime))
      inputs.totalWithTime = calculation.totalWithTime;
    if (
      hasFiniteNumber(calculation.soundCount) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: String(calculation.soundCount),
          modulus: 8,
          remainder: calculation.soundCount % 8,
          result: calculation.upperTrigramIndex,
          promptText: formatRemainderCalculation(
            '上卦',
            String(calculation.soundCount),
            calculation.soundCount,
            8,
            calculation.upperTrigramIndex,
          ),
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: String(calculation.totalWithTime),
          modulus: 8,
          remainder: calculation.totalWithTime % 8,
          result: calculation.lowerTrigramIndex,
          promptText: formatRemainderCalculation(
            '下卦',
            String(calculation.totalWithTime),
            calculation.totalWithTime,
            8,
            calculation.lowerTrigramIndex,
          ),
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: String(calculation.totalWithTime),
          modulus: 6,
          remainder: calculation.totalWithTime % 6,
          result: calculation.movingYaoIndex,
          promptText: formatRemainderCalculation(
            '动爻',
            String(calculation.totalWithTime),
            calculation.totalWithTime,
            6,
            calculation.movingYaoIndex,
          ),
        },
      );
    }
  } else if (calculation && methodKey === 'character') {
    if (hasText(calculation.characterText)) inputs.characterText = calculation.characterText;
    if (hasFiniteNumber(calculation.characterCount))
      inputs.characterCount = calculation.characterCount;
    if (hasText(calculation.characterRule)) inputs.characterRule = calculation.characterRule;
    if (hasFiniteNumber(calculation.characterUpperNumber)) {
      inputs.characterUpperNumber = calculation.characterUpperNumber;
    }
    if (hasFiniteNumber(calculation.characterLowerNumber)) {
      inputs.characterLowerNumber = calculation.characterLowerNumber;
    }
    if (Array.isArray(calculation.characterTones)) {
      inputs.characterTones = calculation.characterTones.join(',');
    }
    if (Array.isArray(calculation.characterStrokeCounts)) {
      inputs.characterStrokeCounts = calculation.characterStrokeCounts.join(',');
    }
    if (hasCompleteCharacterCalculation(calculation)) {
      const characterUpperNumber = safeInteger(calculation.characterUpperNumber);
      const characterLowerNumber = safeInteger(calculation.characterLowerNumber);
      const characterTotal = sumSafeIntegers(characterUpperNumber, characterLowerNumber);
      if (
        characterUpperNumber !== undefined &&
        characterLowerNumber !== undefined &&
        characterTotal !== undefined
      ) {
        steps.push(
          {
            key: 'meihua:calculation:upper',
            target: '上卦',
            expression: String(characterUpperNumber),
            modulus: 8,
            remainder: characterUpperNumber % 8,
            result: calculation.upperTrigramIndex,
            promptText: formatRemainderCalculation(
              '上卦',
              String(characterUpperNumber),
              characterUpperNumber,
              8,
              calculation.upperTrigramIndex,
            ),
          },
          {
            key: 'meihua:calculation:lower',
            target: '下卦',
            expression: String(characterLowerNumber),
            modulus: 8,
            remainder: characterLowerNumber % 8,
            result: calculation.lowerTrigramIndex,
            promptText: formatRemainderCalculation(
              '下卦',
              String(characterLowerNumber),
              characterLowerNumber,
              8,
              calculation.lowerTrigramIndex,
            ),
          },
          {
            key: 'meihua:calculation:moving',
            target: '动爻',
            expression: `${characterUpperNumber}+${characterLowerNumber}`,
            modulus: 6,
            remainder: characterTotal % 6,
            result: calculation.movingYaoIndex,
            promptText: formatRemainderCalculation(
              '动爻',
              `${characterUpperNumber}+${characterLowerNumber}`,
              characterTotal,
              6,
              calculation.movingYaoIndex,
            ),
          },
        );
      }
    }
  } else if (calculation && methodKey === 'direction') {
    if (hasText(calculation.direction)) inputs.direction = calculation.direction;
    if (hasText(calculation.objectType)) inputs.objectType = calculation.objectType;
    if (hasFiniteNumber(calculation.objectTrigramIndex)) {
      inputs.objectTrigramIndex = calculation.objectTrigramIndex;
    }
    if (hasFiniteNumber(calculation.directionTrigramIndex)) {
      inputs.directionTrigramIndex = calculation.directionTrigramIndex;
    }
    if (hasText(calculation.timeZhi)) inputs.timeZhi = calculation.timeZhi;
    if (hasFiniteNumber(calculation.timeZhiIndex)) inputs.timeZhiIndex = calculation.timeZhiIndex;
    if (hasFiniteNumber(calculation.totalWithTime))
      inputs.totalWithTime = calculation.totalWithTime;
    if (
      hasFiniteNumber(calculation.objectTrigramIndex) &&
      hasFiniteNumber(calculation.directionTrigramIndex) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: String(calculation.objectTrigramIndex),
          result: calculation.upperTrigramIndex,
          promptText: `所见物类取上卦数${calculation.objectTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: String(calculation.directionTrigramIndex),
          result: calculation.lowerTrigramIndex,
          promptText: `方位取下卦数${calculation.directionTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: `${calculation.objectTrigramIndex}+${calculation.directionTrigramIndex}+${calculation.timeZhiIndex}`,
          modulus: 6,
          remainder:
            (calculation.objectTrigramIndex +
              calculation.directionTrigramIndex +
              calculation.timeZhiIndex) %
            6,
          result: calculation.movingYaoIndex,
          promptText: formatRemainderCalculation(
            '动爻',
            `${calculation.objectTrigramIndex}+${calculation.directionTrigramIndex}+${calculation.timeZhiIndex}`,
            calculation.objectTrigramIndex +
              calculation.directionTrigramIndex +
              calculation.timeZhiIndex,
            6,
            calculation.movingYaoIndex,
          ),
        },
      );
    }
  } else if (calculation && methodKey === 'random') {
    if (
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: '随机整数1-8',
          result: calculation.upperTrigramIndex,
          promptText: `随机取上卦索引${calculation.upperTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: '随机整数1-8',
          result: calculation.lowerTrigramIndex,
          promptText: `随机取下卦索引${calculation.lowerTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: '随机整数1-6',
          result: calculation.movingYaoIndex,
          promptText: `随机取动爻索引${calculation.movingYaoIndex}`,
        },
      );
    }
  }
  const status = validation.mismatches.length
    ? '计算不一致'
    : steps.length === 3 && validation.missing.length === 0
      ? '完整'
      : '缺少中间参数';
  const calculationFacts =
    status === '完整'
      ? buildCalculationFacts(data)
      : status === '计算不一致'
        ? [
            `起卦取数核验不一致：${validation.mismatches.join('；')}`,
            `排盘记录结果：上卦${data.mainHexagram.upper}、下卦${data.mainHexagram.lower}、动爻第${data.movingYao.position}爻`,
          ]
        : data.calculation
          ? [
              `起卦取数资料不足：${validation.missing.join('、') || '必要中间参数'}`,
              `排盘记录结果：上卦${data.mainHexagram.upper}、下卦${data.mainHexagram.lower}、动爻第${data.movingYao.position}爻`,
            ]
          : buildCalculationFacts(data);
  return {
    key: `calculation:meihua:${methodKey}`,
    status,
    methodKey,
    methodLabel: calculation?.method ?? '未记录起卦方式',
    inputs,
    steps: status === '完整' ? steps : [],
    resolvedResult: {
      upperTrigram: data.mainHexagram.upper,
      lowerTrigram: data.mainHexagram.lower,
      movingYao: data.movingYao.position,
    },
    ...(hasText(calculation?.compatibilityNote)
      ? { compatibilityNote: calculation.compatibilityNote }
      : {}),
    promptText: calculationFacts.join('；'),
    sources: [
      methodKey === 'time' || methodKey === 'timeTrigram'
        ? '《梅花易数》年月日时取数与八卦、六爻取余规则'
        : methodKey === 'number'
          ? '输入数字、时支序与八卦、六爻取余规则'
          : methodKey === 'sound'
            ? '《梅花易数》声音数、时支序与八卦、六爻取余规则'
            : methodKey === 'character'
              ? '《梅花易数》字占字数、分半、声调与八卦、六爻取余规则'
              : methodKey === 'direction'
                ? '《梅花易数》所见物类、后天方位与时支取数规则'
                : methodKey === 'random'
                  ? '随机上下卦与动爻索引记录'
                  : '旧结果已确定的主卦与动爻资料',
      '当前主卦上下经卦与动爻结果',
    ],
    limitation: CALCULATION_FACT_LIMITATION,
  };
}

function buildHexagramStructureFacts(data: MeihuaData): MeihuaHexagramFact[] {
  const isPureQianOrKun =
    data.mainHexagram.upper === data.mainHexagram.lower &&
    (data.mainHexagram.upper === '乾' || data.mainHexagram.upper === '坤');
  const definitions = [
    { stage: 'origin', label: '主卦', hexagram: data.mainHexagram },
    { stage: 'process', label: '互卦', hexagram: data.interHexagram },
    { stage: 'result', label: '变卦', hexagram: data.changedHexagram },
  ] as const;
  return definitions.flatMap(({ stage, label, hexagram }) =>
    hexagram
      ? [
          {
            key: `meihua:hexagram:${stage}`,
            status: '已记录',
            stage,
            label,
            hexagram: hexagram.name,
            symbol: hexagram.symbol,
            upperTrigram: hexagram.upper,
            lowerTrigram: hexagram.lower,
            promptText: `${label}${hexagram.name}${hexagram.symbol}，上${hexagram.upper}下${hexagram.lower}`,
            sources: [
              stage === 'origin'
                ? '起卦上下经卦索引与六十四卦映射'
                : stage === 'process'
                  ? isPureQianOrKun
                    ? '《梅花易数》载“乾坤无互，互其变卦”；据变卦二三四爻取下互、三四五爻取上互'
                    : '主卦二三四爻为下互、三四五爻为上互'
                  : '主卦动爻阴阳翻转与六十四卦映射',
            ],
            limitation: HEXAGRAM_FACT_LIMITATION,
          } satisfies MeihuaHexagramFact,
        ]
      : [],
  );
}

function buildYaoStructureFacts(data: MeihuaData): MeihuaYaoFact[] {
  const occurrences = new Map<number, number>();
  return (data.yaosDetail ?? []).map((item) => {
    const occurrence = (occurrences.get(item.position) ?? 0) + 1;
    occurrences.set(item.position, occurrence);
    return {
      key:
        occurrence === 1
          ? `meihua:yao:${item.position}`
          : `meihua:yao:${item.position}:occurrence:${occurrence}`,
      status: '已计算',
      position: item.position,
      yaoType: item.yaoType,
      tiYong: item.tiYong,
      isChanging: item.isChanging,
      promptText: `第${item.position}爻为${item.yaoType}爻，属${item.tiYong}${item.isChanging ? '，本爻发动' : ''}`,
      sources: ['主卦六爻自下而上阴阳序列', '动爻所在上下经卦与体用归属'],
      limitation: YAO_FACT_LIMITATION,
    };
  });
}

function buildYaoCoverageFact(yaoFacts: MeihuaYaoFact[], movingYao: number): MeihuaYaoCoverageFact {
  const expectedPositions = [1, 2, 3, 4, 5, 6];
  const rawPositions = yaoFacts.map((item) => item.position);
  const actualPositions = [...new Set(rawPositions)].sort((left, right) => left - right);
  const missingPositions = expectedPositions.filter(
    (position) => !actualPositions.includes(position),
  );
  const duplicatePositions = actualPositions.filter(
    (position) => rawPositions.filter((item) => item === position).length > 1,
  );
  const invalidPositions = actualPositions.filter(
    (position) => !Number.isInteger(position) || position < 1 || position > 6,
  );
  const changingPositions = yaoFacts
    .filter((item) => item.isChanging)
    .map((item) => item.position)
    .sort((left, right) => left - right);
  const status: MeihuaYaoCoverageFact['status'] =
    duplicatePositions.length || invalidPositions.length
      ? '爻位异常'
      : missingPositions.length
        ? '缺少爻位'
        : changingPositions.length !== 1 || changingPositions[0] !== movingYao
          ? '动爻异常'
          : '完整';
  const promptText =
    status === '完整'
      ? `六爻完整覆盖初爻至上爻，且仅第${movingYao}爻发动，可核验体用、互卦与变卦来源`
      : status === '缺少爻位'
        ? `六爻资料缺少第${missingPositions.join('、')}爻，不得补造缺失爻、互卦或变卦`
        : status === '爻位异常'
          ? `六爻位置异常：重复${duplicatePositions.join('、') || '无'}；越界${invalidPositions.join('、') || '无'}`
          : `动爻记录异常：逐爻标记为${changingPositions.join('、') || '无'}，排盘动爻为第${movingYao}爻，不得自行改写动爻`;
  return {
    key: 'meihua:yao-coverage',
    status,
    expectedPositions,
    actualPositions,
    missingPositions,
    duplicatePositions,
    invalidPositions,
    changingPositions,
    yaoFactKeys: yaoFacts.map((item) => item.key),
    promptText,
    sources: ['当前逐爻位置、唯一性与动爻标记完整性核验'],
    limitation: YAO_COVERAGE_LIMITATION,
  };
}

function buildStageCoverageFact(stages: MeihuaStageEvidence[]): MeihuaStageCoverageFact {
  const expectedStages: MeihuaEvidenceStageKey[] = ['origin', 'process', 'result'];
  const actualStages = stages.map((item) => item.stage);
  const missingStages = expectedStages.filter((stage) => !actualStages.includes(stage));
  const incompleteStages = stages
    .filter((item) => item.status === '卦象资料缺失')
    .map((item) => item.stage);
  const status: MeihuaStageCoverageFact['status'] = missingStages.length
    ? '阶段缺失'
    : incompleteStages.length
      ? '阶段资料不完整'
      : '完整';
  return {
    key: 'meihua:stage-coverage',
    status,
    expectedStages,
    actualStages,
    missingStages,
    incompleteStages,
    stageFactKeys: stages.map((item) => item.key),
    promptText:
      status === '阶段缺失'
        ? `主互变阶段资料缺少${missingStages.map((stage) => ({ origin: '主卦阶段', process: '互卦阶段', result: '变卦阶段' })[stage]).join('、')}，不得反推缺失阶段体用关系`
        : status === '阶段资料不完整'
          ? `${incompleteStages.map((stage) => ({ origin: '主卦阶段', process: '互卦阶段', result: '变卦阶段' })[stage]).join('、')}缺少对应卦象结构资料，不得补造卦名、卦符或上下经卦`
          : '主卦、互卦、变卦三阶段体用资料完整，可逐段核验',
    sources: ['主卦、互卦、变卦及其体用资料完整性核验'],
    limitation: STAGE_COVERAGE_LIMITATION,
  };
}

function buildTransitionFacts(stages: MeihuaStageEvidence[]): MeihuaTransitionFact[] {
  const order: Record<MeihuaEvidenceStageKey, number> = { origin: 0, process: 1, result: 2 };
  return stages.slice(1).map((stage, index) => {
    const previous = stages[index];
    const status = order[stage.stage] - order[previous.stage] === 1 ? '连续' : '跨阶段缺口';
    return {
      key: `meihua:transition:${previous.stage}:${stage.stage}`,
      status,
      fromStageKey: previous.key,
      toStageKey: stage.key,
      fromStage: previous.stage,
      toStage: stage.stage,
      fromRelation: previous.relation,
      toRelation: stage.relation,
      promptText: `${previous.label}${previous.relation} → ${stage.label}${stage.relation}${status === '跨阶段缺口' ? '；中间阶段资料缺失，不补造过程' : ''}`,
      sources: ['已记录阶段顺序与各阶段体用五行关系比较'],
      limitation: TRANSITION_FACT_LIMITATION,
    } satisfies MeihuaTransitionFact;
  });
}

function classifyCounterType(detail: string): MeihuaCounterEvidenceFact['type'] {
  if (detail.startsWith('体卦月令')) return '体卦月令限制';
  if (detail.startsWith('用卦月令')) return '用卦月令限制';
  if (/现实|仍须|核验/.test(detail)) return '现实复核限制';
  return '体用关系限制';
}

function buildCounterEvidenceFacts(stages: MeihuaStageEvidence[]): MeihuaCounterEvidenceFact[] {
  return stages.flatMap((stage) =>
    unique(stage.constraints).map((detail, index) => ({
      key: `meihua:counter:${stage.stage}:${index + 1}`,
      ownerStageKey: stage.key,
      stage: stage.stage,
      type: classifyCounterType(detail),
      status: '已触发',
      detail,
      promptText: `${stage.label}${stage.hexagram}：${detail}`,
      sources: ['对应阶段体用生克关系与月令旺衰核验'],
      limitation: COUNTER_FACT_LIMITATION,
    })),
  );
}

function buildTimingFacts(
  data: MeihuaData,
  stages: MeihuaStageEvidence[],
  monthBranch: string,
  calculationFact: MeihuaCalculationFact,
  yaoCoverageFact: MeihuaYaoCoverageFact,
  yaoFacts: MeihuaYaoFact[],
): MeihuaTimingFact[] {
  const facts: MeihuaTimingFact[] = [];
  const add = (fact: Omit<MeihuaTimingFact, 'order'>) => {
    if (facts.some((item) => item.promptText === fact.promptText)) return;
    facts.push({ ...fact, order: facts.length + 1 });
  };
  const verifiedOriginalTiming =
    calculationFact.status === '完整' && Array.isArray(data.analysis.yingQi)
      ? data.analysis.yingQi
      : [];
  verifiedOriginalTiming.forEach((promptText, index) =>
    add({
      key: `meihua:timing:input:${index + 1}`,
      type: '原应期条件',
      sourceStatus: '原结果提供',
      ownerFactKeys: [calculationFact.key, ...stages.map((item) => item.key)],
      rawText: promptText,
      promptText,
      sources: ['当前排盘保存的动爻、卦数、体用与旺衰条件'],
      limitation: TIMING_FACT_LIMITATION,
    }),
  );
  add({
    key: 'meihua:timing:moving-yao',
    type: '动爻层位',
    sourceStatus: '由盘面补齐',
    ownerFactKeys: [
      yaoCoverageFact.key,
      ...yaoFacts
        .filter((item) => item.position === data.movingYao.position && item.isChanging)
        .map((item) => item.key),
    ],
    promptText: `第${data.movingYao.position}爻为变化触发层位，只用于先后、层次和触发条件，并须由现实进展验证`,
    sources: ['当前动爻位置与六爻覆盖核验'],
    limitation: TIMING_FACT_LIMITATION,
  });
  add({
    key: 'meihua:timing:month-state',
    type: '月建旺衰',
    sourceStatus: '由盘面补齐',
    ownerFactKeys: stages.map((item) => item.key),
    promptText: `月建${monthBranch}只用于校验各阶段体用旺衰，并作为相对快慢与阻力条件`,
    sources: ['月支与五行旺相休囚死关系'],
    limitation: TIMING_FACT_LIMITATION,
  });
  const weakStages = stages.filter((item) => ['休', '囚', '死'].includes(item.ti.seasonState));
  add({
    key: 'meihua:timing:body-state',
    type: '体卦状态',
    sourceStatus: '由盘面补齐',
    ownerFactKeys: (weakStages.length ? weakStages : stages).map((item) => item.key),
    promptText: weakStages.length
      ? `体卦在${weakStages.map((item) => `${item.label}${item.ti.seasonState}`).join('、')}，须先观察现实阻力缓解或外部条件改变再验`
      : '体卦各阶段未见休囚死，仍须等待现实事件验证，不能据此断定快速实现',
    sources: ['各阶段体卦月令旺衰状态'],
    limitation: TIMING_FACT_LIMITATION,
  });
  add({
    key: 'meihua:timing:deadline-boundary',
    type: '期限边界',
    sourceStatus: '统一边界',
    ownerFactKeys: [calculationFact.key, yaoCoverageFact.key],
    promptText:
      '动爻、卦数与旺衰不能据此换算绝对日期；未给目标期限时，不把阶段数量或盘内条件换算唯一日期',
    sources: ['相对触发条件与现实日期分离原则'],
    limitation: TIMING_FACT_LIMITATION,
  });
  return facts;
}

function buildSummaryFact(params: {
  calculationFact: MeihuaCalculationFact;
  randomFact: RandomTraceFact;
  hexagramStructureFacts: MeihuaHexagramFact[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  transitionFacts: MeihuaTransitionFact[];
  traditionalFacts: MeihuaTraditionalFact[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  counterSummaryFact: MeihuaCounterSummaryFact;
  timingFacts: MeihuaTimingFact[];
  timingSummaryFact: MeihuaTimingSummaryFact;
}): MeihuaSummaryFact {
  const factKeys = Array.from(
    new Set([
      params.calculationFact.key,
      params.randomFact.key,
      ...params.hexagramStructureFacts.map((item) => item.key),
      params.yaoCoverageFact.key,
      ...params.yaoStructureFacts.map((item) => item.key),
      params.stageCoverageFact.key,
      ...params.stages.map((item) => item.key),
      ...params.transitionFacts.map((item) => item.key),
      ...params.traditionalFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      params.timingSummaryFact.key,
      ...params.timingFacts.map((item) => item.key),
    ]),
  );
  const status =
    params.calculationFact.status !== '完整' || params.yaoCoverageFact.status !== '完整'
      ? '部分资料缺失'
      : params.stageCoverageFact.status !== '完整' ||
          params.transitionFacts.some((item) => item.status === '跨阶段缺口')
        ? '阶段链不完整'
        : '证据链完整';
  const diagnosticStatus =
    params.calculationFact.status === '计算不一致' ? '计算不一致' : undefined;
  return {
    key: 'meihua:evidence-summary',
    status,
    factKeys,
    hexagramFactCount: params.hexagramStructureFacts.length,
    yaoFactCount: params.yaoStructureFacts.length,
    stageFactCount: params.stages.length,
    transitionFactCount: params.transitionFacts.length,
    traditionalFactCount: params.traditionalFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    promptText: `证据状态${status}${diagnosticStatus ? '；起卦计算记录不一致' : ''}：主互变卦象${params.hexagramStructureFacts.length}项、逐爻${params.yaoStructureFacts.length}项、体用阶段${params.stages.length}项、阶段推进${params.transitionFacts.length}项、传统卦爻辞${params.traditionalFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项`,
    sources: ['全部起卦、主互变卦象、逐爻、阶段体用、推进、传统文本、反证与应期事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  calculationFact: MeihuaCalculationFact;
  randomFact: RandomTraceFact;
  hexagramStructureFacts: MeihuaHexagramFact[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  transitionFacts: MeihuaTransitionFact[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  timingFacts: MeihuaTimingFact[];
  summaryFact: MeihuaSummaryFact;
}): MeihuaEvidenceCalculationStep[] {
  return [
    {
      key: 'meihua:calculation:generation',
      stage: '起卦取数核验',
      status: params.calculationFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        method: params.calculationFact.methodLabel,
        inputKeys: Object.keys(params.calculationFact.inputs),
      },
      result: {
        calculationStatus: params.calculationFact.status,
        upperTrigram: params.calculationFact.resolvedResult.upperTrigram,
        lowerTrigram: params.calculationFact.resolvedResult.lowerTrigram,
        movingYao: params.calculationFact.resolvedResult.movingYao,
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
      key: 'meihua:calculation:hexagrams',
      stage: '主互变卦象构造',
      status: params.hexagramStructureFacts.length === 3 ? '已计算' : '资料不足',
      inputs: {
        upperTrigram: params.calculationFact.resolvedResult.upperTrigram,
        lowerTrigram: params.calculationFact.resolvedResult.lowerTrigram,
        movingYao: params.calculationFact.resolvedResult.movingYao,
      },
      result: {
        hexagramFactCount: params.hexagramStructureFacts.length,
        stages: params.hexagramStructureFacts.map((item) => item.label),
      },
      dependsOnStepKeys: ['meihua:calculation:generation'],
      promptText: `按上下卦、互卦构造与动爻翻转记录${params.hexagramStructureFacts.length}项主互变卦象事实`,
      sources: Array.from(new Set(params.hexagramStructureFacts.flatMap((item) => item.sources))),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:yaos',
      stage: '六爻与动爻核验',
      status: params.yaoCoverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        expectedPositions: params.yaoCoverageFact.expectedPositions.map(String),
        movingYao: params.calculationFact.resolvedResult.movingYao,
      },
      result: {
        coverageStatus: params.yaoCoverageFact.status,
        yaoFactCount: params.yaoStructureFacts.length,
        changingPositions: params.yaoCoverageFact.changingPositions.map(String),
      },
      dependsOnStepKeys: ['meihua:calculation:generation'],
      promptText: `${params.yaoCoverageFact.promptText}；已记录${params.yaoStructureFacts.length}项阴阳、体用归属与动爻事实`,
      sources: ['主卦六爻阴阳序列、动爻位置与体用归属规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:stages',
      stage: '阶段体用计算',
      status: params.stageCoverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        hexagramFactCount: params.hexagramStructureFacts.length,
        stageKeys: params.stages.map((item) => item.stage),
      },
      result: {
        coverageStatus: params.stageCoverageFact.status,
        stageFactCount: params.stages.length,
        incompleteStages: params.stageCoverageFact.incompleteStages,
      },
      dependsOnStepKeys: ['meihua:calculation:hexagrams', 'meihua:calculation:yaos'],
      promptText: `${params.stageCoverageFact.promptText}；逐阶段计算体用五行关系与月令旺衰`,
      sources: ['主卦、互卦、变卦上下经卦与原动爻所在经卦的体用规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:transitions',
      stage: '阶段推进核验',
      status:
        params.transitionFacts.length === 2 &&
        params.transitionFacts.every((item) => item.status === '连续')
          ? '已计算'
          : '资料不足',
      inputs: { stageFactCount: params.stages.length },
      result: {
        transitionFactCount: params.transitionFacts.length,
        transitionStatuses: params.transitionFacts.map((item) => item.status),
      },
      dependsOnStepKeys: ['meihua:calculation:stages'],
      promptText: params.transitionFacts.length
        ? params.transitionFacts.map((item) => item.promptText).join('；')
        : '当前只有主卦阶段，未形成可核验推进链',
      sources: ['相邻阶段体用关系与阶段完整性逐项比较'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:counter-timing',
      stage: '反证与应期核验',
      status: '已计算',
      inputs: { stageFactCount: params.stages.length },
      result: {
        counterEvidenceCount: params.counterEvidenceFacts.length,
        timingFactCount: params.timingFacts.length,
      },
      dependsOnStepKeys: ['meihua:calculation:stages', 'meihua:calculation:transitions'],
      promptText: `逐项核验阶段限制${params.counterEvidenceFacts.length}项，并记录相对触发与期限边界${params.timingFacts.length}项`,
      sources: ['阶段体用限制、月令旺衰、动爻层位与现实触发条件'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        hexagramFactCount: params.summaryFact.hexagramFactCount,
        stageFactCount: params.summaryFact.stageFactCount,
        transitionFactCount: params.summaryFact.transitionFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
        timingFactCount: params.summaryFact.timingFactCount,
      },
      dependsOnStepKeys: [
        'meihua:calculation:generation',
        'meihua:calculation:hexagrams',
        'meihua:calculation:yaos',
        'meihua:calculation:stages',
        'meihua:calculation:transitions',
        'meihua:calculation:counter-timing',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  calculationFact: MeihuaCalculationFact;
  randomFact: RandomTraceFact;
  hexagramStructureFacts: MeihuaHexagramFact[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  transitionFacts: MeihuaTransitionFact[];
  traditionalFacts: MeihuaTraditionalFact[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  counterSummaryFact: MeihuaCounterSummaryFact;
  timingFacts: MeihuaTimingFact[];
  timingSummaryFact: MeihuaTimingSummaryFact;
  summaryFact: MeihuaSummaryFact;
}): MeihuaLimitationFact[] {
  const definitions: Array<
    Pick<MeihuaLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'meihua:limitation:generation-random',
      type: '起卦与随机来源边界',
      ownerFactKeys: [params.calculationFact.key, params.randomFact.key],
      promptText:
        '取数算式与随机轨迹只用于核验上下卦和动爻如何由输入或抽样得到；随机重放只记录生成过程，不提高预测有效性，也不证明现实结果',
      sources: ['起卦输入、取余算式与随机轨迹'],
    },
    {
      key: 'meihua:limitation:hexagrams-yaos',
      type: '卦象与逐爻资料边界',
      ownerFactKeys: [
        ...params.hexagramStructureFacts.map((item) => item.key),
        params.yaoCoverageFact.key,
        ...params.yaoStructureFacts.map((item) => item.key),
      ],
      promptText:
        '主互变卦象与逐爻事实只记录卦名、卦符、上下经卦、阴阳、体用归属和动爻位置；资料缺失时不得补造，资料完整也不直接证明现实事件或吉凶',
      sources: ['主互变卦象构造、六爻覆盖与逐爻事实'],
    },
    {
      key: 'meihua:limitation:stages',
      type: '阶段体用边界',
      ownerFactKeys: [params.stageCoverageFact.key, ...params.stages.map((item) => item.key)],
      promptText:
        '体用生克只描述卦内关系，不直接等于现实吉凶；起因、过程和结果标签只表示主卦、互卦、变卦的分析层级，不证明现实必然按同样阶段发生',
      sources: ['主互变阶段覆盖与逐阶段体用月令事实'],
    },
    {
      key: 'meihua:limitation:transitions-counters',
      type: '阶段推进与反证边界',
      ownerFactKeys: [
        ...params.transitionFacts.map((item) => item.key),
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
      ],
      promptText:
        '阶段推进只比较相邻体用关系变化，阶段缺口时不得补造中间过程；泄耗、受克、休囚死等反证须与支持条件并列，不得直接写成现实失败、灾祸或损失',
      sources: ['阶段推进事实与逐阶段反证汇总'],
    },
    {
      key: 'meihua:limitation:timing',
      type: '应期边界',
      ownerFactKeys: [params.timingSummaryFact.key, ...params.timingFacts.map((item) => item.key)],
      promptText:
        '动爻、卦数、阶段数量、体用生克与月令旺衰只提供相对层位和触发条件；未给目标期限时不得换算唯一日期、固定天数或事件概率',
      sources: ['动爻层位、月令旺衰、体用状态与期限边界'],
    },
    {
      key: 'meihua:limitation:tradition-risk',
      type: '传统文本与高风险输出边界',
      ownerFactKeys: [params.summaryFact.key, ...params.traditionalFacts.map((item) => item.key)],
      promptText:
        '主卦、互卦、变卦按《梅花易数》“用为始、互为中、变为终”的次序记录；卦名与卦爻辞结合问题作辅助取象，不按阶段、旺衰、传统吉凶词或卦数生成总分、成功率，也不直接输出婚育、疾病、伤亡、诉讼、财物得失或人物意图结论',
      sources: ['传统卦爻辞条件化事实、证据汇总与高风险解释约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeMeihuaEvidence(data: MeihuaData): MeihuaEvidenceAnalysis {
  if (!data?.tiGua || !data?.yongGua || !data?.movingYao) {
    throw new Error('梅花体用推进证据缺少完整体用或动爻资料。');
  }
  if (data.meta && Date.parse(data.meta.calculatedAt) !== data.timestamp) {
    throw new Error('梅花起卦时间戳与结果元数据不一致，无法生成证据。');
  }
  const monthBranch = data.ganzhi.month.slice(-1);
  if (dizhi.includes(monthBranch)) {
    data = {
      ...data,
      analysis: {
        ...data.analysis,
        monthBranch:
          data.analysis.monthBranch === undefined ? monthBranch : data.analysis.monthBranch,
        monthElement:
          data.analysis.monthElement === undefined
            ? getBranchWuxing(monthBranch)
            : data.analysis.monthElement,
      },
    };
  }
  const calculationValidation = validateMeihuaCalculation(data);
  const timePillarMismatches = calculationValidation.mismatches.filter((item) =>
    /^盘面(?:年|月|日|时)柱与时间戳重算结果不一致$/u.test(item),
  );
  if (timePillarMismatches.length) {
    throw new Error(`梅花盘面干支与起卦时间不一致：${timePillarMismatches.join('；')}。`);
  }
  const calculationFact = buildMeihuaCalculationFact(data, calculationValidation);
  const calculationFacts = buildCalculationFacts(data);
  const hexagramStructureFacts = buildHexagramStructureFacts(data);
  const hexagramFacts = hexagramStructureFacts.map((item) => item.promptText);
  const traditionalFacts = buildTraditionalFacts(data);
  const yaoStructureFacts = buildYaoStructureFacts(data);
  const yaoCoverageFact = buildYaoCoverageFact(yaoStructureFacts, data.movingYao.position);
  const yaoFacts = yaoStructureFacts.map((item) => item.promptText);
  const stages: MeihuaStageEvidence[] = [
    createStage({
      stage: 'origin',
      label: '主卦',
      hexagram: data.originalName,
      hexagramFactKey: 'meihua:hexagram:origin',
      ti: data.tiGua,
      yong: data.yongGua,
      monthBranch,
      basis: '主卦以动爻所在经卦为用、另一经卦为体。',
    }),
  ];

  const interUpper = data.interHexagram?.upper
    ? trigramByName.get(data.interHexagram.upper)
    : undefined;
  const interLower = data.interHexagram?.lower
    ? trigramByName.get(data.interHexagram.lower)
    : undefined;
  if (interUpper && interLower) {
    const movingInLower = data.movingYao.position <= 3;
    const interTi = data.interTiGua ?? (movingInLower ? interUpper : interLower);
    const interYong = data.interYongGua ?? (movingInLower ? interLower : interUpper);
    stages.push(
      createStage({
        stage: 'process',
        label: '互卦',
        hexagram: data.interHexagram?.name || data.interName || '互卦',
        hexagramFactKey: 'meihua:hexagram:process',
        ti: interTi,
        yong: interYong,
        monthBranch,
        basis: movingInLower
          ? '原动爻在下卦、原体在上，依《梅花易数》卷三取上互为体互、下互为用互。'
          : '原动爻在上卦、原体在下，依《梅花易数》卷三取下互为体互、上互为用互。',
      }),
    );
  }

  if (data.changedTiGua && data.changedYongGua) {
    stages.push(
      createStage({
        stage: 'result',
        label: '变卦',
        hexagram: data.changedHexagram?.name || data.changedName || '变卦',
        hexagramFactKey: data.changedHexagram ? 'meihua:hexagram:result' : null,
        ti: data.changedTiGua,
        yong: data.changedYongGua,
        monthBranch,
        basis: '变卦沿用原动爻所在经卦为用、另一经卦为体，观察变化后的关系。',
      }),
    );
  }

  const stageCoverageFact = buildStageCoverageFact(stages);
  const transitionFacts = buildTransitionFacts(stages);
  const transitions = transitionFacts.map((item) => item.promptText);
  const timingFacts = buildTimingFacts(
    data,
    stages,
    monthBranch,
    calculationFact,
    yaoCoverageFact,
    yaoStructureFacts,
  );
  const timingConditions = timingFacts.map((item) => item.promptText);
  const timingSummaryFact: MeihuaTimingSummaryFact = {
    key: 'meihua:timing-summary',
    status: timingFacts.some((item) => item.type !== '期限边界')
      ? '已提供触发条件'
      : '仅有期限边界',
    factKeys: timingFacts.map((item) => item.key),
    promptText: `应期状态：已记录${timingFacts.length}项相对触发与期限边界条件`,
    sources: ['逐项动爻、月令、体用与原应期条件汇总'],
    limitation: TIMING_SUMMARY_LIMITATION,
  };
  const counterEvidenceFacts = buildCounterEvidenceFacts(stages);
  const counterEvidence = unique(counterEvidenceFacts.map((item) => item.detail));
  const counterSummaryFact: MeihuaCounterSummaryFact = {
    key: 'meihua:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `当前${stages.length}个阶段共记录${counterEvidenceFacts.length}项明确限制，须逐项与现实条件复核`
      : '当前阶段未见明确体用或月令限制，但仍须核实现实风险与外部条件',
    sources: ['各阶段限制条件与体用月令事实逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const isRandomMethod = data.calculation?.methodKey === 'random';
  const trace = data.meta?.random;
  const randomFact = buildRandomTraceFact({
    key: `random:meihua:${data.calculation?.methodKey ?? 'unknown'}`,
    applicable: isRandomMethod,
    trace,
    processLabel: `${data.calculation?.method ?? '当前方式'}的上下卦与动爻生成过程`,
    sources: ['梅花起卦方式与取数记录', '随机上下卦、动爻样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  if (isRandomMethod && randomFact.status === '可重放') {
    const replayed = resolveRandomMethod({ replay: randomFact.samples });
    if (
      replayed.randomTrace?.samples.length !== randomFact.samples.length ||
      replayed.upperTrigramIndex !== data.calculation?.upperTrigramIndex ||
      replayed.lowerTrigramIndex !== data.calculation?.lowerTrigramIndex ||
      trigramsByIndex[replayed.upperTrigramIndex].name !== data.mainHexagram.upper ||
      trigramsByIndex[replayed.lowerTrigramIndex].name !== data.mainHexagram.lower ||
      replayed.movingYaoIndex !== data.calculation?.movingYaoIndex ||
      replayed.movingYaoIndex !== data.movingYao.position
    ) {
      throw new MingyuCoreError({
        code: 'MEIHUA_RANDOM_TRACE_MISMATCH',
        category: 'validation',
        message: '梅花随机轨迹与起卦计算记录不一致，或包含多余样本。',
        field: 'meta.random.samples',
      });
    }
  }
  const summaryFact = buildSummaryFact({
    calculationFact,
    randomFact,
    hexagramStructureFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    stageCoverageFact,
    stages,
    transitionFacts,
    traditionalFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
  });
  const calculationSteps = buildCalculationSteps({
    calculationFact,
    randomFact,
    hexagramStructureFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    stageCoverageFact,
    stages,
    transitionFacts,
    counterEvidenceFacts,
    timingFacts,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const limitationFacts = buildLimitationFacts({
    calculationFact,
    randomFact,
    hexagramStructureFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    stageCoverageFact,
    stages,
    transitionFacts,
    traditionalFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '梅花计算链',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status],
    },
    {
      level: calculationFact.status === '完整' ? '辅证' : '反证',
      title: '起卦方式与取数算式',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['起卦算式', calculationFact.methodKey, calculationFact.status],
    },
    {
      level: '主证',
      title: '主互变卦象事实',
      detail: `${hexagramStructureFacts.map((item) => item.promptText).join('；')}；统一边界：${HEXAGRAM_FACT_LIMITATION}`,
      source: Array.from(new Set(hexagramStructureFacts.flatMap((item) => item.sources))).join(
        '、',
      ),
      tags: [
        '主卦',
        ...(data.interHexagram ? ['互卦'] : []),
        ...(data.changedHexagram ? ['变卦'] : []),
      ],
    },
    {
      level: stageCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '主互变阶段覆盖状态',
      detail: `${stageCoverageFact.promptText}；边界：${stageCoverageFact.limitation}`,
      source: stageCoverageFact.sources.join('、'),
      tags: ['阶段覆盖', stageCoverageFact.status],
    },
    {
      level: yaoCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '六爻资料覆盖状态',
      detail: `${yaoCoverageFact.promptText}；边界：${yaoCoverageFact.limitation}`,
      source: yaoCoverageFact.sources.join('、'),
      tags: ['六爻覆盖', yaoCoverageFact.status],
    },
    {
      level: yaoCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '六爻阴阳与体用归属',
      detail: `${yaoStructureFacts.map((item) => item.promptText).join('；')}；统一边界：${YAO_FACT_LIMITATION}`,
      source: Array.from(new Set(yaoStructureFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['六爻结构', '动爻', '体用'],
    },
    ...(traditionalFacts.some((fact) => fact.applicability === '当前动爻辅助')
      ? [
          {
            level: '辅证' as const,
            title: `${data.movingYao.yaoName}爻辞`,
            detail: traditionalFacts.find((fact) => fact.applicability === '当前动爻辅助')
              ?.promptText,
            source: '《周易》当前主卦动爻原文及条件化解释',
            tags: ['动爻爻辞', data.movingYao.yaoName],
          },
        ]
      : []),
    ...traditionalFacts
      .filter((fact) => fact.kind === '卦辞')
      .map((fact): PromptEvidenceItem => ({
        level: fact.stage === '主卦' ? '辅证' : '限制',
        title: `${fact.stage}${fact.hexagram}卦辞分类`,
        detail: `${fact.promptText}；边界${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: [fact.stage, '卦辞', ...fact.traditionalSignals, ...fact.topicTags],
      })),
    ...stages.map((stage, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${stage.label}阶段`,
      detail: `${stage.promptText}；边界：${stage.limitation}`,
      source: stage.sources.join('、'),
      tags: [stage.stage, stage.relation],
    })),
    ...transitionFacts.map((fact): PromptEvidenceItem => ({
      level: fact.status === '连续' ? '辅证' : '反证',
      title: `${{ origin: '起因', process: '过程', result: '结果' }[fact.fromStage]}至${{ origin: '起因', process: '过程', result: '结果' }[fact.toStage]}体用转变`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['阶段推进', fact.status, fact.toStage],
    })),
    ...(calculationFact.status === '完整' &&
    stageCoverageFact.status === '完整' &&
    data.analysis.inter1Relation &&
    data.analysis.inter1Relation !== '无'
      ? [
          {
            level: '辅证' as const,
            title: '体互对原体关系',
            detail: `${data.analysis.inter1Relation}；《梅花易数》卷三称“体互最紧”，仍须与主卦体用、用互和变卦并看。`,
            source: '《梅花易数》卷三《体用互变之诀》体互、用互方位规则',
            tags: ['体互', '原体', '过程主线'],
          },
        ]
      : []),
    ...(calculationFact.status === '完整' &&
    stageCoverageFact.status === '完整' &&
    data.analysis.inter2Relation &&
    data.analysis.inter2Relation !== '无'
      ? [
          {
            level: '辅证' as const,
            title: '用互对原体关系',
            detail: `${data.analysis.inter2Relation}；《梅花易数》卷三称“用互次之”，不得脱离体互与变卦单断。`,
            source: '《梅花易数》卷三《体用互变之诀》体互、用互方位规则',
            tags: ['用互', '原体', '过程辅证'],
          },
        ]
      : []),
    {
      level: '应期',
      title: '变化触发与应期条件',
      detail: `${timingSummaryFact.promptText}；${timingFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
      source: Array.from(new Set(timingFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['应期', '触发条件', '不换算绝对日期'],
    },
    {
      level: counterSummaryFact.status === '有明确反证' ? '反证' : '辅证',
      title: '体用反证覆盖状态',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    ...counterEvidenceFacts.map((fact, index): PromptEvidenceItem => ({
      level: '反证',
      title: `体用限制核验${index + 1}`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['反证', fact.type, fact.stage],
    })),
  ];
  if (isRandomMethod) {
    items.push({
      level: randomFact.status === '可重放' ? '辅证' : '反证',
      title: randomFact.status === '可重放' ? '随机起卦重放记录' : '随机轨迹缺失',
      detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
      source: randomFact.sources.join('、'),
      tags: ['随机起卦', randomFact.status, '不代表预测有效性'],
    });
  }
  items.push(
    {
      level: '辅证',
      title: `梅花证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '梅花推进链解释边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
    },
  );
  const evidence: PromptEvidenceBundle = { title: '梅花体用阶段推进结构化证据', items };
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const promptText = [
    '【梅花体用阶段推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `推进关系：${transitionFacts.map((item) => item.promptText).join('；') || '只有主卦阶段，未形成可核验的互变推进链'}`,
    `触发条件：${timingFacts.map((item) => item.promptText).join('；')}`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'meihua:evidence',
    status: '已计算',
    calculationFact,
    calculationFacts,
    calculationSteps,
    calculationChain,
    hexagramStructureFacts,
    hexagramFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    yaoFacts,
    monthBranch,
    movingYao: data.movingYao.position,
    stageCoverageFact,
    stages,
    transitionFacts,
    transitions,
    timingFacts,
    timingSummaryFact,
    timingConditions,
    randomFact,
    randomFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    traditionalFacts,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText,
    methodology: [
      '主卦、互卦、变卦依《梅花易数》“用为始、互为中、变为终”的次序记录各阶段体用关系。',
      '起卦输入、取余算式、六爻阴阳、互卦构造和动爻翻转均作为可复核计算事实保留。',
      '每个阶段分别计算体用生克和月建旺衰，不把某一阶段扩大为全局结论。',
      '动爻只标记变化层位与触发顺序，卦数只保留原始计算资料，不机械换算绝对日期。',
      '只输出支持、反证、限制和触发条件，不生成吉凶总分或成功率。',
    ],
  };
}
