import { assertRangePillars, parseDivinationRange, partitionDivinationRange } from '../divination-range';
import type { z } from 'zod';
import type { qimenInput } from '../../schema';
import { computeQimen } from './compute';
import { analyzeQimenEvidence } from './evidence';
import type { QimenData } from './types';
import { formatFixedTimezoneOffset } from '../huangji/civil-time';

type Input = z.infer<typeof qimenInput>;
type Range = NonNullable<Input['range']>;
type Settings = NonNullable<Input['qimen']>;

export interface QimenRange {
  kind: 'range';
  input: { range: Range; qimen: Settings };
  source: { startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: string };
  status: 'stable' | 'conditional';
  branches: Array<{ startTimestamp: number; endTimestamp: number; endExclusive: true; data: QimenData; moonPhaseEvidence: { start: NonNullable<QimenData['seasonality']>['moonPhaseEvidence']; end: NonNullable<QimenData['seasonality']>['moonPhaseEvidence'] } }>;
}


function fingerprint(data: QimenData) {
  const { timestamp: _timestamp, termReferenceTimestamp: _reference, timeContext: _context, evidenceAnalysis: _evidence, seasonality, ...facts } = data;
  if (!seasonality) return JSON.stringify(facts);
  if (data.scope === 'month' || data.scope === 'year') return JSON.stringify({ ...facts, lunarDateWarning: seasonality.lunarDateWarning ?? null });
  const { moonPhaseEvidence: _moon, lunarPhaseConsistency: _consistency, ...discrete } = seasonality;
  return JSON.stringify({ ...facts, seasonality: discrete });
}

/** 精确到整秒的半开时间区间；连续月相在每段两端采样。 */
export async function generateQimenRange(range: Range, qimen: Settings = {}): Promise<QimenRange> {
  const { start, end } = parseDivinationRange(range, '奇门');
  const segments = await partitionDivinationRange({ start, end }, qimen, {
    label: '奇门', termOffsetsDays: [0, 5, 10], calculate: (timestamp) => computeQimen(new Date(timestamp), qimen, false), fingerprint,
    check: (data) => { assertRangePillars(range.pillars, data.ganzhi, '奇门'); if (!data.seasonality) throw new Error('奇门范围缺少月相证据。'); },
  });
  const branches: QimenRange['branches'] = segments.map(({ startTimestamp, endTimestamp, endExclusive, first, last }) => {
    first.evidenceAnalysis = analyzeQimenEvidence(first);
    return { startTimestamp, endTimestamp, endExclusive, data: first,
      moonPhaseEvidence: { start: first.seasonality!.moonPhaseEvidence, end: last.seasonality!.moonPhaseEvidence } };
  });
  const timezone = qimen.timeStandard === 'civil' ? qimen.timeZoneId ?? `UTC${formatFixedTimezoneOffset(qimen.timezone!)}` : 'UTC+08:00';
  return { kind: 'range', input: { range, qimen }, source: { startTimestamp: start, endTimestamp: end, endExclusive: true, timezone }, status: branches.length === 1 ? 'stable' : 'conditional', branches };
}
