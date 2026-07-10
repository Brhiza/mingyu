/**
 * @file Bazi Definitions
 * @description This file contains the static definitions for various Bazi concepts,
 * such as ShenSha (Symbolic Stars) and Ten Gods (ShiShen).
 * It serves as a centralized "knowledge base" to be used across the application.
 */

import { SHICHEN_PERIODS } from '../calendar/dateUtils';

// 兼容八字旧名，实际由公共日历时辰目录派生。
export const TIME_MAP = SHICHEN_PERIODS.map(({ index, name, range, hour }) => ({
  index,
  name,
  range,
  hour,
}));

// 五行强弱计算权重
export const WUXING_STRENGTH_SCORES = {
  tianGan: 12,
  diZhiBenQi: 12,
  diZhiZhongQi: 6,
  diZhiYuQi: 3,
};

// 月令对五行强弱的影响权重
export const WUXING_MONTH_WEIGHTS: Record<string, Record<string, number>> = {
  寅: { 木: 2.0, 火: 1.5, 水: 1.2, 金: 0.8, 土: 0.6 },
  卯: { 木: 2.2, 火: 1.6, 水: 1.1, 金: 0.7, 土: 0.5 },
  辰: { 土: 2.0, 金: 1.5, 火: 1.2, 木: 0.8, 水: 0.6 },
  巳: { 火: 2.0, 土: 1.5, 木: 1.2, 水: 0.8, 金: 0.6 },
  午: { 火: 2.2, 土: 1.6, 木: 1.1, 水: 0.7, 金: 0.5 },
  未: { 土: 2.0, 金: 1.5, 火: 1.2, 木: 0.8, 水: 0.6 },
  申: { 金: 2.0, 水: 1.5, 土: 1.2, 火: 0.8, 木: 0.6 },
  酉: { 金: 2.2, 水: 1.6, 土: 1.1, 火: 0.7, 木: 0.5 },
  戌: { 土: 2.0, 金: 1.5, 火: 1.2, 木: 0.8, 水: 0.6 },
  亥: { 水: 2.0, 木: 1.5, 金: 1.2, 土: 0.8, 火: 0.6 },
  子: { 水: 2.2, 木: 1.6, 金: 1.1, 土: 0.7, 火: 0.5 },
  丑: { 土: 2.0, 金: 1.5, 火: 1.2, 木: 0.8, 水: 0.6 },
};
