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

// 底层能力（可复用、可继续拓展）
export * as ganzhi from './ganzhi/index';
export * as wuxing from './wuxing/index';
export * as direction from './direction/index';
export * as shensha from './shensha/index';
export * as foundation from './foundation/index';
export * as profile from './profile/index';
export * as capabilities from './capabilities/index';
export * as result from './shared/result';
export * as random from './shared/random';
export * as promptEvidence from './prompt-evidence/index';
export * as prompt from './prompt/index';

// 新增术数系统
export * as bazhai from './ba_zhai/index';
export * as zodiac from './zodiac/index';
export * as taiyi from './taiyi/index';
export * as qizheng from './qi_zheng/index';
export * as xuankong from './xuan_kong/index';
export * as residentialFengshui from './residential_fengshui/index';
export * as wuyunLiuqi from './wuyun-liuqi/index';
export * as huangjiJingshi from './huangji-jingshi/index';
export * as location from './location/index';
export * as birth from './birth/index';
export * as compatibility from './compatibility/index';
export * as synthesis from './synthesis/index';
export * as client from './client/index';
export * as consumption from './consumption/index';

// 全局配置
export { configure } from './calendar/timeManager';
export {
  SYSTEM_CAPABILITY_IDS,
  getCapabilities,
  getSystemCapability,
  requireSystemCapability,
} from './capabilities/index';
export * from './profile/index';
export * from './birth/index';
export * from './compatibility/index';
export * from './synthesis/index';
export * from './client/index';
export * from './consumption/index';
export type * from './capabilities/index';
export * from './shared/result';

// Re-export shared types
export type * from './types/index';
