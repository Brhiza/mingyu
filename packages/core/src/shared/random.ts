import { MingyuCoreError } from './result';

export type RandomSource = () => number;

export interface RandomOptions {
  seed?: string | number;
  /** 使用已保存的原始随机样本逐步重放。 */
  replay?: readonly number[];
  /** 自定义随机源的推荐字段名。 */
  random?: RandomSource;
  /** @deprecated 请改用 random；为兼容既有调用暂时保留。 */
  rng?: RandomSource;
}

export type RandomMode = 'system' | 'seeded' | 'custom' | 'replay';

export interface RandomTrace {
  mode: RandomMode;
  seed?: string | number;
  samples: number[];
}

export type RandomTraceFactStatus = '可重放' | '缺少轨迹' | '不适用';

export interface RandomTraceFact {
  key: string;
  status: RandomTraceFactStatus;
  mode: RandomMode | '未记录' | '不适用';
  seed?: string | number;
  samples: number[];
  sampleCount: number;
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface RandomTraceFactOptions {
  key: string;
  applicable: boolean;
  trace?: RandomTrace;
  processLabel: string;
  sources: readonly string[];
}

export const RANDOM_TRACE_FACT_LIMITATION =
  '随机轨迹只用于核验或重放生成过程，不表示可信度或预测有效性，也不证明任何现实结论。';

/** 将各术数模块的随机记录统一转换为可公开序列化的结构化事实。 */
export function buildRandomTraceFact(options: RandomTraceFactOptions): RandomTraceFact {
  const trace = options.trace;
  const hasReplayableTrace = options.applicable && Boolean(trace?.samples.length);
  const status: RandomTraceFactStatus = !options.applicable
    ? '不适用'
    : hasReplayableTrace
      ? '可重放'
      : '缺少轨迹';
  const samples = hasReplayableTrace && trace ? [...trace.samples] : [];
  const promptText =
    status === '不适用'
      ? `${options.processLabel}不依赖随机抽样，随机轨迹不适用。`
      : status === '缺少轨迹'
        ? `${options.processLabel}属于随机过程，但当前结果未附足够的原始随机样本，无法核验或重放生成过程。`
        : `${options.processLabel}采用${trace?.mode ?? '未记录'}随机模式，已记录${samples.length}个原始随机样本，可用于重放生成过程；随机种子保留在结构化结果中，种子值和原始样本不写入自然语言提示词。`;
  return {
    key: options.key,
    status,
    mode: status === '不适用' ? '不适用' : (trace?.mode ?? '未记录'),
    ...(status === '可重放' && trace?.seed !== undefined ? { seed: trace.seed } : {}),
    samples,
    sampleCount: samples.length,
    promptText,
    sources: Array.from(new Set(options.sources.filter(Boolean))),
    limitation: RANDOM_TRACE_FACT_LIMITATION,
  };
}

/** 保留旧版 randomFacts 字符串数组，供既有调用方平滑迁移。 */
export function formatLegacyRandomFacts(fact: RandomTraceFact): string[] {
  if (fact.status === '不适用') return [];
  if (fact.status === '缺少轨迹') return [fact.promptText];
  return [
    `随机模式：${fact.mode}`,
    `原始随机样本数：${fact.sampleCount}`,
    fact.seed !== undefined ? `随机种子：${String(fact.seed)}` : '',
  ].filter(Boolean);
}

export interface RandomContext {
  random: RandomSource;
  getTrace(): RandomTrace;
}

const UINT32_RANGE = 0x1_0000_0000;

function getSystemCrypto(): Crypto {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throwRandomError(
      'RANDOM_SYSTEM_UNAVAILABLE',
      '当前环境不支持系统级安全随机数，请改用 seed、replay 或自定义随机源。',
    );
  }
  return cryptoObject;
}

/** 从当前运行环境的 Web Crypto 取得一个均匀的 32 位无符号整数。 */
export function secureRandomUint32(): number {
  const values = new Uint32Array(1);
  getSystemCrypto().getRandomValues(values);
  return values[0]!;
}

/** 生成具有 53 位随机精度、范围为 [0, 1) 的系统级安全随机样本。 */
export function secureRandomFloat(): number {
  const high = secureRandomUint32() >>> 5;
  const low = secureRandomUint32() >>> 6;
  return (high * 67_108_864 + low) / 9_007_199_254_740_992;
}

/**
 * 使用拒绝采样生成无模偏差的系统级安全随机整数。
 * 当前实现覆盖全部 32 位无符号整数范围，足以支持抽签、洗牌与占法选择。
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throwRandomError(
      'RANDOM_SECURE_RANGE_INVALID',
      '安全随机整数范围必须是 1 至 4294967296 之间的整数',
    );
  }

  const acceptanceLimit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let value: number;
  do {
    value = secureRandomUint32();
  } while (value >= acceptanceLimit);
  return value % maxExclusive;
}

/**
 * 生成可由既有 [0, 1) 样本协议还原的无偏索引样本。
 * 适用于需要保存浮点样本、但实际业务是从有限集合中等概率抽取一项的场景。
 */
export function secureRandomIndexSample(maxExclusive: number): number {
  const index = secureRandomInt(maxExclusive);
  return (index + 0.5) / maxExclusive;
}

/** 判断调用方是否显式提供了任一种随机来源。 */
export function hasRandomOptions(options?: RandomOptions): boolean {
  return (
    options?.seed !== undefined ||
    options?.replay !== undefined ||
    options?.random !== undefined ||
    options?.rng !== undefined
  );
}

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number' && !Number.isFinite(seed)) {
    throwRandomError('RANDOM_SEED_INVALID', '随机种子必须是有限数字或文本。', 'seed');
  }
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string | number): RandomSource {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function assertRandomSample(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throwRandomError('RANDOM_SAMPLE_INVALID', '随机源必须返回大于等于 0 且小于 1 的数字', 'random');
  }
  return value;
}

function throwRandomError(code: string, message: string, field?: string): never {
  throw new MingyuCoreError({
    code,
    category: 'validation',
    message,
    field,
  });
}

export function createRandomContext(options?: RandomOptions): RandomContext {
  if (
    options !== undefined &&
    (options === null || typeof options !== 'object' || Array.isArray(options))
  ) {
    throwRandomError('RANDOM_OPTIONS_INVALID', '随机选项必须是对象。');
  }
  if (options?.random !== undefined && options.rng !== undefined) {
    throwRandomError('RANDOM_SOURCE_CONFLICT', 'random 与 rng 不能同时提供。');
  }
  const sourceCount = [
    options?.seed !== undefined,
    options?.replay !== undefined,
    options?.random !== undefined || options?.rng !== undefined,
  ].filter(Boolean).length;
  if (sourceCount > 1) {
    throwRandomError('RANDOM_OPTIONS_CONFLICT', 'seed、replay 与自定义随机源只能提供一种。');
  }
  const customRandom = options?.random ?? options?.rng;
  let mode: RandomMode = 'system';
  let source: RandomSource = secureRandomFloat;
  if (options?.replay !== undefined) {
    if (!Array.isArray(options.replay) || options.replay.length === 0) {
      throwRandomError('RANDOM_REPLAY_REQUIRED', '随机重放样本必须是非空数组。', 'replay');
    }
    const replay = [...options.replay].map(assertRandomSample);
    let index = 0;
    mode = 'replay';
    source = () => {
      const value = replay[index];
      if (value === undefined) {
        throwRandomError('RANDOM_REPLAY_EXHAUSTED', '随机重放样本已用尽。', 'replay');
      }
      index++;
      return value;
    };
  } else if (customRandom !== undefined) {
    if (typeof customRandom !== 'function') {
      throwRandomError('RANDOM_SOURCE_INVALID', '自定义随机源必须是函数。', 'random');
    }
    mode = 'custom';
    source = customRandom;
  } else if (options?.seed !== undefined) {
    if (typeof options.seed !== 'string' && typeof options.seed !== 'number') {
      throwRandomError('RANDOM_SEED_INVALID', '随机种子必须是有限数字或文本。', 'seed');
    }
    mode = 'seeded';
    source = createSeededRandom(options.seed);
  }
  const samples: number[] = [];
  return {
    random: () => {
      const value = assertRandomSample(source());
      samples.push(value);
      return value;
    },
    getTrace: () => ({
      mode,
      seed: mode === 'seeded' ? options?.seed : undefined,
      samples: [...samples],
    }),
  };
}

export function createRandomSource(options?: RandomOptions): RandomSource {
  return createRandomContext(options).random;
}

export function randomFloat(rng: RandomSource): number {
  return assertRandomSample(rng());
}

export function randomInt(maxExclusive: number, rng: RandomSource): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throwRandomError('RANDOM_RANGE_INVALID', '随机整数范围必须是 1 至 4294967296 之间的整数');
  }

  // 将随机样本稳定映射到均匀的 32 位空间，再按等宽桶拒绝尾部余数。
  // 系统、种子与重放模式都能保留同一条样本轨迹，并避免直接缩放造成的模偏差。
  const bucketSize = Math.floor(UINT32_RANGE / maxExclusive);
  const acceptanceLimit = bucketSize * maxExclusive;
  let candidate: number;
  do {
    candidate = Math.floor(randomFloat(rng) * UINT32_RANGE);
  } while (candidate >= acceptanceLimit);
  return Math.floor(candidate / bucketSize);
}
