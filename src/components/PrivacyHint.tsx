import { useState } from 'react';
import { Link } from 'react-router-dom';
import { safeStorage } from '@/lib/safe-storage';

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
    <div className="privacy-hint" role="note" aria-label="本地数据提示">
      <span>
        提示：姓名、出生日期等信息仅保存在本地浏览器，不会上传服务器。请勿在公共/共享设备上保留个人记录。
        <Link to="/privacy" className="privacy-hint-link">
          查看隐私政策
        </Link>
      </span>
      <button
        type="button"
        className="privacy-hint-close"
        onClick={handleDismiss}
        aria-label="不再显示"
      >
        知道了
      </button>
    </div>
  );
}
