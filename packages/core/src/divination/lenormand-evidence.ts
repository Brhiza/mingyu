import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { LenormandData } from '../types/divination';

export interface LenormandEvidenceAnalysis {
  cards: Array<LenormandData['cards'][number] & { index: number }>;
  sequence: string[];
  fixedCombinations: NonNullable<LenormandData['combinations']>;
  adjacentReadings: NonNullable<LenormandData['combinations']>;
  drawFacts: string[];
  layoutFacts: string[];
  randomFacts: string[];
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
  const drawFacts = data.draw
    ? [
        `牌组规模：${data.draw.deckSize}张；洗牌与取牌方法：${data.draw.method}`,
        ...data.draw.order.map(
          (item) =>
            `第${item.index}张对应${item.position}：牌号${item.cardId} ${item.cardName}${item.house ? `，落${item.house}宫` : ''}${item.row && item.column ? `，第${item.row}排第${item.column}列` : ''}`,
        ),
      ]
    : ['当前结果未附洗牌方法与抽取顺序，仅保留已确定牌面，不能反推完整抽牌来源链'];
  const layoutFacts = data.layoutEvidence ?? [];
  const trace = data.meta?.random;
  const randomFacts = trace
    ? [
        `随机模式：${trace.mode}`,
        `原始随机样本数：${trace.samples.length}`,
        trace.seed !== undefined ? `随机种子：${String(trace.seed)}` : '',
      ].filter(Boolean)
    : ['当前结果未附随机轨迹，无法核验洗牌与抽牌过程的重放'];
  const promptRandomFacts = randomFacts.filter((item) => !item.startsWith('随机种子：'));
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
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: `牌阵结构：${data.spreadName}`,
      detail: `牌阵类型${data.spreadType}；共${cards.length}张；牌位依次为${cards.map((card) => card.position).join('、')}`,
      source: '当前牌阵配置与命语牌阵位置定义',
      tags: ['牌阵结构', data.spreadType, `${cards.length}张`],
    },
    {
      level: data.draw ? '辅证' : '反证',
      title: data.draw ? '洗牌与抽取顺序事实' : '抽牌来源链缺失',
      detail: drawFacts.join('；'),
      source: data.draw
        ? '36张雷诺曼牌组、Fisher-Yates洗牌与牌位顺序取牌'
        : '旧版雷诺曼结果兼容检查',
      tags: ['抽牌来源', data.draw ? '洗牌' : '来源缺失', data.draw ? '可重放' : '不可反推'],
    },
    ...cards.map((card, index): PromptEvidenceItem => ({
      level: index === Math.floor(cards.length / 2) || cards.length === 1 ? '主证' : '辅证',
      title: `${card.position}：${card.name}`,
      detail: `关键词${card.keywords.join('、') || '未列'}；牌义${card.meaning}${card.house ? `；落${card.house}宫` : ''}${card.row && card.column ? `；第${card.row}排第${card.column}列` : ''}。`,
      source: '当前牌阵牌位、抽取牌面与命语36牌词典',
      tags: [card.position, card.name, ...card.keywords.slice(0, 3)],
    })),
    ...(sequence.length
      ? [
          {
            level: '辅证' as const,
            title: '牌位顺序推进',
            detail: sequence.join('；'),
            source: '当前牌阵的既定牌位顺序',
            tags: ['牌序', '相邻关系'],
          },
        ]
      : []),
    {
      level: trace ? '辅证' : '反证',
      title: trace ? '随机过程重放记录' : '随机轨迹缺失',
      detail: `${promptRandomFacts.join('；')}；随机种子保留在结构化结果中，不写入自然语言提示词；该记录只用于核验抽牌过程能否重放，不表示可信度或预测有效性`,
      source: '命语统一随机轨迹协议',
      tags: ['随机轨迹', trace ? '可重放' : '不可核验', '不代表预测有效性'],
    },
  ];
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
    `抽牌来源：${drawFacts.join('；')}。`,
    `布局事实：${layoutFacts.join('；') || '当前牌阵无额外九宫或大桌布局事实'}。`,
    `反证限制：${counterEvidence.join('；') || '已列组合与布局仍须结合牌位和现实资料复核'}。`,
  ].join('\n');
  return {
    cards,
    sequence,
    fixedCombinations,
    adjacentReadings,
    drawFacts,
    layoutFacts,
    randomFacts,
    counterEvidence,
    limitations,
    evidence,
    promptText,
    methodology: [
      '先按牌阵固定牌位和抽牌顺序，再逐张读取牌名、关键词与基础牌义。',
      '抽牌来源单独保存牌组规模、Fisher-Yates洗牌方法、抽取序号与牌位落点，供结构化核验。',
      '固定组合与普通相邻合读分层保存，未命中固定组合时明确保留证据缺口。',
      '九宫和大桌仅增加可复核的空间关系，不把位置直接换算成吉凶或日期。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}
