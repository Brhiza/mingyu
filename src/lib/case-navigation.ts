import type { CompatibilityHistoryRecord, PersonalHistoryRecord } from '@/lib/history-records';
import {
  buildResultSearch,
  defaultPromptState,
  type PromptSourceKey,
  type QueryInputState,
} from '@/lib/query-state';

function chartTypeForPromptSource(source: PromptSourceKey): QueryInputState['chartType'] {
  if (source === 'ziwei') return 'ziwei';
  if (source === 'astrolabe' || source === 'qizheng') return 'astrolabe';
  return 'bazi';
}

export function buildPersonalCaseResultPath(
  record: PersonalHistoryRecord,
  source: PromptSourceKey = record.input.chartType,
) {
  const search = buildResultSearch(
    {
      ...record.input,
      chartType: chartTypeForPromptSource(source),
    },
    {
      ...defaultPromptState,
      tab: 'prompt',
      promptSource: source,
    },
  );
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
