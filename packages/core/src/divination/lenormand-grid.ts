/**
 * @file 雷诺曼核心九宫十字与距离几何算法
 * @计算口径 九张牌按三行三列排列，以中心位置计算曼哈顿距离。
 * 方位和距离仅记录牌面几何关系，具体象意结合牌位设定与问题解读。
 */
import { LENORMAND_CARDS } from './algorithms/lenormand';

export interface LenormandCardRef {
  id: number;
  name: string;
}

export interface LenormandGridPosition {
  card: LenormandCardRef;
  row: number;
  col: number;
  label: string;
  manhattanDistanceToCenter: number;
}

export interface LenormandCrossAnalysis {
  centerCard: LenormandCardRef;
  topCard?: LenormandCardRef;
  bottomCard?: LenormandCardRef;
  leftCard?: LenormandCardRef;
  rightCard?: LenormandCardRef;
  diagonalCards: {
    topLeft?: LenormandCardRef;
    topRight?: LenormandCardRef;
    bottomLeft?: LenormandCardRef;
    bottomRight?: LenormandCardRef;
  };
  cardDistances: Array<{
    card: LenormandCardRef;
    distance: number;
    relationship: '紧邻' | '近距' | '远距';
  }>;
  summary: string;
}

/**
 * 分析雷诺曼九宫（3x3，9张牌）的网格十字距离
 * 输入：9张牌数组（按九宫顺序：0左上, 1上, 2右上, 3左, 4核心, 5右, 6左下, 7下, 8右下）
 */
export function analyzeLenormandNineGrid(cards: LenormandCardRef[]): LenormandCrossAnalysis {
  if (!Array.isArray(cards) || cards.length !== 9) {
    throw new Error('雷诺曼九宫网格分析需要恰好9张牌');
  }
  const ids = new Set<number>();
  for (const card of cards) {
    if (!card || !LENORMAND_CARDS.some((item) => item.id === card.id && item.name === card.name)) {
      throw new Error('雷诺曼牌号或牌名无效');
    }
    if (ids.has(card.id)) throw new Error('雷诺曼九宫不能重复录入同一张牌');
    ids.add(card.id);
  }

  // 默认核心牌为中心位置（index 4）
  const centerCard = cards[4];
  const topCard = cards[1];
  const bottomCard = cards[7];
  const leftCard = cards[3];
  const rightCard = cards[5];
  const topLeft = cards[0];
  const topRight = cards[2];
  const bottomLeft = cards[6];
  const bottomRight = cards[8];

  const positions: Array<{ card: LenormandCardRef; row: number; col: number }> = [
    { card: topLeft, row: 0, col: 0 },
    { card: topCard, row: 0, col: 1 },
    { card: topRight, row: 0, col: 2 },
    { card: leftCard, row: 1, col: 0 },
    { card: centerCard, row: 1, col: 1 },
    { card: rightCard, row: 1, col: 2 },
    { card: bottomLeft, row: 2, col: 0 },
    { card: bottomCard, row: 2, col: 1 },
    { card: bottomRight, row: 2, col: 2 },
  ];

  const cardDistances = positions
    .filter((p) => p.row !== 1 || p.col !== 1)
    .map((p) => {
      const dist = Math.abs(p.row - 1) + Math.abs(p.col - 1);
      const relationship: '紧邻' | '近距' | '远距' =
        dist === 1 ? '紧邻' : dist === 2 ? '近距' : '远距';
      return {
        card: p.card,
        distance: dist,
        relationship,
      };
    })
    .sort((a, b) => a.distance - b.distance);

  const crossSummary = `核心「${centerCard.name}」：上方为「${topCard.name}」，下方为「${bottomCard.name}」，左侧为「${leftCard.name}」，右侧为「${rightCard.name}」`;
  const summary = `【雷诺曼九宫十字】${crossSummary}；最近紧邻牌包含：${cardDistances
    .filter((d) => d.relationship === '紧邻')
    .map((d) => d.card.name)
    .join('、')}`;

  return {
    centerCard,
    topCard,
    bottomCard,
    leftCard,
    rightCard,
    diagonalCards: {
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    },
    cardDistances,
    summary,
  };
}
