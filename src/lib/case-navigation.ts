import type { CompatibilityHistoryRecord, PersonalHistoryRecord } from '@/lib/history-records';
import { buildResultSearch, defaultPromptState } from '@/lib/query-state';

export function buildPersonalCaseResultPath(record: PersonalHistoryRecord) {
  const search = buildResultSearch(record.input, {
    ...defaultPromptState,
    tab: 'prompt',
    promptSource: record.input.chartType,
  });
  return `/result?${search}&caseId=${encodeURIComponent(record.id)}`;
}

export function buildCompatibilityCaseResultPath(record: CompatibilityHistoryRecord) {
  const search = buildResultSearch(record.input, {
    ...defaultPromptState,
    tab: 'prompt',
    promptSource: 'bazi',
    baziShortcutMode: '合婚',
    baziPresetId: 'ai-compat-marriage',
  });
  return `/result?${search}&caseId=${encodeURIComponent(record.id)}`;
}
