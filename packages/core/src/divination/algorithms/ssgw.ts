import type { SsgwData } from '../../types/divination';
import { SSGW_SIGNS } from '../../divination/ssgw-data';
import { getDivinationTime } from '../../calendar/timeManager';

/**
 * @file 灵签抽签算法（神算鬼谋）
 * @description 从签文中随机抽取一条作为占卜结果，配合签诗、典故进行解读。
 * @注意 此文件实现的是**随机抽签求签**功能，并非大六壬「金口诀」算法。
 *        金口诀（大六壬金口诀）的完整排盘与断课在项目中另有实现。
 *        本文件名沿用历史命名，功能定位为灵签/神签抽签系统。
 */

const ssgwSigns: Omit<SsgwData, 'ganzhi' | 'timestamp'>[] = SSGW_SIGNS.map((sign) => ({
  number: sign.id,
  title: sign.title,
  poem: sign.qianwen,
  story: sign.story,
  details: sign.details,
}));

/**
 * 随机求签 - 模拟真实的求签过程
 *
 * 从三山国王 92 支签文中随机抽取一条作为占卜结果，
 * 自动附带求签时间的干支和 Unix 时间戳。
 *
 * @param customDate 自定义求签时间（可选），不传则使用当前时间。
 *   传入后签文结果的 `ganzhi` 和 `timestamp` 会基于该时间生成。
 * @returns 完整的签文结果 SsgwData，包含签号、标题、签诗、典故、详解和求签时间干支。
 *
 * @example
 * ```ts
 * // 当前时间求签
 * const sign = drawRandomSign();
 *
 * // 指定时间求签
 * const sign = drawRandomSign(new Date('2025-06-15T10:00:00'));
 * ```
 */
export function drawRandomSign(customDate?: Date): SsgwData {
  const { ganzhi, timestamp } = getDivinationTime(customDate);
  const randomIndex = Math.floor(Math.random() * ssgwSigns.length);
  const sign = ssgwSigns[randomIndex];
  return {
    ...sign,
    timestamp,
    ganzhi,
  };
}
