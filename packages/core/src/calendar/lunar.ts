/**
 * 农历工具类
 * 基于tyme4ts库实现农历、干支等传统历法功能
 */
import { SixtyCycle, SolarDay, SolarTime } from 'tyme4ts';

type NamedTymeValue = { getName(): string };

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

  private static parseLunarDayText(lunarText: string): {
    yearInChinese: string;
    monthInChinese: string;
    dayInChinese: string;
  } {
    const normalized = lunarText.replace(/^农历/, '');
    const [yearPart, rest] = normalized.split('年');
    if (!yearPart || !rest) {
      throw new Error(`无法解析农历日期文本：${lunarText}`);
    }
    const [monthPart, dayPart] = rest.split('月');
    if (!monthPart || !dayPart) {
      throw new Error(`无法解析农历日期文本：${lunarText}`);
    }

    return {
      yearInChinese: `${yearPart}年`,
      monthInChinese: `${monthPart}月`,
      dayInChinese: dayPart,
    };
  }

  /**
   * 获取指定时间的完整信息
   */
  static getTimeInfo(date: Date): TimeInfo {
    this.assertValidDate(date);
    try {
      const solarTime = SolarTime.fromYmdHms(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
      );
      const solar = solarTime.getSolarDay();
      const lunarHour = solarTime.getLunarHour();
      const lunar = lunarHour.getLunarDay();
      const eightChar = lunarHour.getEightChar();
      const jieQi = solarTime.getTerm();
      const lunarText = this.parseLunarDayText(lunar.toString());

      return {
        solar: {
          year: solar.getYear(),
          month: solar.getMonth(),
          day: solar.getDay(),
          hour: date.getHours(),
          minute: date.getMinutes(),
        },
        lunar: {
          year: eightChar.getYear().getName(),
          month: eightChar.getMonth().getName(),
          day: eightChar.getDay().getName(),
          hour: eightChar.getHour().getName(),
          yearInChinese: lunarText.yearInChinese,
          monthInChinese: lunarText.monthInChinese,
          dayInChinese: lunarText.dayInChinese,
          hourInChinese: lunarHour.getName(),
          // 添加数字格式的月日（tyme4ts 闰月返回负数，规范为正数月序，闰月标志另行处理）
          monthNumber: Math.abs(lunar.getMonth()),
          dayNumber: lunar.getDay(),
        },
        ganzhi: {
          year: eightChar.getYear().getName(),
          month: eightChar.getMonth().getName(),
          day: eightChar.getDay().getName(),
          hour: eightChar.getHour().getName(),
        },
        eightChar: {
          year: eightChar.getYear().getName(),
          month: eightChar.getMonth().getName(),
          day: eightChar.getDay().getName(),
          hour: eightChar.getHour().getName(),
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
    const targetDate = date === undefined ? new Date() : date;
    this.assertValidDate(targetDate);
    try {
      const solarTime = SolarTime.fromYmdHms(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        targetDate.getDate(),
        targetDate.getHours(),
        targetDate.getMinutes(),
        targetDate.getSeconds(),
      );
      const eightChar = solarTime.getLunarHour().getEightChar();

      return {
        year: eightChar.getYear().getName(),
        month: eightChar.getMonth().getName(),
        day: eightChar.getDay().getName(),
        hour: eightChar.getHour().getName(),
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
    const targetDate = date === undefined ? new Date() : date;
    this.assertValidDate(targetDate);
    try {
      const solarTime = SolarTime.fromYmdHms(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        targetDate.getDate(),
        targetDate.getHours(),
        targetDate.getMinutes(),
        targetDate.getSeconds(),
      );
      const lunarHour = solarTime.getLunarHour();
      const lunar = lunarHour.getLunarDay();
      const eightChar = lunarHour.getEightChar();
      const lunarText = this.parseLunarDayText(lunar.toString());

      return {
        year: eightChar.getYear().getName(),
        month: eightChar.getMonth().getName(),
        day: eightChar.getDay().getName(),
        hour: eightChar.getHour().getName(),
        yearInChinese: lunarText.yearInChinese,
        monthInChinese: lunarText.monthInChinese,
        dayInChinese: lunarText.dayInChinese,
        hourInChinese: lunarHour.getName(),
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
    try {
      return SixtyCycle.fromName(dayGanZhi)
        .getExtraEarthBranches()
        .map((item: NamedTymeValue) => item.getName());
    } catch (error) {
      throw new Error(`无法识别日柱干支 "${dayGanZhi}" 的旬空。`, { cause: error });
    }
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

    const start = startMap[dayGan];
    if (!start) {
      throw new Error(`无法识别日干 "${dayGan}" 的六神起法。`);
    }
    return start;
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
    for (let day = 1; day <= daysInMonth; day++) {
      const solar = SolarDay.fromYmd(year, month, day);
      const lunar = solar.getLunarDay();
      const lunarText = this.parseLunarDayText(lunar.toString());
      result.push({
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        ganZhi: lunar.getSixtyCycle().toString(),
        lunarDate: `${lunarText.monthInChinese}${lunarText.dayInChinese}`,
      });
    }
    return result;
  }

  /**
   * 获取指定公历年份每月的干支
   */
  static getGanZhiForYear(year: number): { month: number; ganZhi: string }[] {
    this.assertSolarYear(year);
    const result = [];
    for (let month = 1; month <= 12; month++) {
      // 使用该月 15 日午时作为公历月代表点，月柱来源统一走 EightChar。
      const solarTime = SolarTime.fromYmdHms(year, month, 15, 12, 0, 0);
      const eightChar = solarTime.getLunarHour().getEightChar();
      result.push({
        month: month,
        ganZhi: eightChar.getMonth().getName(),
      });
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
