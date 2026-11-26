import type { z } from 'zod';
import type { astrolabeRangeInput } from '../schema';
import type { RuntimeContext } from '../runtime-context';
import { sameJsonValue } from '../json-value';
import { resolveBirthClock } from './birth-time';
import { createTimezoneOffsetReader, getCivilDateTimeAtFixedOffset } from './huangji/civil-time';
import { calculateAstrolabeIndependentData, formatAstrolabeClassics, renderAstrolabeIndependentData } from './astrolabe';
import { astroEventLabels, astroEventDirections, astroEclipseLabels } from './astrology/event-labels';
import { buildMethodSituationDigest } from './situation-digest';

export type AstrolabeRangeInput = z.infer<typeof astrolabeRangeInput>;
type Input = AstrolabeRangeInput;
type Chart = Awaited<ReturnType<typeof calculateAstrolabeIndependentData>>;
type PeriodEvent = NonNullable<NonNullable<Chart['flow']>['period']>['events'][number];
export type AstrolabeRangeMetric = { first: number; last: number; min: number; max: number; circularPeriod?: number };
export type AstrolabeRangeBranch = { startIndex: number; endIndex: number; fingerprint: string; first: Chart; last: Chart; metrics: Record<string, AstrolabeRangeMetric> };
const sign = (longitude: number) => Math.floor(((longitude % 360) + 360) % 360 / 30);
const cross = (items: Array<{ moving: string; natal: string; type: string; phase?: string | null }>) => items.map((item) => [item.moving, item.natal, item.type, item.phase ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const pointShape = (items: Array<{ id: string; longitude: number; house?: number; retrograde?: boolean }>) => items.map((item) => ({ id: item.id, sign: sign(item.longitude), house: item.house ?? null, retrograde: item.retrograde ?? null }));
/** Repeated events keep an ordinal within each identical event type and page. */
export function astrolabePeriodOccurrences(events: readonly PeriodEvent[]) {
  const counts = new Map<string, number>();
  return [...events].sort((a, b) => a.utcTimestamp - b.utcTimestamp).map((event) => {
    const touches = (event.touches ?? []).map((touch) => [touch.point, touch.aspect]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const base = JSON.stringify([event.kind, event.moving ?? null, event.target ?? null, event.aspect ?? null, event.direction ?? null, event.sign ?? null, event.house ?? null, event.phase ?? null, event.eclipse ?? null, event.timezone, touches]);
    const sequence = counts.get(base) ?? 0;
    counts.set(base, sequence + 1);
    return { identity: `${base}#${sequence}`, sequence, event };
  });
}
function dynamicShape(chart: Chart) {
  const flow = chart.flow;
  if (!flow) return null;
  const solar = flow.solarReturn;
  return {
    selected: flow.selected,
    transit: flow.transit ? { points: pointShape(flow.transit.points.map((p) => ({ ...p, house: p.natalHouse }))), aspects: cross(flow.transit.aspects) } : null,
    secondary: flow.secondary?.status === 'calculated' ? { status: flow.secondary.status, points: pointShape(flow.secondary.points), aspects: cross(flow.secondary.aspects) } : flow.secondary,
    solarArc: flow.solarArc?.status === 'calculated' ? { status: flow.solarArc.status, points: pointShape(flow.solarArc.points), aspects: cross(flow.solarArc.aspects) } : flow.solarArc,
    solarReturn: solar?.status === 'calculated' ? { status: solar.status, previousIndex: solar.charts.findIndex((c) => c.utcDateTime === solar.previousUtcDateTime), nextIndex: solar.charts.findIndex((c) => c.utcDateTime === solar.nextUtcDateTime),
      charts: solar.charts.map((c) => ({ date: c.utcDateTime.slice(0, 10), houseSystem: c.houseSystem, points: pointShape(c.points), angles: pointShape(c.angles), houses: c.houses.map(sign), internalAspects: cross(c.internalAspects), natalAspects: cross(c.natalAspects), warnings: c.warnings.map((w) => w.kind) })) } : solar,
    period: flow.period ? { page: flow.period.page, bodies: flow.period.bodies, kinds: flow.period.kinds, identities: astrolabePeriodOccurrences(flow.period.events).map((item) => item.identity).sort() } : null,
  };
}
/** Only categorical facts form branches; continuous quantities are tracked separately. */
export function astrolabeRangeFingerprint(chart: Chart) {
  return JSON.stringify({ localDate: chart.input.birth.year + '-' + chart.input.birth.month + '-' + chart.input.birth.day,
    timezone: chart.basis.timezone, dayChart: chart.basis.dayChart, houseSystem: chart.basis.houseSystem,
    points: pointShape(chart.points).map((p, i) => ({ ...p, dignities: chart.points[i].dignities })),
    derived: pointShape(chart.derived), angles: pointShape(chart.angles), houses: chart.houses.map((house) => house.signIndex),
    aspects: chart.aspects.map((a) => [a.first, a.second, a.type, a.applying]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    patterns: chart.patterns.map((p) => [p.type, p.members.map((m) => m.id), p.apex?.id ?? null, p.sign ?? null, p.house ?? null]),
    warnings: chart.warnings.map((w) => w.kind), flow: dynamicShape(chart) });
}
type Sample = [string, number, number?];
export function astrolabeRangeSamples(chart: Chart): Sample[] {
  const values: Sample[] = [];
  const add = (key: string, value: number | null | undefined, period?: number) => { if (value !== null && value !== undefined && Number.isFinite(value)) values.push([key, value, period]); };
  for (const point of chart.points) { add(`points.${point.id}.longitude`, point.longitude, 360); add(`points.${point.id}.latitude`, point.latitude); add(`points.${point.id}.distance`, point.distance); add(`points.${point.id}.speed`, point.speed); }
  for (const point of [...chart.derived, ...chart.angles]) add(`points.${point.id}.longitude`, point.longitude, 360);
  for (const house of chart.houses) add(`houses.${house.house}.longitude`, house.longitude, 360);
  for (const aspect of chart.aspects) { const key = `aspects.${aspect.first}.${aspect.second}.${aspect.type}`; add(`${key}.deviation`, aspect.deviation); add(`${key}.separation`, aspect.separation); add(`${key}.strength`, aspect.strength); }
  for (const pattern of chart.patterns) add(`patterns.${JSON.stringify([pattern.type, pattern.members.map((m) => m.id), pattern.apex?.id ?? null, pattern.sign ?? null, pattern.house ?? null])}.maxOrb`, pattern.maxOrb);
  const correction = chart.basis.trueSolarTimeCorrection;
  if (correction) { add('trueSolar.longitudeCorrectionMinutes', correction.longitudeCorrectionMinutes); add('trueSolar.equationOfTimeMinutes', correction.equationOfTimeMinutes); add('trueSolar.totalCorrectionMinutes', correction.totalCorrectionMinutes); }
  const flow = chart.flow;
  if (!flow) return values;
  const moving = (prefix: string, points: Array<{ id: string; longitude: number; speed?: number }>) => points.forEach((p) => { add(`${prefix}.points.${p.id}.longitude`, p.longitude, 360); add(`${prefix}.points.${p.id}.speed`, p.speed); });
  const aspectMetrics = (prefix: string, aspects: Array<{ moving: string; natal: string; type: string; deviation: number; actualAngle: number; strength: number }>) => aspects.forEach((a) => { const key = `${prefix}.aspects.${a.moving}.${a.natal}.${a.type}`; add(`${key}.deviation`, a.deviation); add(`${key}.angle`, a.actualAngle); add(`${key}.strength`, a.strength); });
  if (flow.transit) { moving('flow.transit', flow.transit.points); aspectMetrics('flow.transit', flow.transit.aspects); }
  if (flow.secondary?.status === 'calculated') { add('flow.secondary.ageYears', flow.secondary.ageYears); add('flow.secondary.progressedTimestamp', Date.parse(flow.secondary.progressedUtcDateTime)); moving('flow.secondary', flow.secondary.points); aspectMetrics('flow.secondary', flow.secondary.aspects); }
  if (flow.solarArc?.status === 'calculated') { add('flow.solarArc.ageYears', flow.solarArc.ageYears); add('flow.solarArc.arcDegrees', flow.solarArc.arcDegrees, 360); moving('flow.solarArc', flow.solarArc.points); aspectMetrics('flow.solarArc', flow.solarArc.aspects); }
  if (flow.solarReturn?.status === 'calculated') for (const [i, item] of flow.solarReturn.charts.entries()) {
    const prefix = `flow.solarReturn.${i}`; add(`${prefix}.timestamp`, Date.parse(item.utcDateTime)); moving(prefix, [...item.points, ...item.angles]);
    item.houses.forEach((longitude, index) => add(`${prefix}.houses.${index + 1}.longitude`, longitude, 360));
    aspectMetrics(`${prefix}.internal`, item.internalAspects); aspectMetrics(`${prefix}.natal`, item.natalAspects);
  }
  if (flow.period) for (const { identity, event } of astrolabePeriodOccurrences(flow.period.events)) {
    const prefix = `flow.period.events.${identity}`;
    add(`${prefix}.utcTimestamp`, event.utcTimestamp);
    for (const touch of event.touches ?? []) add(`${prefix}.touch.${touch.point}.${touch.aspect}.deviation`, touch.deviation);
  }
  return values;
}
function addMetrics(metrics: Record<string, AstrolabeRangeMetric>, chart: Chart) {
  for (const [key, value, period] of astrolabeRangeSamples(chart)) {
    const old = metrics[key];
    if (!old) { metrics[key] = { first: value, last: value, min: value, max: value, ...(period ? { circularPeriod: period } : {}) }; continue; }
    const adjusted = period ? value + Math.round((old.last - value) / period) * period : value;
    old.last = adjusted; old.min = Math.min(old.min, adjusted); old.max = Math.max(old.max, adjusted);
  }
}
export async function calculateAstrolabeRangeData(input: Input, context?: RuntimeContext) {
  const start = Date.parse(input.range.start), end = Date.parse(input.range.end), total = (end - start) / 1000;
  if (!Number.isInteger(total) || total < 1 || total > 7200) throw new Error('西洋星盘出生范围须为 1 至 7200 秒的半开区间。');
  const birth = input.birth;
  const clock = { year: birth.year, month: birth.month, day: birth.day, hour: birth.hour, minute: birth.minute, second: birth.second ?? 0, timezone: birth.timezone, timeZoneId: birth.timeZoneId };
  if (resolveBirthClock(clock).utcTimestamp !== start) throw new Error('出生钟表时间必须与范围起点表示同一瞬时。');
  const cursor = input.range.cursor ?? 0, pageEnd = Math.min(total, cursor + (input.range.pageSize ?? (input.flow ? 1 : 10)));
  if (cursor >= total) throw new Error('出生范围游标超出范围。');
  const offsetAt = birth.timeZoneId ? createTimezoneOffsetReader(birth.timeZoneId) : () => birth.timezone!;
  const lastLocal = getCivilDateTimeAtFixedOffset(new Date(end - 1000), offsetAt(end - 1000));
  if (lastLocal.year < 1900 || lastLocal.year > 2100) throw new Error('出生范围须完全位于出生地当地 1900 至 2100 年。');
  const branches: AstrolabeRangeBranch[] = [];
  for (let index = cursor; index < pageEnd; index++) {
    const timestamp = start + index * 1000, timezone = offsetAt(timestamp), local = getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone);
    if (local.year < 1900 || local.year > 2100) throw new Error('出生范围须完全位于出生地当地 1900 至 2100 年。');
    const candidate = { ...birth, ...local, timezone };
    const chart = await calculateAstrolabeIndependentData({ birth: candidate, options: input.options, flow: input.flow, prompt: input.prompt }, context);
    if (Date.parse(chart.basis.utcDateTime) !== timestamp) throw new Error('出生候选与真实瞬时不一致。');
    const fingerprint = astrolabeRangeFingerprint(chart), last = branches.at(-1);
    if (last?.fingerprint === fingerprint) { last.endIndex = index + 1; last.last = chart; addMetrics(last.metrics, chart); }
    else { const metrics: Record<string, AstrolabeRangeMetric> = {}; addMetrics(metrics, chart); branches.push({ startIndex: index, endIndex: index + 1, fingerprint, first: chart, last: chart, metrics }); }
  }
  return { input: { birth: input.birth, range: input.range, ...(input.options ? { options: input.options } : {}), ...(input.flow ? { flow: input.flow } : {}), ...(input.prompt ? { prompt: input.prompt } : {}) },
    range: { startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString(), totalSeconds: total, startIndex: cursor, endIndex: pageEnd, nextCursor: pageEnd < total ? pageEnd : null, complete: cursor === 0 && pageEnd === total, endExclusive: true as const }, branches,
    limitation: `逐秒仅计算本页；邻页相同指纹的边界分支可合并。首末盘为实际候选秒，不代表确定出生时刻；连续指标为逐秒采样最小值和最大值，圆周值按顺序展开，可能超出 0–360。${input.flow?.period ? '周期事件仅覆盖所选事件类型、星体与当前周期页；事件时刻范围来自各出生秒的采样。' : '未启用出生范围的周期事件扫描。'}` };
}
export type AstrolabeRangeData = Awaited<ReturnType<typeof calculateAstrolabeRangeData>>;
export function renderAstrolabeRange(data: AstrolabeRangeData, question: string, options?: Input['prompt']) {
  const page = data.range.complete ? '已覆盖整个区间。' : `本页第 ${data.range.startIndex} 至 ${data.range.endIndex - 1} 秒。${data.range.nextCursor === null ? '没有下一页。' : `下一页 cursor=${data.range.nextCursor}；本页不能代表整个区间。`}`;
  const header = `【西洋星盘出生范围】\nUTC ${data.range.startUtc} 至 ${data.range.endUtc}（不含终点），共 ${data.range.totalSeconds} 秒；${page}\n${data.limitation}`;
  const chosen = options ?? data.input.prompt;
  const classics = formatAstrolabeClassics(chosen?.includeClassics);
  const branchOptions = chosen?.includeClassics ? { ...chosen, includeClassics: false } : chosen;
  const seenHeaders = new Set<string>();
  const dedupeBlockHeader = (block: string, branchIndex: number): string => {
    const m = /^【([^】\n]+)】/u.exec(block.trim());
    if (!m) return block;
    const h = m[0];
    if (!seenHeaders.has(h)) {
      seenHeaders.add(h);
      return block.trim();
    }
    return `【分支 ${branchIndex + 1} · ${m[1]}】${block.trim().slice(h.length)}`;
  };
  const branches = data.branches.map((branch, index) => {
    const selected = Object.entries(branch.metrics).filter(([key]) => /^points\.(asc|mc|desc|ic|sun|moon)\.longitude$/.test(key) || /^flow\.(solarReturn\.\d+\.timestamp|solarArc\.arcDegrees|secondary\.progressedTimestamp)$/.test(key));
    const metrics = selected.map(([key, v]) => `${key}: ${v.min} 至 ${v.max}${v.circularPeriod ? `（圆周 ${v.circularPeriod}）` : ''}`).join('\n');
    const period = branch.first.flow?.period, occurrences = period ? astrolabePeriodOccurrences(period.events) : [];
    const shown = chosen?.eventDetail === 'full' ? occurrences : occurrences.slice(0, 20);
    const eventRaw = period ? `【周期事件出生范围】\nUTC ${period.page.start} 至 ${period.page.end}（不含终点）；${period.page.nextCursor ? `下一周期页 cursor=${period.page.nextCursor}` : '该周期没有下一页'}。共 ${occurrences.length} 项，列出 ${shown.length} 项；时刻是该分支出生秒采样的最早至最晚 UTC。\n${shown.map(({ identity, sequence, event }) => {
      const metric = branch.metrics[`flow.period.events.${identity}.utcTimestamp`];
      if (!metric) throw new Error('周期事件缺少时间范围。');
      const details = [event.movingName, event.targetName ? `${event.kind === 'transit_aspect' ? '本命' : ''}${event.targetName}` : undefined, event.aspectName, event.sign, event.house ? `第${event.house}宫` : undefined, event.direction ? astroEventDirections[event.direction] ?? event.direction : undefined, event.phase, event.eclipse ? astroEclipseLabels[event.eclipse] ?? event.eclipse : undefined].filter(Boolean).join(' ');
      const touches = event.touches?.map((touch) => {
        const value = branch.metrics[`flow.period.events.${identity}.touch.${touch.point}.${touch.aspect}.deviation`];
        if (!value) throw new Error('周期事件缺少本命触及范围。');
        return `${touch.pointName}${touch.aspect}偏差${value.min.toFixed(4)}°至${value.max.toFixed(4)}°`;
      }).join('、');
      return `${astroEventLabels[event.kind]} ${details}（同类第${sequence + 1}次）：${new Date(metric.min).toISOString()} 至 ${new Date(metric.max).toISOString()}${touches ? `；${touches}` : ''}`;
    }).join('\n') || '本页无所选事件。'}\n${period.limitations.join('\n')}` : '';
    const rawBranchBlocks = renderAstrolabeIndependentData(branch.first, question, branchOptions, { includePeriod: false }).text
      .split(/\n{2,}(?=【[^】\n]+】)/u)
      .filter((b) => !b.trim().startsWith('【局势要点】'))
      .map((b) => dedupeBlockHeader(b, index));
    const metricsBlock = dedupeBlockHeader(`【连续指标】\n${metrics}\n完整指标见结构化结果。`, index);
    const eventBlock = eventRaw ? dedupeBlockHeader(eventRaw, index) : '';
    return [
      `【${data.range.complete ? '区间' : '本页'}分支 ${index + 1}】\n第 ${branch.startIndex} 至 ${branch.endIndex - 1} 秒；下列为首秒盘，实际范围见指标。`,
      ...rawBranchBlocks,
      metricsBlock,
      eventBlock,
    ].filter(Boolean).join('\n\n');
  });
  const digestLines = buildMethodSituationDigest('astrolabe-range', data, question);
  const digestBlock = digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '';
  const text = [header, digestBlock, classics, ...branches].filter(Boolean).join('\n\n');
  return { text };
}
export async function astrolabeRange(input: Input, context?: RuntimeContext) {
  const data = await calculateAstrolabeRangeData(input, context);
  return { data, summary: { title: '西洋星盘出生范围', lines: [`本页 ${data.range.endIndex - data.range.startIndex}/${data.range.totalSeconds} 秒`, `分支 ${data.branches.length} 个`, data.range.nextCursor === null ? '已到末页' : `下一页：${data.range.nextCursor}`] }, prompt: renderAstrolabeRange(data, input.question, input.prompt) };
}
export async function promptForSavedAstrolabeRange(data: unknown, input: Input, question: string, options?: Input['prompt'], context?: RuntimeContext) {
  const expected = await calculateAstrolabeRangeData(input, context);
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('西洋星盘出生范围结果与输入不一致。');
  return renderAstrolabeRange(expected, question, options);
}
