// Compare the JSON representation, ignoring object key order and in-memory undefined fields.
function sameValue(actual: unknown, expected: unknown, numericTolerance: number): boolean {
  if (actual === expected) return true;
  if (numericTolerance > 0 && typeof actual === 'number' && typeof expected === 'number' && Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= numericTolerance) return true;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length && actual.every((item, index) => sameValue(item, expected[index], numericTolerance));
  }
  const a = actual as Record<string, unknown>, b = expected as Record<string, unknown>;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(b).every((key) => Object.hasOwn(a, key) && sameValue(a[key], b[key], numericTolerance));
}

export function sameJsonValue(actual: unknown, expected: unknown, numericTolerance = 0): boolean {
  if (actual === undefined || expected === undefined) return actual === expected;
  if (!Number.isFinite(numericTolerance) || numericTolerance < 0) throw new Error('数值比较容差无效。');
  return sameValue(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), numericTolerance);
}
