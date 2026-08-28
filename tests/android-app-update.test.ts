import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  compareAndroidVersions,
  fetchLatestAndroidRelease,
  normalizeAndroidRelease,
} from '../src/lib/android-app-update.ts';

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

test('APK 工作流覆盖调试构建、正式签名、校验文件和 Release', async () => {
  const workflow = await readFile('.github/workflows/android-apk.yml', 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /ANDROID_SIGNING_KEYSTORE_BASE64/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /APKSIGNER.*verify/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /gh release create/);
});
