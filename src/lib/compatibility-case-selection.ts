import type { PersonalHistoryRecord } from '@/lib/history-records';
import { hasCompletePreciseBirthData, type QueryInputState } from '@/lib/query-state';
import type { PersonRole } from '@/lib/input-labels';

type SelectablePersonalCase = Pick<PersonalHistoryRecord, 'name' | 'input'>;

export function applyPersonalCaseToInput(
  current: QueryInputState,
  record: SelectablePersonalCase,
): QueryInputState {
  const source = record.input;
  return {
    ...current,
    name: record.name,
    gender: source.gender,
    dateType: source.dateType,
    year: source.year,
    month: source.month,
    day: source.day,
    timeIndex: source.timeIndex,
    isLeapMonth: source.isLeapMonth,
    useTrueSolarTime: source.useTrueSolarTime,
    birthHour: source.birthHour,
    birthMinute: source.birthMinute,
    birthPlace: source.birthPlace,
    birthLongitude: source.birthLongitude,
    birthLatitude: source.birthLatitude,
  };
}

export function hydratePersonalCaseInput(
  snapshot: QueryInputState,
  record: SelectablePersonalCase,
): QueryInputState {
  const caseInput = applyPersonalCaseToInput(snapshot, record);
  const preciseSource = hasCompletePreciseBirthData(record.input)
    ? record.input
    : hasCompletePreciseBirthData(snapshot)
      ? snapshot
      : record.input;

  return {
    ...caseInput,
    useTrueSolarTime: preciseSource.useTrueSolarTime,
    birthHour: preciseSource.birthHour,
    birthMinute: preciseSource.birthMinute,
    birthPlace: preciseSource.birthPlace,
    birthLongitude: preciseSource.birthLongitude,
    birthLatitude: preciseSource.birthLatitude,
  };
}

export function applyPersonalCaseToCompatibilityPerson(
  current: QueryInputState,
  record: SelectablePersonalCase,
  role: PersonRole,
): QueryInputState {
  const source = record.input;

  if (role === 'partner') {
    return {
      ...current,
      partnerName: record.name,
      partnerGender: source.gender,
      partnerDateType: source.dateType,
      partnerYear: source.year,
      partnerMonth: source.month,
      partnerDay: source.day,
      partnerTimeIndex: source.timeIndex,
      partnerIsLeapMonth: source.isLeapMonth,
      partnerUseTrueSolarTime: source.useTrueSolarTime,
      partnerBirthHour: source.birthHour,
      partnerBirthMinute: source.birthMinute,
      partnerBirthPlace: source.birthPlace,
      partnerBirthLongitude: source.birthLongitude,
      partnerBirthLatitude: source.birthLatitude,
    };
  }

  return applyPersonalCaseToInput(current, record);
}
