import { type PersonRole } from '@/lib/input-labels';
import type { QueryInputState } from '@/lib/query-state';

export type { PersonRole };

export const SELF_FIELD_MAP = {
  name: 'name',
  gender: 'gender',
  dateType: 'dateType',
  year: 'year',
  month: 'month',
  day: 'day',
  timeIndex: 'timeIndex',
  isLeapMonth: 'isLeapMonth',
  useTrueSolarTime: 'useTrueSolarTime',
  birthHour: 'birthHour',
  birthMinute: 'birthMinute',
  birthPlace: 'birthPlace',
  birthLongitude: 'birthLongitude',
  birthLatitude: 'birthLatitude',
  applyChinaDst: 'applyChinaDst',
} as const;

export const PARTNER_FIELD_MAP = {
  name: 'partnerName',
  gender: 'partnerGender',
  dateType: 'partnerDateType',
  year: 'partnerYear',
  month: 'partnerMonth',
  day: 'partnerDay',
  timeIndex: 'partnerTimeIndex',
  isLeapMonth: 'partnerIsLeapMonth',
  useTrueSolarTime: 'partnerUseTrueSolarTime',
  birthHour: 'partnerBirthHour',
  birthMinute: 'partnerBirthMinute',
  birthPlace: 'partnerBirthPlace',
  birthLongitude: 'partnerBirthLongitude',
  birthLatitude: 'partnerBirthLatitude',
  applyChinaDst: 'partnerApplyChinaDst',
} as const;

export function getFieldKey(role: PersonRole, key: keyof typeof SELF_FIELD_MAP) {
  return role === 'self' ? SELF_FIELD_MAP[key] : PARTNER_FIELD_MAP[key];
}

export function getPersonValue(
  form: QueryInputState,
  role: PersonRole,
  key: keyof typeof SELF_FIELD_MAP,
) {
  return form[getFieldKey(role, key)];
}
