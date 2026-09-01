import { SHICHEN_PERIODS } from '@temposoul/core/calendar';

export const BIRTH_TIME_OPTIONS = SHICHEN_PERIODS.map(({ index, name, range, hour, minute }) => ({
  index,
  label: name,
  range,
  hour,
  minute,
}));
