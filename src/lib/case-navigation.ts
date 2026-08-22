import type {
  CompatibilityHistoryRecord,
  DivinationHistoryRecord,
  PersonalHistoryRecord,
} from '@/lib/history-records';
import {
  buildResultSearch,
  defaultPromptState,
  hasCompletePreciseBirthData,
  type PromptSourceKey,
  type QueryInputState,
  type QueryPromptState,
  type ResultTabKey,
} from '@/lib/query-state';
import { resolvePersonalWorkspaceSource } from '@/lib/workspace';

export const CHART_RECORD_PARAM = 'rid';

export function normalizeChartInputForSource(
  input: QueryInputState,
  source: PromptSourceKey,
): QueryInputState {
  const chartType: QueryInputState['chartType'] =
    source === 'ziwei'
      ? 'ziwei'
      : source === 'astrolabe' || source === 'qizheng'
        ? 'astrolabe'
        : 'bazi';
  const requiresPreciseBirthData = source === 'astrolabe' || source === 'qizheng';
  const canKeepTrueSolarTime =
    input.analysisMode === 'compatibility' || hasCompletePreciseBirthData(input);

  return {
    ...input,
    chartType,
    useTrueSolarTime: requiresPreciseBirthData
      ? true
      : input.useTrueSolarTime && canKeepTrueSolarTime,
  };
}

export function buildChartRecordPath(
  input: QueryInputState,
  prompt: QueryPromptState,
  recordId?: string,
) {
  const normalizedInput = normalizeChartInputForSource(input, prompt.promptSource);
  const params = new URLSearchParams(buildResultSearch(normalizedInput, prompt));
  if (recordId) {
    params.set(CHART_RECORD_PARAM, recordId);
  }
  return `/result?${params.toString()}`;
}

export function preserveChartRecordId(nextSearch: string, currentParams: URLSearchParams) {
  const params = new URLSearchParams(nextSearch);
  const recordId = currentParams.get(CHART_RECORD_PARAM);
  if (recordId) {
    params.set(CHART_RECORD_PARAM, recordId);
  }
  return params;
}

export function resolvePersonalRecordSource(record: PersonalHistoryRecord): PromptSourceKey {
  const source = resolvePersonalWorkspaceSource(record.input.chartType, record.workspaceSource);
  if (
    (source === 'astrolabe' || source === 'qizheng') &&
    !hasCompletePreciseBirthData(record.input)
  ) {
    return 'bazi';
  }
  return source;
}

export function findRecentPersonalRecordForSource(
  records: PersonalHistoryRecord[],
  source: PromptSourceKey,
) {
  const matchingRecords = records.filter(
    (record) => resolvePersonalRecordSource(record) === source,
  );
  return matchingRecords.find((record) => record.pinned) ?? matchingRecords[0];
}

function resolveResultTab(source: PromptSourceKey): ResultTabKey {
  if (source === 'qizheng') return 'qizheng';
  if (source === 'bazhai') return 'bazhai';
  if (source === 'ziwei') return 'ziwei';
  if (source === 'astrolabe') return 'astrolabe';
  return 'bazi';
}

export function buildPersonalRecordPath(record: PersonalHistoryRecord) {
  const source = resolvePersonalRecordSource(record);
  return buildChartRecordPath(
    record.input,
    {
      ...defaultPromptState,
      tab: resolveResultTab(source),
      promptSource: source,
    },
    record.id,
  );
}

export function buildCompatibilityRecordPath(record: CompatibilityHistoryRecord) {
  return buildChartRecordPath(
    record.input,
    {
      ...defaultPromptState,
      tab: 'bazi',
      promptSource: 'bazi',
      baziShortcutMode: '合婚',
      baziPresetId: 'ai-compat-marriage',
    },
    record.id,
  );
}

export function buildDivinationRecordPath(record: DivinationHistoryRecord) {
  return `/divination/${record.requestedMethod}/result?record=${encodeURIComponent(record.id)}`;
}
