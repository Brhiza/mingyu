import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { getDivinationTime } from '../calendar/timeManager';
import { createSeededRandom, type RandomTrace } from '../shared/random';
import { createResultMeta } from '../shared/result';
import type { SsgwData } from '../types/divination';
import { SSGW_INTERPRETATION_FIELDS, SSGW_SIGNS } from './ssgw-data';

export interface SsgwDrawFact {
  key: '抽签:签池索引';
  status: '可核验' | '缺少索引';
  poolSize: number | null;
  selectedIndex: number | null;
  selectedNumber: number;
  resultNumber: number;
  resultTitle: string;
  promptText: string;
  sources: string[];
  limitation: '签池大小、随机索引和签号对应关系只证明本次抽签过程及结果一致；不证明签文有效性、神意来源、现实事件或预测结果';
}

export interface SsgwSignFact {
  key: 'ssgw:sign-text';
  status: '完整' | '签诗为空';
  number: number;
  title: string;
  poem: string;
  promptText: string;
  sources: string[];
  limitation: '签号、签题和签诗只证明所用资料版本中的文本对应关系；不证明神意来源、预测有效性、现实事件或唯一解释';
}

export interface SsgwRitualThrowFact {
  attempt: number;
  firstFace: '阳面' | '阴面' | null;
  secondFace: '阳面' | '阴面' | null;
  result: '圣杯' | '笑杯' | '阴杯';
  promptText: string;
}

export interface SsgwRitualThrowEvidenceFact extends SsgwRitualThrowFact {
  key: string;
  status: '已记录';
  ritualFactKey: '仪式:掷筊确认';
  sources: string[];
  limitation: '单次掷筊事实只记录两枚筊杯的阴阳面及其对应结果；不证明神意来源、现实吉凶、事件概率或预测有效性';
}

export interface SsgwRitualFact {
  key: '仪式:掷筊确认';
  status: '已确认' | '未确认' | '缺少记录';
  confirmed: boolean | null;
  rejected: boolean | null;
  throws: SsgwRitualThrowFact[];
  reason?: string;
  promptText: string;
  sources: string[];
  limitation: '掷筊记录只证明模拟仪式的执行顺序和确认状态；圣杯、笑杯或阴杯不证明疾病、法律、财务、隐私、未来事件、神意来源或预测有效性';
}

export interface SsgwRandomFact {
  key: '随机:重放轨迹';
  status: '可重放' | '缺少轨迹' | '不适用';
  mode: 'system' | 'seeded' | 'custom' | 'replay' | '不适用' | null;
  seed?: string | number;
  samples: number[];
  sampleCount: number;
  promptText: string;
  sources: string[];
  limitation: '随机模式、种子和原始样本只用于复现抽签与掷筊过程；不表示可信度、神意或预测有效性，也不表示事件概率或结果保证';
}

export interface SsgwInterpretationFact {
  key: string;
  status: '已收录';
  field: string;
  text: string;
  originalText: string;
  promptText: string;
  role: '核心分类' | '补充条目';
  source: '传统分类释义资料';
  sources: string[];
  limitation: '仅作象征类比，不是事实结论或结果保证';
}

export interface SsgwMissingFieldFact {
  key: string;
  field: string;
  status: '缺失';
  promptText: string;
  sources: string[];
  limitation: '字段缺失只表示所用资料版本未提供该分类释义；不得依据其他字段反推、补造或宣称该领域已有结论';
}

export interface SsgwCoverageFact {
  key: 'ssgw:interpretation-coverage';
  status: '完整' | '存在缺口';
  expectedFields: string[];
  availableFieldKeys: string[];
  missingFieldKeys: string[];
  storyStatus: '已提供' | '缺少';
  promptText: string;
  sources: string[];
  limitation: '资料覆盖状态只说明签诗、典故和分类释义是否齐备；完整不代表解释正确，缺失时也不得从签号、签诗或其他分类反推缺失内容';
}

export interface SsgwSourceFact {
  key: string;
  status: '已声明';
  title: string;
  evidence: string;
  role: '传统签本' | '整理资料' | '随机协议';
  promptText: string;
  sources: string[];
  limitation: '来源声明只标明文本、分类释义或随机记录的出处层级；不等于现代实证验证、神意证明或现实结果保证';
}

export interface SsgwCounterEvidenceFact {
  key: string;
  type: '签诗覆盖' | '典故覆盖' | '分类释义覆盖' | '抽签索引' | '仪式确认' | '随机轨迹';
  status:
    | '已覆盖'
    | '存在缺口'
    | '可核验'
    | '缺少索引'
    | '已确认'
    | '未确认'
    | '缺少记录'
    | '可重放'
    | '缺少轨迹'
    | '不适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录签文资料、抽签索引、掷筊确认和随机轨迹是否存在缺口；缺口不等于现实必然不利，资料完整也不证明预测有效';
}

export interface SsgwCounterSummaryFact {
  key: 'ssgw:counter-summary';
  status: '存在需保留反证' | '未见额外反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只用于防止静默补齐签诗、典故、分类释义、仪式或随机轨迹缺口；不得据缺口数量生成吉凶分、概率或结果保证';
}

export interface SsgwLimitationFact {
  key: string;
  type:
    | '传统象征边界'
    | '签诗主证边界'
    | '随机重放边界'
    | '仪式确认边界'
    | '高风险输出边界'
    | '资料版本边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束灵签文本、分类释义、掷筊和随机轨迹可以支持的解释范围，不得被反向当作神意、现实结果或概率证据';
}

export interface SsgwEvidenceCalculationStep {
  key: string;
  stage:
    | '随机来源核验'
    | '抽签索引核验'
    | '签文文本核验'
    | '分类资料覆盖核验'
    | '掷筊记录核验'
    | '仪式确认核验'
    | '反证核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明随机轨迹、抽签索引、签文文本、分类资料覆盖和掷筊确认如何形成当前证据；不证明神意来源、预测有效性、现实吉凶、事件概率或唯一未来';
}

export interface SsgwSummaryFact {
  key: 'ssgw:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  interpretationFactCount: number;
  missingFieldFactCount: number;
  ritualThrowFactCount: number;
  counterEvidenceCount: number;
  sourceFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '灵签证据汇总只统计签诗、分类释义、抽签索引、掷筊、随机轨迹、来源与反证覆盖；不得按数量生成吉凶等级、可信度、成功率、神意判断、时间保证或唯一未来';
}

export interface SsgwEvidenceAnalysis {
  key: 'ssgw:evidence';
  status: '已计算';
  calculationSteps: SsgwEvidenceCalculationStep[];
  calculationChain: string[];
  signText: {
    number: number;
    title: string;
    poem: string;
  };
  story?: string;
  promptStory?: string;
  signFact: SsgwSignFact;
  interpretations: SsgwInterpretationFact[];
  interpretationFacts: SsgwInterpretationFact[];
  missingFields: string[];
  missingFieldFacts: SsgwMissingFieldFact[];
  coverageFact: SsgwCoverageFact;
  drawFact: SsgwDrawFact;
  ritualFact: SsgwRitualFact;
  ritualThrowFacts: SsgwRitualThrowEvidenceFact[];
  randomFact: SsgwRandomFact;
  drawFacts: string[];
  ritualFacts: string[];
  randomFacts: string[];
  sourceFacts: SsgwSourceFact[];
  sources: Array<{
    title: string;
    evidence: string;
    role: '传统签本' | '整理资料' | '随机协议';
  }>;
  counterEvidence: string[];
  counterEvidenceFacts: SsgwCounterEvidenceFact[];
  counterSummaryFact: SsgwCounterSummaryFact;
  limitations: string[];
  limitationFacts: SsgwLimitationFact[];
  summaryFact: SsgwSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const DRAW_FACT_LIMITATION =
  '签池大小、随机索引和签号对应关系只证明本次抽签过程及结果一致；不证明签文有效性、神意来源、现实事件或预测结果' as const;

const SIGN_FACT_LIMITATION =
  '签号、签题和签诗只证明所用资料版本中的文本对应关系；不证明神意来源、预测有效性、现实事件或唯一解释' as const;

const RITUAL_FACT_LIMITATION =
  '掷筊记录只证明模拟仪式的执行顺序和确认状态；圣杯、笑杯或阴杯不证明疾病、法律、财务、隐私、未来事件、神意来源或预测有效性' as const;

const RITUAL_THROW_FACT_LIMITATION =
  '单次掷筊事实只记录两枚筊杯的阴阳面及其对应结果；不证明神意来源、现实吉凶、事件概率或预测有效性' as const;

const RANDOM_FACT_LIMITATION =
  '随机模式、种子和原始样本只用于复现抽签与掷筊过程；不表示可信度、神意或预测有效性，也不表示事件概率或结果保证' as const;

const MISSING_FIELD_FACT_LIMITATION =
  '字段缺失只表示所用资料版本未提供该分类释义；不得依据其他字段反推、补造或宣称该领域已有结论' as const;

const COVERAGE_FACT_LIMITATION =
  '资料覆盖状态只说明签诗、典故和分类释义是否齐备；完整不代表解释正确，缺失时也不得从签号、签诗或其他分类反推缺失内容' as const;

const SOURCE_FACT_LIMITATION =
  '来源声明只标明文本、分类释义或随机记录的出处层级；不等于现代实证验证、神意证明或现实结果保证' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录签文资料、抽签索引、掷筊确认和随机轨迹是否存在缺口；缺口不等于现实必然不利，资料完整也不证明预测有效' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只用于防止静默补齐签诗、典故、分类释义、仪式或随机轨迹缺口；不得据缺口数量生成吉凶分、概率或结果保证' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束灵签文本、分类释义、掷筊和随机轨迹可以支持的解释范围，不得被反向当作神意、现实结果或概率证据' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明随机轨迹、抽签索引、签文文本、分类资料覆盖和掷筊确认如何形成当前证据；不证明神意来源、预测有效性、现实吉凶、事件概率或唯一未来' as const;
const SUMMARY_FACT_LIMITATION =
  '灵签证据汇总只统计签诗、分类释义、抽签索引、掷筊、随机轨迹、来源与反证覆盖；不得按数量生成吉凶等级、可信度、成功率、神意判断、时间保证或唯一未来' as const;

function conditionSsgwRitualReason(reason?: string) {
  return reason
    ?.replace(/完成项目模拟求签流程/g, '完成本次模拟求签流程')
    .replace(/按项目仪式规则/g, '按本次模拟流程');
}

export function conditionSsgwInterpretation(text: string): string {
  return text
    .replace(/成功是必然的结果/g, '传统象意偏向成功，但结果仍取决于现实条件')
    .replace(/结果必然失败/g, '失败风险很高')
    .replace(/必然两败俱伤/g, '容易两败俱伤')
    .replace(/必然会/g, '很可能会')
    .replace(/必然是/g, '容易形成')
    .replace(/必然走向/g, '可能走向')
    .replace(/必然失败/g, '失败风险很高')
    .replace(/必然后悔/g, '后悔风险很高')
    .replace(/必定成功/g, '较有机会成功')
    .replace(/必能/g, '较有机会')
    .replace(/必败/g, '失败风险很高')
    .replace(/必然/g, '往往');
}

function buildCounterEvidenceFacts(args: {
  signFact: SsgwSignFact;
  story?: string;
  missingFieldFacts: SsgwMissingFieldFact[];
  coverageFact: SsgwCoverageFact;
  drawFact: SsgwDrawFact;
  ritualFact: SsgwRitualFact;
  randomFact: SsgwRandomFact;
}): SsgwCounterEvidenceFact[] {
  const { signFact, story, missingFieldFacts, coverageFact, drawFact, ritualFact, randomFact } =
    args;
  return [
    {
      key: 'ssgw:counter:sign-text',
      type: '签诗覆盖',
      status: signFact.status === '完整' ? '已覆盖' : '存在缺口',
      ownerFactKeys: [signFact.key],
      promptText:
        signFact.status === '完整' ? '签诗原文已提供' : `${signFact.promptText}，不得补造签诗`,
      sources: signFact.sources,
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'ssgw:counter:story',
      type: '典故覆盖',
      status: story ? '已覆盖' : '存在缺口',
      ownerFactKeys: [coverageFact.key],
      promptText: story ? '签附典故已提供' : '资料没有典故，不得自行补造人物或事件',
      sources: ['签附典故资料覆盖核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'ssgw:counter:interpretations',
      type: '分类释义覆盖',
      status: missingFieldFacts.length ? '存在缺口' : '已覆盖',
      ownerFactKeys: [coverageFact.key, ...missingFieldFacts.map((item) => item.key)],
      promptText: missingFieldFacts.length
        ? `分类释义缺少${missingFieldFacts.map((item) => item.field).join('、')}，不得由其他字段反推`
        : '八类分类释义已完整提供',
      sources: coverageFact.sources,
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'ssgw:counter:draw-index',
      type: '抽签索引',
      status: drawFact.status,
      ownerFactKeys: [drawFact.key],
      promptText: drawFact.promptText,
      sources: drawFact.sources,
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'ssgw:counter:ritual',
      type: '仪式确认',
      status: ritualFact.status,
      ownerFactKeys: [ritualFact.key],
      promptText: ritualFact.promptText,
      sources: ritualFact.sources,
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'ssgw:counter:random-trace',
      type: '随机轨迹',
      status: randomFact.status,
      ownerFactKeys: [randomFact.key],
      promptText: randomFact.promptText,
      sources: randomFact.sources,
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
}

function isCounterIssue(item: SsgwCounterEvidenceFact) {
  return !['已覆盖', '可核验', '已确认', '可重放', '不适用'].includes(item.status);
}

function buildCounterSummaryFact(
  counterEvidenceFacts: SsgwCounterEvidenceFact[],
): SsgwCounterSummaryFact {
  const issueFacts = counterEvidenceFacts.filter(isCounterIssue);
  return {
    key: 'ssgw:counter-summary',
    status: issueFacts.length ? '存在需保留反证' : '未见额外反证',
    factKeys: issueFacts.map((item) => item.key),
    promptText: issueFacts.length
      ? `需保留${issueFacts.map((item) => `${item.type}${item.status}`).join('、')}；不得静默补齐或覆盖`
      : '签诗、典故、分类释义、抽签索引、仪式确认与随机轨迹未见额外缺口',
    sources: ['签文资料、抽签索引、仪式确认与随机轨迹逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildSummaryFact(args: {
  signFact: SsgwSignFact;
  interpretations: SsgwInterpretationFact[];
  missingFieldFacts: SsgwMissingFieldFact[];
  coverageFact: SsgwCoverageFact;
  drawFact: SsgwDrawFact;
  ritualFact: SsgwRitualFact;
  ritualThrowFacts: SsgwRitualThrowEvidenceFact[];
  randomFact: SsgwRandomFact;
  sourceFacts: SsgwSourceFact[];
  counterEvidenceFacts: SsgwCounterEvidenceFact[];
  counterSummaryFact: SsgwCounterSummaryFact;
}): SsgwSummaryFact {
  const status =
    args.signFact.status === '完整' &&
    args.coverageFact.status === '完整' &&
    args.drawFact.status === '可核验' &&
    args.ritualFact.status === '已确认' &&
    args.ritualThrowFacts.length > 0 &&
    ['可重放', '不适用'].includes(args.randomFact.status) &&
    args.counterSummaryFact.status === '未见额外反证'
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'ssgw:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        args.signFact.key,
        ...args.interpretations.map((item) => item.key),
        ...args.missingFieldFacts.map((item) => item.key),
        args.coverageFact.key,
        args.drawFact.key,
        args.ritualFact.key,
        ...args.ritualThrowFacts.map((item) => item.key),
        args.randomFact.key,
        ...args.sourceFacts.map((item) => item.key),
        ...args.counterEvidenceFacts.map((item) => item.key),
        args.counterSummaryFact.key,
      ]),
    ),
    interpretationFactCount: args.interpretations.length,
    missingFieldFactCount: args.missingFieldFacts.length,
    ritualThrowFactCount: args.ritualThrowFacts.length,
    counterEvidenceCount: args.counterEvidenceFacts.length,
    sourceFactCount: args.sourceFacts.length,
    promptText: `证据链状态：${status}；分类释义${args.interpretations.length}项、缺失字段${args.missingFieldFacts.length}项、掷筊记录${args.ritualThrowFacts.length}项、反证核验${args.counterEvidenceFacts.length}项、来源声明${args.sourceFacts.length}项`,
    sources: ['签诗、分类释义、抽签索引、掷筊、随机轨迹、来源与反证事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(args: {
  signFact: SsgwSignFact;
  interpretations: SsgwInterpretationFact[];
  missingFieldFacts: SsgwMissingFieldFact[];
  coverageFact: SsgwCoverageFact;
  drawFact: SsgwDrawFact;
  ritualFact: SsgwRitualFact;
  ritualThrowFacts: SsgwRitualThrowEvidenceFact[];
  randomFact: SsgwRandomFact;
  counterEvidenceFacts: SsgwCounterEvidenceFact[];
  counterSummaryFact: SsgwCounterSummaryFact;
  summaryFact: SsgwSummaryFact;
}): SsgwEvidenceCalculationStep[] {
  return [
    {
      key: 'ssgw:calculation:random',
      stage: '随机来源核验',
      status: args.randomFact.status === '缺少轨迹' ? '资料不足' : '已计算',
      inputs: { randomMode: args.randomFact.mode ?? '缺少轨迹' },
      result: {
        randomStatus: args.randomFact.status,
        sampleCount: args.randomFact.sampleCount,
      },
      dependsOnStepKeys: [],
      promptText: args.randomFact.promptText,
      sources: args.randomFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ssgw:calculation:draw-index',
      stage: '抽签索引核验',
      status: args.drawFact.status === '可核验' ? '已计算' : '资料不足',
      inputs: {
        poolSize: args.drawFact.poolSize ?? '缺少索引',
        selectedIndex: args.drawFact.selectedIndex ?? '缺少索引',
      },
      result: {
        drawStatus: args.drawFact.status,
        selectedNumber: args.drawFact.selectedNumber,
        resultNumber: args.drawFact.resultNumber,
      },
      dependsOnStepKeys: ['ssgw:calculation:random'],
      promptText: args.drawFact.promptText,
      sources: args.drawFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ssgw:calculation:sign-text',
      stage: '签文文本核验',
      status: args.signFact.status === '完整' ? '已计算' : '资料不足',
      inputs: { signNumber: args.signFact.number, signTitle: args.signFact.title },
      result: {
        signStatus: args.signFact.status,
        poemProvided: Boolean(args.signFact.poem.trim()),
      },
      dependsOnStepKeys: ['ssgw:calculation:draw-index'],
      promptText: args.signFact.promptText,
      sources: args.signFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ssgw:calculation:coverage',
      stage: '分类资料覆盖核验',
      status: args.coverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: { expectedFieldCount: args.coverageFact.expectedFields.length },
      result: {
        coverageStatus: args.coverageFact.status,
        interpretationFactCount: args.interpretations.length,
        missingFieldCount: args.missingFieldFacts.length,
        storyStatus: args.coverageFact.storyStatus,
      },
      dependsOnStepKeys: ['ssgw:calculation:sign-text'],
      promptText: args.coverageFact.promptText,
      sources: args.coverageFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ssgw:calculation:ritual-throws',
      stage: '掷筊记录核验',
      status: args.ritualThrowFacts.length ? '已计算' : '资料不足',
      inputs: { ritualStatus: args.ritualFact.status },
      result: {
        throwCount: args.ritualThrowFacts.length,
        throwResults: args.ritualThrowFacts.map((item) => item.result),
      },
      dependsOnStepKeys: ['ssgw:calculation:random'],
      promptText: args.ritualThrowFacts.length
        ? `已记录${args.ritualThrowFacts.length}次掷筊：${args.ritualThrowFacts.map((item) => item.promptText).join(' → ')}`
        : '现有资料没有逐次掷筊记录，不得补写阴阳面或杯象',
      sources: args.ritualThrowFacts.length
        ? Array.from(new Set(args.ritualThrowFacts.flatMap((item) => item.sources)))
        : args.ritualFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ssgw:calculation:ritual-confirmation',
      stage: '仪式确认核验',
      status: args.ritualFact.status === '已确认' ? '已计算' : '资料不足',
      inputs: { throwCount: args.ritualThrowFacts.length },
      result: {
        ritualStatus: args.ritualFact.status,
        confirmed: args.ritualFact.confirmed ?? false,
        rejected: args.ritualFact.rejected ?? false,
      },
      dependsOnStepKeys: ['ssgw:calculation:ritual-throws'],
      promptText: args.ritualFact.promptText,
      sources: args.ritualFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ssgw:calculation:counter',
      stage: '反证核验',
      status: '已计算',
      inputs: { counterFactCount: args.counterEvidenceFacts.length },
      result: {
        counterStatus: args.counterSummaryFact.status,
        issueCount: args.counterEvidenceFacts.filter(isCounterIssue).length,
      },
      dependsOnStepKeys: [
        'ssgw:calculation:draw-index',
        'ssgw:calculation:sign-text',
        'ssgw:calculation:coverage',
        'ssgw:calculation:ritual-confirmation',
      ],
      promptText: args.counterSummaryFact.promptText,
      sources: args.counterSummaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ssgw:calculation:summary',
      stage: '证据汇总',
      status: args.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: args.summaryFact.factKeys.length },
      result: {
        summaryStatus: args.summaryFact.status,
        interpretationFactCount: args.summaryFact.interpretationFactCount,
        missingFieldFactCount: args.summaryFact.missingFieldFactCount,
        ritualThrowFactCount: args.summaryFact.ritualThrowFactCount,
        counterEvidenceCount: args.summaryFact.counterEvidenceCount,
      },
      dependsOnStepKeys: [
        'ssgw:calculation:random',
        'ssgw:calculation:draw-index',
        'ssgw:calculation:sign-text',
        'ssgw:calculation:coverage',
        'ssgw:calculation:ritual-throws',
        'ssgw:calculation:ritual-confirmation',
        'ssgw:calculation:counter',
      ],
      promptText: args.summaryFact.promptText,
      sources: args.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(args: {
  signFact: SsgwSignFact;
  coverageFact: SsgwCoverageFact;
  drawFact: SsgwDrawFact;
  ritualFact: SsgwRitualFact;
  ritualThrowFacts: SsgwRitualThrowEvidenceFact[];
  randomFact: SsgwRandomFact;
  interpretations: SsgwInterpretationFact[];
  missingFieldFacts: SsgwMissingFieldFact[];
  sourceFacts: SsgwSourceFact[];
  counterEvidenceFacts: SsgwCounterEvidenceFact[];
  counterSummaryFact: SsgwCounterSummaryFact;
  summaryFact: SsgwSummaryFact;
}): SsgwLimitationFact[] {
  const allFactKeys = [
    args.signFact.key,
    args.coverageFact.key,
    args.drawFact.key,
    args.ritualFact.key,
    args.randomFact.key,
    ...args.ritualThrowFacts.map((item) => item.key),
    ...args.interpretations.map((item) => item.key),
    ...args.missingFieldFacts.map((item) => item.key),
    ...args.sourceFacts.map((item) => item.key),
    ...args.counterEvidenceFacts.map((item) => item.key),
    args.counterSummaryFact.key,
    args.summaryFact.key,
  ];
  const definitions: Array<
    Pick<SsgwLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'ssgw:limitation:symbolic-model',
      type: '传统象征边界',
      ownerFactKeys: allFactKeys,
      promptText: '签诗、典故、分类解读与掷筊仪式属于传统象征材料，不是现代统计或因果证据',
      sources: ['传统象征材料与现代实证范围区分'],
    },
    {
      key: 'ssgw:limitation:sign-primary',
      type: '签诗主证边界',
      ownerFactKeys: [args.signFact.key, args.coverageFact.key],
      promptText: '签诗原文是文本主证；典故只提供类比背景，不得覆盖或改写签诗原意',
      sources: ['签诗原文与签附典故的证据层级'],
    },
    {
      key: 'ssgw:limitation:random-replay',
      type: '随机重放边界',
      ownerFactKeys: [args.drawFact.key, args.randomFact.key],
      promptText:
        args.randomFact.status === '不适用'
          ? '手工录入签号不依赖随机抽样，只证明用户提交签号与签文资料的对应关系'
          : '随机种子或重放轨迹只能证明随机过程可以重放，不证明预测有效性或神意来源',
      sources:
        args.randomFact.status === '不适用'
          ? ['用户手工录入签号来源边界']
          : ['抽签随机轨迹与重放条件'],
    },
    {
      key: 'ssgw:limitation:ritual-confirmation',
      type: '仪式确认边界',
      ownerFactKeys: [args.ritualFact.key, ...args.ritualThrowFacts.map((item) => item.key)],
      promptText: '圣杯只表示本次模拟仪式已完成，不证明疾病、法律、财务、隐私或未来事实',
      sources: ['掷筊顺序与仪式确认状态'],
    },
    {
      key: 'ssgw:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [args.summaryFact.key, args.counterSummaryFact.key],
      promptText:
        '不得由签号、诗句数字或典故年代换算绝对日期、成功率、灾祸概率或保证有效的化解方案',
      sources: ['传统文本与现实结果分离原则'],
    },
    {
      key: 'ssgw:limitation:source-version',
      type: '资料版本边界',
      ownerFactKeys: args.sourceFacts.map((item) => item.key),
      promptText: '不同庙本可能存在签序、题名和字句差异，引用时应注明所用签文资料版本',
      sources: ['传统签本与整理资料版本差异'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function assertSsgwTimestamp(timestamp: number): number {
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    Number.isNaN(new Date(timestamp).getTime())
  ) {
    throw new Error('三山国王灵签结果时间戳无效，无法重建可信证据。');
  }
  return timestamp;
}

function normalizeSsgwRandomTrace(input: SsgwData, timestamp: number): RandomTrace | undefined {
  const rawTrace = input.meta?.random;
  if (rawTrace === undefined) return undefined;
  const trace = createResultMeta({
    algorithm: 'ssgw.audit.trace',
    input: { number: input.number },
    calculatedAt: timestamp,
    random: rawTrace,
  }).random!;
  if (trace.mode === 'seeded' && trace.seed === undefined) {
    throw new Error('三山国王灵签 seeded 随机轨迹缺少种子，无法核验。');
  }
  if (trace.mode !== 'seeded' && trace.seed !== undefined) {
    throw new Error('三山国王灵签非 seeded 随机轨迹不应携带种子。');
  }
  if (trace.mode === 'seeded') {
    const seeded = createSeededRandom(trace.seed!);
    trace.samples.forEach((sample, index) => {
      if (seeded() !== sample) {
        throw new Error(`三山国王灵签随机轨迹第${index + 1}个样本与种子不一致。`);
      }
    });
    return trace;
  }
  return { mode: 'replay', samples: [...trace.samples] };
}

function replaySsgwRandomProcess(trace: RandomTrace): {
  selectedIndex: number;
  ritual: NonNullable<SsgwData['ritual']>;
} {
  if (trace.samples.length < 3) {
    throw new Error('三山国王灵签随机轨迹至少需要1个抽签样本和2个掷筊样本。');
  }
  if ((trace.samples.length - 1) % 2 !== 0) {
    throw new Error('三山国王灵签随机轨迹在签号样本后必须按每次2个样本完整记录掷筊。');
  }

  const selectedIndex = Math.floor(trace.samples[0] * SSGW_SIGNS.length);
  const throws: NonNullable<SsgwData['ritual']>['throws'] = [];
  let consecutiveYin = 0;
  let sampleIndex = 1;
  let terminated = false;

  while (sampleIndex < trace.samples.length && throws.length < 12) {
    const first = Math.floor(trace.samples[sampleIndex] * 2);
    const second = Math.floor(trace.samples[sampleIndex + 1] * 2);
    sampleIndex += 2;
    const result = first !== second ? '圣杯' : first === 0 ? '笑杯' : '阴杯';
    throws.push({
      result,
      firstFace: first === 0 ? '阳面' : '阴面',
      secondFace: second === 0 ? '阳面' : '阴面',
    });
    consecutiveYin = result === '阴杯' ? consecutiveYin + 1 : 0;
    if (result === '圣杯' || consecutiveYin >= 3 || throws.length === 12) {
      terminated = true;
      break;
    }
  }

  if (!terminated) {
    throw new Error('三山国王灵签随机轨迹在合法终止状态前已用尽。');
  }
  if (sampleIndex !== trace.samples.length) {
    throw new Error('三山国王灵签随机轨迹在仪式结束后仍有多余样本。');
  }

  const confirmed = throws.at(-1)?.result === '圣杯';
  return {
    selectedIndex,
    ritual: {
      throws,
      confirmed,
      rejected: !confirmed,
      reason: confirmed
        ? '已获圣杯，完成本次模拟求签流程。'
        : consecutiveYin >= 3
          ? '连续三次阴杯，按本次模拟流程拒绝起签。'
          : '连续十二次未获圣杯，停止本次模拟求签，避免无界重试。',
    },
  };
}

/** 只信任合法签号、时间戳及完整随机轨迹或明确手工录入，其余派生字段统一重建。 */
export function rebuildAuditedSsgwData(input: SsgwData): SsgwData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('三山国王灵签结果必须是对象。');
  }
  if (!Number.isSafeInteger(input.number)) {
    throw new Error('三山国王灵签签号必须是整数。');
  }
  const reference = SSGW_SIGNS.find((sign) => sign.id === input.number);
  if (!reference) {
    throw new Error(`三山国王灵签签号需为1至${SSGW_SIGNS.length}的整数。`);
  }
  const timestamp = assertSsgwTimestamp(input.timestamp);
  const { ganzhi } = getDivinationTime(new Date(timestamp));
  const trace = normalizeSsgwRandomTrace(input, timestamp);
  const declaredMethod = input.draw?.method;
  if (declaredMethod !== undefined && declaredMethod !== 'manual' && declaredMethod !== 'random') {
    throw new Error('三山国王灵签抽签来源无效。');
  }
  if (declaredMethod === 'manual' && trace) {
    throw new Error('三山国王灵签手工录入不能同时携带随机轨迹。');
  }
  if (declaredMethod === 'manual' && input.ritual !== undefined) {
    throw new Error('三山国王灵签手工录入不应携带模拟掷筊记录。');
  }

  let draw: NonNullable<SsgwData['draw']>;
  let ritual: SsgwData['ritual'];
  let algorithm: string;
  if (declaredMethod === 'manual') {
    draw = {
      method: 'manual',
      poolSize: SSGW_SIGNS.length,
      selectedIndex: null,
      selectedNumber: reference.id,
    };
    algorithm = 'ssgw.resolve.manual';
  } else {
    if (!trace) {
      throw new Error('三山国王灵签随机求签缺少完整随机轨迹，且未声明为手工录入。');
    }
    const replayed = replaySsgwRandomProcess(trace);
    const selectedNumber = SSGW_SIGNS[replayed.selectedIndex]?.id;
    if (selectedNumber === undefined) {
      throw new Error('三山国王灵签随机轨迹无法映射到标准签池。');
    }
    if (selectedNumber !== reference.id) {
      throw new Error(
        `三山国王灵签第${reference.id}签与随机轨迹重放得到的第${selectedNumber}签不一致。`,
      );
    }
    draw = {
      method: 'random',
      poolSize: SSGW_SIGNS.length,
      selectedIndex: replayed.selectedIndex,
      selectedNumber,
    };
    ritual = replayed.ritual;
    algorithm = 'ssgw.draw';
  }

  const rebuilt: SsgwData = {
    number: reference.id,
    title: reference.title,
    poem: reference.qianwen,
    story: reference.story,
    details: { ...reference.details },
    timestamp,
    ganzhi,
    draw,
    ...(ritual ? { ritual } : {}),
    meta: createResultMeta({
      algorithm,
      input: declaredMethod === 'manual' ? { number: reference.id, timestamp } : { timestamp },
      calculatedAt: timestamp,
      ...(trace ? { random: trace } : {}),
    }),
  };
  rebuilt.evidenceAnalysis = analyzeRebuiltSsgwEvidence(rebuilt);
  return rebuilt;
}

function analyzeRebuiltSsgwEvidence(data: SsgwData): SsgwEvidenceAnalysis {
  const details = data.details ?? {};
  const story = data.story?.trim() || details['典故']?.trim() || undefined;
  const promptStory = story ? conditionSsgwInterpretation(story) : undefined;
  const signFact: SsgwSignFact = {
    key: 'ssgw:sign-text',
    status: data.poem.trim() ? '完整' : '签诗为空',
    number: data.number,
    title: data.title,
    poem: data.poem,
    promptText: data.poem.trim()
      ? `第${data.number}签《${data.title}》已记录签诗原文`
      : `第${data.number}签《${data.title}》未提供签诗原文，不得补造签诗`,
    sources: ['三山国王九十二签资料版本'],
    limitation: SIGN_FACT_LIMITATION,
  };
  const interpretations = Object.entries(details)
    .filter(([field, text]) => field !== '典故' && text?.trim())
    .map(([field, text]) => ({
      field,
      text: text.trim(),
      originalText: text.trim(),
      promptText: conditionSsgwInterpretation(text.trim()),
      role: SSGW_INTERPRETATION_FIELDS.includes(field as never)
        ? ('核心分类' as const)
        : ('补充条目' as const),
      key: `ssgw:interpretation:${field}`,
      status: '已收录' as const,
      source: '传统分类释义资料' as const,
      sources: ['分类释义资料版本', `第${data.number}签《${data.title}》${field}字段`],
      limitation: '仅作象征类比，不是事实结论或结果保证' as const,
    }));
  const missingFields = SSGW_INTERPRETATION_FIELDS.filter((field) => !details[field]?.trim());
  const missingFieldFacts: SsgwMissingFieldFact[] = missingFields.map((field) => ({
    key: `ssgw:missing-interpretation:${field}`,
    field,
    status: '缺失',
    promptText: `资料未提供“${field}”分类释义，不得由其他字段反推`,
    sources: ['签文分类字段完整性核验'],
    limitation: MISSING_FIELD_FACT_LIMITATION,
  }));
  const coverageFact: SsgwCoverageFact = {
    key: 'ssgw:interpretation-coverage',
    status: signFact.status !== '完整' || missingFields.length || !story ? '存在缺口' : '完整',
    expectedFields: [...SSGW_INTERPRETATION_FIELDS],
    availableFieldKeys: interpretations.map((item) => item.key),
    missingFieldKeys: missingFieldFacts.map((item) => item.key),
    storyStatus: story ? '已提供' : '缺少',
    promptText: `资料覆盖：签诗${signFact.status === '完整' ? '已提供' : '缺少'}；典故${story ? '已提供' : '缺少'}；分类释义${missingFields.length ? `缺少${missingFields.join('、')}` : '完整'}`,
    sources: ['签诗、典故与八类分类字段逐项核验'],
    limitation: COVERAGE_FACT_LIMITATION,
  };
  const isManual = data.draw?.method === 'manual';
  const drawFact: SsgwDrawFact = data.draw
    ? {
        key: '抽签:签池索引',
        status: '可核验',
        poolSize: data.draw.poolSize,
        selectedIndex: data.draw.selectedIndex,
        selectedNumber: data.draw.selectedNumber,
        resultNumber: data.number,
        resultTitle: data.title,
        promptText: isManual
          ? `签池共${data.draw.poolSize}签，用户录入第${data.draw.selectedNumber}签；结果核验为第${data.number}签《${data.title}》`
          : `签池共${data.draw.poolSize}签，随机索引${data.draw.selectedIndex}（从0起）对应第${data.draw.selectedNumber}签；结果核验为第${data.number}签《${data.title}》`,
        sources: isManual
          ? ['三山国王九十二签签池', '用户手工录入的签号']
          : ['三山国王九十二签签池', '统一随机整数抽取与签号索引记录'],
        limitation: DRAW_FACT_LIMITATION,
      }
    : {
        key: '抽签:签池索引',
        status: '缺少索引',
        poolSize: null,
        selectedIndex: null,
        selectedNumber: data.number,
        resultNumber: data.number,
        resultTitle: data.title,
        promptText: `本次资料未附签池索引过程，仅保留已确定的第${data.number}签《${data.title}》`,
        sources: ['已确定签号与签题'],
        limitation: DRAW_FACT_LIMITATION,
      };
  const drawFacts = data.draw
    ? [
        isManual
          ? `签池共${data.draw.poolSize}签，用户录入第${data.draw.selectedNumber}签`
          : `签池共${data.draw.poolSize}签，随机索引${data.draw.selectedIndex}（从0起）对应第${data.draw.selectedNumber}签`,
        `抽签结果核验：第${data.number}签《${data.title}》`,
      ]
    : [`本次资料未附签池索引过程，仅保留已确定的第${data.number}签《${data.title}》`];
  const ritualThrows: SsgwRitualThrowFact[] =
    data.ritual?.throws.map((item, index) => ({
      attempt: index + 1,
      firstFace: item.firstFace ?? null,
      secondFace: item.secondFace ?? null,
      result: item.result,
      promptText: `第${index + 1}次${item.firstFace && item.secondFace ? `${item.firstFace}+${item.secondFace}=` : ''}${item.result}`,
    })) ?? [];
  const ritualThrowFacts: SsgwRitualThrowEvidenceFact[] = ritualThrows.map((item) => ({
    ...item,
    key: `ssgw:ritual-throw:${item.attempt}`,
    status: '已记录',
    ritualFactKey: '仪式:掷筊确认',
    sources: ['逐次阴阳面记录', '圣杯、笑杯与阴杯判定规则'],
    limitation: RITUAL_THROW_FACT_LIMITATION,
  }));
  const ritualReason = conditionSsgwRitualReason(data.ritual?.reason);
  const ritualFact: SsgwRitualFact = data.ritual
    ? {
        key: '仪式:掷筊确认',
        status: data.ritual.confirmed ? '已确认' : '未确认',
        confirmed: Boolean(data.ritual.confirmed),
        rejected: Boolean(data.ritual.rejected),
        throws: ritualThrows,
        reason: ritualReason,
        promptText: `掷筊顺序：${ritualThrows.map((item) => item.promptText).join(' → ') || '没有掷筊记录'}；仪式状态：${data.ritual.confirmed ? '已出现圣杯，签文按本次模拟流程确认' : `未获圣杯${ritualReason ? `；${ritualReason}` : ''}`}`,
        sources: ['三山国王灵签模拟掷筊流程', '逐次阴阳面与圣杯、笑杯、阴杯判定记录'],
        limitation: RITUAL_FACT_LIMITATION,
      }
    : {
        key: '仪式:掷筊确认',
        status: '缺少记录',
        confirmed: null,
        rejected: null,
        throws: [],
        promptText: '仪式状态：既有资料未提供掷筊记录，不得补写圣杯确认',
        sources: ['掷筊记录完整性核验'],
        limitation: RITUAL_FACT_LIMITATION,
      };
  const ritualFacts = data.ritual
    ? [
        `掷筊顺序：${
          data.ritual.throws
            .map(
              (item, index) =>
                `第${index + 1}次${item.firstFace && item.secondFace ? `${item.firstFace}+${item.secondFace}=` : ''}${item.result}`,
            )
            .join(' → ') || '没有掷筊记录'
        }`,
        data.ritual.confirmed
          ? '仪式状态：已出现圣杯，签文按本次模拟流程确认'
          : `仪式状态：未获圣杯${ritualReason ? `；${ritualReason}` : ''}`,
      ]
    : ['仪式状态：既有资料未提供掷筊记录，不得补写圣杯确认'];
  const trace = data.meta?.random;
  const randomFact: SsgwRandomFact = isManual
    ? {
        key: '随机:重放轨迹',
        status: '不适用',
        mode: '不适用',
        samples: [],
        sampleCount: 0,
        promptText: '签号由用户手工录入，不依赖随机抽样，随机轨迹不适用',
        sources: ['用户手工录入的签号'],
        limitation: RANDOM_FACT_LIMITATION,
      }
    : trace
      ? {
          key: '随机:重放轨迹',
          status: '可重放',
          mode: trace.mode,
          ...(trace.seed !== undefined ? { seed: trace.seed } : {}),
          samples: [...trace.samples],
          sampleCount: trace.samples.length,
          promptText: `随机模式：${trace.mode}；原始随机样本数：${trace.samples.length}；随机种子与原始样本保留在可重放记录中，本段提示词不展开`,
          sources: ['统一随机轨迹协议', '抽签与掷筊共用随机源的原始样本记录'],
          limitation: RANDOM_FACT_LIMITATION,
        }
      : {
          key: '随机:重放轨迹',
          status: '缺少轨迹',
          mode: null,
          samples: [],
          sampleCount: 0,
          promptText: '本次资料未附随机轨迹，无法验证抽签与掷筊的重放过程',
          sources: ['随机轨迹资料完整性核验'],
          limitation: RANDOM_FACT_LIMITATION,
        };
  const randomFacts = isManual
    ? []
    : trace
      ? [
          `随机模式：${trace.mode}`,
          `原始随机样本数：${trace.samples.length}`,
          trace.seed !== undefined ? `随机种子：${String(trace.seed)}` : '',
        ].filter(Boolean)
      : ['本次资料未附随机轨迹，无法验证抽签与掷筊的重放过程'];
  const sourceFacts: SsgwSourceFact[] = [
    {
      key: 'ssgw:source:traditional-signbook',
      status: '已声明',
      title: '三山国王祖庙九十二签体系',
      evidence: '签号、签题、签诗及求签仪式的传统材料框架',
      role: '传统签本',
      promptText: '传统签本来源：三山国王祖庙九十二签体系，提供签号、签题、签诗及仪式材料框架',
      sources: ['三山国王祖庙九十二签传统体系'],
      limitation: SOURCE_FACT_LIMITATION,
    },
    {
      key: 'ssgw:source:compiled-material',
      status: '已声明',
      title: '九十二签整理资料版本',
      evidence: '所用资料版本收录的签诗、典故与八类分类解读',
      role: '整理资料',
      promptText: '整理资料来源：九十二签资料版本，收录签诗、典故与八类分类解读',
      sources: ['九十二签整理资料版本'],
      limitation: SOURCE_FACT_LIMITATION,
    },
    {
      key: 'ssgw:source:random-trace',
      status: '已声明',
      title: isManual ? '用户手工录入记录' : '可重放随机轨迹记录',
      evidence: isManual
        ? '签号由用户录入，系统只核对签号与签文资料的对应关系'
        : '抽签和掷筊使用同一随机源，保留随机种子或重放轨迹所需的原始样本',
      role: '随机协议',
      promptText: isManual
        ? '签号来源：用户手工录入，系统未模拟抽签或掷筊'
        : '随机记录来源：抽签和掷筊使用同一随机源，并保留重放所需的原始样本',
      sources: isManual ? ['用户手工录入的签号'] : ['抽签与掷筊随机轨迹记录'],
      limitation: SOURCE_FACT_LIMITATION,
    },
  ];
  const sources: SsgwEvidenceAnalysis['sources'] = sourceFacts.map(({ title, evidence, role }) => ({
    title,
    evidence,
    role,
  }));
  const counterEvidence = [
    signFact.status === '完整' ? '' : signFact.promptText,
    ...missingFieldFacts.map((item) => item.promptText),
    story ? '' : '资料没有典故，不得自行补造人物或事件',
    drawFact.status === '可核验' ? '' : drawFact.promptText,
    ritualFact.status === '已确认' ? '' : ritualFact.promptText,
    randomFact.status === '缺少轨迹' ? randomFact.promptText : '',
  ].filter(Boolean);
  const counterEvidenceFacts = buildCounterEvidenceFacts({
    signFact,
    story,
    missingFieldFacts,
    coverageFact,
    drawFact,
    ritualFact,
    randomFact,
  });
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const summaryFact = buildSummaryFact({
    signFact,
    interpretations,
    missingFieldFacts,
    coverageFact,
    drawFact,
    ritualFact,
    ritualThrowFacts,
    randomFact,
    sourceFacts,
    counterEvidenceFacts,
    counterSummaryFact,
  });
  const calculationSteps = buildCalculationSteps({
    signFact,
    interpretations,
    missingFieldFacts,
    coverageFact,
    drawFact,
    ritualFact,
    ritualThrowFacts,
    randomFact,
    counterEvidenceFacts,
    counterSummaryFact,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const limitationFacts = buildLimitationFacts({
    signFact,
    coverageFact,
    drawFact,
    ritualFact,
    ritualThrowFacts,
    randomFact,
    interpretations,
    missingFieldFacts,
    sourceFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '灵签抽取、签文与仪式计算链',
      detail: `${calculationChain.join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status],
    },
    {
      level: '辅证',
      title: '签池抽取索引事实',
      detail: `${drawFact.promptText}；边界：${drawFact.limitation}`,
      source: drawFact.sources.join('；'),
      tags: ['签池', '抽签索引', '可重放'],
    },
    {
      level: '主证',
      title: `第${data.number}签《${data.title}》签诗原文`,
      detail: data.poem,
      source: '三山国王九十二签资料版本',
      tags: ['签诗原文', `第${data.number}签`],
    },
    ...(promptStory
      ? [
          {
            level: '辅证' as const,
            title: '签附典故',
            detail: `${promptStory}；边界：仅作传统类比背景，不是事实结论或结果保证`,
            source: '所用签文资料收录的典故',
            tags: ['典故类比'],
          },
        ]
      : []),
    ...interpretations.map((item): PromptEvidenceItem => ({
      level: item.field === '核心寓意' ? '主证' : '辅证',
      title: `${item.field}传统分类释义（非事实结论）`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('；'),
      tags: [item.role, item.field, '条件化表达'],
    })),
    {
      level: coverageFact.status === '完整' ? '辅证' : '反证',
      title: '签文资料覆盖状态',
      detail: `${coverageFact.promptText}；边界：${coverageFact.limitation}`,
      source: coverageFact.sources.join('；'),
      tags: ['资料覆盖', coverageFact.status],
    },
    {
      level: data.ritual?.confirmed ? '辅证' : '反证',
      title: data.ritual?.confirmed ? '模拟求签仪式完成记录' : '模拟求签仪式未完成',
      detail: `${ritualFact.promptText}；边界：${ritualFact.limitation}`,
      source: ritualFact.sources.join('；'),
      tags: ['仪式流程', data.ritual?.confirmed ? '已确认' : '未确认', '不代表现实结论'],
    },
    {
      level: randomFact.status === '缺少轨迹' ? '反证' : '辅证',
      title:
        randomFact.status === '不适用'
          ? '手工录入来源'
          : trace
            ? '随机过程重放记录'
            : '随机轨迹缺失',
      detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
      source: randomFact.sources.join('；'),
      tags: ['随机轨迹', randomFact.status, '不代表预测有效性'],
    },
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: '资料或仪式缺口',
      detail,
      source: '签文字段与掷筊记录逐项核验',
    })),
    {
      level: '反证',
      title: `灵签反证汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: summaryFact.status === '证据链完整' ? '辅证' : '反证',
      title: `灵签证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '灵签文本与仪式证据边界',
      detail: `${limitations.join('；')}；边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['传统材料', '现实复核'],
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '三山国王灵签文本与仪式结构化证据', items };
  const promptEvidence: PromptEvidenceBundle = {
    ...evidence,
    items: items.map((item) => {
      if (item.title.includes('签诗原文')) {
        return { ...item, detail: '原文见上方“签诗”，此处只标记其主证地位。' };
      }
      if (item.title === '签附典故') {
        return { ...item, detail: '典故全文见上方“典故”，此处只标记其辅证地位。' };
      }
      return item;
    }),
  };
  const promptText = [
    '【三山国王灵签文本与仪式结构化证据】',
    ...formatPromptEvidenceBundle(promptEvidence),
    `仪式事实：${ritualFact.promptText}。`,
    `抽签事实：${drawFact.promptText}。`,
    `随机事实：${randomFact.promptText}。`,
    `反证汇总：${counterSummaryFact.promptText}。`,
    `计算链：${calculationChain.join(' → ')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
    `资料来源：${sourceFacts.map((item) => item.promptText).join('；')}。`,
  ].join('\n');
  return {
    key: 'ssgw:evidence',
    status: '已计算',
    calculationSteps,
    calculationChain,
    signText: { number: data.number, title: data.title, poem: data.poem },
    story,
    promptStory,
    signFact,
    interpretations,
    interpretationFacts: interpretations,
    missingFields,
    missingFieldFacts,
    coverageFact,
    drawFact,
    ritualFact,
    ritualThrowFacts,
    randomFact,
    drawFacts,
    ritualFacts,
    randomFacts,
    sourceFacts,
    sources,
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先核对签号、签题和签诗原文，再读取典故与分类字段。',
      '签诗作为文本主证，典故与分类解读只作分层辅助，不互相替代。',
      '分类释义保留原始资料文本，同时另生成条件化提示词文本，避免把传统断语包装成结果保证。',
      '独立记录抽签随机轨迹和掷筊仪式状态；未获圣杯时停止签文解释。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}

/** 所有公开证据分析均先经过可信重建，禁止旧签文、释义、仪式和证据字段直接进入提示词。 */
export function analyzeSsgwEvidence(input: SsgwData): SsgwEvidenceAnalysis {
  return rebuildAuditedSsgwData(input).evidenceAnalysis!;
}
