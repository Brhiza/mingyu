import type { QimenData, QimenJiuGongGe } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  formatTianPanStars,
  formatTianPanStems,
  hasTianPanStar,
  hasTianPanStem,
} from './algorithms/qimen/helpers/palace-utils';

export type QimenCandidateSource =
  '值符落宫' | '值使落宫' | '日干落宫' | '时干落宫' | '盘面洞察' | '经典格局';

export interface QimenPalaceEvidence {
  gong: number;
  palaceFactKey: string;
  name: string;
  direction: string;
  element: string;
  sources: QimenCandidateSource[];
  palace: QimenJiuGongGe;
  patterns: string[];
  stemRelations: string[];
  support: string[];
  constraints: string[];
  isVoid: boolean;
  hasHorse: boolean;
}

export interface QimenPalaceFact {
  key: string;
  status: '已计算';
  gong: number;
  name: string;
  direction: string;
  element: string;
  tianPan: QimenJiuGongGe['tianPan'];
  diPan: QimenJiuGongGe['diPan'];
  renPan: QimenJiuGongGe['renPan'];
  shenPan: QimenJiuGongGe['shenPan'];
  candidateSources: QimenCandidateSource[];
  isVoid: boolean;
  voidBranches: string[];
  hasHorse: boolean;
  horseSourceBranch?: string;
  patterns: string[];
  patternFactKeys: string[];
  stemRelations: string[];
  stemRelationFacts: QimenStemRelationFact[];
  insights: QimenPalaceInsightFact[];
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '逐宫字段是奇门九宫门、星、神、天地盘干、空亡、马星与规则命中的计算事实，只限定候选宫取证条件，不单独证明现实吉凶、事件结果、人物意图、方位安全或固定应期';
}

export interface QimenPalaceInsightFact {
  key: string;
  ownerPalaceFactKey: string;
  level: '有利' | '风险' | '关注';
  status: '已命中';
  originalText: string;
  promptText: string;
  sources: string[];
  limitation: '宫位洞察只记录当前规则对该宫门、星、神、干与格局组合的分类提示；不证明现实吉凶、人物意图、事件结果或成功概率';
}

export interface QimenStemRelationFact {
  key: string;
  ownerPalaceFactKey: string;
  gong: number;
  heavenStem: string;
  earthStem: string;
  relation: string;
  pattern: string | null;
  status: '已计算';
  promptText: string;
  sources: string[];
  limitation: '天地盘干关系只记录当前宫天盘干与地盘干的生克、合、墓、刑或命名格局；不单独证明现实吉凶、人物关系、事件结果或固定应期';
}

export interface QimenPalaceCoverageFact {
  key: 'qimen:palace-coverage';
  status: '完整' | '缺少宫位' | '宫位异常';
  expectedGongs: number[];
  actualGongs: number[];
  missingGongs: number[];
  duplicateGongs: number[];
  invalidGongs: number[];
  palaceFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '九宫覆盖状态只说明当前结果能否完整核验一至九宫；缺少、重复或越界宫位时不得反推门、星、神、天地盘干、空亡、马星或格局';
}

export interface QimenPalaceRelationEvidence {
  key: string;
  fromPalaceFactKey: string;
  toPalaceFactKey: string;
  fromGong: number;
  toGong: number;
  from: string;
  to: string;
  relation: string;
  status: '已归类' | '待核验';
  meaning: string;
  promptText: string;
  sources: string[];
  limitation: '宫间关系只按候选宫五行陈述比和、生、克或待核验状态；不证明现实中的支持、阻碍、人物关系、方位吉凶、事件结果或成功概率';
}

export interface QimenPatternEvidenceFact {
  key: string;
  status: '已命中';
  name: string;
  kind: '基础格局' | '经典格局' | '复合格局';
  traditionalTone: '有利' | '风险' | '中性' | '混合';
  originalText: string;
  promptText: string;
  palaces: number[];
  sources: string[];
  limitation: '传统格局命中只证明盘面满足当前列明规则，不是现实结果、吉凶分或事件概率';
}

export interface QimenCalculationEvidenceFact {
  key: string;
  stage: '排盘范围' | '定局' | '值符定位' | '值使定位' | '四柱背景';
  status: '已确定' | '落宫缺失';
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  promptText: string;
  sourceKeys: string[];
  limitation: '定局与定位字段只证明排盘范围、主动干支、节气三元、阴阳遁局数和值符值使如何形成当前盘面，不证明现实吉凶、事件结果、人物意图、方位安全或固定应期';
}

export interface QimenRuleSourceFact {
  key: string;
  status: '已声明';
  category: '定局规则' | '值符值使规则' | '九宫排布规则' | '五行关系规则';
  rule: string;
  appliesTo: string[];
  sources: string[];
  promptText: string;
  limitation: '规则来源只标明当前结构化字段采用的传统模型与计算路径，不等于现代实证验证、现实因果关系、吉凶保证或结果概率';
}

export interface QimenCounterEvidenceFact {
  key: string;
  ownerPalaceFactKey: string;
  gong: number;
  palaceName: string;
  status: '已触发';
  detail: string;
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示候选宫命中空亡、特殊条件、风险洞察或格局限制；不得把单项限制直接写成现实失败、灾祸、人物恶意或必然结果';
}

export interface QimenCounterSummaryFact {
  key: 'qimen:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明当前候选宫核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率';
}

export interface QimenTimingFact {
  key: string;
  type: '原应期条件' | '空亡填实' | '马星触发' | '伏吟节奏' | '反吟节奏' | '应期限制' | '期限边界';
  sourceStatus: '原结果提供' | '由盘面补齐' | '统一边界';
  rhythm: '快' | '中' | '慢' | null;
  rawText?: string;
  promptText: string;
  sources: string[];
  limitation: '应期事实只提供盘内相对节奏、空亡填实、马星发动、伏吟反吟与现实触发条件；未给期限时不得换算唯一日期，也不证明事件必然发生';
}

export interface QimenTimingSummaryFact {
  key: 'qimen:timing-summary';
  status: '已提供触发条件' | '仅有期限边界';
  rhythm: '快' | '中' | '慢' | null;
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只说明当前盘面保存了哪些相对节奏与触发条件；不得把条件数量、宫数或局数换算固定天数、绝对日期或事件概率';
}

export interface QimenDirectionFact {
  key: string;
  kind: '建议方位' | '避用方位' | '候选宫方位';
  sourceStatus: '原结果提供' | '由候选宫补齐';
  gong: number;
  palaceName: string;
  palaceFactKey: string;
  direction: string;
  use: string | null;
  candidateSources: QimenCandidateSource[];
  reasons: string[];
  promptText: string;
  sources: string[];
  limitation: '方位事实只记录原结果提供的建议、避用方位或候选宫方向；采用前必须核实现实路线、安全、权限、天气与事项用神，不证明方位必然吉利、危险或成功';
}

export interface QimenDirectionSummaryFact {
  key: 'qimen:direction-summary';
  status: '有明确建议' | '仅候选映射' | '未定位';
  recommendedFactKeys: string[];
  avoidFactKeys: string[];
  candidateFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '方位汇总只说明当前结果是否提供建议、避用或候选宫方向；未列方位不代表其他方向安全，列出方位也不得脱离现实路线与安全条件使用';
}

export interface QimenSummaryFact {
  key: 'qimen:evidence-summary';
  status: '证据链完整' | '部分资料缺失' | '未定位候选宫';
  factKeys: string[];
  calculationFactCount: number;
  ruleSourceCount: number;
  palaceFactCount: number;
  candidateCount: number;
  relationCount: number;
  patternCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  directionFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '奇门证据汇总只统计排盘、九宫、候选、格局、反证、应期与方位事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图、方位保证或唯一日期';
}

export interface QimenLimitationFact {
  key: string;
  type:
    | '排盘与规则边界'
    | '九宫资料边界'
    | '用神候选边界'
    | '格局与反证边界'
    | '应期边界'
    | '方位与高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束奇门排盘、候选宫、格局、应期与方位资料能够支持的解释范围，不得被反向当作现实吉凶、人物意图、事件概率、方位保证或固定应期的证据';
}

export interface QimenEvidenceAnalysis {
  key: 'qimen:evidence';
  status: '已计算';
  calculationEvidenceFacts: QimenCalculationEvidenceFact[];
  calculationSteps: QimenCalculationEvidenceFact[];
  calculationFacts: string[];
  calculationChain: string[];
  ruleSourceFacts: QimenRuleSourceFact[];
  ruleSources: string[];
  palaceCoverageFact: QimenPalaceCoverageFact;
  palaceFacts: QimenPalaceFact[];
  candidates: QimenPalaceEvidence[];
  relations: QimenPalaceRelationEvidence[];
  patternFacts: QimenPatternEvidenceFact[];
  counterEvidenceFacts: QimenCounterEvidenceFact[];
  counterSummaryFact: QimenCounterSummaryFact;
  counterEvidence: string[];
  timingFacts: QimenTimingFact[];
  timingSummaryFact: QimenTimingSummaryFact;
  timingConditions: string[];
  directionFacts: QimenDirectionFact[];
  directionSummaryFact: QimenDirectionSummaryFact;
  directionConditions: string[];
  summaryFact: QimenSummaryFact;
  limitations: string[];
  limitationFacts: QimenLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const PALACE_FACT_LIMITATION =
  '逐宫字段是奇门九宫门、星、神、天地盘干、空亡、马星与规则命中的计算事实，只限定候选宫取证条件，不单独证明现实吉凶、事件结果、人物意图、方位安全或固定应期' as const;
const CALCULATION_FACT_LIMITATION =
  '定局与定位字段只证明排盘范围、主动干支、节气三元、阴阳遁局数和值符值使如何形成当前盘面，不证明现实吉凶、事件结果、人物意图、方位安全或固定应期' as const;
const RULE_SOURCE_LIMITATION =
  '规则来源只标明当前结构化字段采用的传统模型与计算路径，不等于现代实证验证、现实因果关系、吉凶保证或结果概率' as const;
const RELATION_FACT_LIMITATION =
  '宫间关系只按候选宫五行陈述比和、生、克或待核验状态；不证明现实中的支持、阻碍、人物关系、方位吉凶、事件结果或成功概率' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示候选宫命中空亡、特殊条件、风险洞察或格局限制；不得把单项限制直接写成现实失败、灾祸、人物恶意或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前候选宫核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率' as const;
const TIMING_FACT_LIMITATION =
  '应期事实只提供盘内相对节奏、空亡填实、马星发动、伏吟反吟与现实触发条件；未给期限时不得换算唯一日期，也不证明事件必然发生' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只说明当前盘面保存了哪些相对节奏与触发条件；不得把条件数量、宫数或局数换算固定天数、绝对日期或事件概率' as const;
const DIRECTION_FACT_LIMITATION =
  '方位事实只记录原结果提供的建议、避用方位或候选宫方向；采用前必须核实现实路线、安全、权限、天气与事项用神，不证明方位必然吉利、危险或成功' as const;
const DIRECTION_SUMMARY_LIMITATION =
  '方位汇总只说明当前结果是否提供建议、避用或候选宫方向；未列方位不代表其他方向安全，列出方位也不得脱离现实路线与安全条件使用' as const;
const PALACE_INSIGHT_FACT_LIMITATION =
  '宫位洞察只记录当前规则对该宫门、星、神、干与格局组合的分类提示；不证明现实吉凶、人物意图、事件结果或成功概率' as const;
const STEM_RELATION_FACT_LIMITATION =
  '天地盘干关系只记录当前宫天盘干与地盘干的生克、合、墓、刑或命名格局；不单独证明现实吉凶、人物关系、事件结果或固定应期' as const;
const PALACE_COVERAGE_FACT_LIMITATION =
  '九宫覆盖状态只说明当前结果能否完整核验一至九宫；缺少、重复或越界宫位时不得反推门、星、神、天地盘干、空亡、马星或格局' as const;
const SUMMARY_FACT_LIMITATION =
  '奇门证据汇总只统计排盘、九宫、候选、格局、反证、应期与方位事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图、方位保证或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束奇门排盘、候选宫、格局、应期与方位资料能够支持的解释范围，不得被反向当作现实吉凶、人物意图、事件概率、方位保证或固定应期的证据' as const;

function getBasicPatternTone(tag: string): QimenPatternEvidenceFact['traditionalTone'] {
  if (
    ['星伏吟', '星反吟', '门伏吟', '门反吟', '门迫', '击刑', '入墓'].some((prefix) =>
      tag.startsWith(prefix),
    )
  ) {
    return '风险';
  }
  if (
    ['三奇得（', '宝鉴三奇得使', '符使同宫', '三奇得使', '三奇游六仪'].some((prefix) =>
      tag.startsWith(prefix),
    )
  ) {
    return '有利';
  }
  return '中性';
}

function buildPatternFacts(data: QimenData): QimenPatternEvidenceFact[] {
  const limitation =
    '传统格局命中只证明盘面满足当前列明规则，不是现实结果、吉凶分或事件概率' as const;
  const basicFacts = (data.patternDetails ?? []).map((item, index) => ({
    key: `basic:${index}:${item.tag}`,
    status: '已命中' as const,
    name: item.tag,
    kind: '基础格局' as const,
    traditionalTone: getBasicPatternTone(item.tag),
    originalText: item.summary,
    promptText: item.summary,
    palaces: [],
    sources: ['奇门基础格局标签与当前盘面规则命中记录'],
    limitation,
  }));
  const classicFacts = (data.classicPatterns ?? []).map((item, index) => ({
    key: `classic:${index}:${item.name}:${item.palaces.join('-')}`,
    status: '已命中' as const,
    name: item.name,
    kind: '经典格局' as const,
    traditionalTone:
      item.type === 'good'
        ? ('有利' as const)
        : item.type === 'bad'
          ? ('风险' as const)
          : ('中性' as const),
    originalText: item.summary,
    promptText: item.summary,
    palaces: item.palaces,
    sources: ['奇门经典格局规则与当前盘面命中记录'],
    limitation,
  }));
  const comboFacts = (data.patternCombos ?? []).map((item) => ({
    key: item.key,
    status: '已命中' as const,
    name: item.name,
    kind: '复合格局' as const,
    traditionalTone:
      item.tone === 'super-good'
        ? ('有利' as const)
        : item.tone === 'super-bad'
          ? ('风险' as const)
          : ('混合' as const),
    originalText: item.summary,
    promptText: item.summary,
    palaces: item.palace ? [item.palace] : [],
    sources: item.sources,
    limitation,
  }));

  return [...basicFacts, ...classicFacts, ...comboFacts];
}

const GENERATING: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLLING: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function describeRelation(from: QimenJiuGongGe, to: QimenJiuGongGe) {
  if (from.element === to.element) {
    return {
      relation: '比和',
      status: '已归类' as const,
      meaning: `${from.name}与${to.name}同属${from.element}，可作同类并行证据`,
    };
  }
  if (GENERATING[from.element] === to.element) {
    return {
      relation: '前宫生后宫',
      status: '已归类' as const,
      meaning: `${from.name}${from.element}生${to.name}${to.element}`,
    };
  }
  if (GENERATING[to.element] === from.element) {
    return {
      relation: '后宫生前宫',
      status: '已归类' as const,
      meaning: `${to.name}${to.element}生${from.name}${from.element}`,
    };
  }
  if (CONTROLLING[from.element] === to.element) {
    return {
      relation: '前宫克后宫',
      status: '已归类' as const,
      meaning: `${from.name}${from.element}克${to.name}${to.element}`,
    };
  }
  if (CONTROLLING[to.element] === from.element) {
    return {
      relation: '后宫克前宫',
      status: '已归类' as const,
      meaning: `${to.name}${to.element}克${from.name}${from.element}`,
    };
  }
  return {
    relation: '关系待核验',
    status: '待核验' as const,
    meaning: `${from.name}与${to.name}的宫间关系未能归类`,
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

const SCOPE_LABELS = {
  hour: '时家奇门',
  day: '日家奇门',
  month: '月家奇门',
  year: '年家奇门',
} as const;

function getActiveGanZhi(data: QimenData): string {
  switch (data.scope) {
    case 'year':
      return data.ganzhi.year;
    case 'month':
      return data.ganzhi.month;
    case 'day':
      return data.ganzhi.day;
    default:
      return data.ganzhi.hour;
  }
}

function collectCandidateSources(data: QimenData) {
  const sourceMap = new Map<number, QimenCandidateSource[]>();
  const add = (gong: number | undefined, source: QimenCandidateSource) => {
    if (gong === undefined) return;
    sourceMap.set(gong, unique([...(sourceMap.get(gong) ?? []), source]) as QimenCandidateSource[]);
  };
  const dayStem = data.ganzhi.day.charAt(0);
  const hourStem = data.ganzhi.hour.charAt(0);
  data.jiuGongGe.forEach((palace) => {
    if (hasTianPanStar(palace, data.zhiFu)) add(palace.gong, '值符落宫');
    if (palace.renPan.door === data.zhiShi) add(palace.gong, '值使落宫');
    if (hasTianPanStem(palace, dayStem) || palace.diPan.stem === dayStem)
      add(palace.gong, '日干落宫');
    if (hasTianPanStem(palace, hourStem) || palace.diPan.stem === hourStem)
      add(palace.gong, '时干落宫');
  });
  data.palaceInsights?.forEach((item) => add(item.gong, '盘面洞察'));
  data.classicPatterns?.forEach((item) => item.palaces.forEach((gong) => add(gong, '经典格局')));
  return sourceMap;
}

function buildPalaceEvidence(
  data: QimenData,
  palace: QimenJiuGongGe,
  sources: QimenCandidateSource[],
  patternFacts: QimenPatternEvidenceFact[],
): QimenPalaceEvidence {
  const isVoid = Boolean(data.voidPalaces?.some((item) => item.palace === palace.gong));
  const hasHorse = data.horseStar?.palace === palace.gong;
  const palacePatternFacts = patternFacts.filter((item) => item.palaces.includes(palace.gong));
  const formatPatternFact = (item: QimenPatternEvidenceFact) => `${item.name}：${item.promptText}`;
  const patterns = unique(palacePatternFacts.map(formatPatternFact));
  const stemRelations = unique(
    (data.stemRelations ?? [])
      .filter((item) => item.gong === palace.gong)
      .map(
        (item) =>
          `${item.heavenStem}临${item.earthStem}为${item.relation}${item.pattern ? `，见${item.pattern}` : ''}`,
      ),
  );
  const insights = (data.palaceInsights ?? []).filter((item) => item.gong === palace.gong);
  const support = unique([
    ...insights.filter((item) => item.level === '有利').map((item) => item.summary),
    ...palacePatternFacts.filter((item) => item.traditionalTone === '有利').map(formatPatternFact),
  ]);
  const constraints = unique([
    isVoid ? '宫位逢空，相关信息可能尚未落实，须等待现实条件或填实信号复核' : '',
    ...insights.filter((item) => item.level === '风险').map((item) => item.summary),
    ...palacePatternFacts.filter((item) => item.traditionalTone === '风险').map(formatPatternFact),
    ...(data.specialConditions?.description ? [data.specialConditions.description] : []),
  ]);
  return {
    gong: palace.gong,
    palaceFactKey: `九宫:${palace.gong}:${palace.name}`,
    name: palace.name,
    direction: palace.direction,
    element: palace.element,
    sources,
    palace,
    patterns,
    stemRelations,
    support,
    constraints,
    isVoid,
    hasHorse,
  };
}

function buildPalaceFact(
  data: QimenData,
  palace: QimenJiuGongGe,
  candidateSources: QimenCandidateSource[],
  patternFacts: QimenPatternEvidenceFact[],
): QimenPalaceFact {
  const evidence = buildPalaceEvidence(data, palace, candidateSources, patternFacts);
  const palaceFactKey = `九宫:${palace.gong}:${palace.name}`;
  const globalSpecialCondition = data.specialConditions?.description
    ? data.specialConditions.description
    : '';
  const voidBranches = unique(
    (data.voidPalaces ?? [])
      .filter((item) => item.palace === palace.gong)
      .map((item) => item.branch),
  );
  const insights: QimenPalaceInsightFact[] = (data.palaceInsights ?? [])
    .filter((item) => item.gong === palace.gong)
    .map((item, index) => ({
      key: `qimen:palace-insight:${palace.gong}:${index + 1}`,
      ownerPalaceFactKey: palaceFactKey,
      level: item.level,
      status: '已命中',
      originalText: item.summary,
      promptText: item.summary,
      sources: ['当前宫位门、星、神、干与格局组合', '宫位洞察规则命中记录'],
      limitation: PALACE_INSIGHT_FACT_LIMITATION,
    }));
  const stemRelationFacts: QimenStemRelationFact[] = (data.stemRelations ?? [])
    .filter((item) => item.gong === palace.gong)
    .map((item, index) => ({
      key: `qimen:stem-relation:${palace.gong}:${index + 1}`,
      ownerPalaceFactKey: palaceFactKey,
      gong: palace.gong,
      heavenStem: item.heavenStem,
      earthStem: item.earthStem,
      relation: item.relation,
      pattern: item.pattern ?? null,
      status: '已计算',
      promptText: `${item.heavenStem}临${item.earthStem}为${item.relation}${item.pattern ? `，见${item.pattern}` : ''}`,
      sources: ['当前宫天盘干与地盘干', '天干生克、合、墓、刑与命名格局规则'],
      limitation: STEM_RELATION_FACT_LIMITATION,
    }));
  const patternFactKeys = patternFacts
    .filter((item) => item.palaces.includes(palace.gong))
    .map((item) => item.key);
  const promptText = [
    `${palace.name}（${palace.direction}，五行${palace.element}）：天盘干${formatTianPanStems(palace) || '无干'}，九星${formatTianPanStars(palace) || '无星'}，地盘${palace.diPan.stem || '无干'}，人盘${palace.renPan.door || '无门'}，神盘${palace.shenPan.god || '无神'}`,
    `组件索引门${palace.renPan.door || '无门'}、星${formatTianPanStars(palace) || '无星'}、神${palace.shenPan.god || '无神'}、天盘${formatTianPanStems(palace) || '无干'}、地盘${palace.diPan.stem || '无干'}`,
    evidence.stemRelations.length ? `天地盘干${evidence.stemRelations.join('、')}` : '',
    evidence.patterns.length ? `规则命中${evidence.patterns.join('、')}` : '',
    evidence.isVoid ? `空亡${voidBranches.join('、') || '命中但地支未列'}` : '',
    evidence.hasHorse ? `马星同宫（来源支${data.horseStar?.sourceBranch || '未列'}）` : '',
    candidateSources.length ? `候选来源${candidateSources.join('、')}` : '未列为当前候选宫',
  ]
    .filter(Boolean)
    .join('；');
  return {
    key: palaceFactKey,
    status: '已计算',
    gong: palace.gong,
    name: palace.name,
    direction: palace.direction,
    element: palace.element,
    tianPan: palace.tianPan,
    diPan: palace.diPan,
    renPan: palace.renPan,
    shenPan: palace.shenPan,
    candidateSources,
    isVoid: evidence.isVoid,
    voidBranches,
    hasHorse: evidence.hasHorse,
    horseSourceBranch: evidence.hasHorse ? data.horseStar?.sourceBranch : undefined,
    patterns: evidence.patterns,
    patternFactKeys,
    stemRelations: evidence.stemRelations,
    stemRelationFacts,
    insights,
    support: evidence.support,
    constraints: evidence.constraints.filter((item) => item !== globalSpecialCondition),
    promptText,
    sources: [
      '奇门遁局九宫门、星、神与天地盘干排布',
      '当前旬空落宫、驿马落宫与天地盘干关系计算',
      '基础格局、经典格局、复合格局与宫位洞察规则命中',
    ],
    limitation: PALACE_FACT_LIMITATION,
  };
}

function buildSummaryFact(params: {
  calculationEvidenceFacts: QimenCalculationEvidenceFact[];
  ruleSourceFacts: QimenRuleSourceFact[];
  palaceCoverageFact: QimenPalaceCoverageFact;
  palaceFacts: QimenPalaceFact[];
  candidates: QimenPalaceEvidence[];
  relations: QimenPalaceRelationEvidence[];
  patternFacts: QimenPatternEvidenceFact[];
  counterEvidenceFacts: QimenCounterEvidenceFact[];
  counterSummaryFact: QimenCounterSummaryFact;
  timingFacts: QimenTimingFact[];
  timingSummaryFact: QimenTimingSummaryFact;
  directionFacts: QimenDirectionFact[];
  directionSummaryFact: QimenDirectionSummaryFact;
}): QimenSummaryFact {
  const factKeys = Array.from(
    new Set([
      ...params.calculationEvidenceFacts.map((item) => item.key),
      ...params.ruleSourceFacts.map((item) => item.key),
      params.palaceCoverageFact.key,
      ...params.palaceFacts.flatMap((item) => [
        item.key,
        ...item.patternFactKeys,
        ...item.stemRelationFacts.map((fact) => fact.key),
        ...item.insights.map((fact) => fact.key),
      ]),
      ...params.relations.map((item) => item.key),
      ...params.patternFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      params.timingSummaryFact.key,
      ...params.timingFacts.map((item) => item.key),
      params.directionSummaryFact.key,
      ...params.directionFacts.map((item) => item.key),
    ]),
  );
  const status =
    params.palaceCoverageFact.status !== '完整' ||
    params.calculationEvidenceFacts.some((item) => item.status === '落宫缺失')
      ? '部分资料缺失'
      : params.candidates.length
        ? '证据链完整'
        : '未定位候选宫';
  return {
    key: 'qimen:evidence-summary',
    status,
    factKeys,
    calculationFactCount: params.calculationEvidenceFacts.length,
    ruleSourceCount: params.ruleSourceFacts.length,
    palaceFactCount: params.palaceFacts.length,
    candidateCount: params.candidates.length,
    relationCount: params.relations.length,
    patternCount: params.patternFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    directionFactCount: params.directionFacts.length,
    promptText: `证据状态${status}：排盘事实${params.calculationEvidenceFacts.length}项、规则来源${params.ruleSourceFacts.length}项、九宫事实${params.palaceFacts.length}项、候选宫${params.candidates.length}项、宫间关系${params.relations.length}项、格局${params.patternFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项、方位${params.directionFacts.length}项`,
    sources: ['全部排盘、规则、九宫、候选、格局、反证、应期与方位事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildLimitationFacts(params: {
  calculationEvidenceFacts: QimenCalculationEvidenceFact[];
  ruleSourceFacts: QimenRuleSourceFact[];
  palaceCoverageFact: QimenPalaceCoverageFact;
  palaceFacts: QimenPalaceFact[];
  candidates: QimenPalaceEvidence[];
  relations: QimenPalaceRelationEvidence[];
  patternFacts: QimenPatternEvidenceFact[];
  counterEvidenceFacts: QimenCounterEvidenceFact[];
  counterSummaryFact: QimenCounterSummaryFact;
  timingFacts: QimenTimingFact[];
  timingSummaryFact: QimenTimingSummaryFact;
  directionFacts: QimenDirectionFact[];
  directionSummaryFact: QimenDirectionSummaryFact;
  summaryFact: QimenSummaryFact;
}): QimenLimitationFact[] {
  const definitions: Array<
    Pick<QimenLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'qimen:limitation:calculation-rules',
      type: '排盘与规则边界',
      ownerFactKeys: [
        ...params.calculationEvidenceFacts.map((item) => item.key),
        ...params.ruleSourceFacts.map((item) => item.key),
      ],
      promptText:
        '排盘事实与规则来源只证明当前时刻、定局、值符值使及九宫排布所采用的计算路径，不等于现代实证验证、现实因果、吉凶保证或结果概率',
      sources: ['定局、值符值使、九宫排布与五行关系规则来源'],
    },
    {
      key: 'qimen:limitation:palace-data',
      type: '九宫资料边界',
      ownerFactKeys: [
        params.palaceCoverageFact.key,
        ...params.palaceFacts.flatMap((item) => [
          item.key,
          ...item.stemRelationFacts.map((fact) => fact.key),
          ...item.insights.map((fact) => fact.key),
        ]),
      ],
      promptText:
        '九宫事实只记录门、星、神、天地盘干、空亡、马星和规则命中；宫位缺失、重复或越界时不得补造内容，资料完整也不直接证明现实吉凶',
      sources: ['九宫覆盖核验与逐宫门星神干事实'],
    },
    {
      key: 'qimen:limitation:candidates',
      type: '用神候选边界',
      ownerFactKeys: Array.from(
        new Set([
          ...params.candidates.map((item) => item.palaceFactKey),
          ...params.relations.map((item) => item.key),
        ]),
      ),
      promptText:
        '以上宫位均为盘面候选，不等于已经按具体问题选定用神；值符、值使、日干、时干、洞察和格局只能提出候选范围，不得把候选顺序或宫间五行关系写成现实主次、支持阻碍或人物意图',
      sources: ['候选宫来源与候选宫间五行关系'],
    },
    {
      key: 'qimen:limitation:patterns-counters',
      type: '格局与反证边界',
      ownerFactKeys: [
        ...params.patternFacts.map((item) => item.key),
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
      ],
      promptText:
        '传统格局、空亡、特殊条件和风险洞察只证明当前规则命中或存在盘内限制；不得把单项命中写成现实成功、失败、灾祸、人物恶意或必然结果',
      sources: ['基础格局、经典格局、复合格局与候选宫限制逐项核验'],
    },
    {
      key: 'qimen:limitation:timing',
      type: '应期边界',
      ownerFactKeys: [params.timingSummaryFact.key, ...params.timingFacts.map((item) => item.key)],
      promptText:
        '应期只保留盘内相对节奏、填实、马星、伏吟反吟和现实触发条件；未给目标期限时不得换算唯一日期、固定天数或事件概率',
      sources: ['逐项应期事实、相对节奏与期限边界'],
    },
    {
      key: 'qimen:limitation:direction-risk',
      type: '方位与高风险输出边界',
      ownerFactKeys: [
        params.summaryFact.key,
        params.directionSummaryFact.key,
        ...params.directionFacts.map((item) => item.key),
      ],
      promptText:
        '方位仅供路线和行动条件复核，使用前必须核实现实安全、权限、天气与事项用神；不得输出吉凶总分、成功率、医疗法律财务定论或保证有效建议',
      sources: ['方位事实汇总与现实安全、高风险输出约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeQimenEvidence(data: QimenData): QimenEvidenceAnalysis {
  if (!data.jiuGongGe.length) {
    throw new Error('奇门证据分析至少需要一个宫位数据。');
  }
  const sourceMap = collectCandidateSources(data);
  const patternFacts = buildPatternFacts(data);
  const palaceFacts = [...data.jiuGongGe]
    .sort((left, right) => left.gong - right.gong)
    .map((palace) => buildPalaceFact(data, palace, sourceMap.get(palace.gong) ?? [], patternFacts));
  const expectedGongs = Array.from({ length: 9 }, (_, index) => index + 1);
  const rawGongs = data.jiuGongGe.map((item) => item.gong);
  const actualGongs = [...new Set(rawGongs)].sort((left, right) => left - right);
  const missingGongs = expectedGongs.filter((gong) => !actualGongs.includes(gong));
  const duplicateGongs = actualGongs.filter(
    (gong) => rawGongs.filter((item) => item === gong).length > 1,
  );
  const invalidGongs = actualGongs.filter(
    (gong) => !Number.isInteger(gong) || gong < 1 || gong > 9,
  );
  const palaceCoverageFact: QimenPalaceCoverageFact = {
    key: 'qimen:palace-coverage',
    status:
      duplicateGongs.length || invalidGongs.length
        ? '宫位异常'
        : missingGongs.length
          ? '缺少宫位'
          : '完整',
    expectedGongs,
    actualGongs,
    missingGongs,
    duplicateGongs,
    invalidGongs,
    palaceFactKeys: palaceFacts.map((item) => item.key),
    promptText:
      duplicateGongs.length || invalidGongs.length
        ? `九宫覆盖异常：重复宫位${duplicateGongs.join('、') || '无'}；越界宫位${invalidGongs.join('、') || '无'}`
        : missingGongs.length
          ? `九宫资料缺少${missingGongs.join('、')}宫，不得补造缺失宫位内容`
          : '九宫资料完整覆盖一至九宫，可逐宫核验',
    sources: ['当前九宫数组的宫号、数量与唯一性核验'],
    limitation: PALACE_COVERAGE_FACT_LIMITATION,
  };
  const scope = data.scope ?? 'hour';
  const scopeLabel = SCOPE_LABELS[scope];
  const layoutMethod = data.method ?? 'zhuanpan';
  const layoutMethodLabel = layoutMethod === 'feipan' ? '飞盘法' : '转盘法';
  const juMethod =
    data.juMethod ?? (data.timeInfo?.juMethod as 'chaibu' | 'zhirun' | undefined) ?? 'chaibu';
  const juMethodLabel = juMethod === 'zhirun' ? '置闰法' : '拆补法';
  const juTerm = data.timeInfo.juTerm || data.timeInfo.solarTerm;
  const activeGanZhi = getActiveGanZhi(data);
  const zhiFuPalace = data.jiuGongGe.find((item) => hasTianPanStar(item, data.zhiFu));
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const ruleSourceFacts: QimenRuleSourceFact[] = [
    {
      key: 'rule:qimen:setup',
      status: '已声明',
      category: '定局规则',
      rule: '节气、三元与主动干支共同确定阴阳遁和局数',
      appliesTo: ['排盘范围', '定局'],
      sources: ['《烟波钓叟歌》阴阳二遁与一气三元口径', '时家、日家、月家与年家分层定局计算入口'],
      promptText: `${scopeLabel}定局规则：采用${juMethodLabel}，节气、三元与主动干支共同确定阴阳遁和局数${data.timeInfo?.juMethodNote ? `；${data.timeInfo.juMethodNote}` : ''}`,
      limitation: RULE_SOURCE_LIMITATION,
    },
    {
      key: 'rule:qimen:leaders',
      status: '已声明',
      category: '值符值使规则',
      rule: '由主动干支、遁局和旬首体系定位值符星与值使门',
      appliesTo: ['值符定位', '值使定位'],
      sources: ['《烟波钓叟歌》直符直使与时干时支口径', '旬首、值符与值使定位计算'],
      promptText: '旬首值符值使规则：由主动干支、遁局和旬首体系定位值符星与值使门',
      limitation: RULE_SOURCE_LIMITATION,
    },
    {
      key: 'rule:qimen:layout',
      status: '已声明',
      category: '九宫排布规则',
      rule: `${layoutMethodLabel}排列门、星、神及天地盘干后逐宫核验`,
      appliesTo: ['九宫事实', '空亡与马星', '格局命中'],
      sources:
        layoutMethod === 'feipan'
          ? ['洛书九宫飞布路径与飞盘争议口径', '飞盘九星、八门、八神与天地盘干排布计算']
          : ['《烟波钓叟歌》星随符转、门随地转口径', '转盘九宫门星神干排布计算'],
      promptText: `${layoutMethodLabel}九宫规则：门、星、神及天地盘干按当前方法排列后逐宫核验`,
      limitation: RULE_SOURCE_LIMITATION,
    },
    {
      key: 'rule:qimen:relations',
      status: '已声明',
      category: '五行关系规则',
      rule: '候选宫之间只按宫五行陈述比和、生、克关系',
      appliesTo: ['候选宫关系'],
      sources: ['五行生克公共关系', '当前候选宫五行字段'],
      promptText: '五行生克规则：候选宫之间只按宫五行陈述比和、生、克关系',
      limitation: RULE_SOURCE_LIMITATION,
    },
  ];
  const calculationEvidenceFacts: QimenCalculationEvidenceFact[] = [
    {
      key: 'qimen:calculation:scope',
      stage: '排盘范围',
      status: '已确定',
      inputs: { scope, activeGanZhi, layoutMethod },
      result: { scopeLabel, activeGanZhi, layoutMethodLabel },
      promptText: `排盘范围：${scopeLabel}，采用${layoutMethodLabel}与${juMethodLabel}，以${activeGanZhi}作为本盘主动干支`,
      sourceKeys: ['rule:qimen:setup'],
      limitation: CALCULATION_FACT_LIMITATION,
    },
    {
      key: 'qimen:calculation:setup',
      stage: '定局',
      status: '已确定',
      inputs: {
        solarTerm: data.timeInfo.solarTerm,
        juTerm,
        epoch: data.timeInfo.epoch,
        activeGanZhi,
      },
      result: { isYangDun: data.isYangDun, juShu: data.juShu },
      promptText: `定局结果：${juTerm}${data.timeInfo.epoch}，${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局${juTerm !== data.timeInfo.solarTerm ? `；排盘时实际节气为${data.timeInfo.solarTerm}` : ''}`,
      sourceKeys: ['rule:qimen:setup'],
      limitation: CALCULATION_FACT_LIMITATION,
    },
    {
      key: 'qimen:calculation:zhifu',
      stage: '值符定位',
      status: zhiFuPalace ? '已确定' : '落宫缺失',
      inputs: { activeGanZhi, zhiFu: data.zhiFu },
      result: {
        zhiFu: data.zhiFu,
        ...(zhiFuPalace
          ? { palace: zhiFuPalace.gong, palaceName: zhiFuPalace.name }
          : { palaceName: '落宫未检出' }),
      },
      promptText: `值符定位：${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '落宫未检出'}`,
      sourceKeys: ['rule:qimen:leaders', 'rule:qimen:layout'],
      limitation: CALCULATION_FACT_LIMITATION,
    },
    {
      key: 'qimen:calculation:zhishi',
      stage: '值使定位',
      status: zhiShiPalace ? '已确定' : '落宫缺失',
      inputs: { activeGanZhi, zhiShi: data.zhiShi },
      result: {
        zhiShi: data.zhiShi,
        ...(zhiShiPalace
          ? { palace: zhiShiPalace.gong, palaceName: zhiShiPalace.name }
          : { palaceName: '落宫未检出' }),
      },
      promptText: `值使定位：${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '落宫未检出'}`,
      sourceKeys: ['rule:qimen:leaders', 'rule:qimen:layout'],
      limitation: CALCULATION_FACT_LIMITATION,
    },
    {
      key: 'qimen:calculation:ganzhi',
      stage: '四柱背景',
      status: '已确定',
      inputs: {},
      result: {
        year: data.ganzhi.year,
        month: data.ganzhi.month,
        day: data.ganzhi.day,
        hour: data.ganzhi.hour,
      },
      promptText: `四柱干支：年${data.ganzhi.year}、月${data.ganzhi.month}、日${data.ganzhi.day}、时${data.ganzhi.hour}`,
      sourceKeys: ['rule:qimen:setup'],
      limitation: CALCULATION_FACT_LIMITATION,
    },
  ];
  const calculationFacts = unique(calculationEvidenceFacts.map((item) => item.promptText));
  const ruleSources = unique(ruleSourceFacts.map((item) => item.promptText));
  const sourcePriority: QimenCandidateSource[] = [
    '值符落宫',
    '值使落宫',
    '日干落宫',
    '时干落宫',
    '盘面洞察',
    '经典格局',
  ];
  const candidates = Array.from(sourceMap.entries())
    .map(([gong, sources]) => {
      const palace = data.jiuGongGe.find((item) => item.gong === gong);
      return palace ? buildPalaceEvidence(data, palace, sources, patternFacts) : null;
    })
    .filter((item): item is QimenPalaceEvidence => Boolean(item))
    .sort((left, right) => {
      const leftPriority = Math.min(...left.sources.map((item) => sourcePriority.indexOf(item)));
      const rightPriority = Math.min(...right.sources.map((item) => sourcePriority.indexOf(item)));
      return leftPriority - rightPriority || left.gong - right.gong;
    });
  const primary = candidates[0];
  const relations = primary
    ? candidates.slice(1).map((candidate): QimenPalaceRelationEvidence => {
        const relation = describeRelation(primary.palace, candidate.palace);
        return {
          key: `qimen:relation:${primary.gong}:${candidate.gong}`,
          fromPalaceFactKey: primary.palaceFactKey,
          toPalaceFactKey: candidate.palaceFactKey,
          fromGong: primary.gong,
          toGong: candidate.gong,
          from: primary.name,
          to: candidate.name,
          ...relation,
          promptText: `${primary.name}与${candidate.name}为${relation.relation}；${relation.meaning}`,
          sources: ['候选宫五行字段', '五行比和、生、克公共关系'],
          limitation: RELATION_FACT_LIMITATION,
        };
      })
    : [];
  const counterEvidenceFacts: QimenCounterEvidenceFact[] = candidates.flatMap((item) =>
    item.constraints.map((detail, index) => ({
      key: `qimen:counter:${item.gong}:${index + 1}`,
      ownerPalaceFactKey: item.palaceFactKey,
      gong: item.gong,
      palaceName: item.name,
      status: '已触发' as const,
      detail,
      promptText: `${item.name}限制：${detail}`,
      sources: ['对应九宫逐宫事实', '空亡、特殊条件、风险洞察与格局限制核验'],
      limitation: COUNTER_FACT_LIMITATION,
    })),
  );
  const counterEvidence = unique(counterEvidenceFacts.map((item) => item.detail));
  const counterSummaryFact: QimenCounterSummaryFact = {
    key: 'qimen:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `当前${counterEvidenceFacts.length}项候选宫限制已逐项记录，须与支持证据同时核验`
      : '当前候选宫未见空亡或明确风险限制，但仍须核实现实风险',
    sources: ['候选宫 constraints 字段逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const timingFacts: QimenTimingFact[] = [];
  const addTimingFact = (fact: QimenTimingFact) => {
    if (!timingFacts.some((item) => item.promptText === fact.promptText)) timingFacts.push(fact);
  };
  (data.yingQi?.triggerConditions ?? []).forEach((promptText, index) =>
    addTimingFact({
      key: `qimen:timing:input:${index + 1}`,
      type: '原应期条件',
      sourceStatus: '原结果提供',
      rhythm: data.yingQi?.rhythm ?? null,
      rawText: promptText,
      promptText,
      sources: data.yingQi?.sources.length ? [...data.yingQi.sources] : ['当前应期触发条件字段'],
      limitation: TIMING_FACT_LIMITATION,
    }),
  );
  if (data.voidPalaces?.length) {
    addTimingFact({
      key: 'qimen:timing:void',
      type: '空亡填实',
      sourceStatus: '由盘面补齐',
      rhythm: data.yingQi?.rhythm ?? null,
      promptText: `逢空宫位${unique(data.voidPalaces.map((item) => item.name)).join('、')}须先观察填实或现实条件落实`,
      sources: ['当前旬空地支与空亡落宫', '空亡填实触发口径'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  if (data.horseStar) {
    addTimingFact({
      key: 'qimen:timing:horse',
      type: '马星触发',
      sourceStatus: '由盘面补齐',
      rhythm: data.yingQi?.rhythm ?? null,
      promptText: `马星落${data.horseStar.name}，以实际移动、变动或外部推动作为触发验证`,
      sources: ['驿马来源支与落宫', '实际移动、变动或外部推动触发口径'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  if (data.patternTags?.some((item) => item.includes('伏吟'))) {
    addTimingFact({
      key: 'qimen:timing:fuyin',
      type: '伏吟节奏',
      sourceStatus: '由盘面补齐',
      rhythm: data.yingQi?.rhythm ?? null,
      promptText: '伏吟只提示节奏可能偏静或重复，须由现实进展复核',
      sources: ['当前伏吟格局标签', '伏吟相对节奏口径'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  if (data.patternTags?.some((item) => item.includes('反吟'))) {
    addTimingFact({
      key: 'qimen:timing:fanyin',
      type: '反吟节奏',
      sourceStatus: '由盘面补齐',
      rhythm: data.yingQi?.rhythm ?? null,
      promptText: '反吟只提示变化或反复信号，须由现实事件复核',
      sources: ['当前反吟格局标签', '反吟相对节奏口径'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  (data.yingQi?.limitations ?? []).forEach((promptText, index) =>
    addTimingFact({
      key: `qimen:timing:limitation:${index + 1}`,
      type: '应期限制',
      sourceStatus: '原结果提供',
      rhythm: data.yingQi?.rhythm ?? null,
      rawText: promptText,
      promptText,
      sources: data.yingQi?.sources.length ? [...data.yingQi.sources] : ['当前应期限制字段'],
      limitation: TIMING_FACT_LIMITATION,
    }),
  );
  addTimingFact({
    key: 'qimen:timing:deadline-boundary',
    type: '期限边界',
    sourceStatus: '统一边界',
    rhythm: data.yingQi?.rhythm ?? null,
    promptText: '未给目标期限时不把宫数、局数或盘内快慢换算成唯一日期',
    sources: ['相对节奏与现实日期分离原则'],
    limitation: TIMING_FACT_LIMITATION,
  });
  const timingConditions = timingFacts.map((item) => item.promptText);
  const hasTriggerCondition = timingFacts.some(
    (item) => item.type !== '期限边界' && item.type !== '应期限制',
  );
  const timingSummaryFact: QimenTimingSummaryFact = {
    key: 'qimen:timing-summary',
    status: hasTriggerCondition ? '已提供触发条件' : '仅有期限边界',
    rhythm: data.yingQi?.rhythm ?? null,
    factKeys: timingFacts.map((item) => item.key),
    promptText: `应期状态：${data.yingQi?.rhythm ? `相对节奏${data.yingQi.rhythm}；` : ''}${hasTriggerCondition ? `已记录${timingFacts.length}项触发与限制条件` : '未提供具体触发条件，仅保留期限边界'}`,
    sources: ['逐项应期事实汇总'],
    limitation: TIMING_SUMMARY_LIMITATION,
  };
  const candidateByGong = new Map(candidates.map((item) => [item.gong, item]));
  const directionFacts: QimenDirectionFact[] = [
    ...(data.directions?.goodDirections ?? []).map((item): QimenDirectionFact => {
      const candidate = candidateByGong.get(item.gong);
      return {
        key: `qimen:direction:recommended:${item.gong}`,
        kind: '建议方位',
        sourceStatus: '原结果提供',
        gong: item.gong,
        palaceName: item.name,
        palaceFactKey: candidate?.palaceFactKey ?? `九宫:${item.gong}:${item.name}`,
        direction: item.direction,
        use: item.use,
        candidateSources: candidate?.sources ?? [],
        reasons: [...item.reasons],
        promptText: `建议方位${item.direction}${item.name}；适用${item.use}；依据${item.reasons.join('、') || '未列'}；方位仅在现实路线、安全和事项用神均匹配时采用`,
        sources: ['原方位建议结果', '对应九宫门星神干、空亡、格局与方位理由'],
        limitation: DIRECTION_FACT_LIMITATION,
      };
    }),
    ...(data.directions?.avoidDirections ?? []).map((item): QimenDirectionFact => {
      const candidate = candidateByGong.get(item.gong);
      return {
        key: `qimen:direction:avoid:${item.gong}`,
        kind: '避用方位',
        sourceStatus: '原结果提供',
        gong: item.gong,
        palaceName: item.name,
        palaceFactKey: candidate?.palaceFactKey ?? `九宫:${item.gong}:${item.name}`,
        direction: item.direction,
        use: item.use,
        candidateSources: candidate?.sources ?? [],
        reasons: [...item.reasons],
        promptText: `避用方位${item.direction}${item.name}；范围${item.use}；依据${item.reasons.join('、') || '未列'}；须结合现实风险与路线条件复核`,
        sources: ['原避用方位结果', '对应九宫难门、难神、空亡与格局限制'],
        limitation: DIRECTION_FACT_LIMITATION,
      };
    }),
    ...candidates.slice(0, 4).map((item): QimenDirectionFact => ({
      key: `qimen:direction:candidate:${item.gong}`,
      kind: '候选宫方位',
      sourceStatus: '由候选宫补齐',
      gong: item.gong,
      palaceName: item.name,
      palaceFactKey: item.palaceFactKey,
      direction: item.direction,
      use: null,
      candidateSources: [...item.sources],
      reasons: item.sources.map((source) => `候选来源：${source}`),
      promptText: `${item.direction}${item.name}来自${item.sources.join('、')}；这只是候选宫方向；方位仅在现实路线、安全和事项用神均匹配时采用`,
      sources: ['候选宫方向字段', '值符、值使、日干、时干、盘面洞察与经典格局候选来源'],
      limitation: DIRECTION_FACT_LIMITATION,
    })),
  ];
  const recommendedDirectionFacts = directionFacts.filter((item) => item.kind === '建议方位');
  const avoidDirectionFacts = directionFacts.filter((item) => item.kind === '避用方位');
  const candidateDirectionFacts = directionFacts.filter((item) => item.kind === '候选宫方位');
  const directionSummaryFact: QimenDirectionSummaryFact = {
    key: 'qimen:direction-summary',
    status:
      recommendedDirectionFacts.length || avoidDirectionFacts.length
        ? '有明确建议'
        : candidateDirectionFacts.length
          ? '仅候选映射'
          : '未定位',
    recommendedFactKeys: recommendedDirectionFacts.map((item) => item.key),
    avoidFactKeys: avoidDirectionFacts.map((item) => item.key),
    candidateFactKeys: candidateDirectionFacts.map((item) => item.key),
    promptText:
      recommendedDirectionFacts.length || avoidDirectionFacts.length
        ? `方位状态：建议${recommendedDirectionFacts.length}项、避用${avoidDirectionFacts.length}项，并保留${candidateDirectionFacts.length}项候选宫方向`
        : candidateDirectionFacts.length
          ? `方位状态：未形成明确建议，仅保留${candidateDirectionFacts.length}项候选宫方向`
          : '方位状态：未定位候选方向，须完全依据现实路线与安全条件判断',
    sources: ['逐项方位事实汇总'],
    limitation: DIRECTION_SUMMARY_LIMITATION,
  };
  const directionConditions = directionFacts.map((item) => item.promptText);
  const summaryFact = buildSummaryFact({
    calculationEvidenceFacts,
    ruleSourceFacts,
    palaceCoverageFact,
    palaceFacts,
    candidates,
    relations,
    patternFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    directionFacts,
    directionSummaryFact,
  });
  const limitationFacts = buildLimitationFacts({
    calculationEvidenceFacts,
    ruleSourceFacts,
    palaceCoverageFact,
    palaceFacts,
    candidates,
    relations,
    patternFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    directionFacts,
    directionSummaryFact,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const patternItems: PromptEvidenceItem[] = patternFacts.map((pattern): PromptEvidenceItem => ({
    level: pattern.traditionalTone === '风险' ? '反证' : '辅证',
    title: `${pattern.kind}：${pattern.name}`,
    detail: `${pattern.promptText}；传统分类：${pattern.traditionalTone}；命中宫位：${pattern.palaces.join('、') || '跨宫或全局'}；组成来源：${pattern.sources.join('、') || '未列明'}；边界：${pattern.limitation}`,
    source: `${pattern.kind}规则命中链；原始传统文字另行保留，当前提示词只使用条件化文本`,
    tags: [
      pattern.kind,
      pattern.traditionalTone,
      ...pattern.palaces.map((palace) => `${palace}宫`),
    ],
  }));
  const relationItems: PromptEvidenceItem[] = relations.map((item) => ({
    level: item.status === '已归类' ? '辅证' : '反证',
    title: `${item.from}与${item.to}宫间作用`,
    detail: `${item.promptText}；边界：${item.limitation}`,
    source: item.sources.join('、'),
    tags: ['宫间关系', item.relation, item.from, item.to],
  }));
  const items: PromptEvidenceItem[] = [
    {
      level: calculationEvidenceFacts.some((item) => item.status === '落宫缺失') ? '反证' : '辅证',
      title: '定局计算事实',
      detail: `${calculationEvidenceFacts.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_FACT_LIMITATION}`,
      source: ruleSourceFacts
        .slice(0, 2)
        .map((item) => `${item.key} ${item.sources.join('、')}；${item.promptText}`)
        .join('；'),
      tags: [
        scopeLabel,
        layoutMethodLabel,
        juMethodLabel,
        data.isYangDun ? '阳遁' : '阴遁',
        `${data.juShu}局`,
      ],
    },
    {
      level: palaceCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '九宫资料覆盖状态',
      detail: `${palaceCoverageFact.promptText}；边界：${palaceCoverageFact.limitation}`,
      source: palaceCoverageFact.sources.join('、'),
      tags: ['九宫覆盖', palaceCoverageFact.status],
    },
    {
      level: '主证',
      title: '值符值使定位事实',
      detail: `${calculationEvidenceFacts[2].promptText}；${calculationEvidenceFacts[3].promptText}。这是盘面中心定位事实，不自动等同于事项吉凶。`,
      source: `${ruleSourceFacts[1].key} ${ruleSourceFacts[1].sources.join('、')}；${ruleSourceFacts[1].promptText}`,
      tags: ['值符', '值使', data.zhiFu, data.zhiShi],
    },
    {
      level: '主证',
      title: '奇门九宫逐宫计算事实',
      detail: `${palaceFacts.map((item) => item.promptText).join('；')}；统一边界：${PALACE_FACT_LIMITATION}`,
      source: '奇门遁局九宫排布、旬空驿马、天地盘干与格局规则逐宫映射',
      tags: ['九宫事实', '门星神干', '空亡', '马星', '规则命中'],
    },
    ...candidates.slice(0, 6).map((item, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${item.name}用神宫候选`,
      detail: `引用逐宫事实${item.palaceFactKey}；候选来源${item.sources.join('、')}；支持${item.support.join('、') || '未见独立增强证据'}；限制${item.constraints.join('、') || '未见空亡或明确风险标签'}`,
      source: '值符、值使、日干、时干、盘面洞察与经典格局候选定位',
      tags: [item.name, ...item.sources],
    })),
    ...patternItems,
    ...relationItems,
    {
      level: counterSummaryFact.status === '有明确反证' ? '反证' : '辅证',
      title: '候选宫反证覆盖状态',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    ...(data.seasonality
      ? [
          {
            level: '辅证' as const,
            title: '节令与四柱背景事实',
            detail: `实际节气${data.seasonality.currentJieQi}；定局${data.timeInfo.juTerm || data.timeInfo.solarTerm}${data.timeInfo.epoch}；季节五行${data.seasonality.seasonalElement}；日干${data.seasonality.dayStem}属${data.seasonality.dayElement}，${data.seasonality.seasonRelationDescription}；月相${data.seasonality.lunarPhase}（${data.seasonality.lunarPhaseDetail}）；建除${data.seasonality.dayOfficer}（${data.seasonality.dayOfficerFortuneLabel}）；四柱互动${data.seasonality.ganzhiInteractions.map((item) => item.description).join('、') || '未检出明确合冲刑害'}`,
            source: '节气历表、月相证据、建除规则与四柱关系逐项计算',
            tags: ['节令', '月相', '建除', '四柱互动'],
          },
        ]
      : []),
    {
      level: '应期',
      title: '应期触发与验证条件',
      detail: `${timingSummaryFact.promptText}；${timingFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
      source: unique(timingFacts.flatMap((item) => item.sources)).join('、'),
      tags: ['应期', '触发条件', '不换算固定日期'],
    },
    {
      level: '辅证',
      title: '候选方位使用条件',
      detail: `${directionSummaryFact.promptText}；${directionFacts.map((item) => item.promptText).join('；') || '未定位候选方位，须结合现实路线与安全条件'}；统一边界：${directionSummaryFact.limitation}`,
      source:
        unique(directionFacts.flatMap((item) => item.sources)).join('、') || '现实路线与安全条件',
      tags: ['方位', '现实条件'],
    },
    {
      level: '辅证',
      title: `奇门证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '奇门用神与方位解释边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: unique(limitationFacts.flatMap((item) => item.sources)).join('、'),
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '奇门用神宫与宫间作用结构化证据', items };
  const calculationChain = calculationEvidenceFacts.map((item) => item.promptText);
  const promptText = [
    '【奇门用神宫与宫间作用结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `触发条件：${timingConditions.join('；')}`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'qimen:evidence',
    status: '已计算',
    calculationEvidenceFacts,
    calculationSteps: calculationEvidenceFacts,
    calculationFacts,
    calculationChain,
    ruleSourceFacts,
    ruleSources,
    palaceCoverageFact,
    palaceFacts,
    candidates,
    relations,
    patternFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    timingFacts,
    timingSummaryFact,
    timingConditions,
    directionFacts,
    directionSummaryFact,
    directionConditions,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText,
    methodology: [
      '先定位值符、值使、日干和时干落宫，再补充盘面洞察与经典格局候选。',
      '逐宫保留门、星、神、天地盘干、空亡、马星、格局、支持与限制。',
      '定局、值符值使、复合格局来源、宫间作用、应期和方位条件全部进入统一证据条目。',
      '传统格局原文保留在结构化结果中，提示词只读取条件化副本并注明传统分类与现代实证边界。',
      '候选宫之间只陈述可复核的五行生克关系，不用数字分数代替判断。',
      '未按问题选定用神时明确保留候选性质，不输出吉凶总分、成功率或绝对日期。',
    ],
  };
}
