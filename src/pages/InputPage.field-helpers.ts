import {
  parseBaziReverseSource,
  serializeBaziReverseSource,
  type BaziReverseResolvedInput,
} from '@/lib/bazi-reverse-input';
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
  birthSecond: 'birthSecond',
  reverseSource: 'birthReverseSource',
  birthPlace: 'birthPlace',
  birthLongitude: 'birthLongitude',
  birthLatitude: 'birthLatitude',
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
  birthSecond: 'partnerBirthSecond',
  reverseSource: 'partnerBirthReverseSource',
  birthPlace: 'partnerBirthPlace',
  birthLongitude: 'partnerBirthLongitude',
  birthLatitude: 'partnerBirthLatitude',
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

export type PersonInputMode = 'solar' | 'lunar' | 'pillars';

export function getPersonInputMode(form: QueryInputState, role: PersonRole): PersonInputMode {
  return parseBaziReverseSource(String(getPersonValue(form, role, 'reverseSource')))
    ? 'pillars'
    : getPersonValue(form, role, 'dateType') === 'lunar'
      ? 'lunar'
      : 'solar';
}

export function applyPersonReverseSelection(
  form: QueryInputState,
  role: PersonRole,
  selection: BaziReverseResolvedInput,
): QueryInputState {
  return {
    ...form,
    [getFieldKey(role, 'dateType')]: 'solar',
    [getFieldKey(role, 'year')]: selection.year,
    [getFieldKey(role, 'month')]: selection.month,
    [getFieldKey(role, 'day')]: selection.day,
    [getFieldKey(role, 'timeIndex')]: selection.timeIndex,
    [getFieldKey(role, 'isLeapMonth')]: false,
    [getFieldKey(role, 'useTrueSolarTime')]: false,
    [getFieldKey(role, 'birthHour')]: String(selection.representativeHour),
    [getFieldKey(role, 'birthMinute')]: String(selection.representativeMinute),
    [getFieldKey(role, 'birthSecond')]: String(selection.representativeSecond),
    [getFieldKey(role, 'reverseSource')]: serializeBaziReverseSource(selection.source),
  };
}
