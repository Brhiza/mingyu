import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

test('Service Worker 源码包含版本占位符并在激活时清理全部旧版缓存桶', async () => {
  const swPath = join(process.cwd(), 'public', 'sw.js');
  const source = readFileSync(swPath, 'utf8');
  assert.match(source, /__MINGYU_SW_VERSION__/);
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'sw.js' }));

  const store = new Map<string, Map<string, Response>>([
    ['mingyu-v2-static-oldhash1', new Map()],
    ['mingyu-v2-runtime-oldhash1', new Map()],
    ['mingyu-v2-nav-oldhash1', new Map()],
    ['mingyu-v2-static-v1', new Map()],
    ['mingyu-v2-runtime-v1', new Map()],
    ['mingyu-v2-nav-v1', new Map()],
    ['mingyu-v2-static-dev', new Map()],
    ['mingyu-v2-runtime-dev', new Map()],
    ['mingyu-v2-nav-dev', new Map()],
    ['external-other-cache', new Map()],
  ]);

  const listeners = new Map<string, (event: unknown) => void>();
  const waitPromises: Array<Promise<unknown>> = [];
  const sandbox = {
    self: {
      location: { origin: 'https://mingyu.example' },
      addEventListener(type: string, handler: (event: unknown) => void) {
        listeners.set(type, handler);
      },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    },
    caches: {
      async keys() {
        return [...store.keys()];
      },
      async delete(name: string) {
        return store.delete(name);
      },
      async open(name: string) {
        let bucket = store.get(name);
        if (!bucket) {
          bucket = new Map();
          store.set(name, bucket);
        }
        return {
          addAll: async () => undefined,
          match: async () => undefined,
          put: async () => undefined,
        };
      },
    },
    URL,
    Promise,
    Response,
    fetch: async () => new Response('ok', { status: 200 }),
  };

  vm.runInNewContext(source, sandbox, { filename: 'sw.js' });
  const activate = listeners.get('activate');
  assert.ok(activate, '缺少 activate 事件监听');

  activate({
    waitUntil(promise: Promise<unknown>) {
      waitPromises.push(promise);
    },
  });
  await Promise.all(waitPromises);

  assert.deepEqual(
    [...store.keys()].sort(),
    ['external-other-cache', 'mingyu-v2-nav-dev', 'mingyu-v2-runtime-dev', 'mingyu-v2-static-dev'].sort(),
  );
});
