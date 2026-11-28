import type { FortuneScope } from '../../../systems/fortune/types';

export const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const;

const FORTUNE_REPORT_STORAGE_KEY = 'mingyu.v2.fortune.reports';
const MAX_SAVED_FORTUNE_REPORTS = 15;

export interface SavedFortuneReportEntry {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  status: string;
  updatedAt: number;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getTodayYmd(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function buildFortuneReportKey(
  scope: FortuneScope,
  year: number,
  month: number,
  day: number,
  caseId: string | null,
): string {
  const target =
    scope === 'daily'
      ? `${year}-${pad2(month)}-${pad2(day)}`
      : scope === 'monthly'
        ? `${year}-${pad2(month)}`
        : String(year);
  return `${scope}:${target}:${caseId ?? 'general'}`;
}

export function readSavedFortuneReports(): Record<string, SavedFortuneReportEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FORTUNE_REPORT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SavedFortuneReportEntry>) : {};
  } catch {
    return {};
  }
}

export function writeSavedFortuneReport(
  key: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  status: string,
): void {
  if (typeof window === 'undefined' || messages.length === 0) return;
  try {
    const store = readSavedFortuneReports();
    store[key] = { messages, status, updatedAt: Date.now() };
    const entries = Object.entries(store)
      .sort((a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0))
      .slice(0, MAX_SAVED_FORTUNE_REPORTS);
    window.localStorage.setItem(FORTUNE_REPORT_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

export function removeSavedFortuneReport(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const store = readSavedFortuneReports();
    if (!(key in store)) return;
    delete store[key];
    window.localStorage.setItem(FORTUNE_REPORT_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function trendBadgeCls(trend: '旺' | '平' | '谨' | '吉' | '慎' | '优选' | '平稳' | '慎用'): string {
  if (trend === '旺' || trend === '吉' || trend === '优选') {
    return 'border-[color-mix(in_srgb,var(--success-text)_26%,transparent)] bg-[color-mix(in_srgb,var(--success-text)_10%,var(--surface-base))] text-[var(--success-text)]';
  }
  if (trend === '谨' || trend === '慎' || trend === '慎用') {
    return 'border-[color-mix(in_srgb,var(--secondary)_34%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_12%,var(--surface-base))] text-[var(--secondary-strong)]';
  }
  return 'border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-secondary)]';
}

export function trendBadgeVariant(
  trend: '旺' | '平' | '谨' | '吉' | '慎' | '优选' | '平稳' | '慎用',
): 'good' | 'outline' | 'default' {
  if (trend === '旺' || trend === '吉' || trend === '优选') return 'good';
  if (trend === '谨' || trend === '慎' || trend === '慎用') return 'outline';
  return 'default';
}
