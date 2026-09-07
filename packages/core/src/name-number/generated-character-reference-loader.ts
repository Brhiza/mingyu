type ReferenceMap = Readonly<Record<string, string | null>>;

const shardLoaders: readonly (() => Promise<ReferenceMap>)[] = [
  () =>
    import('./generated-character-references-00.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-01.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-02.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-03.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-04.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-05.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-06.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-07.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-08.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-09.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-10.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-11.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-12.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-13.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-14.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-15.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-16.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-17.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-18.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-19.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-20.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-21.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-22.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-23.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-24.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-25.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-26.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-27.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-28.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-29.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-30.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
  () =>
    import('./generated-character-references-31.js').then(
      (module) => module.KANGXI_TEXT_BY_CHARACTER,
    ),
];

const loadedShards = new Map<number, Promise<ReferenceMap>>();

export async function loadKangxiReferences(chars: readonly string[]) {
  const shardIndexes = [
    ...new Set(chars.map((char) => (char.codePointAt(0) ?? 0) % shardLoaders.length)),
  ];
  const shardMaps = await Promise.all(
    shardIndexes.map((index) => {
      const current = loadedShards.get(index) ?? shardLoaders[index]();
      loadedShards.set(index, current);
      return current.then((map) => [index, map] as const);
    }),
  );
  const result: Record<string, string | null> = {};
  for (const char of chars) {
    const index = (char.codePointAt(0) ?? 0) % shardLoaders.length;
    const map = shardMaps.find(([shardIndex]) => shardIndex === index)?.[1];
    result[char] = map?.[char] ?? null;
  }
  return result;
}
