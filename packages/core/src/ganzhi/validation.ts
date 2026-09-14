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

/**
 * 八字月柱的五虎遁起月干。正月固定从寅支开始，之后每月顺排一干。
 * 甲己丙作首，乙庚戊为首，丙辛庚为首，丁壬壬为首，戊癸甲为首。
 */
const FIRST_MONTH_STEM_BY_YEAR_STEM: Record<HeavenlyStem, HeavenlyStem> = {
  甲: '丙',
  乙: '戊',
  丙: '庚',
  丁: '壬',
  戊: '甲',
  己: '丙',
  庚: '戊',
  辛: '庚',
  壬: '壬',
  癸: '甲',
};

/**
 * 八字时柱的五鼠遁起时干。子时固定从子支开始，之后每个时辰顺排一干。
 * 甲己甲作首，乙庚丙为首，丙辛戊为首，丁壬庚为首，戊癸壬为首。
 */
const FIRST_HOUR_STEM_BY_DAY_STEM: Record<HeavenlyStem, HeavenlyStem> = {
  甲: '甲',
  乙: '丙',
  丙: '戊',
  丁: '庚',
  戊: '壬',
  己: '甲',
  庚: '丙',
  辛: '戊',
  壬: '庚',
  癸: '壬',
};

const MONTH_BRANCHES = [...EARTHLY_BRANCHES.slice(2), ...EARTHLY_BRANCHES.slice(0, 2)] as const;

function getPillarOptions(firstStem: HeavenlyStem, branches: readonly string[]): string[] {
  const firstStemIndex = HEAVENLY_STEMS.indexOf(firstStem);
  return branches.map(
    (branch, offset) => HEAVENLY_STEMS[(firstStemIndex + offset) % HEAVENLY_STEMS.length] + branch,
  );
}

/** 返回指定年柱可用的十二个月柱；非法年柱返回空数组。 */
export function getBaziMonthPillarOptions(yearPillar: unknown): string[] {
  if (!isValidGanZhi(yearPillar)) return [];
  return getPillarOptions(
    FIRST_MONTH_STEM_BY_YEAR_STEM[yearPillar[0] as HeavenlyStem],
    MONTH_BRANCHES,
  );
}

/** 返回指定日柱可用的十二个时柱；非法日柱返回空数组。 */
export function getBaziHourPillarOptions(dayPillar: unknown): string[] {
  if (!isValidGanZhi(dayPillar)) return [];
  return getPillarOptions(
    FIRST_HOUR_STEM_BY_DAY_STEM[dayPillar[0] as HeavenlyStem],
    EARTHLY_BRANCHES,
  );
}

export interface BaziPillarNames {
  year: unknown;
  month: unknown;
  day: unknown;
  hour: unknown;
}

/** 校验四柱的干支组合以及五虎遁、五鼠遁上下柱关系。 */
export function isValidBaziPillarCombination(pillars: BaziPillarNames): boolean {
  if (!pillars || typeof pillars !== 'object') return false;
  if (
    !isValidGanZhi(pillars.year) ||
    !isValidGanZhi(pillars.month) ||
    !isValidGanZhi(pillars.day) ||
    !isValidGanZhi(pillars.hour)
  ) {
    return false;
  }
  return (
    getBaziMonthPillarOptions(pillars.year).includes(pillars.month) &&
    getBaziHourPillarOptions(pillars.day).includes(pillars.hour)
  );
}

/** 对四柱关系做带字段说明的严格校验，供反推等入口复用。 */
export function assertValidBaziPillarCombination(
  pillars: BaziPillarNames,
  label = '四柱',
): asserts pillars is { year: string; month: string; day: string; hour: string } {
  assertValidGanZhi(pillars.year, `${label}年柱`);
  assertValidGanZhi(pillars.month, `${label}月柱`);
  assertValidGanZhi(pillars.day, `${label}日柱`);
  assertValidGanZhi(pillars.hour, `${label}时柱`);
  if (!getBaziMonthPillarOptions(pillars.year).includes(pillars.month)) {
    throw new Error(`${label}月柱${pillars.month}与年柱${pillars.year}不符合五虎遁排月规则。`);
  }
  if (!getBaziHourPillarOptions(pillars.day).includes(pillars.hour)) {
    throw new Error(`${label}时柱${pillars.hour}与日柱${pillars.day}不符合五鼠遁排时规则。`);
  }
}
