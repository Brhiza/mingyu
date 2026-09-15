import type { AlmanacParticipantInput } from '@/types/divination';
import type { BaziReverseResolvedInput, BaziReverseSource } from '@/lib/bazi-reverse-input';

export type DivinationTimeMode = 'current' | 'custom' | 'pillars';
export type AlmanacParticipantInputMode = 'solar' | 'lunar' | 'pillars';

/** 占卜草稿中的黄历参与人，额外保留四柱反推来源区间。 */
export type DivinationAlmanacParticipant = AlmanacParticipantInput & {
  inputMode?: AlmanacParticipantInputMode;
  reverseSource?: BaziReverseSource | null;
};

export function isBaziReverseSource(value: unknown): value is BaziReverseSource {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    pillars?: Partial<BaziReverseSource['pillars']>;
    intervalStart?: unknown;
    intervalEnd?: unknown;
  };
  const pillars = candidate.pillars;
  return Boolean(
    pillars &&
    typeof pillars.year === 'string' &&
    pillars.year.length > 0 &&
    typeof pillars.month === 'string' &&
    pillars.month.length > 0 &&
    typeof pillars.day === 'string' &&
    pillars.day.length > 0 &&
    typeof pillars.hour === 'string' &&
    pillars.hour.length > 0 &&
    typeof candidate.intervalStart === 'string' &&
    candidate.intervalStart.length > 0 &&
    typeof candidate.intervalEnd === 'string' &&
    candidate.intervalEnd.length > 0,
  );
}

export function formatBaziReverseDate(
  selection: Pick<BaziReverseResolvedInput, 'year' | 'month' | 'day'>,
) {
  return `${selection.year}-${String(selection.month).padStart(2, '0')}-${String(selection.day).padStart(2, '0')}`;
}

export function formatBaziReverseTime(
  selection: Pick<
    BaziReverseResolvedInput,
    'representativeHour' | 'representativeMinute' | 'representativeSecond'
  >,
) {
  return [
    selection.representativeHour,
    selection.representativeMinute,
    selection.representativeSecond,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function formatBaziReversePillars(source: BaziReverseSource) {
  return [source.pillars.year, source.pillars.month, source.pillars.day, source.pillars.hour].join(
    ' ',
  );
}
