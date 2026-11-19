import { SolarTerm } from 'tyme4ts';
import { getDivinationTime } from '../calendar';
import { buildFortuneEvidence } from './fortune-evidence';
import { type calculateBaziFortune } from './fortune';
import { buildPillarFact, type calculateBaziPillars } from './pillars';
import { termTimestamp } from './season';

type Chart = Awaited<ReturnType<typeof calculateBaziPillars>>;
type Fortune = ReturnType<typeof calculateBaziFortune>;

/** 按立春年提供节气月；出生和大运交界会裁剪或切分半开区间。 */
export function calculateFortuneYear(chart: Chart, fortune: Fortune, year: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new Error('流月时间线年份须在 1900 至 2199 之间。');
  if (chart.basis.precision !== 'exact' || chart.basis.utcTimestamp !== fortune.birthTimestamp) throw new Error('岁运与本命出生瞬时不一致。');
  const first = SolarTerm.fromIndex(year, 3);
  const terms = Array.from({ length: 13 }, (_, index) => {
    const term = first.next(index * 2);
    return { name: term.getName(), timestamp: termTimestamp(term) };
  });
  const yearStart = terms[0].timestamp, yearEnd = terms[12].timestamp;
  const start = Math.max(yearStart, fortune.birthTimestamp);
  const end = Math.min(yearEnd, fortune.cycles.at(-1)!.endTimestamp);
  if (start >= end) throw new Error('所选流年与出生后已计算的大运范围没有交集。');
  const boundaries = [...new Set([start, end, ...terms.map((term) => term.timestamp), ...fortune.cycles.map((cycle) => cycle.startTimestamp)]
    .filter((timestamp) => timestamp >= start && timestamp <= end))].sort((a, b) => a - b);
  const dayMaster = chart.pillars.day.gan;
  const segments = boundaries.slice(0, -1).map((timestamp, index) => {
    const endTimestamp = boundaries[index + 1];
    const monthIndex = terms.findIndex((term) => term.timestamp > timestamp) - 1;
    const cycle = fortune.cycles.find((item) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp) ?? null;
    const childhood = !!fortune.childhood && fortune.childhood.startTimestamp <= timestamp && timestamp < fortune.childhood.endTimestamp;
    if (monthIndex < 0 || monthIndex >= 12 || (!cycle && !childhood)) throw new Error('无法定位流月或大运区间。');
    const ganZhi = getDivinationTime(new Date(timestamp)).ganzhi;
    const flowYear = buildPillarFact(ganZhi.year, dayMaster), month = buildPillarFact(ganZhi.month, dayMaster);
    const active = [
      ...(cycle ? [{ id: 'dayun' as const, ganZhi: cycle.ganZhi, pillar: cycle.pillar }] : []),
      { id: 'year' as const, ganZhi: flowYear.ganZhi, pillar: flowYear },
      { id: 'month' as const, ganZhi: month.ganZhi, pillar: month },
    ];
    return { startTimestamp: timestamp, endTimestamp, endExclusive: true as const, jie: terms[monthIndex], nextJie: terms[monthIndex + 1],
      cycle: cycle ? { index: cycle.index, ganZhi: cycle.ganZhi, startTimestamp: cycle.startTimestamp, endTimestamp: cycle.endTimestamp } : null,
      childhood, year: flowYear, month, evidence: buildFortuneEvidence(chart.pillars, active) };
  });
  return { year, timezone: 'UTC+08:00' as const, yearStartTimestamp: yearStart, yearEndTimestamp: yearEnd,
    startTimestamp: start, endTimestamp: end, endExclusive: true as const, segments,
    limitation: '按北京时间立春年至下一立春，流月按交节切分；仅覆盖出生后已计算的大运范围。区间关系只涉及本命、大运、流年和流月，不代表整段内的流日、流时或现实事件。' };
}
