/**
 * 统一的占卜时间管理工具
 * 简化时间相关操作，确保所有占卜基于统一的时间基础
 */
import type { TimeInfo, GanZhiInfo } from './lunar';
import { SolarTime } from 'tyme4ts';

/**
 * 统一的占卜时间数据
 */
export interface DivinationTime {
  /** 完整时间信息 */
  timeInfo: TimeInfo;
  /** 干支信息 */
  ganzhi: GanZhiInfo;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 时间管理工具类
 */
export class TimeManager {
  /**
   * 时区偏移覆盖（单位：分钟，正数表示 UTC+）
   * - null：不覆盖，使用运行环境本地时区
   * - 例如：北京时间为 480
   * - 默认固定北京时间，避免服务端时区差异导致占卜盘与提示词不一致
   */
  private static timezoneOffsetMinutesOverride: number | null = 480;

  /**
   * 设置时区偏移覆盖（用于服务端/边缘环境固定时区）
   */
  static setTimezoneOffsetMinutesOverride(offsetMinutes: number | null): void {
    this.timezoneOffsetMinutesOverride = offsetMinutes;
  }

  /**
   * 获取目标时区偏移（分钟）
   */
  private static getTimezoneOffsetMinutes(date: Date): number {
    const override = this.timezoneOffsetMinutesOverride;
    if (typeof override === 'number' && Number.isFinite(override)) {
      return override;
    }
    // Date#getTimezoneOffset 返回"本地到UTC需要加多少分钟"，因此本地偏移 = -getTimezoneOffset
    return -date.getTimezoneOffset();
  }

  /**
   * 在指定时区偏移下提取年月日时分（不改变原始时间戳）
   */
  private static getDatePartsInOffset(
    date: Date,
    offsetMinutes: number,
  ): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  } {
    const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
    };
  }

  /**
   * 获取占卜用的统一时间数据
   * @param customTime 自定义时间（可选）
   * @returns 统一的时间数据
   */
  static getDivinationTime(customTime?: Date): DivinationTime {
    const targetTime = customTime || new Date();
    if (!(targetTime instanceof Date) || Number.isNaN(targetTime.getTime())) {
      throw new Error('自定义时间不是有效日期。');
    }
    const timeInfo = this.getTimeInfo(targetTime);
    const ganzhi = this.getGanZhi(targetTime);
    const timestamp = targetTime.getTime();

    return { timeInfo, ganzhi, timestamp };
  }

  /**
   * 基于时间戳生成确定性随机数
   * @param timestamp 时间戳
   * @param range 范围
   * @returns 确定性随机数
   */
  static getSeededRandom(timestamp: number, range: number = 1): number {
    // 使用简单但确定性的伪随机算法
    const seed = timestamp % 2147483647;
    const a = 1664525;
    const c = 1013904223;
    const m = 2147483647;
    const result = (a * seed + c) % m;
    return ((result % range) + range) % range;
  }

  /**
   * 基于时间生成爻象
   * @param timestamp 时间戳
   * @param count 爻象数量
   * @returns 爻象数组
   */
  static generateYaosByTime(timestamp: number, count: number = 6): number[] {
    const yaos: number[] = [];
    for (let i = 0; i < count; i++) {
      // 按三钱法逐币起爻，保持时间起卦的确定性。
      yaos.push(
        this.generateYaoByCoinMethod((coinIndex) =>
          this.getSeededRandom(timestamp + i * 1000 + coinIndex * 97, 2),
        ),
      );
    }
    return yaos;
  }

  /**
   * 随机生成爻象
   * @param count 爻象数量
   * @returns 爻象数组
   */
  static generateYaosByRandom(count: number = 6): number[] {
    const yaos: number[] = [];
    for (let i = 0; i < count; i++) {
      yaos.push(this.generateYaoByCoinMethod(() => (Math.random() < 0.5 ? 0 : 1)));
    }
    return yaos;
  }

  /**
   * 使用三钱法起一爻：正面记 3，反面记 2，三枚铜钱合计得 6/7/8/9。
   */
  private static generateYaoByCoinMethod(getCoinBit: (coinIndex: number) => number): number {
    let total = 0;
    for (let coinIndex = 0; coinIndex < 3; coinIndex++) {
      total += getCoinBit(coinIndex) === 0 ? 2 : 3;
    }
    return total;
  }

  /**
   * 获取指定时间的干支信息
   */
  private static getGanZhi(date: Date): GanZhiInfo {
    const offsetMinutes = this.getTimezoneOffsetMinutes(date);
    const parts = this.getDatePartsInOffset(date, offsetMinutes);
    const solarTime = SolarTime.fromYmdHms(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      0,
    );
    const lunarHour = solarTime.getLunarHour();
    const lunarDay = lunarHour.getLunarDay();

    return {
      year: lunarHour.getYearSixtyCycle().toString(),
      month: lunarHour.getMonthSixtyCycle().toString(),
      day: lunarDay.getSixtyCycle().toString(),
      hour: lunarHour.getSixtyCycle().toString(),
    };
  }

  /**
   * 获取指定时间的完整信息
   */
  private static getTimeInfo(date: Date): TimeInfo {
    const offsetMinutes = this.getTimezoneOffsetMinutes(date);
    const parts = this.getDatePartsInOffset(date, offsetMinutes);
    const solarTime = SolarTime.fromYmdHms(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      0,
    );
    const solarDay = solarTime.getSolarDay();
    const lunarHour = solarTime.getLunarHour();
    const lunarDay = lunarHour.getLunarDay();
    const lunarDayText = lunarDay.toString().replace(/^农历/, '');
    const lunarHourText = lunarHour.toString().replace(/^农历/, '');
    const jieQi = solarTime.getTerm();

    return {
      solar: {
        year: solarDay.getYear(),
        month: solarDay.getMonth(),
        day: solarDay.getDay(),
        hour: parts.hour,
        minute: parts.minute,
      },
      lunar: {
        year: lunarHour.getYearSixtyCycle().toString(),
        month: lunarHour.getMonthSixtyCycle().toString(),
        day: lunarDay.getSixtyCycle().toString(),
        hour: lunarHour.getSixtyCycle().toString(),
        yearInChinese: lunarDayText.split('年')[0] + '年',
        monthInChinese: lunarDayText.split('年')[1].split('月')[0] + '月',
        dayInChinese: lunarDayText.split('月')[1],
        hourInChinese: lunarHourText.slice(-2),
        monthNumber: lunarDay.getMonth(),
        dayNumber: lunarDay.getDay(),
      },
      ganzhi: {
        year: lunarHour.getYearSixtyCycle().toString(),
        month: lunarHour.getMonthSixtyCycle().toString(),
        day: lunarDay.getSixtyCycle().toString(),
        hour: lunarHour.getSixtyCycle().toString(),
      },
      eightChar: {
        year: lunarHour.getYearSixtyCycle().toString(),
        month: lunarHour.getMonthSixtyCycle().toString(),
        day: lunarDay.getSixtyCycle().toString(),
        hour: lunarHour.getSixtyCycle().toString(),
      },
      jieQi: jieQi.getName(),
    };
  }
}

// 导出便捷函数
export const getDivinationTime = TimeManager.getDivinationTime.bind(TimeManager);
export const generateYaosByTime = TimeManager.generateYaosByTime.bind(TimeManager);

// ─── 全局配置入口 ───

/**
 * 全局配置选项
 */
export interface MingyuCoreConfig {
  /** 时区偏移分钟数（默认 480 = UTC+8 东八区） */
  timezoneOffset?: number;
}

/**
 * 统一全局配置入口
 *
 * 用于设置时区等全局参数，取代手动调用 TimeManager.setTimezoneOffsetMinutesOverride()。
 * 不传字段则保持当前值不变。
 *
 * @param config 配置选项
 *
 * @example
 * ```ts
 * import { configure } from 'mingyu-core/calendar';
 *
 * // 设置东八区（北京时间）
 * configure({ timezoneOffset: 480 });
 * ```
 */
export function configure(config: MingyuCoreConfig): void {
  if (config.timezoneOffset !== undefined) {
    TimeManager.setTimezoneOffsetMinutesOverride(config.timezoneOffset);
  }
}
