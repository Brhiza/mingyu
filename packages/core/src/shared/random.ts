import { assertOptionalRecord } from './validation';

export type RandomSource = () => number;

export interface RandomOptions {
  seed?: string | number;
  /** 自定义随机源的推荐字段名。 */
  random?: RandomSource;
  /** @deprecated 请改用 random；为兼容既有调用暂时保留。 */
  rng?: RandomSource;
}

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number' && !Number.isFinite(seed)) {
    throw new Error('随机种子必须是有限数字或文本。');
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

export function createRandomSource(options?: RandomOptions): RandomSource {
  assertOptionalRecord(options, '随机选项');
  if (options?.random !== undefined && options.rng !== undefined) {
    throw new Error('random 与 rng 不能同时提供。');
  }
  const customRandom = options?.random ?? options?.rng;
  if (customRandom !== undefined) {
    if (typeof customRandom !== 'function') {
      throw new Error('自定义随机源必须是函数。');
    }
    return customRandom;
  }
  if (options?.seed !== undefined) {
    if (typeof options.seed !== 'string' && typeof options.seed !== 'number') {
      throw new Error('随机种子必须是有限数字或文本。');
    }
    return createSeededRandom(options.seed);
  }
  return Math.random;
}

export function randomFloat(rng: RandomSource): number {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('随机源必须返回大于等于 0 且小于 1 的数字');
  }
  return value;
}

export function randomInt(maxExclusive: number, rng: RandomSource): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('随机整数范围必须是安全范围内的正整数');
  }
  return Math.floor(randomFloat(rng) * maxExclusive);
}
