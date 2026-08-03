import type { SsgwData } from '../../types/divination';
import { SSGW_SIGNS } from '../../divination/ssgw-data';
import { getDivinationTime } from '../../calendar/timeManager';
import type { RandomOptions } from '../../shared/random';
import { createRandomContext, randomInt } from '../../shared/random';
import { attachResultMeta } from '../../shared/result';

/**
 * @file 灵签抽签算法（神算鬼谋）
 * @description 从签文中随机抽取一条作为占卜结果，只保留签号、签题、签诗与求签时间。
 */

const ssgwSigns = SSGW_SIGNS.map((sign) => ({
  number: sign.id,
  title: sign.title,
  poem: sign.qianwen,
}));

/**
 * 随机求签：从三山国王 92 支签文中随机抽取一条，并附带求签时间的干支和 Unix 时间戳。
 */
export function drawRandomSign(options?: RandomOptions): SsgwData;
export function drawRandomSign(customDate?: Date, options?: RandomOptions): SsgwData;
export function drawRandomSign(
  customDateOrOptions?: Date | RandomOptions,
  options?: RandomOptions,
): SsgwData {
  const customDate = customDateOrOptions instanceof Date ? customDateOrOptions : undefined;
  const randomOptions =
    customDateOrOptions instanceof Date ? options : (customDateOrOptions ?? options);
  const { ganzhi, timestamp } = getDivinationTime(customDate);
  const context = createRandomContext(randomOptions);
  const randomIndex = randomInt(ssgwSigns.length, context.random);
  const sign = ssgwSigns[randomIndex];
  const base = attachResultMeta(
    {
      ...sign,
      timestamp,
      ganzhi,
      draw: {
        method: 'random' as const,
        poolSize: ssgwSigns.length,
        selectedIndex: randomIndex,
        selectedNumber: sign.number,
      },
    },
    {
      algorithm: 'ssgw.draw',
      input: { timestamp },
      calculatedAt: timestamp,
      random: context.getTrace(),
    },
  );
  return base;
}

/** 按用户已取得的签号查出签文。 */
export function resolveSignByNumber(number: number, customDate?: Date): SsgwData {
  if (!Number.isInteger(number) || number < 1 || number > ssgwSigns.length) {
    throw new Error(`签号需为1至${ssgwSigns.length}的整数`);
  }
  const sign = ssgwSigns.find((item) => item.number === number);
  if (!sign) {
    throw new Error(`未找到第${number}签`);
  }
  const { ganzhi, timestamp } = getDivinationTime(customDate);
  const base = attachResultMeta(
    {
      ...sign,
      timestamp,
      ganzhi,
      draw: {
        method: 'manual' as const,
        poolSize: ssgwSigns.length,
        selectedIndex: null,
        selectedNumber: sign.number,
      },
    },
    {
      algorithm: 'ssgw.resolve.manual',
      input: { number, timestamp },
      calculatedAt: timestamp,
    },
  );
  return base;
}
