import versionData from './data/characters/version.json';
import { parseJsonObjectAsset } from './json-asset';

export const characterDataVersion = versionData.version;
export type CharacterShardKind = 'definitions' | 'references';
export type CharacterShardLoader = (kind: CharacterShardKind, shard: number) => Promise<Record<string, string | null>>;

export function parseCharacterShard(response: Response) {
  return parseJsonObjectAsset(
    response,
    '字库资源缺失或无效，请重新构建静态资源。',
    '字库资源格式无效。',
  ) as Promise<Record<string, string | null>>;
}

const browserShards = new Map<string, Promise<Record<string, string | null>>>();
export const browserCharacterShard: CharacterShardLoader = async (kind, shard) => {
  const name = `${kind}-${String(shard).padStart(2, '0')}.json`;
  let pending = browserShards.get(name);
  if (!pending) {
    pending = (async () => parseCharacterShard(await fetch(`/character-data/${characterDataVersion}/${name}`)))();
    browserShards.set(name, pending);
  }
  try { return await pending; }
  catch (error) { if (browserShards.get(name) === pending) browserShards.delete(name); throw error; }
};
