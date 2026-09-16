import {
  buildAstrolabePeriodEventLayers,
  type AstrolabePeriodBatchRange,
  type AstrolabePeriodBatchResult,
  type AstrolabePeriodContext,
  type AstrolabePeriodEvent,
  type AstrolabePeriodEventCollection,
  type AstrolabePeriodScopeMode,
} from 'mingyu-core/divination/astrolabe-scope';

export const DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS = 7;

type CivilDate = {
  year: number;
  month: number;
  day: number;
};

type DateRange = AstrolabePeriodBatchRange;
type PeriodBatchPayload = AstrolabePeriodBatchResult;

export type AstrolabePeriodBatchFetcher = (
  input: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<unknown>;

export type AstrolabePeriodCollectionResult = AstrolabePeriodEventCollection & {
  parentRange: DateRange;
  sampleStepDays: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function formatDate(value: CivilDate) {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function parseDate(value: string, label: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} 必须使用 YYYY-MM-DD 格式。`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`${label} 不是有效日期。`);
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addDays(value: CivilDate, days: number): CivilDate {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function compareDates(first: CivilDate, second: CivilDate) {
  return (
    Date.UTC(first.year, first.month - 1, first.day) -
    Date.UTC(second.year, second.month - 1, second.day)
  );
}

function daySpan(start: CivilDate, endExclusive: CivilDate) {
  return Math.round(compareDates(endExclusive, start) / 86400000);
}

function rangeFromDates(start: CivilDate, endExclusive: CivilDate): DateRange {
  if (compareDates(start, endExclusive) >= 0) {
    throw new Error('星盘周期范围的结束日期必须晚于起始日期。');
  }
  return { startDate: formatDate(start), endDate: formatDate(endExclusive), endExclusive: true };
}

function dateRangeFromValue(value: unknown, label: string): DateRange | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error(`${label} 格式无效。`);
  const startDate = value.startDate;
  const endDate = value.endDate;
  if (typeof startDate !== 'string' || typeof endDate !== 'string') {
    throw new Error(`${label} 必须包含 startDate 和 endDate。`);
  }
  const range = rangeFromDates(
    parseDate(startDate, `${label}.startDate`),
    parseDate(endDate, `${label}.endDate`),
  );
  if (value.endExclusive !== true) {
    throw new Error(`${label}.endExclusive 必须为 true。`);
  }
  return range;
}

function sameRange(first: DateRange, second: DateRange) {
  return first.startDate === second.startDate && first.endDate === second.endDate;
}

function resolvePeriodRange(scope: AstrolabePeriodScopeMode, dateStr: string): DateRange {
  if (scope === 'yearly') {
    const match = /^(\d{4})$/.exec(dateStr.trim());
    if (!match) throw new Error('流年周期日期必须使用 YYYY 格式。');
    const year = Number(match[1]);
    return rangeFromDates({ year, month: 1, day: 1 }, { year: year + 1, month: 1, day: 1 });
  }

  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`${scope === 'monthly' ? '流月' : '流日'}周期日期格式无效。`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] === undefined ? 1 : Number(match[3]);
  const start = parseDate(`${match[1]}-${match[2]}-${String(day).padStart(2, '0')}`, '周期日期');
  if (scope === 'monthly') {
    if (match[3] !== undefined) throw new Error('流月周期日期必须使用 YYYY-MM 格式。');
    const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    return rangeFromDates({ year, month, day: 1 }, { ...nextMonth, day: 1 });
  }
  if (match[3] === undefined) throw new Error('流日周期日期必须使用 YYYY-MM-DD 格式。');
  return rangeFromDates(start, addDays(start, 1));
}

function unwrapBatchPayload(value: unknown): Record<string, unknown> {
  const candidates: unknown[] = [value];
  if (isRecord(value) && isRecord(value.data)) candidates.push(value.data);
  if (isRecord(value) && isRecord(value.result)) candidates.push(value.result);
  if (isRecord(value) && isRecord(value.data) && isRecord(value.data.result)) {
    candidates.push(value.data.result);
  }
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    if (Array.isArray(candidate.events)) return candidate;
    if (isRecord(candidate.periodEvents) && Array.isArray(candidate.periodEvents.events)) {
      return candidate.periodEvents;
    }
    if (isRecord(candidate.scopeEvidence)) {
      const evidence = candidate.scopeEvidence;
      if (Array.isArray(evidence.events)) return evidence;
      if (isRecord(evidence.periodEvents) && Array.isArray(evidence.periodEvents.events)) {
        return evidence.periodEvents;
      }
    }
  }
  throw new Error('星盘周期批次未返回事件明细。');
}

function readBatchPayload(
  value: unknown,
  requested: DateRange,
  parentRange: DateRange,
  scope: AstrolabePeriodScopeMode,
  dateStr: string,
): PeriodBatchPayload {
  const raw = unwrapBatchPayload(value);
  const range = dateRangeFromValue(raw.range, 'range');
  const actualParentRange = dateRangeFromValue(raw.parentRange, 'parentRange');
  if (!range || !actualParentRange || !Object.hasOwn(raw, 'nextRange')) {
    throw new Error('星盘周期批次缺少完整范围信息。');
  }
  const nextRange = raw.nextRange === null ? null : dateRangeFromValue(raw.nextRange, 'nextRange');
  if (raw.nextRange !== null && !nextRange) {
    throw new Error('星盘周期批次缺少有效 nextRange。');
  }
  if (!sameRange(range, requested)) {
    throw new Error(
      `星盘周期批次返回范围不匹配：请求${requested.startDate}至${requested.endDate}。`,
    );
  }
  if (!sameRange(actualParentRange, parentRange)) {
    throw new Error('星盘周期批次返回的完整范围与当前分析对象不一致。');
  }
  if (raw.kind !== 'astrolabe-period-batch') {
    throw new Error('星盘周期批次返回类型无效。');
  }
  if (raw.scope !== scope) {
    throw new Error('星盘周期批次返回的分析范围不一致。');
  }
  if (raw.target !== dateStr) {
    throw new Error('星盘周期批次返回的目标日期不一致。');
  }
  if (nextRange && nextRange.startDate !== range.endDate) {
    throw new Error('星盘周期批次的下一批未从当前批次结束处继续。');
  }
  if (
    nextRange &&
    compareDates(
      parseDate(nextRange.endDate, 'nextRange.endDate'),
      parseDate(parentRange.endDate, 'parentRange.endDate'),
    ) > 0
  ) {
    throw new Error('星盘周期批次的下一批超出完整分析范围。');
  }
  if (!Array.isArray(raw.events)) throw new Error('星盘周期批次未返回 events 数组。');
  const events = raw.events.map((event, index) => {
    if (!isRecord(event) || typeof event.key !== 'string' || typeof event.kind !== 'string') {
      throw new Error(`星盘周期批次 events[${index}] 格式无效。`);
    }
    if (typeof event.julianDate !== 'number' || !Number.isFinite(event.julianDate)) {
      throw new Error(`星盘周期批次 events[${index}] 缺少有效 julianDate。`);
    }
    return event as unknown as AstrolabePeriodEvent;
  });
  const timezone = raw.timezone;
  if (typeof timezone !== 'number' || !Number.isFinite(timezone)) {
    throw new Error('星盘周期批次未返回有效 timezone。');
  }
  const sampleStepDays = raw.sampleStepDays;
  if (
    typeof sampleStepDays !== 'number' ||
    !Number.isFinite(sampleStepDays) ||
    sampleStepDays <= 0
  ) {
    throw new Error('星盘周期批次未返回有效 sampleStepDays。');
  }
  return {
    kind: 'astrolabe-period-batch',
    scope,
    target: dateStr,
    parentRange: actualParentRange,
    range,
    nextRange: nextRange ?? null,
    timezone,
    ...(typeof raw.timeZoneId === 'string' ? { timeZoneId: raw.timeZoneId } : {}),
    sampleStepDays,
    events,
  };
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
}

function sortEvents(events: Iterable<AstrolabePeriodEvent>) {
  return [...events].sort(
    (first, second) => first.julianDate - second.julianDate || first.key.localeCompare(second.key),
  );
}

function dateTimeForRange(date: string) {
  return `${date} 00:00`;
}

export function injectAstrolabePeriodPrompt(scopePrompt: string, periodPrompt: string) {
  const trimmed = periodPrompt.trim();
  if (!trimmed) throw new Error('星盘周期批次未生成完整提示资料。');
  const lines = scopePrompt.split('\n');
  const advancedIndex = lines.findIndex((line) =>
    /^(太阳返照|次限相位：|太阳弧相位：)/.test(line.trim()),
  );
  const insertionIndex = advancedIndex < 0 ? lines.length : advancedIndex;
  const prefixEnd = lines[insertionIndex - 1] === '' ? insertionIndex - 1 : insertionIndex;
  return [...lines.slice(0, prefixEnd), trimmed, ...lines.slice(insertionIndex)].join('\n');
}

export async function fetchAstrolabePeriodCollection(args: {
  scope: AstrolabePeriodScopeMode;
  dateStr: string;
  periodContext: AstrolabePeriodContext;
  fetchBatch: AstrolabePeriodBatchFetcher;
  signal?: AbortSignal;
  batchDays?: number;
}): Promise<AstrolabePeriodCollectionResult> {
  const parentRange = resolvePeriodRange(args.scope, args.dateStr);
  const batchDays = args.batchDays ?? DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS;
  if (!Number.isInteger(batchDays) || batchDays < 1 || batchDays > 31) {
    throw new Error('星盘周期批次数必须是1至31之间的整数。');
  }

  const events = new Map<string, AstrolabePeriodEvent>();
  let currentStart = parseDate(parentRange.startDate, 'parentRange.startDate');
  let timezone = args.periodContext.timezone;
  let timeZoneId = args.periodContext.timeZoneId;
  let sampleStepDays: number | undefined;
  let batchCount = 0;
  const maxBatchCount =
    Math.ceil(
      daySpan(currentStart, parseDate(parentRange.endDate, 'parentRange.endDate')) / batchDays,
    ) + 1;

  while (compareDates(currentStart, parseDate(parentRange.endDate, 'parentRange.endDate')) < 0) {
    assertNotAborted(args.signal);
    if (++batchCount > maxBatchCount) throw new Error('星盘周期批次未能在有限批次内完成。');
    const remaining = daySpan(currentStart, parseDate(parentRange.endDate, 'parentRange.endDate'));
    const requested = rangeFromDates(
      currentStart,
      addDays(currentStart, Math.min(batchDays, remaining)),
    );
    const response = await args.fetchBatch(
      {
        astrolabeScope: args.scope,
        astrolabeScopeDate: args.dateStr,
        astrolabePeriodRange: {
          startDate: requested.startDate,
          endDate: requested.endDate,
        },
        astrolabePeriodContext: args.periodContext,
      },
      args.signal,
    );
    assertNotAborted(args.signal);
    const batch = readBatchPayload(response, requested, parentRange, args.scope, args.dateStr);
    timezone = batch.timezone;
    timeZoneId = batch.timeZoneId ?? timeZoneId;
    sampleStepDays ??= batch.sampleStepDays;
    if (sampleStepDays !== batch.sampleStepDays) {
      throw new Error('星盘周期批次的采样步长不一致。');
    }
    for (const event of batch.events) {
      if (!events.has(event.key)) events.set(event.key, event);
    }

    if (!batch.nextRange) {
      if (batch.range.endDate !== parentRange.endDate) {
        throw new Error('星盘周期批次提前结束，不能把部分结果当作完整周期。');
      }
      currentStart = parseDate(parentRange.endDate, 'parentRange.endDate');
      continue;
    }
    currentStart = parseDate(batch.nextRange.startDate, 'nextRange.startDate');
    if (compareDates(currentStart, parseDate(batch.nextRange.endDate, 'nextRange.endDate')) >= 0) {
      throw new Error('星盘周期批次的下一批范围无效。');
    }
  }

  if (!sampleStepDays) throw new Error('星盘周期未返回任何批次。');
  const sortedEvents = sortEvents(events.values());
  const startDateTime = dateTimeForRange(parentRange.startDate);
  const endDateTime = dateTimeForRange(parentRange.endDate);
  const layers = buildAstrolabePeriodEventLayers(
    sortedEvents,
    startDateTime,
    endDateTime,
    args.scope,
  );
  return {
    startDateTime,
    endDateTime,
    timezoneLabel: timeZoneId
      ? `${timeZoneId}（UTC${timezone >= 0 ? '+' : ''}${timezone}）`
      : `UTC${timezone >= 0 ? '+' : ''}${timezone}`,
    events: sortedEvents,
    ...layers,
    parentRange,
    sampleStepDays,
  };
}
