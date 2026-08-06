/**
 * @file Divination algorithms barrel
 */
export * as liuyao from './algorithms/liuyao';
export * as xiaoliuren from './algorithms/xiaoliuren';
export * as jinkoujue from './algorithms/jinkoujue';
export * as meihua from './algorithms/meihua/index';
export * as qimen from './algorithms/qimen/index';
export * as liuren from './algorithms/liuren/index';
export * as almanac from './algorithms/almanac';
export * as ssgw from './algorithms/ssgw';
export * as lenormand from './algorithms/lenormand';
export * as astrolabe from './algorithms/astrolabe';
export * as astrolabeScope from './astrolabe-scope';

export * from './config';
export * from './engine/liuyao-template';
export * from './engine/liuren-template';
export * from './engine/method-text';
export * from './astrolabe-scope';
export * from './astrolabe-synastry';
export * from './session';
export * from './ssgw-content';

// 结果摘要与提示词编排属于框架无关的核心能力，供已有结果直接复用。
export {
  buildDivinationPrompt,
  buildDivinationPromptDocument,
  formatDivinationInfo,
  formatDivinationSolarTime,
  formatDivinationTime,
  getDivinationSummaryBlocks,
} from '../prompt/divination';
export type { DivinationPromptOptions, DivinationSummaryBlocks } from '../prompt/divination';

export type * from '../types/index';
