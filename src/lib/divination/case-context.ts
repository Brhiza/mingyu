import type { DivinationDraft } from '@/lib/divination/engine';
import type { PersonalHistoryRecord } from '@/lib/history-records';
import { parseBaziReverseSource } from '@/lib/bazi-reverse-input';

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
  const reverseSource = parseBaziReverseSource(input.birthReverseSource);
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
        timeIndex:
          typeof input.timeIndex === 'number' && input.timeIndex >= 0
            ? String(input.timeIndex)
            : '',
        dateType: reverseSource ? 'solar' : input.dateType,
        ...(reverseSource ? { inputMode: 'pillars' as const } : {}),
        isLeapMonth: reverseSource ? false : input.isLeapMonth,
        ...(input.birthHour !== '' ? { birthHour: input.birthHour } : {}),
        ...(input.birthMinute !== '' ? { birthMinute: input.birthMinute } : {}),
        ...(input.birthSecond !== '' ? { birthSecond: input.birthSecond } : {}),
        ...(input.birthPlace.trim() ? { birthPlace: input.birthPlace } : {}),
        ...(input.birthLongitude.trim() ? { birthLongitude: input.birthLongitude } : {}),
        ...(input.useTrueSolarTime ? { useTrueSolarTime: true } : {}),
        ...(reverseSource ? { reverseSource } : {}),
      },
      ...remainingParticipants,
    ],
  };
}
