import type { z } from 'zod';
import type { qizhengRangeInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { resolveBirthClock } from './birth-time';
import { createTimezoneOffsetReader, getCivilDateTimeAtFixedOffset } from './huangji/civil-time';
import { calculateQizhengData, QIZHENG_ELEVEN_STARS, renderQizhengData } from './qizheng';
import { formatClassicExcerpts, selectQizhengClassics } from './classics';
import { createSolarIlluminationCalculator } from './astronomy/solar-illumination';
import { createQizhengMoonPhaseCalculator } from './qizheng/moon-phase';
import { createPeriodSampleCache } from './qizheng/period-events';
import { resolveFlowTime } from './qizheng/flow-time';
import { renderQizhengStarMeanings } from './qizheng/star-meanings';

export type QizhengRangeInput = z.infer<typeof qizhengRangeInput>;
type Input = QizhengRangeInput;
type Chart = Awaited<ReturnType<typeof calculateQizhengData>>;
export type QizhengRangeMetric = { first: number; last: number; min: number; max: number; circularPeriod?: number };
type Metric = QizhengRangeMetric;
export type QizhengRangeBranch = { startIndex: number; endIndex: number; fingerprint: string; first: Chart; last: Chart; metrics: Record<string, Metric> };
type Branch = QizhengRangeBranch;
type PeriodEvent = NonNullable<NonNullable<Chart['flowing']>['period']>['events'][number];

/** 同类事件可能在一个周期内多次出现，按发生顺序编号。 */
export function qizhengPeriodEventOccurrences(events: readonly PeriodEvent[]) {
  const counts = new Map<string, number>();
  return [...events].sort((a, b) => a.utcTimestamp - b.utcTimestamp).map((event) => {
    const base = JSON.stringify([event.kind, event.movingStar, event.targetStar ?? null, event.aspectType ?? null, event.aspectDirection ?? null, event.stationDirection ?? null, event.palace ?? null, event.signBranch ?? null, event.timezone]);
    const sequence = counts.get(base) ?? 0;
    counts.set(base, sequence + 1);
    return { identity: `${base}#${sequence}`, event };
  });
}

function discreteStars(stars: Chart['stars']) {
  return stars.map(({ name, kind, xiu, sevenStar, signIndex, signBranch, palace, retrograde, dignity, source, precision }) => ({ name, kind, xiu, sevenStar, signIndex, signBranch, palace, retrograde, dignity, source, precision }));
}
function discreteAspects(aspects: Chart['aspects']) {
  return aspects.map(({ star1, star2, type, closeness, precisionClass }) => ({ star1, star2, type, closeness, precisionClass })).sort((a, b) => {
    const left = `${a.star1}:${a.star2}:${a.type}`, right = `${b.star1}:${b.star2}:${b.type}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
// 指纹只包含离散事实；连续数值另外逐秒统计，避免每秒都产生一个分支。
export function qizhengRangeFingerprint(chart: Chart) {
  return JSON.stringify({
    localDate: chart.basis.localDateTime.slice(0, 10), timezone: chart.basis.timezone, timeBranchIndex: chart.basis.timeBranchIndex,
    mingGong: chart.mingGong, shenGong: chart.shenGong, mingZhu: chart.mingZhu, twelvePalaces: chart.twelvePalaces,
    stars: discreteStars(chart.stars), aspects: discreteAspects(chart.aspects),
    shensha: chart.shensha, enNan: chart.enNan,
    moonPhase: { eightPhaseName: chart.moonPhase.eightPhaseName, waxing: chart.moonPhase.waxing, previous: chart.moonPhase.previous.name, current: chart.moonPhase.current?.name ?? null, next: chart.moonPhase.next.name },
    illumination: { daylight: chart.illumination.daylight, sunriseSunset: chart.illumination.sunriseSunset.status, civilTwilight: chart.illumination.civilTwilight.status, nauticalTwilight: chart.illumination.nauticalTwilight.status, astronomicalTwilight: chart.illumination.astronomicalTwilight.status },
    flowing: chart.flowing ? { time: chart.flowing.time, stars: discreteStars(chart.flowing.stars), transits: discreteAspects(chart.flowing.transits),
      period: chart.flowing.period ? { mode: chart.flowing.period.mode, startUtcMs: chart.flowing.period.startUtcMs, endUtcMs: chart.flowing.period.endUtcMs, movingStars: chart.flowing.period.movingStars, natalStars: chart.flowing.period.natalStars, aspectTypes: chart.flowing.period.aspectTypes, identities: qizhengPeriodEventOccurrences(chart.flowing.period.events).map((item) => item.identity).sort() } : null } : null,
    timeLords: chart.timeLords,
  });
}
export function qizhengRangeSamples(chart: Chart): Array<[string, number, number?]> {
  return [
    ...chart.stars.flatMap((star): Array<[string, number, number?]> => [[`stars.${star.name}.longitude`, star.longitude, 360], [`stars.${star.name}.xiuDegree`, star.xiuDegree]]),
    ...chart.aspects.flatMap((aspect): Array<[string, number, number?]> => [[`aspects.${aspect.star1}.${aspect.star2}.${aspect.type}.actualAngle`, aspect.actualAngle], [`aspects.${aspect.star1}.${aspect.star2}.${aspect.type}.orb`, aspect.orb]]),
    ...(chart.flowing?.stars.flatMap((star): Array<[string, number, number?]> => [[`flowing.stars.${star.name}.longitude`, star.longitude, 360], [`flowing.stars.${star.name}.xiuDegree`, star.xiuDegree]]) ?? []),
    ...(chart.flowing?.transits.flatMap((aspect): Array<[string, number, number?]> => [[`flowing.transits.${aspect.star1}.${aspect.star2}.${aspect.type}.actualAngle`, aspect.actualAngle], [`flowing.transits.${aspect.star1}.${aspect.star2}.${aspect.type}.orb`, aspect.orb], [`flowing.transits.${aspect.star1}.${aspect.star2}.${aspect.type}.orbRatio`, aspect.orbRatio]]) ?? []),
    ...(chart.flowing?.period ? qizhengPeriodEventOccurrences(chart.flowing.period.events).map(({ identity, event }): [string, number] => [`period.events.${identity}.utcTimestamp`, event.utcTimestamp]) : []),
    ['sun.geometricAltitudeDegrees', chart.illumination.sun.geometricAltitudeDegrees], ['sun.azimuthDegrees', chart.illumination.sun.azimuthDegrees, 360],
    ['moon.phaseAngleDegrees', chart.moonPhase.phaseAngleDegrees, 360], ['moon.illuminationFraction', chart.moonPhase.illuminationFraction], ['moon.approximateMoonAgeDays', chart.moonPhase.approximateMoonAgeDays],
  ];
}
function addMetrics(metrics: Record<string, Metric>, chart: Chart) {
  for (const [key, value, period] of qizhengRangeSamples(chart)) {
    const existing = metrics[key];
    if (!existing) { metrics[key] = { first: value, last: value, min: value, max: value, ...(period ? { circularPeriod: period } : {}) }; continue; }
    const adjusted = period ? value + Math.round((existing.last - value) / period) * period : value;
    existing.last = adjusted; existing.min = Math.min(existing.min, adjusted); existing.max = Math.max(existing.max, adjusted);
  }
}
async function calculateRange(input: Input) {
  const start = Date.parse(input.range.start), end = Date.parse(input.range.end), duration = (end - start) / 1000;
  if (!Number.isInteger(duration) || duration < 1 || duration > 7200) throw new Error('七政出生范围必须为 1 至 7200 秒的半开区间。');
  const clock = { ...input.birth, second: input.birth.second ?? 0, ...(input.birth.timeStandard === 'true-solar' ? {} : { longitude: undefined }) };
  if (resolveBirthClock(clock).utcTimestamp !== start) throw new Error('出生钟表时间必须与范围起点表示同一瞬时。');
  const cursor = input.range.cursor ?? 0, pageEnd = Math.min(duration, cursor + (input.range.pageSize ?? (input.periodEvents ? 1 : 30)));
  if (cursor >= duration) throw new Error('范围游标超出待计算的秒数。');
  const readOffset = input.birth.timeZoneId ? createTimezoneOffsetReader(input.birth.timeZoneId) : () => input.birth.timezone!;
  const lastLocal = getCivilDateTimeAtFixedOffset(new Date(end - 1000), readOffset(end - 1000));
  if (lastLocal.year < 1900 || lastLocal.year > 2200) throw new Error('七政出生范围必须完全位于当地 1900 至 2200 年。');
  if (input.gender && input.flow) {
    const flow = resolveFlowTime(input.flow, input.birth);
    if (flow.timestamp < end - 1000 || flow.flowYear < lastLocal.year) throw new Error('行限的流曜时刻不得早于出生时刻；出生范围的所有候选均须满足。');
  }
  const branches: Branch[] = [];
  const context = { solarIllumination: createSolarIlluminationCalculator(), moonPhase: createQizhengMoonPhaseCalculator(),
    ...(input.periodEvents && pageEnd - cursor > 1 ? { periodSamples: createPeriodSampleCache() } : {}) };
  for (let index = cursor; index < pageEnd; index++) {
    const timestamp = start + index * 1000, timezone = readOffset(timestamp);
    const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone);
    if (local.year < 1900 || local.year > 2200) throw new Error('七政出生范围必须完全位于当地 1900 至 2200 年。');
    const birth = { ...input.birth, ...local, timezone };
    const chart = await calculateQizhengData({ birth, gender: input.gender, flow: input.flow, periodEvents: input.periodEvents, options: input.options, prompt: input.prompt }, context);
    const key = qizhengRangeFingerprint(chart), last = branches.at(-1);
    if (last?.fingerprint === key) { last.endIndex = index + 1; last.last = chart; addMetrics(last.metrics, chart); }
    else { const metrics: Record<string, Metric> = {}; addMetrics(metrics, chart); branches.push({ startIndex: index, endIndex: index + 1, fingerprint: key, first: chart, last: chart, metrics }); }
  }
  return { input: { birth: input.birth, range: input.range, ...(input.gender ? { gender: input.gender } : {}), ...(input.flow ? { flow: input.flow } : {}), ...(input.periodEvents !== undefined ? { periodEvents: input.periodEvents } : {}), ...(input.options ? { options: input.options } : {}), ...(input.prompt ? { prompt: input.prompt } : {}) },
    range: { startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString(), totalSeconds: duration, startIndex: cursor, endIndex: pageEnd, nextCursor: pageEnd < duration ? pageEnd : null, complete: cursor === 0 && pageEnd === duration, endExclusive: true as const }, branches,
    limitation: `逐秒采样仅覆盖本页；相邻页指纹相同的边界分支属于同一连续分支。连续指标为采样最小最大值；圆周指标相对分支首值展开，可能超出 0–360。${input.periodEvents ? '周期事件仅覆盖结果列出的星曜与相位；时间范围为出生采样所得最小值和最大值。' : '流曜仅为指定瞬时，未扫描周期事件。'}` };
}
export type QizhengRangeData = Awaited<ReturnType<typeof calculateRange>>;
type Data = QizhengRangeData;
export function renderQizhengRange(data: Data, question: string, options?: Input['prompt']) {
  const header = `【七政四余出生时间范围】\nUTC ${data.range.startUtc} 至 ${data.range.endUtc}（不含终点），共 ${data.range.totalSeconds} 秒；${data.range.complete ? '已覆盖整个区间。' : `本页覆盖第 ${data.range.startIndex} 至 ${data.range.endIndex - 1} 秒。${data.range.nextCursor === null ? '没有下一页。' : `下一页 cursor=${data.range.nextCursor}；本页不能代表完整区间。`}`}\n${data.limitation}`;
  const chosen = options ?? data.input.prompt;
  const meanings = chosen?.includeStarMeanings ? renderQizhengStarMeanings(data.branches[0].first.stars) : '';
  const classics = chosen?.includeClassics ? formatClassicExcerpts(selectQizhengClassics(QIZHENG_ELEVEN_STARS), '典籍片段') : '';
  const branchOptions = chosen && (chosen.includeStarMeanings || chosen.includeClassics)
    ? { ...chosen, includeStarMeanings: false, includeClassics: false }
    : chosen;
  const texts = data.branches.map((branch, index) => {
    const events = chosen?.scope === 'natal' ? [] : qizhengPeriodEventOccurrences(branch.first.flowing?.period?.events ?? []);
    const selected = chosen?.eventDetail === 'full' ? events : events.slice(0, 20);
    const ranges = selected.length ? `\n【周期事件出生范围】\n共 ${events.length} 项，列出 ${selected.length} 项；事件时刻为分支内出生秒采样的最小至最大 UTC。\n${selected.map(({ identity, event }) => {
      const metric = branch.metrics[`period.events.${identity}.utcTimestamp`], occurrence = Number(identity.slice(identity.lastIndexOf('#') + 1)) + 1;
      return `${event.kind} ${event.movingStar}${event.targetStar ? ` → ${event.targetStar}` : ''}${event.aspectType ? ` ${event.aspectType}` : ''}${event.aspectDirection ? ` ${event.aspectDirection}` : ''}${event.stationDirection ? ` ${event.stationDirection}` : ''}${event.signBranch ? ` ${event.signBranch}宫${event.palace ?? ''}` : ''}（同类第${occurrence}次）：${new Date(metric.min).toISOString()} 至 ${new Date(metric.max).toISOString()}`;
    }).join('\n')}` : '';
    return `【${data.range.complete ? '区间' : '本页'}分支 ${index + 1}】\n第 ${branch.startIndex} 至 ${branch.endIndex - 1} 秒；以下仅为该分支首秒盘面，连续指标范围见结构化结果。\n${renderQizhengData(branch.first, question, branchOptions).text}${ranges}`;
  });
  const diffSummary = data.branches.length > 1
    ? `【分支差异速览】\n${data.branches.map((branch, idx) => {
        const f = branch.first;
        const moon = f.stars.find((s) => s.name === '月亮');
        return `分支 ${idx + 1}（第 ${branch.startIndex}–${branch.endIndex - 1} 秒）：命宫${f.mingGong}、身宫${f.shenGong}、命主${f.mingZhu}、度主${f.mingDu.duZhu}${moon ? `、月亮在${moon.signBranch}宫${moon.palace}` : ''}`;
      }).join('\n')}`
    : '';
  const text = [header, diffSummary, meanings, classics, ...texts].filter(Boolean).join('\n\n');
  return { text };
}
export async function qizhengRange(input: Input) {
  const data = await calculateRange(input);
  return { data, summary: { title: '七政四余出生范围', lines: [`本页 ${data.range.endIndex - data.range.startIndex}/${data.range.totalSeconds} 秒`, `本页分支：${data.branches.length}`, data.range.nextCursor === null ? '已到末页' : `下一页：${data.range.nextCursor}`] }, prompt: renderQizhengRange(data, input.question, input.prompt) };
}
export async function promptForSavedQizhengRange(data: unknown, input: Input, question: string, options?: Input['prompt']) {
  const expected = await calculateRange(input);
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('七政出生范围结果与输入不一致。');
  return renderQizhengRange(expected, question, options);
}
