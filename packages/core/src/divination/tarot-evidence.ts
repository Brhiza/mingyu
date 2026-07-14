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
  promptMeaning: string;
  constraints: string[];
}

export interface TarotTraditionalFact {
  key: string;
  index: number;
  position: string;
  card: string;
  orientation: '正位' | '逆位';
  kind: '牌义解释';
  originalText: string;
  promptText: string;
  sources: string[];
  limitation: '牌义、关键词、元素与牌阶只作为当前牌位的象征解释材料，不证明现实事件、他人意图、心理状态、疾病、法律事实、财务结果或唯一未来';
}

export interface TarotEvidenceAnalysis {
  sources: Array<{ title: string; evidence: string; role: '牌组结构' | '传统解释来源' }>;
  cards: TarotCardEvidence[];
  drawFacts: string[];
  sequence: string[];
  recurringThemes: string[];
  randomFacts: string[];
  counterEvidence: string[];
  limitations: string[];
  traditionalFacts: TarotTraditionalFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

function normalizeElement(element?: string) {
  return element?.split('（')[0] || '元素未列';
}

const TRADITIONAL_FACT_LIMITATION =
  '牌义、关键词、元素与牌阶只作为当前牌位的象征解释材料，不证明现实事件、他人意图、心理状态、疾病、法律事实、财务结果或唯一未来' as const;

export function conditionTarotTraditionalText(text: string, orientation?: '正位' | '逆位'): string {
  const conditioned = text
    .replace(/信息被隐藏/g, '信息可能尚未充分公开')
    .replace(/还没找到真正答案/g, '尚未取得足以核实的答案')
    .replace(/公平结果尚未落定/g, '与公平相关的现实结果仍待核实')
    .replace(/成功比预期更晚到来/g, '与成功期待相关的进展可能晚于预期')
    .replace(/隐藏信息正在慢慢显现/g, '尚未核实的信息可能逐步出现线索')
    .replace(/内部结构已不稳/g, '可留意既有安排是否存在不稳定迹象')
    .replace(/必然/g, '可能')
    .replace(/一定/g, '可能');
  const upright = conditioned.match(/^正位强调(.+?)[，,]表示这些能量正在直接发挥作用[。.]?$/);
  if (upright) {
    return `正位传统牌义侧重${upright[1]}；可作为这些主题可能较直接呈现的象征线索，须结合牌位与现实资料核实`;
  }
  if (orientation === '正位') {
    const meaning = conditioned.replace(/[。.]$/, '');
    return `正位传统牌义提示可留意${meaning || '相关主题可能较直接呈现'}；须结合牌位、整组牌序与现实资料核实`;
  }
  const reversed = conditioned.replace(/^逆位重点[：:]?/, '').replace(/[。.]$/, '');
  if (orientation === '逆位' || /^逆位重点[：:]?/.test(conditioned)) {
    return `逆位传统牌义提示可留意${reversed || '相关主题可能受阻、过度、内化或方向偏离'}；须结合牌位、整组牌序与现实资料核实`;
  }
  return `传统牌义提示可留意${reversed || '当前牌面主题'}；须结合正逆位、牌位、整组牌序与现实资料核实`;
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
      title: '韦特系牌义与牌阵资料',
      evidence: '牌位、关键词、正逆位、元素主题和牌阶主题的统一解释范围',
      role: '传统解释来源',
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
      promptMeaning: conditionTarotTraditionalText(activeMeaning, card.reversed ? '逆位' : '正位'),
      constraints: card.reversed
        ? ['逆位只表示该牌主题可能受阻、过度、内化或方向偏离，须结合牌位与整组牌序']
        : [],
    };
  });
  const traditionalFacts = cards.map((card): TarotTraditionalFact => ({
    key: `card:${card.index}:${card.name}:${card.orientation}`,
    index: card.index,
    position: card.position,
    card: card.name,
    orientation: card.orientation,
    kind: '牌义解释',
    originalText: card.activeMeaning,
    promptText: card.promptMeaning,
    sources: ['韦特系78张牌组结构', '当前逐牌关键词与正逆位解释资料'],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const drawFacts = data.draw
    ? [
        `牌组规模：${data.draw.deckSize}张；洗牌方法：${data.draw.method}`,
        `正逆位规则：${data.draw.orientationRule}`,
        ...data.draw.order.map(
          (item) =>
            `第${item.index}张对应${item.position}：牌号${item.cardId} ${item.cardName}${item.orientation}`,
        ),
      ]
    : [
        `当前结果未附洗牌与抽取顺序，仅保留已确定牌面：${cards.map((card) => `${card.position}${card.name}${card.orientation}`).join('、')}`,
      ];
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
  const promptRandomFacts = randomFacts.filter((item) => !item.startsWith('随机种子：'));
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
      title: '洗牌、抽取顺序与正逆位事实',
      detail: drawFacts.join('；'),
      source: '78张牌组、Fisher-Yates洗牌、牌位顺序取牌与逐牌方向随机判定',
      tags: ['抽牌来源', '洗牌', '正逆位', '可重放'],
    },
    {
      level: '辅证',
      title: `牌阵结构：${data.spreadName}`,
      detail: `牌阵类型${data.spreadType}；共${cards.length}张；牌位依次为${cards.map((card) => card.position).join('、')}`,
      source: '当前牌阵配置与牌阵位置定义',
      tags: ['牌阵结构', data.spreadType, `${cards.length}张`],
    },
    ...cards.map((card, index): PromptEvidenceItem => ({
      level: index === cards.length - 1 || cards.length === 1 ? '主证' : '辅证',
      title: `${card.position}：${card.name}${card.orientation}`,
      detail: `关键词${card.keywords.join('、') || '未列'}；元素主题${card.element}；牌阶主题${card.archetype}；条件化牌义${card.promptMeaning}；边界${TRADITIONAL_FACT_LIMITATION}。`,
      source: '当前牌阵牌位、抽取牌面与逐牌解释资料',
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
      detail: `${promptRandomFacts.join('；')}；随机种子保留在结构化结果中，不写入自然语言提示词；该记录只用于核验抽牌过程能否重放，不表示可信度或预测有效性`,
      source: '随机抽牌样本与重放轨迹记录',
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
    drawFacts,
    sequence,
    recurringThemes,
    randomFacts,
    counterEvidence,
    limitations,
    traditionalFacts,
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
