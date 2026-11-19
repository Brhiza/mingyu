import { sameJsonValue } from './json-value';

export type RangeMetric = { first: number; last: number; min: number; max: number; circularPeriod?: number };
type Branch = { startIndex: number; endIndex: number; fingerprint: string; metrics: Record<string, RangeMetric>; last: unknown };
type Page<B extends Branch> = { range: { totalSeconds: number; endIndex: number; nextCursor: number | null }; branches: B[] };
type Options = { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void; yieldControl?: () => Promise<void> };

/** Align circular metrics to the preceding page before combining extrema. */
export function mergeRangeMetric(first: RangeMetric, second: RangeMetric): RangeMetric {
  if (first.circularPeriod !== second.circularPeriod) throw new Error('连续指标周期不一致。');
  const period = first.circularPeriod, shift = period ? Math.round((first.last - second.first) / period) * period : 0;
  return { first: first.first, last: second.last + shift, min: Math.min(first.min, second.min + shift), max: Math.max(first.max, second.max + shift), ...(period ? { circularPeriod: period } : {}) };
}
export function validateRangeMetric(value: RangeMetric) {
  return value && [value.first, value.last, value.min, value.max].every(Number.isFinite) && value.min <= value.max && value.first >= value.min && value.first <= value.max && value.last >= value.min && value.last <= value.max && (value.circularPeriod === undefined || (Number.isFinite(value.circularPeriod) && value.circularPeriod > 0));
}

/** Check that every published metric matches the branch endpoint charts. */
export function validateBranchMetrics(metrics: Record<string, RangeMetric>, first: Array<[string, number, number?]>, last: Array<[string, number, number?]>, sampleCount: number) {
  const left = new Map(first.map(([key, value, period]) => [key, { value, period }]));
  const right = new Map(last.map(([key, value, period]) => [key, { value, period }]));
  if (left.size !== first.length || right.size !== last.length || Object.keys(metrics).length !== left.size || left.size !== right.size) return false;
  const equal = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-8;
  for (const [key, start] of left) {
    const end = right.get(key), metric = metrics[key];
    if (!end || !metric || !validateRangeMetric(metric) || start.period !== end.period || metric.circularPeriod !== start.period || !equal(metric.first, start.value)) return false;
    const difference = metric.last - end.value;
    if (!equal(difference, start.period ? Math.round(difference / start.period) * start.period : 0)) return false;
    if (sampleCount === 1 && (!equal(metric.min, metric.first) || !equal(metric.max, metric.first) || !equal(metric.last, metric.first))) return false;
  }
  return true;
}
function mergeBranch<B extends Branch>(first: B, second: B) {
  if (first.endIndex !== second.startIndex || first.fingerprint !== second.fingerprint) throw new Error('只有相邻的相同分支可以合并。');
  const keys = Object.keys(first.metrics).sort(), nextKeys = Object.keys(second.metrics).sort();
  if (!sameJsonValue(keys, nextKeys)) throw new Error('相邻分支的连续指标不一致。');
  first.metrics = Object.fromEntries(keys.map((key) => [key, mergeRangeMetric(first.metrics[key], second.metrics[key])]));
  first.endIndex = second.endIndex; first.last = second.last;
}
type RangeInput = { range: { start: string; end: string; cursor?: number; pageSize?: number } };
type RangeBranch<C> = Branch & { first: C; last: C };
type RangePage<I extends RangeInput, B extends RangeBranch<unknown>> = {
  input: Partial<I>;
  range: { startUtc: string; endUtc: string; totalSeconds: number; startIndex: number; endIndex: number; nextCursor: number | null; complete: boolean; endExclusive: boolean };
  branches: B[];
};

export function assertRangePage<I extends RangeInput, C, B extends RangeBranch<C>>(
  page: RangePage<I, B>,
  input: I,
  cursor: number,
  spec: {
    defaultPageSize: number;
    inputKeys: ReadonlyArray<keyof I & string>;
    timestampOf: (chart: C) => number;
    fingerprint: (chart: C) => string;
    samples: (chart: C) => Array<[string, number, number?]>;
  },
) {
  if (!page || !page.input || !page.range || !Array.isArray(page.branches)) throw new Error('出生范围分页格式无效。');
  const start = Date.parse(input.range.start), end = Date.parse(input.range.end), total = (end - start) / 1000;
  const pageSize = input.range.pageSize ?? spec.defaultPageSize, expectedEnd = Math.min(total, cursor + pageSize);
  const pageRecord = page.input as Record<string, unknown>, inputRecord = input as Record<string, unknown>;
  if (spec.inputKeys.some((key) => !sameJsonValue(pageRecord[key], inputRecord[key]))
    || Date.parse(page.input.range?.start ?? '') !== start || Date.parse(page.input.range?.end ?? '') !== end
    || (page.input.range?.cursor ?? 0) !== cursor || (page.input.range?.pageSize ?? spec.defaultPageSize) !== pageSize) {
    throw new Error('出生范围分页输入不一致。');
  }
  const { range } = page;
  if (!Number.isInteger(total) || total < 1 || total > 7200
    || range.startUtc !== new Date(start).toISOString() || range.endUtc !== new Date(end).toISOString()
    || range.totalSeconds !== total || range.startIndex !== cursor || range.endIndex !== expectedEnd
    || range.nextCursor !== (expectedEnd < total ? expectedEnd : null)
    || range.complete !== (cursor === 0 && expectedEnd === total) || range.endExclusive !== true) {
    throw new Error('出生范围分页游标或覆盖范围不一致。');
  }
  let position = cursor;
  for (const branch of page.branches) {
    if (!branch || branch.startIndex !== position || !Number.isInteger(branch.endIndex) || branch.endIndex <= position || branch.endIndex > expectedEnd || !branch.metrics || !Object.keys(branch.metrics).length) {
      throw new Error('出生范围分页分支不连续。');
    }
    if (spec.timestampOf(branch.first) !== start + branch.startIndex * 1000
      || spec.timestampOf(branch.last) !== start + (branch.endIndex - 1) * 1000
      || spec.fingerprint(branch.first) !== branch.fingerprint
      || spec.fingerprint(branch.last) !== branch.fingerprint
      || !validateBranchMetrics(branch.metrics, spec.samples(branch.first), spec.samples(branch.last), branch.endIndex - branch.startIndex)) {
      throw new Error('出生范围分页盘面或指标不一致。');
    }
    position = branch.endIndex;
  }
  if (position !== expectedEnd) throw new Error('出生范围分页存在缺失。');
}

export async function collectRangePages<I extends { range: { cursor?: number } }, D extends Page<Branch>>(
  input: I, fetchPage: (input: I, signal?: AbortSignal) => Promise<D>,
  assertPage: (page: D, input: I, cursor: number) => void, options: Options = {},
) {
  if ((input.range.cursor ?? 0) !== 0) throw new Error('完整区间收集必须从游标 0 开始。');
  const branches = [] as D['branches'];
  let cursor = 0, lastPage: D;
  while (true) {
    if (options.signal?.aborted) throw new Error('出生范围收集已取消。');
    const request = { ...input, range: { ...input.range, cursor } };
    const page = await fetchPage(request, options.signal);
    if (options.signal?.aborted) throw new Error('出生范围收集已取消。');
    assertPage(page, request, cursor);
    for (const item of page.branches) {
      const branch = structuredClone(item), last = branches.at(-1);
      if (last && last.endIndex === branch.startIndex && last.fingerprint === branch.fingerprint) mergeBranch(last, branch);
      else branches.push(branch);
    }
    lastPage = page;
    options.onProgress?.(page.range.endIndex, page.range.totalSeconds);
    if (page.range.nextCursor === null) break;
    cursor = page.range.nextCursor;
    if (options.yieldControl) await options.yieldControl();
  }
  return { lastPage, branches };
}
