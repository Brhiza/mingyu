import type { QimenData } from '../../../../types/divination';

export interface QimenPriorityPalace {
  gong: number;
  name: string;
  /** @deprecated 旧版排序兼容字段，固定为 0；重点宫位不再按总分判断。 */
  score: number;
  reasons: string[];
}

/**
 * 汇总需要重点查看的宫位。
 *
 * 输出顺序是可解释的证据来源顺序：值符相关洞察、值使/其他有利洞察、风险洞察、
 * 经典格局、天地盘干关系、方位事实。这里只归集候选，不把不同性质的证据换算为总分。
 */
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

  const addReason = (gong: number, reason: string) => {
    const palace = ensurePalace(gong);
    if (!palace) {
      return;
    }
    if (!palace.reasons.includes(reason)) {
      palace.reasons.push(reason);
    }
  };

  const insights = data.palaceInsights ?? [];
  for (const level of ['关注', '有利', '风险'] as const) {
    insights
      .filter((insight) => insight.level === level)
      .forEach((insight) => addReason(insight.gong, `${insight.level}:${insight.summary}`));
  }

  data.classicPatterns?.forEach((pattern) => {
    pattern.palaces.forEach((gong) => {
      addReason(gong, `${pattern.type === 'bad' ? '凶格' : '格局'}:${pattern.name}`);
    });
  });

  data.stemRelations?.forEach((relation) => {
    if (!relation.pattern) {
      return;
    }
    addReason(relation.gong, `干关系:${relation.pattern}`);
  });

  data.directions?.goodDirections.forEach((direction) => {
    addReason(direction.gong, `吉方:${direction.direction}`);
  });
  data.directions?.avoidDirections.forEach((direction) => {
    addReason(direction.gong, `避方:${direction.direction}`);
  });

  return Array.from(palaceMap.values());
}

/**
 * 依据《烟波钓叟歌》“吉格逢迫吉不就，凶格逢制灾不侵”的格局成破与空迫制化实效判定
 */
export function evaluateQimenPatternFulfillment(data: QimenData): string[] {
  const results: string[] = [];
  const voidGongs = new Set(data.voidPalaces?.map((p) => p.palace) ?? []);
  const patterns = data.classicPatterns ?? [];
  const tags = data.patternTags ?? [];

  // 获取门迫宫位
  const menPoGongs = new Set<number>();
  tags.forEach((tag) => {
    if (tag.startsWith('门迫')) {
      const match = tag.match(/（(.*)）/);
      if (match) {
        const palace = data.jiuGongGe.find((p) => match[1].includes(p.name));
        if (palace) menPoGongs.add(palace.gong);
      }
    }
  });

  patterns.forEach((p) => {
    p.palaces.forEach((gong) => {
      const palace = data.jiuGongGe.find((item) => item.gong === gong);
      if (!palace) return;
      const isVoid = voidGongs.has(gong);
      const isMenPo = menPoGongs.has(gong);

      if (p.type === 'good' || p.type === 'neutral') {
        if (isMenPo && isVoid) {
          results.push(`【${p.name}】落${palace.name}逢门迫兼空亡，吉力大损虚化，反招尤烦`);
        } else if (isMenPo) {
          results.push(`【${p.name}】落${palace.name}逢门迫受制，吉力难畅`);
        } else if (isVoid) {
          results.push(`【${p.name}】落${palace.name}逢空亡，吉景虚浮`);
        }
      } else if (p.type === 'bad') {
        if (isVoid) {
          results.push(`【${p.name}】落${palace.name}逢空亡，凶势落空，灾咎减半`);
        }
      }
    });
  });

  return results;
}
