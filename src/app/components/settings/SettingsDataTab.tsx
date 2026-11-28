import * as React from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../components/ui';
import { warnDev } from '../../../lib/dev-log';
import { cn } from '../../../lib/utils';
import {
  clearAllCachedPackages,
  deleteCachedPackage,
  formatByteSize,
  getAssetOrigin,
  getCachedPackageStats,
  type CachedAssetPackageStat,
} from '../../../remote-assets';
import { downloadLocalDataBackup, importLocalDataBackup } from '../../../v2-ui/data-backup';
import { loadGlobalRules, type GlobalRulesSettings } from '../../../web-settings';

export interface SettingsDataTabProps {
  open: boolean;
  hasRemoteAssets: boolean;
  onRulesRestored: (rules: GlobalRulesSettings) => void;
}

export function SettingsDataTab({
  open,
  hasRemoteAssets,
  onRulesRestored,
}: SettingsDataTabProps) {
  const backupFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [backupNotice, setBackupNotice] = React.useState<{
    tone: 'good' | 'warn';
    text: string;
  } | null>(null);
  const [cacheStats, setCacheStats] = React.useState<CachedAssetPackageStat[]>([]);
  const [cacheBusy, setCacheBusy] = React.useState(false);

  const refreshCacheStats = React.useCallback(async () => {
    if (!getAssetOrigin()) {
      setCacheStats([]);
      return;
    }
    try {
      const stats = await getCachedPackageStats();
      setCacheStats(stats);
    } catch (err) {
      warnDev('SettingsDataTab', '读取离线资源缓存统计失败', err);
      setCacheStats([]);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setBackupNotice(null);
    void refreshCacheStats();
  }, [open, refreshCacheStats]);

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
        <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
          本地数据
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              try {
                const { fileName, itemCount } = downloadLocalDataBackup();
                setBackupNotice({
                  tone: 'good',
                  text:
                    itemCount > 0
                      ? `已导出备份：${fileName}`
                      : `已生成空备份：${fileName}`,
                });
              } catch (err) {
                setBackupNotice({
                  tone: 'warn',
                  text: err instanceof Error ? err.message : '导出备份失败。',
                });
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            <span>导出备份</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => backupFileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>导入恢复</span>
          </Button>
          <input
            ref={backupFileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const text = await file.text();
                const res = importLocalDataBackup(text);
                onRulesRestored(loadGlobalRules());
                setBackupNotice({
                  tone: 'good',
                  text: `导入成功：档案 ${res.personalCasesAdded} · 合盘 ${res.compatibilityAdded} · 历史 ${res.historyAdded} · 对话 ${res.chatSessionsAdded}`,
                });
              } catch (err) {
                setBackupNotice({
                  tone: 'warn',
                  text: err instanceof Error ? err.message : '导入备份失败。',
                });
              }
            }}
          />
        </div>
        {backupNotice ? (
          <p
            className={cn(
              'm-0 text-xs',
              backupNotice.tone === 'good'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400',
            )}
          >
            {backupNotice.text}
          </p>
        ) : null}
      </section>

      {hasRemoteAssets ? (
        <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
              皮肤与牌组缓存
            </h3>
            {cacheStats.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={cacheBusy}
                onClick={async () => {
                  setCacheBusy(true);
                  try {
                    await clearAllCachedPackages();
                    await refreshCacheStats();
                  } finally {
                    setCacheBusy(false);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>清空全部</span>
              </Button>
            ) : null}
          </div>
          {cacheStats.length === 0 ? (
            <p className="m-0 text-xs text-[var(--text-muted)]">暂无已缓存资源包</p>
          ) : (
            <div className="grid gap-2">
              {cacheStats.map((item) => (
                <div
                  key={item.packageId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[var(--text-strong)]">
                      {item.label}
                    </strong>
                    <span className="text-[var(--text-muted)]">
                      {item.cachedBytes > 0 ? formatByteSize(item.cachedBytes) : '已缓存'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={cacheBusy}
                    onClick={async () => {
                      setCacheBusy(true);
                      try {
                        await deleteCachedPackage(item.packageId);
                        await refreshCacheStats();
                      } finally {
                        setCacheBusy(false);
                      }
                    }}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
