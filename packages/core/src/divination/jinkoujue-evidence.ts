import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { buildRandomTraceFact, type RandomTraceFact } from '../shared/random';
import type { JinkoujueData } from '../types/divination';

const SOURCE_LIMITATION =
  '现阶段只有笼统书名《六壬神课金口诀古本》和章节名称，未取得可核验的具体底本、版本、出版信息、原文位置或页码，不能证明现有起课表与算法口径闭合';
const RULE_LIMITATION =
  '本次不自动计算数字到地分、月将加时、昼夜贵人、贵神顺逆、十二贵神本属、五子元遁、四位、阴阳发用、五动三动、月令旺衰、旬空、生克关系或现实解释';
const CONTINUE_REQUIREMENT =
  '若要继续金口诀推算，必须先明确具体底本、版本和可定位原文，并逐项校定地分、月将、贵神、遁干、四位、发用及五动三动规则';

export interface JinkoujueInputFact {
  key: 'jinkoujue:input';
  status: '原始事实';
  method: JinkoujueData['method'];
  methodLabel: string;
  timestamp: number;
  ganzhi: JinkoujueData['ganzhi'];
  numberInput: number | null;
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface JinkoujueLimitationFact {
  key: string;
  type: '来源边界' | '计算边界' | '继续推算条件';
  promptText: string;
  sources: string[];
}

export interface JinkoujueSummaryFact {
  key: 'jinkoujue:evidence-summary';
  status: '证据链有缺口';
  promptText: string;
  factKeys: string[];
}

export interface JinkoujueEvidenceAnalysis {
  key: 'jinkoujue:evidence';
  status: '资料不足';
  inputFact: JinkoujueInputFact;
  randomTraceFact: RandomTraceFact;
  limitationFacts: JinkoujueLimitationFact[];
  limitations: string[];
  summaryFact: JinkoujueSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  interpretationOrder: string[];
}

/** 仅供已按原始输入重建的结果使用；公开入口位于算法模块。 */
export function analyzeRebuiltJinkoujueEvidence(data: JinkoujueData): JinkoujueEvidenceAnalysis {
  const inputParts = [
    `起课方式：${data.methodLabel}`,
    `时间戳：${data.timestamp}`,
    `四柱：${data.ganzhi.year}、${data.ganzhi.month}、${data.ganzhi.day}、${data.ganzhi.hour}`,
    data.method === 'number' ? `用户原始数字：${data.numberInput}` : '',
  ].filter(Boolean);
  const inputFact: JinkoujueInputFact = {
    key: 'jinkoujue:input',
    status: '原始事实',
    method: data.method,
    methodLabel: data.methodLabel,
    timestamp: data.timestamp,
    ganzhi: data.ganzhi,
    numberInput: data.method === 'number' ? (data.numberInput ?? null) : null,
    promptText: inputParts.join('；'),
    sources: ['时间与四柱由统一历法模块换算', '数字由用户原样输入'],
    limitation: '这些事实本身不构成金口诀课盘，也不能推出地分、四位、发用或现实结论',
  };
  const randomTraceFact = buildRandomTraceFact({
    key: 'jinkoujue:random-trace',
    applicable: data.method === 'random',
    trace: data.randomTrace,
    processLabel: '金口诀随机起课原始抽样',
    sources: ['统一随机轨迹模块'],
  });
  const limitationFacts: JinkoujueLimitationFact[] = [
    {
      key: 'jinkoujue:limitation:source',
      type: '来源边界',
      promptText: SOURCE_LIMITATION,
      sources: ['现有书目与文本检索结果'],
    },
    {
      key: 'jinkoujue:limitation:calculation',
      type: '计算边界',
      promptText: RULE_LIMITATION,
      sources: ['失败关闭原则'],
    },
    {
      key: 'jinkoujue:limitation:continue',
      type: '继续推算条件',
      promptText: CONTINUE_REQUIREMENT,
      sources: ['版本校勘要求'],
    },
  ];
  const summaryFact: JinkoujueSummaryFact = {
    key: 'jinkoujue:evidence-summary',
    status: '证据链有缺口',
    promptText: '只提供原始起课记录；金口诀起课、四位、发用和解释规则来源未闭合，未生成课盘主证',
    factKeys: [inputFact.key, randomTraceFact.key, ...limitationFacts.map((fact) => fact.key)],
  };
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: '起课原始记录',
      detail: inputFact.promptText,
      source: inputFact.sources.join('、'),
      tags: ['时间', '四柱', '原始输入'],
    },
    ...(data.method === 'random'
      ? [
          {
            level: '辅证' as const,
            title: '随机轨迹',
            detail: `${randomTraceFact.promptText}；${randomTraceFact.limitation}`,
            source: randomTraceFact.sources.join('、'),
            tags: ['随机轨迹'],
          },
        ]
      : []),
    ...limitationFacts.map((fact): PromptEvidenceItem => ({
      level: '限制',
      title: fact.type,
      detail: fact.promptText,
      source: fact.sources.join('、'),
      tags: ['规则待校'],
    })),
  ];
  const evidence: PromptEvidenceBundle = {
    title: '金口诀原始起课事实与待校边界',
    items,
  };
  const promptText = [
    '【金口诀原始起课事实与待校边界】',
    ...formatPromptEvidenceBundle(evidence),
    `【证据汇总】${summaryFact.promptText}`,
  ].join('\n');

  return {
    key: 'jinkoujue:evidence',
    status: '资料不足',
    inputFact,
    randomTraceFact,
    limitationFacts,
    limitations: limitationFacts.map((fact) => fact.promptText),
    summaryFact,
    evidence,
    promptText,
    interpretationOrder: [
      '先核对起课方式、时间、四柱、用户原始数字或随机轨迹。',
      '明确具体底本、版本、原文位置和拟采用的完整规则。',
      '来源和适用条件未闭合前停止推算，不生成地分、四位、发用或五动三动。',
      '不得从原始数字、四柱或随机样本补造现实吉凶、应期或行动建议。',
    ],
  };
}
