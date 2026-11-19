import data from '../huangji-hexagrams.json';

export { trigrams } from '../trigrams';
export const hexagrams = data.map((item) => ({
  number: item.id, name: item.name, symbol: item.symbol, description: item.description,
  yaoCi: item.yaoCi, yongCi: item.id === 1 ? '见群龙无首，吉' : item.id === 2 ? '利永贞' : undefined,
}));
