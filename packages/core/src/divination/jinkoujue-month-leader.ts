import { SolarTerm, SolarTime } from 'tyme4ts';
import { TimeManager } from '../calendar/timeManager';
import { DEFAULT_CHINA_TIMEZONE_HOURS } from '../calendar/civil-time';

const MONTH_LEADER_BY_ZHONGQI: Record<string, string> = {
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

/** 以实际时刻之前已交的中气定月将。 */
export function getJinkoujueMonthLeader(timestamp: number): string {
  const currentParts = TimeManager.getWallClockParts(
    new Date(timestamp),
    DEFAULT_CHINA_TIMEZONE_HOURS * 60,
  );
  const currentTime = SolarTime.fromYmdHms(
    currentParts.year,
    currentParts.month,
    currentParts.day,
    currentParts.hour,
    currentParts.minute,
    currentParts.second,
  );
  const currentJulianDay = currentTime.getJulianDay().getDay();
  const year = currentParts.year;
  // 历表从公元 1 年起；该年大寒之前仍沿用上一冬至的丑将。
  let activeZhongqi: string | undefined = year === 1 ? '冬至' : undefined;
  let activeJulianDay = Number.NEGATIVE_INFINITY;

  // 当前节气序列的索引0为上一公历年冬至；目标年末只需下一序列的冬至。
  for (const scanYear of [year, year + 1]) {
    const firstIndex = scanYear === 1 ? 2 : 0;
    const lastIndex = scanYear === year ? 22 : 0;
    for (let termIndex = firstIndex; termIndex <= lastIndex; termIndex += 2) {
      const term = SolarTerm.fromIndex(scanYear, termIndex);
      // 与 tyme4ts 的 SolarTime#getTerm 保持同一整秒边界口径。
      const termJulianDay = term.getJulianDay().getSolarTime().getJulianDay().getDay();
      if (termJulianDay <= currentJulianDay && termJulianDay > activeJulianDay) {
        activeJulianDay = termJulianDay;
        activeZhongqi = term.getName();
      }
    }
  }

  if (!activeZhongqi) {
    throw new Error('金口诀历表无法定位占时之前已交的中气。');
  }
  const monthLeader = MONTH_LEADER_BY_ZHONGQI[activeZhongqi];
  if (!monthLeader) {
    throw new Error(`找不到中气 "${activeZhongqi}" 对应的金口诀月将。`);
  }
  return monthLeader;
}
