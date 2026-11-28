import { ASSET_ORIGIN } from './brand-config';
import { warnDev } from './lib/dev-log';

export const ASSET_CACHE_NAME = 'mingyu-remote-assets-v1';
const REMOTE_SKINS_CACHE_KEY = 'mingyu.remote.skins.v1';
const REMOTE_SKIN_STYLE_ID = 'mingyu-remote-skin-tokens';

const BUILT_IN_COLOR_THEME_IDS = new Set(['blossom', 'jade', 'indigo', 'amber', 'violet']);
const VALID_REMOTE_SKIN_ID = /^[a-z0-9-]+$/;

export type SkinThemeId = string;

export interface RemoteSkinTokens {
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface RemoteSkinDefinition {
  id: string;
  label: string;
  swatches: readonly [string, string, string];
  tokens?: RemoteSkinTokens;
}

export interface RemoteAssetFile {
  path: string;
  bytes: number;
  hash: string;
}

export interface RemoteAssetPackage {
  fingerprint: string;
  bytes: number;
  files: RemoteAssetFile[];
}

export interface RemoteAssetManifest {
  version: 1;
  skins?: RemoteSkinDefinition[];
  packageLabels?: Record<string, string>;
  packages: Record<string, RemoteAssetPackage>;
}

export interface AssetDownloadProgress {
  packageId: string;
  loadedBytes: number;
  totalBytes: number;
  completedFiles: number;
  totalFiles: number;
}

export interface CachedAssetPackageStat {
  packageId: string;
  label: string;
  cachedFiles: number;
  totalFiles: number;
  cachedBytes: number;
  totalBytes: number;
}

export interface AssetSyncOptions {
  origin?: string;
  fetcher?: typeof fetch;
  cacheStorage?: CacheStorage;
  signal?: AbortSignal;
  onProgress?: (progress: AssetDownloadProgress) => void;
}

let customAssetOriginOverride: string | null = null;
let manifestPromise: Promise<RemoteAssetManifest | null> | null = null;
let cachedManifest: RemoteAssetManifest | null = null;
let remoteSkins: RemoteSkinDefinition[] = [];
let remotePackageLabels: Record<string, string> = {};
const assetIndex = new Map<string, RemoteAssetFile>();

function formatCssVarsBlock(vars: Record<string, string> | undefined): string {
  if (!vars) return '';
  const decls: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    if (!/^--[a-z0-9-]+$/.test(k) || typeof v !== 'string') continue;
    const clean = v.trim();
    if (!clean || /[{}]/.test(clean)) continue;
    decls.push(`${k}:${clean}`);
  }
  return decls.join(';');
}

export function buildRemoteSkinCssText(skins: readonly RemoteSkinDefinition[]): string {
  const chunks: string[] = [];
  for (const skin of skins) {
    if (!VALID_REMOTE_SKIN_ID.test(skin.id) || BUILT_IN_COLOR_THEME_IDS.has(skin.id)) continue;
    const lightCss = formatCssVarsBlock(skin.tokens?.light);
    const darkCss = formatCssVarsBlock(skin.tokens?.dark);
    if (lightCss) {
      chunks.push(`:root[data-accent-theme="${skin.id}"]{${lightCss}}`);
    }
    if (darkCss) {
      chunks.push(`:root[data-theme="dark"][data-accent-theme="${skin.id}"]{${darkCss}}`);
      chunks.push(
        `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])[data-accent-theme="${skin.id}"]{${darkCss}}}`,
      );
    }
  }
  return chunks.join('\n');
}

function applyRemoteSkinStyles(skins: readonly RemoteSkinDefinition[]): void {
  if (typeof document === 'undefined' || !document.head) return;
  const cssText = buildRemoteSkinCssText(skins);
  let styleEl = document.getElementById(REMOTE_SKIN_STYLE_ID) as HTMLStyleElement | null;
  if (!cssText) {
    styleEl?.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = REMOTE_SKIN_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  if (styleEl.textContent !== cssText) {
    styleEl.textContent = cssText;
  }
}

export function hydrateCachedRemoteSkins(originOverride?: string): readonly RemoteSkinDefinition[] {
  if (!getAssetOrigin(originOverride)) {
    remoteSkins = [];
    remotePackageLabels = {};
    applyRemoteSkinStyles([]);
    return remoteSkins;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(REMOTE_SKINS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          skins?: RemoteSkinDefinition[];
          packageLabels?: Record<string, string>;
        };
        if (Array.isArray(parsed.skins)) {
          remoteSkins = parsed.skins;
        }
        if (parsed.packageLabels && typeof parsed.packageLabels === 'object') {
          remotePackageLabels = parsed.packageLabels;
        }
        applyRemoteSkinStyles(remoteSkins);
      }
    } catch {}
  }
  return remoteSkins;
}

export function getRemoteSkins(): readonly RemoteSkinDefinition[] {
  if (!getAssetOrigin()) return [];
  return remoteSkins;
}

export function setCustomAssetOriginOverride(origin: string | null): void {
  customAssetOriginOverride = origin === null ? null : origin.trim().replace(/\/+$/, '');
  manifestPromise = null;
  cachedManifest = null;
  remoteSkins = [];
  remotePackageLabels = {};
  assetIndex.clear();
  applyRemoteSkinStyles([]);
}

export function getAssetOrigin(explicitOrigin?: string): string {
  if (typeof explicitOrigin === 'string') return explicitOrigin.trim().replace(/\/+$/, '');
  if (customAssetOriginOverride !== null) return customAssetOriginOverride;
  return ASSET_ORIGIN;
}

export function isSkinThemeId(themeId: string): boolean {
  if (!themeId || BUILT_IN_COLOR_THEME_IDS.has(themeId)) return false;
  if (remoteSkins.some((skin) => skin.id === themeId)) return true;
  return Boolean(getAssetOrigin()) && VALID_REMOTE_SKIN_ID.test(themeId);
}

export function packageIdForSkinTheme(themeId: string): string | null {
  return isSkinThemeId(themeId) ? `theme:${themeId}` : null;
}

export function packageIdForTarotDeck(deckId: string): string {
  return `deck:${deckId}`;
}

export function formatAssetPackageLabel(packageId: string): string {
  if (remotePackageLabels[packageId]) return remotePackageLabels[packageId];
  if (packageId.startsWith('theme:')) {
    const sid = packageId.slice('theme:'.length);
    const matched = remoteSkins.find((skin) => skin.id === sid);
    if (matched) return `${matched.label} · 皮肤`;
  }
  return packageId;
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildRemoteAssetUrl(path: string, hash?: string, originOverride?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getAssetOrigin(originOverride);
  const base = origin ? `${origin}${normalizedPath}` : normalizedPath;
  return hash ? `${base}?asset=${encodeURIComponent(hash)}` : base;
}

export function resolveRemoteAssetUrl(path: string, originOverride?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const file = assetIndex.get(normalizedPath);
  return buildRemoteAssetUrl(normalizedPath, file?.hash, originOverride);
}

export function isEssentialSkinAssetPath(path: string): boolean {
  return (
    path.endsWith('/logo.webp') ||
    path.endsWith('/banner.webp') ||
    path.endsWith('/theme.json') ||
    path.endsWith('/cards/tarot/back.webp')
  );
}

export function getSkinLogoUrl(themeId: string, originOverride?: string): string | null {
  if (!isSkinThemeId(themeId) || !getAssetOrigin(originOverride)) return null;
  return resolveRemoteAssetUrl(`/divination-themes/${themeId}/logo.webp`, originOverride);
}

export function getSkinBannerUrl(themeId: string, originOverride?: string): string | null {
  if (!isSkinThemeId(themeId) || !getAssetOrigin(originOverride)) return null;
  return resolveRemoteAssetUrl(`/divination-themes/${themeId}/banner.webp`, originOverride);
}

export function getSkinCardBackUrl(themeId: string, originOverride?: string): string | null {
  if (!isSkinThemeId(themeId) || !getAssetOrigin(originOverride)) return null;
  return resolveRemoteAssetUrl(`/divination-themes/${themeId}/cards/tarot/back.webp`, originOverride);
}

export function getSkinTarotCardUrl(
  themeId: string,
  index: number,
  originOverride?: string,
): string | null {
  if (!isSkinThemeId(themeId) || !getAssetOrigin(originOverride)) return null;
  if (!Number.isInteger(index) || index < 0 || index > 77) return null;
  return resolveRemoteAssetUrl(
    `/divination-themes/${themeId}/cards/tarot/${String(index).padStart(3, '0')}.webp`,
    originOverride,
  );
}

export function getSkinLenormandCardUrl(
  themeId: string,
  id: number,
  originOverride?: string,
): string | null {
  if (!isSkinThemeId(themeId) || !getAssetOrigin(originOverride)) return null;
  if (!Number.isInteger(id) || id < 1 || id > 36) return null;
  return resolveRemoteAssetUrl(
    `/divination-themes/${themeId}/cards/lenormand/${String(id).padStart(2, '0')}.webp`,
    originOverride,
  );
}

export function getSkinOracleCardUrl(
  themeId: string,
  id: number,
  originOverride?: string,
): string | null {
  if (!isSkinThemeId(themeId) || !getAssetOrigin(originOverride)) return null;
  if (!Number.isInteger(id) || id < 1 || id > 60) return null;
  return resolveRemoteAssetUrl(
    `/divination-themes/${themeId}/cards/oracle/${String(id).padStart(2, '0')}.webp`,
    originOverride,
  );
}

export function getActiveSkinThemeFromDocument(): SkinThemeId | null {
  if (typeof document === 'undefined') return null;
  const attr = document.documentElement?.getAttribute('data-accent-theme') ?? '';
  return isSkinThemeId(attr) ? attr : null;
}

function indexManifest(manifest: RemoteAssetManifest): void {
  cachedManifest = manifest;
  assetIndex.clear();
  for (const pkg of Object.values(manifest.packages)) {
    for (const file of pkg.files) {
      assetIndex.set(file.path, file);
    }
  }
  if (Array.isArray(manifest.skins)) {
    remoteSkins = manifest.skins;
  }
  if (manifest.packageLabels && typeof manifest.packageLabels === 'object') {
    remotePackageLabels = manifest.packageLabels;
  }
  if (typeof localStorage !== 'undefined' && (Array.isArray(manifest.skins) || manifest.packageLabels)) {
    try {
      localStorage.setItem(
        REMOTE_SKINS_CACHE_KEY,
        JSON.stringify({ skins: remoteSkins, packageLabels: remotePackageLabels }),
      );
    } catch {}
  }
  applyRemoteSkinStyles(remoteSkins);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mingyu:remote-skins-loaded'));
  }
}

export async function loadAssetManifest(
  options?: { forceRefresh?: boolean; origin?: string; fetcher?: typeof fetch },
): Promise<RemoteAssetManifest | null> {
  const origin = getAssetOrigin(options?.origin);
  if (!origin) return null;
  if (!options?.forceRefresh && cachedManifest) return cachedManifest;
  if (!options?.forceRefresh && manifestPromise) return manifestPromise;

  const fetcher = options?.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== 'function') return null;

  manifestPromise = fetcher(`${origin}/theme-assets-manifest.json`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`资源清单拉取失败（${res.status}）`);
      const manifest = (await res.json()) as RemoteAssetManifest;
      if (manifest.version !== 1 || !manifest.packages || typeof manifest.packages !== 'object') {
        throw new Error('资源清单格式无效');
      }
      indexManifest(manifest);
      return manifest;
    })
    .catch((err) => {
      manifestPromise = null;
      throw err;
    });

  return manifestPromise;
}

async function cleanupOutdatedCacheEntries(cache: Cache, origin: string): Promise<void> {
  const keys = await cache.keys();
  for (const request of keys) {
    try {
      const url = new URL(request.url, origin || 'https://assets.local');
      const current = assetIndex.get(url.pathname);
      if (!current || url.searchParams.get('asset') !== current.hash) {
        await cache.delete(request);
      }
    } catch {
      await cache.delete(request);
    }
  }
}

function makeAbortError(): Error {
  const err = new Error('下载已取消');
  err.name = 'AbortError';
  return err;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw makeAbortError();
  }
}

async function fetchAndCacheFiles(
  files: readonly RemoteAssetFile[],
  options: {
    origin: string;
    cache: Cache;
    fetcher: typeof fetch;
    signal?: AbortSignal;
    concurrency?: number;
    onFileDone?: (file: RemoteAssetFile) => void;
  },
): Promise<number> {
  if (files.length === 0) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('当前处于离线状态，无法下载皮肤或牌组资源');
  }
  let cursor = 0;
  let downloaded = 0;
  const workerCount = Math.min(options.concurrency ?? 8, files.length);
  const worker = async () => {
    while (cursor < files.length) {
      throwIfAborted(options.signal);
      const file = files[cursor++];
      if (!file) return;
      const url = buildRemoteAssetUrl(file.path, file.hash, options.origin);
      const response = await options.fetcher(url, {
        cache: 'force-cache',
        mode: 'cors',
        signal: options.signal,
      });
      throwIfAborted(options.signal);
      if (!response.ok) {
        throw new Error(`资源下载失败（${response.status}）：${file.path}`);
      }
      await options.cache.put(url, response);
      throwIfAborted(options.signal);
      downloaded += 1;
      options.onFileDone?.(file);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));
  return downloaded;
}

export async function ensureAssetPackage(
  packageId: string,
  options: AssetSyncOptions = {},
): Promise<{ ok: boolean; downloaded: number; totalFiles: number; reason?: string }> {
  throwIfAborted(options.signal);
  const origin = getAssetOrigin(options.origin);
  if (!origin) {
    return { ok: false, downloaded: 0, totalFiles: 0, reason: '未配置远程资源源地址' };
  }
  const cacheStorage = options.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (!cacheStorage || typeof fetcher !== 'function') {
    return { ok: false, downloaded: 0, totalFiles: 0, reason: '当前环境不支持本地持久化缓存' };
  }

  const manifest = await loadAssetManifest({ origin, fetcher });
  throwIfAborted(options.signal);
  const assetPackage = manifest?.packages[packageId];
  if (!assetPackage) {
    return { ok: false, downloaded: 0, totalFiles: 0, reason: `未找到资源包：${packageId}` };
  }

  const cache = await cacheStorage.open(ASSET_CACHE_NAME);
  await cleanupOutdatedCacheEntries(cache, origin);
  throwIfAborted(options.signal);

  let loadedBytes = 0;
  let completedFiles = 0;
  const pending: RemoteAssetFile[] = [];

  for (const file of assetPackage.files) {
    throwIfAborted(options.signal);
    const url = buildRemoteAssetUrl(file.path, file.hash, origin);
    const hit = await cache.match(url);
    if (hit) {
      loadedBytes += file.bytes;
      completedFiles += 1;
    } else {
      pending.push(file);
    }
  }

  pending.sort((a, b) => Number(isEssentialSkinAssetPath(b.path)) - Number(isEssentialSkinAssetPath(a.path)));

  const totalFiles = assetPackage.files.length;
  const report = () => {
    if (options.signal?.aborted) return;
    options.onProgress?.({
      packageId,
      loadedBytes: Math.min(assetPackage.bytes, loadedBytes),
      totalBytes: assetPackage.bytes,
      completedFiles,
      totalFiles,
    });
  };
  report();

  if (pending.length === 0) {
    return { ok: true, downloaded: 0, totalFiles };
  }

  const downloaded = await fetchAndCacheFiles(pending, {
    origin,
    cache,
    fetcher,
    signal: options.signal,
    concurrency: 8,
    onFileDone: (file) => {
      loadedBytes += file.bytes;
      completedFiles += 1;
      report();
    },
  });
  return { ok: true, downloaded, totalFiles };
}

let activeBgPackageId: string | null = null;
let activeBgController: AbortController | null = null;
let activeBgPromise: Promise<void> | null = null;

export function waitForBackgroundWarmup(): Promise<void> {
  return activeBgPromise ?? Promise.resolve();
}

export async function warmAssetPackageInBackground(
  packageId: string,
  options: { origin?: string; fetcher?: typeof fetch; cacheStorage?: CacheStorage } = {},
): Promise<void> {
  const origin = getAssetOrigin(options.origin);
  const cacheStorage = options.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (!origin || !cacheStorage || typeof fetcher !== 'function') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  if (activeBgPackageId === packageId && activeBgController && !activeBgController.signal.aborted) {
    return;
  }

  activeBgController?.abort();
  const controller = new AbortController();
  activeBgPackageId = packageId;
  activeBgController = controller;

  try {
    const manifest = await loadAssetManifest({ origin, fetcher });
    if (controller.signal.aborted) return;
    const assetPackage = manifest?.packages[packageId];
    if (!assetPackage) return;

    const cache = await cacheStorage.open(ASSET_CACHE_NAME);
    await cleanupOutdatedCacheEntries(cache, origin);
    if (controller.signal.aborted) return;

    const isTheme = packageId.startsWith('theme:');
    const essentialList: RemoteAssetFile[] = [];
    const backgroundList: RemoteAssetFile[] = [];

    assetPackage.files.forEach((file, index) => {
      const essential = isTheme ? isEssentialSkinAssetPath(file.path) : index < 2;
      if (essential) essentialList.push(file);
      else backgroundList.push(file);
    });

    const filterPending = async (list: readonly RemoteAssetFile[]) => {
      const missing: RemoteAssetFile[] = [];
      for (const file of list) {
        if (controller.signal.aborted) return [];
        const hit = await cache.match(buildRemoteAssetUrl(file.path, file.hash, origin));
        if (!hit) missing.push(file);
      }
      return missing;
    };

    const missingEssentials = await filterPending(essentialList);
    if (missingEssentials.length > 0 && !controller.signal.aborted) {
      await fetchAndCacheFiles(missingEssentials, {
        origin,
        cache,
        fetcher,
        signal: controller.signal,
        concurrency: 4,
      });
    }

    if (backgroundList.length > 0 && !controller.signal.aborted) {
      const bgTask = (async () => {
        try {
          const missingRest = await filterPending(backgroundList);
          if (missingRest.length > 0 && !controller.signal.aborted) {
            await fetchAndCacheFiles(missingRest, {
              origin,
              cache,
              fetcher,
              signal: controller.signal,
              concurrency: 6,
            });
          }
        } catch {
          // 后台预热静默容错，不干扰前台交互
        } finally {
          if (activeBgController === controller) {
            activeBgPackageId = null;
            activeBgController = null;
            activeBgPromise = null;
          }
        }
      })();
      activeBgPromise = bgTask;
    } else if (activeBgController === controller) {
      activeBgPackageId = null;
      activeBgController = null;
      activeBgPromise = null;
    }
  } catch (err) {
    warnDev('remote-assets', '后台预热远程资源失败', err);
    if (activeBgController === controller) {
      activeBgPackageId = null;
      activeBgController = null;
      activeBgPromise = null;
    }
  }
}

export async function getCachedPackageStats(
  options: { origin?: string; fetcher?: typeof fetch; cacheStorage?: CacheStorage } = {},
): Promise<CachedAssetPackageStat[]> {
  const origin = getAssetOrigin(options.origin);
  const cacheStorage = options.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  if (!cacheStorage) return [];

  const cache = await cacheStorage.open(ASSET_CACHE_NAME);
  const keys = await cache.keys();
  const cachedUrls = new Set(keys.map((req) => req.url));

  if (origin) {
    try {
      const manifest = await loadAssetManifest({ origin, fetcher: options.fetcher });
      if (manifest) {
        const stats: CachedAssetPackageStat[] = [];
        for (const [packageId, pkg] of Object.entries(manifest.packages)) {
          let cachedFiles = 0;
          let cachedBytes = 0;
          for (const file of pkg.files) {
            const url = buildRemoteAssetUrl(file.path, file.hash, origin);
            if (cachedUrls.has(url)) {
              cachedFiles += 1;
              cachedBytes += file.bytes;
            }
          }
          if (cachedFiles > 0) {
            stats.push({
              packageId,
              label: formatAssetPackageLabel(packageId),
              cachedFiles,
              totalFiles: pkg.files.length,
              cachedBytes,
              totalBytes: pkg.bytes,
            });
          }
        }
        return stats;
      }
    } catch (err) {
      warnDev('remote-assets', '按清单统计缓存失败，回退至路径聚合', err);
    }
  }

  // 无清单时按路径前缀粗略聚合
  const groups = new Map<string, number>();
  for (const urlStr of cachedUrls) {
    try {
      const pathname = new URL(urlStr, 'https://assets.local').pathname;
      const themeMatch = /^\/divination-themes\/([^/]+)\//.exec(pathname);
      const deckMatch = /^\/card-decks\/tarot\/([^/]+)\//.exec(pathname);
      const lenormandMatch = /^\/card-decks\/lenormand\/([^/]+)\//.exec(pathname);
      const pkgId = themeMatch
        ? `theme:${themeMatch[1]}`
        : deckMatch
          ? `deck:${deckMatch[1]}`
          : lenormandMatch
            ? `deck:lenormand-${lenormandMatch[1]}`
            : 'other';
      groups.set(pkgId, (groups.get(pkgId) ?? 0) + 1);
    } catch {}
  }
  return Array.from(groups.entries()).map(([packageId, count]) => ({
    packageId,
    label: formatAssetPackageLabel(packageId),
    cachedFiles: count,
    totalFiles: count,
    cachedBytes: 0,
    totalBytes: 0,
  }));
}

export async function deleteCachedPackage(
  packageId: string,
  options: { origin?: string; fetcher?: typeof fetch; cacheStorage?: CacheStorage } = {},
): Promise<number> {
  const cacheStorage = options.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  if (!cacheStorage) return 0;

  const cache = await cacheStorage.open(ASSET_CACHE_NAME);
  const origin = getAssetOrigin(options.origin);
  let removed = 0;

  if (origin) {
    try {
      const manifest = await loadAssetManifest({ origin, fetcher: options.fetcher });
      const pkg = manifest?.packages[packageId];
      if (pkg) {
        for (const file of pkg.files) {
          const url = buildRemoteAssetUrl(file.path, file.hash, origin);
          if (await cache.delete(url)) removed += 1;
        }
        return removed;
      }
    } catch (err) {
      warnDev('remote-assets', '按清单删除缓存包失败，回退至前缀清理', err);
    }
  }

  const keys = await cache.keys();
  const prefix = packageId.startsWith('theme:')
    ? `/divination-themes/${packageId.slice('theme:'.length)}/`
    : packageId === 'deck:lenormand-danjie-leopard'
      ? '/card-decks/lenormand/danjie-leopard/'
      : packageId.startsWith('deck:')
        ? `/card-decks/tarot/${packageId.slice('deck:'.length)}/`
        : '';
  if (!prefix) return 0;

  for (const req of keys) {
    try {
      const pathname = new URL(req.url, 'https://assets.local').pathname;
      if (pathname.startsWith(prefix) && (await cache.delete(req))) {
        removed += 1;
      }
    } catch {}
  }
  return removed;
}

export async function clearAllCachedPackages(
  options: { cacheStorage?: CacheStorage } = {},
): Promise<boolean> {
  const cacheStorage = options.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  if (!cacheStorage) return false;
  return cacheStorage.delete(ASSET_CACHE_NAME);
}
