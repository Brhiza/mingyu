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

/** 保留同宫格局及空迫条件，区分结构身份与落实判断。 */
export function evaluateQimenPatternFulfillment(data: QimenData): string[] {
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
  const results: string[] = [];
  for (const pattern of patterns)
    for (const gong of pattern.palaces) {
      const palace = data.jiuGongGe.find((item) => item.gong === gong);
      if (!palace) continue;
      const conditions = [
        voidGongs.has(gong) ? '空亡' : '',
        menPoGongs.has(gong) ? '门迫' : '',
      ].filter(Boolean);
      if (!conditions.length) continue;
      const identity =
        pattern.type === 'good' ? '吉格' : pattern.type === 'bad' ? '凶格' : '中性格局';
      results.push(
        `【${pattern.name}】落${palace.name}，属${identity}，同宫见${conditions.join('、')}；结合本次用神与宫门星神，分别核对结果、程度和落实迟速，空亡填实与门宫制约各明条件。`,
      );
    }
  return results;
}
