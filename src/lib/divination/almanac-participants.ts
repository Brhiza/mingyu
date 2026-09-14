import type { AlmanacParticipantInput } from '@/types/divination';

/**
 * 更新参与人的出生字段；用户改选传统时辰后，旧案例中的精确时刻不再参与计算。
 * 日期字段仍可保留同一出生时刻的时分，真正计算时由日期与精确时刻共同决定新命盘。
 */
export function updateAlmanacParticipantField(
  participant: AlmanacParticipantInput,
  key: keyof AlmanacParticipantInput,
  value: string | boolean,
): AlmanacParticipantInput {
  const next = { ...participant, [key]: value } as AlmanacParticipantInput;
  if (key === 'timeIndex') {
    delete next.birthHour;
    delete next.birthMinute;
    delete next.birthSecond;
    delete next.useTrueSolarTime;
  }
  return next;
}
