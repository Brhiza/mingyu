import { divinationBoundaries } from './divination-boundaries';

type Range = { start: string; end: string; pillars?: Record<'year' | 'month' | 'day' | 'hour', string> };
type ClockSettings = { timeStandard?: 'beijing' | 'civil' | 'true-solar'; longitude?: number; timezone?: number; timeZoneId?: string };
type Bounds = { start: number; end: number };
type Segment<T> = { startTimestamp: number; endTimestamp: number; endExclusive: true; first: T; last: T };

export function parseDivinationRange(range: Range, label: string): Bounds {
  const start = Date.parse(range.start), end = Date.parse(range.end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start % 1000 || end % 1000 || end <= start || end - start > 7_200_000) throw new Error(`${label}范围须为整秒、起点在前且不超过两小时的半开区间。`);
  return { start, end };
}

export function assertRangePillars(expected: Range['pillars'], actual: Record<'year' | 'month' | 'day' | 'hour', string>, label: string) {
  if (expected && (Object.keys(expected) as Array<keyof typeof expected>).some((key) => actual[key] !== expected[key])) throw new Error(`${label}范围内的干支与所给四柱来源不一致。`);
}

/** 按已知边界切分，并核对每段末秒；调用方决定哪些事实用于合并。 */
export async function partitionDivinationRange<T>(bounds: Bounds, settings: ClockSettings, options: {
  label: string;
  termOffsetsDays?: number[];
  clockHours?: number[];
  calculate: (timestamp: number) => T | Promise<T>;
  fingerprint: (value: T) => string;
  check?: (value: T) => void;
}): Promise<Segment<T>[]> {
  const cuts = await divinationBoundaries(bounds.start, bounds.end, settings, options.termOffsetsDays, options.clockHours);
  const branches: Segment<T>[] = [];
  let previousKey: string | undefined;
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1];
    const first = await options.calculate(a), last = a === b - 1000 ? first : await options.calculate(b - 1000);
    options.check?.(first); options.check?.(last);
    const key = options.fingerprint(first);
    if (key !== options.fingerprint(last)) throw new Error(`${options.label}范围存在未覆盖的盘面边界，不能安全合并。`);
    const previous = branches.at(-1);
    if (previous && previousKey === key) { previous.endTimestamp = b; previous.last = last; }
    else { branches.push({ startTimestamp: a, endTimestamp: b, endExclusive: true, first, last }); previousKey = key; }
  }
  if (!branches.length) throw new Error(`${options.label}范围没有有效分支。`);
  return branches;
}
