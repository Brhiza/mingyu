export type RandomSource = () => number;

export interface RandomOptions {
  seed?: string | number;
  rng?: RandomSource;
}

function hashSeed(seed: string | number): number {
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
  if (options?.rng) {
    return options.rng;
  }
  if (options?.seed !== undefined) {
    return createSeededRandom(options.seed);
  }
  return Math.random;
}

export function randomFloat(rng: RandomSource): number {
  const value = rng();
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 0.999999999999;
  }
  return value;
}

export function randomInt(maxExclusive: number, rng: RandomSource): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('随机整数范围必须是正整数');
  }
  return Math.floor(randomFloat(rng) * maxExclusive);
}
