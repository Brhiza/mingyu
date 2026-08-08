export type InputEntryMode = 'single' | 'compatibility' | 'divination' | 'almanac';

export function resolveInputEntryMode(searchParams: Pick<URLSearchParams, 'get'>): InputEntryMode {
  const mode = searchParams.get('mode');
  if (mode === 'compatibility' || mode === 'divination' || mode === 'almanac') return mode;
  return 'single';
}
