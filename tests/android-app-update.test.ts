import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  compareAndroidVersions,
  fetchLatestAndroidRelease,
  normalizeAndroidManifest,
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

test('统一 APK 清单必须匹配命语的应用、版本和固定下载路径', () => {
  const manifest = {
    appId: 'mingyu',
    packageName: 'cc.aov.mingyu',
    channel: 'latest',
    version: '1.2.3',
    fileName: 'mingyu-1.2.3.apk',
    apkUrl: 'https://download.aov.cc/apps/mingyu/android/1.2.3/mingyu-1.2.3.apk',
    checksumUrl: 'https://download.aov.cc/apps/mingyu/android/1.2.3/mingyu-1.2.3.apk.sha256',
    releaseUrl: 'https://github.com/Brhiza/mingyu/releases/tag/android-v1.2.3',
  };
  assert.equal(normalizeAndroidManifest(manifest)?.version, '1.2.3');
  assert.equal(normalizeAndroidManifest({ ...manifest, appId: 'other' }), null);
  assert.equal(
    normalizeAndroidManifest({ ...manifest, apkUrl: 'https://example.com/app.apk' }),
    null,
  );
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

test('Android 更新只生成默认下载和 GitHub 备用线路', () => {
  const cdnUrl = 'https://download.aov.cc/apps/mingyu/android/1.2.3/mingyu-1.2.3.apk';
  const routes = buildAndroidDownloadRoutes('1.2.3', cdnUrl);
  assert.deepEqual(
    routes.map((route) => route.id),
    ['rng-cdn', 'github'],
  );
  assert.equal(routes[0]?.url, cdnUrl);
  assert.equal(
    routes[1]?.url,
    'https://github.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu-1.2.3.apk',
  );
});

test('线路测速会跳过失败线路并自动选择最低延迟', async () => {
  const routes = buildAndroidDownloadRoutes('1.2.3', 'https://github.com/example.apk');
  const probes = await probeAndroidDownloadRoutes(routes, (async (url: RequestInfo | URL) => {
    const value = String(url);
    await new Promise((resolve) =>
      setTimeout(resolve, value.startsWith('https://github.com/') ? 2 : 12),
    );
    return new Response(null, {
      status: value.startsWith('https://github.com/') ? 503 : 200,
    });
  }) as typeof fetch);
  assert.equal(probes[1]?.status, 'unavailable');
  assert.equal(
    selectBestAndroidRoute([
      { ...routes[0]!, status: 'available', latencyMs: 40 },
      { ...routes[1]!, status: 'unavailable', latencyMs: null },
    ])?.id,
    'rng-cdn',
  );
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
  assert.doesNotMatch(workflow, /LANZOU_API_TOKEN/);
  assert.match(workflow, /APP_RELEASE_PUBLISH_TOKEN/);
  assert.match(workflow, /download\.aov\.cc\/v1\/publish\/mingyu/);
});

test('更新面板使用默认下载和 GitHub 备用线路', async () => {
  const dialogContent = await readFile('src/components/AndroidAppUpdateDialog.tsx', 'utf8');
  assert.match(dialogContent, /默认使用官方下载/);
  assert.match(dialogContent, /updater\.installUpdate/);
  assert.doesNotMatch(dialogContent, /lanzou|蓝奏/i);
});
