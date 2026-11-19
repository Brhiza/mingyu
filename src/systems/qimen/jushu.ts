import { SolarTime, type SolarDay, type SolarTerm } from 'tyme4ts';
import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from '../calendar';
import { createUtcTimestamp, getHistoricalTimezoneOffsetAt } from '../huangji/civil-time';

export type QimenJuMethod = 'chaibu' | 'zhirun' | 'maoshan';
export type QimenChaoShenState = '正授' | '超神' | '接气';
export interface QimenJuShuResult {
  isYangDun: boolean;
  juShu: number;
  yuan: string;
  jieQi: string;
  actualJieQi?: string;
  juMethod: QimenJuMethod;
  fuTou?: string;
  fuTouDate?: string;
  chaoShenOrJieQi?: QimenChaoShenState;
  isZhiRun?: boolean;
  juMethodNote?: string;
}

// 每节上、中、下元局数；冬至至芒种为阳遁，夏至至大雪为阴遁。
const yangRules: Record<string, [number, number, number]> = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
  春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8], 立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
};
const yinRules: Record<string, [number, number, number]> = {
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
  秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
};
function rule(term: string) {
  if (yangRules[term]) return { isYangDun: true, ju: yangRules[term] };
  if (yinRules[term]) return { isYangDun: false, ju: yinRules[term] };
  throw new Error(`找不到节气 "${term}" 对应的局数规则。`);
}

const cycle = Array.from({ length: 60 }, (_, i) => HEAVENLY_STEMS[i % 10] + EARTHLY_BRANCHES[i % 12]);
const upperFuTou = new Set(['甲子', '己卯', '甲午', '己酉']);
const yuanNames = ['上元', '中元', '下元'];
const ganZhi = (day: SolarDay) => day.getLunarDay().getSixtyCycle().getName();
const dayDiff = (from: SolarDay, to: SolarDay) => Math.round(Number(to.getJulianDay()) - Number(from.getJulianDay()));
const termDay = (term: SolarTerm, offsetMinutes = 480, timeZoneId?: string) => {
  const time = term.getJulianDay().getSolarTime();
  if (offsetMinutes === 480 && !timeZoneId) return time.getHour() >= 23 ? time.getSolarDay().next(1) : time.getSolarDay();
  const instant = createUtcTimestamp(time.getYear(), time.getMonth() - 1, time.getDay(), time.getHour() - 8, time.getMinute(), time.getSecond());
  const offset = timeZoneId ? getHistoricalTimezoneOffsetAt(new Date(instant), timeZoneId) * 60 : offsetMinutes;
  const local = new Date(instant + offset * 60_000);
  const localTime = SolarTime.fromYmdHms(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds());
  return localTime.getHour() >= 23 ? localTime.getSolarDay().next(1) : localTime.getSolarDay();
};
const formatDay = (day: SolarDay) => `${day.getYear()}-${String(day.getMonth()).padStart(2, '0')}-${String(day.getDay()).padStart(2, '0')}`;

/** 北京时间定局：交节按精确时刻，日干支在晚子时换日。 */
export function getQimenJuShu(
  solar: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  juMethod: QimenJuMethod,
  reference?: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  offsetMinutes = 480,
  timeZoneId?: string,
): QimenJuShuResult {
  if (juMethod !== 'chaibu' && juMethod !== 'zhirun' && juMethod !== 'maoshan') throw new Error(`未知的奇门定局方法：${String(juMethod)}。`);
  const time = SolarTime.fromYmdHms(solar.year, solar.month, solar.day, solar.hour, solar.minute, solar.second);
  const today = solar.hour >= 23 ? time.getSolarDay().next(1) : time.getSolarDay();
  const termTime = reference
    ? SolarTime.fromYmdHms(reference.year, reference.month, reference.day, reference.hour, reference.minute, reference.second)
    : offsetMinutes === 480 && !timeZoneId
      ? time
      : (() => {
          const utcMs = createUtcTimestamp(solar.year, solar.month - 1, solar.day, solar.hour, solar.minute, solar.second) - offsetMinutes * 60_000;
          const bj = new Date(utcMs + 8 * 3_600_000);
          return SolarTime.fromYmdHms(bj.getUTCFullYear(), bj.getUTCMonth() + 1, bj.getUTCDate(), bj.getUTCHours(), bj.getUTCMinutes(), bj.getUTCSeconds());
        })();
  const actualTerm = termTime.getTerm();
  const actualJieQi = actualTerm.getName();

  if (juMethod === 'maoshan') {
    const elapsedDays = termTime.getJulianDay().getDay() - actualTerm.getJulianDay().getDay();
    const yuanIndex = Math.min(2, Math.max(0, Math.floor(elapsedDays / 5)));
    const activeRule = rule(actualJieQi);
    return {
      isYangDun: activeRule.isYangDun, juShu: activeRule.ju[yuanIndex], yuan: yuanNames[yuanIndex],
      jieQi: actualJieQi, actualJieQi, juMethod, isZhiRun: false,
      juMethodNote: `茅山道人法定局：按${actualJieQi}交节瞬时起算，每五日一换元定${yuanNames[yuanIndex]}，不寻符头、不置闰`,
    };
  }

  if (juMethod === 'chaibu') {
    const index = cycle.indexOf(ganZhi(today));
    if (index < 0) throw new Error('无法识别定局日干支。');
    const yuanIndex = Math.floor(index / 5) % 3;
    const fuTou = cycle[index - index % 5];
    const fuTouDay = today.next(-(index % 5));
    const leadDays = dayDiff(fuTouDay, termDay(actualTerm, offsetMinutes, timeZoneId));
    const activeRule = rule(actualJieQi);
    return {
      isYangDun: activeRule.isYangDun, juShu: activeRule.ju[yuanIndex], yuan: yuanNames[yuanIndex],
      jieQi: actualJieQi, actualJieQi, juMethod, fuTou, fuTouDate: formatDay(fuTouDay),
      chaoShenOrJieQi: leadDays === 0 ? '正授' : leadDays > 0 ? '超神' : '接气', isZhiRun: false,
      juMethodNote: `拆补法定局：${fuTou}为甲己符头，按日干支五日一元定${yuanNames[yuanIndex]}，不置闰`,
    };
  }

  // 从天然正授点逐个十五日段向前推算，累计超神达到门槛时在芒种或大雪后置闰。
  let anchor = actualTerm;
  let start: SolarDay | undefined;
  for (let i = 0; i < 240; i++, anchor = anchor.next(-1)) {
    const candidate = termDay(anchor, offsetMinutes, timeZoneId);
    if (!candidate.isAfter(today) && upperFuTou.has(ganZhi(candidate))) { start = candidate; break; }
  }
  if (!start) throw new Error('置闰法无法在前十年内定位天然正授符头。');
  const segments = Math.floor(dayDiff(start, today) / 15);
  let activeTerm = anchor, intercalary = false;
  for (let i = 0; i < segments; i++) {
    const nextStart: SolarDay = start.next(15);
    const nextTerm = activeTerm.next(1);
    const nextIntercalary: boolean = !intercalary && ['芒种', '大雪'].includes(activeTerm.getName()) && dayDiff(nextStart, termDay(nextTerm, offsetMinutes, timeZoneId)) >= 8;
    start = nextStart;
    if (!nextIntercalary) activeTerm = nextTerm;
    intercalary = nextIntercalary;
  }
  const yuanIndex = Math.floor(dayDiff(start, today) / 5);
  const fuTouDay = start.next(yuanIndex * 5);
  const jieQi = activeTerm.getName(), leadDays = dayDiff(start, termDay(activeTerm, offsetMinutes, timeZoneId));
  const activeRule = rule(jieQi);
  const state: QimenChaoShenState = intercalary ? '超神' : leadDays === 0 ? '正授' : leadDays > 0 ? '超神' : '接气';
  const note = intercalary
    ? `置闰法定局：${jieQi}累计超神达到置闰门槛，重复本节三元；当前为闰奇${yuanNames[yuanIndex]}`
    : state === '正授' ? `置闰法定局：${jieQi}交节日恰逢上元符头，为正授${yuanNames[yuanIndex]}`
    : state === '超神' ? `置闰法定局：上元符头先于${jieQi}交节${leadDays}个整日，为超神${yuanNames[yuanIndex]}`
    : `置闰法定局：${jieQi}交节先于上元符头${Math.abs(leadDays)}个整日，为接气${yuanNames[yuanIndex]}`;
  return {
    isYangDun: activeRule.isYangDun, juShu: activeRule.ju[yuanIndex], yuan: yuanNames[yuanIndex],
    jieQi, actualJieQi, juMethod, fuTou: ganZhi(fuTouDay), fuTouDate: formatDay(fuTouDay),
    chaoShenOrJieQi: state, isZhiRun: intercalary, juMethodNote: note,
  };
}
