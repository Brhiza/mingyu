import type { IztroAstrolabe, IztroStar } from '../../../../types/iztro';
import type { MutagenName, ScopeMutagenItem, StarFact } from '../../../../types/analysis';
import { normalizeStarName } from './palace-lookup';

export const MUTAGEN_ORDER: MutagenName[] = ['禄', '权', '科', '忌'];

export function normalizeScopeMutagenStars(
  stars: readonly string[],
  options: { allowEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(stars)) {
    throw new Error('紫微运限四化星曜必须是按禄、权、科、忌排列的数组。');
  }
  if (stars.length === 0 && options.allowEmpty) {
    return [];
  }
  if (stars.length !== MUTAGEN_ORDER.length) {
    throw new Error('紫微运限四化星曜必须恰好提供4项，并按禄、权、科、忌排列。');
  }

  const normalized = stars.map((star, index) => {
    if (typeof star !== 'string' || !star.trim()) {
      throw new Error(`紫微运限四化第${index + 1}个星曜名称无效。`);
    }
    return star.trim();
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('紫微运限四化的禄、权、科、忌星曜不得重复。');
  }
  return normalized;
}

export function mapScopeMutagenMap(
  stars: string[],
  astrolabe: IztroAstrolabe,
  dynamicPalaceNames: string[] = [],
  options: { allowEmpty?: boolean } = {},
): ScopeMutagenItem[] {
  return normalizeScopeMutagenStars(stars, options).map((star, index) => {
    let palace;
    try {
      palace = astrolabe.star(star as never).palace();
    } catch {
      throw new Error(`iztro 未能定位${star}的本命落宫。`);
    }

    return {
      mutagen: MUTAGEN_ORDER[index],
      star,
      palace_index: palace?.index,
      palace_name: palace?.name,
      dynamic_palace_name:
        palace?.index === undefined ? undefined : dynamicPalaceNames[palace.index],
    };
  });
}

export function mapStarFact(
  star: IztroStar,
  activeScopeMutagenMap: ScopeMutagenItem[],
  options: { isHoroscopeStar?: boolean } = {},
): StarFact {
  const normalizedStarName = normalizeStarName(star.name);
  const activeScopeMutagen = activeScopeMutagenMap.find(
    (item) => normalizeStarName(item.star) === normalizedStarName,
  )?.mutagen;
  const rawMutagen = star.mutagen || undefined;
  const isHoroscopeStar = options.isHoroscopeStar ?? star.scope !== 'origin';

  return {
    name: star.name,
    kind: star.type,
    scope: star.scope,
    brightness: star.brightness || undefined,
    birth_mutagen: isHoroscopeStar ? undefined : (rawMutagen as MutagenName | undefined),
    horoscope_mutagen: isHoroscopeStar ? (rawMutagen as MutagenName | undefined) : undefined,
    active_scope_mutagen: activeScopeMutagen,
  };
}
