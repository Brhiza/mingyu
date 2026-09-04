/**
 * @file 雷诺曼核心九宫十字与距离几何算法
 * @传统依据 1799年《Das Spiel der Hoffnung》及欧洲 Petit Lenormand 通行牌阵网格几何：
 * 核心十字方位：上（目标/思维显意识）、下（根基/潜意识）、左（过去因由）、右（未来走向）；
 * 几何距离：曼哈顿距离越近，对核心牌的影响越强烈直接。
 */

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
 * 分析雷诺曼九宫（3x3，9张牌）或带核心牌的网格十字距离
 * 输入：9张牌数组（按九宫顺序：0左上, 1上, 2右上, 3左, 4核心, 5右, 6左下, 7下, 8右下）
 */
export function analyzeLenormandNineGrid(cards: LenormandCardRef[]): LenormandCrossAnalysis {
  if (cards.length < 9) {
    throw new Error('雷诺曼九宫网格分析需要至少9张牌');
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
    .filter((p) => p.card.id !== centerCard.id)
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

  const crossSummary = `核心「${centerCard.name}」：上方显见为「${topCard.name}」，下方根基为「${bottomCard.name}」，左侧起因为「${leftCard.name}」，右侧趋势为「${rightCard.name}」`;
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
