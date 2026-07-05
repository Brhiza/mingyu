/**
 * 农历工具类
 * 基于tyme4ts库实现农历、干支等传统历法功能
 */
import { SolarDay } from 'tyme4ts';

/**
 * 干支信息接口
 */
export interface GanZhiInfo {
  year: string;
  month: string;
  day: string;
  hour: string;
}

/**
 * 农历信息接口
 */
export interface LunarInfo {
  year: string;
  month: string;
  day: string;
  hour: string;
  yearInChinese: string;
  monthInChinese: string;
  dayInChinese: string;
  hourInChinese: string;
  // 添加数字格式的月日
  monthNumber: number;
  dayNumber: number;
}

/**
 * 完整时间信息接口
 */
export interface TimeInfo {
  solar: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  lunar: LunarInfo;
  ganzhi: GanZhiInfo;
  eightChar: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  jieQi: string;
}

/**
 * 农历工具类
 */
export class LunarUtil {
  /**
   * 获取当前时间的完整信息
   */
  static getCurrentTimeInfo(): TimeInfo {
    const now = new Date();
    return this.getTimeInfo(now);
  }

  /**
   * 计算时辰的公共方法，避免代码重复
   */
  private static calculateHourIndex(currentHour: number): number {
    // 时辰划分标准：
    // 子时: 23:00-01:00 (23:00-24:00为夜子时，00:00-01:00为早子时)
    // 丑时: 01:00-03:00
    // 寅时: 03:00-05:00
    // 卯时: 05:00-07:00
    // 辰时: 07:00-09:00
    // 巳时: 09:00-11:00
    // 午时: 11:00-13:00
    // 未时: 13:00-15:00
    // 申时: 15:00-17:00
    // 酉时: 17:00-19:00
    // 戌时: 19:00-21:00
    // 亥时: 21:00-23:00

    if (currentHour >= 23) {
      return 12; // 晚子时（夜子时，23:00-24:00），对应 tyme4ts hours 数组末位
    } else if (currentHour < 1) {
      return 0; // 早子时（00:00-01:00）
    } else if (currentHour >= 1 && currentHour < 3) {
      return 1; // 丑时
    } else if (currentHour >= 3 && currentHour < 5) {
      return 2; // 寅时
    } else if (currentHour >= 5 && currentHour < 7) {
      return 3; // 卯时
    } else if (currentHour >= 7 && currentHour < 9) {
      return 4; // 辰时
    } else if (currentHour >= 9 && currentHour < 11) {
      return 5; // 巳时
    } else if (currentHour >= 11 && currentHour < 13) {
      return 6; // 午时
    } else if (currentHour >= 13 && currentHour < 15) {
      return 7; // 未时
    } else if (currentHour >= 15 && currentHour < 17) {
      return 8; // 申时
    } else if (currentHour >= 17 && currentHour < 19) {
      return 9; // 酉时
    } else if (currentHour >= 19 && currentHour < 21) {
      return 10; // 戌时
    } else if (currentHour >= 21 && currentHour < 23) {
      return 11; // 亥时
    }

    // 默认返回子时（理论上不会执行到这里）
    return 0;
  }

  private static assertValidDate(date: Date): void {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error('时间不是有效日期。');
    }
  }

  private static assertSolarYear(year: number): void {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      throw new Error('年份需在 1900-2100 之间。');
    }
  }

  private static assertSolarMonth(month: number): void {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('月份需在 1-12 之间。');
    }
  }

  /**
   * 获取指定时间的完整信息
   */
  static getTimeInfo(date: Date): TimeInfo {
    this.assertValidDate(date);
    try {
      const solar = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
      const lunar = solar.getLunarDay();
      const jieQi = solar.getTerm();

      // 获取当前时辰
      const currentHour = date.getHours();
      const hours = lunar.getHours();
      const hourIndex = this.calculateHourIndex(currentHour);

      // 从 tyme4ts 返回的时辰数组中获取对应索引的时辰
      const currentLunarHour = hours[hourIndex] || hours[0];

      return {
        solar: {
          year: solar.getYear(),
          month: solar.getMonth(),
          day: solar.getDay(),
          hour: date.getHours(),
          minute: date.getMinutes(),
        },
        lunar: {
          year: lunar.getYearSixtyCycle().toString(),
          month: lunar.getMonthSixtyCycle().toString(),
          day: lunar.getSixtyCycle().toString(),
          hour: currentLunarHour.getSixtyCycle().toString(),
          yearInChinese: lunar.toString().split('年')[0],
          monthInChinese: lunar.toString().split('年')[1].split('月')[0] + '月',
          dayInChinese: lunar.toString().split('月')[1],
          hourInChinese: currentLunarHour.toString().slice(-2),
          // 添加数字格式的月日（tyme4ts 闰月返回负数，规范为正数月序，闰月标志另行处理）
          monthNumber: Math.abs(lunar.getMonth()),
          dayNumber: lunar.getDay(),
        },
        ganzhi: {
          year: lunar.getYearSixtyCycle().toString(),
          month: lunar.getMonthSixtyCycle().toString(),
          day: lunar.getSixtyCycle().toString(),
          hour: currentLunarHour.getSixtyCycle().toString(),
        },
        eightChar: {
          year: lunar.getYearSixtyCycle().toString(),
          month: lunar.getMonthSixtyCycle().toString(),
          day: lunar.getSixtyCycle().toString(),
          hour: currentLunarHour.getSixtyCycle().toString(),
        },
        jieQi: jieQi.getName(),
      };
    } catch (error) {
      console.error('tyme4ts库调用失败:', error);
      throw error;
    }
  }

  /**
   * 获取干支信息
   */
  static getGanZhi(date?: Date): GanZhiInfo {
    const targetDate = date || new Date();
    this.assertValidDate(targetDate);
    try {
      const solar = SolarDay.fromYmd(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        targetDate.getDate(),
      );
      const lunar = solar.getLunarDay();

      // 获取当前时辰
      const currentHour = targetDate.getHours();
      const hours = lunar.getHours();
      const hourIndex = this.calculateHourIndex(currentHour);

      // 从 tyme4ts 返回的时辰数组中获取对应索引的时辰
      const currentLunarHour = hours[hourIndex] || hours[0];

      return {
        year: lunar.getYearSixtyCycle().toString(),
        month: lunar.getMonthSixtyCycle().toString(),
        day: lunar.getSixtyCycle().toString(),
        hour: currentLunarHour.getSixtyCycle().toString(),
      };
    } catch (error) {
      console.error('tyme4ts库调用失败:', error);
      throw error;
    }
  }

  /**
   * 获取农历信息
   */
  static getLunar(date?: Date): LunarInfo {
    const targetDate = date || new Date();
    this.assertValidDate(targetDate);
    try {
      const solar = SolarDay.fromYmd(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        targetDate.getDate(),
      );
      const lunar = solar.getLunarDay();

      // 获取当前时辰
      const currentHour = targetDate.getHours();
      const hours = lunar.getHours();
      const hourIndex = this.calculateHourIndex(currentHour);

      // 从 tyme4ts 返回的时辰数组中获取对应索引的时辰
      const currentLunarHour = hours[hourIndex] || hours[0];

      return {
        year: lunar.getYearSixtyCycle().toString(),
        month: lunar.getMonthSixtyCycle().toString(),
        day: lunar.getSixtyCycle().toString(),
        hour: currentLunarHour.getSixtyCycle().toString(),
        yearInChinese: lunar.toString().split('年')[0],
        monthInChinese: lunar.toString().split('年')[1].split('月')[0] + '月',
        dayInChinese: lunar.toString().split('月')[1],
        hourInChinese: currentLunarHour.toString().slice(-2),
        // 添加数字格式的月日（tyme4ts 闰月返回负数，此处规范为正数月序，闰月标志另行处理）
        monthNumber: Math.abs(lunar.getMonth()),
        dayNumber: lunar.getDay(),
      };
    } catch (error) {
      console.error('tyme4ts库调用失败:', error);
      throw error;
    }
  }

  /**
   * 获取空亡地支
   */
  static getVoidBranches(dayGanZhi: string): string[] {
    const voidMap: Record<string, string[]> = {
      // 甲子旬
      甲子: ['戌', '亥'],
      乙丑: ['戌', '亥'],
      丙寅: ['戌', '亥'],
      丁卯: ['戌', '亥'],
      戊辰: ['戌', '亥'],
      己巳: ['戌', '亥'],
      庚午: ['戌', '亥'],
      辛未: ['戌', '亥'],
      壬申: ['戌', '亥'],
      癸酉: ['戌', '亥'],

      // 甲戌旬
      甲戌: ['申', '酉'],
      乙亥: ['申', '酉'],
      丙子: ['申', '酉'],
      丁丑: ['申', '酉'],
      戊寅: ['申', '酉'],
      己卯: ['申', '酉'],
      庚辰: ['申', '酉'],
      辛巳: ['申', '酉'],
      壬午: ['申', '酉'],
      癸未: ['申', '酉'],

      // 甲申旬
      甲申: ['午', '未'],
      乙酉: ['午', '未'],
      丙戌: ['午', '未'],
      丁亥: ['午', '未'],
      戊子: ['午', '未'],
      己丑: ['午', '未'],
      庚寅: ['午', '未'],
      辛卯: ['午', '未'],
      壬辰: ['午', '未'],
      癸巳: ['午', '未'],

      // 甲午旬
      甲午: ['辰', '巳'],
      乙未: ['辰', '巳'],
      丙申: ['辰', '巳'],
      丁酉: ['辰', '巳'],
      戊戌: ['辰', '巳'],
      己亥: ['辰', '巳'],
      庚子: ['辰', '巳'],
      辛丑: ['辰', '巳'],
      壬寅: ['辰', '巳'],
      癸卯: ['辰', '巳'],

      // 甲辰旬
      甲辰: ['寅', '卯'],
      乙巳: ['寅', '卯'],
      丙午: ['寅', '卯'],
      丁未: ['寅', '卯'],
      戊申: ['寅', '卯'],
      己酉: ['寅', '卯'],
      庚戌: ['寅', '卯'],
      辛亥: ['寅', '卯'],
      壬子: ['寅', '卯'],
      癸丑: ['寅', '卯'],

      // 甲寅旬
      甲寅: ['子', '丑'],
      乙卯: ['子', '丑'],
      丙辰: ['子', '丑'],
      丁巳: ['子', '丑'],
      戊午: ['子', '丑'],
      己未: ['子', '丑'],
      庚申: ['子', '丑'],
      辛酉: ['子', '丑'],
      壬戌: ['子', '丑'],
      癸亥: ['子', '丑'],
    };

    return voidMap[dayGanZhi] || [];
  }

  /**
   * 根据日干获取六神起始
   */
  static getSixAnimalsStart(dayGan: string): string {
    const startMap: Record<string, string> = {
      甲: '青龙',
      乙: '青龙',
      丙: '朱雀',
      丁: '朱雀',
      戊: '勾陈',
      己: '螣蛇',
      庚: '白虎',
      辛: '白虎',
      壬: '玄武',
      癸: '玄武',
    };

    return startMap[dayGan] || '青龙';
  }

  /**
   * 获取六神序列
   * 修正：从第一爻（最下方）开始，按日干确定起始六神
   */
  static getSixAnimals(dayGan: string): string[] {
    const animals = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
    const startAnimal = this.getSixAnimalsStart(dayGan);
    const startIndex = animals.indexOf(startAnimal);

    const result: string[] = [];
    for (let i = 0; i < 6; i++) {
      // 从第一爻（index 0）开始，按顺序排列六神
      result.push(animals[(startIndex + i) % 6]);
    }

    return result;
  }

  /**
   * 获取指定公历月份每日的干支
   */
  static getGanZhiForMonth(
    year: number,
    month: number,
  ): { date: string; ganZhi: string; lunarDate: string }[] {
    this.assertSolarYear(year);
    this.assertSolarMonth(month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];
    let firstError: unknown = null;
    for (let day = 1; day <= daysInMonth; day++) {
      try {
        const solar = SolarDay.fromYmd(year, month, day);
        const lunar = solar.getLunarDay();
        const lunarDateString = lunar.toString();
        const lunarMonth = lunarDateString.split('年')[1].split('月')[0] + '月';
        const lunarDay = lunarDateString.split('月')[1];
        result.push({
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          ganZhi: lunar.getSixtyCycle().toString(),
          lunarDate: `${lunarMonth}${lunarDay}`,
        });
      } catch (error) {
        if (!firstError) firstError = error;
        console.error(`Error calculating GanZhi for ${year}-${month}-${day}:`, error);
      }
    }
    if (result.length === 0 && firstError) {
      throw firstError;
    }
    return result;
  }

  /**
   * 获取指定公历年份每月的干支
   */
  static getGanZhiForYear(year: number): { month: number; ganZhi: string }[] {
    this.assertSolarYear(year);
    const result = [];
    let firstError: unknown = null;
    for (let month = 1; month <= 12; month++) {
      try {
        // 使用该月15号作为代表日来获取月干支
        const solar = SolarDay.fromYmd(year, month, 15);
        const lunar = solar.getLunarDay();
        result.push({
          month: month,
          ganZhi: lunar.getMonthSixtyCycle().toString(),
        });
      } catch (error) {
        if (!firstError) firstError = error;
        console.error(`Error calculating GanZhi for month ${year}-${month}:`, error);
      }
    }
    if (result.length === 0 && firstError) {
      throw firstError;
    }
    return result;
  }

  /**
   * 格式化时间显示
   */
  static formatTimeDisplay(timeInfo: TimeInfo): {
    solar: string;
    lunar: string;
    ganzhi: string;
  } {
    const { solar, lunar, ganzhi } = timeInfo;
    const lunarYear = lunar.yearInChinese.endsWith('年')
      ? lunar.yearInChinese
      : `${lunar.yearInChinese}年`;

    return {
      solar: `公历：${solar.year}年${solar.month}月${solar.day}日 ${solar.hour}时${solar.minute}分`,
      lunar: `农历：${lunarYear} ${lunar.monthInChinese}${lunar.dayInChinese} ${lunar.hourInChinese}`,
      ganzhi: `干支：${ganzhi.year}年 ${ganzhi.month}月 ${ganzhi.day}日 ${ganzhi.hour}时`,
    };
  }
}

// 导出便捷函数
export const getVoidBranches = (dayGanZhi: string) => LunarUtil.getVoidBranches(dayGanZhi);
export const getSixAnimals = (dayGan: string) => LunarUtil.getSixAnimals(dayGan);
