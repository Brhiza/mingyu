import { getBirthDateValidationMessage } from '../calendar/date-validation';
import type { ScopeType } from '../types/analysis';
import type {
  ChartInput,
  ZiweiBirthSource,
  ZiweiCalculationSource,
  ZiweiGenerationSource,
  ZiweiTraditionalBirthSource,
  ZiweiTrueSolarBirthSource,
} from '../types/chart';
import { resolveZiweiTrueSolarBirth } from './true-solar-input';

const VALID_SCOPES = [
  'origin',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'age',
] as const satisfies readonly ScopeType[];
const VALID_ALGORITHMS = ['default', 'zhongzhou'] as const;
const VALID_YEAR_DIVIDES = ['normal', 'exact'] as const;
const VALID_HOROSCOPE_DIVIDES = ['normal', 'exact'] as const;
const VALID_AGE_DIVIDES = ['normal', 'birthday'] as const;
const VALID_DAY_DIVIDES = ['current', 'forward'] as const;
const VALID_CHART_INPUT_KEYS = [
  'name',
  'dateType',
  'birthDate',
  'birthTimeIndex',
  'gender',
  'isLeapMonth',
  'fixLeap',
  'algorithm',
  'yearDivide',
  'horoscopeDivide',
  'ageDivide',
  'dayDivide',
  'birthSource',
  'trueSolarEvidence',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${label}包含不受支持的字段：${unknownKeys.join('、')}。`);
  }
  const missingKeys = allowedKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(value, key),
  );
  if (missingKeys.length > 0) {
    throw new Error(`${label}缺少字段：${missingKeys.join('、')}。`);
  }
}

function assertOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  message: string,
): asserts value is T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(message);
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') throw new Error(`${label}必须是布尔值。`);
}

function assertIntegerInRange(
  value: unknown,
  label: string,
  min: number,
  max: number,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${label}必须是 ${min}-${max} 之间的安全整数。`);
  }
}

function assertFiniteInRange(
  value: unknown,
  label: string,
  min: number,
  max: number,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}必须是 ${min}-${max} 之间的有限数字。`);
  }
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('姓名必须是文本。');
  return value.trim();
}

function validateBirthDate(source: {
  dateType: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
}): void {
  if (source.dateType === 'solar' && source.isLeapMonth) {
    throw new Error('公历出生来源不能标记为闰月。');
  }
  const message = getBirthDateValidationMessage(source);
  if (message) throw new Error(message);
}

function normalizeBirthBase(value: Record<string, unknown>) {
  const name = normalizeName(value.name);
  assertOneOf(value.gender, ['男', '女'] as const, '性别必须是男或女。');
  assertOneOf(value.dateType, ['solar', 'lunar'] as const, '出生日期类型必须是公历或农历。');
  assertIntegerInRange(value.year, '出生年份', 1900, 2100);
  assertIntegerInRange(value.month, '出生月份', 1, 12);
  assertIntegerInRange(value.day, '出生日期', 1, 31);
  assertBoolean(value.isLeapMonth, '闰月标志');
  const base = {
    name,
    gender: value.gender,
    dateType: value.dateType,
    year: value.year,
    month: value.month,
    day: value.day,
    isLeapMonth: value.isLeapMonth,
  };
  validateBirthDate(base);
  return base;
}

export function normalizeZiweiBirthSource(source: unknown): ZiweiBirthSource {
  if (!isRecord(source)) throw new Error('紫微可信出生来源必须是对象。');
  if (source.method === 'time-index') {
    assertExactKeys(
      source,
      [
        'method',
        'name',
        'gender',
        'dateType',
        'year',
        'month',
        'day',
        'isLeapMonth',
        'birthTimeIndex',
      ],
      '紫微传统时辰出生来源',
    );
    const base = normalizeBirthBase(source);
    assertIntegerInRange(source.birthTimeIndex, '出生时辰', 0, 12);
    return {
      method: 'time-index',
      ...base,
      birthTimeIndex: source.birthTimeIndex,
    } satisfies ZiweiTraditionalBirthSource;
  }
  if (source.method === 'true-solar-time') {
    assertExactKeys(
      source,
      [
        'method',
        'name',
        'gender',
        'dateType',
        'year',
        'month',
        'day',
        'isLeapMonth',
        'birthHour',
        'birthMinute',
        'birthLongitude',
        'timezone',
        'applyChinaDst',
      ],
      '紫微真太阳时出生来源',
    );
    const base = normalizeBirthBase(source);
    assertIntegerInRange(source.birthHour, '出生小时', 0, 23);
    assertIntegerInRange(source.birthMinute, '出生分钟', 0, 59);
    assertFiniteInRange(source.birthLongitude, '出生经度', -180, 180);
    assertFiniteInRange(source.timezone, '出生地时区', -12, 14);
    assertBoolean(source.applyChinaDst, '中国历史夏令时开关');
    return {
      method: 'true-solar-time',
      ...base,
      birthHour: source.birthHour,
      birthMinute: source.birthMinute,
      birthLongitude: source.birthLongitude,
      timezone: source.timezone,
      applyChinaDst: source.applyChinaDst,
    } satisfies ZiweiTrueSolarBirthSource;
  }
  throw new Error('紫微可信出生来源 method 只能是 time-index 或 true-solar-time。');
}

export function normalizeZiweiCalculationSource(source: unknown): ZiweiCalculationSource {
  if (!isRecord(source)) throw new Error('紫微可信排盘口径必须是对象。');
  assertExactKeys(
    source,
    ['fixLeap', 'algorithm', 'yearDivide', 'horoscopeDivide', 'ageDivide', 'dayDivide'],
    '紫微可信排盘口径',
  );
  assertBoolean(source.fixLeap, '闰月修正配置');
  assertOneOf(source.algorithm, VALID_ALGORITHMS, '紫微排盘算法必须是 default 或 zhongzhou。');
  assertOneOf(source.yearDivide, VALID_YEAR_DIVIDES, '紫微年分界必须是 normal 或 exact。');
  assertOneOf(
    source.horoscopeDivide,
    VALID_HOROSCOPE_DIVIDES,
    '紫微行运分界必须是 normal 或 exact。',
  );
  assertOneOf(source.ageDivide, VALID_AGE_DIVIDES, '紫微年龄分界必须是 normal 或 birthday。');
  assertOneOf(source.dayDivide, VALID_DAY_DIVIDES, '紫微日期分界必须是 current 或 forward。');
  return {
    fixLeap: source.fixLeap,
    algorithm: source.algorithm,
    yearDivide: source.yearDivide,
    horoscopeDivide: source.horoscopeDivide,
    ageDivide: source.ageDivide,
    dayDivide: source.dayDivide,
  };
}

export function normalizeZiweiGenerationSource(source: unknown): ZiweiGenerationSource {
  if (!isRecord(source)) throw new Error('紫微可信生成来源必须是对象。');
  assertExactKeys(
    source,
    ['birth', 'calculation', 'timestamp', 'scopes', 'skipAnalysis'],
    '紫微可信生成来源',
  );
  if (!Number.isSafeInteger(source.timestamp) || (source.timestamp as number) < 0) {
    throw new Error('紫微生成时间戳必须是非负安全整数。');
  }
  const timestamp = source.timestamp as number;
  if (Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error('紫微生成时间戳无法转换为有效日期。');
  }
  if (!Array.isArray(source.scopes) || source.scopes.length === 0) {
    throw new Error('紫微生成范围必须是非空数组。');
  }
  const scopes = source.scopes.map((scope) => {
    assertOneOf(scope, VALID_SCOPES, '紫微生成范围包含非法值。');
    return scope;
  });
  if (new Set(scopes).size !== scopes.length) {
    throw new Error('紫微生成范围不能重复。');
  }
  assertBoolean(source.skipAnalysis, '紫微轻量分析开关');
  return {
    birth: normalizeZiweiBirthSource(source.birth),
    calculation: normalizeZiweiCalculationSource(source.calculation),
    timestamp,
    scopes,
    skipAnalysis: source.skipAnalysis,
  };
}

function formatBirthDate(source: { year: number; month: number; day: number }): string {
  return `${source.year}-${String(source.month).padStart(2, '0')}-${String(source.day).padStart(2, '0')}`;
}

export function buildZiweiChartInputFromSources(
  birthSource: ZiweiBirthSource,
  calculationSource: ZiweiCalculationSource,
): ChartInput {
  const birth = normalizeZiweiBirthSource(birthSource);
  const calculation = normalizeZiweiCalculationSource(calculationSource);
  if (birth.method === 'time-index') {
    return {
      name: birth.name,
      gender: birth.gender,
      dateType: birth.dateType,
      birthDate: formatBirthDate(birth),
      birthTimeIndex: birth.birthTimeIndex,
      isLeapMonth: birth.isLeapMonth,
      ...calculation,
      birthSource: birth,
    };
  }
  const resolved = resolveZiweiTrueSolarBirth({
    dateType: birth.dateType,
    year: String(birth.year),
    month: String(birth.month),
    day: String(birth.day),
    isLeapMonth: birth.isLeapMonth,
    birthHour: String(birth.birthHour),
    birthMinute: String(birth.birthMinute),
    birthLongitude: String(birth.birthLongitude),
    timezone: birth.timezone,
    applyChinaDst: birth.applyChinaDst,
  });
  return {
    name: birth.name,
    gender: birth.gender,
    dateType: 'solar',
    birthDate: resolved.birthDate,
    birthTimeIndex: resolved.birthTimeIndex,
    isLeapMonth: false,
    ...calculation,
    birthSource: birth,
    trueSolarEvidence: resolved.trueSolarEvidence,
  };
}

export function createZiweiCalculationSource(input: ChartInput): ZiweiCalculationSource {
  return normalizeZiweiCalculationSource({
    fixLeap: input.fixLeap ?? true,
    algorithm: input.algorithm ?? 'default',
    yearDivide: input.yearDivide ?? 'normal',
    horoscopeDivide: input.horoscopeDivide ?? 'normal',
    ageDivide: input.ageDivide ?? 'normal',
    dayDivide: input.dayDivide ?? 'forward',
  });
}

export function createZiweiBirthSource(input: ChartInput): ZiweiBirthSource {
  if (input.birthSource !== undefined) return normalizeZiweiBirthSource(input.birthSource);
  if (input.trueSolarEvidence !== undefined) {
    throw new Error('紫微真太阳时结果缺少精准出生时间与经度来源，无法审核重建。');
  }
  if (typeof input.birthDate !== 'string') throw new Error('出生日期格式需为 YYYY-MM-DD。');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate.trim());
  if (!match) throw new Error('出生日期格式需为 YYYY-MM-DD。');
  return normalizeZiweiBirthSource({
    method: 'time-index',
    name: input.name,
    gender: input.gender,
    dateType: input.dateType,
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    isLeapMonth: input.isLeapMonth ?? false,
    birthTimeIndex: input.birthTimeIndex,
  });
}

export function createZiweiGenerationSource(params: {
  input: ChartInput;
  timestamp: number;
  scopes: ScopeType[];
  skipAnalysis?: boolean;
}): ZiweiGenerationSource {
  if (!isRecord(params.input)) throw new Error('紫微排盘输入必须是对象。');
  const unknownInputKeys = Object.keys(params.input).filter(
    (key) => !VALID_CHART_INPUT_KEYS.includes(key as (typeof VALID_CHART_INPUT_KEYS)[number]),
  );
  if (unknownInputKeys.length > 0) {
    throw new Error(`紫微排盘输入包含不受支持的字段：${unknownInputKeys.join('、')}。`);
  }
  return normalizeZiweiGenerationSource({
    birth: createZiweiBirthSource(params.input),
    calculation: createZiweiCalculationSource(params.input),
    timestamp: params.timestamp,
    scopes: Array.from(new Set(params.scopes)),
    skipAnalysis: params.skipAnalysis ?? false,
  });
}
