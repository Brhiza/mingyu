export type BaziFortuneScope = 'natal' | 'dayun' | 'year' | 'month' | 'day';

export type FortuneModalRow = 'dayun' | 'year' | 'month' | 'day';
export type FortuneModalParentRow = Exclude<FortuneModalRow, 'dayun'>;

export function isFortuneModalParentOptionActive(
  row: FortuneModalParentRow,
  draftScope: BaziFortuneScope,
) {
  if (row === 'year') {
    return draftScope === 'dayun';
  }
  if (row === 'month') {
    return draftScope === 'year';
  }
  return draftScope === 'month';
}

export function isFortuneModalDetailOptionActive(
  row: FortuneModalRow,
  draftScope: BaziFortuneScope,
) {
  if (row === 'dayun') {
    return draftScope !== 'natal';
  }
  if (row === 'year') {
    return draftScope === 'year' || draftScope === 'month' || draftScope === 'day';
  }
  if (row === 'month') {
    return draftScope === 'month' || draftScope === 'day';
  }
  return draftScope === 'day';
}
