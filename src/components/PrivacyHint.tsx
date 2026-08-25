import { useState } from 'react';
import { safeStorage } from '@/lib/safe-storage';
import { WorkspaceButton } from './workspace/WorkspaceUI';

const STORAGE_KEY = 'prompt_studio_privacy_hint_dismissed_v1';

export function PrivacyHint() {
  const [dismissed, setDismissed] = useState(() => safeStorage.get(STORAGE_KEY) === '1');

  if (dismissed) {
    return null;
  }

  function handleDismiss() {
    safeStorage.set(STORAGE_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="workspace-ui-notice" role="note" aria-label="本地数据提示">
      <span>
        提示：姓名、出生日期等信息仅保存在本地浏览器，不会上传服务器。请勿在公共/共享设备上保留个人记录。
      </span>
      <WorkspaceButton variant="ghost" size="small" onClick={handleDismiss} aria-label="不再显示">
        知道了
      </WorkspaceButton>
    </div>
  );
}
