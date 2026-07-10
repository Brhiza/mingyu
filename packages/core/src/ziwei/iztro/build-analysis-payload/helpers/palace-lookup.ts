import type { IztroPalace, IztroStar } from '../../../../types/iztro';
import { LIUHE_MAP } from '../../../../ganzhi';

export const LIU_HE_BRANCH: Record<string, string> = LIUHE_MAP;

export function findPalaceByIndex(palaces: IztroPalace[], index?: number): IztroPalace | undefined {
  if (index === undefined) return undefined;
  return palaces.find((palace) => palace.index === index);
}

export function findPalaceByBranch(
  palaces: IztroPalace[],
  branch?: string,
): IztroPalace | undefined {
  if (!branch) return undefined;
  return palaces.find((palace) => palace.earthlyBranch === branch);
}

export function normalizeStarName(starName: string | undefined) {
  if (!starName) return '';

  return starName
    .trim()
    .replace(/\s+/gu, '')
    .replace(/[（(][^）)]*[）)]/gu, '')
    .replace(/化[禄权科忌]$/u, '');
}

export function findStarPalaceIndex(palaces: IztroPalace[], starName: string): number | undefined {
  const normalizedTarget = normalizeStarName(starName);

  for (const palace of palaces) {
    const all: IztroStar[] = [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
    if (all.some((star) => normalizeStarName(star.name) === normalizedTarget)) {
      return palace.index;
    }
  }
  return undefined;
}
