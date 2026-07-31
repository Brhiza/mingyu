/**
 * 十二月将按十二中气实际交节切换。
 *
 * 《六壬粹言》《六壬指南》与奇门天三门等条目均以太阳过宫为界，
 * 不能用农历月份或月建地支直接替代。
 */
import { SolarTerm, SolarTime } from 'tyme4ts';

export const MONTH_GENERAL_BY_ZHONGQI: Readonly<Record<string, string>> = {
  雨水: '亥',
  春分: '戌',
  谷雨: '酉',
  小满: '申',
  夏至: '未',
  大暑: '午',
  处暑: '巳',
  秋分: '辰',
  霜降: '卯',
  小雪: '寅',
  冬至: '丑',
  大寒: '子',
};

export interface MonthGeneralSolarTime {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

export interface MonthGeneralResult {
  activeZhongqi: string;
  monthGeneral: string;
}

export function getMonthGeneralByZhongqi(time: MonthGeneralSolarTime): MonthGeneralResult {
  const currentTime = SolarTime.fromYmdHms(
    time.year,
    time.month,
    time.day,
    time.hour ?? 0,
    time.minute ?? 0,
    time.second ?? 0,
  );
  const currentJulianDay = currentTime.getJulianDay().getDay();
  let activeZhongqi = '冬至';
  let activeJulianDay = Number.NEGATIVE_INFINITY;

  for (const scanYear of [time.year - 1, time.year, time.year + 1]) {
    for (let termIndex = 0; termIndex < 24; termIndex += 2) {
      const term = SolarTerm.fromIndex(scanYear, termIndex);
      const termJulianDay = term.getJulianDay().getDay();
      if (termJulianDay <= currentJulianDay && termJulianDay > activeJulianDay) {
        activeJulianDay = termJulianDay;
        activeZhongqi = term.getName();
      }
    }
  }

  const monthGeneral = MONTH_GENERAL_BY_ZHONGQI[activeZhongqi];
  if (!monthGeneral) {
    throw new Error(`找不到中气“${activeZhongqi}”对应的月将。`);
  }
  return { activeZhongqi, monthGeneral };
}
