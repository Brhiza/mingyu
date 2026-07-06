/**
 * @file Bazi Definitions
 * @description This file contains the static definitions for various Bazi concepts,
 * such as ShenSha (Symbolic Stars) and Ten Gods (ShiShen).
 * It serves as a centralized "knowledge base" to be used across the application.
 */

// 时辰信息
export const TIME_MAP = [
  { index: 0, name: '早子时', range: '00:00-01:00', hour: 0 },
  { index: 1, name: '丑时', range: '01:00-03:00', hour: 1 },
  { index: 2, name: '寅时', range: '03:00-05:00', hour: 3 },
  { index: 3, name: '卯时', range: '05:00-07:00', hour: 5 },
  { index: 4, name: '辰时', range: '07:00-09:00', hour: 7 },
  { index: 5, name: '巳时', range: '09:00-11:00', hour: 9 },
  { index: 6, name: '午时', range: '11:00-13:00', hour: 11 },
  { index: 7, name: '未时', range: '13:00-15:00', hour: 13 },
  { index: 8, name: '申时', range: '15:00-17:00', hour: 15 },
  { index: 9, name: '酉时', range: '17:00-19:00', hour: 17 },
  { index: 10, name: '戌时', range: '19:00-21:00', hour: 19 },
  { index: 11, name: '亥时', range: '21:00-23:00', hour: 21 },
  { index: 12, name: '晚子时', range: '23:00-24:00', hour: 23 },
];

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
