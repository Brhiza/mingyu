import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundedMemoryCache } from '../src/lib/bounded-memory-cache';

test('有界内存缓存只保留最近使用的结果', () => {
  const cache = createBoundedMemoryCache<number>(2);
  cache.set('案例一', 1);
  cache.set('案例二', 2);

  assert.equal(cache.get('案例一'), 1);
  cache.set('案例三', 3);

  assert.equal(cache.get('案例二'), undefined);
  assert.equal(cache.get('案例一'), 1);
  assert.equal(cache.get('案例三'), 3);
  assert.equal(cache.size, 2);
});

test('相同键更新结果时不会额外占用容量', () => {
  const cache = createBoundedMemoryCache<string>(1);
  cache.set('命盘', '旧结果');
  cache.set('命盘', '新结果');

  assert.equal(cache.get('命盘'), '新结果');
  assert.equal(cache.size, 1);
});

test('缓存容量拒绝无效值', () => {
  assert.throws(() => createBoundedMemoryCache(0), /正整数/);
});
