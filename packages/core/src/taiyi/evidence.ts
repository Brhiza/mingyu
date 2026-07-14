import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { TaiyiModelInfo, TaiyiScope } from '../types/divination';

export interface TaiyiEvidenceInput {
  scope: TaiyiScope;
  dateTime: string;
  ganZhi: string;
  accumulatedLabel: '积年' | '积月' | '积日' | '积时' | '积分';
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
  calculationChain: string[];
  primaryFacts: string[];
  supportingFacts: string[];
  counterEvidence: string[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const SCOPE_LABELS: Record<TaiyiScope, string> = {
  year: '年计',
  month: '月计',
  day: '日计',
  hour: '时计',
  minute: '分计',
};

function palaceText(position: string, palace: number) {
  return `${position}（第${palace}宫）`;
}

export function buildTaiyiEvidence(data: TaiyiEvidenceInput): TaiyiEvidenceAnalysis {
  const scopeLabel = SCOPE_LABELS[data.scope];
  const isCover = data.shiJiPalace === data.taiyiPalace;
  const isImprison = data.wenChangPalace === data.taiyiPalace;
  const calculationChain = [
    `${scopeLabel}以${data.dateTime}及本计干支${data.ganZhi}作为时间输入`,
    `按${scopeLabel}独立规则得到${data.accumulatedLabel}${data.accumulatedValue}，折入纪元数${data.entryYears}`,
    `积数除三百六十定位第${data.yuan}元、第${data.ji}纪，除七十二定位${data.yinYang}第${data.bureau}局`,
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
  if (isImprison) primaryFacts.push('囚成立：文昌与太乙同宫');

  const supportingFacts = [
    `计神在${palaceText(data.jiShenPosition, data.jiShenPalace)}`,
    `十六神固定定位：${data.sixteenGods.map((item) => `${item.branch}${item.god}`).join('、')}`,
  ];
  const counterEvidence = [
    isCover ? '' : '未见掩：始击与太乙不同宫',
    isImprison ? '' : '未见囚：文昌与太乙不同宫',
    data.lordGeneral === 5 || data.lordAssistant === 5 ? '主大将或主参将落中宫' : '',
    data.guestGeneral === 5 || data.guestAssistant === 5 ? '客大将或客参将落中宫' : '',
  ].filter(Boolean);
  const limitations = [
    `${scopeLabel}只适用于${scopeLabel}时间尺度，年、月、日、时、分五计的积数与阴阳遁规则不可互相替代`,
    '七十二局立成、宫位、算数与十六神属于传统规则模型，不是现代统计预测模型',
    '古籍与公开实现用于说明规则来源和交叉校验，不代表吉凶解释经过现代实证验证',
    '当前结果是太乙基础盘的结构化计算，未覆盖全部古法细目，不得据此声称完整复原所有太乙法门',
    '宫位、算数、掩囚及十六神不得换算为吉凶总分、成功率、匹配率、必然事件或唯一应期',
  ];
  const sourceText = data.model.sources
    .map((source) => `${source.title}：${source.evidence}`)
    .join('；');
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: `${scopeLabel}积数与七十二局`,
      detail: `${data.accumulatedLabel}${data.accumulatedValue}，入纪元数${data.entryYears}，第${data.yuan}元、第${data.ji}纪，${data.yinYang}第${data.bureau}局。`,
      source: sourceText,
      tags: [scopeLabel, data.yinYang, `第${data.bureau}局`],
    },
    {
      level: '主证',
      title: '太乙、主目与客目定位',
      detail: `${primaryFacts.slice(0, 2).join('；')}；${isCover ? '见掩结构' : '未见掩结构'}；${isImprison ? '见囚结构' : '未见囚结构'}。`,
      source: '七十二局太乙、文昌、始击位置立成表及同宫比较',
      tags: ['太乙', '文昌', '始击', ...(isCover ? ['掩'] : []), ...(isImprison ? ['囚'] : [])],
    },
    {
      level: '主证',
      title: '主客定算与将参',
      detail: `${primaryFacts[2]}；${primaryFacts[3]}。`,
      source: '七十二局主算、客算、定算立成表及将参定位规则',
      tags: ['主算', '客算', '定算', '将参'],
    },
    {
      level: '辅证',
      title: '计神与十六神定位',
      detail: supportingFacts.join('；'),
      source: '计神逐支定位规则与十六神固定宫位表',
      tags: ['计神', '十六神'],
    },
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: detail.split('：')[0],
      detail,
      source: '盘面宫位与中宫条件逐项核验',
    })),
    {
      level: '限制',
      title: '太乙五计解释边界',
      detail: limitations.join('；'),
      source: '计算事实与解释结论分离原则',
      tags: ['传统模型', '证据边界'],
    },
  ];
  const evidence: PromptEvidenceBundle = {
    title: '太乙五计七十二局结构化证据',
    items,
  };
  const promptText = [
    '【太乙五计七十二局结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `反证核验：${counterEvidence.join('；') || '未见掩、囚或将参中宫等明确限制结构'}。`,
    `方法限制：${limitations.join('；')}。`,
  ].join('\n');

  return {
    calculationChain,
    primaryFacts,
    supportingFacts,
    counterEvidence,
    limitations,
    evidence,
    promptText,
    methodology: [
      '先按所选计式独立计算积数、入纪元数、元纪、阴阳遁与七十二局。',
      '再读取太乙、文昌、始击及主客定算立成，比较同宫结构并定位将参。',
      '计神和十六神只列为辅助定位，不覆盖局数、主客目与主客定算主线。',
      '同时输出成立与不成立的结构，避免只罗列支持证据。',
      '保留传统规则来源与现代实证边界，不生成分数、概率或绝对应期。',
    ],
  };
}
