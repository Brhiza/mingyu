import { browserCharacterShard, type CharacterShardKind, type CharacterShardLoader } from '../character-data';

/** Worker 和网页读取静态资源，本地 Node 与 MCP 按需加载构建中的同一份分片。 */
export async function characterEntries(kind: CharacterShardKind, ids: number[], loadShard?: CharacterShardLoader) {
  let loader: CharacterShardLoader;
  if (typeof __MINGYU_WORKER_ASSETS__ !== 'undefined' && __MINGYU_WORKER_ASSETS__) {
    if (!loadShard) throw new Error('字库资源加载器未配置。');
    loader = loadShard;
  } else if (typeof __MINGYU_BROWSER_ASSETS__ !== 'undefined' && __MINGYU_BROWSER_ASSETS__) {
    loader = browserCharacterShard;
  } else {
    loader = (await import('./character-local-shards')).localCharacterShard;
  }
  const shards = [...new Set(ids.map((id) => id % 32))];
  const entries = await Promise.all(shards.map(async (shard) => [shard, await loader(kind, shard)] as const));
  const maps = new Map(entries);
  return Object.fromEntries(ids.map((id) => [id, maps.get(id % 32)?.[id] ?? null]));
}
