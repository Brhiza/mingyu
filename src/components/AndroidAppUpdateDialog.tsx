import { useState } from 'react';
import type { AndroidAppUpdateController } from '@/hooks/useAndroidAppUpdate';
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';

const LANZOU_UPDATE_URL = 'https://cooldy.lanzout.com/b0w9zwqza';
const LANZOU_PASSWORD = '9yw7';

type AndroidAppUpdateDialogProps = {
  updater: AndroidAppUpdateController;
};

export function AndroidAppUpdateDialog({ updater }: AndroidAppUpdateDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!updater.dialogOpen || !updater.release) return null;

  const handleOpenLanzou = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(LANZOU_PASSWORD);
      } else {
        const input = document.createElement('input');
        input.value = LANZOU_PASSWORD;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // 忽略剪贴板写入异常
    }
    window.open(LANZOU_UPDATE_URL, '_blank', 'noopener,noreferrer');
  };

  const handleOpenGithub = () => {
    const url = updater.release?.releaseUrl || updater.release?.apkUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

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
        <p>为保证国内下载顺畅稳定，推荐前往蓝奏云网盘下载最新 APK 安装包。</p>

        <div
          className="android-update-lanzou-card"
          onClick={handleOpenLanzou}
          role="button"
          tabIndex={0}
        >
          <div className="android-update-lanzou-title">
            <strong>蓝奏云网盘下载（推荐）</strong>
            <span className="android-update-pwd-tag">密码：{LANZOU_PASSWORD}</span>
          </div>
          <p className="android-update-lanzou-tip">
            {copied
              ? '已复制密码「9yw7」，正在打开蓝奏云…'
              : '点击将自动复制访问密码并打开下载页面'}
          </p>
        </div>

        <div className="android-update-fallback-section">
          <span>其他下载方式：</span>
          <button type="button" className="android-update-link-btn" onClick={handleOpenGithub}>
            GitHub Releases 官方发布页
          </button>
        </div>
      </div>
      <footer className="workspace-ui-dialog-footer">
        <WorkspaceButton onClick={updater.dismissDialog}>稍后</WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={handleOpenLanzou}>
          {copied ? '已复制密码，前往下载' : '前往蓝奏云下载'}
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}
