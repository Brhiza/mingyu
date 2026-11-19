import { SolarTime } from 'tyme4ts';
import { createUtcTimestamp, getCivilDateTimeAtFixedOffset } from '../huangji/civil-time';
import { resolveActiveJie } from '../calendar';
import { EARTHLY_BRANCHES, JIE_TERM_MONTH_INDEX } from '../ganzhi-foundation';

export type BaziCommanderMode = 'standard' | 'yuanhai';

// 当前项目采用的月令司权分日口径（《三命通会/滴天髓》折中表）与《渊海子平·详论节气歌》古法表。
const standardPeriods: Record<string, readonly (readonly [string, number])[]> = {
  寅: [['戊', 7], ['丙', 7], ['甲', 16]], 卯: [['甲', 10], ['乙', 20]], 辰: [['乙', 9], ['癸', 3], ['戊', 18]],
  巳: [['戊', 5], ['庚', 9], ['丙', 16]], 午: [['丙', 10], ['己', 9], ['丁', 11]], 未: [['丁', 9], ['乙', 3], ['己', 18]],
  申: [['戊', 7], ['壬', 7], ['庚', 16]], 酉: [['庚', 10], ['辛', 20]], 戌: [['辛', 9], ['丁', 3], ['戊', 18]],
  亥: [['戊', 7], ['甲', 7], ['壬', 16]], 子: [['壬', 10], ['癸', 20]], 丑: [['癸', 9], ['辛', 3], ['己', 18]],
};
const yuanhaiPeriods: Record<string, readonly (readonly [string, number])[]> = {
  ...standardPeriods,
  寅: [['戊', 7], ['丙', 5], ['甲', 18]],
  巳: [['戊', 7], ['庚', 5], ['丙', 18]],
  申: [['戊', 7], ['壬', 5], ['庚', 18]],
  亥: [['戊', 7], ['甲', 5], ['壬', 18]],
};
const DAY = 86_400_000;
export function termTimestamp(term: ReturnType<ReturnType<typeof SolarTime.fromYmdHms>['getTerm']>) {
  const t = term.getJulianDay().getSolarTime();
  return createUtcTimestamp(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour() - 8, t.getMinute(), t.getSecond());
}

/** 月令分日按实际交节瞬时计算，返回所选口径与可复核半开区间。 */
export function getMonthCommanderAt(timestamp: number, mode: BaziCommanderMode = 'standard') {
  if (!Number.isSafeInteger(timestamp) || timestamp % 1000 !== 0) throw new Error('月令时间须为整秒有效瞬时。');
  const civil = getCivilDateTimeAtFixedOffset(new Date(timestamp), 8);
  const time = SolarTime.fromYmdHms(civil.year, civil.month, civil.day, civil.hour, civil.minute, civil.second);
  const { jie, beforeYear1XiaoHan } = resolveActiveJie(time);
  if (beforeYear1XiaoHan) throw new Error('无法确定交节和月令司权范围。');
  const next = jie.next(2), start = termTimestamp(jie), end = termTimestamp(next);
  const branchIdx = JIE_TERM_MONTH_INDEX[jie.getName()];
  if (branchIdx === undefined) throw new Error('无法确定交节和月令司权范围。');
  const branch = EARTHLY_BRANCHES[(2 + branchIdx) % 12];
  const table = mode === 'yuanhai' ? yuanhaiPeriods : standardPeriods;
  const entries = table[branch];
  if (!entries || timestamp < start || timestamp >= end) throw new Error('无法确定交节和月令司权范围。');
  let from = start;
  for (let index = 0; index < entries.length; index++) {
    const [stem, days] = entries[index];
    const until = index === entries.length - 1 ? end : Math.min(from + days * DAY, end);
    if (timestamp < until) return { stem, branch, index, startTimestamp: from, endTimestamp: until, endExclusive: true as const,
      previousJie: { name: jie.getName(), timestamp: start }, nextJie: { name: next.getName(), timestamp: end },
      rule: mode === 'yuanhai'
        ? '按实际交节瞬时及《渊海子平·详论节气歌》月令分日表（四孟月7/5/18）确定。'
        : '按实际交节瞬时及本项目月令分日表确定；不同文献的分日口径可能不同。' };
    from = until;
  }
  throw new Error('无法定位月令司权阶段。');
}
