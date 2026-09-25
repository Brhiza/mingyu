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

interface QimenPatternCondition {
  name: string;
  type: 'good' | 'bad' | 'neutral';
  gong: number;
  palaceName: string;
  conditions: string[];
}

function collectQimenPatternConditions(data: QimenData): QimenPatternCondition[] {
  const voidGongs = new Set(data.voidPalaces?.map((p) => p.palace) ?? []);
  const patterns = data.classicPatterns ?? [];
  const menPoGongs = new Set(patterns.filter((p) => p.name === '门迫').flatMap((p) => p.palaces));
  for (const tag of data.patternTags ?? []) {
    if (!tag.startsWith('门迫')) continue;
    const names = tag.match(/（(.*)）/)?.[1];
    if (names)
      for (const palace of data.jiuGongGe) {
        if (names.includes(palace.name)) menPoGongs.add(palace.gong);
      }
  }
  const results: QimenPatternCondition[] = [];
  for (const pattern of patterns) {
    for (const gong of pattern.palaces) {
      const palace = data.jiuGongGe.find((item) => item.gong === gong);
      if (!palace) continue;
      const conditions = [
        voidGongs.has(gong) ? '空亡' : '',
        menPoGongs.has(gong) ? '门迫' : '',
      ].filter(Boolean);
      if (conditions.length) {
        results.push({
          name: pattern.name,
          type: pattern.type,
          gong,
          palaceName: palace.name,
          conditions,
        });
      }
    }
  }
  return results;
}

/** 保留同宫格局及空迫条件，区分结构身份与落实判断。 */
export function evaluateQimenPatternFulfillment(data: QimenData): string[] {
  return collectQimenPatternConditions(data).map(({ name, type, palaceName, conditions }) => {
    const identity = type === 'good' ? '吉格' : type === 'bad' ? '凶格' : '中性格局';
    return `【${name}】落${palaceName}，属${identity}，同宫见${conditions.join('、')}。`;
  });
}

/** 提示词按宫保留实际空迫叠加；格局名称与吉凶身份由索引承载。 */
export function formatQimenPatternConditionSummary(data: QimenData): string[] {
  const affectedPatterns = new Map<
    number,
    {
      palaceName: string;
      conditions: Set<string>;
    }
  >();
  for (const item of collectQimenPatternConditions(data)) {
    if (item.name === '门迫') continue;
    const group = affectedPatterns.get(item.gong) ?? {
      palaceName: item.palaceName,
      conditions: new Set<string>(),
    };
    item.conditions.forEach((condition) => group.conditions.add(condition));
    affectedPatterns.set(item.gong, group);
  }
  return [...affectedPatterns.values()].map(
    (group) => `${group.palaceName}同宫见${[...group.conditions].join('、')}`,
  );
}
