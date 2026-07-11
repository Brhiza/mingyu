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

export interface RandomContext {
  random: RandomSource;
  getTrace(): RandomTrace;
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
  let source: RandomSource = Math.random;
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
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throwRandomError('RANDOM_RANGE_INVALID', '随机整数范围必须是安全范围内的正整数');
  }
  return Math.floor(randomFloat(rng) * maxExclusive);
}
