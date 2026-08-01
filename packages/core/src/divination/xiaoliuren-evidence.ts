import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { XiaoliurenData } from '../types/divination';

const CANDIDATE_RULE =
  '俗传候选规则常见表述为“正月从大安起，月上起初一，日上起子时”，并按大安、留连、速喜、赤口、小吉、空亡顺行';
const SOURCE_LIMITATION =
  '现阶段未取得可核验的固定底本、具体版本和页码，作者、成书年代及“李淳风六壬时课”等署名均未证实；候选规则和六宫歌诀不得作为已校定依据';
const CALENDAR_LIMITATION =
  '闰月沿用同名月序，农历日按东八区民用日零点换日；这是当前明确采用的历法换算口径，不代表任何小六壬流派的唯一规则';
const CALCULATION_LIMITATION =
  '本次不自动顺数、不提供落宫结论或六宫歌诀；若继续推算，必须先明确采用的具体底本、宫序、起数规则、闰月和换日口径';

export interface XiaoliurenCalculationStep {
  key: string;
  stage: '定月宫' | '定日宫' | '定时宫';
  status: '规则待校';
  formula: string;
  dependsOnStepKeys: string[];
  source: string;
  limitation: string;
}

export interface XiaoliurenCalculationFact {
  key: 'xiaoliuren:calculation';
  status: '规则待校';
  inputs: {
    lunarMonth: number;
    lunarDay: number;
    hourNumber: number;
    hourLabel: string;
    isLeapMonth: boolean;
  };
  steps: XiaoliurenCalculationStep[];
  promptText: string;
  sources: string[];
  limitation: string;
}

/** 兼容旧类型名；来源闭合前不产生任何宫位事实。 */
export interface XiaoliurenPalaceFact {
  key: string;
  role: '月宫' | '日宫' | '时宫';
  level: '待校候选';
  palace: null;
  promptText: string;
  source: string;
  limitation: string;
}

export interface XiaoliurenLimitationFact {
  key: string;
  type: '来源边界' | '计算边界' | '历法边界' | '扩展规则边界';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
}

export interface XiaoliurenSummaryFact {
  key: 'xiaoliuren:evidence-summary';
  status: '证据链有缺口';
  factKeys: string[];
  calculationStepCount: number;
  palaceFactCount: number;
  limitationFactCount: number;
  promptText: string;
}

export interface XiaoliurenEvidenceAnalysis {
  key: 'xiaoliuren:evidence';
  status: '资料不足';
  sources: Array<{
    title: string;
    evidence: string;
    role: '规则候选' | '历法来源' | '来源限制';
  }>;
  calculationFact: XiaoliurenCalculationFact;
  calculationSteps: XiaoliurenCalculationStep[];
  palaceFacts: XiaoliurenPalaceFact[];
  primaryFact: null;
  limitationFacts: XiaoliurenLimitationFact[];
  limitations: string[];
  summaryFact: XiaoliurenSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  interpretationOrder: string[];
}

/** 仅供已按原始时间戳重建的结果使用；公开入口位于算法模块。 */
export function analyzeRebuiltXiaoliurenEvidence(data: XiaoliurenData): XiaoliurenEvidenceAnalysis {
  const calculationFact: XiaoliurenCalculationFact = {
    key: 'xiaoliuren:calculation',
    status: '规则待校',
    inputs: {
      lunarMonth: data.lunarMonth,
      lunarDay: data.lunarDay,
      hourNumber: data.calculation.hourNumber,
      hourLabel: data.hourLabel,
      isLeapMonth: data.isLeapMonth,
    },
    steps: [],
    promptText: `原始历法事实：农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}，时辰序号${data.calculation.hourNumber}`,
    sources: ['农历、干支与时辰由统一历法模块换算'],
    limitation: CALCULATION_LIMITATION,
  };
  const calculationSteps: XiaoliurenCalculationStep[] = [];
  const palaceFacts: XiaoliurenPalaceFact[] = [];
  const limitationFacts: XiaoliurenLimitationFact[] = [
    {
      key: 'xiaoliuren:limitation:source',
      type: '来源边界',
      ownerFactKeys: [calculationFact.key],
      promptText: SOURCE_LIMITATION,
      sources: ['现有书目与文本检索结果'],
    },
    {
      key: 'xiaoliuren:limitation:calculation',
      type: '计算边界',
      ownerFactKeys: [calculationFact.key],
      promptText: CALCULATION_LIMITATION,
      sources: ['失败关闭原则'],
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
      ownerFactKeys: [calculationFact.key],
      promptText:
        '不自动采用数字或随机起课、三宫起因过程结果、宫间五行推进、月令旺衰、日干六亲、旬空、驿马、桃花、固定应期、身体部位和通用方位扩展。',
      sources: ['最小可靠事实原则'],
    },
  ];
  const factKeys = [calculationFact.key, ...limitationFacts.map((fact) => fact.key)];
  const summaryFact: XiaoliurenSummaryFact = {
    key: 'xiaoliuren:evidence-summary',
    status: '证据链有缺口',
    factKeys,
    calculationStepCount: 0,
    palaceFactCount: 0,
    limitationFactCount: limitationFacts.length,
    promptText: '只提供原始历法事实；落宫规则和歌诀来源未闭合，未生成宫位主证',
  };
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: '起课原始历法事实',
      detail: calculationFact.promptText,
      source: calculationFact.sources.join('、'),
      tags: ['时间', '农历', '时辰'],
    },
    ...limitationFacts.map((fact): PromptEvidenceItem => ({
      level: '限制',
      title: fact.type,
      detail: fact.promptText,
      source: fact.sources.join('、'),
      tags: ['规则边界'],
    })),
  ];
  const evidence: PromptEvidenceBundle = {
    title: '小六壬原始时间事实与待校边界',
    items,
  };
  const limitations = limitationFacts.map((fact) => fact.promptText);
  const promptText = [
    '【小六壬原始时间事实与待校边界】',
    ...formatPromptEvidenceBundle(evidence),
    '',
    `【候选规则说明】${CANDIDATE_RULE}；该规则仅用于说明待校对象，本次未执行。`,
    `【证据汇总】${summaryFact.promptText}`,
  ].join('\n');

  return {
    key: 'xiaoliuren:evidence',
    status: '资料不足',
    sources: [
      { title: '俗传候选规则', evidence: CANDIDATE_RULE, role: '规则候选' },
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
    primaryFact: null,
    limitationFacts,
    limitations,
    summaryFact,
    evidence,
    promptText,
    interpretationOrder: [
      '先使用已列时间、干支、农历月日和时辰序号作为原始事实。',
      '若要继续推算，先明确具体底本、版本和完整起数规则。',
      '版本未明确前不得自行生成月宫、日宫、时宫、占得宫或歌诀解释。',
      '不得补造固定吉凶、疾病、官非、方位或应期结论。',
    ],
  };
}
