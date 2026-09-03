import { useCallback, useEffect, useRef, useState } from 'react';
import {
  compareAndroidVersions,
  downloadAndInstallAndroidUpdate,
  fetchLatestAndroidRelease,
  getAndroidAppInfo,
  openAndroidInstallPermission,
  type AndroidAppInfo,
  type AndroidReleaseInfo,
} from '@/lib/android-app-update';
import { isAndroidApp } from '@/lib/android-ai-app';
import { safeStorage } from '@/lib/safe-storage';
import {
  createTestingRouteProbes,
  probeAndroidDownloadRoutes,
  selectBestAndroidRoute,
  type AndroidDownloadRouteId,
  type AndroidRouteProbe,
} from '@/lib/android-update-routes';

const LAST_CHECK_STORAGE_KEY = 'mingyu:android-update-last-check:v1';
const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type AndroidUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'permission-required'
  | 'downloading'
  | 'installer-opened'
  | 'error';

export type AndroidAppUpdateController = {
  supported: boolean;
  appInfo: AndroidAppInfo | null;
  release: AndroidReleaseInfo | null;
  status: AndroidUpdateStatus;
  message: string;
  dialogOpen: boolean;
  routeProbes: AndroidRouteProbe[];
  selectedRouteId: AndroidDownloadRouteId | null;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  testRoutes: () => Promise<void>;
  selectRoute: (routeId: AndroidDownloadRouteId) => void;
  installUpdate: () => Promise<void>;
  dismissDialog: () => void;
};

function shouldRunAutomaticCheck(now: number): boolean {
  const lastCheck = Number(safeStorage.get(LAST_CHECK_STORAGE_KEY));
  return !Number.isFinite(lastCheck) || now - lastCheck >= AUTO_CHECK_INTERVAL_MS;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function useAndroidAppUpdate(): AndroidAppUpdateController {
  const supported = isAndroidApp();
  const [appInfo, setAppInfo] = useState<AndroidAppInfo | null>(null);
  const [release, setRelease] = useState<AndroidReleaseInfo | null>(null);
  const [status, setStatus] = useState<AndroidUpdateStatus>('idle');
  const [message, setMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [routeProbes, setRouteProbes] = useState<AndroidRouteProbe[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<AndroidDownloadRouteId | null>(null);
  const automaticCheckStartedRef = useRef(false);

  const testReleaseRoutes = useCallback(async (targetRelease: AndroidReleaseInfo) => {
    setRouteProbes(createTestingRouteProbes(targetRelease.downloadRoutes));
    const probes = await probeAndroidDownloadRoutes(targetRelease.downloadRoutes);
    setRouteProbes(probes);
    const best = selectBestAndroidRoute(probes);
    setSelectedRouteId(best?.id ?? targetRelease.downloadRoutes[0]?.id ?? null);
  }, []);

  const checkForUpdates = useCallback(
    async (manual = false) => {
      if (!supported) return;
      setStatus('checking');
      setMessage('正在检查更新…');
      try {
        const [current, latest] = await Promise.all([
          getAndroidAppInfo(),
          fetchLatestAndroidRelease(),
        ]);
        setAppInfo(current);
        setRelease(latest);
        safeStorage.set(LAST_CHECK_STORAGE_KEY, String(Date.now()));
        if (current && latest && compareAndroidVersions(latest.version, current.versionName) > 0) {
          setStatus('available');
          setMessage(`发现新版本 ${latest.version}`);
          setDialogOpen(true);
          setSelectedRouteId(latest.downloadRoutes[0]?.id ?? null);
          return;
        }
        setStatus('up-to-date');
        setMessage(latest ? '当前已是最新版本' : '暂无已发布的 Android 版本');
        if (!manual) setDialogOpen(false);
      } catch (error) {
        setStatus('error');
        setMessage(getErrorMessage(error, '检查更新失败，请稍后重试'));
      }
    },
    [supported],
  );

  const testRoutes = useCallback(async () => {
    if (release) await testReleaseRoutes(release);
  }, [release, testReleaseRoutes]);

  const installUpdate = useCallback(async () => {
    if (!supported || !release) return;
    try {
      const current = await getAndroidAppInfo();
      setAppInfo(current);
      if (!current?.canInstallPackages) {
        setStatus('permission-required');
        setMessage('请允许命语安装未知应用，然后返回再次点击安装');
        await openAndroidInstallPermission();
        return;
      }
      setStatus('downloading');
      setMessage('正在下载并校验更新包…');
      const selectedUrl =
        release.downloadRoutes.find((route) => route.id === selectedRouteId)?.url ??
        selectBestAndroidRoute(routeProbes)?.url ??
        release.downloadRoutes[0]?.url ??
        release.apkUrl;
      await downloadAndInstallAndroidUpdate(release, selectedUrl);
      setStatus('installer-opened');
      setMessage('已打开系统安装页面');
    } catch (error) {
      setStatus('error');
      setMessage(getErrorMessage(error, '下载更新失败，请稍后重试'));
    }
  }, [release, routeProbes, selectedRouteId, supported]);

  useEffect(() => {
    if (!supported) return;
    void getAndroidAppInfo()
      .then(setAppInfo)
      .catch(() => undefined);
    if (!automaticCheckStartedRef.current && shouldRunAutomaticCheck(Date.now())) {
      automaticCheckStartedRef.current = true;
      void checkForUpdates(false);
    }
  }, [checkForUpdates, supported]);

  return {
    supported,
    appInfo,
    release,
    status,
    message,
    dialogOpen,
    routeProbes,
    selectedRouteId,
    checkForUpdates,
    testRoutes,
    selectRoute: setSelectedRouteId,
    installUpdate,
    dismissDialog: () => setDialogOpen(false),
  };
}
