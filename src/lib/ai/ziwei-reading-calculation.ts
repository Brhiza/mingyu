import {
  buildSerializableZiweiResult,
  buildZiweiFortuneTimelineFromAstrolabe,
  buildZiweiPayloadByScope,
  calculatePublicZiweiChartForScopes,
  getDefaultHoroscopeContext,
  type SerializableZiweiResult,
  type ZiweiFortuneRangeScope,
  type ZiweiHoroscopeContext,
  type ZiweiRuntime,
} from 'mingyu-core/ziwei';
import {
  buildPublicZiweiPromptForRuntime,
  getZiweiPromptCalculationScopes,
  PROMPT_MODES,
  resolvePromptSelection,
  ZIWEI_SCHOOLS,
  ZIWEI_PROMPT_SCOPES,
  ZIWEI_PROMPT_TOPICS,
  type PromptMode,
  type PromptSelection,
  type ZiweiSchool,
  type ZiweiPromptScope,
  type ZiweiPromptTopic,
} from 'mingyu-core/prompt/public-api';
import { buildZiweiChartInput } from '@/lib/full-chart-engine/ziwei';
import type { ScopeType } from '@/types/analysis';

type JsonRecord = Record<string, unknown>;

export type ZiweiReadingProgress = (completed: number, total: number) => void;

export type ZiweiCalculationIdentity = {
  method: 'ziwei';
  birth: JsonRecord;
  target: {
    promptScope: ZiweiPromptScope;
    scopeDate?: string;
    scopeHourIndex?: number;
  };
};

export type ZiweiReadingResult = SerializableZiweiResult & {
  calculationIdentity: ZiweiCalculationIdentity;
};

type ZiweiFortuneTimeline = NonNullable<ZiweiRuntime['fortuneTimeline']>;
type ZiweiScopePayload = SerializableZiweiResult['payloadByScope'][ScopeType];

/** Worker 以本命、动态范围、单年龄年和提示词片段传递资料，避免单个大消息。 */
export type ZiweiReadingChunk =
  | { kind: 'base'; result: SerializableZiweiResult }
  | { kind: 'scope'; scope: ScopeType; payload: ZiweiScopePayload }
  | { kind: 'fortune'; timeline: ZiweiFortuneTimeline }
  | { kind: 'prompt'; index: number; total: number; text: string }
  | {
      kind: 'complete';
      calculationIdentity: ZiweiCalculationIdentity;
      promptChunkCount: number;
    };

export type ZiweiReadingChunkHandler = (chunk: ZiweiReadingChunk) => void;

export type ZiweiReadingCalculationResult = {
  prompt: string;
  result: ZiweiReadingResult;
};

export type ZiweiReadingCalculationOptions = {
  signal?: AbortSignal;
  onProgress?: ZiweiReadingProgress;
  onChunk?: ZiweiReadingChunkHandler;
};

const PROMPT_CHUNK_SIZE = 32 * 1024;

const FORTUNE_SCOPE_BY_PROMPT: Partial<Record<ZiweiPromptScope, ZiweiFortuneRangeScope>> = {
  full: 'all',
  decadal: 'current',
  yearly: 'year',
  monthly: 'month',
  daily: 'day',
  hourly: 'hour',
};

function textValue(input: JsonRecord, key: string, fallback = ''): string {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new Error(`${key} 必须是字符串。`);
  return value;
}

function requiredText(input: JsonRecord, key: string): string {
  const value = textValue(input, key).trim();
  if (!value) throw new Error(`${key} 不能为空。`);
  return value;
}

function booleanValue(input: JsonRecord, key: string, fallback: boolean): boolean {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${key} 必须是布尔值。`);
  return value;
}

function integerValue(input: JsonRecord, key: string, min?: number, max?: number): number {
  const value = input[key];
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[-+]?\d+$/u.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isSafeInteger(parsed)) throw new Error(`${key} 必须是整数。`);
  if (min !== undefined && parsed < min) throw new Error(`${key} 不能小于 ${min}。`);
  if (max !== undefined && parsed > max) throw new Error(`${key} 不能大于 ${max}。`);
  return parsed;
}

function numberValue(input: JsonRecord, key: string, min?: number, max?: number): number {
  const value = input[key];
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`${key} 必须是数字。`);
  if (min !== undefined && parsed < min) throw new Error(`${key} 不能小于 ${min}。`);
  if (max !== undefined && parsed > max) throw new Error(`${key} 不能大于 ${max}。`);
  return parsed;
}

function enumValue<const T extends readonly string[]>(
  input: JsonRecord,
  key: string,
  values: T,
  fallback?: T[number],
): T[number] {
  const value = input[key] === undefined ? fallback : input[key];
  if (typeof value === 'string' && values.includes(value)) return value as T[number];
  throw new Error(`${key} 必须是以下值之一：${values.join('、')}。`);
}

function optionalNumberValue(input: JsonRecord, key: string, min?: number, max?: number) {
  if (input[key] === undefined || input[key] === '') return undefined;
  return numberValue(input, key, min, max);
}

function readDateOnly(input: JsonRecord, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${key} 必须使用 YYYY-MM-DD 格式。`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${key} 不是有效日期。`);
  }
  return value;
}

function normalizePromptScope(value: unknown, fallback: ZiweiPromptScope): ZiweiPromptScope {
  if (value === undefined) return fallback;
  if (value === 'natal') return 'origin';
  if (typeof value === 'string' && ZIWEI_PROMPT_SCOPES.includes(value as ZiweiPromptScope)) {
    return value as ZiweiPromptScope;
  }
  throw new Error(`promptScope 必须是以下值之一：${ZIWEI_PROMPT_SCOPES.join('、')}。`);
}

function readSelection(input: JsonRecord): PromptSelection | undefined {
  if (input.topicId === undefined && input.subtopicId === undefined && input.scope === undefined) {
    return undefined;
  }
  const resolution = resolvePromptSelection({
    methodId: 'ziwei',
    topicId: input.topicId === undefined ? undefined : textValue(input, 'topicId'),
    subtopicId: input.subtopicId === undefined ? undefined : textValue(input, 'subtopicId'),
    scope: input.scope === undefined ? undefined : textValue(input, 'scope'),
  });
  if (!resolution.ok) throw new Error(resolution.message);
  return resolution.selection;
}

function readSchools(input: JsonRecord): ZiweiSchool[] | undefined {
  const value = input.schools;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new Error('schools 必须包含一至三个解读口径。');
  }
  const schools = value.map((item, index) => {
    if (typeof item !== 'string' || !ZIWEI_SCHOOLS.includes(item as ZiweiSchool)) {
      throw new Error(`schools[${index}] 必须是以下值之一：${ZIWEI_SCHOOLS.join('、')}。`);
    }
    return item as ZiweiSchool;
  });
  if (new Set(schools).size !== schools.length) throw new Error('schools 不能包含重复解读口径。');
  return schools;
}

function buildChartInput(input: JsonRecord) {
  const useTrueSolarTime = booleanValue(input, 'useTrueSolarTime', false);
  const dateType = enumValue(input, 'dateType', ['solar', 'lunar'] as const);
  const algorithm = enumValue(input, 'algorithm', ['default', 'zhongzhou'] as const, 'default');
  const timezone = optionalNumberValue(input, 'timezone', -12, 14);
  const timeZoneId = input.timeZoneId === undefined ? undefined : textValue(input, 'timeZoneId');
  const applyChinaDst =
    input.applyChinaDst === undefined ? undefined : booleanValue(input, 'applyChinaDst', false);
  const timeIndex =
    input.timeIndex === undefined
      ? ''
      : input.timeIndex === ''
        ? ''
        : integerValue(input, 'timeIndex', 0, 12);
  const birthSecond =
    input.birthSecond === undefined || input.birthSecond === ''
      ? undefined
      : integerValue(input, 'birthSecond', 0, 59);
  const ruleInput = {
    ...(input.fixLeap === undefined ? {} : { fixLeap: booleanValue(input, 'fixLeap', false) }),
    ...(input.yearDivide === undefined
      ? {}
      : {
          yearDivide: enumValue(input, 'yearDivide', ['normal', 'exact'] as const),
        }),
    ...(input.horoscopeDivide === undefined
      ? {}
      : {
          horoscopeDivide: enumValue(input, 'horoscopeDivide', ['normal', 'exact'] as const),
        }),
    ...(input.ageDivide === undefined
      ? {}
      : {
          ageDivide: enumValue(input, 'ageDivide', ['normal', 'birthday'] as const),
        }),
    ...(input.dayDivide === undefined
      ? {}
      : {
          dayDivide: enumValue(input, 'dayDivide', ['current', 'forward'] as const),
        }),
  };
  const chartInput = {
    ...buildZiweiChartInput({
      name: textValue(input, 'name'),
      gender: enumValue(input, 'gender', ['male', 'female'] as const),
      dateType,
      year: input.year as string | number,
      month: input.month as string | number,
      day: input.day as string | number,
      timeIndex,
      isLeapMonth: booleanValue(input, 'isLeapMonth', false),
      useTrueSolarTime,
      ...(input.birthHour === undefined ? {} : { birthHour: input.birthHour as string | number }),
      ...(input.birthMinute === undefined
        ? {}
        : { birthMinute: input.birthMinute as string | number }),
      ...(birthSecond === undefined ? {} : { birthSecond }),
      ...(input.birthLongitude === undefined
        ? {}
        : { birthLongitude: input.birthLongitude as string | number }),
      ...(timezone === undefined ? {} : { timezone }),
      ...(timeZoneId === undefined ? {} : { timeZoneId }),
      ...(applyChinaDst === undefined ? {} : { applyChinaDst }),
      algorithm,
    }),
    ...ruleInput,
  };
  const birthLatitude = optionalNumberValue(input, 'birthLatitude', -90, 90);
  return {
    chartInput,
    identity: {
      name: textValue(input, 'name'),
      gender: enumValue(input, 'gender', ['male', 'female'] as const),
      year: integerValue(input, 'year'),
      month: integerValue(input, 'month'),
      day: integerValue(input, 'day'),
      dateType,
      isLeapMonth: booleanValue(input, 'isLeapMonth', false),
      useTrueSolarTime,
      birthPlace: textValue(input, 'birthPlace'),
      ...(useTrueSolarTime || birthSecond !== undefined
        ? {
            birthHour: integerValue(input, 'birthHour', 0, 23),
            birthMinute: integerValue(input, 'birthMinute', 0, 59),
            ...(birthSecond === undefined ? {} : { birthSecond }),
          }
        : { timeIndex: integerValue(input, 'timeIndex', 0, 12) }),
      ...(useTrueSolarTime
        ? { birthLongitude: numberValue(input, 'birthLongitude', -180, 180) }
        : {}),
      ...(birthLatitude === undefined ? {} : { birthLatitude }),
      ...(timezone === undefined ? {} : { timezone }),
      ...(timeZoneId === undefined ? {} : { timeZoneId }),
      ...(applyChinaDst === undefined ? {} : { applyChinaDst }),
      algorithm,
    } satisfies JsonRecord,
  };
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
}

function mergeFortuneTimeline(
  base: NonNullable<ZiweiRuntime['fortuneTimeline']>,
  next: NonNullable<ZiweiRuntime['fortuneTimeline']>,
) {
  if (
    base.scope !== next.scope ||
    base.targetDateStr !== next.targetDateStr ||
    base.targetHourIndex !== next.targetHourIndex ||
    base.targetAge !== next.targetAge ||
    base.targetYear !== next.targetYear ||
    base.selectedPeriodIndex !== next.selectedPeriodIndex
  ) {
    throw new Error('紫微分批运限的固定目标上下文不一致。');
  }

  const periods = base.periods.map((period) => ({
    ...period,
    years: [...period.years],
  }));
  for (const nextPeriod of next.periods) {
    const periodKey = `${nextPeriod.startAge}:${nextPeriod.endAge}:${nextPeriod.dateStr}`;
    const current = periods.find(
      (period) => `${period.startAge}:${period.endAge}:${period.dateStr}` === periodKey,
    );
    if (!current) {
      periods.push({ ...nextPeriod, years: [...nextPeriod.years] });
      continue;
    }
    for (const nextYear of nextPeriod.years) {
      const yearIndex = current.years.findIndex(
        (year) => year.age === nextYear.age && year.dateStr === nextYear.dateStr,
      );
      if (yearIndex < 0) current.years.push(nextYear);
      else current.years[yearIndex] = { ...current.years[yearIndex], ...nextYear };
    }
    current.years.sort((left, right) => left.dateStr.localeCompare(right.dateStr));
  }
  periods.sort((left, right) => left.startAge - right.startAge);
  return finalizeFortuneTimeline({ ...base, periods });
}

function finalizeFortuneTimeline(timeline: NonNullable<ZiweiRuntime['fortuneTimeline']>) {
  const firstPeriod = timeline.periods[0];
  const lastPeriod = timeline.periods.at(-1);
  const merged = {
    ...timeline,
    actualStartDateStr: firstPeriod?.dateStr ?? timeline.actualStartDateStr,
    actualEndDateStr: lastPeriod?.endDateStr ?? lastPeriod?.dateStr ?? timeline.actualEndDateStr,
  };
  delete merged.batch;
  return merged;
}

function mergeRuntime(base: ZiweiRuntime, next: ZiweiRuntime): ZiweiRuntime {
  if (!base.fortuneTimeline || !next.fortuneTimeline) {
    throw new Error('紫微分批结果缺少运限资料。');
  }
  return {
    ...base,
    fortuneTimeline: mergeFortuneTimeline(base.fortuneTimeline, next.fortuneTimeline),
  };
}

async function calculateBaseRuntime(
  chartInput: ReturnType<typeof buildZiweiChartInput>,
  horoscopeContext: ZiweiHoroscopeContext,
  signal?: AbortSignal,
) {
  checkAborted(signal);
  return calculatePublicZiweiChartForScopes(chartInput, ['origin'], {
    horoscopeContext,
  });
}

async function buildRuntimeScopes(
  base: ZiweiRuntime,
  chartInput: ReturnType<typeof buildZiweiChartInput>,
  scopes: ScopeType[],
  signal?: AbortSignal,
  onChunk?: ZiweiReadingChunkHandler,
) {
  const payloadByScope = { ...base.payloadByScope };
  const calculationConfig = base.payloadByScope.origin?.calculation_config;
  if (!calculationConfig) throw new Error('紫微本命资料缺少计算规则。');
  for (const scope of scopes) {
    if (scope === 'origin') continue;
    checkAborted(signal);
    const payload = buildZiweiPayloadByScope({
      astrolabe: base.astrolabe,
      horoscope: base.horoscope,
      scopes: [scope],
      calculationConfig,
      birthTime: chartInput.birthTime,
    });
    const scopePayload = payload[scope];
    if (!scopePayload) throw new Error(`紫微资料缺少 ${scope} 范围。`);
    payloadByScope[scope] = scopePayload;
    onChunk?.({ kind: 'scope', scope, payload: scopePayload });
  }
  return { ...base, payloadByScope };
}

async function calculateWithFortuneBatches(
  base: ZiweiRuntime,
  chartInput: ReturnType<typeof buildZiweiChartInput>,
  scopes: ScopeType[],
  horoscopeContext: ZiweiHoroscopeContext,
  fortuneScope: ZiweiFortuneRangeScope,
  options: ZiweiReadingCalculationOptions,
) {
  const scopedBase = await buildRuntimeScopes(
    base,
    chartInput,
    scopes,
    options.signal,
    options.onChunk,
  );
  const firstTimeline = await buildZiweiFortuneTimelineFromAstrolabe(
    scopedBase.astrolabe,
    chartInput,
    scopedBase.decadalTimeline,
    {
      scope: fortuneScope,
      dateStr: horoscopeContext.dateStr,
      hourIndex: horoscopeContext.hourIndex,
      batch: { startIndex: 0, limit: 1 },
    },
  );
  const firstBatch = firstTimeline.batch;
  if (!firstBatch) {
    throw new Error('紫微首批运限结果缺少分页元数据。');
  }
  options.onChunk?.({ kind: 'fortune', timeline: firstTimeline });
  const totalYears = firstBatch.totalYears;
  let completed = firstBatch.endIndexExclusive;
  options.onProgress?.(completed, totalYears);
  let nextIndex = firstBatch.nextIndex;
  let merged: ZiweiRuntime = { ...scopedBase, fortuneTimeline: firstTimeline };
  while (nextIndex !== null) {
    checkAborted(options.signal);
    const pageTimeline = await buildZiweiFortuneTimelineFromAstrolabe(
      scopedBase.astrolabe,
      chartInput,
      scopedBase.decadalTimeline,
      {
        scope: fortuneScope,
        dateStr: horoscopeContext.dateStr,
        hourIndex: horoscopeContext.hourIndex,
        batch: { startIndex: nextIndex, limit: 1 },
      },
    );
    const pageBatch = pageTimeline.batch;
    if (!pageBatch || pageBatch.totalYears !== totalYears || pageBatch.startIndex !== nextIndex) {
      throw new Error('紫微运限分页返回了不连续的结果。');
    }
    options.onChunk?.({ kind: 'fortune', timeline: pageTimeline });
    merged = mergeRuntime(merged, { ...scopedBase, fortuneTimeline: pageTimeline });
    completed = pageBatch.endIndexExclusive;
    options.onProgress?.(completed, totalYears);
    nextIndex = pageBatch.nextIndex;
  }
  return {
    ...merged,
    fortuneTimeline: merged.fortuneTimeline
      ? finalizeFortuneTimeline(merged.fortuneTimeline)
      : undefined,
  };
}

function buildCalculationIdentity(
  birth: JsonRecord,
  scope: ZiweiPromptScope,
  input: JsonRecord,
  horoscopeContext: ZiweiHoroscopeContext,
  runtime: ZiweiRuntime,
): ZiweiCalculationIdentity {
  const target: ZiweiCalculationIdentity['target'] = { promptScope: scope };
  if (input.scopeDate !== undefined || runtime.fortuneTimeline) {
    target.scopeDate = horoscopeContext.dateStr;
  }
  if (input.scopeHourIndex !== undefined || runtime.fortuneTimeline) {
    target.scopeHourIndex = horoscopeContext.hourIndex;
  }
  return { method: 'ziwei', birth, target };
}

/** 在浏览器本地生成与公开紫微 prompt 接口同形的完整补算资料。 */
export async function generateZiweiReadingLocally(
  calculationRequest: JsonRecord,
  options: ZiweiReadingCalculationOptions = {},
): Promise<ZiweiReadingCalculationResult> {
  checkAborted(options.signal);
  const { chartInput, identity } = buildChartInput(calculationRequest);
  const selection = readSelection(calculationRequest);
  const scope = normalizePromptScope(
    calculationRequest.promptScope,
    normalizePromptScope(selection?.scope, 'decadal'),
  );
  const question = requiredText(calculationRequest, 'question');
  const promptTopic =
    calculationRequest.promptTopic === undefined
      ? undefined
      : enumValue(calculationRequest, 'promptTopic', ZIWEI_PROMPT_TOPICS);
  const mode = enumValue(calculationRequest, 'promptMode', PROMPT_MODES, 'framework') as PromptMode;
  const school =
    typeof calculationRequest.school === 'string' &&
    ZIWEI_SCHOOLS.includes(calculationRequest.school as ZiweiSchool)
      ? (calculationRequest.school as ZiweiSchool)
      : undefined;
  const schools = readSchools(calculationRequest);
  const suppliedScopeDate = readDateOnly(calculationRequest, 'scopeDate');
  const scopeHourIndex =
    calculationRequest.scopeHourIndex === undefined
      ? undefined
      : integerValue(calculationRequest, 'scopeHourIndex', 0, 12);
  const defaultContext = getDefaultHoroscopeContext();
  const horoscopeContext: ZiweiHoroscopeContext = {
    dateStr: suppliedScopeDate ?? defaultContext.dateStr,
    hourIndex: scopeHourIndex ?? defaultContext.hourIndex,
  };
  const scopes = getZiweiPromptCalculationScopes(scope) as ScopeType[];
  const fortuneScope = FORTUNE_SCOPE_BY_PROMPT[scope];
  const baseRuntime = await calculateBaseRuntime(chartInput, horoscopeContext, options.signal);
  options.onChunk?.({ kind: 'base', result: buildSerializableZiweiResult(baseRuntime) });
  let runtime: ZiweiRuntime;
  if (fortuneScope === 'all' || fortuneScope === 'current') {
    runtime = await calculateWithFortuneBatches(
      baseRuntime,
      chartInput,
      scopes,
      horoscopeContext,
      fortuneScope,
      options,
    );
  } else {
    const scopedRuntime = await buildRuntimeScopes(
      baseRuntime,
      chartInput,
      scopes,
      options.signal,
      options.onChunk,
    );
    if (!fortuneScope) {
      runtime = scopedRuntime;
    } else {
      const fortuneTimeline = await buildZiweiFortuneTimelineFromAstrolabe(
        scopedRuntime.astrolabe,
        chartInput,
        scopedRuntime.decadalTimeline,
        {
          scope: fortuneScope,
          dateStr: horoscopeContext.dateStr,
          hourIndex: horoscopeContext.hourIndex,
        },
      );
      options.onChunk?.({ kind: 'fortune', timeline: fortuneTimeline });
      runtime = { ...scopedRuntime, fortuneTimeline };
    }
  }
  if (!(fortuneScope === 'all' || fortuneScope === 'current')) options.onProgress?.(1, 1);
  checkAborted(options.signal);
  const prompt = buildPublicZiweiPromptForRuntime({
    result: runtime,
    question,
    topic: promptTopic as ZiweiPromptTopic | undefined,
    scope,
    mode,
    school,
    schools,
    selection,
  });
  const serializable = buildSerializableZiweiResult(runtime);
  const calculationIdentity = buildCalculationIdentity(
    identity,
    scope,
    calculationRequest,
    horoscopeContext,
    runtime,
  );
  const promptChunkCount = Math.max(1, Math.ceil(prompt.length / PROMPT_CHUNK_SIZE));
  for (let index = 0; index < promptChunkCount; index += 1) {
    options.onChunk?.({
      kind: 'prompt',
      index,
      total: promptChunkCount,
      text: prompt.slice(index * PROMPT_CHUNK_SIZE, (index + 1) * PROMPT_CHUNK_SIZE),
    });
  }
  options.onChunk?.({ kind: 'complete', calculationIdentity, promptChunkCount });
  return {
    prompt,
    result: {
      ...serializable,
      calculationIdentity,
    },
  };
}

/** 与八字本地补算保持一致的命名入口。 */
export const calculateZiweiReading = generateZiweiReadingLocally;
