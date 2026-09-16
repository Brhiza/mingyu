import type { AlmanacParticipantInput } from '@/types/divination';
import {
  isValidBaziReverseSource,
  type BaziReverseResolvedInput,
  type BaziReverseSource,
} from '@/lib/bazi-reverse-input';

export type DivinationTimeMode = 'current' | 'custom' | 'pillars';
export type AlmanacParticipantInputMode = 'solar' | 'lunar' | 'pillars';

/** 占卜草稿中的黄历参与人，额外保留四柱反推来源区间。 */
export type DivinationAlmanacParticipant = AlmanacParticipantInput & {
  inputMode?: AlmanacParticipantInputMode;
  reverseSource?: BaziReverseSource | null;
};

export function isBaziReverseSource(value: unknown): value is BaziReverseSource {
  return isValidBaziReverseSource(value);
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
