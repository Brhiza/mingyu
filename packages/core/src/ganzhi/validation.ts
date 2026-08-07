/**
 * 干支与五行基础输入校验。
 *
 * 所有上层术数共用同一套合法值，避免各模块自行维护列表后出现口径分叉。
 */
import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  SIXTY_CYCLE,
  type EarthlyBranch,
  type HeavenlyStem,
} from './data';

export const WUXING_VALUES = ['木', '火', '土', '金', '水'] as const;
export type WuxingValue = (typeof WUXING_VALUES)[number];

export function isHeavenlyStem(value: unknown): value is HeavenlyStem {
  return typeof value === 'string' && (HEAVENLY_STEMS as readonly string[]).includes(value);
}

export function isEarthlyBranch(value: unknown): value is EarthlyBranch {
  return typeof value === 'string' && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

export function isWuxing(value: unknown): value is WuxingValue {
  return typeof value === 'string' && (WUXING_VALUES as readonly string[]).includes(value);
}

/** 是否为真实存在的六十甲子，而非任意合法天干、地支的拼接。 */
export function isValidGanZhi(value: unknown): value is string {
  return typeof value === 'string' && value.length === 2 && SIXTY_CYCLE.includes(value);
}

export function isGanZhiPair(gan: unknown, zhi: unknown): boolean {
  return isHeavenlyStem(gan) && isEarthlyBranch(zhi) && isValidGanZhi(`${gan}${zhi}`);
}

export function assertHeavenlyStem(value: unknown, label = '天干'): asserts value is HeavenlyStem {
  if (!isHeavenlyStem(value)) {
    throw new Error(`${label}无效：${String(value)}`);
  }
}

export function assertEarthlyBranch(
  value: unknown,
  label = '地支',
): asserts value is EarthlyBranch {
  if (!isEarthlyBranch(value)) {
    throw new Error(`${label}无效：${String(value)}`);
  }
}

export function assertWuxing(value: unknown, label = '五行'): asserts value is WuxingValue {
  if (!isWuxing(value)) {
    throw new Error(`${label}无效：${String(value)}`);
  }
}

export function assertValidGanZhi(value: unknown, label = '干支'): asserts value is string {
  if (!isValidGanZhi(value)) {
    throw new Error(`${label}组合无效：${String(value)}`);
  }
}

export function assertGanZhiPair(gan: unknown, zhi: unknown, label = '干支'): void {
  assertHeavenlyStem(gan, `${label}天干`);
  assertEarthlyBranch(zhi, `${label}地支`);
  if (!isGanZhiPair(gan, zhi)) {
    throw new Error(`${label}不是有效六十甲子：${gan}${zhi}`);
  }
}
