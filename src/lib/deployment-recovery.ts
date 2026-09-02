const DEPLOYMENT_RELOAD_KEY = 'mingyu:deployment-reload-at';
const DEPLOYMENT_RELOAD_WINDOW_MS = 30_000;

interface DeploymentRecoveryRuntime {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void;
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  location: Pick<Location, 'reload'>;
}

export function shouldReloadDeploymentAssets(lastReloadAt: string | null, now: number): boolean {
  if (!lastReloadAt) return true;
  const parsed = Number(lastReloadAt);
  return !Number.isFinite(parsed) || now - parsed >= DEPLOYMENT_RELOAD_WINDOW_MS;
}

export function registerDeploymentRecovery(runtime: DeploymentRecoveryRuntime = window) {
  runtime.addEventListener('vite:preloadError', (event) => {
    const now = Date.now();
    let lastReloadAt: string | null = null;

    try {
      lastReloadAt = runtime.sessionStorage.getItem(DEPLOYMENT_RELOAD_KEY);
    } catch {
      // sessionStorage 不可用时仍允许浏览器执行一次正常的错误处理。
    }

    if (!shouldReloadDeploymentAssets(lastReloadAt, now)) return;

    try {
      runtime.sessionStorage.setItem(DEPLOYMENT_RELOAD_KEY, String(now));
    } catch {
      // 无痕模式或受限存储下无法可靠防重载，保留原错误处理。
      return;
    }

    event.preventDefault();
    runtime.location.reload();
  });
}
