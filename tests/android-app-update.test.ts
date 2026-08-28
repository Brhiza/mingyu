import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  compareAndroidVersions,
  fetchLatestAndroidRelease,
  normalizeAndroidRelease,
} from '../src/lib/android-app-update.ts';
import {
  buildAndroidDownloadRoutes,
  probeAndroidDownloadRoutes,
  selectBestAndroidRoute,
} from '../src/lib/android-update-routes.ts';

function buildRelease(version = '1.2.3') {
  const tagName = `android-v${version}`;
  const apkName = `mingyu-${version}.apk`;
  return {
    draft: false,
    prerelease: false,
    tag_name: tagName,
    html_url: `https://github.com/Brhiza/mingyu/releases/tag/${tagName}`,
    assets: [
      {
        name: apkName,
        browser_download_url: `https://github.com/Brhiza/mingyu/releases/download/${tagName}/${apkName}`,
      },
      {
        name: `${apkName}.sha256`,
        browser_download_url: `https://github.com/Brhiza/mingyu/releases/download/${tagName}/${apkName}.sha256`,
      },
    ],
  };
}

test('Android 版本按语义版本号比较', () => {
  assert.equal(compareAndroidVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareAndroidVersions('2.0.0', '2.0.0'), 0);
  assert.equal(compareAndroidVersions('1.2.3', '1.3.0'), -1);
});

test('只接受正式 Android Release 的成对官方文件', () => {
  assert.equal(normalizeAndroidRelease(buildRelease())?.version, '1.2.3');
  assert.equal(normalizeAndroidRelease({ ...buildRelease(), prerelease: true }), null);
  assert.equal(normalizeAndroidRelease(buildRelease('preview')), null);

  const redirected = buildRelease();
  redirected.assets[0].browser_download_url = 'https://example.com/android-v1.2.3/mingyu-1.2.3.apk';
  assert.equal(normalizeAndroidRelease(redirected), null);
});

test('更新检查会跳过其他用途的 GitHub Release', async () => {
  const result = await fetchLatestAndroidRelease(
    (async () =>
      new Response(JSON.stringify([{ tag_name: 'v9.0.0', assets: [] }, buildRelease('2.0.0')]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch,
  );
  assert.equal(result?.version, '2.0.0');
});

test('Android 更新生成蓝奏云、GitHub 直连和两个加速线路', () => {
  const githubUrl =
    'https://github.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu-1.2.3.apk';
  const routes = buildAndroidDownloadRoutes('1.2.3', githubUrl);
  assert.deepEqual(
    routes.map((route) => route.id),
    ['lanzou', 'github', 'gh-proxy', 'ghfast'],
  );
  assert.equal(
    routes[0]?.url,
    'https://lanzou-cloudflare-api.brhiza.workers.dev/v1/public/mingyu/1.2.3',
  );
});

test('线路测速会跳过失败线路并自动选择最低延迟', async () => {
  const routes = buildAndroidDownloadRoutes('1.2.3', 'https://github.com/example.apk');
  const probes = await probeAndroidDownloadRoutes(routes.slice(0, 3), (async (
    url: RequestInfo | URL,
  ) => {
    const value = String(url);
    await new Promise((resolve) => setTimeout(resolve, value.includes('gh-proxy') ? 2 : 12));
    return new Response(null, {
      status: value.startsWith('https://github.com/') ? 503 : 200,
    });
  }) as typeof fetch);
  assert.equal(probes[1]?.status, 'unavailable');
  assert.equal(
    selectBestAndroidRoute([
      { ...routes[0]!, status: 'available', latencyMs: 40 },
      { ...routes[1]!, status: 'unavailable', latencyMs: null },
      { ...routes[2]!, status: 'available', latencyMs: 12 },
    ])?.id,
    'gh-proxy',
  );
});

test('GitHub 加速线路拒绝 HEAD 时改用单字节 Range 测速', async () => {
  const route = buildAndroidDownloadRoutes('1.2.3', 'https://github.com/example.apk')[2]!;
  const methods: string[] = [];
  const probes = await probeAndroidDownloadRoutes([route], (async (
    _url: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    methods.push(init?.method || 'GET');
    return new Response(null, { status: init?.method === 'GET' ? 206 : 500 });
  }) as typeof fetch);
  assert.deepEqual(methods, ['HEAD', 'GET']);
  assert.equal(probes[0]?.status, 'available');
});

test('APK 工作流覆盖调试构建、正式签名、校验文件和 Release', async () => {
  const workflow = await readFile('.github/workflows/android-apk.yml', 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /ANDROID_SIGNING_KEYSTORE_BASE64/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /APKSIGNER.*verify/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /LANZOU_API_TOKEN/);
});
