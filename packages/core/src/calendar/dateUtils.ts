/**
 * 日期时间工具函数
 */

export { daysInSolarMonth as getDaysInMonth } from './date-validation';

export interface ShichenPeriod {
  index: number;
  branch: string;
  name: string;
  range: string;
  /** 排盘用代表小时（传统时辰时段的中间时刻）。 */
  hour: number;
  /** 排盘用代表分钟（传统时辰时段的中间时刻）。 */
  minute: number;
}

/**
 * 十二时辰目录；子时按本项目排盘口径拆成早子时与晚子时。
 * `hour`、`minute` 是仅有时辰精度时为完成历法日期换算而采用的时段中点。
 */
export const SHICHEN_PERIODS = [
  { index: 0, branch: '子', name: '早子时', range: '00:00-01:00', hour: 0, minute: 30 },
  { index: 1, branch: '丑', name: '丑时', range: '01:00-03:00', hour: 2, minute: 0 },
  { index: 2, branch: '寅', name: '寅时', range: '03:00-05:00', hour: 4, minute: 0 },
  { index: 3, branch: '卯', name: '卯时', range: '05:00-07:00', hour: 6, minute: 0 },
  { index: 4, branch: '辰', name: '辰时', range: '07:00-09:00', hour: 8, minute: 0 },
  { index: 5, branch: '巳', name: '巳时', range: '09:00-11:00', hour: 10, minute: 0 },
  { index: 6, branch: '午', name: '午时', range: '11:00-13:00', hour: 12, minute: 0 },
  { index: 7, branch: '未', name: '未时', range: '13:00-15:00', hour: 14, minute: 0 },
  { index: 8, branch: '申', name: '申时', range: '15:00-17:00', hour: 16, minute: 0 },
  { index: 9, branch: '酉', name: '酉时', range: '17:00-19:00', hour: 18, minute: 0 },
  { index: 10, branch: '戌', name: '戌时', range: '19:00-21:00', hour: 20, minute: 0 },
  { index: 11, branch: '亥', name: '亥时', range: '21:00-23:00', hour: 22, minute: 0 },
  { index: 12, branch: '子', name: '晚子时', range: '23:00-24:00', hour: 23, minute: 30 },
] as const satisfies readonly ShichenPeriod[];

export function getShichenByIndex(index: number): ShichenPeriod | null {
  if (!Number.isInteger(index) || index < 0 || index >= SHICHEN_PERIODS.length) {
    return null;
  }
  return SHICHEN_PERIODS[index];
}

export function getTimeIndexFromClock(hour: number, minute = 0): number {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    hour < 0 ||
    hour > 24
  ) {
    return -1;
  }

  if (hour === 24) return minute === 0 ? 12 : -1;
  if (hour === 23) return 12;
  if (hour === 0) return 0;
  return Math.floor((hour + 1) / 2);
}

export function getShichenFromClock(hour: number, minute = 0): ShichenPeriod | null {
  return getShichenByIndex(getTimeIndexFromClock(hour, minute));
}
