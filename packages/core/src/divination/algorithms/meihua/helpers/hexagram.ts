import { hexagramsData, trigramsByIndex } from '../../../../divination/hexagram-data';

const hexagrams = hexagramsData.map((hex) => ({
  number: hex.id,
  name: hex.name,
  symbol: hex.symbol,
  description: hex.description,
  yaoCi: hex.yaoCi,
  yongCi: hex.yongCi,
}));

export function resolveTiYongByMovingYao<
  T extends { name: string; element: string; nature: string },
>(upper: T, lower: T, movingYaoIndex: number) {
  if (!Number.isInteger(movingYaoIndex) || movingYaoIndex < 1 || movingYaoIndex > 6) {
    throw new Error(`动爻位置必须在 1-6 之间，当前为 ${movingYaoIndex}。`);
  }

  if (movingYaoIndex > 3) {
    return {
      tiGua: lower,
      yongGua: upper,
    };
  }

  return {
    tiGua: upper,
    yongGua: lower,
  };
}

/**
 * 根据上下经卦的索引号，查找对应的大成卦（六十四卦之一）
 * @param upper 上卦索引 (1-8)
 * @param lower 下卦索引 (1-8)
 * @returns 对应的大成卦对象
 */
export function findHexagramByTrigrams(upper: number, lower: number) {
  if (!Number.isInteger(upper) || upper < 1 || upper > 8) {
    throw new Error(`上卦索引必须在 1-8 之间，当前为 ${upper}。`);
  }
  if (!Number.isInteger(lower) || lower < 1 || lower > 8) {
    throw new Error(`下卦索引必须在 1-8 之间，当前为 ${lower}。`);
  }

  const upperIndex = upper;
  const lowerIndex = lower;

  const upperTrigram = trigramsByIndex[upperIndex];
  const lowerTrigram = trigramsByIndex[lowerIndex];
  if (!upperTrigram || !lowerTrigram) {
    throw new Error(`无法根据上下卦索引 (${upper}, ${lower}) 找到对应八卦。`);
  }
  const hexagram = hexagrams.find(
    (h) => h.symbol === `${upperTrigram.symbol}${lowerTrigram.symbol}`,
  );
  if (!hexagram) {
    throw new Error(`未能匹配到符号为 "${upperTrigram.symbol}${lowerTrigram.symbol}" 的六十四卦。`);
  }

  return hexagram;
}
