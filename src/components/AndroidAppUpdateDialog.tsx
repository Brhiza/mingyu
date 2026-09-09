import { useEffect } from 'react';
import type { AndroidAppUpdateController } from '@/hooks/useAndroidAppUpdate';
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';

type AndroidAppUpdateDialogProps = {
  updater: AndroidAppUpdateController;
};

export function AndroidAppUpdateDialog({ updater }: AndroidAppUpdateDialogProps) {
  useEffect(() => {
    if (updater.dialogOpen && updater.release) void updater.testRoutes();
  }, [updater.dialogOpen, updater.release?.version]);

  if (!updater.dialogOpen || !updater.release) return null;
  const displayedRoutes = updater.routeProbes.length
    ? updater.routeProbes
    : updater.release.downloadRoutes.map((route) => ({ ...route, status: 'testing' as const, latencyMs: null }));

  return (
    <WorkspaceDialog
      className="android-app-update-dialog"
      labelledBy="android-app-update-title"
      onClose={updater.dismissDialog}
    >
      <header className="workspace-ui-dialog-header">
        <div>
          <h2 id="android-app-update-title">发现新版本</h2>
          <p>
            当前版本 {updater.appInfo?.versionName || '未知'}，可更新到 {updater.release.version}
          </p>
        </div>
      </header>
      <div className="workspace-ui-dialog-body android-app-update-body">
        <p>默认使用官方下载；下载失败时会自动尝试 GitHub。</p>
        <div className="android-update-routes" role="radiogroup" aria-label="下载线路">
          {displayedRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              role="radio"
              aria-checked={updater.selectedRouteId === route.id}
              className={updater.selectedRouteId === route.id ? 'is-selected' : ''}
              disabled={route.status === 'unavailable'}
              onClick={() => updater.selectRoute(route.id)}
            >
              <span>{route.name}</span>
              <span>{route.status === 'testing' ? '检测中…' : route.status === 'available' ? `${route.latencyMs} ms` : '不可用'}</span>
            </button>
          ))}
        </div>
      </div>
      <footer className="workspace-ui-dialog-footer">
        <WorkspaceButton onClick={updater.dismissDialog}>稍后</WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={() => void updater.installUpdate()}>
          {updater.status === 'downloading' ? '正在下载…' : '下载并安装'}
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}
