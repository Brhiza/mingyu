import type { QimenData } from '../types/divination';

interface QimenPriorityPalace {
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

  data.palaceInsights?.forEach((insight) => {
    const palace = ensurePalace(insight.gong);
    if (!palace) return;
    palace.score += getInsightScore(insight.level);
    palace.reasons.push(`${insight.level}:${insight.summary}`);
  });

  data.patternDetails?.forEach((detail) => {
    const matchedPalaces = data.jiuGongGe.filter(
      (gong) => detail.tag.includes(`（${gong.name}`) || detail.tag.includes(`落${gong.name}`),
    );
    matchedPalaces.forEach((gong) => {
      const palace = ensurePalace(gong.gong);
      if (!palace) return;
      palace.score += 15;
      palace.reasons.push(detail.tag);
    });
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
    default:
      return 0;
  }
}
