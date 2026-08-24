export interface BoundedMemoryCache<Value> {
  get(key: string): Value | undefined;
  set(key: string, value: Value): void;
  has(key: string): boolean;
  clear(): void;
  readonly size: number;
}

/**
 * 页面会在同一会话中频繁切换案例。这里保留少量最近计算结果，既避免重复排盘，
 * 也不把出生资料持久化到浏览器存储中。
 */
export function createBoundedMemoryCache<Value>(maxEntries = 8): BoundedMemoryCache<Value> {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error('缓存容量必须是正整数。');
  }

  const values = new Map<string, Value>();

  return {
    get(key) {
      const value = values.get(key);
      if (value === undefined) return undefined;

      values.delete(key);
      values.set(key, value);
      return value;
    },
    set(key, value) {
      values.delete(key);
      values.set(key, value);

      while (values.size > maxEntries) {
        const oldestKey = values.keys().next().value;
        if (oldestKey === undefined) break;
        values.delete(oldestKey);
      }
    },
    has(key) {
      return values.has(key);
    },
    clear() {
      values.clear();
    },
    get size() {
      return values.size;
    },
  };
}
