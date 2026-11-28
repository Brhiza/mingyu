import type { CharacterIndexLoader, CharacterShardLoader, RawCharacterIndex } from '../character-data';

export const localCharacterShard: CharacterShardLoader = async (kind, shard) => {
  const number = String(shard).padStart(2, '0');
  return kind === 'definitions'
    ? (await import(`../data/characters/definitions-${number}.json`)).default
    : (await import(`../data/characters/references-${number}.json`)).default;
};

export const localCharacterIndex: CharacterIndexLoader = async () => {
  const [indexMod, orderMod] = await Promise.all([
    import('../data/characters/index.json'),
    import('../data/characters/search-order.json'),
  ]);
  return {
    index: indexMod.default as unknown as RawCharacterIndex,
    searchOrder: orderMod.default as number[],
  };
};
