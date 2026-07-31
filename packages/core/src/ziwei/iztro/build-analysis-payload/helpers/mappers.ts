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

export function normalizeScopePalaceNames(palaceNames: readonly string[]): string[] {
  if (!Array.isArray(palaceNames)) {
    throw new Error('紫微运限十二宫名称必须是按本命宫位索引排列的数组。');
  }
  if (palaceNames.length !== 12) {
    throw new Error('紫微运限十二宫名称必须恰好提供12项，并按本命宫位索引排列。');
  }

  const normalized = palaceNames.map((name, index) => {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error(`紫微运限第${index + 1}个宫位名称无效。`);
    }
    return name.trim();
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('紫微运限十二宫名称不得重复。');
  }
  return normalized;
}

export function mapScopeMutagenMap(
  stars: string[],
  astrolabe: IztroAstrolabe,
  dynamicPalaceNames: string[] = [],
  options: { allowEmpty?: boolean } = {},
): ScopeMutagenItem[] {
  const normalizedStars = normalizeScopeMutagenStars(stars, options);
  if (normalizedStars.length === 0) {
    return [];
  }
  const normalizedPalaceNames = normalizeScopePalaceNames(dynamicPalaceNames);

  return normalizedStars.map((star, index) => {
    let palace;
    try {
      palace = astrolabe.star(star as never).palace();
    } catch {
      throw new Error(`iztro 未能定位${star}的本命落宫。`);
    }
    const mappedPalace = astrolabe.palaces.find((candidate) => candidate.index === palace?.index);
    if (
      !palace ||
      !Number.isInteger(palace.index) ||
      palace.index < 0 ||
      palace.index >= normalizedPalaceNames.length ||
      !mappedPalace
    ) {
      throw new Error(`iztro 未能把${star}的本命落宫映射到十二宫。`);
    }

    return {
      mutagen: MUTAGEN_ORDER[index],
      star,
      palace_index: palace.index,
      palace_name: mappedPalace.name,
      dynamic_palace_name: normalizedPalaceNames[palace.index],
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
