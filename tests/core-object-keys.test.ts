import assert from 'node:assert/strict';
import test from 'node:test';
import { stableStringify, hashStableValue } from '../packages/core/src/shared/result';
import { partitionResultForConsumption } from '../packages/core/src/consumption';

test('稳定序列化保留 JSON 原型同名字段并区分结果身份', () => {
  const input = JSON.parse('{"__proto__":{"marker":1},"a":2}');
  assert.equal(stableStringify(input), '{"__proto__":{"marker":1},"a":2}');
  assert.notEqual(hashStableValue(input), hashStableValue({ a: 2 }));
  const nested = JSON.parse('{"items":[{"__proto__":null,"constructor":"值"}]}');
  assert.deepEqual(JSON.parse(stableStringify(nested)), nested);
  assert.equal(Object.getPrototypeOf(input), Object.prototype);
});

test('结果分层把原型同名键保留为自有数据并正确提取其内部证据', () => {
  const input = JSON.parse('{"__proto__":{"marker":1,"evidence":"依据"},"a":2}');
  const result = partitionResultForConsumption<Record<string, unknown>>(input);
  assert.equal(Object.getPrototypeOf(result.chart), Object.prototype);
  assert.equal(Object.hasOwn(result.chart, '__proto__'), true);
  assert.equal(result.chart.marker, undefined);
  assert.deepEqual(result.chart.__proto__, { marker: 1 });
  assert.deepEqual(result.auditEvidence, [
    { path: '__proto__.evidence', field: 'evidence', value: '依据' },
  ]);
  assert.equal(Object.getPrototypeOf(input), Object.prototype);
  assert.equal(input.__proto__.evidence, '依据');
});
