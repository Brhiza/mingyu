import { getBirthDateValidationMessage } from '../calendar/date-validation';
import { getTimeIndexFromClock } from '../calendar/dateUtils';
import { resolveZiweiTrueSolarBirth } from './true-solar-input';
import type {
  AnalysisPayloadV1,
  BasicInfo,
  PalaceFact,
  ScopeType,
  ZiweiCalculationConfig,
} from '../types/analysis';
import type { ChartInput } from '../types/chart';
import type { IztroAstrolabe, IztroHoroscope } from '../types/iztro';
import {
  assertValidHoroscopeInput,
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
  buildZiweiCalculationConfig,
  getDefaultHoroscopeContext,
  normalizeChartInput,
} from './iztro/runtime-helpers';
import { buildAnalysisPayloadV1 } from './iztro/build-analysis-payload/index';
import {
  buildBasicInfo,
  buildNatalPalaceFacts,
} from './iztro/build-analysis-payload/helpers/builders';
import {
  buildVerifiedDecadalTimelineBatchOptions,
  buildVerifiedDecadalTimelineOptions,
  calculateNormalZiweiNominalAge,
  createZiweiHoroscopeResolver,
} from './iztro/decadal';
import {
  buildNormalZiweiFortuneBatchTimelineFromAstrolabe,
  buildZiweiFortuneTimelineFromAstrolabe,
  type ZiweiFortuneRangeOptions,
  type ZiweiFortuneTimeline,
} from './fortune-timeline';

/** npm 用户可直接消费的紫微完整运行结果。 */
export type ZiweiRuntime = {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  /** 本次运限计算实际采用的日期与时辰，便于缓存、审计和重放。 */
  horoscopeContext: ZiweiHoroscopeContext;
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  /** 年龄年独立批次使用的本命基础事实投影；不等同于 origin 完整分析。 */
  natalSnapshot?: ZiweiNatalSnapshot;
  /** 当前运行是否为显式独立批次。 */
  calculationBatch?: 'scope' | 'fortune';
  decadalTimeline: Awaited<ReturnType<typeof buildVerifiedDecadalTimelineOptions>>;
  /** 当前、全部或指定下层范围的逐阶段逐年资料；未请求范围时省略。 */
  fortuneTimeline?: ZiweiFortuneTimeline;
  trueSolarEvidence?: ChartInput['trueSolarEvidence'];
};

/** 提示词、序列化与公开分页只需要的盘面事实，不承诺附带目标时刻完整运限对象。 */
export type ZiweiRuntimeFacts = Omit<ZiweiRuntime, 'horoscope'>;

/** normal 口径的独立年龄年结果；本命、阶段与所选年龄年事实保持完整。 */
export type ZiweiFortuneBatchRuntime = ZiweiRuntimeFacts & {
  calculationBatch: 'fortune';
  natalSnapshot: ZiweiNatalSnapshot;
  fortuneTimeline: ZiweiFortuneTimeline;
};

export type ZiweiNatalSnapshot = {
  kind: 'natal-facts';
  basicInfo: BasicInfo;
  calculationConfig: ZiweiCalculationConfig;
  palaces: PalaceFact[];
};

export const DEFAULT_ZIWEI_RUNTIME_SCOPES: ScopeType[] = [
  'origin',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'age',
];

export interface ZiweiHoroscopeContext {
  /** 运限排盘使用的公历日期，格式 YYYY-MM-DD。 */
  dateStr: string;
  /** 运限排盘使用的时辰索引，范围 0-12。 */
  hourIndex: number;
}

export interface ZiweiRuntimeOptions {
  /** 需要生成的资料范围；不传时生成全部范围。 */
  scopes?: ScopeType[];
  /** 是否只生成盘面结构而跳过证据和格局分析。 */
  skipAnalysis?: boolean;
  /** 明确指定运限计算时刻，便于服务端缓存和测试复现。 */
  horoscopeContext?: ZiweiHoroscopeContext;
  /** 未指定 horoscopeContext 时使用的当前时间。 */
  now?: Date;
  /** 组织网页、HTTP 与 MCP 共用的紫微阶段/逐年范围资料。 */
  fortuneRange?: ZiweiFortuneRangeOptions;
  /** 显式独立批次；scope 只计算一个资料范围，fortune 只计算年龄年与本命基础事实。 */
  independentBatch?: 'scope' | 'fortune';
}

function normalizeScopes(scopes?: ScopeType[]): ScopeType[] {
  const requested = scopes?.length ? scopes : DEFAULT_ZIWEI_RUNTIME_SCOPES;
  const unique = Array.from(new Set(requested));
  if (!unique.length) throw new Error('紫微资料范围不能为空。');
  return unique;
}

function resolveHoroscopeContext(options: ZiweiRuntimeOptions): ZiweiHoroscopeContext {
  if (options.horoscopeContext) {
    return options.horoscopeContext;
  }
  return getDefaultHoroscopeContext(options.now);
}

/** 将一个星盘和运限对象转换为指定范围的结构化资料。 */
export function buildZiweiPayloadByScope(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  scopes?: ScopeType[];
  calculationConfig: AnalysisPayloadV1['calculation_config'];
  birthTime?: ChartInput['birthTime'];
  skipAnalysis?: boolean;
  currentScopeEvidenceOnly?: boolean;
}): Record<ScopeType, AnalysisPayloadV1> {
  const scopes = normalizeScopes(params.scopes);
  return Object.fromEntries(
    scopes.map((scope) => [
      scope,
      buildAnalysisPayloadV1({
        astrolabe: params.astrolabe,
        horoscope: params.horoscope,
        currentScope: scope,
        calculationConfig: params.calculationConfig,
        birthTime: params.birthTime,
        skipAnalysis: params.skipAnalysis,
        currentScopeEvidenceOnly: params.currentScopeEvidenceOnly,
      }),
    ]),
  ) as Record<ScopeType, AnalysisPayloadV1>;
}

/** 从星盘直接投影本命基础事实，不执行 origin 的证据池与格局分析。 */
export function buildZiweiNatalSnapshot(params: {
  astrolabe: IztroAstrolabe;
  calculationConfig: ZiweiCalculationConfig;
  birthTime?: ChartInput['birthTime'];
}): ZiweiNatalSnapshot {
  return {
    kind: 'natal-facts',
    basicInfo: buildBasicInfo(params.astrolabe, params.birthTime),
    calculationConfig: params.calculationConfig,
    palaces: buildNatalPalaceFacts(params.astrolabe),
  };
}

/**
 * 生成紫微完整运行结果。
 *
 * 默认使用当前时刻生成运限资料；服务端、缓存和测试建议显式传入
 * `horoscopeContext`，避免同一份出生盘因运行时间不同而产生不同快照。
 */
export async function calculateZiweiChart(
  input: ChartInput,
  options: ZiweiRuntimeOptions = {},
): Promise<ZiweiRuntime> {
  if (options.independentBatch === 'scope') {
    if (options.fortuneRange) {
      throw new RangeError('紫微 scope 独立批次不能同时计算年龄年运限。');
    }
    if (options.scopes?.length !== 1) {
      throw new RangeError('紫微 scope 独立批次必须且只能指定一个资料范围。');
    }
  }
  if (options.independentBatch === 'fortune') {
    if (!options.fortuneRange?.batch) {
      throw new RangeError('紫微年龄年独立批次必须提供 fortuneRange.batch。');
    }
    if (options.scopes?.length) {
      throw new RangeError('紫微年龄年独立批次不能同时计算资料 scope。');
    }
    if (options.fortuneRange.scope !== 'all' && options.fortuneRange.scope !== 'current') {
      throw new RangeError('紫微年龄年独立批次仅用于当前阶段或全部运限。');
    }
    if ((options.fortuneRange.batch.limit ?? 1) !== 1) {
      throw new RangeError('紫微年龄年独立批次每次只能计算一个年龄年。');
    }
  }
  const astrolabe = await buildAstrolabeFromInput(input);
  const resolveHoroscope = createZiweiHoroscopeResolver(astrolabe, input);
  const horoscopeContext = resolveHoroscopeContext(options);
  const horoscope = await resolveHoroscope(horoscopeContext.dateStr, horoscopeContext.hourIndex);
  const fortuneContext = options.fortuneRange
    ? {
        dateStr: options.fortuneRange.dateStr ?? horoscopeContext.dateStr,
        hourIndex: options.fortuneRange.hourIndex ?? horoscopeContext.hourIndex,
      }
    : undefined;
  const fortuneTargetHoroscope =
    options.independentBatch === 'fortune' && fortuneContext
      ? fortuneContext.dateStr === horoscopeContext.dateStr &&
        fortuneContext.hourIndex === horoscopeContext.hourIndex
        ? horoscope
        : await resolveHoroscope(fortuneContext.dateStr, fortuneContext.hourIndex)
      : undefined;
  const calculationConfig = buildZiweiCalculationConfig(input);
  const payloadByScope =
    options.independentBatch === 'fortune'
      ? ({} as Record<ScopeType, AnalysisPayloadV1>)
      : buildZiweiPayloadByScope({
          astrolabe,
          horoscope,
          scopes: options.scopes,
          calculationConfig,
          birthTime: input.birthTime,
          skipAnalysis: options.skipAnalysis,
          currentScopeEvidenceOnly: options.independentBatch === 'scope',
        });
  const natalSnapshot =
    options.independentBatch === 'fortune'
      ? buildZiweiNatalSnapshot({
          astrolabe,
          calculationConfig,
          birthTime: input.birthTime,
        })
      : undefined;
  const verifiedDecadalBatch =
    options.independentBatch === 'fortune'
      ? await buildVerifiedDecadalTimelineBatchOptions(
          astrolabe,
          input,
          {
            scope: options.fortuneRange!.scope as 'all' | 'current',
            targetAge: fortuneTargetHoroscope!.age.nominalAge,
            batch: options.fortuneRange!.batch!,
          },
          resolveHoroscope,
        )
      : undefined;
  const decadalTimeline =
    options.independentBatch === 'scope'
      ? []
      : verifiedDecadalBatch
        ? verifiedDecadalBatch.periods.map((entry) => entry.period)
        : await buildVerifiedDecadalTimelineOptions(astrolabe, input, resolveHoroscope);
  const fortuneTimeline = options.fortuneRange
    ? await buildZiweiFortuneTimelineFromAstrolabe(
        astrolabe,
        input,
        decadalTimeline,
        {
          ...options.fortuneRange,
          dateStr: fortuneContext!.dateStr,
          hourIndex: fortuneContext!.hourIndex,
        },
        {
          resolveHoroscope,
          ...(verifiedDecadalBatch ? { verifiedBatch: verifiedDecadalBatch } : {}),
        },
      )
    : undefined;

  return {
    astrolabe,
    horoscope,
    horoscopeContext: { ...horoscopeContext },
    payloadByScope,
    ...(natalSnapshot ? { natalSnapshot } : {}),
    ...(options.independentBatch ? { calculationBatch: options.independentBatch } : {}),
    decadalTimeline,
    ...(fortuneTimeline ? { fortuneTimeline } : {}),
    trueSolarEvidence: input.trueSolarEvidence,
  };
}

/** 兼容应用层已有的“完整盘”命名。 */
export async function calculateFullZiweiChart(
  input: ChartInput,
  skipAnalysis = false,
): Promise<ZiweiRuntime> {
  return calculateZiweiChart(input, { skipAnalysis });
}

/** 兼容应用层已有的范围计算入口。 */
export async function calculateZiweiChartForScopes(
  input: ChartInput,
  scopes?: ScopeType[],
  skipAnalysis?: boolean,
  options: Omit<ZiweiRuntimeOptions, 'scopes' | 'skipAnalysis'> = {},
): Promise<ZiweiRuntime> {
  return calculateZiweiChart(input, { ...options, scopes, skipAnalysis });
}

/**
 * 生成供提示词与公开序列化消费的紫微事实。
 * normal + all 的独立年龄年无需构造不会被消费的目标时刻完整运限对象；其余路径保留
 * `calculateZiweiChartForScopes` 的真实 ZiweiRuntime 行为。
 */
export async function calculateZiweiFactsForScopes(
  input: ChartInput,
  scopes?: ScopeType[],
  skipAnalysis?: boolean,
  options: Omit<ZiweiRuntimeOptions, 'scopes' | 'skipAnalysis'> = {},
): Promise<ZiweiRuntimeFacts> {
  const fortuneRange = options.fortuneRange;
  if (
    options.independentBatch !== 'fortune' ||
    fortuneRange?.scope !== 'all' ||
    (input.ageDivide ?? 'normal') === 'birthday'
  ) {
    return calculateZiweiChartForScopes(input, scopes, skipAnalysis, options);
  }
  if (!fortuneRange.batch) {
    throw new RangeError('紫微年龄年独立批次必须提供 fortuneRange.batch。');
  }
  if (scopes?.length) {
    throw new RangeError('紫微年龄年独立批次不能同时计算资料 scope。');
  }
  if ((fortuneRange.batch.limit ?? 1) !== 1) {
    throw new RangeError('紫微年龄年独立批次每次只能计算一个年龄年。');
  }

  const astrolabe = await buildAstrolabeFromInput(input);
  const resolveHoroscope = createZiweiHoroscopeResolver(astrolabe, input);
  const horoscopeContext = resolveHoroscopeContext(options);
  assertValidHoroscopeInput(horoscopeContext.dateStr, horoscopeContext.hourIndex);
  const fortuneContext = {
    dateStr: fortuneRange.dateStr ?? horoscopeContext.dateStr,
    hourIndex: fortuneRange.hourIndex ?? horoscopeContext.hourIndex,
  };
  const targetAge = calculateNormalZiweiNominalAge(
    astrolabe,
    fortuneContext.dateStr,
    fortuneContext.hourIndex,
  );
  const calculationConfig = buildZiweiCalculationConfig(input);
  const natalSnapshot = buildZiweiNatalSnapshot({
    astrolabe,
    calculationConfig,
    birthTime: input.birthTime,
  });
  const verifiedDecadalBatch = await buildVerifiedDecadalTimelineBatchOptions(
    astrolabe,
    input,
    {
      scope: 'all',
      targetAge,
      batch: fortuneRange.batch,
    },
    resolveHoroscope,
  );
  const decadalTimeline = verifiedDecadalBatch.periods.map((entry) => entry.period);
  const fortuneTimeline = await buildNormalZiweiFortuneBatchTimelineFromAstrolabe(
    astrolabe,
    input,
    decadalTimeline,
    {
      ...fortuneRange,
      scope: 'all',
      dateStr: fortuneContext.dateStr,
      hourIndex: fortuneContext.hourIndex,
      batch: fortuneRange.batch,
    },
    { resolveHoroscope, verifiedBatch: verifiedDecadalBatch, verifiedTargetAge: targetAge },
  );

  return {
    astrolabe,
    horoscopeContext: { ...horoscopeContext },
    payloadByScope: {} as Record<ScopeType, AnalysisPayloadV1>,
    natalSnapshot,
    calculationBatch: 'fortune',
    decadalTimeline,
    fortuneTimeline,
    trueSolarEvidence: input.trueSolarEvidence,
  } satisfies ZiweiFortuneBatchRuntime;
}

/** 面向较小接口响应的范围入口，始终保留本命资料。 */
export async function calculatePublicZiweiChartForScopes(
  input: ChartInput,
  scopes?: ScopeType[],
  options: Omit<ZiweiRuntimeOptions, 'scopes'> = {},
): Promise<ZiweiRuntime> {
  return calculateZiweiChart(input, {
    ...options,
    scopes:
      options.independentBatch === 'fortune'
        ? []
        : options.independentBatch === 'scope'
          ? scopes
          : Array.from(new Set(['origin' as const, ...(scopes ?? [])])),
  });
}

/** 面向公开提示词与序列化的范围入口；旧非分页行为仍自动保留 origin。 */
export async function calculatePublicZiweiFactsForScopes(
  input: ChartInput,
  scopes?: ScopeType[],
  options: Omit<ZiweiRuntimeOptions, 'scopes'> = {},
): Promise<ZiweiRuntimeFacts> {
  if (
    options.independentBatch === 'fortune' &&
    options.fortuneRange?.scope === 'all' &&
    (input.ageDivide ?? 'normal') !== 'birthday'
  ) {
    return calculateZiweiFactsForScopes(input, [], options.skipAnalysis, options);
  }
  return calculatePublicZiweiChartForScopes(input, scopes, options);
}

/** 只返回各范围结构化资料，不额外暴露完整运行时给调用方。 */
export async function calculateZiweiPayloadByScope(
  input: ChartInput,
  options: Omit<ZiweiRuntimeOptions, 'scopes'> & { scopes?: ScopeType[] } = {},
): Promise<Record<ScopeType, AnalysisPayloadV1>> {
  const runtime = await calculateZiweiChart(input, options);
  return runtime.payloadByScope;
}

/** 按指定日期和时辰生成单个紫微范围资料。 */
export async function calculateZiweiDisplayPayload(params: {
  input: ChartInput;
  dateStr: string;
  hourIndex: number;
  scope: ScopeType;
}): Promise<AnalysisPayloadV1> {
  const astrolabe = await buildAstrolabeFromInput(params.input);
  const horoscope = await buildHoroscopeFromInput(
    astrolabe,
    params.input,
    params.dateStr,
    params.hourIndex,
  );
  return buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: params.scope,
    calculationConfig: buildZiweiCalculationConfig(params.input),
    birthTime: params.input.birthTime,
  });
}

type ZiweiInputText = string | number;

export interface ZiweiChartInputDraft {
  name: string;
  gender: 'male' | 'female';
  dateType: 'solar' | 'lunar';
  year: ZiweiInputText;
  month: ZiweiInputText;
  day: ZiweiInputText;
  timeIndex: number | '';
  isLeapMonth: boolean;
  useTrueSolarTime?: boolean;
  birthHour?: ZiweiInputText;
  birthMinute?: ZiweiInputText;
  birthSecond?: ZiweiInputText;
  birthLongitude?: ZiweiInputText;
  timezone?: number;
  timeZoneId?: string;
  applyChinaDst?: boolean;
  algorithm?: 'default' | 'zhongzhou';
}

function readInteger(value: ZiweiInputText, label: string): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`${label}必须是整数。`);
    return value;
  }
  const text = value.trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label}必须是整数。`);
  return Number(text);
}

function readTimeIndex(value: number | ''): number {
  if (value === '') throw new Error('请选择出生时辰。');
  const timeIndex = readInteger(value, '出生时辰');
  if (timeIndex < 0 || timeIndex > 12) throw new Error('出生时辰需在 0-12 之间。');
  return timeIndex;
}

function readBirthDate(input: ZiweiChartInputDraft) {
  const year = readInteger(input.year, '出生年份');
  const month = readInteger(input.month, '出生月份');
  const day = readInteger(input.day, '出生日期');
  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType: input.dateType,
    isLeapMonth: input.isLeapMonth,
  });
  if (validationMessage) throw new Error(validationMessage);
  return { year, month, day };
}

function formatBirthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function readPreciseStandardBirthTime(
  input: ZiweiChartInputDraft,
): ChartInput['birthTime'] | undefined {
  const birthSecond = input.birthSecond === undefined ? '' : String(input.birthSecond).trim();
  if (!birthSecond) return undefined;
  if (input.birthHour === undefined || input.birthMinute === undefined) {
    throw new Error('精准标准北京时间需要同时提供出生小时和分钟。');
  }
  const time = {
    hour: readInteger(input.birthHour, '出生小时'),
    minute: readInteger(input.birthMinute, '出生分钟'),
    second: readInteger(birthSecond, '出生秒数'),
  };
  if (
    time.hour < 0 ||
    time.hour > 23 ||
    time.minute < 0 ||
    time.minute > 59 ||
    time.second < 0 ||
    time.second > 59
  ) {
    throw new Error('精准出生时间需使用 0-23 时、0-59 分和 0-59 秒。');
  }
  return time;
}

/** 将网页表单或普通 JSON 输入转换为严格的紫微 ChartInput。 */
export function buildZiweiChartInput(input: ZiweiChartInputDraft): ChartInput {
  const birthDateParts = readBirthDate(input);
  const preciseStandardBirthTime = input.useTrueSolarTime
    ? undefined
    : readPreciseStandardBirthTime(input);
  const birthTimeIndex = input.useTrueSolarTime
    ? 0
    : preciseStandardBirthTime
      ? getTimeIndexFromClock(preciseStandardBirthTime.hour, preciseStandardBirthTime.minute)
      : readTimeIndex(input.timeIndex);
  const gender = input.gender === 'male' ? '男' : '女';
  const trueSolarBirth = input.useTrueSolarTime
    ? resolveZiweiTrueSolarBirth({
        dateType: input.dateType,
        year: String(input.year),
        month: String(input.month),
        day: String(input.day),
        isLeapMonth: input.isLeapMonth,
        birthHour: input.birthHour === undefined ? '' : String(input.birthHour),
        birthMinute: input.birthMinute === undefined ? '' : String(input.birthMinute),
        birthSecond: input.birthSecond === undefined ? '' : String(input.birthSecond),
        birthLongitude: input.birthLongitude === undefined ? '' : String(input.birthLongitude),
        timezone: input.timezone,
        timeZoneId: input.timeZoneId,
        applyChinaDst: input.applyChinaDst,
      })
    : null;

  return normalizeChartInput({
    name: input.name,
    gender,
    dateType: input.useTrueSolarTime ? 'solar' : input.dateType,
    birthDate:
      trueSolarBirth?.birthDate ??
      formatBirthDate(birthDateParts.year, birthDateParts.month, birthDateParts.day),
    birthTimeIndex: trueSolarBirth?.birthTimeIndex ?? birthTimeIndex,
    ...(trueSolarBirth
      ? { birthTime: trueSolarBirth.birthTime, trueSolarEvidence: trueSolarBirth.trueSolarEvidence }
      : preciseStandardBirthTime
        ? { birthTime: preciseStandardBirthTime }
        : {}),
    isLeapMonth: input.useTrueSolarTime ? false : input.isLeapMonth,
    algorithm: input.algorithm ?? 'default',
  });
}
