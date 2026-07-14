import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { LenormandData } from '../types/divination';

export interface LenormandEvidenceAnalysis {
  cards: Array<LenormandData['cards'][number] & { index: number }>;
  sequence: string[];
  fixedCombinations: NonNullable<LenormandData['combinations']>;
  adjacentReadings: NonNullable<LenormandData['combinations']>;
  layoutFacts: string[];
  counterEvidence: string[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

export function analyzeLenormandEvidence(data: LenormandData): LenormandEvidenceAnalysis {
  if (!data.cards.length) throw new Error('雷诺曼结构化证据至少需要一张牌。');
  const cards = data.cards.map((card, index) => ({ ...card, index: index + 1 }));
  const sequence = cards.slice(1).map((card, index) => {
    const previous = cards[index];
    return `${previous.position}${previous.name} → ${card.position}${card.name}`;
  });
  const fixedCombinations = (data.combinations ?? []).filter((item) => item.source === '固定组合');
  const adjacentReadings = (data.combinations ?? []).filter((item) => item.source !== '固定组合');
  const layoutFacts = data.layoutEvidence ?? [];
  const counterEvidence = [
    fixedCombinations.length
      ? ''
      : '本次未命中项目已登记的固定组合，不得把普通相邻合读冒充传统定式',
    layoutFacts.length ? '' : '当前牌阵没有九宫或大桌布局证据，只按牌位与相邻顺序读取',
  ].filter(Boolean);
  const limitations = [
    '雷诺曼抽牌包含随机过程；seed或replay只能复现抽牌轨迹，不证明预测有效性',
    '固定组合仅指项目词典中明确登记的牌对，相邻牌义合读是当前牌序解释，二者证据等级不同',
    '九宫中心、横纵对角线、大桌宫位、近身牌和归宫牌只描述布局关系，不自动产生吉凶结论',
    '牌名、关键词、组合和布局属于象征解释材料，不是事件发生概率或现代统计证据',
    '单牌或单一组合不能证明他人意图、隐私、医疗、法律、财务事实或必然结果',
    '未给现实期限时不得把牌号、宫位或距离换算为唯一日期',
  ];
  const items: PromptEvidenceItem[] = cards.map((card, index): PromptEvidenceItem => ({
    level: index === Math.floor(cards.length / 2) || cards.length === 1 ? '主证' : '辅证',
    title: `${card.position}：${card.name}`,
    detail: `关键词${card.keywords.join('、') || '未列'}；牌义${card.meaning}${card.house ? `；落${card.house}宫` : ''}${card.row && card.column ? `；第${card.row}排第${card.column}列` : ''}。`,
    source: '当前牌阵牌位、抽取牌面与命语36牌词典',
    tags: [card.position, card.name, ...card.keywords.slice(0, 3)],
  }));
  items.push(
    ...fixedCombinations.map((combo): PromptEvidenceItem => ({
      level: '主证',
      title: `固定组合${combo.card1}+${combo.card2}`,
      detail: combo.meaning,
      source: '命语雷诺曼固定组合词典',
      tags: ['固定组合', combo.card1, combo.card2],
    })),
    ...adjacentReadings.map((combo): PromptEvidenceItem => ({
      level: '辅证',
      title: `相邻合读${combo.card1}+${combo.card2}`,
      detail: combo.meaning,
      source: '相邻牌关键词与牌义按抽牌顺序合读',
      tags: ['相邻牌义合读', combo.card1, combo.card2],
    })),
    ...layoutFacts.map((detail, index): PromptEvidenceItem => ({
      level: '辅证',
      title: `布局事实${index + 1}`,
      detail,
      source: '当前牌阵行列、中心、横纵对角线、宫位与牌间距离逐项计算',
      tags: ['布局证据'],
    })),
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: '当前证据缺口',
      detail,
      source: '组合词典与牌阵布局逐项核验',
    })),
    {
      level: '限制',
      title: '雷诺曼牌面解释边界',
      detail: limitations.join('；'),
      source: '随机事实、象征材料与现实结论分离原则',
      tags: ['象征解释', '现实复核'],
    },
  );
  const evidence: PromptEvidenceBundle = { title: '雷诺曼牌序组合与布局结构化证据', items };
  const promptText = [
    '【雷诺曼牌序组合与布局结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `牌序关系：${sequence.join('；') || '单牌牌阵，无相邻推进关系'}。`,
    `固定组合：${fixedCombinations.map((item) => `${item.card1}+${item.card2}：${item.meaning}`).join('；') || '未命中已登记固定组合'}。`,
    `布局事实：${layoutFacts.join('；') || '当前牌阵无额外九宫或大桌布局事实'}。`,
    `反证限制：${counterEvidence.join('；') || '已列组合与布局仍须结合牌位和现实资料复核'}。`,
  ].join('\n');
  return {
    cards,
    sequence,
    fixedCombinations,
    adjacentReadings,
    layoutFacts,
    counterEvidence,
    limitations,
    evidence,
    promptText,
    methodology: [
      '先按牌阵固定牌位和抽牌顺序，再逐张读取牌名、关键词与基础牌义。',
      '固定组合与普通相邻合读分层保存，未命中固定组合时明确保留证据缺口。',
      '九宫和大桌仅增加可复核的空间关系，不把位置直接换算成吉凶或日期。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}
