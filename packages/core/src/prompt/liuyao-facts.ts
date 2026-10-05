import type { LiuyaoData } from '../types/divination';

export function formatLiuyaoSanxing(items: NonNullable<LiuyaoData['sanxingInYaos']>): string {
  return items
    .map(({ branches, type }) => {
      const present = [...new Set(branches)];
      if (present.length === 1) return `${present[0]}自刑`;
      return `${present.join('、')}${present.length === 3 ? '三刑齐备' : '相刑'}（${type}）`;
    })
    .join('；');
}
