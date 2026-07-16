import type { QimenData } from '../../../../types/divination';

export interface QimenPriorityPalace {
  gong: number;
  name: string;
  score: number;
  reasons: string[];
}

export function createQimenPriorityPalaces(data: QimenData): QimenPriorityPalace[] {
  const palaceMap = new Map<number, QimenPriorityPalace>();

  const ensurePalace = (gong: number): QimenPriorityPalace | null => {
    const found = data.jiuGongGe.find((item) => item.gong === gong);
    if (!found) {
      return null;
    }

    const existing = palaceMap.get(gong);
    if (existing) {
      return existing;
    }

    const created: QimenPriorityPalace = {
      gong,
      name: found.name,
      score: 0,
      reasons: [],
    };
    palaceMap.set(gong, created);
    return created;
  };

  const addReason = (gong: number, score: number, reason: string) => {
    const palace = ensurePalace(gong);
    if (!palace) {
      return;
    }
    palace.score += score;
    palace.reasons.push(reason);
  };

  data.palaceInsights?.forEach((insight) => {
    addReason(insight.gong, getInsightScore(insight.level), `${insight.level}:${insight.summary}`);
  });

  data.classicPatterns?.forEach((pattern) => {
    const score = getPatternPriority(pattern.type);
    pattern.palaces.forEach((gong) => {
      addReason(gong, score, `${pattern.type === 'bad' ? '凶格' : '格局'}:${pattern.name}`);
    });
  });

  data.stemRelations?.forEach((relation) => {
    if (!relation.pattern) {
      return;
    }
    addReason(relation.gong, 12, `干关系:${relation.pattern}`);
  });

  data.directions?.goodDirections.forEach((direction) => {
    addReason(direction.gong, 8, `吉方:${direction.direction}`);
  });
  data.directions?.avoidDirections.forEach((direction) => {
    addReason(direction.gong, 8, `避方:${direction.direction}`);
  });

  return Array.from(palaceMap.values())
    .map((item) => ({
      ...item,
      reasons: Array.from(new Set(item.reasons)),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.gong - b.gong;
    });
}

function getInsightScore(level: '有利' | '风险' | '关注'): number {
  switch (level) {
    case '关注':
      return 28;
    case '有利':
      return 24;
    case '风险':
      return 20;
  }
}

function getPatternPriority(type: 'good' | 'bad' | 'neutral'): number {
  return type === 'neutral' ? 12 : 18;
}
