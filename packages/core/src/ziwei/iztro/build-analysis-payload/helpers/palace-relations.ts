import type { MutagedPlaceItem, MutagenName, PalaceFact } from '../../../../types/analysis';
import { MUTAGEN_ORDER } from './mappers';

export function buildBirthMutagensByPalaceIndex(
  palaces: PalaceFact[],
): ReadonlyMap<number, ReadonlySet<MutagenName>> {
  return new Map(
    palaces.map((palace) => [
      palace.index,
      new Set(
        [...palace.major_stars, ...palace.minor_stars]
          .map((star) => star.birth_mutagen)
          .filter((mutagen): mutagen is MutagenName => mutagen !== undefined),
      ),
    ]),
  );
}

export function collectSurroundedMutagens(
  palace: PalaceFact,
  birthMutagensByPalaceIndex: ReadonlyMap<number, ReadonlySet<MutagenName>>,
): MutagenName[] {
  return MUTAGEN_ORDER.filter((mutagen) =>
    palace.surrounded_palace_indexes.some((index) =>
      birthMutagensByPalaceIndex.get(index)?.has(mutagen),
    ),
  );
}

export function collectSelfMutagensFromPlaces(
  palaceIndex: number,
  mutagedPlaces: MutagedPlaceItem[],
): MutagenName[] {
  return MUTAGEN_ORDER.filter(
    (mutagen, index) =>
      mutagedPlaces[index]?.mutagen === mutagen &&
      mutagedPlaces[index]?.palace_index === palaceIndex,
  );
}
