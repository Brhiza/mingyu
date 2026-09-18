import type { NamingBirthInput } from 'mingyu-core/name-number';
import { parseBaziReverseSource, resolveBaziReverseTimeRange } from './bazi-reverse-input';
import { defaultInputState, type QueryInputState } from './query-state';

export function createNamingBirthDraft(input?: QueryInputState | null): QueryInputState {
  const draft = { ...defaultInputState, ...input };
  return draft.timeIndex === -1 ? { ...draft, timeIndex: '' } : draft;
}

export function clearNamingBirthReverseSource(birth: QueryInputState): QueryInputState {
  return birth.birthReverseSource ? { ...birth, birthReverseSource: '' } : birth;
}

export function createNamingBirthInput(birth: QueryInputState): NamingBirthInput {
  const reverseSource = parseBaziReverseSource(birth.birthReverseSource);
  if (birth.birthReverseSource && !reverseSource) {
    throw new Error('出生区间资料无效，请重新选择日期。');
  }
  const birthTimeRange = reverseSource
    ? {
        ...resolveBaziReverseTimeRange(birth.birthReverseSource),
        pillars: { ...reverseSource.pillars },
      }
    : undefined;
  return {
    gender: birth.gender,
    year: birth.year,
    month: birth.month,
    day: birth.day,
    timeIndex: birth.timeIndex,
    dateType: birth.dateType,
    isLeapMonth: birth.dateType === 'lunar' && birth.isLeapMonth,
    useTrueSolarTime: birth.useTrueSolarTime,
    birthHour: birth.birthHour,
    birthMinute: birth.birthMinute,
    birthSecond: birth.birthSecond,
    birthPlace: birth.birthPlace,
    birthLongitude: birth.birthLongitude,
    ...(birthTimeRange ? { birthTimeRange } : {}),
  };
}
