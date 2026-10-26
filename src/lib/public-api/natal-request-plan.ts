import {
  baziCalculator,
  buildBaziFortuneSelectionForDate,
  buildCurrentBaziFortuneSelectionForScope,
  buildFortuneSelectionContext,
  type BaziChartResult,
  type BaziFortuneSelectionValue,
  type Person,
} from 'mingyu-core/bazi';
import { formatCalculatedBaziFortuneBatch } from 'mingyu-core/prompt';
import { MingyuCoreError } from 'mingyu-core/result';
import type { ZiweiFortuneRangeOptions } from 'mingyu-core/ziwei';
import { daysInSolarMonth } from '../date-validation';
import type { ScopeType } from '../../types/analysis';
import {
  BAZI_FORTUNE_SCOPES,
  ZIWEI_PROMPT_SCOPES,
  getZiweiPromptCalculationScopes,
  resolvePromptSelection,
  type PromptSelection,
  type ZiweiPromptScope,
} from './prompt-builders';

type RequestInput = Record<string, unknown>;
type BaziFortuneScope = BaziFortuneSelectionValue['scope'];
export type NatalBatchCursor = { startIndex?: number; limit?: number };

function invalid(field: string, message: string, code = 'INPUT_VALIDATION_FAILED'): never {
  throw new MingyuCoreError({ code, category: 'validation', field, message, recoverable: true });
}

function optionalString(input: RequestInput, field: string): string | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') invalid(field, `${field} 必须是字符串。`);
  return value;
}

function optionalInteger(
  input: RequestInput,
  field: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    invalid(field, `${field} 必须是 ${min} 至 ${max} 之间的整数。`);
  }
  return value;
}

function optionalEnum<const T extends readonly string[]>(
  input: RequestInput,
  field: string,
  values: T,
): T[number] | undefined {
  const value = optionalString(input, field);
  if (value !== undefined && !values.includes(value)) {
    invalid(field, `${field} 必须是以下值之一：${values.join('、')}。`);
  }
  return value;
}

function optionalDate(input: RequestInput, field: string): string | undefined {
  const value = optionalString(input, field);
  if (value === undefined) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) invalid(field, `${field} 需要使用 YYYY-MM-DD 格式。`);
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText),
    month = Number(monthText),
    day = Number(dayText);
  if (
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInSolarMonth(year, month)
  ) {
    invalid(field, `${field} 不是有效日期（年份需在 1900-2100 之间）。`);
  }
  return value;
}

function selectionFor(
  input: RequestInput,
  methodId: 'bazi' | 'ziwei',
  scope?: string,
): PromptSelection | undefined {
  if (input.topicId === undefined && input.subtopicId === undefined && input.scope === undefined)
    return undefined;
  const resolution = resolvePromptSelection({
    methodId,
    topicId: optionalString(input, 'topicId'),
    subtopicId: optionalString(input, 'subtopicId'),
    scope: scope ?? optionalString(input, 'scope'),
  });
  if (!resolution.ok) invalid(resolution.field, resolution.message, resolution.code);
  return resolution.selection;
}

const BAZI_SCOPE_MAP: Partial<Record<string, BaziFortuneScope>> = {
  natal: 'natal',
  full: 'full',
  decadal: 'dayun',
  yearly: 'year',
  monthly: 'month',
  daily: 'day',
};
const BAZI_SELECTION_SCOPE: Record<BaziFortuneScope, string> = {
  natal: 'natal',
  full: 'full',
  dayun: 'decadal',
  year: 'yearly',
  month: 'monthly',
  day: 'daily',
};

export interface BaziPromptRequestPlan {
  scope: BaziFortuneScope;
  selection?: PromptSelection;
  fortuneDate?: string;
  indices: Omit<BaziFortuneSelectionValue, 'scope'>;
  useCurrentDefaults: boolean;
  referenceTimestamp: number;
  fortuneBatch?: NatalBatchCursor;
  unknownTimeBatch?: { startIndex: number; contextKey?: string };
}

/** 协议边界完成出生资料解码后，共用范围优先级、旧字段、互斥项与时间快照。 */
export function planBaziPromptRequest(
  input: RequestInput,
  person: Person,
  now: Date,
): BaziPromptRequestPlan {
  const initialSelection = selectionFor(input, 'bazi');
  const legacyScope = optionalEnum(input, 'baziFortuneScope', BAZI_FORTUNE_SCOPES);
  const unknownTime = person.timeIndex === -1 || person.isThreePillars === true;
  const scope =
    (input.scope !== undefined ? BAZI_SCOPE_MAP[initialSelection!.scope] : legacyScope) ??
    (unknownTime ? 'natal' : (BAZI_SCOPE_MAP[initialSelection?.scope ?? ''] ?? 'dayun'));
  const fortuneDate = optionalDate(input, 'baziFortuneDate');
  const indices = {
    cycleIndex: optionalInteger(input, 'baziFortuneCycleIndex', 0, 99),
    year: optionalInteger(input, 'baziFortuneYear', 1900, 2200),
    month: optionalInteger(input, 'baziFortuneMonth', 1, 12),
    day: optionalInteger(input, 'baziFortuneDay', 1, 33),
  };
  if (fortuneDate) {
    if (scope === 'natal' || scope === 'full')
      invalid(
        'baziFortuneDate',
        'baziFortuneDate 仅适用于 dayun、year、month 或 day 八字命限范围。',
      );
    const conflict = [
      'baziFortuneCycleIndex',
      'baziFortuneYear',
      'baziFortuneMonth',
      'baziFortuneDay',
    ].find((field) => input[field] !== undefined);
    if (conflict) invalid('baziFortuneDate', `baziFortuneDate 不能与 ${conflict} 同时使用。`);
  }
  const fortuneBatch = readNatalBatchCursor(input.fortuneBatch, 'fortuneBatch');
  if (fortuneBatch && (scope !== 'full' || input.scopeBatch !== undefined)) {
    invalid('fortuneBatch', '八字 fortuneBatch 仅支持完整命限，且不能与 scopeBatch 同传。');
  }
  if (!unknownTime && input.unknownTimeBatch !== undefined)
    invalid('unknownTimeBatch', 'unknownTimeBatch 仅适用于出生时辰未知的八字单盘。');
  let unknownTimeBatch: BaziPromptRequestPlan['unknownTimeBatch'];
  if (unknownTime) {
    if (fortuneBatch)
      invalid('fortuneBatch', '出生时辰未知时不能使用 fortuneBatch，请先逐页续取本命候选。');
    if (input.promptScope !== undefined && input.promptScope !== 'origin')
      invalid('promptScope', '出生时辰未知，解读范围仅支持本命候选。');
    if (scope !== 'natal' || fortuneDate)
      invalid('scope', '出生时辰未知，补齐出生时分后才能选择岁运。');
    for (const field of [
      'fortuneBatch',
      'scopeBatch',
      'combinedBatch',
      'rangeBatch',
      'birthTimeRange',
    ]) {
      if (input[field] !== undefined) invalid(field, `未知时辰候选与 ${field} 不能同时使用。`);
    }
    const value = input.unknownTimeBatch;
    if (
      value !== undefined &&
      (!isRecord(value) ||
        Object.keys(value).some((key) => !['startIndex', 'contextKey'].includes(key)))
    ) {
      invalid('unknownTimeBatch', 'unknownTimeBatch 仅接受 startIndex 和 contextKey。');
    }
    const request = (value ?? {}) as RequestInput;
    const contextKey = optionalString(request, 'contextKey');
    if (contextKey !== undefined && !contextKey.trim())
      invalid('unknownTimeBatch.contextKey', 'unknownTimeBatch.contextKey 不能为空。');
    unknownTimeBatch = {
      startIndex: optionalInteger(request, 'startIndex', 0) ?? 0,
      ...(contextKey === undefined ? {} : { contextKey }),
    };
  }
  return {
    scope,
    selection: initialSelection
      ? selectionFor(input, 'bazi', BAZI_SELECTION_SCOPE[scope])
      : undefined,
    fortuneDate,
    indices,
    useCurrentDefaults:
      (input.scope !== undefined || legacyScope === undefined) &&
      fortuneDate === undefined &&
      indices.cycleIndex === undefined &&
      indices.year === undefined,
    referenceTimestamp: now.getTime(),
    fortuneBatch,
    unknownTimeBatch,
  };
}

/** 仅请求的批次进入核心计算；默认定位与旧序号/日期定位共用同一实现。 */
export function calculateBaziPromptPlan(person: Person, plan: BaziPromptRequestPlan) {
  const calculation = plan.unknownTimeBatch
    ? baziCalculator.calculateBaziUnknownTimeBatch(person, plan.unknownTimeBatch)
    : plan.fortuneBatch
      ? baziCalculator.calculateBaziBatch(person, {
          section: 'fortune',
          startIndex: plan.fortuneBatch.startIndex ?? 0,
        })
      : { result: baziCalculator.calculateBazi(person) };
  const result = calculation.result;
  const { scope, fortuneSelectionContext } = resolveBaziFortunePlan(result, plan);
  const fortuneTextBatch = plan.fortuneBatch
    ? formatCalculatedBaziFortuneBatch(
        result,
        (calculation as ReturnType<typeof baziCalculator.calculateBaziBatch>).batch!,
      )
    : undefined;
  return {
    result,
    fortuneScope: scope,
    fortuneSelectionContext,
    fortuneTextBatch,
    unknownTimeBatch: plan.unknownTimeBatch
      ? (calculation as ReturnType<typeof baziCalculator.calculateBaziUnknownTimeBatch>).batch
      : undefined,
    selection: plan.selection
      ? selectionFor(
          {
            ...plan.selection,
            topicId: plan.selection.topicId,
            subtopicId: plan.selection.subtopicId,
            scope: BAZI_SELECTION_SCOPE[scope],
          },
          'bazi',
        )
      : undefined,
  };
}

export function resolveBaziFortunePlan(result: BaziChartResult, plan: BaziPromptRequestPlan) {
  const timed = plan.scope !== 'natal' && plan.scope !== 'full';
  const current =
    plan.useCurrentDefaults && timed
      ? buildCurrentBaziFortuneSelectionForScope(
          result,
          plan.scope as Exclude<BaziFortuneScope, 'natal' | 'full'>,
          new Date(plan.referenceTimestamp),
        )
      : null;
  const scope = plan.useCurrentDefaults && timed && !current ? 'natal' : plan.scope;
  let value: BaziFortuneSelectionValue;
  try {
    value = plan.fortuneDate
      ? buildBaziFortuneSelectionForDate(
          result,
          scope as Exclude<BaziFortuneScope, 'natal' | 'full'>,
          plan.fortuneDate,
        )
      : {
          ...current,
          ...Object.fromEntries(
            Object.entries(plan.indices).filter(([, item]) => item !== undefined),
          ),
          scope,
        };
    const required =
      scope === 'dayun'
        ? ([['cycleIndex', 'baziFortuneCycleIndex']] as const)
        : scope === 'year'
          ? ([['year', 'baziFortuneYear']] as const)
          : scope === 'month'
            ? ([
                ['year', 'baziFortuneYear'],
                ['month', 'baziFortuneMonth'],
              ] as const)
            : scope === 'day'
              ? ([
                  ['year', 'baziFortuneYear'],
                  ['month', 'baziFortuneMonth'],
                  ['day', 'baziFortuneDay'],
                ] as const)
              : [];
    for (const [key, field] of required) {
      if (value[key] === undefined)
        invalid(
          field,
          `选择${scope === 'dayun' ? '大运' : '流年、流月或流日'}时必须提供 ${field}。`,
        );
    }
    return { scope, fortuneSelectionContext: buildFortuneSelectionContext(result, value) };
  } catch (error) {
    if (error instanceof MingyuCoreError) throw error;
    invalid(
      plan.fortuneDate ? 'baziFortuneDate' : 'baziFortuneScope',
      error instanceof Error ? error.message : '八字年限参数无效。',
    );
  }
}

function isRecord(value: unknown): value is RequestInput {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readNatalBatchCursor(value: unknown, field: string): NatalBatchCursor | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) invalid(field, `${field} 必须是对象。`);
  return {
    startIndex: optionalInteger(value, 'startIndex', 0),
    limit: optionalInteger(value, 'limit', 1, 1),
  };
}

export type ZiweiScopeBatchMetadata = {
  requestedScope: 'full';
  scopes: ScopeType[];
  startIndex: number;
  endIndexExclusive: number;
  totalScopes: number;
  nextIndex: number | null;
};

export function resolveZiweiScopeBatchPlan(scope: ZiweiPromptScope, cursor?: NatalBatchCursor) {
  const requestedScopes = getZiweiPromptCalculationScopes(scope);
  if (cursor === undefined) return { scopes: requestedScopes };
  if (scope !== 'full') invalid('scopeBatch', 'scopeBatch 仅在紫微 promptScope=full 时生效。');
  const startIndex = cursor.startIndex ?? 0;
  if (startIndex >= requestedScopes.length)
    invalid(
      'scopeBatch.startIndex',
      'scopeBatch.startIndex 已超出 full 紫微资料范围。',
      'INPUT_CURSOR_INVALID',
    );
  if (cursor.limit !== undefined && cursor.limit !== 1)
    invalid('scopeBatch.limit', 'scopeBatch.limit 必须为 1。');
  const endIndexExclusive = startIndex + 1;
  const scopes = requestedScopes.slice(startIndex, endIndexExclusive);
  const metadata: ZiweiScopeBatchMetadata = {
    requestedScope: 'full',
    scopes,
    startIndex,
    endIndexExclusive,
    totalScopes: requestedScopes.length,
    nextIndex: endIndexExclusive < requestedScopes.length ? endIndexExclusive : null,
  };
  return { scopes, metadata };
}

export function resolveZiweiBatchPlan(
  scope: ZiweiPromptScope,
  scopeBatch?: NatalBatchCursor,
  fortuneBatch?: NatalBatchCursor,
) {
  if (scopeBatch && fortuneBatch)
    invalid('fortuneBatch', 'scopeBatch 与 fortuneBatch 不能同时传入。');
  const resolved = resolveZiweiScopeBatchPlan(scope, scopeBatch);
  if (fortuneBatch && scope !== 'full' && scope !== 'decadal')
    invalid('fortuneBatch', 'fortuneBatch 仅在紫微 promptScope=full 或 decadal 时生效。');
  if (scopeBatch)
    return {
      scopes: resolved.scopes,
      scopeBatch: resolved.metadata,
      independentBatch: 'scope' as const,
    };
  if (fortuneBatch) {
    if (fortuneBatch.limit !== undefined && fortuneBatch.limit !== 1)
      invalid('fortuneBatch.limit', 'fortuneBatch.limit 必须为 1。');
    return {
      scopes: [] as ScopeType[],
      fortuneBatch: { ...fortuneBatch, limit: 1 },
      independentBatch: 'fortune' as const,
    };
  }
  return { scopes: Array.from(new Set<ScopeType>(['origin', ...resolved.scopes])) };
}

export function ziweiFortuneRangeScope(
  scope: ZiweiPromptScope,
): ZiweiFortuneRangeOptions['scope'] | undefined {
  const scopes: Partial<Record<ZiweiPromptScope, ZiweiFortuneRangeOptions['scope']>> = {
    full: 'all',
    decadal: 'current',
    yearly: 'year',
    monthly: 'month',
    daily: 'day',
    hourly: 'hour',
  };
  return scopes[scope];
}

export function resolveZiweiRequestScope(input: RequestInput) {
  const initialSelection = selectionFor(input, 'ziwei');
  const legacyScope = optionalEnum(input, 'promptScope', ZIWEI_PROMPT_SCOPES);
  const selectedScope =
    initialSelection?.scope === 'natal'
      ? 'origin'
      : (initialSelection?.scope as ZiweiPromptScope | undefined);
  const scope =
    (input.scope !== undefined ? selectedScope : legacyScope) ?? selectedScope ?? 'decadal';
  const selection =
    initialSelection && scope !== 'age'
      ? selectionFor(input, 'ziwei', scope === 'origin' ? 'natal' : scope)
      : undefined;
  return { scope, selection };
}

export function planZiweiRequest(
  input: RequestInput,
  current: { dateStr: string; hourIndex: number },
) {
  const { scope, selection } = resolveZiweiRequestScope(input);
  const batchOptions = resolveZiweiBatchPlan(
    scope,
    readNatalBatchCursor(input.scopeBatch, 'scopeBatch'),
    readNatalBatchCursor(input.fortuneBatch, 'fortuneBatch'),
  );
  const horoscopeContext = {
    dateStr: optionalDate(input, 'scopeDate') ?? current.dateStr,
    hourIndex: optionalInteger(input, 'scopeHourIndex', 0, 12) ?? current.hourIndex,
  };
  const fortuneScope = ziweiFortuneRangeScope(scope);
  const fortuneRange: ZiweiFortuneRangeOptions | undefined =
    batchOptions.independentBatch === 'scope' || !fortuneScope
      ? undefined
      : {
          scope: fortuneScope,
          ...horoscopeContext,
          ...(batchOptions.fortuneBatch ? { batch: batchOptions.fortuneBatch } : {}),
        };
  return { scope, selection, ...batchOptions, horoscopeContext, fortuneRange };
}
