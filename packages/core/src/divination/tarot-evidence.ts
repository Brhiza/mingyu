import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { TarotData } from '../types/divination';

export interface TarotCardEvidence {
  index: number;
  position: string;
  name: string;
  orientation: '正位' | '逆位';
  keywords: string[];
  element: string;
  archetype: string;
  activeMeaning: string;
  constraints: string[];
}

export interface TarotEvidenceAnalysis {
  sources: Array<{ title: string; evidence: string; role: '牌组结构' | '项目解释口径' }>;
  cards: TarotCardEvidence[];
  sequence: string[];
  recurringThemes: string[];
  randomFacts: string[];
  counterEvidence: string[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

function normalizeElement(element?: string) {
  return element?.split('（')[0] || '元素未列';
}

export function analyzeTarotEvidence(data: TarotData): TarotEvidenceAnalysis {
  if (!data.cards.length) throw new Error('塔罗结构化证据至少需要一张牌。');
  const sources: TarotEvidenceAnalysis['sources'] = [
    {
      title: '78张韦特系塔罗牌组结构',
      evidence: '22张大阿卡纳与四组小阿卡纳的牌名、牌组和牌阶结构',
      role: '牌组结构',
    },
    {
      title: '命语塔罗牌阵与逐牌词典',
      evidence: '牌位、关键词、正逆位、元素主题和牌阶主题的统一解释范围',
      role: '项目解释口径',
    },
  ];
  const cards = data.cards.map((card, index): TarotCardEvidence => {
    const activeMeaning = card.reversed
      ? card.reversedMeaning || `${card.keywords.join('、')}相关主题可能受阻、过度或内化`
      : card.uprightMeaning || `${card.keywords.join('、')}相关主题直接呈现`;
    return {
      index: index + 1,
      position: card.position,
      name: card.name,
      orientation: card.reversed ? '逆位' : '正位',
      keywords: card.keywords,
      element: card.element || '元素未列',
      archetype: card.archetype || '牌阶主题未列',
      activeMeaning,
      constraints: card.reversed
        ? ['逆位只表示该牌主题可能受阻、过度、内化或方向偏离，须结合牌位与整组牌序']
        : [],
    };
  });
  const sequence = cards.slice(1).map((card, index) => {
    const previous = cards[index];
    return `${previous.position}${previous.name}${previous.orientation} → ${card.position}${card.name}${card.orientation}`;
  });
  const themeCounts = new Map<string, number>();
  cards.forEach((card) => {
    const element = normalizeElement(card.element);
    if (element === '元素未列') return;
    themeCounts.set(element, (themeCounts.get(element) ?? 0) + 1);
  });
  const recurringThemes = Array.from(themeCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([theme, count]) => `${theme}主题出现${count}张，只表示牌面重复，不等于权重分数`);
  const trace = data.meta?.random;
  const randomFacts = trace
    ? [
        `随机模式：${trace.mode}`,
        `原始随机样本数：${trace.samples.length}`,
        trace.seed !== undefined ? `随机种子：${String(trace.seed)}` : '',
      ].filter(Boolean)
    : ['当前结果未附随机轨迹，无法核验洗牌、抽牌和正逆位的重放过程'];
  const counterEvidence = cards.flatMap((card) =>
    card.constraints.map((constraint) => `${card.position}${card.name}：${constraint}`),
  );
  const limitations = [
    '塔罗抽牌包含随机过程；seed或replay只能复现抽牌轨迹，不证明预测有效性',
    '牌位、牌名、正逆位、关键词、元素和牌阶属于象征解释材料，不是现代统计证据',
    '重复元素或大阿卡纳数量只用于描述牌面构成，不生成能量分数、吉凶总分或成功率',
    '正位不等于必然有利，逆位不等于必然不利，必须结合牌位、问题和整组牌序',
    '牌面不能证明他人隐私、医疗诊断、法律事实、投资回报或唯一未来结果',
    '未给现实期限时不得把牌号、张数或牌义换算为绝对日期',
  ];
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: `牌阵结构：${data.spreadName}`,
      detail: `牌阵类型${data.spreadType}；共${cards.length}张；牌位依次为${cards.map((card) => card.position).join('、')}`,
      source: '当前牌阵配置与命语牌阵位置定义',
      tags: ['牌阵结构', data.spreadType, `${cards.length}张`],
    },
    ...cards.map((card, index): PromptEvidenceItem => ({
      level: index === cards.length - 1 || cards.length === 1 ? '主证' : '辅证',
      title: `${card.position}：${card.name}${card.orientation}`,
      detail: `关键词${card.keywords.join('、') || '未列'}；元素主题${card.element}；牌阶主题${card.archetype}；当前取义${card.activeMeaning}。`,
      source: '当前牌阵牌位、抽取牌面与命语逐牌词典',
      tags: [card.position, card.name, card.orientation, normalizeElement(card.element)],
    })),
    ...(sequence.length
      ? [
          {
            level: '辅证' as const,
            title: '牌位顺序推进',
            detail: sequence.join('；'),
            source: '当前牌阵的既定牌位顺序',
            tags: ['牌序', '阶段关系'],
          },
        ]
      : []),
    ...(recurringThemes.length
      ? [
          {
            level: '辅证' as const,
            title: '重复元素构成',
            detail: recurringThemes.join('；'),
            source: '当前牌面元素标签逐张计数',
            tags: ['构成描述', '不计权重'],
          },
        ]
      : []),
    {
      level: trace ? '辅证' : '反证',
      title: trace ? '随机过程重放记录' : '随机轨迹缺失',
      detail: `${randomFacts.join('；')}；该记录只用于核验抽牌过程能否重放，不表示可信度或预测有效性`,
      source: '命语统一随机轨迹协议',
      tags: ['随机轨迹', trace ? '可重放' : '不可核验', '不代表预测有效性'],
    },
  ];
  items.push(
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: detail.split('：')[0] + '解释约束',
      detail,
      source: '正逆位与整组牌序互证原则',
    })),
    {
      level: '限制',
      title: '塔罗牌面解释边界',
      detail: limitations.join('；'),
      source: '随机事实、象征材料与现实结论分离原则',
      tags: ['象征解释', '现实复核'],
    },
  );
  const evidence: PromptEvidenceBundle = { title: '塔罗牌位与牌面结构化证据', items };
  const promptText = [
    '【塔罗牌位与牌面结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `牌序关系：${sequence.join('；') || '单牌牌阵，无跨牌推进关系'}。`,
    `重复主题：${recurringThemes.join('；') || '未见达到两张的同类元素主题，不强行归纳主导元素'}。`,
    `反证限制：${counterEvidence.join('；') || '本次未见逆位牌；这不代表结果必然有利'}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    sources,
    cards,
    sequence,
    recurringThemes,
    randomFacts,
    counterEvidence,
    limitations,
    evidence,
    promptText,
    methodology: [
      '先固定牌阵与牌位，再逐张读取牌名、正逆位、关键词、元素和牌阶主题。',
      '按牌位顺序保留跨牌推进关系，不脱离牌位孤立套用牌义。',
      '重复元素只作为构成描述，逆位作为解释约束，不转换为分数。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}
