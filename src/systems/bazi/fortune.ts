import { getYearSixtyCycle, stepSixtyCycle } from '../ganzhi-foundation';
import { getDivinationTime } from '../calendar';
import { calculateDecadalTimeline, chinaParts, chinaTimestamp, shiftCivilYears } from '../luck';
import { buildPillarFact, type BaziRules, type calculateBaziPillars } from './pillars';
import { getMonthCommanderAt } from './season';
import { buildFortuneEvidence } from './fortune-evidence';
import { calculateFortuneShensha } from './fortune-shensha';
import type { BaziShenshaOptions } from './shensha';

type Chart = Awaited<ReturnType<typeof calculateBaziPillars>>;

function shiftCivilMonths(value: Parameters<typeof shiftCivilYears>[0], totalMonths: number) {
  const rawMonth = value.month - 1 + totalMonths;
  const year = value.year + Math.floor(rawMonth / 12);
  const month = (rawMonth % 12) + 1;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const last = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return { ...value, year, month, day: Math.min(value.day, last) };
}

/** 已确定出生秒的大运、童限及各运十神等基础事实。 */
export function calculateBaziFortune(chart: Chart, gender: 'male' | 'female', fortuneRule?: BaziRules['fortuneRule']) {
  if (chart.basis.precision !== 'exact') throw new Error('计算精确起运需要明确出生时分秒，不能使用时辰中点。');
  const birthTimestamp = chart.basis.utcTimestamp;
  const timeline = calculateDecadalTimeline(birthTimestamp, gender, {
    yearStem: chart.pillars.year.gan,
    monthPillar: chart.pillars.month.ganZhi,
  });
  const master = chart.pillars.day.gan;
  let { startAge, firstTimestamp, cycles } = timeline;
  let rule = '按出生真实瞬时与节气计算，阳男阴女顺行、阴男阳女逆行；三日折一年，大运十年一交。';
  if (fortuneRule === 'round-day') {
    const roundedDays = Math.round(Math.abs(timeline.term.timestamp - birthTimestamp) / 86_400_000);
    const years = Math.floor(roundedDays / 3);
    const months = (roundedDays % 3) * 4;
    startAge = { years, months, days: 0, hours: 0, minutes: 0 };
    const first = shiftCivilMonths(timeline.birth, years * 12 + months);
    firstTimestamp = chinaTimestamp(first);
    cycles = timeline.cycles.map((cycle, index) => ({
      ...cycle,
      startTimestamp: chinaTimestamp(shiftCivilYears(first, index * 10)),
      endTimestamp: chinaTimestamp(shiftCivilYears(first, (index + 1) * 10)),
    }));
    rule = '按出生真实瞬时与节气时差四舍五入取整日，阳男阴女顺行、阴男阳女逆行；三日折一年，不计余时，大运十年一交。';
  }
  return { birthTimestamp, gender, direction: timeline.direction, term: timeline.term, startAge, firstTimestamp,
    childhood: firstTimestamp > birthTimestamp ? { startTimestamp: birthTimestamp, endTimestamp: firstTimestamp, endExclusive: true as const } : null,
    cycles: cycles.map((cycle) => ({ ...cycle, pillar: buildPillarFact(cycle.ganZhi, master) })),
    rule,
    limitation: '起运依赖具体出生秒；不得把时辰中点或未知时辰的候选当成确定起运。' };
}

type Fortune = ReturnType<typeof calculateBaziFortune>;

/** 依给定瞬时定位大运和北京时间流年、流月、流日、流时；不合成年份级事件结论。 */
export function locateBaziFortune(chart: Chart, fortune: Fortune, timestamp: number, shenshaOptions?: BaziShenshaOptions) {
  if (!Number.isSafeInteger(timestamp) || timestamp % 1000 !== 0 || !Number.isFinite(new Date(timestamp).getTime())) throw new Error('岁运参考时刻须为整秒有效瞬时。');
  if (chart.basis.precision !== 'exact' || chart.basis.utcTimestamp !== fortune.birthTimestamp) throw new Error('岁运与本命出生瞬时不一致。');
  if (timestamp < fortune.birthTimestamp) throw new Error('岁运参考时刻不能早于出生。');
  const cycle = fortune.cycles.find((item) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp);
  const inChildhood = fortune.childhood && fortune.childhood.startTimestamp <= timestamp && timestamp < fortune.childhood.endTimestamp;
  if (!cycle && !inChildhood) throw new Error('岁运参考时刻超出已计算的大运范围。');
  const p = getDivinationTime(new Date(timestamp)), civil = chinaParts(timestamp), master = chart.pillars.day.gan;
  const yearGanZhi = p.ganzhi.year, civilYearGanZhi = getYearSixtyCycle(civil.year);
  const flowYear = civilYearGanZhi === yearGanZhi ? civil.year : civil.year - 1;
  const birthCivilYear = chinaParts(fortune.birthTimestamp).year;
  const birthYearGanZhi = chart.pillars.year.ganZhi;
  const birthFlowYear = getYearSixtyCycle(birthCivilYear) === birthYearGanZhi ? birthCivilYear : birthCivilYear - 1;
  const nominalAge = Math.max(1, flowYear - birthFlowYear + 1);
  const smallCycle = stepSixtyCycle(chart.pillars.hour.ganZhi, fortune.direction === 'forward' ? nominalAge : -nominalAge);
  const year = buildPillarFact(p.ganzhi.year, master), month = buildPillarFact(p.ganzhi.month, master);
  const day = buildPillarFact(p.ganzhi.day, master), hour = buildPillarFact(p.ganzhi.hour, master);
  const active = [
    ...(cycle ? [{ id: 'dayun' as const, ganZhi: cycle.pillar.ganZhi, pillar: cycle.pillar }] : []),
    ...([{ id: 'year' as const, pillar: year }, { id: 'month' as const, pillar: month }, { id: 'day' as const, pillar: day }, { id: 'hour' as const, pillar: hour }].map((layer) => ({ ...layer, ganZhi: layer.pillar.ganZhi }))),
  ];
  return { timestamp, timezone: 'UTC+08:00' as const, cycle: cycle ?? null, inChildhood: Boolean(inChildhood), flowYear,
    year, month, day, hour, evidence: buildFortuneEvidence(chart.pillars, active), shensha: calculateFortuneShensha(chart.pillars, active, fortune.gender, shenshaOptions),
    smallFortune: { nominalAge, pillar: buildPillarFact(smallCycle, master) }, monthCommander: getMonthCommanderAt(timestamp),
    limitation: '流年按立春、流月按交节定位；流日与流时按北京时间计算。小运按本命时柱与所列虚岁顺逆推算。' };
}
