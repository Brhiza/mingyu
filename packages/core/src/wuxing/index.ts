/**
 * @file 五行生克模块（地基层）
 * @description 五行生克乘侮、旺相休囚死、五行强度统计等可复用基础能力。
 *
 * 深度整合 tyme4ts：五行生克（生我/我生/克我/我克）委托 tyme4ts 的 `Element`
 * （权威经典实现）；旺相休囚死(getSeasonState)、五行强度统计(tallyWuxing)保留本库实现。
 */
import { Element } from 'tyme4ts';
import {
  BRANCH_WUXING,
  MONTH_LING_WUXING,
  getSeasonState,
  getBranchWuxing,
  STEM_ORDER,
  BRANCH_ORDER,
  BRANCH_HIDDEN_STEMS,
} from '../divination/algorithms/_shared/wuxing';
import { STEM_WUXING } from '../ganzhi/data';

/** 五行相生：a 生 b？委托 tyme4ts Element */
export function isSheng(a: string, b: string): boolean {
  return Element.fromName(a).getReinforce().getName() === b;
}

/** 五行相克：a 克 b？委托 tyme4ts Element */
export function isKe(a: string, b: string): boolean {
  return Element.fromName(a).getRestrain().getName() === b;
}

export { BRANCH_WUXING, MONTH_LING_WUXING, getSeasonState, getBranchWuxing };

const WUXING_LIST = ['木', '火', '土', '金', '水'] as const;

/**
 * 统计一组干支的五行分布
 * @param items 天干或地支数组（混合亦可）
 * @param options.weightHidden 是否把地支藏干计入（本气权重 1，中气 0.5，余气 0.3）
 * @returns 各五行加权计数
 */
export function tallyWuxing(
  items: string[],
  options: { weightHidden?: boolean } = {},
): Record<string, number> {
  const result: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const item of items) {
    if (STEM_ORDER.includes(item as (typeof STEM_ORDER)[number])) {
      const w = STEM_WUXING[item];
      if (w) result[w] += 1;
    } else if (BRANCH_ORDER.includes(item as (typeof BRANCH_ORDER)[number])) {
      const main = BRANCH_WUXING[item];
      if (main) result[main] += 1;
      if (options.weightHidden) {
        const hidden = BRANCH_HIDDEN_STEMS[item] || [];
        const weights = [1, 0.5, 0.3];
        hidden.forEach((stem, i) => {
          const w = STEM_WUXING[stem];
          if (w) result[w] += weights[i] ?? 0.3;
        });
      }
    }
  }
  return result;
}

export interface WuxingStrengthProfile {
  /** 各五行计数 */
  counts: Record<string, number>;
  /** 最强五行 */
  dominant: string;
  /** 最弱五行 */
  weakest: string;
  /** 五行是否缺失 */
  lacking: string[];
}

/** 生成五行强弱画像（仅统计，不含日主旺衰判定） */
export function getWuxingStrengthProfile(items: string[]): WuxingStrengthProfile {
  const counts = tallyWuxing(items, { weightHidden: true });
  let dominant: string = WUXING_LIST[0];
  let weakest: string = WUXING_LIST[0];
  let max = -Infinity;
  let min = Infinity;
  for (const w of WUXING_LIST) {
    if (counts[w] > max) {
      max = counts[w];
      dominant = w;
    }
    if (counts[w] < min) {
      min = counts[w];
      weakest = w;
    }
  }
  const lacking = WUXING_LIST.filter((w) => counts[w] === 0);
  return { counts, dominant, weakest, lacking };
}

export const wuxing = {
  isSheng,
  isKe,
  getSeasonState,
  getBranchWuxing,
  tallyWuxing,
  getWuxingStrengthProfile,
};
