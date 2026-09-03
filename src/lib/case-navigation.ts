import type {
  CompatibilityHistoryRecord,
  ConsultationHistoryRecord,
  PersonalHistoryRecord,
} from '@/lib/history-records';
import {
  buildInputStateSearch,
  buildResultSearch,
  defaultPromptState,
  hasCompletePreciseBirthData,
  type PromptSourceKey,
  type QueryInputState,
  type QueryPromptState,
  type ResultTabKey,
} from '@/lib/query-state';
import { resolvePersonalWorkspaceSource, type ChartWorkspaceId } from '@/lib/workspace';

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
      ? input.useTrueSolarTime
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

export function preserveResultContextParams(nextSearch: string, currentParams: URLSearchParams) {
  const params = new URLSearchParams(nextSearch);
  for (const key of [CHART_RECORD_PARAM, 'instant', 'its', 'record'] as const) {
    const value = currentParams.get(key);
    if (value) {
      params.set(key, value);
    }
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

function resolveResultTab(source: PromptSourceKey): ResultTabKey {
  if (source === 'qimen-lifetime') return 'qimen-lifetime';
  if (source === 'qizheng') return 'qizheng';
  if (source === 'bazhai') return 'bazhai';
  if (source === 'ziwei') return 'ziwei';
  if (source === 'astrolabe') return 'astrolabe';
  return 'bazi';
}

function resolveChartFeatureSource(feature: ChartWorkspaceId): PromptSourceKey {
  if (feature === 'qimen-lifetime') return 'qimen-lifetime';
  if (feature === 'ziwei') return 'ziwei';
  if (feature === 'bazi-ziwei') return 'bazi-ziwei';
  if (feature === 'astrolabe') return 'astrolabe';
  if (feature === 'qizheng') return 'qizheng';
  if (feature === 'bazhai') return 'bazhai';
  return 'bazi';
}

export function buildChartFeaturePathForCase(
  record: PersonalHistoryRecord,
  feature: ChartWorkspaceId,
) {
  const source = resolveChartFeatureSource(feature);
  const input = normalizeChartInputForSource(record.input, source);

  if (feature === 'compatibility') {
    const params = new URLSearchParams(
      buildInputStateSearch({ ...input, analysisMode: 'compatibility' }),
    );
    params.set(CHART_RECORD_PARAM, record.id);
    return `/chart/compatibility?${params.toString()}`;
  }

  if ((feature === 'astrolabe' || feature === 'qizheng') && !hasCompletePreciseBirthData(input)) {
    const params = new URLSearchParams(buildInputStateSearch(input));
    params.set(CHART_RECORD_PARAM, record.id);
    return `/chart/${feature}?${params.toString()}`;
  }

  return buildChartRecordPath(
    input,
    {
      ...defaultPromptState,
      tab: resolveResultTab(source),
      promptSource: source,
    },
    record.id,
  );
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

export function buildDivinationRecordPath(record: ConsultationHistoryRecord) {
  if (record.type === 'instant') {
    return record.path.startsWith('/result?') ? record.path : '/';
  }
  return `/divination/${record.requestedMethod}/result?record=${encodeURIComponent(record.id)}`;
}
