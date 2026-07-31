import type { UsefulGodPlacementProfile } from '../types/analysis';

/**
 * 旧用神落点规则依赖未校勘的自动喜忌输入，正式入口固定失败关闭。
 * 保留函数签名仅用于兼容既有调用，任何传入喜忌都不会生成落点结论。
 */
export function analyzeUsefulGodPlacement(
  _pillars: Array<{ gan: string; zhi: string }>,
  _dayMaster: string,
  _getTenGod: (g: string, d: string) => string,
  _favorableWuxing: string[],
  _unfavorableWuxing: string[],
): UsefulGodPlacementProfile {
  return {
    items: [],
    favorableCount: 0,
    unfavorableCount: 0,
    summary: '自动用神落点规则已关闭',
  };
}
