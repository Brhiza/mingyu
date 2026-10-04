/**
 * 九星与落宫的五行关系。
 *
 * 本宫是九星的固定位置事实；星宫生克是位置关系，不能代替按月令判断的
 * 九星旺相休囚废。主客含义由具体占题与盘面另行判断。
 */

import { starElements, isGenerating, isControlling } from './_constants';
import { WUXING } from '../../../../wuxing';
import { getTianPanStars, hasTianPanStar } from './palace-utils';

const WUXING_ELEMENTS = new Set<string>(WUXING);

/** 九星本宫映射。 */
export const STAR_ORIGINAL_PALACES: Record<string, number> = {
  天蓬: 1,
  天芮: 2,
  天冲: 3,
  天辅: 4,
  天禽: 5,
  天心: 6,
  天柱: 7,
  天任: 8,
  天英: 9,
};

export type StarPalaceRelation = '星宫比和' | '宫生星' | '星生宫' | '星克宫' | '宫克星';

export interface StarPalaceResult {
  star: string;
  originalPalace: number;
  gong: number;
  atOriginalPalace: boolean;
  relation: StarPalaceRelation;
  detail: string;
}

export interface StarPalaceInput {
  jiuGongGe: Array<{
    gong: number;
    element: string;
    tianPan: { star: string; companionStar?: string };
  }>;
}

export interface ZhiFuPalaceInput extends StarPalaceInput {
  zhiFu: string;
}

/** 按星与落宫五行记录关系，不推定九星的月令旺衰。 */
export function evaluateSingleStar(
  star: string,
  currentGong: number,
  palaceElement: string,
): StarPalaceResult {
  const starElement = starElements[star];
  const originalPalace = STAR_ORIGINAL_PALACES[star];

  if (!starElement) {
    throw new Error(`九星 "${star}" 无法识别，不能评估星宫关系。`);
  }
  if (!originalPalace) {
    throw new Error(`九星 "${star}" 缺少本宫映射，不能评估星宫关系。`);
  }
  if (!Number.isInteger(currentGong) || currentGong < 1 || currentGong > 9) {
    throw new Error(`宫位 "${currentGong}" 无效，必须是 1-9 的整数。`);
  }
  if (!WUXING_ELEMENTS.has(palaceElement)) {
    throw new Error(`宫位五行 "${palaceElement}" 无法识别，不能评估星宫关系。`);
  }

  let relation: StarPalaceRelation;
  if (starElement === palaceElement) {
    relation = '星宫比和';
  } else if (isGenerating(palaceElement, starElement)) {
    relation = '宫生星';
  } else if (isGenerating(starElement, palaceElement)) {
    relation = '星生宫';
  } else if (isControlling(starElement, palaceElement)) {
    relation = '星克宫';
  } else if (isControlling(palaceElement, starElement)) {
    relation = '宫克星';
  } else {
    throw new Error(`九星 "${star}" 与宫位五行 "${palaceElement}" 的关系无法识别。`);
  }

  const atOriginalPalace = currentGong === originalPalace;
  const detail = `${star}落${currentGong}宫，${relation}${atOriginalPalace ? '，归本宫' : ''}`;
  return { star, originalPalace, gong: currentGong, atOriginalPalace, relation, detail };
}

/** 逐宫记录天盘九星与落宫的五行关系。 */
export function evaluateStarPalaces(result: StarPalaceInput): StarPalaceResult[] {
  const results: StarPalaceResult[] = [];
  for (const palace of result.jiuGongGe) {
    for (const star of getTianPanStars(palace)) {
      results.push(evaluateSingleStar(star, palace.gong, palace.element));
    }
  }
  if (results.length !== 9) {
    throw new Error(`整盘应有九星，实际读取到 ${results.length} 星。`);
  }
  return results;
}

/** 查找值符星落宫，并返回同一星宫位置事实。 */
export function getZhiFuStarPalaceFact(result: ZhiFuPalaceInput): StarPalaceResult {
  const { jiuGongGe, zhiFu } = result;
  if (!zhiFu) {
    throw new Error('值符星不能为空。');
  }
  if (!STAR_ORIGINAL_PALACES[zhiFu]) {
    throw new Error(`值符星 "${zhiFu}" 无法识别。`);
  }
  const palace = jiuGongGe.find((item) => hasTianPanStar(item, zhiFu));
  if (!palace) {
    throw new Error(`找不到值符星 "${zhiFu}" 的落宫。`);
  }
  return evaluateSingleStar(zhiFu, palace.gong, palace.element);
}
