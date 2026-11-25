import type { z } from 'zod';
import type { lenormandInput } from '../schema';
import reference from './lenormand-data.json';
import { randomContext } from './random';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateLenormandSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';

type Input = z.infer<typeof lenormandInput>;
type Spread = keyof typeof reference.spreads;
type Card = { id: number; name: string; keywords: string[]; meaning: string; position: string; house?: string; row?: number; column?: number };
type Relation = '牌序相邻' | '横向相邻' | '纵向相邻' | '对角相邻';
type Combination = { card1: string; card2: string; position1: string; position2: string; relation: Relation; rowDistance: number; columnDistance: number; meaning: string; source: '固定组合' | '相邻牌义合读'; conditioned?: string };
type Layout = { kind: string; positions: string[]; cards: string[]; detail: string };
type Data = {
  spreadType: Spread; spreadName: string; cards: Card[]; combinations: Combination[];
  layoutEvidence: string[]; timestamp: number;
  draw: { deckSize: number; method: string; order: { index: number; position: string; cardId: number; cardName: string; house?: string; row?: number; column?: number }[] };
  evidenceAnalysis: ReturnType<typeof analyze>;
};

const LENORMAND_POSITIVE_IDS = new Set([2, 4, 9, 16, 17, 18, 24, 25, 30, 31, 33, 34]);
const LENORMAND_CHALLENGING_IDS = new Set([6, 7, 8, 10, 11, 14, 21, 23, 36]);

type LenormandValence = '顺畅' | '中性' | '阻滞';

function cardValence(id: number): LenormandValence {
  if (LENORMAND_POSITIVE_IDS.has(id)) return '顺畅';
  if (LENORMAND_CHALLENGING_IDS.has(id)) return '阻滞';
  return '中性';
}

function pairEchoLabel(v1: LenormandValence, v2: LenormandValence): string {
  if (v1 === '顺畅' && v2 === '顺畅') return '同向增益';
  if (v1 === '阻滞' && v2 === '阻滞') return '阻力叠加';
  if (v1 === '顺畅' && v2 === '阻滞') return '先顺后阻（顺逆对冲）';
  if (v1 === '阻滞' && v2 === '顺畅') return '先阻后顺（逆转趋畅）';
  if (v1 === '顺畅' || v2 === '顺畅') return '媒介引动增益';
  if (v1 === '阻滞' || v2 === '阻滞') return '媒介引动警示';
  return '中性并置';
}

export function analyzeLenormandRelations(spreadType: Spread, cards: Card[], combinations: Combination[]) {
  const positiveCount = cards.filter((c) => cardValence(c.id) === '顺畅').length;
  const challengingCount = cards.filter((c) => cardValence(c.id) === '阻滞').length;
  const neutralCount = cards.length - positiveCount - challengingCount;
  const valenceTilt =
    positiveCount > challengingCount
      ? '顺畅占优'
      : challengingCount > positiveCount
        ? '阻滞偏重'
        : positiveCount === 0 && challengingCount === 0
          ? '全为中性媒介'
          : '顺逆均衡';

  const cardByName = new Map(cards.map((c) => [c.name, c]));

  let indicatorSummary: string;
  if (spreadType === 'single') {
    indicatorSummary = `核心指示牌：「${cards[0].position}」${cards[0].name}（${cardValence(cards[0].id)}）`;
  } else if (spreadType === 'three') {
    indicatorSummary = `核心指示牌：中心「${cards[1].position}」${cards[1].name}（${cardValence(cards[1].id)}），左承「${cards[0].position}」${cards[0].name}（${cardValence(cards[0].id)}）、右启「${cards[2].position}」${cards[2].name}（${cardValence(cards[2].id)}）`;
  } else if (spreadType === 'five' || spreadType === 'relationship') {
    indicatorSummary = `核心指示牌：中心「${cards[2].position}」${cards[2].name}（${cardValence(cards[2].id)}）`;
  } else if (spreadType === 'nine') {
    indicatorSummary = `核心指示牌：九宫中心「${cards[4].position}」${cards[4].name}（${cardValence(cards[4].id)}）`;
  } else if (spreadType === 'decision') {
    const aEcho = pairEchoLabel(cardValence(cards[1].id), cardValence(cards[2].id));
    const bEcho = pairEchoLabel(cardValence(cards[3].id), cardValence(cards[4].id));
    indicatorSummary = `核心指示牌：起手「${cards[0].position}」${cards[0].name}（${cardValence(cards[0].id)}）、终局「${cards[5].position}」${cards[5].name}（${cardValence(cards[5].id)}）；分支A（${cards[1].name}→${cards[2].name}：${aEcho}） vs 分支B（${cards[3].name}→${cards[4].name}：${bEcho}）`;
  } else if (spreadType === 'grandTableau') {
    const personNotes = cards
      .map((card, index) => ({ card, houseIndex: index + 1 }))
      .filter(({ card }) => card.name === '男士' || card.name === '女士')
      .map(({ card, houseIndex }) => {
        const neighbors = cards.filter(
          (other) => other.id !== card.id && Math.abs(other.row! - card.row!) <= 1 && Math.abs(other.column! - card.column!) <= 1,
        );
        const nPos = neighbors.filter((n) => cardValence(n.id) === '顺畅').length;
        const nNeg = neighbors.filter((n) => cardValence(n.id) === '阻滞').length;
        return `${card.name}落第${houseIndex}宫（${card.house}宫），近身 ${neighbors.length} 牌（顺畅 ${nPos}、阻滞 ${nNeg}）`;
      });
    const homeCount = cards.filter((c) => c.name === c.house).length;
    indicatorSummary = `核心人物指示牌：${personNotes.join('；')}；归宫牌 ${homeCount} 张`;
  } else {
    indicatorSummary = `四元素牌位：${cards.map((c) => `${c.position}·${c.name}（${cardValence(c.id)}）`).join('、')}`;
  }

  const echoCounts = new Map<string, number>();
  const pairSummaries: string[] = [];
  for (const combo of combinations) {
    const c1 = cardByName.get(combo.card1);
    const c2 = cardByName.get(combo.card2);
    if (!c1 || !c2) continue;
    const echo = pairEchoLabel(cardValence(c1.id), cardValence(c2.id));
    echoCounts.set(echo, (echoCounts.get(echo) ?? 0) + 1);
    if (pairSummaries.length < 6) {
      pairSummaries.push(`${combo.card1}+${combo.card2}（${combo.source}·${echo}）`);
    }
  }
  const fixedCount = combinations.filter((c) => c.source === '固定组合').length;
  const echoStats = [...echoCounts.entries()].map(([k, v]) => `${k} ${v} 组`).join('、');

  const mirrorEchoes: string[] = [];
  if (spreadType === 'three') {
    mirrorEchoes.push(`首尾镜像：${cards[0].name}↔${cards[2].name}（${pairEchoLabel(cardValence(cards[0].id), cardValence(cards[2].id))}）`);
  } else if (spreadType === 'five' || spreadType === 'relationship') {
    mirrorEchoes.push(
      `外层镜像：${cards[0].name}↔${cards[4].name}（${pairEchoLabel(cardValence(cards[0].id), cardValence(cards[4].id))}）`,
      `内层镜像：${cards[1].name}↔${cards[3].name}（${pairEchoLabel(cardValence(cards[1].id), cardValence(cards[3].id))}）`,
    );
  }

  const lines = [
    `顺逆极性分布：顺畅 ${positiveCount} 张、中性 ${neutralCount} 张、阻滞 ${challengingCount} 张（${valenceTilt}）。`,
    `${indicatorSummary}。`,
    combinations.length
      ? `相邻牌组顺逆呼应：共 ${combinations.length} 组（固定组合 ${fixedCount} 组），分布：${echoStats}；代表组合：${pairSummaries.join('；')}。`
      : '相邻牌组顺逆呼应：单牌阵无相邻组合。',
    ...(mirrorEchoes.length ? [`镜像呼应：${mirrorEchoes.join('；')}。`] : []),
  ];

  return {
    positiveCount,
    neutralCount,
    challengingCount,
    valenceTilt,
    fixedCount,
    mirrorEchoes,
    text: lines.join('\n'),
  };
}

const directional = new Set(['骑士+心', '月亮+太阳', '星星+月亮', '锚+星星', '船+鹳']);
const fixed = reference.fixed as Record<string, { raw: string; conditioned: string }>;

function placeCards(spreadType: Spread, ids: readonly number[]): Card[] {
  const spread = reference.spreads[spreadType];
  if (ids.length !== spread.positions.length) throw new Error(`${spread.name}需要按牌位提供 ${spread.positions.length} 张牌。`);
  if (new Set(ids).size !== ids.length) throw new Error('同一牌阵不能重复提供同一张牌。');
  return ids.map((id, index) => {
    const card = reference.cards.find((entry) => entry.id === id);
    if (!card) throw new Error(`第 ${index + 1} 张雷诺曼牌无效。`);
    const columns = spreadType === 'grandTableau' ? 9 : spreadType === 'nine' ? 3 : 0;
    return {
      ...card, keywords: [...card.keywords], position: spread.positions[index],
      ...(spreadType === 'grandTableau' ? { house: reference.cards[index].name } : {}),
      ...(columns ? { row: Math.floor(index / columns) + 1, column: (index % columns) + 1 } : {}),
    };
  });
}

function buildCombinations(spreadType: Spread, cards: Card[]): Combination[] {
  const candidates: { first: Card; second: Card; relation: Relation; rowDistance: number; columnDistance: number }[] = [];
  const grid = spreadType === 'nine' || spreadType === 'grandTableau';
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const first = cards[i], second = cards[j];
    if (!grid) {
      if (j !== i + 1 || (spreadType === 'decision' && first.position === '选择A走向' && second.position === '选择B')) continue;
      candidates.push({ first, second, relation: '牌序相邻', rowDistance: 0, columnDistance: 0 });
      continue;
    }
    const rowDistance = Math.abs(first.row! - second.row!);
    const columnDistance = Math.abs(first.column! - second.column!);
    if (rowDistance > 1 || columnDistance > 1 || rowDistance + columnDistance === 0) continue;
    candidates.push({ first, second, rowDistance, columnDistance, relation: rowDistance === 0 ? '横向相邻' : columnDistance === 0 ? '纵向相邻' : '对角相邻' });
  }
  return candidates.flatMap(({ first, second, relation, rowDistance, columnDistance }) => {
    const direct = `${first.name}+${second.name}`, reverse = `${second.name}+${first.name}`;
    const matched = fixed[direct] ?? (!directional.has(reverse) ? fixed[reverse] : undefined);
    const person = ['男士', '女士'].includes(first.name) || ['男士', '女士'].includes(second.name);
    if (spreadType === 'grandTableau' && !matched && !person) return [];
    const firstMeaning = first.meaning.replace(/[。！？]$/u, '');
    const meaning = matched?.raw ?? (relation === '牌序相邻'
      ? spreadType === 'three'
        ? `${first.position}${first.name}的“${first.keywords.slice(0, 2).join('、')}”与${second.position}${second.name}的“${second.keywords.slice(0, 2).join('、')}”前后相接，先按${firstMeaning}，再看${second.meaning}`
        : `${first.position}${first.name}（${first.keywords.slice(0, 2).join('、')}）与${second.position}${second.name}（${second.keywords.slice(0, 2).join('、')}）是牌序相邻的两组线索，可按各自牌位并读`
      : `${first.position}${first.name}与${second.position}${second.name}为${relation}，互参“${first.keywords.slice(0, 2).join('、')}”与“${second.keywords.slice(0, 2).join('、')}”两组线索`);
    return [{ card1: first.name, card2: second.name, position1: first.position, position2: second.position, relation, rowDistance, columnDistance, meaning, source: matched ? '固定组合' as const : '相邻牌义合读' as const, ...(matched ? { conditioned: matched.conditioned } : {}) }];
  });
}

function buildLayout(spreadType: Spread, cards: Card[]): Layout[] {
  if (spreadType === 'nine') {
    const paths: [string, number[]][] = [
      ['上排', [0, 1, 2]], ['中排', [3, 4, 5]], ['下排', [6, 7, 8]],
      ['左列', [0, 3, 6]], ['中列', [1, 4, 7]], ['右列', [2, 5, 8]],
      ['左上至右下对角线', [0, 4, 8]], ['右上至左下对角线', [2, 4, 6]],
    ];
    return [{ kind: '九宫中心', positions: [cards[4].position], cards: [cards[4].name], detail: `中心位置为${cards[4].name}` }, ...paths.map(([kind, indices]) => ({ kind, positions: indices.map((index) => cards[index].position), cards: indices.map((index) => cards[index].name), detail: `${kind}：${indices.map((index) => cards[index].name).join('→')}` }))];
  }
  if (spreadType !== 'grandTableau') return [];
  const people = cards.filter((card) => card.name === '男士' || card.name === '女士').map((card) => {
    const neighbors = cards.filter((other) => other.id !== card.id && Math.abs(other.row! - card.row!) <= 1 && Math.abs(other.column! - card.column!) <= 1);
    return { kind: '人物牌近身', positions: [card.position, ...neighbors.map((item) => item.position)], cards: [card.name, ...neighbors.map((item) => item.name)], detail: `${card.name}落${card.position}，第${card.row}排第${card.column}列；近身牌：${neighbors.map((item) => item.name).join('、') || '无'}` };
  });
  const home = cards.filter((card) => card.name === card.house);
  return [...people, ...(home.length ? [{ kind: '归宫牌', positions: home.map((card) => card.position), cards: home.map((card) => card.name), detail: `归宫牌：${home.map((card) => `${card.name}回到本宫`).join('、')}` }] : [])];
}

function analyze(spreadType: Spread, cards: Card[], combinations: Combination[]) {
  const layout = buildLayout(spreadType, cards);
  return {
    cards: cards.map(({ id, name, position, keywords, house, row, column }) => ({ id, name, position, keywords, ...(house ? { house } : {}), ...(row ? { row, column } : {}) })),
    placements: spreadType === 'grandTableau' ? cards.map(({ id, name, position, house, row, column }) => ({ id, name, position, house, row, column })) : [],
    fixedCombinations: combinations.filter((item) => item.source === '固定组合'),
    adjacentReadings: combinations.filter((item) => item.source === '相邻牌义合读'),
    layout,
    calculationSteps: [
      { stage: '牌阵', detail: `${reference.spreads[spreadType].name}：${cards.length} 张，按牌位顺序排列。` },
      { stage: '组合', detail: `计算 ${combinations.length} 组实际相邻关系，其中固定组合 ${combinations.filter((item) => item.source === '固定组合').length} 组。` },
      { stage: '布局', detail: layout.length ? `记录 ${layout.length} 条九宫或大桌布局关系。` : '当前牌阵按实际牌位和牌序读取。' },
    ],
    sources: ['Petit Lenormand 牌面、牌阵位置与固定组合资料', '当前牌面顺序和网格布局'],
    limitations: [
      '单牌与组合是传统象征主题，不直接证明现实事件、人物意图或确定结果。',
      '固定组合与普通相邻联读分别取义；有先后含义的固定组合不能倒序套用。',
      '九宫路径、大桌宫位、人物牌近身和归宫只描述布局关系，不直接推导吉凶或日期。',
      '选择牌阵的 A、B 两条路径不能当作连续牌序；时间判断须有实际牌位和现实资料。',
    ],
  };
}

export function calculateLenormand(input: Input, now: string, randomSource?: () => number) {
  const spreadType = input.lenormand?.spread ?? 'single';
  const spread = reference.spreads[spreadType];
  const supplied = input.lenormand?.manualCardIds;
  let ids: number[];
  if (supplied) ids = [...supplied];
  else {
    const shuffled = reference.cards.map((card) => card.id), random = randomContext(randomSource);
    for (let index = shuffled.length - 1; index > 0; index--) {
      const target = random.integer(index + 1);
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    ids = shuffled.slice(0, spread.positions.length);
  }
  const cards = placeCards(spreadType, ids);
  const combinations = buildCombinations(spreadType, cards);
  const evidenceAnalysis = analyze(spreadType, cards, combinations);
  const draw = {
    deckSize: reference.cards.length,
    method: supplied ? input.lenormand?.selectionMode === 'interactive' ? '用户逐张抽取牌面' : '用户按牌位手工录入' : 'Fisher-Yates 洗牌后依牌位顺序取顶牌',
    order: cards.map((card, index) => ({ index: index + 1, position: card.position, cardId: card.id, cardName: card.name, ...(card.house ? { house: card.house } : {}), ...(card.row ? { row: card.row, column: card.column } : {}) })),
  };
  const data: Data = { spreadType, spreadName: spread.name, cards, combinations, layoutEvidence: evidenceAnalysis.layout.map((item) => item.detail), timestamp: new Date(now).getTime(), draw, evidenceAnalysis };
  const summary = {
    title: '雷诺曼抽牌结果', tags: [`牌阵：${spread.name}`, `张数：${cards.length}张`],
    lines: [
      ...cards.map((card) => `${card.position}：${card.name}；关键词：${card.keywords.join('、')}`),
      ...combinations.filter((item) => item.source === '固定组合').slice(0, 5).map((item) => `固定组合 ${item.card1}+${item.card2}：关注${item.conditioned}`),
    ],
  };
  return { data, summary, prompt: promptForLenormand(data, input.question, input.prompt, now) };
}

/** Saved charts are supplied by callers; reconstruct facts from validated card IDs. */
export function promptForLenormand(value: unknown, question: string, options: Input['prompt'], now: string) {
  const data = (value && typeof value === 'object' ? value : undefined) as Data | undefined;
  if (!data || !Object.hasOwn(reference.spreads, data.spreadType) || !Array.isArray(data.cards)) throw new Error('雷诺曼牌阵资料不完整。');
  const spread = reference.spreads[data.spreadType];
  if (data.spreadName !== spread.name) throw new Error('牌阵名称与牌阵类型不一致。');
  if (data.cards.some((card) => !card || typeof card !== 'object' || !Number.isInteger(card.id))) throw new Error('雷诺曼牌面资料格式无效。');
  const cards = placeCards(data.spreadType, data.cards.map((card) => card.id));
  for (let index = 0; index < cards.length; index++) {
    const actual = data.cards[index], expected = cards[index];
    for (const key of ['id', 'name', 'position', 'meaning', 'house', 'row', 'column'] as const) {
      if (actual[key] !== expected[key]) throw new Error(`第 ${index + 1} 张牌的 ${key} 与标准牌面不一致。`);
    }
    if (JSON.stringify(actual.keywords) !== JSON.stringify(expected.keywords)) throw new Error(`第 ${index + 1} 张牌的关键词与标准牌面不一致。`);
  }
  const combinations = buildCombinations(data.spreadType, cards);
  const evidence = analyze(data.spreadType, cards, combinations);
  const selection = resolvePromptSelection('lenormand', options);
  const schools = formatSchoolGuidance(options?.schools, reference.schools, {
    multiNote: '多口径合参：分别依据各口径判断，再比较共同点、分歧与对应牌面依据。',
  });
  const cardText = cards.map((card, index) => `${card.position}：${card.name}（#${card.id}）；关键词：${card.keywords.join('、')}；核心牌义：${card.meaning}${card.house ? `；落第${index + 1}宫（${card.house}宫）` : ''}${card.row ? `；第${card.row}排第${card.column}列` : ''}`).join('\n');
  const mirrorHints = data.spreadType === 'three'
    ? `中心焦点牌：${cards[1].position}${cards[1].name}；首尾镜像对读：${cards[0].position}${cards[0].name} ↔ ${cards[2].position}${cards[2].name}。`
    : data.spreadType === 'five' || data.spreadType === 'relationship'
      ? `中心焦点牌：${cards[2].position}${cards[2].name}；外层镜像：${cards[0].position}${cards[0].name} ↔ ${cards[4].position}${cards[4].name}；内层镜像：${cards[1].position}${cards[1].name} ↔ ${cards[3].position}${cards[3].name}。`
      : '';
  const cardByName = new Map(cards.map((card) => [card.name, card]));
  const combinationText = combinations.map((item) => item.source === '固定组合'
    ? `${item.position1}${item.card1} + ${item.position2}${item.card2}（${item.relation}）：传统固定组合，关注${item.conditioned}。`
    : `${item.position1}${item.card1} + ${item.position2}${item.card2}（${item.relation}）：联读${cardByName.get(item.card1)!.keywords.slice(0, 2).join('、')}与${cardByName.get(item.card2)!.keywords.slice(0, 2).join('、')}，不视为固定组合。`).join('\n');
  const sections = [
    '【传统依据】\n雷诺曼以牌序、邻牌关系、固定组合、中心焦点与镜像布局为主要资料；象征取义须与现实资料区分。',
    `【提示词参考时间】\n${now}`,
    `【占卜资料】\n占法：雷诺曼；牌阵：${spread.name}；共 ${cards.length} 张。\n${cardText}${mirrorHints ? `\n${mirrorHints}` : ''}`,
    `【牌阵结构与牌间呼应关系】\n${analyzeLenormandRelations(data.spreadType, cards, combinations).text}`,
    evidence.layout.length ? `【布局关系】\n${evidence.layout.map((item) => item.detail).join('\n')}` : '',
    combinationText ? `【牌面组合】\n${combinationText}` : '',
    selection ? `【解读选择】\n${selection.section}` : '',
    formatSchoolAlgorithmSection(evaluateLenormandSchoolAlgorithms({ spreadType: data.spreadType, cards }, combinations.length, options?.schools)),
    schools,
    options?.includeClassics ? '【传统资料】\n采用 Petit Lenormand 的牌面、牌位和组合资料；不同牌组的图像与解释可能有差异。' : '',
    `【任务】\n围绕问题按实际牌位、顺序、相邻关系和布局解读；区分固定组合与一般联读。${selection ? `\n${selection.task}` : ''}\n结合现实资料说明成立条件、相反线索和资料不足；不要把象征直接当作已发生的事件或人物意图。`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}
