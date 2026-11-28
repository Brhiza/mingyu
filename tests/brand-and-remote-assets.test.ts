import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBrandConfig } from '../src/brand-config';
import {
  buildRemoteSkinCssText,
  clearAllCachedPackages,
  deleteCachedPackage,
  ensureAssetPackage,
  formatAssetPackageLabel,
  getCachedPackageStats,
  getRemoteSkins,
  getSkinCardBackUrl,
  getSkinLogoUrl,
  loadAssetManifest,
  resolveRemoteAssetUrl,
  setCustomAssetOriginOverride,
  waitForBackgroundWarmup,
  warmAssetPackageInBackground,
} from '../src/remote-assets';

function createMemoryCacheStorage() {
  const stores = new Map<string, Map<string, Response>>();
  const storage: CacheStorage = {
    async open(name: string) {
      let bucket = stores.get(name);
      if (!bucket) {
        bucket = new Map();
        stores.set(name, bucket);
      }
      const cache: Cache = {
        async match(request: RequestInfo | URL) {
          const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
          return bucket!.get(url)?.clone();
        },
        async put(request: RequestInfo | URL, response: Response) {
          const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
          bucket!.set(url, response.clone());
        },
        async delete(request: RequestInfo | URL) {
          const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
          return bucket!.delete(url);
        },
        async keys() {
          return Array.from(bucket!.keys()).map((url) => new Request(url));
        },
        async add() {},
        async addAll() {},
        async matchAll() {
          return [];
        },
      };
      return cache;
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async has(name: string) {
      return stores.has(name);
    },
    async keys() {
      return Array.from(stores.keys());
    },
    async match() {
      return undefined;
    },
  };
  return storage;
}

test('品牌部署配置支持默认命语与环境变量一键切换时月东方', () => {
  const defaultCfg = resolveBrandConfig({
    VITE_APP_NAME: '',
    VITE_APP_FULL_NAME: '',
    VITE_APP_SLOGAN: '',
    VITE_APP_SEAL_CHAR: '',
    VITE_APP_ORIGIN: '',
    VITE_ASSET_ORIGIN: '',
    VITE_DEFAULT_THEME: '',
    VITE_MERIT_BOX_URL: '',
    VITE_BUILTIN_AI_ENABLED: '',
  });
  assert.equal(defaultCfg.appName, '命语');
  assert.equal(defaultCfg.appFullName, '命语');
  assert.equal(defaultCfg.appSlogan, '观四时之命，译数术之语');
  assert.equal(defaultCfg.sealChar, '命');
  assert.equal(defaultCfg.appOrigin, 'https://sydf.cc');
  assert.equal(defaultCfg.assetOrigin, '');
  assert.equal(defaultCfg.defaultTheme, 'blossom');
  assert.equal(defaultCfg.meritBoxUrl, '');
  assert.equal(defaultCfg.builtinAiHint, false);
  assert.equal(defaultCfg.enableCustomEdition, false);

  const sydfCfg = resolveBrandConfig({
    VITE_APP_NAME: '时月东方',
    VITE_APP_SLOGAN: '明时月之序，见东方之理',
    VITE_APP_ORIGIN: 'https://sydf.cc/',
    VITE_ASSET_ORIGIN: 'https://assets.sydf.cc/',
    VITE_DEFAULT_THEME: 'yue',
    VITE_MERIT_BOX_URL: 'https://lk.sydf.cc/',
    VITE_BUILTIN_AI_ENABLED: 'true',
  });
  assert.equal(sydfCfg.appName, '时月东方');
  assert.equal(sydfCfg.appFullName, '时月东方');
  assert.equal(sydfCfg.appSlogan, '明时月之序，见东方之理');
  assert.equal(sydfCfg.sealChar, '时');
  assert.equal(sydfCfg.appOrigin, 'https://sydf.cc');
  assert.equal(sydfCfg.assetOrigin, 'https://assets.sydf.cc');
  assert.equal(sydfCfg.defaultTheme, 'yue');
  assert.equal(sydfCfg.meritBoxUrl, 'https://lk.sydf.cc/');
  assert.equal(sydfCfg.builtinAiHint, true);
  assert.equal(sydfCfg.enableCustomEdition, true);
});

test('远程皮肤与牌组按需下载、增量清理与本地缓存管理可用', async () => {
  setCustomAssetOriginOverride('https://assets.sydf.cc');
  try {
    const cacheStorage = createMemoryCacheStorage();
    let manifestVersion = 'hash-v1';
    let fetchCount = 0;

    const fetcher = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchCount += 1;
      if (url.endsWith('/theme-assets-manifest.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            packages: {
              'theme:yue': {
                fingerprint: manifestVersion,
                bytes: 20,
                files: [
                  { path: '/divination-themes/yue/banner.webp', bytes: 10, hash: manifestVersion },
                  { path: '/divination-themes/yue/logo.webp', bytes: 10, hash: 'fixed-logo' },
                ],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('img-bytes', { status: 200 });
    }) as typeof fetch;

    const manifest = await loadAssetManifest({ forceRefresh: true, fetcher });
    assert.ok(manifest?.packages['theme:yue']);
    assert.equal(
      resolveRemoteAssetUrl('/divination-themes/yue/banner.webp'),
      'https://assets.sydf.cc/divination-themes/yue/banner.webp?asset=hash-v1',
    );

    const progressEvents: number[] = [];
    const first = await ensureAssetPackage('theme:yue', {
      fetcher,
      cacheStorage,
      onProgress: (p) => progressEvents.push(p.completedFiles),
    });
    assert.equal(first.ok, true);
    assert.equal(first.downloaded, 2);
    assert.ok(progressEvents.includes(2));

    // 第二次全部命中本地缓存
    fetchCount = 0;
    const second = await ensureAssetPackage('theme:yue', { fetcher, cacheStorage });
    assert.equal(second.downloaded, 0);
    assert.equal(fetchCount, 0);

    // 模拟清单一文件哈希变化 -> 只补下载变化文件，旧哈希自动清理
    manifestVersion = 'hash-v2';
    await loadAssetManifest({ forceRefresh: true, fetcher });
    const third = await ensureAssetPackage('theme:yue', { fetcher, cacheStorage });
    assert.equal(third.downloaded, 1);

    const stats = await getCachedPackageStats({ fetcher, cacheStorage });
    assert.equal(stats.length, 1);
    assert.equal(stats[0]?.cachedFiles, 2);

    const removed = await deleteCachedPackage('theme:yue', { fetcher, cacheStorage });
    assert.equal(removed, 2);
    assert.equal((await getCachedPackageStats({ fetcher, cacheStorage })).length, 0);

    await ensureAssetPackage('theme:yue', { fetcher, cacheStorage });
    assert.equal(await clearAllCachedPackages({ cacheStorage }), true);
    assert.equal((await getCachedPackageStats({ fetcher, cacheStorage })).length, 0);
  } finally {
    setCustomAssetOriginOverride(null);
  }
});

test('远程资源包下载支持 AbortSignal 中断且整体进度严格单调不倒退', async () => {
  setCustomAssetOriginOverride('https://assets.sydf.cc');
  try {
    const cacheStorage = createMemoryCacheStorage();
    const files = Array.from({ length: 12 }, (_, idx) => ({
      path: `/divination-themes/xian/cards/${idx}.webp`,
      bytes: 1000,
      hash: `h-${idx}`,
    }));
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/theme-assets-manifest.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            packages: {
              'theme:xian': {
                fingerprint: 'fp-xian',
                bytes: 12000,
                files,
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (init?.signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
      await new Promise((r) => setTimeout(r, 8));
      return new Response('img', { status: 200 });
    }) as typeof fetch;

    await loadAssetManifest({ forceRefresh: true, fetcher });

    // 验证全量完成时进度单调递增
    const recordedBytes: number[] = [];
    const recordedFiles: number[] = [];
    await ensureAssetPackage('theme:xian', {
      fetcher,
      cacheStorage,
      onProgress: (p) => {
        recordedBytes.push(p.loadedBytes);
        recordedFiles.push(p.completedFiles);
      },
    });
    assert.equal(recordedFiles[recordedFiles.length - 1], 12);
    assert.equal(recordedBytes[recordedBytes.length - 1], 12000);
    for (let i = 1; i < recordedBytes.length; i += 1) {
      assert.ok(recordedBytes[i]! >= recordedBytes[i - 1]!);
      assert.ok(recordedFiles[i]! >= recordedFiles[i - 1]!);
    }

    // 清空缓存后验证 AbortSignal 可中断且中止后不再回调 onProgress
    await clearAllCachedPackages({ cacheStorage });
    const controller = new AbortController();
    let callbacksAfterAbort = 0;
    await assert.rejects(
      ensureAssetPackage('theme:xian', {
        fetcher,
        cacheStorage,
        signal: controller.signal,
        onProgress: (p) => {
          if (controller.signal.aborted) callbacksAfterAbort += 1;
          if (p.completedFiles >= 1) controller.abort();
        },
      }),
      (err: unknown) => err instanceof Error && err.name === 'AbortError',
    );
    assert.equal(callbacksAfterAbort, 0);
  } finally {
    setCustomAssetOriginOverride(null);
  }
});

test('皮肤 Logo 与牌背 URL 拼接及两阶段静默后台预热顺序正确，且清单驱动皮肤定义', async () => {
  // 默认开源环境（无 ASSET_ORIGIN）不暴露任何远程皮肤
  setCustomAssetOriginOverride('');
  assert.deepEqual(getRemoteSkins(), []);
  assert.equal(getSkinLogoUrl('yue'), null);

  setCustomAssetOriginOverride('https://assets.sydf.cc');
  try {
    assert.equal(
      getSkinLogoUrl('yue'),
      'https://assets.sydf.cc/divination-themes/yue/logo.webp',
    );
    assert.equal(
      getSkinCardBackUrl('xian'),
      'https://assets.sydf.cc/divination-themes/xian/cards/tarot/back.webp',
    );
    assert.equal(getSkinLogoUrl('blossom'), null);

    const cacheStorage = createMemoryCacheStorage();
    const fetchedPaths: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/theme-assets-manifest.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            skins: [
              { id: 'shi', label: '时', swatches: ['#d97ca4', '#b6815e', '#fff4f8'], tokens: { light: { '--accent': '#d97ca4' }, dark: { '--accent': '#ed9bbb' } } },
              { id: 'yue', label: '月', swatches: ['#8368ab', '#a98252', '#f3f2f5'] },
              { id: 'mo', label: '东', swatches: ['#a46f52', '#a47948', '#f2eee7'] },
              { id: 'xian', label: '方', swatches: ['#477c7b', '#a17c49', '#f5f1e8'] },
            ],
            packageLabels: {
              'theme:mo': '东 · 皮肤',
              'theme:xian': '方 · 皮肤',
            },
            packages: {
              'theme:yue': {
                fingerprint: 'fp-yue',
                bytes: 400,
                files: [
                  { path: '/divination-themes/yue/cards/tarot/000.webp', bytes: 100, hash: 'h0' },
                  { path: '/divination-themes/yue/cards/tarot/001.webp', bytes: 100, hash: 'h1' },
                  { path: '/divination-themes/yue/logo.webp', bytes: 100, hash: 'hlogo' },
                  { path: '/divination-themes/yue/banner.webp', bytes: 100, hash: 'hban' },
                ],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      fetchedPaths.push(new URL(url).pathname);
      await new Promise((r) => setTimeout(r, 4));
      return new Response('img', { status: 200 });
    }) as typeof fetch;

    await loadAssetManifest({ forceRefresh: true, fetcher });
    assert.deepEqual(
      getRemoteSkins().map((s) => s.label),
      ['时', '月', '东', '方'],
    );
    assert.equal(formatAssetPackageLabel('theme:mo'), '东 · 皮肤');
    assert.equal(formatAssetPackageLabel('theme:shi'), '时 · 皮肤');
    const css = buildRemoteSkinCssText(getRemoteSkins());
    assert.ok(css.includes(':root[data-accent-theme="shi"]{--accent:#d97ca4}'));
    assert.ok(css.includes(':root[data-theme="dark"][data-accent-theme="shi"]{--accent:#ed9bbb}'));

    await warmAssetPackageInBackground('theme:yue', { fetcher, cacheStorage });
    // 首屏调用返回时，logo.webp 与 banner.webp 已优先落盘
    assert.ok(fetchedPaths.includes('/divination-themes/yue/logo.webp'));
    assert.ok(fetchedPaths.includes('/divination-themes/yue/banner.webp'));

    await waitForBackgroundWarmup();
    assert.equal(fetchedPaths.length, 4);
  } finally {
    setCustomAssetOriginOverride(null);
  }
});
