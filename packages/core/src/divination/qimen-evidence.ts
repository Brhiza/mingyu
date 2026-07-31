import type { QimenData, QimenJiuGongGe } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  formatTianPanStars,
  formatTianPanStems,
  hasTianPanStar,
  hasTianPanStem,
} from './algorithms/qimen/helpers/palace-utils';
import { getClassicPatterns, getStemRelations } from './algorithms/qimen/helpers/classic-patterns';
import { buildPatternDetails, getQimenPatternTags } from './algorithms/qimen/helpers/patterns';
import { AUDITED_QIMEN_CLASSIC_PATTERN_NAMES } from './algorithms/qimen/helpers/stem-pair-patterns';
import { detectQimenPatternCombos } from './algorithms/qimen/helpers/pattern-combos';
import { checkSpecialHourConditions, getDunJiaStem } from './algorithms/qimen/helpers/jushu';
import { diPanPalaces, STEM_TOMB_MAP } from './algorithms/qimen/helpers/_constants';
import { buildSeasonality } from './algorithms/qimen/helpers/seasonality';
import { getVoidBranches } from '../calendar/lunar';
import { TimeManager } from '../calendar/timeManager';

export type QimenPalaceIndexSource = '值符落宫' | '值使落宫' | '日干落宫' | '时干落宫' | '经典格局';

export interface QimenPalaceIndexFact {
  gong: number;
  palaceFactKey: string;
  name: string;
  direction: string;
  element: string;
  indexSources: QimenPalaceIndexSource[];
  palace: QimenJiuGongGe;
  patterns: string[];
  stemRelations: string[];
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
  indexSources: QimenPalaceIndexSource[];
  isVoid: boolean;
  voidBranches: string[];
  hasHorse: boolean;
  horseSourceBranch?: string;
  patterns: string[];
  patternFactKeys: string[];
  stemRelations: string[];
  stemRelationFacts: QimenStemRelationFact[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '逐宫字段是奇门九宫门、星、神、天地盘干、空亡、马星与规则命中的计算事实，只提供可复核位置与结构，不单独证明现实吉凶、事件结果、人物意图、方位安全或固定应期';
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
  limitation: '天地盘干关系只记录当前宫天盘干与地盘干的生克、标准天干五合、墓、刑，或十一项已校勘固定格；其余七十项组合不作为传统格局，不单独证明现实吉凶、人物关系、事件结果或固定应期';
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
  limitation: '宫间关系穷举当前九宫全部无序宫对，只按宫位五行陈述比和、生、克或待核验状态；不证明现实中的支持、阻碍、人物关系、方位吉凶、事件结果或成功概率';
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
  stage: '排盘范围' | '定局' | '值符定位' | '值使定位' | '四柱背景' | '固定干支条件';
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
  category:
    | '定局规则'
    | '值符值使规则'
    | '九宫排布规则'
    | '五行关系规则'
    | '经典格局审核边界'
    | '组合规则版本'
    | '专项情境规则边界'
    | '方位取用边界';
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
  limitation: '位置限制事实只表示当前宫是否逢旬空等可复算条件；不得把单项位置限制直接写成现实失败、灾祸、人物恶意或必然结果';
}

export interface QimenCounterSummaryFact {
  key: 'qimen:counter-summary';
  status: '有位置限制' | '未见位置限制';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '位置限制汇总只说明九宫是否命中旬空等可复算条件；未见位置限制不代表现实风险为零，也不得按限制数量换算吉凶分或成功率';
}

export interface QimenTimingFact {
  key: string;
  type: '期限边界';
  sourceStatus: '统一边界';
  rhythm: null;
  promptText: string;
  sources: string[];
  limitation: '通用盘只保留推算应期所需的原始位置事实；未按问题选定用神并取得目标期限前，不生成相对节奏、触发事件、固定天数或绝对日期';
}

export interface QimenTimingSummaryFact {
  key: 'qimen:timing-summary';
  status: '仅有期限边界';
  rhythm: null;
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只声明当前缺少具体问题用神与目标期限；不得把位置索引、空亡、马星、伏吟反吟、宫数或局数直接换算为快慢、固定天数、绝对日期或事件概率';
}

export interface QimenDirectionBoundaryFact {
  key: 'qimen:direction-boundary';
  status: '仅保留九宫方向';
  promptText: string;
  sources: string[];
  limitation: '方位取用边界只声明通用入口未生成取用结论；九宫原始方向不等于吉方、避方或现实路线建议';
}

export interface QimenSummaryFact {
  key: 'qimen:evidence-summary';
  status: '盘面资料完整' | '部分盘面资料缺失' | '无额外位置索引';
  factKeys: string[];
  calculationFactCount: number;
  ruleSourceCount: number;
  palaceFactCount: number;
  positionIndexCount: number;
  palaceRelationCount: number;
  patternCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '奇门证据汇总只统计排盘、九宫、位置索引、格局、位置限制、应期前提与方位边界的资料覆盖情况；不得按数量生成吉凶总分、成功率、人物意图、方位保证或唯一日期';
}

export interface QimenLimitationFact {
  key: string;
  type:
    | '排盘与规则边界'
    | '九宫资料边界'
    | '用神待选边界'
    | '格局与位置限制边界'
    | '应期边界'
    | '方位与高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束奇门排盘、位置索引、格局、应期与方位资料能够支持的解释范围，不得被反向当作现实吉凶、人物意图、事件概率、方位保证或固定应期的证据';
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
  positionIndexes: QimenPalaceIndexFact[];
  palaceRelations: QimenPalaceRelationEvidence[];
  patternFacts: QimenPatternEvidenceFact[];
  counterEvidenceFacts: QimenCounterEvidenceFact[];
  counterSummaryFact: QimenCounterSummaryFact;
  counterEvidence: string[];
  timingFacts: QimenTimingFact[];
  timingSummaryFact: QimenTimingSummaryFact;
  timingConditions: string[];
  directionBoundaryFact: QimenDirectionBoundaryFact;
  summaryFact: QimenSummaryFact;
  limitations: string[];
  limitationFacts: QimenLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const PALACE_FACT_LIMITATION =
  '逐宫字段是奇门九宫门、星、神、天地盘干、空亡、马星与规则命中的计算事实，只提供可复核位置与结构，不单独证明现实吉凶、事件结果、人物意图、方位安全或固定应期' as const;
const CALCULATION_FACT_LIMITATION =
  '定局与定位字段只证明排盘范围、主动干支、节气三元、阴阳遁局数和值符值使如何形成当前盘面，不证明现实吉凶、事件结果、人物意图、方位安全或固定应期' as const;
const RULE_SOURCE_LIMITATION =
  '规则来源只标明当前结构化字段采用的传统模型与计算路径，不等于现代实证验证、现实因果关系、吉凶保证或结果概率' as const;
const RELATION_FACT_LIMITATION =
  '宫间关系穷举当前九宫全部无序宫对，只按宫位五行陈述比和、生、克或待核验状态；不证明现实中的支持、阻碍、人物关系、方位吉凶、事件结果或成功概率' as const;
const COUNTER_FACT_LIMITATION =
  '位置限制事实只表示当前宫是否逢旬空等可复算条件；不得把单项位置限制直接写成现实失败、灾祸、人物恶意或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '位置限制汇总只说明九宫是否命中旬空等可复算条件；未见位置限制不代表现实风险为零，也不得按限制数量换算吉凶分或成功率' as const;
const TIMING_FACT_LIMITATION =
  '通用盘只保留推算应期所需的原始位置事实；未按问题选定用神并取得目标期限前，不生成相对节奏、触发事件、固定天数或绝对日期' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只声明当前缺少具体问题用神与目标期限；不得把位置索引、空亡、马星、伏吟反吟、宫数或局数直接换算为快慢、固定天数、绝对日期或事件概率' as const;
const DIRECTION_SUMMARY_LIMITATION =
  '方位取用边界只声明通用入口未生成取用结论；九宫原始方向不等于吉方、避方或现实路线建议' as const;
const STEM_RELATION_FACT_LIMITATION =
  '天地盘干关系只记录当前宫天盘干与地盘干的生克、标准天干五合、墓、刑，或十一项已校勘固定格；其余七十项组合不作为传统格局，不单独证明现实吉凶、人物关系、事件结果或固定应期' as const;
const PALACE_COVERAGE_FACT_LIMITATION =
  '九宫覆盖状态只说明当前结果能否完整核验一至九宫；缺少、重复或越界宫位时不得反推门、星、神、天地盘干、空亡、马星或格局' as const;
const SUMMARY_FACT_LIMITATION =
  '奇门证据汇总只统计排盘、九宫、位置索引、格局、位置限制、应期前提与方位边界的资料覆盖情况；不得按数量生成吉凶总分、成功率、人物意图、方位保证或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束奇门排盘、位置索引、格局、应期与方位资料能够支持的解释范围，不得被反向当作现实吉凶、人物意图、事件概率、方位保证或固定应期的证据' as const;

export function conditionQimenTraditionalText(text: string): string {
  return text
    .replace(/凶期百日而后或有舒情/g, '古籍另有具体日数说法，但不得据此输出固定日期')
    .replace(/百事吉昌/g, '传统象意偏向有利')
    .replace(/百事称心/g, '传统象意偏向顺遂')
    .replace(/百事顺遂/g, '传统象意偏向顺遂')
    .replace(/百事可为/g, '传统象意提示可具备推进条件')
    .replace(/凡百遂心/g, '传统象意偏向顺遂')
    .replace(/万事破伤/g, '传统象意提示多重阻碍')
    .replace(/万事皆屯/g, '传统象意提示事务易有停滞')
    .replace(/谋为成功/g, '谋事较有推进条件')
    .replace(/事成/g, '事情较有推进条件')
    .replace(/必然会/g, '可能会')
    .replace(/必然/g, '往往')
    .replace(/必定/g, '较可能')
    .replace(/大吉/g, '传统有利分类')
    .replace(/大凶/g, '传统风险分类')
    .replace(/(^|[，；。])主(?!(?:动|客|轴|证|判|要))/g, '$1传统象意提示')
    .replace(/古法主(?!(?:动|客))/g, '古法象意提示');
}

function buildPatternFacts(data: QimenData): QimenPatternEvidenceFact[] {
  const limitation =
    '传统格局命中只证明盘面满足当前列明规则，不是现实结果、吉凶分或事件概率' as const;
  const basicFacts = buildPatternDetails(data.patternTags ?? []).map((item, index) => ({
    key: `basic:${index}:${item.tag}`,
    status: '已命中' as const,
    name: item.tag,
    kind: '基础格局' as const,
    traditionalTone: '中性' as const,
    originalText: item.summary,
    promptText: conditionQimenTraditionalText(item.summary),
    palaces: [],
    sources: ['奇门基础格局标签与当前盘面规则命中记录'],
    limitation,
  }));
  const classicFacts = getClassicPatterns({
    jiuGongGe: data.jiuGongGe,
    zhiFu: data.zhiFu,
    zhiShi: data.zhiShi,
    yearGanZhi: data.ganzhi.year,
    monthGanZhi: data.ganzhi.month,
    dayStem: data.ganzhi.day.charAt(0),
    dayGanZhi: data.ganzhi.day,
    hourGanZhi: data.ganzhi.hour,
  }).map((item, index) => {
    const palaceName = data.jiuGongGe.find((palace) => palace.gong === item.palace)?.name;
    const [heavenStem, earthStem] = item.tokens ?? [];
    const fixedCondition =
      heavenStem && earthStem
        ? `天盘${heavenStem}加地盘${earthStem}${palaceName ? `于${palaceName}` : ''}`
        : `${palaceName || '当前宫'}天地盘干命中固定条件`;
    const traditionalTone =
      item.tone === 'good'
        ? ('有利' as const)
        : item.tone === 'bad'
          ? ('风险' as const)
          : ('中性' as const);
    return {
      key: `classic:${index}:${item.name}:${item.palace ?? ''}`,
      status: '已命中' as const,
      name: item.name,
      kind: '经典格局' as const,
      traditionalTone,
      originalText: item.summary,
      promptText: `${fixedCondition}，命中《遁甲演义》已校勘固定格“${item.name}”；原典分类为${traditionalTone}，这里只记录名称、条件与原典分类`,
      palaces: item.palace ? [item.palace] : [],
      sources: ['《遁甲演义》卷一、卷二十一项固定格', '当前宫天地盘干命中记录'],
      limitation,
    };
  });
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
          : ('中性' as const),
    originalText: item.summary,
    promptText: conditionQimenTraditionalText(item.summary),
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
      meaning: `${from.name}与${to.name}同属${from.element}`,
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

function getHorseBranch(sourceBranch: string): string {
  if (['申', '子', '辰'].includes(sourceBranch)) return '寅';
  if (['寅', '午', '戌'].includes(sourceBranch)) return '申';
  if (['亥', '卯', '未'].includes(sourceBranch)) return '巳';
  if (['巳', '酉', '丑'].includes(sourceBranch)) return '亥';
  return '';
}

function rebuildSpecialConditions(
  data: QimenData,
  activeGanZhi: string,
): Exclude<QimenData['specialConditions'], undefined> {
  if ((data.scope ?? 'hour') === 'hour') {
    return checkSpecialHourConditions(activeGanZhi, data.ganzhi.day);
  }

  const conditions = {
    isLiuJiaHour: false,
    isLiuGuiHour: false,
    isShiGanRuMu: false,
    isWuBuYuShi: false,
    description: '',
  };
  if (data.scope === 'day') {
    const dayStem = data.ganzhi.day.charAt(0);
    const dayBranch = data.ganzhi.day.charAt(1);
    const tomb = STEM_TOMB_MAP[dayStem];
    if (tomb?.branch === dayBranch) {
      conditions.isShiGanRuMu = true;
      conditions.description = `日干${dayStem}入墓（${dayStem}入${tomb.palace}宫/${tomb.branch}支）；`;
    }
  }
  return conditions;
}

/**
 * 证据层只信任可由原始九宫、干支和值符值使重新计算的字段。
 * 旧缓存或外部输入中的格局摘要、宫位评级、方位、应期与现实断语均不得旁路恢复。
 */
export function rebuildAuditedQimenData(input: QimenData): QimenData {
  const {
    evidenceAnalysis: _legacyEvidenceAnalysis,
    patternTags: _legacyPatternTags,
    patternDetails: _legacyPatternDetails,
    palaceInsights: _legacyPalaceInsights,
    voidBranches: _legacyVoidBranches,
    voidPalaces: _legacyVoidPalaces,
    horseStar: _legacyHorseStar,
    specialConditions: _legacySpecialConditions,
    seasonality: _legacySeasonality,
    classicPatterns: _legacyClassicPatterns,
    stemRelations: _legacyStemRelations,
    patternCombos: _legacyPatternCombos,
    ...baseInput
  } = input as QimenData & {
    directions?: unknown;
    yingQi?: unknown;
    palaceInsights?: unknown;
  };
  delete (baseInput as { directions?: unknown }).directions;
  delete (baseInput as { yingQi?: unknown }).yingQi;
  const activeGanZhi = getActiveGanZhi(input);
  const zhiFuPalace = input.jiuGongGe.find((palace) => hasTianPanStar(palace, input.zhiFu));
  const zhiShiPalace = input.jiuGongGe.find((palace) => palace.renPan.door === input.zhiShi);
  const voidBranches = getVoidBranches(activeGanZhi) ?? [];
  const voidPalaces = voidBranches.flatMap((branch) => {
    const palace = diPanPalaces[branch];
    if (!palace) return [];
    return [
      {
        branch,
        palace,
        name: input.jiuGongGe.find((item) => item.gong === palace)?.name ?? `${palace}宫`,
      },
    ];
  });
  const sourceBranch = activeGanZhi.charAt(1);
  const horseBranch = getHorseBranch(sourceBranch);
  const horsePalaceNumber = horseBranch ? diPanPalaces[horseBranch] : undefined;
  const horsePalace =
    horsePalaceNumber === undefined
      ? undefined
      : {
          sourceBranch,
          branch: horseBranch,
          palace: horsePalaceNumber,
          name:
            input.jiuGongGe.find((item) => item.gong === horsePalaceNumber)?.name ??
            `${horsePalaceNumber}宫`,
        };
  const patternTags =
    zhiFuPalace && zhiShiPalace
      ? getQimenPatternTags({
          zhiFu: input.zhiFu,
          zhiShi: input.zhiShi,
          zhiFuLandingPalace: zhiFuPalace.gong,
          zhiShiLandingPalace: zhiShiPalace.gong,
          jiuGongGe: input.jiuGongGe,
          hourGanForFind: getDunJiaStem(activeGanZhi),
          horsePalace: horsePalace?.palace,
          horsePalaceName: horsePalace?.name,
        })
      : [];
  const stemRelations = getStemRelations(input.jiuGongGe).map((item) => ({
    gong: item.palace,
    heavenStem: item.heaven,
    earthStem: item.earth,
    relation: item.type,
    pattern: item.note,
  }));
  const patternCombos = detectQimenPatternCombos({
    monthBranch: input.ganzhi.month.charAt(1),
    jiuGongGe: input.jiuGongGe,
  });
  const wallClock = TimeManager.getWallClockParts(new Date(input.timestamp));
  const seasonalityDate = new Date(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
  );
  const seasonality = buildSeasonality(input.ganzhi, input.timeInfo.solarTerm, seasonalityDate);
  const classicPatterns = getClassicPatterns({
    jiuGongGe: input.jiuGongGe,
    zhiFu: input.zhiFu,
    zhiShi: input.zhiShi,
    yearGanZhi: input.ganzhi.year,
    monthGanZhi: input.ganzhi.month,
    dayStem: input.ganzhi.day.charAt(0),
    dayGanZhi: input.ganzhi.day,
    hourGanZhi: input.ganzhi.hour,
  }).map((item) => ({
    name: item.name,
    type: item.tone,
    summary: item.summary,
    palaces: item.palace ? [item.palace] : [],
  }));

  return {
    ...baseInput,
    patternTags,
    patternDetails: buildPatternDetails(patternTags),
    voidBranches,
    voidPalaces,
    horseStar: horsePalace,
    specialConditions: rebuildSpecialConditions(input, activeGanZhi),
    seasonality,
    classicPatterns,
    stemRelations,
    patternCombos,
  };
}

function collectPalaceIndexSources(data: QimenData, patternFacts: QimenPatternEvidenceFact[]) {
  const sourceMap = new Map<number, QimenPalaceIndexSource[]>();
  const add = (gong: number | undefined, source: QimenPalaceIndexSource) => {
    if (gong === undefined) return;
    sourceMap.set(
      gong,
      unique([...(sourceMap.get(gong) ?? []), source]) as QimenPalaceIndexSource[],
    );
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
  patternFacts
    .filter((item) => item.kind === '经典格局')
    .forEach((item) => item.palaces.forEach((gong) => add(gong, '经典格局')));
  return sourceMap;
}

const RETIRED_QIMEN_PATTERN_TEXT =
  /九遁|天遁|地遁|人遁|神遁|鬼遁|龙遁|虎遁|风遁|云遁|三奇得|三奇游六仪|三诈|真诈|重诈|休诈|天假|地假|人假|物假|鬼假|神假|升殿|奇入墓|奇受制|三奇会甲|符使同宫|相佐|守户|天乙飞宫|天乙伏宫|伏干格|飞干格|岁格|月格|时格|勃格|格勃|地罗遮蔽|天辅时|五合时|玉女守门|天网四张|地网四张|伏干飞干|伏宫飞宫/;

function getSafeStemRelationPattern(item: { relation: string; pattern?: string }): string | null {
  const pattern = item.pattern?.trim();
  if (
    !pattern ||
    RETIRED_QIMEN_PATTERN_TEXT.test(pattern) ||
    pattern.startsWith('门生宫') ||
    pattern.startsWith('宫生门')
  )
    return null;
  if (item.relation !== '命名格局') return pattern;
  return AUDITED_QIMEN_CLASSIC_PATTERN_NAMES.some((name) => pattern.startsWith(`${name}：`))
    ? pattern
    : null;
}

function buildPalaceIndexFact(
  data: QimenData,
  palace: QimenJiuGongGe,
  indexSources: QimenPalaceIndexSource[],
  patternFacts: QimenPatternEvidenceFact[],
): QimenPalaceIndexFact {
  const isVoid = Boolean(data.voidPalaces?.some((item) => item.palace === palace.gong));
  const hasHorse = data.horseStar?.palace === palace.gong;
  const patterns = unique(
    patternFacts
      .filter((item) => item.palaces.includes(palace.gong))
      .map((item) => `${item.name}：${item.promptText}`),
  );
  const stemRelations = unique(
    (data.stemRelations ?? [])
      .filter((item) => item.gong === palace.gong)
      .map((item) => {
        const pattern = getSafeStemRelationPattern(item);
        return `${item.heavenStem}临${item.earthStem}为${item.relation}${pattern ? `，见${pattern}` : ''}`;
      }),
  );
  const constraints = unique([isVoid ? '宫位逢空（旬空位置事实）' : '']);
  return {
    gong: palace.gong,
    palaceFactKey: `九宫:${palace.gong}:${palace.name}`,
    name: palace.name,
    direction: palace.direction,
    element: palace.element,
    indexSources,
    palace,
    patterns,
    stemRelations,
    constraints,
    isVoid,
    hasHorse,
  };
}

function buildPalaceFact(
  data: QimenData,
  palace: QimenJiuGongGe,
  indexSources: QimenPalaceIndexSource[],
  patternFacts: QimenPatternEvidenceFact[],
): QimenPalaceFact {
  const evidence = buildPalaceIndexFact(data, palace, indexSources, patternFacts);
  const palaceFactKey = `九宫:${palace.gong}:${palace.name}`;
  const globalSpecialCondition = data.specialConditions?.description
    ? conditionQimenTraditionalText(data.specialConditions.description)
    : '';
  const voidBranches = unique(
    (data.voidPalaces ?? [])
      .filter((item) => item.palace === palace.gong)
      .map((item) => item.branch),
  );
  const stemRelationFacts: QimenStemRelationFact[] = (data.stemRelations ?? [])
    .filter((item) => item.gong === palace.gong)
    .map((item, index) => {
      const pattern = getSafeStemRelationPattern(item);
      return {
        key: `qimen:stem-relation:${palace.gong}:${index + 1}`,
        ownerPalaceFactKey: palaceFactKey,
        gong: palace.gong,
        heavenStem: item.heavenStem,
        earthStem: item.earthStem,
        relation: item.relation,
        pattern,
        status: '已计算' as const,
        promptText: `${item.heavenStem}临${item.earthStem}为${item.relation}${pattern ? `，见${pattern}` : ''}`,
        sources:
          item.relation === '命名格局' && pattern
            ? [
                '当前宫天盘干与地盘干',
                '《遁甲演义》卷一：https://zh.wikisource.org/wiki/遁甲演義_(四庫全書本)/卷1',
                '《遁甲演义》卷二：https://zh.wikisource.org/wiki/遁甲演義_(四庫全書本)/卷2',
              ]
            : ['当前宫天盘干与地盘干', 'mingyu-core 公共天干五行、天干五合与统一墓刑入口'],
        limitation: STEM_RELATION_FACT_LIMITATION,
      };
    });
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
    indexSources.length ? `位置索引来源${indexSources.join('、')}` : '无额外位置索引',
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
    indexSources,
    isVoid: evidence.isVoid,
    voidBranches,
    hasHorse: evidence.hasHorse,
    horseSourceBranch: evidence.hasHorse ? data.horseStar?.sourceBranch : undefined,
    patterns: evidence.patterns,
    patternFactKeys,
    stemRelations: evidence.stemRelations,
    stemRelationFacts,
    constraints: evidence.constraints.filter((item) => item !== globalSpecialCondition),
    promptText,
    sources: [
      '奇门遁局九宫门、星、神与天地盘干排布',
      '当前旬空落宫、驿马落宫与天地盘干关系计算',
      '基础格局、经典格局与已校勘组合规则命中',
    ],
    limitation: PALACE_FACT_LIMITATION,
  };
}

function buildSummaryFact(params: {
  calculationEvidenceFacts: QimenCalculationEvidenceFact[];
  ruleSourceFacts: QimenRuleSourceFact[];
  palaceCoverageFact: QimenPalaceCoverageFact;
  palaceFacts: QimenPalaceFact[];
  positionIndexes: QimenPalaceIndexFact[];
  palaceRelations: QimenPalaceRelationEvidence[];
  patternFacts: QimenPatternEvidenceFact[];
  counterEvidenceFacts: QimenCounterEvidenceFact[];
  counterSummaryFact: QimenCounterSummaryFact;
  timingFacts: QimenTimingFact[];
  timingSummaryFact: QimenTimingSummaryFact;
  directionBoundaryFact: QimenDirectionBoundaryFact;
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
      ]),
      ...params.palaceRelations.map((item) => item.key),
      ...params.patternFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      params.timingSummaryFact.key,
      ...params.timingFacts.map((item) => item.key),
      params.directionBoundaryFact.key,
    ]),
  );
  const status =
    params.palaceCoverageFact.status !== '完整' ||
    params.calculationEvidenceFacts.some((item) => item.status === '落宫缺失')
      ? '部分盘面资料缺失'
      : params.positionIndexes.length
        ? '盘面资料完整'
        : '无额外位置索引';
  return {
    key: 'qimen:evidence-summary',
    status,
    factKeys,
    calculationFactCount: params.calculationEvidenceFacts.length,
    ruleSourceCount: params.ruleSourceFacts.length,
    palaceFactCount: params.palaceFacts.length,
    positionIndexCount: params.positionIndexes.length,
    palaceRelationCount: params.palaceRelations.length,
    patternCount: params.patternFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    promptText: `资料状态${status}：排盘事实${params.calculationEvidenceFacts.length}项、规则来源${params.ruleSourceFacts.length}项、九宫事实${params.palaceFacts.length}项、位置索引${params.positionIndexes.length}项、九宫无序宫对关系${params.palaceRelations.length}项、格局${params.patternFacts.length}项、位置限制${params.counterEvidenceFacts.length}项、应期边界${params.timingFacts.length}项；通用入口未生成方位取用结论`,
    sources: ['全部排盘、规则、九宫、位置索引、格局、位置限制、应期前提与方位边界逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildLimitationFacts(params: {
  calculationEvidenceFacts: QimenCalculationEvidenceFact[];
  ruleSourceFacts: QimenRuleSourceFact[];
  palaceCoverageFact: QimenPalaceCoverageFact;
  palaceFacts: QimenPalaceFact[];
  positionIndexes: QimenPalaceIndexFact[];
  palaceRelations: QimenPalaceRelationEvidence[];
  patternFacts: QimenPatternEvidenceFact[];
  counterEvidenceFacts: QimenCounterEvidenceFact[];
  counterSummaryFact: QimenCounterSummaryFact;
  timingFacts: QimenTimingFact[];
  timingSummaryFact: QimenTimingSummaryFact;
  directionBoundaryFact: QimenDirectionBoundaryFact;
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
        ]),
      ],
      promptText:
        '九宫事实只记录门、星、神、天地盘干、空亡、马星和规则命中；宫位缺失、重复或越界时不得补造内容，资料完整也不直接证明现实吉凶',
      sources: ['九宫覆盖核验与逐宫门星神干事实'],
    },
    {
      key: 'qimen:limitation:position-indexes',
      type: '用神待选边界',
      ownerFactKeys: Array.from(
        new Set([
          ...params.positionIndexes.map((item) => item.palaceFactKey),
          ...params.palaceRelations.map((item) => item.key),
        ]),
      ),
      promptText:
        '以上宫位只用于索引值符、值使、日干、时干与已校勘格局所在位置，不等于已经按具体问题选定用神；不得把索引顺序或宫间五行关系写成现实主次、支持阻碍或人物意图',
      sources: ['位置索引来源与九宫宫对五行关系'],
    },
    {
      key: 'qimen:limitation:patterns-counters',
      type: '格局与位置限制边界',
      ownerFactKeys: [
        ...params.patternFacts.map((item) => item.key),
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
      ],
      promptText:
        '传统格局只证明固定条件命中，旬空等位置限制只证明所在宫位满足相应计算条件；不得把原典分类或单项位置条件写成现实成功、失败、灾祸、人物恶意或必然结果。缺少专项情境或版本冲突的兵事、主客、迷路、下营与战略择方规则不得从原始盘面自行补算',
      sources: [
        '基础格局、经典格局、已校勘组合规则与九宫位置限制逐项核验',
        '专项情境规则失败关闭边界',
      ],
    },
    {
      key: 'qimen:limitation:timing',
      type: '应期边界',
      ownerFactKeys: [params.timingSummaryFact.key, ...params.timingFacts.map((item) => item.key)],
      promptText:
        '当前只保留旬空、马星、伏吟反吟等原始位置事实；未按具体问题选定用神并取得目标期限前，不生成应期快慢、触发事件、唯一日期、固定天数或事件概率',
      sources: ['具体问题用神与目标期限缺失边界'],
    },
    {
      key: 'qimen:limitation:direction-risk',
      type: '方位与高风险输出边界',
      ownerFactKeys: [params.summaryFact.key, params.directionBoundaryFact.key],
      promptText:
        '九宫方向只表示固定空间方位，不等于吉方、避方或现实路线建议；必须由后续解读先按具体问题选定用神并结合现实安全、权限与天气，不得输出吉凶总分、成功率、医疗法律财务定论或保证有效建议',
      sources: ['九宫固定方向与现实安全、高风险输出约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeQimenEvidence(input: QimenData): QimenEvidenceAnalysis {
  if (!input.jiuGongGe.length) {
    throw new Error('奇门证据分析至少需要一个宫位数据。');
  }
  const data = rebuildAuditedQimenData(input);
  const patternFacts = buildPatternFacts(data);
  const indexSourceMap = collectPalaceIndexSources(data, patternFacts);
  const palaceFacts = [...data.jiuGongGe]
    .sort((left, right) => left.gong - right.gong)
    .map((palace) =>
      buildPalaceFact(data, palace, indexSourceMap.get(palace.gong) ?? [], patternFacts),
    );
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
      rule: '三奇六仪九乘九共八十一种组合全部保留结构事实；只启用《遁甲演义》逐条闭环的十一项固定格，其余七十项不作为传统格局',
      appliesTo: ['天地盘干关系', '经典格局', '九宫位置索引'],
      sources: [
        'mingyu-core 公共天干五行与天干五合入口',
        '《遁甲演义》卷一：https://zh.wikisource.org/wiki/遁甲演義_(四庫全書本)/卷1',
        '《遁甲演义》卷二：https://zh.wikisource.org/wiki/遁甲演義_(四庫全書本)/卷2',
      ],
      promptText:
        '天地盘干规则：八十一种组合完整保留天干、五行生克与标准五合结构；仅青龙返首、飞鸟跌穴、青龙逃走、白虎猖狂、朱雀投江、螣蛇跃蹻、荧入太白、太白入荧、大格、刑格、小格十一项按已校勘固定格输出，其余七十项不得补造传统名称或现实断语',
      limitation: RULE_SOURCE_LIMITATION,
    },
    {
      key: 'rule:qimen:classic-pattern-audit-boundary',
      status: '已声明',
      category: '经典格局审核边界',
      rule: '正式入口只输出已逐条校勘的十一项天地盘固定格；九遁、三奇、三诈五假、符使、岁月日时格及其他旧格局在版本、条件和适用情境闭环前失败关闭',
      appliesTo: ['经典格局', '基础位置标签', '提示词推算边界'],
      sources: [
        '《遁甲演义》卷一、卷二十一项固定天地盘干格逐条校勘结果',
        '当前九宫门、星、神、天地盘干、空亡、马星与五行关系原始事实',
      ],
      promptText:
        '经典格局审核边界：当前只把青龙返首、飞鸟跌穴、青龙逃走、白虎猖狂、朱雀投江、螣蛇跃蹻、荧入太白、太白入荧、大格、刑格、小格十一项视为已校勘命中。九遁、三奇得使、三奇游六仪、三诈五假、三奇升殿/入墓/受制/会甲、符使同宫、相佐守户、天乙飞伏宫、岁月日时格、天辅时、玉女守门、门宫相生等旧规则尚未完成统一版本、完整条件与通用适用边界审核，不得从原始盘面自动补算为既定格局或现实结论',
      limitation: RULE_SOURCE_LIMITATION,
    },
    {
      key: 'rule:qimen:retained-combo-versions',
      status: '已声明',
      category: '组合规则版本',
      rule: '八门余气固定采用《奇门遁甲统宗》五态月令版，十干迫制采用同书固定表；两者只输出状态或受克结构事实',
      appliesTo: ['八门余气', '十干迫制', '已校勘组合'],
      sources: [
        '《奇门遁甲统宗》卷十二“当时者为旺，我生者为相，我克者为休，克我者为囚，生我者为废”',
        '《奇门遁甲统宗》卷十二“甲乙金宫、丙丁坎内、戊己惧杜伤、庚辛离上、壬癸生死方”',
        '《奇门宝鉴御定》八门气应另有逐节旺、绝、胎、没、死、囚、休、废八态版，当前不混用',
      ],
      promptText:
        '已校勘组合版本：八门余气只用《奇门遁甲统宗》五态月令版，不混用《奇门宝鉴御定》逐节八态版；十干迫制只按《奇门遁甲统宗》固定表记录奇仪落宫受克。两者不自动延伸兵事、年命、疾病或通用吉凶',
      limitation: RULE_SOURCE_LIMITATION,
    },
    {
      key: 'rule:qimen:special-context-boundary',
      status: '已声明',
      category: '专项情境规则边界',
      rule: '通用入口缺少出军交战、主客攻守、劫营下营、突围避寇与三岔迷路等必要情境，不自动输出相关兵事、择方、迷路或下营规则；刑德开阖主客版本冲突时同样失败关闭',
      appliesTo: ['经典格局附加断语', '战略方位规则', '主客兵事规则', '迷路与下营规则'],
      sources: [
        '《奇门遁甲统宗》卷三“兵事分主客：宫为主，星门为客”及“一克一生主客互伤”',
        '《奇门旨归》卷三十六“奇门兵事”及卷三十七迷路、突围、避寇专项',
        '《奇门遁甲秘笈大全》迷路法与“初兵出天门”兵事条文',
        '《奇门法窍》刑德开阖将兵条文：开为主、阖为客',
        '《奇门宝鉴御定》刑德开阖将兵条文：阖为主、开为客',
      ],
      promptText:
        '专项规则边界：当前盘只提供九宫、奇仪、星门神等原始事实；出军交战、主客攻守、劫营下营、突围避寇、三岔迷路及相关战略择方规则未取得所需专项情境，不得自动生成；刑德开阖主客版本相反，版本冲突时不选定任一口径',
      limitation: RULE_SOURCE_LIMITATION,
    },
    {
      key: 'rule:qimen:direction-boundary',
      status: '已声明',
      category: '方位取用边界',
      rule: '通用排盘只提供九宫方向和门星神干等原始事实，不依据门、神、空亡或格局自动生成吉方、避方和现代事项用途',
      appliesTo: ['九宫方向事实', '具体问题取用', '现实路线与安全条件'],
      sources: [
        '当前九宫方向、门、星、神、天地盘干与空亡原始数据',
        '具体事项用神、出行路线与现实安全条件需由后续问题上下文提供',
      ],
      promptText:
        '方位取用边界：不得仅凭开休生门、伤死惊门、八神、空亡或格局，把某宫自动写成求职、投资、合作吉方或宜避之方。先保留九宫方向事实，再按具体问题选定用神并核对现实路线、安全和时空条件；条件不足时明确不下方位结论',
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
    {
      key: 'qimen:calculation:fixed-ganzhi-conditions',
      stage: '固定干支条件',
      status: '已确定',
      inputs: { activeGanZhi, dayGanZhi: data.ganzhi.day },
      result: {
        isLiuJiaHour: data.specialConditions?.isLiuJiaHour ?? false,
        isLiuGuiHour: data.specialConditions?.isLiuGuiHour ?? false,
        isShiGanRuMu: data.specialConditions?.isShiGanRuMu ?? false,
        isWuBuYuShi: data.specialConditions?.isWuBuYuShi ?? false,
      },
      promptText: `固定干支条件：${data.specialConditions?.description || '未命中六甲、六癸、已登记入墓或五不遇条件'}这里只记录干支与固定表命中，不据此生成现实结果或行动建议`,
      sourceKeys: ['rule:qimen:setup', 'rule:qimen:classic-pattern-audit-boundary'],
      limitation: CALCULATION_FACT_LIMITATION,
    },
  ];
  const calculationFacts = unique(calculationEvidenceFacts.map((item) => item.promptText));
  const ruleSources = unique(ruleSourceFacts.map((item) => item.promptText));
  const sourcePriority: QimenPalaceIndexSource[] = [
    '值符落宫',
    '值使落宫',
    '日干落宫',
    '时干落宫',
    '经典格局',
  ];
  const positionIndexes = Array.from(indexSourceMap.entries())
    .map(([gong, indexSources]) => {
      const palace = data.jiuGongGe.find((item) => item.gong === gong);
      return palace ? buildPalaceIndexFact(data, palace, indexSources, patternFacts) : null;
    })
    .filter((item): item is QimenPalaceIndexFact => Boolean(item))
    .sort((left, right) => {
      const leftPriority = Math.min(
        ...left.indexSources.map((item) => sourcePriority.indexOf(item)),
      );
      const rightPriority = Math.min(
        ...right.indexSources.map((item) => sourcePriority.indexOf(item)),
      );
      return leftPriority - rightPriority || left.gong - right.gong;
    });
  const sortedPalaces = [...data.jiuGongGe].sort((left, right) => left.gong - right.gong);
  const palaceRelations: QimenPalaceRelationEvidence[] =
    palaceCoverageFact.status === '完整'
      ? sortedPalaces.flatMap((fromPalace, fromIndex) =>
          sortedPalaces.slice(fromIndex + 1).map((toPalace) => {
            const relation = describeRelation(fromPalace, toPalace);
            return {
              key: `qimen:relation:${fromPalace.gong}:${toPalace.gong}`,
              fromPalaceFactKey: `九宫:${fromPalace.gong}:${fromPalace.name}`,
              toPalaceFactKey: `九宫:${toPalace.gong}:${toPalace.name}`,
              fromGong: fromPalace.gong,
              toGong: toPalace.gong,
              from: fromPalace.name,
              to: toPalace.name,
              ...relation,
              promptText: `${fromPalace.name}与${toPalace.name}为${relation.relation}；${relation.meaning}`,
              sources: ['九宫宫位五行字段', '五行比和、生、克公共关系'],
              limitation: RELATION_FACT_LIMITATION,
            };
          }),
        )
      : [];
  const counterEvidenceFacts: QimenCounterEvidenceFact[] = palaceFacts.flatMap((item) =>
    item.constraints.map((detail, index) => ({
      key: `qimen:counter:${item.gong}:${index + 1}`,
      ownerPalaceFactKey: item.key,
      gong: item.gong,
      palaceName: item.name,
      status: '已触发' as const,
      detail,
      promptText: `${item.name}位置限制：${detail}`,
      sources: ['对应九宫逐宫事实', '旬空位置条件核验'],
      limitation: COUNTER_FACT_LIMITATION,
    })),
  );
  const counterEvidence = unique(counterEvidenceFacts.map((item) => item.detail));
  const counterSummaryFact: QimenCounterSummaryFact = {
    key: 'qimen:counter-summary',
    status: counterEvidenceFacts.length ? '有位置限制' : '未见位置限制',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `当前${counterEvidenceFacts.length}项九宫旬空位置限制已逐项记录`
      : '当前九宫未见旬空位置限制；这不构成现实吉凶判断',
    sources: ['九宫 constraints 字段逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const timingFacts: QimenTimingFact[] = [
    {
      key: 'qimen:timing:deadline-boundary',
      type: '期限边界',
      sourceStatus: '统一边界',
      rhythm: null,
      promptText:
        '当前通用盘未按具体问题选定用神，也未取得目标期限；只保留旬空、马星、伏吟反吟等原始位置事实，不自动生成应期快慢、触发事件或唯一日期',
      sources: ['用神、目标期限与现实事件未由通用排盘提供'],
      limitation: TIMING_FACT_LIMITATION,
    },
  ];
  const timingConditions = timingFacts.map((item) => item.promptText);
  const timingSummaryFact: QimenTimingSummaryFact = {
    key: 'qimen:timing-summary',
    status: '仅有期限边界',
    rhythm: null,
    factKeys: timingFacts.map((item) => item.key),
    promptText: '应期状态：待按具体问题选定用神并取得目标期限；当前不生成快慢或日期结论',
    sources: ['通用排盘的用神与期限资料边界'],
    limitation: TIMING_SUMMARY_LIMITATION,
  };
  const directionBoundaryFact: QimenDirectionBoundaryFact = {
    key: 'qimen:direction-boundary',
    status: '仅保留九宫方向',
    promptText: '方位状态：通用入口不生成吉方、避方或候选方向；九宫方向只在逐宫事实中保留',
    sources: ['九宫固定方向字段与方位取用边界'],
    limitation: DIRECTION_SUMMARY_LIMITATION,
  };
  const summaryFact = buildSummaryFact({
    calculationEvidenceFacts,
    ruleSourceFacts,
    palaceCoverageFact,
    palaceFacts,
    positionIndexes,
    palaceRelations,
    patternFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    directionBoundaryFact,
  });
  const limitationFacts = buildLimitationFacts({
    calculationEvidenceFacts,
    ruleSourceFacts,
    palaceCoverageFact,
    palaceFacts,
    positionIndexes,
    palaceRelations,
    patternFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    directionBoundaryFact,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const patternItems: PromptEvidenceItem[] = patternFacts.map((pattern): PromptEvidenceItem => {
    const displayKind = pattern.kind === '复合格局' ? '已校勘组合规则' : pattern.kind;
    return {
      level: '辅证',
      title: `${displayKind}：${pattern.name}`,
      detail: `${pattern.promptText}；传统分类：${pattern.traditionalTone}；命中宫位：${pattern.palaces.join('、') || '跨宫或全局'}；组成来源：${pattern.sources.join('、') || '未列明'}；边界：${pattern.limitation}`,
      source: `${displayKind}命中链；原始传统文字另行保留，当前提示词只使用条件化文本`,
      tags: [
        displayKind,
        pattern.traditionalTone,
        ...pattern.palaces.map((palace) => `${palace}宫`),
      ],
    };
  });
  const relationItems: PromptEvidenceItem[] = palaceRelations.map((item) => ({
    level: item.status === '已归类' ? '辅证' : '限制',
    title: `${item.from}与${item.to}宫间作用`,
    detail: `${item.promptText}；边界：${item.limitation}`,
    source: item.sources.join('、'),
    tags: ['宫间关系', item.relation, item.from, item.to],
  }));
  const calculationRuleSourceKeys = unique(
    calculationEvidenceFacts.flatMap((item) => item.sourceKeys),
  );
  const calculationRuleSources = calculationRuleSourceKeys.map((key) => {
    const source = ruleSourceFacts.find((item) => item.key === key);
    if (!source) {
      throw new Error(`奇门计算事实引用了不存在的规则来源：${key}`);
    }
    return source;
  });
  const ruleSourceItems: PromptEvidenceItem[] = ruleSourceFacts.map((item) => ({
    level: item.category.includes('边界') ? '限制' : '辅证',
    title: `规则依据：${item.category}`,
    detail: `${item.promptText}；适用于${item.appliesTo.join('、')}；边界：${item.limitation}`,
    source: item.sources.join('、'),
    tags: ['奇门规则来源', item.category],
  }));
  const items: PromptEvidenceItem[] = [
    {
      level: calculationEvidenceFacts.some((item) => item.status === '落宫缺失') ? '反证' : '辅证',
      title: '定局计算事实',
      detail: `${calculationEvidenceFacts.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_FACT_LIMITATION}`,
      source: calculationRuleSources
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
    ...ruleSourceItems,
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
    ...positionIndexes.map((item): PromptEvidenceItem => ({
      level: '辅证',
      title: `${item.name}位置索引`,
      detail: `引用逐宫事实${item.palaceFactKey}；位置来源${item.indexSources.join('、')}；这些来源只标记值符、值使、日干、时干或已校勘格局所在宫，不自动指定具体问题的用神宫`,
      source: '值符、值使、日干、时干与已校勘格局落宫定位',
      tags: [item.name, ...item.indexSources],
    })),
    ...patternItems,
    ...relationItems,
    {
      level: counterSummaryFact.status === '有位置限制' ? '限制' : '辅证',
      title: '九宫位置限制',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['位置限制', counterSummaryFact.status],
    },
    ...(data.seasonality
      ? [
          {
            level: '辅证' as const,
            title: '节令与四柱背景事实',
            detail: `${data.seasonality.currentJieQi}${data.seasonality.jieQiPhase.phase}；季节五行${data.seasonality.seasonalElement}；日干${data.seasonality.dayStem}属${data.seasonality.dayElement}，与节令五行关系为${data.seasonality.seasonRelation}；月相${data.seasonality.lunarPhase}（${data.seasonality.lunarPhaseDetail}）；建除${data.seasonality.dayOfficer}；四柱互动${data.seasonality.ganzhiInteractions.map((item) => `${item.type}（${item.values.join('、')}）`).join('、') || '未检出明确合冲刑害'}`,
            source: '节气历表、月相证据、建除规则与四柱关系逐项计算',
            tags: ['节令', '月相', '建除', '四柱互动'],
          },
        ]
      : []),
    {
      level: '应期',
      title: '应期推算前提与资料边界',
      detail: `${timingSummaryFact.promptText}；${timingFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
      source: unique(timingFacts.flatMap((item) => item.sources)).join('、'),
      tags: ['应期', '用神待选', '期限待补'],
    },
    {
      level: '辅证',
      title: '九宫方向与方位取用边界',
      detail: `${directionBoundaryFact.promptText}；九宫方向详见逐宫原始事实；统一边界：${directionBoundaryFact.limitation}`,
      source: directionBoundaryFact.sources.join('、'),
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
      title: '奇门用神待选与方位解释边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: unique(limitationFacts.flatMap((item) => item.sources)).join('、'),
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '奇门九宫位置与关系结构化证据', items };
  const calculationChain = calculationEvidenceFacts.map((item) => item.promptText);
  const promptText = [
    '【奇门九宫位置与关系结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `应期推算前提：${timingConditions.join('；')}`,
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
    positionIndexes,
    palaceRelations,
    patternFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    timingFacts,
    timingSummaryFact,
    timingConditions,
    directionBoundaryFact,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText,
    methodology: [
      '定位值符、值使、日干、时干与已校勘经典格局所在宫，只作位置索引，不自动指定具体问题的用神。',
      '逐宫保留门、星、神、天地盘干、空亡、马星与已审核规则命中事实。',
      '定局、值符值使、已校勘组合规则来源、宫间作用、应期和方位条件全部进入统一证据条目。',
      '传统格局原文保留在结构化结果中，提示词只读取条件化副本并注明传统分类与现代实证边界。',
      '九宫宫对只陈述可复核的五行生克关系，不按位置索引制造主次，也不用数字分数代替判断。',
      '未按问题选定用神时不指定用神宫，不输出吉凶总分、成功率、方位结论或绝对日期。',
    ],
  };
}
