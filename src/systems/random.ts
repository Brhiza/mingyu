const range = 0x1_0000_0000;

/** The optional source is for deterministic internal tests; callers use system randomness. */
export function randomContext(source?: () => number) {
  function sample() {
    let value: number;
    if (source) value = source();
    else {
      if (!globalThis.crypto?.getRandomValues) throw new Error('当前环境不支持安全随机数。');
      const words = globalThis.crypto.getRandomValues(new Uint32Array(2));
      value = ((words[0] >>> 5) * 67_108_864 + (words[1] >>> 6)) / 9_007_199_254_740_992;
    }
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机值必须大于等于 0 且小于 1。');
    return value;
  }
  function integer(max: number) {
    const bucket = Math.floor(range / max);
    const limit = bucket * max;
    let value: number;
    do { value = Math.floor(sample() * range); } while (value >= limit);
    return Math.floor(value / bucket);
  }
  return { sample, integer };
}
