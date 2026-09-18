import { SHICHEN_PERIODS } from 'mingyu-core/calendar';

export const BIRTH_TIME_OPTIONS = SHICHEN_PERIODS.map(({ index, name, range, hour, minute }) => ({
  index,
  label: name,
  range,
  hour,
  minute,
}));

export function getBirthTimeDropdownOptions(allowUnknownTime = false) {
  return [
    { value: '', label: '请选择时辰' },
    ...(allowUnknownTime ? [{ value: '-1', label: '时辰未知（列出全天候选）' }] : []),
    ...BIRTH_TIME_OPTIONS.map((time, index) => ({
      value: String(index),
      label: `${time.label}（${time.range}）`,
    })),
  ];
}
