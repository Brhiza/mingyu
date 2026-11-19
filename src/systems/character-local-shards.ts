import type { CharacterShardLoader } from '../character-data';

export const localCharacterShard: CharacterShardLoader = async (kind, shard) => {
  const number = String(shard).padStart(2, '0');
  return kind === 'definitions'
    ? (await import(`../data/characters/definitions-${number}.json`)).default
    : (await import(`../data/characters/references-${number}.json`)).default;
};
