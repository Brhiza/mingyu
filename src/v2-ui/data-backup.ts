export const BACKUP_FORMAT_TAG = 'mingyu-local-backup';
export const BACKUP_SCHEMA_VERSION = 1;

/** 需要纳入导出/导入白名单的本地数据键（明确排除 AI 密钥等敏感凭据）。 */
export const BACKUP_ARRAY_KEYS = [
  'mingyu.v2.personal.cases',
  'mingyu.v2.compatibility.records',
  'mingyu.v2.history.records',
  'mingyu.v2.agent.sessions',
] as const;

export const BACKUP_SCALAR_KEYS = [
  'mingyu.v2.activeCaseId',
  'mingyu.v2.agent.activeSessionId',
  'mingyu.v2.fortune.reports',
  'mingyu-theme-mode',
  'mingyu:global-rules:v1',
  'mingyu_workspace_preferences_v5',
  'mingyu.v2.drawerPinned',
  'mingyu.v2.externalAiJump.v1',
] as const;

const ALLOWED_BACKUP_KEYS = new Set<string>([...BACKUP_ARRAY_KEYS, ...BACKUP_SCALAR_KEYS]);

export interface LocalDataBackupPayload {
  format: typeof BACKUP_FORMAT_TAG;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  items: Record<string, string>;
}

export interface LocalDataImportSummary {
  personalCasesAdded: number;
  compatibilityAdded: number;
  historyAdded: number;
  chatSessionsAdded: number;
  settingsRestored: number;
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // 忽略隐私模式或配额不足
  }
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeArrayById(existing: unknown[], incoming: unknown[], maxLimit: number): {
  merged: unknown[];
  added: number;
} {
  const seenIds = new Set<string>();
  const merged: unknown[] = [];

  for (const item of existing) {
    merged.push(item);
    if (item && typeof item === 'object') {
      const id = (item as { id?: unknown }).id;
      if (typeof id === 'string' && id.trim()) seenIds.add(id.trim());
    }
  }

  let added = 0;
  for (const item of incoming) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    const key = typeof id === 'string' ? id.trim() : '';
    if (key && seenIds.has(key)) continue;
    merged.push(item);
    if (key) seenIds.add(key);
    added++;
  }

  return { merged: merged.slice(0, maxLimit), added };
}

/** 导出当前浏览器内的个人档案、合盘、占卜历史、对话记录与偏好设置（不含 AI 密钥）。 */
export function buildLocalDataBackup(
  storage: Storage | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): LocalDataBackupPayload {
  const items: Record<string, string> = {};
  if (storage) {
    for (const key of ALLOWED_BACKUP_KEYS) {
      const raw = safeGet(storage, key);
      if (raw !== null) {
        items[key] = raw;
      }
    }
  }
  return {
    format: BACKUP_FORMAT_TAG,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items,
  };
}

/** 将备份 JSON 文本导入当前浏览器（档案/历史按 ID 合并去重，不覆盖已有不冲突数据）。 */
export function importLocalDataBackup(
  rawText: string,
  storage: Storage | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): LocalDataImportSummary {
  if (!storage) {
    throw new Error('当前环境不支持本地存储，无法导入备份。');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('备份文件格式无效，请选择正确的命语 JSON 备份文件。');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { format?: unknown }).format !== BACKUP_FORMAT_TAG ||
    !(parsed as { items?: unknown }).items ||
    typeof (parsed as { items?: unknown }).items !== 'object' ||
    Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error('这不是有效的命语本地备份文件，无法导入。');
  }

  const incomingItems = (parsed as { items: Record<string, unknown> }).items;
  const summary: LocalDataImportSummary = {
    personalCasesAdded: 0,
    compatibilityAdded: 0,
    historyAdded: 0,
    chatSessionsAdded: 0,
    settingsRestored: 0,
  };

  const arrayLimits: Record<(typeof BACKUP_ARRAY_KEYS)[number], number> = {
    'mingyu.v2.personal.cases': 200,
    'mingyu.v2.compatibility.records': 100,
    'mingyu.v2.history.records': 100,
    'mingyu.v2.agent.sessions': 80,
  };

  for (const key of BACKUP_ARRAY_KEYS) {
    const rawValue = incomingItems[key];
    if (typeof rawValue !== 'string') continue;
    const incomingList = parseJsonArray(rawValue);
    if (!incomingList.length) continue;
    const existingList = parseJsonArray(safeGet(storage, key));
    const { merged, added } = mergeArrayById(existingList, incomingList, arrayLimits[key]);
    if (added > 0) {
      safeSet(storage, key, JSON.stringify(merged));
      if (key === 'mingyu.v2.personal.cases') summary.personalCasesAdded = added;
      else if (key === 'mingyu.v2.compatibility.records') summary.compatibilityAdded = added;
      else if (key === 'mingyu.v2.history.records') summary.historyAdded = added;
      else if (key === 'mingyu.v2.agent.sessions') summary.chatSessionsAdded = added;
    }
  }

  for (const key of BACKUP_SCALAR_KEYS) {
    const rawValue = incomingItems[key];
    if (typeof rawValue !== 'string') continue;
    safeSet(storage, key, rawValue);
    summary.settingsRestored++;
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('mingyu:v2:cases-store'));
    window.dispatchEvent(new CustomEvent('mingyu:history-records'));
  }

  return summary;
}

/** 触发浏览器下载 JSON 备份文件。 */
export function downloadLocalDataBackup(
  storage: Storage | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): { fileName: string; itemCount: number } {
  const payload = buildLocalDataBackup(storage);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `mingyu-backup-${stamp}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { fileName, itemCount: Object.keys(payload.items).length };
}
