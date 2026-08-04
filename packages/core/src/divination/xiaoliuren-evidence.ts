import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { XiaoliurenData, XiaoliurenPalaceDetail } from '../types/divination';

const RULE_SOURCE =
  '通行俗传小六壬掌诀：正月从大安起，月上起初一，日上起子时，依大安、留连、速喜、赤口、小吉、空亡顺行';
const SOURCE_LIMITATION =
  '现阶段未取得可核验的早期刻本、页码或定本；“李淳风六壬时课”等署名不作为已证实的古籍归属';
const INTERPRETATION_LIMITATION =
  '只有时宫是本次占得宫；月宫和日宫只是顺数中间位置，不得解释成现实起因、过程或独立结果';
const VERSE_LIMITATION =
  '歌诀是传统分类文本，不是现实事实；须按所问事项选取对应句义，不得把疾病、灾殃、官非、方位或吉凶字样直接写成确定结论';
const CALENDAR_LIMITATION =
  '闰月沿用同名月序，农历日按东八区民用日零点换日；这两项属于当前明确采用的历法口径，不冒充所有流派的唯一规则';

export interface XiaoliurenCalculationStep {
  key: string;
  stage: '定月宫' | '定日宫' | '定时宫';
  status: '已计算' | '资料不足';
  formula: string;
  palace: XiaoliurenPalaceDetail | null;
  dependsOnStepKeys: string[];
  source: string;
  limitation: string;
}

export interface XiaoliurenCalculationFact {
  key: 'xiaoliuren:calculation';
  status: '完整' | '缺少中间参数';
  inputs: {
    lunarMonth: number;
    lunarDay: number;
    hourNumber: number | null;
    hourLabel: string;
    isLeapMonth: boolean;
  };
  steps: XiaoliurenCalculationStep[];
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface XiaoliurenPalaceFact {
  key: string;
  role: '月宫' | '日宫' | '时宫';
  level: '计算轨迹' | '主证';
  palace: XiaoliurenPalaceDetail;
  promptText: string;
  source: string;
  limitation: string;
}

export interface XiaoliurenLimitationFact {
  key: string;
  type: '来源边界' | '中间宫边界' | '歌诀边界' | '历法边界' | '扩展规则边界';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
}

export interface XiaoliurenSummaryFact {
  key: 'xiaoliuren:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  calculationStepCount: number;
  palaceFactCount: number;
  limitationFactCount: number;
  promptText: string;
}

export interface XiaoliurenEvidenceAnalysis {
  key: 'xiaoliuren:evidence';
  status: '已计算' | '资料不足';
  sources: Array<{
    title: string;
    evidence: string;
    role: '规则来源' | '历法来源' | '来源限制';
  }>;
  calculationFact: XiaoliurenCalculationFact;
  calculationSteps: XiaoliurenCalculationStep[];
  palaceFacts: XiaoliurenPalaceFact[];
  primaryFact: XiaoliurenPalaceFact;
  limitationFacts: XiaoliurenLimitationFact[];
  limitations: string[];
  summaryFact: XiaoliurenSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  interpretationOrder: string[];
}

function buildCalculationSteps(data: XiaoliurenData): XiaoliurenCalculationStep[] {
  const calculation = data.calculation;
  if (!calculation) {
    return [];
  }

  return [
    {
      key: 'xiaoliuren:calculation:month',
      stage: '定月宫',
      status: '已计算',
      formula: `正月从大安起：(${calculation.lunarMonth}-1) mod 6=${calculation.monthPalaceIndex}，落${data.sequence.month.name}`,
      palace: data.sequence.month,
      dependsOnStepKeys: [],
      source: RULE_SOURCE,
      limitation: '月宫只确定日数起点，不是现实起因。',
    },
    {
      key: 'xiaoliuren:calculation:day',
      stage: '定日宫',
      status: '已计算',
      formula: `月上起初一：(${calculation.lunarMonth}+${calculation.lunarDay}-2) mod 6=${calculation.dayPalaceIndex}，落${data.sequence.day.name}`,
      palace: data.sequence.day,
      dependsOnStepKeys: ['xiaoliuren:calculation:month'],
      source: RULE_SOURCE,
      limitation: '日宫只确定时辰起点，不是现实过程。',
    },
    {
      key: 'xiaoliuren:calculation:hour',
      stage: '定时宫',
      status: '已计算',
      formula: `日上起子时：(${calculation.lunarMonth}+${calculation.lunarDay}+${calculation.hourNumber}-3) mod 6=${calculation.hourPalaceIndex}，落${data.sequence.hour.name}`,
      palace: data.sequence.hour,
      dependsOnStepKeys: ['xiaoliuren:calculation:day'],
      source: RULE_SOURCE,
      limitation: '时宫是本次占得宫，但宫名和歌诀仍不等于现实必然结果。',
    },
  ];
}

function buildPalaceFacts(data: XiaoliurenData): XiaoliurenPalaceFact[] {
  return [
    {
      key: 'xiaoliuren:palace:month',
      role: '月宫',
      level: '计算轨迹',
      palace: data.sequence.month,
      promptText: `月宫${data.sequence.month.name}，只作为月上起日的计数起点`,
      source: RULE_SOURCE,
      limitation: '不得解释成事情起因或月运。',
    },
    {
      key: 'xiaoliuren:palace:day',
      role: '日宫',
      level: '计算轨迹',
      palace: data.sequence.day,
      promptText: `日宫${data.sequence.day.name}，只作为日上起时的计数起点`,
      source: RULE_SOURCE,
      limitation: '不得解释成事情过程或日运。',
    },
    {
      key: 'xiaoliuren:palace:hour',
      role: '时宫',
      level: '主证',
      palace: data.sequence.hour,
      promptText: `占得${data.sequence.hour.name}；通行歌诀原文：${data.sequence.hour.verse}`,
      source: '通行俗传小六壬六宫歌诀，版本文字存在异文',
      limitation: VERSE_LIMITATION,
    },
  ];
}

export function analyzeXiaoliurenEvidence(data: XiaoliurenData): XiaoliurenEvidenceAnalysis {
  const calculationSteps = buildCalculationSteps(data);
  const complete = calculationSteps.length === 3;
  const palaceFacts = buildPalaceFacts(data);
  const primaryFact = palaceFacts[2];
  if (!primaryFact) {
    throw new Error('小六壬时宫主证缺失。');
  }

  const calculationFact: XiaoliurenCalculationFact = {
    key: 'xiaoliuren:calculation',
    status: complete ? '完整' : '缺少中间参数',
    inputs: {
      lunarMonth: data.lunarMonth,
      lunarDay: data.lunarDay,
      hourNumber: data.calculation?.hourNumber ?? null,
      hourLabel: data.hourLabel,
      isLeapMonth: data.isLeapMonth,
    },
    steps: calculationSteps,
    promptText: complete
      ? calculationSteps.map((step) => step.formula).join('；')
      : '结果未附完整的月、日、时逐宫顺数参数，不能复核落宫。',
    sources: [RULE_SOURCE, '农历与时辰由统一历法模块换算'],
    limitation: `${INTERPRETATION_LIMITATION}；${CALENDAR_LIMITATION}`,
  };

  const limitationFacts: XiaoliurenLimitationFact[] = [
    {
      key: 'xiaoliuren:limitation:source',
      type: '来源边界',
      ownerFactKeys: [calculationFact.key, primaryFact.key],
      promptText: SOURCE_LIMITATION,
      sources: ['现有书目与文本检索结果'],
    },
    {
      key: 'xiaoliuren:limitation:intermediate-palaces',
      type: '中间宫边界',
      ownerFactKeys: palaceFacts.slice(0, 2).map((fact) => fact.key),
      promptText: INTERPRETATION_LIMITATION,
      sources: [RULE_SOURCE],
    },
    {
      key: 'xiaoliuren:limitation:verse',
      type: '歌诀边界',
      ownerFactKeys: [primaryFact.key],
      promptText: VERSE_LIMITATION,
      sources: ['通行俗传六宫歌诀'],
    },
    {
      key: 'xiaoliuren:limitation:calendar',
      type: '历法边界',
      ownerFactKeys: [calculationFact.key],
      promptText: CALENDAR_LIMITATION,
      sources: ['当前排盘口径'],
    },
    {
      key: 'xiaoliuren:limitation:extensions',
      type: '扩展规则边界',
      ownerFactKeys: [primaryFact.key],
      promptText:
        '未采用无可核验出处的华山派完整课、三宫起因过程结果、宫间五行推进、月令旺衰、日干六亲、旬空、驿马、桃花、固定应期、身体部位和通用方位扩展。',
      sources: ['最小可核验规则原则'],
    },
  ];

  const factKeys = [
    calculationFact.key,
    ...calculationSteps.map((step) => step.key),
    ...palaceFacts.map((fact) => fact.key),
    ...limitationFacts.map((fact) => fact.key),
  ];
  const summaryFact: XiaoliurenSummaryFact = {
    key: 'xiaoliuren:evidence-summary',
    status: complete ? '证据链完整' : '证据链有缺口',
    factKeys,
    calculationStepCount: calculationSteps.length,
    palaceFactCount: palaceFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `顺数步骤${calculationSteps.length}项、宫位事实${palaceFacts.length}项、来源与解释限制${limitationFacts.length}项`,
  };

  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: `占得${primaryFact.palace.name}`,
      detail: `${primaryFact.promptText}；边界：${primaryFact.limitation}`,
      source: primaryFact.source,
      tags: ['时宫', primaryFact.palace.name],
    },
    {
      level: '辅证',
      title: '月日时顺数计算',
      detail: `${calculationFact.promptText}；${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['计算链', '月上起日', '日上起时'],
    },
    ...palaceFacts.slice(0, 2).map((fact): PromptEvidenceItem => ({
      level: '辅证',
      title: `${fact.role}${fact.palace.name}`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.source,
      tags: ['计算轨迹', fact.role],
    })),
    ...limitationFacts.map((fact): PromptEvidenceItem => ({
      level: '限制',
      title: fact.type,
      detail: fact.promptText,
      source: fact.sources.join('、'),
      tags: ['规则边界'],
    })),
  ];
  const evidence: PromptEvidenceBundle = {
    title: '小六壬通行时间课结构化证据',
    items,
  };
  const limitations = limitationFacts.map((fact) => fact.promptText);
  const promptText = [
    '【传统依据】',
    RULE_SOURCE,
    '',
    '【排盘资料】',
    `农历：${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}`,
    `顺数轨迹：月宫${data.sequence.month.name}；日宫${data.sequence.day.name}；时宫${data.sequence.hour.name}`,
    `占得宫：${data.primary.name}`,
    `歌诀原文：${data.primary.verse}`,
  ].join('\n');

  return {
    key: 'xiaoliuren:evidence',
    status: complete ? '已计算' : '资料不足',
    sources: [
      { title: '通行俗传小六壬掌诀', evidence: RULE_SOURCE, role: '规则来源' },
      {
        title: '统一历法换算',
        evidence: '农历月日、东八区民用日与子1至亥12时辰序',
        role: '历法来源',
      },
      { title: '版本学限制', evidence: SOURCE_LIMITATION, role: '来源限制' },
    ],
    calculationFact,
    calculationSteps,
    palaceFacts,
    primaryFact,
    limitationFacts,
    limitations,
    summaryFact,
    evidence,
    promptText,
    interpretationOrder: [
      '先复核农历月、日和时辰数，再逐步复算月宫、日宫、时宫。',
      '只把时宫作为本次占得宫，月宫和日宫仅保留为计算轨迹。',
      '按所问事项选择时宫歌诀中的对应句义，不跨事项套用。',
      '把歌诀视为传统分类材料，并列现实信息核验，不输出确定灾病、官非、方位或应期。',
    ],
  };
}
