export type CultureToolTabId =
  | 'character-query'
  | 'chinese-name'
  | 'chinese-naming'
  | 'number-energy';

export type CalendarToolTabId =
  | 'solar-term'
  | 'moon-phase'
  | 'true-solar'
  | 'time-scales'
  | 'solar-illumination';

export const CULTURE_TOOL_METHODS: readonly CultureToolTabId[] = [
  'character-query',
  'chinese-name',
  'chinese-naming',
  'number-energy',
];

export function isCultureOrCalendarMethod(method: string): method is CultureToolTabId {
  return (CULTURE_TOOL_METHODS as readonly string[]).includes(method);
}
