export type InputEntryMode = 'single' | 'compatibility' | 'divination' | 'almanac';

export function resolveInputEntryMode(
  searchParams: Pick<URLSearchParams, 'get'>,
  fallback: InputEntryMode = 'single',
): InputEntryMode {
  const mode = searchParams.get('mode');
  if (mode === null) return fallback;
  if (mode === 'compatibility' || mode === 'divination' || mode === 'almanac') return mode;
  return 'single';
}
