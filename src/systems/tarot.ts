import type { z } from 'zod';
import type { tarotInput } from '../schema';
import reference from './tarot-data.json';
import { randomContext } from './random';
import { resolveTarotReversalMode, TAROT_REVERSAL_RATES, type TarotReversalMode } from './defaults';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateTarotSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';

type Input = z.infer<typeof tarotInput>;
type Spread = keyof typeof reference.spreads;
type Card = { id: number; name: string; position: string; reversed: boolean; keywords: string[]; element: string; archetype: string };
type Data = {
  spreadType: Spread; spreadName: string; cards: Card[]; timestamp: number;
  draw: { deckSize: number; method: string; reversalMode?: TarotReversalMode; order: { index: number; position: string; cardId: number; cardName: string; orientation: string }[] };
  evidenceAnalysis: {
    cards: { position: string; name: string; orientation: string; keywords: string[]; element: string; archetype: string }[];
    adjacent: { first: string; second: string; elements: string[]; relation: string }[];
    recurringThemes: { element: string; count: number }[];
    reversalConstraints: string[];
    sources: string[];
    limitations: string[];
  };
};

function elementName(card: Card) { return card.element.split('（')[0]; }
function elementRelation(first: Card, second: Card) {
  const a = elementName(first), b = elementName(second);
  if (a === '大阿卡纳' || b === '大阿卡纳') return '核心课题介入';
  if (a === b) return '同类强化';
  const pair = new Set([a, b]);
  if ((pair.has('火') && pair.has('风')) || (pair.has('水') && pair.has('土'))) return '相互助长';
  if ((pair.has('火') && pair.has('水')) || (pair.has('风') && pair.has('土'))) return '相互制约';
  return '中性并置';
}

const MINOR_ELEMENTS = ['火', '水', '风', '土'] as const;

export function analyzeTarotRelations(cards: Card[]) {
  const total = cards.length;
  const elementCounts: Record<string, number> = { 火: 0, 水: 0, 风: 0, 土: 0, 大阿卡纳: 0 };
  for (const card of cards) {
    const el = elementName(card);
    elementCounts[el] = (elementCounts[el] ?? 0) + 1;
  }

  const minorCounts = MINOR_ELEMENTS.map((el) => ({ el, count: elementCounts[el] }));
  const maxMinor = Math.max(...minorCounts.map((item) => item.count));
  const dominantElements = maxMinor > 0 ? minorCounts.filter((item) => item.count === maxMinor).map((item) => item.el) : [];
  const missingElements = minorCounts.filter((item) => item.count === 0).map((item) => item.el);
  const elementSummary =
    maxMinor === 0
      ? `全为大阿卡纳（${total} 张），无小阿卡纳四元素分布`
      : `四元素分布：火 ${elementCounts['火']}、水 ${elementCounts['水']}、风 ${elementCounts['风']}、土 ${elementCounts['土']}；主导：${dominantElements.join('/')}（各 ${maxMinor} 张）；缺失：${missingElements.length ? missingElements.join('、') : '四元素俱全'}`;

  const majorCards = cards.filter((c) => c.id <= 22);
  const courtCards = cards.filter((c) => /侍从|骑士|王后|国王/u.test(c.name));
  const pipCount = total - majorCards.length - courtCards.length;
  const majorRatio = total > 0 ? Math.round((majorCards.length / total) * 100) : 0;
  const majorSummary = `大阿卡纳 ${majorCards.length}/${total} 张（${majorRatio}%${majorCards.length ? `，落位：${majorCards.map((c) => `${c.position}·${c.name}`).join('、')}` : ''}）；宫廷牌 ${courtCards.length} 张；数字牌 ${pipCount} 张`;

  const reversedCards = cards.filter((c) => c.reversed);
  const uprightCount = total - reversedCards.length;
  const reversedRatio = total > 0 ? Math.round((reversedCards.length / total) * 100) : 0;
  let orientationSwitches = 0;
  for (let i = 1; i < total; i += 1) {
    if (cards[i].reversed !== cards[i - 1].reversed) orientationSwitches += 1;
  }
  const tensionSummary =
    reversedCards.length === 0
      ? `全正位（${total}/${total} 张），能量外显直行`
      : reversedCards.length === total
        ? `全逆位（${total}/${total} 张），整体内化或受阻张力集中`
        : `正位 ${uprightCount} 张、逆位 ${reversedCards.length} 张（逆位占 ${reversedRatio}%），相邻正逆切换 ${orientationSwitches} 次；逆位落位：${reversedCards.map((c) => `${c.position}·${c.name}`).join('、')}`;

  const adjacentCounts = new Map<string, number>();
  for (let i = 1; i < total; i += 1) {
    const rel = elementRelation(cards[i - 1], cards[i]);
    adjacentCounts.set(rel, (adjacentCounts.get(rel) ?? 0) + 1);
  }
  const adjacentSummary = [...adjacentCounts.entries()].map(([rel, cnt]) => `${rel} ${cnt} 组`).join('、');

  let arcSummary: string;
  if (total <= 1) {
    const only = cards[0];
    arcSummary = `单牌聚焦：「${only.position}」${only.name}（${only.reversed ? '逆位' : '正位'}，${elementName(only)}）`;
  } else {
    const first = cards[0];
    const last = cards[total - 1];
    const shift =
      !first.reversed && !last.reversed
        ? '正位起手→正位收束'
        : first.reversed && last.reversed
          ? '逆位起手→逆位收束'
          : first.reversed && !last.reversed
            ? '逆位起手→正位转明'
            : '正位起手→逆位转收';
    arcSummary = `首尾演变：「${first.position}」${first.name}（${first.reversed ? '逆位' : '正位'}·${elementName(first)}）→「${last.position}」${last.name}（${last.reversed ? '逆位' : '正位'}·${elementName(last)}），首尾元素关系：${elementRelation(first, last)}，正逆转向：${shift}${adjacentSummary ? `；相邻呼应统计：${adjacentSummary}` : ''}`;
  }

  const lines = [
    `元素分布与失衡：${elementSummary}。`,
    `牌阶与大阿卡纳占比：${majorSummary}。`,
    `正逆位张力：${tensionSummary}。`,
    `${arcSummary}。`,
  ];

  return {
    elementCounts,
    dominantElements,
    missingElements,
    majorCount: majorCards.length,
    majorRatio,
    reversedCount: reversedCards.length,
    reversedRatio,
    orientationSwitches,
    text: lines.join('\n'),
  };
}

function analyze(cards: Card[]) {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(elementName(card), (counts.get(elementName(card)) ?? 0) + 1);
  return {
    cards: cards.map((card) => ({ position: card.position, name: card.name, orientation: card.reversed ? '逆位' : '正位', keywords: card.keywords, element: card.element, archetype: card.archetype })),
    adjacent: cards.slice(1).map((card, index) => ({ first: cards[index].position, second: card.position, elements: [elementName(cards[index]), elementName(card)], relation: elementRelation(cards[index], card) })),
    recurringThemes: [...counts].filter(([, count]) => count > 1).map(([element, count]) => ({ element, count })),
    reversalConstraints: cards.filter((card) => card.reversed).map((card) => `${card.position}${card.name}逆位：主题可能受阻、过度、内化或方向偏离，需结合相邻牌位和现实资料。`),
    sources: ['Rider-Waite-Smith 牌组结构及牌阵位置', '牌面关键词与四元素互参规则'],
    limitations: [
      '牌位、牌名、正逆位、关键词与元素是已记录的象征资料，不等于现实事件或他人意图。',
      '逆位可能表示主题受阻、过度、内化或方向偏离，需结合牌位与问题。',
      '元素互参和主题数量只描述牌面结构，不应推导现实吉凶或成功率。',
      '抽牌过程和牌面结构不能证明预测有效性。',
    ],
  };
}

export function calculateTarot(input: Input, now: string, randomSource?: () => number) {
  const isMajorOnly = input.tarot?.deckScope === 'major';
  const spreadType = input.tarot?.spread ?? (isMajorOnly ? 'three' : 'single');
  const spread = reference.spreads[spreadType];
  const candidateDeck = isMajorOnly
    ? reference.cards.filter((entry) => entry.number <= 22)
    : reference.cards;
  const reversalMode: TarotReversalMode = resolveTarotReversalMode(input.tarot?.reversalMode);
  const manual = input.tarot?.manualCards;
  const cards: Card[] = [];
  let drawMethod: string;
  if (manual) {
    if (manual.length !== spread.cardCount) throw new Error(`${spread.name}需要按牌位录入 ${spread.cardCount} 张牌。`);
    if (new Set(manual.map((item) => item.id)).size !== manual.length) throw new Error('同一牌阵不能重复录入同一张牌。');
    drawMethod = input.tarot?.selectionMode === 'interactive' ? '用户逐张抽取牌面' : '用户按牌位手工录入';
    for (const [index, item] of manual.entries()) {
      const card = candidateDeck.find((entry) => entry.number === item.id);
      if (!card) throw new Error(`第 ${index + 1} 张塔罗牌无效。`);
      cards.push({ id: card.number, name: card.name, position: spread.positions[index], reversed: item.reversed, keywords: [...card.keywords], element: card.element, archetype: card.archetype });
    }
  } else {
    const reversalNote = reversalMode === 'upright-only'
      ? '仅正位'
      : reversalMode === 'balanced'
        ? '对半 50% 逆位'
        : '现实洗牌约 30% 逆位';
    drawMethod = isMajorOnly
      ? `22张大阿卡纳洗牌定正逆位（${reversalNote}）后依牌位顺序取顶牌`
      : `Fisher-Yates 洗牌定正逆位（${reversalNote}）后依牌位顺序取顶牌`;
    const random = randomContext(randomSource);
    const reversalRate = TAROT_REVERSAL_RATES[reversalMode];
    // 洗牌阶段同步确定整副牌的正逆位，再打乱整副牌堆并依牌位顺序取顶牌
    const shuffled = candidateDeck.map((card) => ({
      card,
      reversed: reversalRate > 0 ? random.sample() < reversalRate : false,
    }));
    for (let index = shuffled.length - 1; index > 0; index--) {
      const target = random.integer(index + 1);
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    for (let index = 0; index < spread.cardCount; index++) {
      const { card, reversed } = shuffled[index];
      cards.push({ id: card.number, name: card.name, position: spread.positions[index], reversed, keywords: [...card.keywords], element: card.element, archetype: card.archetype });
    }
  }
  const evidenceAnalysis = analyze(cards);
  const data: Data = {
    spreadType, spreadName: spread.name, cards, timestamp: new Date(now).getTime(),
    draw: {
      deckSize: candidateDeck.length,
      method: drawMethod,
      ...(!manual ? { reversalMode } : {}),
      order: cards.map((card, index) => ({ index: index + 1, position: card.position, cardId: card.id, cardName: card.name, orientation: card.reversed ? '逆位' : '正位' })),
    },
    evidenceAnalysis,
  };
  const summary = {
    title: isMajorOnly ? '大阿卡纳抽牌结果' : '塔罗抽牌结果',
    tags: [
      ...(isMajorOnly ? ['牌组：22张大阿卡纳'] : []),
      `牌阵：${spread.name}`,
      `张数：${cards.length}张`,
    ],
    lines: cards.map((card) => `${card.position}：${card.name}（${card.reversed ? '逆位' : '正位'}）`),
  };
  return { data, summary, prompt: promptForTarot(data, input.question, input.prompt, now) };
}

export function promptForTarot(value: unknown, question: string, options: Input['prompt'], now: string) {
  const selection = resolvePromptSelection('tarot', options);
  const data = (value && typeof value === 'object' ? value : undefined) as Data | undefined;
  if (!data || !Object.hasOwn(reference.spreads, data.spreadType) || !Array.isArray(data.cards)) throw new Error('塔罗牌阵资料不完整。');
  const spread = reference.spreads[data.spreadType];
  const framework = reference.frameworks[data.spreadType];
  if (data.spreadName !== spread.name || data.cards.length !== spread.cardCount) throw new Error('塔罗牌阵名称或牌数不一致。');
  if (new Set(data.cards.map((card) => card?.id)).size !== data.cards.length) throw new Error('塔罗牌阵包含重复牌面。');
  for (const [index, card] of data.cards.entries()) {
    const canonical = card && reference.cards.find((item) => item.number === card.id);
    if (!canonical || card.name !== canonical.name || card.position !== spread.positions[index] || typeof card.reversed !== 'boolean' || card.element !== canonical.element || card.archetype !== canonical.archetype || JSON.stringify(card.keywords) !== JSON.stringify(canonical.keywords)) {
      throw new Error(`第 ${index + 1} 张塔罗牌的牌位或牌面资料不一致。`);
    }
  }
  const cards = data.cards.map((card) => `${card.position}：${card.name}（${card.reversed ? '逆位' : '正位'}）；关键词：${card.keywords.join('、')}；元素：${card.element}；牌阶：${card.archetype}`).join('\n');
  const evidence = analyze(data.cards);
  const majorCount = data.cards.filter((c) => c.id <= 22).length;
  const courtCount = data.cards.filter((c) => /侍从|骑士|王后|国王/u.test(c.name)).length;
  const reversedCount = data.cards.filter((c) => c.reversed).length;
  const structureSummary = `大阿卡纳 ${majorCount}/${data.cards.length} 张（${majorCount > data.cards.length / 2 ? '宏观阶段转折与核心课题占主导' : majorCount === 0 ? '全为小阿卡纳，聚焦日常具体事务与执行' : '宏观课题与具体执行交织'}）；宫廷牌 ${courtCount} 张；逆位 ${reversedCount}/${data.cards.length} 张。`;
  const interactions = evidence.adjacent.map((item) => `${item.first}（${item.elements[0]}）与${item.second}（${item.elements[1]}）：${item.relation}`).join('\n');
  const themes = evidence.recurringThemes.map((item) => `${item.element} ${item.count} 张`).join('；');
  const reversalNotes = evidence.reversalConstraints.join('\n');
  const schools = formatSchoolGuidance(options?.schools, reference.schools, {
    multiNote: '多口径合参：分别依据各口径判断，再比较共同点、分歧与对应牌面依据。',
  });
  const reversalModeLabel = data.draw?.reversalMode === 'upright-only'
    ? '；洗牌模式：仅正位（未启用逆位）'
    : data.draw?.reversalMode === 'balanced'
      ? '；洗牌模式：经典对半（50% 逆位）'
      : data.draw?.reversalMode === 'realistic'
        ? '；洗牌模式：现实洗牌手感（约 30% 逆位）'
        : '';
  const sections = [
    '【传统依据】\n按牌阵位置、正逆位、牌组层次、元素与牌序解读；逆位需结合问题和相邻牌面。',
    `【提示词参考时间】\n${now}`,
    `【占卜资料】\n占法：塔罗；牌阵：${data.spreadName}；共 ${data.cards.length} 张${reversalModeLabel}。\n牌阵结构统计：${structureSummary}\n${cards}`,
    `【牌阵结构与牌间呼应关系】\n${analyzeTarotRelations(data.cards).text}`,
    interactions || reversalNotes ? `【相邻牌元素与逆位结构】\n${[interactions, themes ? `重复牌面主题：${themes}` : '', reversalNotes].filter(Boolean).join('\n')}\n元素关系仅为传统取象，正逆位不改变元素关系。` : '',
    selection ? `【解读选择】\n${selection.section}` : '',
    formatSchoolAlgorithmSection(evaluateTarotSchoolAlgorithms(data, options?.schools)),
    schools,
    options?.includeClassics ? '【传统资料】\n以 Rider-Waite-Smith 体系的牌面、牌位和正逆位资料为依据。' : '',
    `【任务】\n围绕问题逐牌核对牌位、牌名、正逆位、关键词和元素，结合可观察的现实条件。\n解读主线：${framework.mainLine}\n牌位联动：${framework.connections}\n结论重点：${framework.conclusion}${selection ? `\n${selection.task}` : ''}\n分别说明支持、张力、可能分支与资料不足；不要将象征直接当作确定事件。`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}
