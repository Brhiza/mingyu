import { SHICHEN_PERIODS } from '@core/calendar/dateUtils';

export const BIRTH_TIME_OPTIONS = SHICHEN_PERIODS.map(({ index, name, range, hour, minute }) => ({
  index,
  label: name,
  range,
  hour,
  minute,
}));
