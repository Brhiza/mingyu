import { MINGYU_SCHEMA_VERSION } from '../shared/version';

export interface AuditEvidenceEntry {
  path: string;
  field: string;
  value: unknown;
}

export interface PartitionedConsumptionData<TChart = unknown> {
  chart: TChart;
  auditEvidence: AuditEvidenceEntry[];
}

export interface UnifiedResultView<
  TInput = unknown,
  TCalendar = unknown,
  TChart = unknown,
  TTiming = unknown,
  TSummary = unknown,
  TEvidence = AuditEvidenceEntry[],
  TRaw = unknown,
> {
  kind: string;
  schemaVersion: string;
  input: TInput;
  calendar: TCalendar | null;
  chart: TChart;
  timing: TTiming | null;
  summary: TSummary;
  evidence: TEvidence;
  warnings: string[];
  raw: TRaw;
}

const AUDIT_FIELDS = new Set([
  'meta',
  'evidence',
  'evidenceAnalysis',
  'focusEvidence',
  'calculation',
  'calculationSteps',
  'classicalRules',
  'traditionalFacts',
  'sources',
  'source',
  'limitations',
  'limitation',
  'ruleBasis',
  'rule',
  'rules',
  'basis',
  'methodology',
  'prompt',
  'promptText',
  'formattedResult',
  'serializedResult',
]);

function partitionValue(value: unknown, path: string, evidence: AuditEvidenceEntry[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => partitionValue(item, `${path}[${index}]`, evidence));
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  const chart: Record<string, unknown> = {};
  for (const [field, item] of Object.entries(value)) {
    const itemPath = path ? `${path}.${field}` : field;
    if (AUDIT_FIELDS.has(field)) {
      if (item !== undefined && item !== null)
        evidence.push({ path: itemPath, field, value: item });
      continue;
    }
    chart[field] = partitionValue(item, itemPath, evidence);
  }
  return chart;
}

/**
 * 按结构化字段拆开盘面资料与审计资料，不经过长文本生成或正则清洗。
 */
export function partitionResultForConsumption<TChart = unknown>(
  raw: unknown,
): PartitionedConsumptionData<TChart> {
  const auditEvidence: AuditEvidenceEntry[] = [];
  const chart = partitionValue(raw, '', auditEvidence) as TChart;
  return { chart, auditEvidence };
}

export function createUnifiedResultView<
  TInput,
  TCalendar,
  TChart,
  TTiming,
  TSummary,
  TEvidence,
  TRaw,
>(options: {
  kind: string;
  input: TInput;
  calendar?: TCalendar | null;
  chart: TChart;
  timing?: TTiming | null;
  summary: TSummary;
  evidence: TEvidence;
  warnings?: readonly string[];
  raw: TRaw;
}): UnifiedResultView<TInput, TCalendar, TChart, TTiming, TSummary, TEvidence, TRaw> {
  return {
    kind: options.kind,
    schemaVersion: MINGYU_SCHEMA_VERSION,
    input: options.input,
    calendar: options.calendar ?? null,
    chart: options.chart,
    timing: options.timing ?? null,
    summary: options.summary,
    evidence: options.evidence,
    warnings: [...(options.warnings ?? [])],
    raw: options.raw,
  };
}

export function createConsumptionView<TInput, TRaw>(options: {
  kind: string;
  input: TInput;
  raw: TRaw;
  calendar?: unknown;
  timing?: unknown;
  summary?: unknown;
  warnings?: readonly string[];
}): UnifiedResultView<TInput, unknown, unknown, unknown, unknown, AuditEvidenceEntry[], TRaw> {
  const partitioned = partitionResultForConsumption(options.raw);
  const rawRecord =
    options.raw && typeof options.raw === 'object'
      ? (options.raw as Record<string, unknown>)
      : undefined;
  const inferredWarnings = Array.isArray(rawRecord?.warnings)
    ? rawRecord.warnings.filter((item): item is string => typeof item === 'string')
    : [];
  return createUnifiedResultView({
    kind: options.kind,
    input: options.input,
    calendar: options.calendar ?? rawRecord?.calendar ?? null,
    chart: partitioned.chart,
    timing: options.timing ?? rawRecord?.timing ?? null,
    summary: options.summary ?? rawRecord?.summary ?? null,
    evidence: partitioned.auditEvidence,
    warnings: options.warnings ?? inferredWarnings,
    raw: options.raw,
  });
}
