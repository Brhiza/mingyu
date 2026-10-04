/**
 * @file Bazi Definitions
 * @description This file contains the static definitions for various Bazi concepts,
 * such as ShenSha (Symbolic Stars) and Ten Gods (ShiShen).
 * It serves as a centralized "knowledge base" to be used across the application.
 */

import { SHICHEN_PERIODS } from '../calendar/dateUtils';

// 兼容八字旧名，实际由公共日历时辰目录派生。
const CANONICAL_TIME_MAP = SHICHEN_PERIODS.map(({ index, name, range, hour, minute }) => ({
  index,
  name,
  range,
  hour,
  minute,
}));

export const TIME_MAP = CANONICAL_TIME_MAP.map((period) => ({ ...period }));

/** 返回固定时辰目录的独立副本。 */
export function getBaziTimePeriods() {
  return CANONICAL_TIME_MAP.map((period) => ({ ...period }));
}
