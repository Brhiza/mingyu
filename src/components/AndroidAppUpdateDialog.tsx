import type { AndroidAppUpdateController } from '@/hooks/useAndroidAppUpdate';
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';

type AndroidAppUpdateDialogProps = {
  updater: AndroidAppUpdateController;
};

export function AndroidAppUpdateDialog({ updater }: AndroidAppUpdateDialogProps) {
  if (!updater.dialogOpen || !updater.release) return null;
  const busy = updater.status === 'checking' || updater.status === 'downloading';
  const needsPermission = updater.status === 'permission-required';

  return (
    <WorkspaceDialog
      className="android-app-update-dialog"
      labelledBy="android-app-update-title"
      onClose={busy ? undefined : updater.dismissDialog}
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
        <p>{updater.message || '新版本已经可以安装。'}</p>
        <div className="android-update-routes" role="radiogroup" aria-label="下载线路">
          {updater.routeProbes.map((route) => (
            <button
              key={route.id}
              type="button"
              className={updater.selectedRouteId === route.id ? 'is-selected' : ''}
              disabled={busy || route.status === 'unavailable'}
              onClick={() => updater.selectRoute(route.id)}
              role="radio"
              aria-checked={updater.selectedRouteId === route.id}
            >
              <span>{route.name}</span>
              <span>
                {route.status === 'testing'
                  ? '测速中…'
                  : route.status === 'available'
                    ? `${route.latencyMs} ms`
                    : '不可用'}
              </span>
            </button>
          ))}
        </div>
        <WorkspaceButton disabled={busy} onClick={() => void updater.testRoutes()}>
          重新测速
        </WorkspaceButton>
        <small>会自动选择响应最快的可用线路；下载后仍使用 GitHub 官方校验值验证安装包。</small>
      </div>
      <footer className="workspace-ui-dialog-footer">
        <WorkspaceButton disabled={busy} onClick={updater.dismissDialog}>
          稍后
        </WorkspaceButton>
        <WorkspaceButton variant="primary" disabled={busy} onClick={updater.installUpdate}>
          {updater.status === 'downloading'
            ? '正在下载…'
            : needsPermission
              ? '允许安装更新'
              : '下载并安装'}
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}
