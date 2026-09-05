import type { NamingBirthInput } from 'mingyu-core/name-number';
import { defaultInputState, type QueryInputState } from './query-state';

export function createNamingBirthDraft(input?: QueryInputState | null): QueryInputState {
  return { ...defaultInputState, ...input };
}

export function createNamingBirthInput(birth: QueryInputState): NamingBirthInput {
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
    birthPlace: birth.birthPlace,
    birthLongitude: birth.birthLongitude,
  };
}
