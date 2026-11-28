import { SolarTerm, SolarTime } from 'tyme4ts';
import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  getYearSixtyCycle,
  type HeavenlyStem,
} from '../ganzhi-foundation';

export interface BaziFlowDayItem {
  key: string;
  shortDate: string;
  lunarLabel: string;
  year: number;
  month: number;
  day: number;
  ganZhi: string;
}

export interface BaziFlowMonthStartMeta {
  termName: string;
  shortDate: string;
}

export interface BaziFlowHourItem {
  index: number;
  branch: string;
  label: string;
  range: string;
  ganZhi: string;
}

const SHICHEN_RANGES = [
  '23-01',
  '01-03',
  '03-05',
  '05-07',
  '07-09',
  '09-11',
  '11-13',
  '13-15',
  '15-17',
  '17-19',
  '19-21',
  '21-23',
] as const;

const DAY_TO_ZI_STEM_INDEX: Record<string, number> = {
  甲: 0,
  己: 0,
  乙: 2,
  庚: 2,
  丙: 4,
  辛: 4,
  丁: 6,
  壬: 6,
  戊: 8,
  癸: 8,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 按 24 小时北京时间返回对应十二时辰序号（0=子..11=亥）。 */
export function getShichenIndexForBeijingHour(hour24: number): number {
  const normalized = ((Math.floor(hour24) % 24) + 24) % 24;
  return Math.floor((normalized + 1) / 2) % 12;
}

/** 获取指定干支流年与节气月序（0=寅月立春..11=丑月小寒）的起月节气名与公历日期。 */
export function getFlowMonthStartMeta(flowYear: number, monthIndex: number): BaziFlowMonthStartMeta {
  const idx = Math.max(0, Math.min(11, Math.floor(monthIndex)));
  const term = SolarTerm.fromIndex(flowYear, 3 + idx * 2);
  const sd = term.getJulianDay().getSolarDay();
  return {
    termName: term.getName(),
    shortDate: `${sd.getMonth()}/${sd.getDay()}`,
  };
}

/** 按指定干支流年与节气月序（0=寅月立春..11=丑月小寒）枚举该流月包含的全部流日。 */
export function getFlowMonthDays(flowYear: number, monthIndex: number): BaziFlowDayItem[] {
  const idx = Math.max(0, Math.min(11, Math.floor(monthIndex)));
  const startTermIndex = 3 + idx * 2;
  const nextTermIndex = 3 + (idx + 1) * 2;
  const startDay = SolarTerm.fromIndex(flowYear, startTermIndex).getJulianDay().getSolarDay();
  const nextStartDay = SolarTerm.fromIndex(flowYear, nextTermIndex).getJulianDay().getSolarDay();
  const endKey = `${nextStartDay.getYear()}-${pad2(nextStartDay.getMonth())}-${pad2(nextStartDay.getDay())}`;

  const result: BaziFlowDayItem[] = [];
  let cur = startDay;
  for (let step = 0; step < 36; step++) {
    const y = cur.getYear();
    const m = cur.getMonth();
    const d = cur.getDay();
    const key = `${y}-${pad2(m)}-${pad2(d)}`;
    if (key === endKey) break;
    const ganZhi = SolarTime.fromYmdHms(y, m, d, 12, 0, 0).getLunarHour().getEightChar().getDay().getName();
    const lunar = cur.getLunarDay();
    const lunarLabel = lunar.getDay() === 1 ? lunar.getLunarMonth().getName() : lunar.getName();
    result.push({
      key,
      shortDate: `${m}/${d}`,
      lunarLabel,
      year: y,
      month: m,
      day: d,
      ganZhi,
    });
    cur = cur.next(1);
  }
  return result;
}

/** 按五鼠遁由流日干支推算该日十二流时（子时..亥时）。 */
export function getFlowDayHours(dayGanZhi: string): BaziFlowHourItem[] {
  const dayStem = dayGanZhi.slice(0, 1) as HeavenlyStem;
  const ziStemIdx = DAY_TO_ZI_STEM_INDEX[dayStem] ?? 0;
  return EARTHLY_BRANCHES.map((branch, index) => {
    const stem = HEAVENLY_STEMS[(ziStemIdx + index) % 10];
    return {
      index,
      branch,
      label: `${branch}时`,
      range: SHICHEN_RANGES[index]!,
      ganZhi: `${stem}${branch}`,
    };
  });
}

/** 结合节气交节精确计算当前北京时间所属干支流年与节气月序（0=寅月..11=丑月）。 */
export function getCurrentSolarTermMonthIndex(beijingDate: Date): {
  flowYear: number;
  monthIndex: number;
} {
  const civilYear = beijingDate.getUTCFullYear();
  const y = civilYear;
  const m = beijingDate.getUTCMonth() + 1;
  const d = beijingDate.getUTCDate();
  const hh = beijingDate.getUTCHours();
  const mm = beijingDate.getUTCMinutes();
  const ss = beijingDate.getUTCSeconds();

  const ec = SolarTime.fromYmdHms(y, m, d, hh, mm, ss).getLunarHour().getEightChar();
  const yearGanZhi = ec.getYear().getName();
  const monthZhi = ec.getMonth().getEarthBranch().getName();
  const flowYear = getYearSixtyCycle(civilYear) === yearGanZhi ? civilYear : civilYear - 1;
  // 寅(idx=2 in EARTHLY_BRANCHES) -> 0 .. 丑(idx=1) -> 11
  const branchIdx = EARTHLY_BRANCHES.indexOf(monthZhi as (typeof EARTHLY_BRANCHES)[number]);
  const monthIndex = branchIdx >= 0 ? (branchIdx + 10) % 12 : 0;
  return { flowYear, monthIndex };
}
