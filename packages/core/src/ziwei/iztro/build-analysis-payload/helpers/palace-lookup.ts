import { LIUHE_MAP } from '../../../../ganzhi';

export const LIU_HE_BRANCH: Record<string, string> = LIUHE_MAP;

export function normalizeStarName(starName: string | undefined) {
  if (!starName) return '';

  return starName
    .trim()
    .replace(/\s+/gu, '')
    .replace(/[（(][^）)]*[）)]/gu, '')
    .replace(/化[禄权科忌]$/u, '');
}
