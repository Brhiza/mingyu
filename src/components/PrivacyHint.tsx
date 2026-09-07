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
        提示：排盘和案例默认保存在当前设备。主动发送 AI 解读时，相关资料和问题会发送到你选择的 AI
        服务；主动分享时才会生成分享链接。AI 默认关闭，请勿在公共或共享设备上保留个人记录。
      </span>
      <WorkspaceButton variant="ghost" size="small" onClick={handleDismiss} aria-label="不再显示">
        知道了
      </WorkspaceButton>
    </div>
  );
}
