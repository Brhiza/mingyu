/**
 * mingyu-core
 * Mingyu core algorithms for traditional Chinese metaphysics.
 *
 * This package provides algorithmic implementations of:
 * - 八字 (Bazi / Four Pillars of Destiny)
 * - 奇门遁甲 (Qimen Dunjia / Mysterious Gate)
 * - 六爻 (Liuyao / Six Lines)
 * - 梅花易数 (Meihua Yishu / Plum Blossom Divination)
 * - 大六壬 (Da Liuren / Great Six Ren)
 * - 小六壬 (Xiao Liuren / Small Six Ren)
 * - 紫微斗数 (Ziwei Doushu / Purple Star Astrology)
 * - 西洋占星 (Western Astrology)
 * - 雷诺曼 (Lenormand)
 * - 塔罗 (Tarot)
 * - 择日 (Almanac / Day Selection)
 *
 * @packageDocumentation
 */

export * as bazi from './bazi/index';
export * as calendar from './calendar/index';
export * as divination from './divination/index';

// 全局配置
export { configure } from './calendar/timeManager';

// Re-export shared types
export type * from './types/index';
