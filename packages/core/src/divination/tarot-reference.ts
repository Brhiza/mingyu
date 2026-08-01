import { tarotCards } from './tarot-data';

/**
 * 当前只校验项目内部 1 至 78 的连续牌号与牌名唯一性。
 *
 * 旧关键词、正逆位牌义、元素和牌阶主题没有逐牌对应到具体牌组版本、原文与页码，
 * 在完成版本校勘前失败关闭，不得作为公开解释依据。
 */
export function validateTarotReferenceData(): void {
  const ids = tarotCards.map((card) => card.number);
  const names = tarotCards.map((card) => card.name);
  if (
    tarotCards.length !== 78 ||
    ids.some((id, index) => id !== index + 1) ||
    new Set(ids).size !== 78 ||
    new Set(names).size !== 78
  ) {
    throw new Error('塔罗牌组必须按项目内部编号 1-78 完整登记且牌号、牌名不重复');
  }
}

validateTarotReferenceData();

/** @deprecated 逐牌关键词来源尚未闭合，公开调用只返回空值。 */
export function getCardKeywords(cardName: string): string {
  if (!tarotCards.some((card) => card.name === cardName)) {
    throw new Error(`未知的塔罗牌名: ${cardName}`);
  }
  return '';
}

/** 只返回失败关闭后的空解释字段，供既有数据结构兼容。 */
export function getCardEvidence(cardName: string) {
  getCardKeywords(cardName);
  return {
    keywords: [] as string[],
    uprightMeaning: '',
    reversedMeaning: '',
    element: '',
    archetype: '',
  };
}
