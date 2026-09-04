import { registerPlugin } from '@capacitor/core';
import { isAndroidApp } from '@/lib/android-ai-app';
import { buildAndroidDownloadRoutes, type AndroidDownloadRoute } from '@/lib/android-update-routes';

const RELEASE_API_URL = 'https://api.github.com/repos/Brhiza/mingyu/releases?per_page=100';
const RELEASE_DOWNLOAD_PREFIX = 'https://github.com/Brhiza/mingyu/releases/download/';
const RELEASE_MANIFEST_URL = 'https://download.aov.cc/apps/mingyu/android/latest.json';
const RELEASE_CDN_PREFIX = 'https://download.aov.cc/apps/mingyu/android/';
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export interface AndroidAppInfo {
  versionName: string;
  versionCode: number;
  canInstallPackages: boolean;
}

export interface AndroidReleaseInfo {
  version: string;
  tagName: string;
  apkUrl: string;
  checksumUrl: string;
  releaseUrl: string;
  downloadRoutes: AndroidDownloadRoute[];
}

interface AndroidAppUpdatePlugin {
  getAppInfo(): Promise<AndroidAppInfo>;
  openInstallPermission(): Promise<void>;
  downloadAndInstall(options: { apkUrl: string; checksumUrl: string }): Promise<void>;
}

type GitHubRelease = {
  draft?: unknown;
  prerelease?: unknown;
  tag_name?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

type AndroidReleaseManifest = {
  appId?: unknown;
  packageName?: unknown;
  channel?: unknown;
  version?: unknown;
  fileName?: unknown;
  apkUrl?: unknown;
  checksumUrl?: unknown;
  releaseUrl?: unknown;
};

const AndroidAppUpdate = registerPlugin<AndroidAppUpdatePlugin>('AndroidAppUpdate');

function parseVersion(value: string): [number, number, number] | null {
  const match = VERSION_PATTERN.exec(value.trim());
  if (!match) return null;
  const parts = match.slice(1).map(Number) as [number, number, number];
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function isOfficialAssetUrl(value: string, tagName: string, assetName: string): boolean {
  return value === `${RELEASE_DOWNLOAD_PREFIX}${tagName}/${assetName}`;
}

export function compareAndroidVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return 0;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index])
      return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

export function normalizeAndroidRelease(value: unknown): AndroidReleaseInfo | null {
  if (!value || typeof value !== 'object') return null;
  const release = value as GitHubRelease;
  if (release.draft === true || release.prerelease === true) return null;
  const tagName = typeof release.tag_name === 'string' ? release.tag_name.trim() : '';
  const version = tagName.startsWith('android-v') ? tagName.slice('android-v'.length) : '';
  if (!parseVersion(version) || !Array.isArray(release.assets)) return null;

  const apkName = `mingyu-${version}.apk`;
  const checksumName = `${apkName}.sha256`;
  const assets = release.assets.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const asset = item as { name?: unknown; browser_download_url?: unknown };
    const name = typeof asset.name === 'string' ? asset.name : '';
    const url = typeof asset.browser_download_url === 'string' ? asset.browser_download_url : '';
    return name && url ? [{ name, url }] : [];
  });
  const apkUrl = assets.find((asset) => asset.name === apkName)?.url ?? '';
  const checksumUrl = assets.find((asset) => asset.name === checksumName)?.url ?? '';
  if (
    !isOfficialAssetUrl(apkUrl, tagName, apkName) ||
    !isOfficialAssetUrl(checksumUrl, tagName, checksumName)
  ) {
    return null;
  }

  const releaseUrl =
    typeof release.html_url === 'string' &&
    release.html_url === `https://github.com/Brhiza/mingyu/releases/tag/${tagName}`
      ? release.html_url
      : `https://github.com/Brhiza/mingyu/releases/tag/${tagName}`;
  return {
    version,
    tagName,
    apkUrl,
    checksumUrl,
    releaseUrl,
    downloadRoutes: buildAndroidDownloadRoutes(
      version,
      `${RELEASE_CDN_PREFIX}${version}/mingyu-${version}.apk`,
    ),
  };
}

export function normalizeAndroidManifest(value: unknown): AndroidReleaseInfo | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as AndroidReleaseManifest;
  const version = typeof manifest.version === 'string' ? manifest.version.trim() : '';
  if (!parseVersion(version)) return null;
  const fileName = `mingyu-${version}.apk`;
  const apkUrl = `${RELEASE_CDN_PREFIX}${version}/${fileName}`;
  const checksumUrl = `${apkUrl}.sha256`;
  if (
    manifest.appId !== 'mingyu' ||
    manifest.packageName !== 'cc.aov.mingyu' ||
    manifest.channel !== 'latest' ||
    manifest.fileName !== fileName ||
    manifest.apkUrl !== apkUrl ||
    manifest.checksumUrl !== checksumUrl
  ) {
    return null;
  }
  const tagName = `android-v${version}`;
  const expectedReleaseUrl = `https://github.com/Brhiza/mingyu/releases/tag/${tagName}`;
  return {
    version,
    tagName,
    apkUrl,
    checksumUrl,
    releaseUrl: manifest.releaseUrl === expectedReleaseUrl ? expectedReleaseUrl : '',
    downloadRoutes: buildAndroidDownloadRoutes(version, apkUrl),
  };
}

export async function getAndroidAppInfo(): Promise<AndroidAppInfo | null> {
  if (!isAndroidApp()) return null;
  const result = await AndroidAppUpdate.getAppInfo();
  return {
    versionName: typeof result.versionName === 'string' ? result.versionName : '',
    versionCode: Number.isFinite(result.versionCode) ? result.versionCode : 0,
    canInstallPackages: result.canInstallPackages === true,
  };
}

export async function fetchLatestAndroidRelease(
  fetcher: typeof fetch = fetch,
): Promise<AndroidReleaseInfo | null> {
  try {
    const manifestResponse = await fetcher(RELEASE_MANIFEST_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (manifestResponse.ok) {
      const manifest = normalizeAndroidManifest(await manifestResponse.json());
      if (manifest) return manifest;
    }
  } catch {
    // Continue with the existing GitHub Release source.
  }
  const response = await fetcher(RELEASE_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub 更新检查失败（${response.status}）`);
  const releases = await response.json();
  if (!Array.isArray(releases)) throw new Error('GitHub 更新数据格式不正确');
  for (const release of releases) {
    const normalized = normalizeAndroidRelease(release);
    if (normalized) return normalized;
  }
  return null;
}

export async function openAndroidInstallPermission(): Promise<void> {
  await AndroidAppUpdate.openInstallPermission();
}

export async function downloadAndInstallAndroidUpdate(
  release: AndroidReleaseInfo,
  apkUrl = release.apkUrl,
): Promise<void> {
  await AndroidAppUpdate.downloadAndInstall({
    apkUrl,
    checksumUrl: release.checksumUrl,
  });
}
