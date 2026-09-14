import type { DivinationDraft } from '@/lib/divination/engine';
import type { PersonalHistoryRecord } from '@/lib/history-records';

const ACTIVE_CASE_PARTICIPANT_PREFIX = 'active-case:';

export function applyPersonalCaseToDivinationDraft(
  draft: DivinationDraft,
  activeCase: PersonalHistoryRecord | null,
): DivinationDraft {
  const remainingParticipants = draft.almanacParticipants.filter(
    (item) => !item.id.startsWith(ACTIVE_CASE_PARTICIPANT_PREFIX),
  );

  if (!activeCase) {
    return {
      ...draft,
      gender: '',
      birthYear: '',
      almanacParticipants: remainingParticipants,
    };
  }

  const input = activeCase.input;
  return {
    ...draft,
    gender: input.gender === 'male' ? '男' : '女',
    birthYear: input.year,
    almanacParticipants: [
      {
        id: `${ACTIVE_CASE_PARTICIPANT_PREFIX}${activeCase.id}`,
        name: activeCase.name,
        gender: input.gender === 'male' ? '男' : '女',
        year: input.year,
        month: input.month,
        day: input.day,
        timeIndex: input.timeIndex === '' ? '' : String(input.timeIndex),
        dateType: input.dateType,
        isLeapMonth: input.isLeapMonth,
        ...(input.birthHour !== '' ? { birthHour: input.birthHour } : {}),
        ...(input.birthMinute !== '' ? { birthMinute: input.birthMinute } : {}),
        ...(input.birthSecond !== '' ? { birthSecond: input.birthSecond } : {}),
        ...(input.birthPlace.trim() ? { birthPlace: input.birthPlace } : {}),
        ...(input.birthLongitude.trim() ? { birthLongitude: input.birthLongitude } : {}),
        ...(input.useTrueSolarTime ? { useTrueSolarTime: true } : {}),
      },
      ...remainingParticipants,
    ],
  };
}
