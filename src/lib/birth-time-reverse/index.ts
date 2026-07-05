export const UNKNOWN_TIME_INDEX = -1;

export function isUnknownTimeIndex(value: number | '') {
  return value === UNKNOWN_TIME_INDEX;
}

export {
  REVERSE_BIRTH_TIME_SELECT_FIELDS,
  REVERSE_BIRTH_TIME_TEXT_FIELDS,
  DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  type ReverseBirthTimeFormData,
} from '@core/birth-time-reverse';

export {
  buildThreePillarsProfile,
  formatThreePillarsForPrompt,
  type ThreePillarsProfile,
} from './three-pillars';

export { buildUnknownTimeBaziPrompt, buildReverseBirthTimePrompt } from './prompts';
