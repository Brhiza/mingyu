import type { RandomTrace } from './random';
import { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from './version';

export { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from './version';

export type CoreDiagnosticLevel = 'info' | 'warning' | 'error';
export type CoreErrorCategory =
  'validation' | 'boundary' | 'unsupported' | 'dependency' | 'calculation' | 'serialization';

export interface CoreDiagnostic<TCode extends string = string> {
  code: TCode;
  level: CoreDiagnosticLevel;
  message: string;
  field?: string;
  recoverable?: boolean;
  details?: Record<string, string | number | boolean | null>;
}

export interface CoreResultMeta {
  engineVersion: string;
  schemaVersion: string;
  algorithm: string;
  model?: string;
  calculatedAt: string;
  inputHash: string;
  resultId: string;
  random?: RandomTrace;
  diagnostics?: CoreDiagnostic[];
}

export interface CoreResultMetaInput {
  algorithm: string;
  input: unknown;
  model?: string;
  calculatedAt?: Date | string | number;
  random?: RandomTrace;
  diagnostics?: CoreDiagnostic[];
}

export interface MingyuCoreErrorJSON<TCode extends string = string> {
  name: string;
  code: TCode;
  category: CoreErrorCategory;
  message: string;
  field?: string;
  recoverable: boolean;
  diagnostics: CoreDiagnostic<TCode>[];
  context?: Record<string, unknown>;
}

export type CoreExecutionResult<T> =
  { ok: true; data: T } | { ok: false; error: MingyuCoreErrorJSON };

export interface NormalizeCoreErrorOptions {
  code?: string;
  category?: CoreErrorCategory;
  message?: string;
  field?: string;
  recoverable?: boolean;
  context?: Record<string, unknown>;
}

export class MingyuCoreError<TCode extends string = string> extends Error {
  readonly code: TCode;
  readonly category: CoreErrorCategory;
  readonly recoverable: boolean;
  readonly field?: string;
  readonly diagnostics: CoreDiagnostic<TCode>[];
  readonly context?: Record<string, unknown>;

  constructor(options: {
    code: TCode;
    category: CoreErrorCategory;
    message: string;
    field?: string;
    recoverable?: boolean;
    diagnostics?: CoreDiagnostic<TCode>[];
    context?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'MingyuCoreError';
    this.code = options.code;
    this.category = options.category;
    this.recoverable = options.recoverable ?? false;
    this.field = options.field;
    this.diagnostics = options.diagnostics ?? [
      {
        code: options.code,
        level: 'error',
        message: options.message,
        field: options.field,
        recoverable: options.recoverable ?? false,
      },
    ];
    this.context = options.context;
  }

  toJSON(): MingyuCoreErrorJSON<TCode> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      field: this.field,
      recoverable: this.recoverable,
      diagnostics: this.diagnostics,
      context: this.context,
    };
  }
}

function inferErrorCategory(error: unknown): CoreErrorCategory {
  if (error instanceof TypeError || error instanceof RangeError) return 'validation';
  if (
    error instanceof Error &&
    /(?:cannot find|failed to resolve|module not found|找不到).*(?:iztro|依赖)|(?:iztro|依赖).*(?:cannot find|failed to resolve|module not found|找不到)/i.test(
      error.message,
    )
  ) {
    return 'dependency';
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (/正好位于.*分界线|边界.*(?:敏感|无法唯一|重新测量)/.test(message)) return 'boundary';
    if (
      /(?:不支持的|未知的)(?:出生排盘系统|合盘系统|占法)|(?:当前|暂时|目前).*(?:只开放|仅开放|不支持|不可用)|(?:只|仅)支持/.test(
        message,
      )
    ) {
      return 'unsupported';
    }
    if (
      /(?:必须|需提供|需要提供|至少需要|至少提供|不能为空|不能同时|不得同时|只能是|只能为|需在|必须在|必须是|参数无效|输入无效|不是有效|无法识别的生肖)/.test(
        message,
      )
    ) {
      return 'validation';
    }
  }
  return 'calculation';
}

/** 把任意运行时异常转换为可识别、可序列化的核心错误。 */
export function normalizeCoreError(
  error: unknown,
  options: NormalizeCoreErrorOptions = {},
): MingyuCoreError {
  if (error instanceof MingyuCoreError) return error;

  const originalMessage = error instanceof Error ? error.message.trim() : '';
  const category = options.category ?? inferErrorCategory(error);
  const fallbackCode =
    category === 'dependency'
      ? 'DEPENDENCY_UNAVAILABLE'
      : category === 'validation'
        ? 'INPUT_VALIDATION_FAILED'
        : category === 'unsupported'
          ? 'OPERATION_UNSUPPORTED'
          : category === 'boundary'
            ? 'INPUT_BOUNDARY_AMBIGUOUS'
            : 'CORE_EXECUTION_FAILED';
  return new MingyuCoreError({
    code: options.code ?? fallbackCode,
    category,
    message: options.message ?? (originalMessage || '核心能力执行失败。'),
    field: options.field,
    recoverable:
      options.recoverable ??
      (category === 'validation' || category === 'boundary' || category === 'dependency'),
    context: options.context,
    cause: error,
  });
}

/** 安全执行同步能力，失败时返回可直接 JSON 序列化的错误对象。 */
export function executeSafelySync<T>(operation: () => T): CoreExecutionResult<T> {
  try {
    return { ok: true, data: operation() };
  } catch (error) {
    return { ok: false, error: normalizeCoreError(error).toJSON() };
  }
}

/** 安全执行同步或异步能力，统一返回可判别联合类型。 */
export async function executeSafely<T>(
  operation: () => T | Promise<T>,
): Promise<CoreExecutionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: normalizeCoreError(error).toJSON() };
  }
}

function normalizeForSerialization(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new MingyuCoreError({
        code: 'NON_FINITE_NUMBER',
        category: 'serialization',
        message: '结果序列化不支持 NaN 或无穷大。',
      });
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new MingyuCoreError({
        code: 'INVALID_DATE',
        category: 'serialization',
        message: '结果序列化不支持无效日期。',
      });
    }
    return value.toISOString();
  }
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    throw new MingyuCoreError({
      code: 'UNSUPPORTED_SERIALIZATION_TYPE',
      category: 'serialization',
      message: `结果序列化不支持 ${typeof value} 类型。`,
    });
  }
  if (typeof value !== 'object') return value;
  if (seen.has(value)) {
    throw new MingyuCoreError({
      code: 'CIRCULAR_REFERENCE',
      category: 'serialization',
      message: '结果序列化不支持循环引用。',
    });
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeForSerialization(item, seen) ?? null);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new MingyuCoreError({
        code: 'UNSUPPORTED_SERIALIZATION_OBJECT',
        category: 'serialization',
        message: '结果序列化只支持普通对象、数组、日期和 JSON 基础类型。',
      });
    }
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = normalizeForSerialization(record[key], seen);
      if (item !== undefined) normalized[key] = item;
    }
    return normalized;
  } finally {
    seen.delete(value);
  }
}

/** 将输入转换为键顺序稳定、浏览器与服务端一致的 JSON 文本。 */
export function stableStringify(value: unknown): string {
  const normalized = normalizeForSerialization(value, new WeakSet<object>());
  if (normalized === undefined) {
    throw new MingyuCoreError({
      code: 'UNDEFINED_ROOT_VALUE',
      category: 'serialization',
      message: '结果序列化不支持顶层 undefined。',
    });
  }
  return JSON.stringify(normalized);
}

/** FNV-1a 64 位散列，适合作为缓存键和结果身份，不用于安全签名。 */
export function hashStableValue(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index++) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function normalizeCalculatedAt(value?: Date | string | number): string {
  const date = value === undefined ? new Date() : value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MingyuCoreError({
      code: 'INVALID_CALCULATED_AT',
      category: 'validation',
      message: '计算时间必须是有效日期。',
      field: 'calculatedAt',
    });
  }
  return date.toISOString();
}

function normalizeRandomTrace(random?: RandomTrace): RandomTrace | undefined {
  if (random === undefined) return undefined;
  if (random === null || typeof random !== 'object' || Array.isArray(random)) {
    throw new MingyuCoreError({
      code: 'RANDOM_TRACE_INVALID',
      category: 'validation',
      message: '随机轨迹必须是对象。',
      field: 'random',
    });
  }
  if (!['system', 'seeded', 'custom', 'replay'].includes(random.mode)) {
    throw new MingyuCoreError({
      code: 'RANDOM_TRACE_MODE_INVALID',
      category: 'validation',
      message: '随机轨迹模式无效。',
      field: 'random.mode',
    });
  }
  if (!Array.isArray(random.samples)) {
    throw new MingyuCoreError({
      code: 'RANDOM_TRACE_SAMPLES_INVALID',
      category: 'validation',
      message: '随机轨迹样本必须是数组。',
      field: 'random.samples',
    });
  }
  const samples = random.samples.map((sample) => {
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new MingyuCoreError({
        code: 'RANDOM_TRACE_SAMPLE_INVALID',
        category: 'validation',
        message: '随机轨迹样本必须大于等于 0 且小于 1。',
        field: 'random.samples',
      });
    }
    return sample;
  });
  if (
    random.seed !== undefined &&
    typeof random.seed !== 'string' &&
    (typeof random.seed !== 'number' || !Number.isFinite(random.seed))
  ) {
    throw new MingyuCoreError({
      code: 'RANDOM_TRACE_SEED_INVALID',
      category: 'validation',
      message: '随机轨迹种子必须是有限数字或文本。',
      field: 'random.seed',
    });
  }
  return {
    mode: random.mode,
    seed: random.seed,
    samples,
  };
}

/** 生成可缓存、可比较、可安全存储的统一结果身份。 */
export function createResultMeta(options: CoreResultMetaInput): CoreResultMeta {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new MingyuCoreError({
      code: 'RESULT_META_OPTIONS_INVALID',
      category: 'validation',
      message: '结果元数据设置必须是对象。',
    });
  }
  if (typeof options.algorithm !== 'string' || !options.algorithm.trim()) {
    throw new MingyuCoreError({
      code: 'ALGORITHM_REQUIRED',
      category: 'validation',
      message: '结果元数据必须提供算法标识。',
      field: 'algorithm',
    });
  }
  const algorithm = options.algorithm.trim();
  const inputHash = hashStableValue(options.input);
  const random = normalizeRandomTrace(options.random);
  const identityHash = hashStableValue({
    algorithm,
    engineVersion: MINGYU_CORE_VERSION,
    schemaVersion: MINGYU_SCHEMA_VERSION,
    model: options.model,
    inputHash,
    randomSamples: random?.samples,
  });
  return {
    engineVersion: MINGYU_CORE_VERSION,
    schemaVersion: MINGYU_SCHEMA_VERSION,
    algorithm,
    model: options.model,
    calculatedAt: normalizeCalculatedAt(options.calculatedAt),
    inputHash,
    resultId: `${algorithm}:${identityHash}`,
    random,
    diagnostics: options.diagnostics?.length
      ? options.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          details: diagnostic.details ? { ...diagnostic.details } : undefined,
        }))
      : undefined,
  };
}

export function attachResultMeta<T extends object>(
  result: T,
  options: CoreResultMetaInput,
): T & { meta: CoreResultMeta } {
  return { ...result, meta: createResultMeta(options) };
}

/** 输出稳定 JSON，可直接用于缓存、历史记录、分享或跨端快照比较。 */
export function serializeCoreResult(value: unknown): string {
  return stableStringify(value);
}

/** 统一结果协议的简短公共名称。 */
export const serializeResult = serializeCoreResult;
