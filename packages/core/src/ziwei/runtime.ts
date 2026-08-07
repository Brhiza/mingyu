import { getBirthDateValidationMessage } from '../calendar/date-validation';
import { resolveZiweiTrueSolarBirth } from './true-solar-input';
import type { AnalysisPayloadV1, ScopeType } from '../types/analysis';
import type { ChartInput } from '../types/chart';
import type { IztroAstrolabe, IztroHoroscope } from '../types/iztro';
import {
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
  buildZiweiCalculationConfig,
  getDefaultHoroscopeContext,
} from './iztro/runtime-helpers';
import { buildAnalysisPayloadV1 } from './iztro/build-analysis-payload/index';
import { buildVerifiedDecadalTimelineOptions } from './iztro/decadal';

/** npm 用户可直接消费的紫微完整运行结果。 */
export type ZiweiRuntime = {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  /** 本次运限计算实际采用的日期与时辰，便于缓存、审计和重放。 */
  horoscopeContext: ZiweiHoroscopeContext;
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  decadalTimeline: Awaited<ReturnType<typeof buildVerifiedDecadalTimelineOptions>>;
  trueSolarEvidence?: ChartInput['trueSolarEvidence'];
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
  skipAnalysis?: boolean;
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
        skipAnalysis: params.skipAnalysis,
      }),
    ]),
  ) as Record<ScopeType, AnalysisPayloadV1>;
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
  const astrolabe = await buildAstrolabeFromInput(input);
  const horoscopeContext = resolveHoroscopeContext(options);
  const horoscope = await buildHoroscopeFromInput(
    astrolabe,
    input,
    horoscopeContext.dateStr,
    horoscopeContext.hourIndex,
  );
  const payloadByScope = buildZiweiPayloadByScope({
    astrolabe,
    horoscope,
    scopes: options.scopes,
    calculationConfig: buildZiweiCalculationConfig(input),
    skipAnalysis: options.skipAnalysis,
  });
  const decadalTimeline = await buildVerifiedDecadalTimelineOptions(astrolabe, input);

  return {
    astrolabe,
    horoscope,
    horoscopeContext: { ...horoscopeContext },
    payloadByScope,
    decadalTimeline,
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
): Promise<ZiweiRuntime> {
  return calculateZiweiChart(input, { scopes, skipAnalysis });
}

/** 面向较小接口响应的范围入口，始终保留本命资料。 */
export async function calculatePublicZiweiChartForScopes(
  input: ChartInput,
  scopes?: ScopeType[],
): Promise<ZiweiRuntime> {
  return calculateZiweiChart(input, {
    scopes: Array.from(new Set(['origin' as const, ...(scopes ?? [])])),
  });
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

/** 将网页表单或普通 JSON 输入转换为严格的紫微 ChartInput。 */
export function buildZiweiChartInput(input: ZiweiChartInputDraft): ChartInput {
  const birthDateParts = readBirthDate(input);
  const birthTimeIndex = input.useTrueSolarTime ? 0 : readTimeIndex(input.timeIndex);
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
        birthLongitude: input.birthLongitude === undefined ? '' : String(input.birthLongitude),
        timezone: input.timezone,
        timeZoneId: input.timeZoneId,
        applyChinaDst: input.applyChinaDst,
      })
    : null;

  return {
    name: input.name,
    gender,
    dateType: input.useTrueSolarTime ? 'solar' : input.dateType,
    birthDate:
      trueSolarBirth?.birthDate ??
      formatBirthDate(birthDateParts.year, birthDateParts.month, birthDateParts.day),
    birthTimeIndex: trueSolarBirth?.birthTimeIndex ?? birthTimeIndex,
    ...(trueSolarBirth?.trueSolarEvidence
      ? { trueSolarEvidence: trueSolarBirth.trueSolarEvidence }
      : {}),
    isLeapMonth: input.useTrueSolarTime ? false : input.isLeapMonth,
    fixLeap: true,
    algorithm: input.algorithm ?? 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
    dayDivide: 'forward',
  };
}
