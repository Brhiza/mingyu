import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerDeploymentRecovery,
  shouldReloadDeploymentAssets,
} from '../src/lib/deployment-recovery';

test('新版资源加载失败时只在保护时间外自动刷新', () => {
  const now = 100_000;

  assert.equal(shouldReloadDeploymentAssets(null, now), true);
  assert.equal(shouldReloadDeploymentAssets('not-a-number', now), true);
  assert.equal(shouldReloadDeploymentAssets(String(now - 29_999), now), false);
  assert.equal(shouldReloadDeploymentAssets(String(now - 30_000), now), true);
});

test('新版资源加载失败时自动刷新一次并阻止同一错误继续传播', () => {
  const eventTarget = new EventTarget();
  const storage = new Map<string, string>();
  let reloadCount = 0;

  registerDeploymentRecovery({
    addEventListener: (type, listener) => eventTarget.addEventListener(type, listener),
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    location: {
      reload: () => {
        reloadCount += 1;
      },
    },
  });

  const firstError = new Event('vite:preloadError', { cancelable: true });
  eventTarget.dispatchEvent(firstError);
  assert.equal(firstError.defaultPrevented, true);
  assert.equal(reloadCount, 1);

  const repeatedError = new Event('vite:preloadError', { cancelable: true });
  eventTarget.dispatchEvent(repeatedError);
  assert.equal(repeatedError.defaultPrevented, false);
  assert.equal(reloadCount, 1);
});
