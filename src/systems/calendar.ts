import { SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import {
  HEAVENLY_STEMS as BASE_HEAVENLY_STEMS,
  EARTHLY_BRANCHES as BASE_EARTHLY_BRANCHES,
  JIE_TERM_MONTH_INDEX,
  getHourSixtyCycle,
  getSixtyCycleIndex,
  getSixtyCycleName,
  getSolarTermYearFromJie,
  getVoidBranches as baseGetVoidBranches,
  getYearMonthGanZhi,
  getYearSixtyCycle,
} from './ganzhi-foundation';

export const HEAVENLY_STEMS: readonly string[] = BASE_HEAVENLY_STEMS;
export const EARTHLY_BRANCHES: readonly string[] = BASE_EARTHLY_BRANCHES;
export function getVoidBranches(day: string): string[] { return baseGetVoidBranches(day); }

export {
  getBranchIndex,
  getBranchWuxing,
  getStemWuxing,
  getStemYinYang,
  isSheng,
  isKe,
  getSeasonState,
  isLiuhe as isHe,
  isLiuchong as isChong,
  isSanxing as isXing,
} from './ganzhi-foundation';

const DAY_GANZHI_ANCHOR_SOLAR = SolarDay.fromYmd(1900, 1, 1);
const DAY_GANZHI_ANCHOR_INDEX = getSixtyCycleIndex('甲戌');
const zhongqi: Record<string, string> = { 雨水: '亥', 春分: '戌', 谷雨: '酉', 小满: '申', 夏至: '未', 大暑: '午', 处暑: '巳', 秋分: '辰', 霜降: '卯', 小雪: '寅', 冬至: '丑', 大寒: '子' };

/** 按连续公历日差值推算日干支（兼容 1582 年格里高利历断层；23 时起默认进次日）。 */
export function getSolarYmdDaySixtyCycle(year: number, month: number, day: number, hour = 12): string {
  const dayOffset = SolarDay.fromYmd(year, month, day).subtract(DAY_GANZHI_ANCHOR_SOLAR) + (hour >= 23 ? 1 : 0);
  return getSixtyCycleName(DAY_GANZHI_ANCHOR_INDEX + dayOffset);
}

/** 从 tyme4ts 历表定位给定时刻所处的最新节气“节”（按 JulianDay 精确比较，修正公元早期 getTerm 的日期构造偏移）。 */
export function resolveActiveJie(st: ReturnType<typeof SolarTime.fromYmdHms>): {
  jie: ReturnType<typeof SolarTerm.fromIndex>;
  beforeYear1XiaoHan: boolean;
} {
  if (st.getYear() === 1 && st.getMonth() === 1) {
    const xiaoHan1 = SolarTerm.fromIndex(1, 1);
    if (st.isBefore(xiaoHan1.getJulianDay().getSolarTime())) {
      return { jie: xiaoHan1, beforeYear1XiaoHan: true };
    }
    return { jie: xiaoHan1, beforeYear1XiaoHan: false };
  }
  const term = st.getTerm();
  let jie = term.isJie() ? term : term.next(-1);
  for (let i = 0; i < 4; i++) {
    if (jie.getYear() === 1 && jie.getIndex() <= 1) {
      if (st.isBefore(jie.getJulianDay().getSolarTime())) {
        return { jie, beforeYear1XiaoHan: true };
      }
      break;
    }
    if (!st.isBefore(jie.getJulianDay().getSolarTime())) break;
    jie = jie.next(-2);
  }
  for (let i = 0; i < 4; i++) {
    if (jie.getYear() === 9999 && jie.getIndex() >= 23) break;
    const nextJie = jie.next(2);
    if (st.isBefore(nextJie.getJulianDay().getSolarTime())) break;
    jie = nextJie;
  }
  return { jie, beforeYear1XiaoHan: false };
}

/** 仅向 tyme4ts 读取交节瞬时以定位当前节，四柱全部由自研干支算子（五虎遁/五鼠遁/连续日序）推导。 */
export function getSolarYmdHmsPillars(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): { year: string; month: string; day: string; hour: string; solarTermYear: number; jieName: string } {
  const st = SolarTime.fromYmdHms(year, month, day, hour, minute, second);
  const { jie, beforeYear1XiaoHan } = resolveActiveJie(st);
  const jieName = beforeYear1XiaoHan ? '大雪' : jie.getName();
  const monthIdx = beforeYear1XiaoHan ? 10 : JIE_TERM_MONTH_INDEX[jieName];
  if (monthIdx === undefined) throw new Error(`历表节气名称异常：${jieName}`);
  const solarTermYear = beforeYear1XiaoHan ? 0 : getSolarTermYearFromJie(jie.getYear(), jie.getIndex());
  const dayGanZhi = getSolarYmdDaySixtyCycle(year, month, day, hour);
  return {
    year: getYearSixtyCycle(solarTermYear),
    month: getYearMonthGanZhi(solarTermYear, monthIdx),
    day: dayGanZhi,
    hour: getHourSixtyCycle(dayGanZhi, hour),
    solarTermYear,
    jieName,
  };
}

/** 分离读取年月柱（按交节时刻）与日时柱（按当地/排盘时钟）。 */
export function getSplitSolarPillars(
  termClock: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  dayClock: { year: number; month: number; day: number; hour: number },
): { year: string; month: string; day: string; hour: string } {
  const term = getSolarYmdHmsPillars(
    termClock.year,
    termClock.month,
    termClock.day,
    termClock.hour,
    termClock.minute,
    termClock.second,
  );
  const day = getSolarYmdDaySixtyCycle(dayClock.year, dayClock.month, dayClock.day, dayClock.hour);
  return {
    year: term.year,
    month: term.month,
    day,
    hour: getHourSixtyCycle(day, dayClock.hour),
  };
}

function beijing(timestamp: number) {
  const date = new Date(timestamp + 8 * 3_600_000);
  if (!Number.isFinite(date.getTime())) throw new Error('起课时间无效。');
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() };
}
export function getDivinationTime(date: Date, timezoneOffsetMinutes = 480) {
  if (!Number.isInteger(timezoneOffsetMinutes) || timezoneOffsetMinutes < -720 || timezoneOffsetMinutes > 840) throw new Error('时区偏移必须是 -720 至 840 分钟的整数。');
  const timestamp = date.getTime(), p = beijing(timestamp), local = beijing(timestamp + (timezoneOffsetMinutes - 480) * 60_000);
  return { ganzhi: getSplitSolarPillars(p, local), timestamp, timezoneOffsetMinutes };
}
export function getMonthLeaderByZhongqi(timestamp: number) {
  const p = beijing(timestamp), current = SolarTime.fromYmdHms(p.year, p.month, p.day, p.hour, p.minute, p.second).getJulianDay().getDay();
  let active: string | undefined = p.year === 1 ? '冬至' : undefined, activeTime = -Infinity;
  for (const year of [p.year, p.year + 1]) {
    const first = year === 1 ? 2 : 0, last = year === p.year ? 22 : 0;
    for (let index = first; index <= last; index += 2) {
      const term = SolarTerm.fromIndex(year, index);
      const time = term.getJulianDay().getSolarTime().getJulianDay().getDay();
      if (time <= current && time > activeTime) { activeTime = time; active = term.getName(); }
    }
  }
  if (!active || !zhongqi[active]) throw new Error('历表无法定位占时之前已交的中气。');
  return zhongqi[active];
}
/** 最近已交节气，按北京时间的实际交节秒数定位。 */
export function getSolarTermName(timestamp: number) {
  const p = beijing(timestamp);
  return SolarTime.fromYmdHms(p.year, p.month, p.day, p.hour, p.minute, p.second).getTerm().getName();
}
