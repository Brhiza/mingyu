import type { BaziReverseResolvedInput } from '@/lib/bazi-reverse-input';
import {
  formatBaziReverseDate,
  formatBaziReverseTime,
  isBaziReverseSource,
  type DivinationAlmanacParticipant,
} from './time-input';

export type { AlmanacParticipantInputMode } from './time-input';
import type { AlmanacParticipantInputMode } from './time-input';

/**
 * 更新参与人的出生字段；用户改选传统时辰后，旧案例中的精确时刻不再参与计算。
 * 日期字段仍可保留同一出生时刻的时分，真正计算时由日期与精确时刻共同决定新命盘。
 */
export function updateAlmanacParticipantField(
  participant: DivinationAlmanacParticipant,
  key: keyof DivinationAlmanacParticipant,
  value: string | boolean | null,
): DivinationAlmanacParticipant {
  const next = { ...participant, [key]: value } as DivinationAlmanacParticipant;
  if (key === 'reverseSource') {
    if (value === null) delete next.reverseSource;
    return next;
  }

  if (key === 'inputMode') {
    if (value === 'pillars') {
      next.inputMode = 'pillars';
      next.dateType = 'solar';
    } else if (value === 'solar' || value === 'lunar') {
      next.inputMode = value;
      next.dateType = value;
    } else {
      delete next.inputMode;
    }
    delete next.reverseSource;
    return next;
  }

  if (
    key === 'dateType' ||
    key === 'isLeapMonth' ||
    key === 'year' ||
    key === 'month' ||
    key === 'day' ||
    key === 'timeIndex' ||
    key === 'birthHour' ||
    key === 'birthMinute' ||
    key === 'birthSecond' ||
    key === 'useTrueSolarTime'
  ) {
    delete next.reverseSource;
  }
  if (key === 'dateType' && (value === 'solar' || value === 'lunar')) {
    next.inputMode = value;
  }
  if (key === 'timeIndex') {
    delete next.birthHour;
    delete next.birthMinute;
    delete next.birthSecond;
    delete next.useTrueSolarTime;
  }
  return next;
}

export function getAlmanacParticipantInputMode(
  participant: DivinationAlmanacParticipant,
): AlmanacParticipantInputMode {
  if (isBaziReverseSource(participant.reverseSource)) return 'pillars';
  if (
    participant.inputMode === 'solar' ||
    participant.inputMode === 'lunar' ||
    participant.inputMode === 'pillars'
  ) {
    return participant.inputMode;
  }
  return participant.dateType === 'lunar' ? 'lunar' : 'solar';
}

export function applyAlmanacReverseSelection(
  participant: DivinationAlmanacParticipant,
  selection: BaziReverseResolvedInput,
): DivinationAlmanacParticipant {
  return {
    ...participant,
    year: selection.year,
    month: selection.month,
    day: selection.day,
    timeIndex: String(selection.timeIndex),
    dateType: 'solar',
    inputMode: 'pillars',
    isLeapMonth: false,
    birthHour: String(selection.representativeHour),
    birthMinute: String(selection.representativeMinute),
    birthSecond: String(selection.representativeSecond),
    useTrueSolarTime: false,
    reverseSource: selection.source,
  };
}

export function formatAlmanacReverseSelection(selection: BaziReverseResolvedInput) {
  return `${formatBaziReverseDate(selection)} ${formatBaziReverseTime(selection)}（北京时间区间代表）`;
}
