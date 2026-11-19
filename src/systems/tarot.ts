import type { z } from 'zod';
import type { tarotInput } from '../schema';
import reference from './tarot-data.json';
import { randomContext } from './random';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateTarotSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';

type Input = z.infer<typeof tarotInput>;
type Spread = keyof typeof reference.spreads;
type Card = { id: number; name: string; position: string; reversed: boolean; keywords: string[]; element: string; archetype: string };
type Data = {
  spreadType: Spread; spreadName: string; cards: Card[]; timestamp: number;
  draw: { deckSize: number; method: string; order: { index: number; position: string; cardId: number; cardName: string; orientation: string }[] };
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
    drawMethod = isMajorOnly
      ? '22张大阿卡纳洗牌后依牌位顺序取顶牌'
      : 'Fisher-Yates 洗牌后依牌位顺序取顶牌';
    const random = randomContext(randomSource);
    const shuffled = [...candidateDeck];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const target = random.integer(index + 1);
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    for (let index = 0; index < spread.cardCount; index++) {
      const card = shuffled[index];
      cards.push({ id: card.number, name: card.name, position: spread.positions[index], reversed: random.sample() < 0.5, keywords: [...card.keywords], element: card.element, archetype: card.archetype });
    }
  }
  const evidenceAnalysis = analyze(cards);
  const data: Data = {
    spreadType, spreadName: spread.name, cards, timestamp: new Date(now).getTime(),
    draw: { deckSize: candidateDeck.length, method: drawMethod, order: cards.map((card, index) => ({ index: index + 1, position: card.position, cardId: card.id, cardName: card.name, orientation: card.reversed ? '逆位' : '正位' })) },
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
  const sections = [
    '【传统依据】\n按牌阵位置、正逆位、牌组层次、元素与牌序解读；逆位需结合问题和相邻牌面。',
    `【提示词参考时间】\n${now}`,
    `【占卜资料】\n占法：塔罗；牌阵：${data.spreadName}；共 ${data.cards.length} 张。\n牌阵结构统计：${structureSummary}\n${cards}`,
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
