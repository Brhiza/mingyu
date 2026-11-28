import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resetPreloadCacheForTest,
  schedulePostMountIdlePrefetch,
  shouldAllowIdlePrefetch,
} from '../src/app/preload-scheduler';

test('shouldAllowIdlePrefetch 在省流量和 2G 弱网下禁用自动空闲预热', () => {
  assert.equal(shouldAllowIdlePrefetch(null), true);
  assert.equal(shouldAllowIdlePrefetch({ saveData: false, effectiveType: '4g' }), true);
  assert.equal(shouldAllowIdlePrefetch({ saveData: false, effectiveType: '3g' }), true);
  assert.equal(shouldAllowIdlePrefetch({ saveData: true, effectiveType: '4g' }), false);
  assert.equal(shouldAllowIdlePrefetch({ saveData: false, effectiveType: '2g' }), false);
  assert.equal(shouldAllowIdlePrefetch({ saveData: false, effectiveType: 'slow-2g' }), false);
});

test('schedulePostMountIdlePrefetch 返回取消函数并在卸载时取消待执行定时器与空闲回调', () => {
  resetPreloadCacheForTest();
  const clearedTimers: unknown[] = [];
  const clearedIdles: number[] = [];
  let nextTimerId = 100;
  let nextIdleId = 200;

  const cancel = schedulePostMountIdlePrefetch(
    { defaultChart: 'bazi', defaultDivination: 'liuyao' },
    {
      setTimeout: ((_cb: () => void) => {
        nextTimerId += 1;
        return nextTimerId as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeout: ((id: ReturnType<typeof setTimeout>) => {
        clearedTimers.push(id);
      }) as typeof clearTimeout,
      requestIdleCallback: (_cb: () => void) => {
        nextIdleId += 1;
        return nextIdleId;
      },
      cancelIdleCallback: (id: number) => {
        clearedIdles.push(id);
      },
    },
  );

  assert.equal(nextTimerId, 102);
  cancel();
  assert.equal(clearedTimers.length, 2);
  assert.equal(clearedIdles.length, 0);
});
