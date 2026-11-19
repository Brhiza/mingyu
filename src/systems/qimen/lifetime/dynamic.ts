import { SolarDay, SolarTerm } from 'tyme4ts';
import { createTimezoneOffsetReader, createUtcTimestamp, formatCivilDateTime, getCivilDateTimeAtFixedOffset, resolveCivilDayStart } from '../../huangji/civil-time';
import { branchPalaces } from '../palace';
import { generateQimen } from '../chart';
import type { QimenData } from '../types';
import type { LifetimeStage } from './stages';
import type { DecadalStage } from './decadal';

type Stage = LifetimeStage | DecadalStage;
export interface DynamicRange { startDate: string; endDate: string }
export interface DynamicContext { timezone: number; timeZoneId?: string }
export interface DynamicFact {
  kind: 'annual' | 'month-clash' | 'daily';
  label: string;
  stageIndices: number[];
  interval?: { startTimestamp: number; endTimestamp: number; endExclusive: true };
  timestamp?: number;
  dateTime?: string;
  dates?: Array<{ date: string; ganzhi: string; relation: string; stageIndices: number[] }>;
  flowYear?: string;
  branch?: string;
  palace?: number;
  details: string[];
  supports: string[];
  constraints: string[];
  topics?: string[];
}

const HOUR = 3_600_000, DAY = 24 * HOUR;
const opposite: Record<string, string> = { 子: '午', 丑: '未', 寅: '申', 卯: '酉', 辰: '戌', 巳: '亥', 午: '子', 未: '丑', 申: '寅', 酉: '卯', 戌: '辰', 亥: '巳' };
const monthTerm: Record<string, number> = { 寅: 3, 卯: 5, 辰: 7, 巳: 9, 午: 11, 未: 13, 申: 15, 酉: 17, 戌: 19, 亥: 21, 子: 23, 丑: 1 };
const pad = (n: number) => String(n).padStart(2, '0');
const dateText = (year: number, month: number, day: number) => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('动态日期须为 YYYY-MM-DD。');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const stamp = createUtcTimestamp(year, month - 1, day);
  const check = new Date(stamp);
  if (year < 1900 || year > 2200 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) throw new Error('动态日期须为 1900 至 2200 年的有效公历日。');
  return { year, month, day, stamp };
}
function termInstant(year: number, index: number) {
  const t = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
  return createUtcTimestamp(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour() - 8, t.getMinute(), t.getSecond());
}
const offsetReaders = new WeakMap<DynamicContext, (instant: number) => number>();
function offsetAt(timestamp: number, context: DynamicContext) {
  let offset = context.timezone;
  if (context.timeZoneId) {
    let reader = offsetReaders.get(context);
    if (!reader) {
      reader = createTimezoneOffsetReader(context.timeZoneId);
      offsetReaders.set(context, reader);
    }
    offset = reader(timestamp);
  }
  if (!Number.isInteger(offset * 60) || offset < -12 || offset > 14) throw new Error('动态扫描仅支持整分钟 UTC 偏移。');
  return offset;
}
function local(timestamp: number, context: DynamicContext) { return getCivilDateTimeAtFixedOffset(new Date(timestamp), offsetAt(timestamp, context)); }
function localDate(timestamp: number, context: DynamicContext) { const p = local(timestamp, context); return dateText(p.year, p.month, p.day); }
function dayStart(parts: { year: number; month: number; day: number }, context: DynamicContext) {
  return resolveCivilDayStart({ ...parts, timezone: context.timeZoneId ? undefined : context.timezone, timeZoneId: context.timeZoneId }).utcTimestamp;
}
function shiftedDay(stamp: number, amount: number) { const d = new Date(stamp + amount * DAY); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; }
function stageAtInstant(stages: readonly Stage[], instant: number, date: string) {
  return stages.filter((s) => 'startDateTime' in s && s.startDateTime && 'endDateTimeExclusive' in s && s.endDateTimeExclusive
    ? Date.parse(s.startDateTime) <= instant && instant < Date.parse(s.endDateTimeExclusive)
    : s.calendarStart <= date && date <= s.calendarEnd).map((s) => s.stageIndex);
}
function stageAtDate(stages: readonly Stage[], date: string) { return stages.filter((s) => s.calendarStart <= date && date <= s.calendarEnd).map((s) => s.stageIndex); }
function stagesInInterval(stages: readonly Stage[], start: number, end: number, context: DynamicContext) {
  const first = localDate(start, context), last = localDate(end - 1, context);
  return stages.filter((s) => 'startDateTime' in s && s.startDateTime && 'endDateTimeExclusive' in s && s.endDateTimeExclusive
    ? Date.parse(s.startDateTime) < end && Date.parse(s.endDateTimeExclusive) > start
    : s.calendarStart <= last && s.calendarEnd >= first).map((s) => s.stageIndex);
}

/** 按请求区间生成流年、相冲月建交节和本命空马日支的可核验事实。 */
export function scanLifetimeDynamic(chart: QimenData, stages: readonly Stage[], range: DynamicRange, context: DynamicContext): DynamicFact[] {
  const start = parseDate(range.startDate), end = parseDate(range.endDate);
  if (start.stamp > end.stamp) throw new Error('动态结束日期不能早于起始日期。');
  if (end.year > start.year + 30) throw new Error('动态范围最多支持连续 31 个年份。');
  if (context.timeZoneId) offsetAt(start.stamp, context); else if (!Number.isFinite(context.timezone) || context.timezone < -12 || context.timezone > 14) throw new Error('动态扫描时区无效。');
  const facts: DynamicFact[] = [];
  let cachedYear: number | undefined, cachedYearChart: QimenData | undefined;
  const rangeStart = dayStart(start, context), rangeEnd = dayStart(shiftedDay(end.stamp, 1), context);
  const palaceName = (n: number) => chart.jiuGongGe.find((p) => p.gong === n)?.name ?? `${n}宫`;
  for (let year = start.year; year <= end.year; year++) {
    const yearStart = dayStart({ year, month: 1, day: 1 }, context), nextYear = dayStart({ year: year + 1, month: 1, day: 1 }, context);
    const lichun = termInstant(year, 3);
    for (const [flowYear, phase, lower, upper] of [[year - 1, '立春前', yearStart, lichun], [year, '立春后', lichun, nextYear]] as const) {
      const a = Math.max(lower, rangeStart), b = Math.min(upper, rangeEnd);
      if (a >= b) continue;
      if (flowYear < 1900 || flowYear > 2200) throw new Error(`动态流年 ${flowYear} 超出年盘支持范围。`);
      if (cachedYear !== flowYear || !cachedYearChart) {
        const sample = createUtcTimestamp(flowYear, 5, 15, 12), offset = offsetAt(sample, context);
        cachedYearChart = generateQimen(new Date(sample), chart.method, 'year', 'chaibu', undefined, offset * 60, context.timeZoneId, { evidence: false, seasonality: false });
        cachedYear = flowYear;
      }
      const yearChart = cachedYearChart;
      const ganzhi = yearChart.ganzhi.year, branch = ganzhi[1], palace = branchPalaces[branch];
      const natal = chart.jiuGongGe.find((p) => p.gong === palace);
      if (!natal) throw new Error('流年太岁宫在本命盘中不存在。');
      const details = [`${ganzhi}太岁落${palaceName(palace)}；本命宫门${natal.renPan.door || '无'}、星${natal.tianPan.star || '无'}、神${natal.shenPan.god || '无'}。`];
      const supports: string[] = [], constraints: string[] = [];
      const doorFacts: Record<string, { topics: string[]; fact: string; constraint?: boolean }> = {
        生门: { topics: ['wealth'], fact: '太岁临本命生门，传统门象关联生发与经营。' },
        开门: { topics: ['career'], fact: '太岁临本命开门，传统门象关联对外事务与启动。' },
        休门: { topics: ['family', 'marriage'], fact: '太岁临本命休门，传统门象关联休养、交流与家庭议题。' },
        死门: { topics: ['health'], fact: '太岁临本命死门，传统门象涉及收束与停滞。', constraint: true },
        伤门: { topics: ['relocation'], fact: '太岁临本命伤门，传统门象涉及冲突、损耗与迁动议题。', constraint: true },
        景门: { topics: ['academic', 'career'], fact: '太岁临本命景门，传统门象涉及文书、呈现与声誉议题。' },
        杜门: { topics: ['career'], fact: '太岁临本命杜门，传统门象涉及闭藏与专注。', constraint: true },
        惊门: { topics: ['career'], fact: '太岁临本命惊门，传统门象涉及突发变化与言语争议。', constraint: true },
      };
      const door = doorFacts[natal.renPan.door];
      const topics = new Set(door?.topics ?? ['career']);
      if (door) (door.constraint ? constraints : supports).push(door.fact);
      if (natal.shenPan.god === '六合') { topics.add('marriage'); topics.add('partnership'); supports.push('太岁宫同见六合，传统神象关联合作与协调。'); }
      if (chart.voidBranches?.includes(branch)) supports.push(`流年支${branch}同本命旬空，形成填实条件。`);
      if (chart.horseStar?.branch === branch) { topics.add('relocation'); supports.push(`流年支${branch}同本命驿马，传统取象涉及迁动。`); }
      if (chart.horseStar && opposite[chart.horseStar.branch] === branch) { topics.add('relocation'); supports.push(`流年支${branch}冲本命驿马${chart.horseStar.branch}，传统取象涉及迁动。`); }
      for (const pattern of yearChart.classicPatterns ?? []) if (pattern.palaces.includes(palace)) {
        if (pattern.type === 'good') supports.push(`年盘吉格「${pattern.name}」命中太岁宫。`);
        if (pattern.type === 'bad') constraints.push(`年盘凶格「${pattern.name}」命中太岁宫。`);
      }
      facts.push({ kind: 'annual', label: `${year}年${phase}（${ganzhi}）`, stageIndices: stagesInInterval(stages, a, b, context), interval: { startTimestamp: a, endTimestamp: b, endExclusive: true }, flowYear: ganzhi, branch, palace, details, supports, constraints, topics: [...topics] });
      const clash = opposite[branch], index = monthTerm[clash];
      const instant = termInstant(clash === '丑' ? flowYear + 1 : flowYear, index);
      if (instant >= a && instant < b) {
        const date = localDate(instant, context), localTime = formatCivilDateTime(local(instant, context));
        facts.push({ kind: 'month-clash', label: `${clash}月建交节与${ganzhi}年支相冲`, timestamp: instant, dateTime: localTime, stageIndices: stageAtInstant(stages, instant, date), flowYear: ganzhi, branch: clash, palace: branchPalaces[clash], details: [`${clash}月建与${branch}年支相冲，落${palaceName(branchPalaces[clash])}；交节以实际瞬时定位。`], supports: [], constraints: [] });
      }
    }
  }
  const groups = new Map<string, NonNullable<DynamicFact['dates']>>();
  for (let stamp = start.stamp; stamp <= end.stamp; stamp += DAY) {
    const date = new Date(stamp), year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate(), text = dateText(year, month, day);
    if (context.timeZoneId) {
      // Verify local noon with sampled offsets; unusual gaps or overlaps fall back to full resolver.
      const noon = stamp + 12 * HOUR, offsets = new Set([-36, 0, 36].map((hours) => offsetAt(noon + hours * HOUR, context)));
      const candidates = [...offsets].filter((offset) => {
        const p = local(noon - offset * HOUR, context);
        return p.year === year && p.month === month && p.day === day && p.hour === 12 && p.minute === 0 && p.second === 0;
      });
      if (candidates.length !== 1) throw new Error(`${context.timeZoneId} 的 ${text} 当地正午不存在或存在歧义。`);
    }
    const ganzhi = SolarDay.fromYmd(year, month, day).getLunarDay().getSixtyCycle().getName(), branch = ganzhi[1];
    const relations = [chart.voidBranches?.includes(branch) ? '本命空亡填实' : '', chart.horseStar?.branch === branch ? '日支同本命驿马' : '', chart.horseStar && opposite[chart.horseStar.branch] === branch ? '日支冲本命驿马' : ''].filter(Boolean);
    for (const relation of relations) {
      const key = `${year}:${relation}`, list = groups.get(key) ?? [];
      list.push({ date: text, ganzhi, relation, stageIndices: stageAtDate(stages, text) }); groups.set(key, list);
    }
  }
  for (const [key, dates] of groups) facts.push({ kind: 'daily', label: key.replace(':', '年'), stageIndices: [...new Set(dates.flatMap((d) => d.stageIndices))], dates, details: ['仅计算当地日支与本命盘的空亡或驿马关系；日期级事实不指定具体时辰。'], supports: [], constraints: [] });
  return facts;
}
