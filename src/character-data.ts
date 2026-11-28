import versionData from './data/characters/version.json';
import { parseJsonObjectAsset } from './json-asset';

export const characterDataVersion = versionData.version;
export type CharacterShardKind = 'definitions' | 'references';
export type CharacterShardLoader = (kind: CharacterShardKind, shard: number) => Promise<Record<string, string | null>>;

export interface RawCharacterIndex {
  glyphs: Record<string, number>;
  records: Array<Array<string | number | boolean | null>>;
}

export interface CharacterIndexData {
  index: RawCharacterIndex;
  searchOrder: number[];
}

export type CharacterIndexLoader = () => Promise<CharacterIndexData>;

export function parseCharacterShard(response: Response) {
  return parseJsonObjectAsset(
    response,
    '字库资源缺失或无效，请重新构建静态资源。',
    '字库资源格式无效。',
  ) as Promise<Record<string, string | null>>;
}

export async function parseCharacterIndex(response: Response): Promise<RawCharacterIndex> {
  const data = await parseJsonObjectAsset(
    response,
    '字库资源缺失或无效，请重新构建静态资源。',
    '字库索引资源格式无效。',
  );
  if (!data.glyphs || typeof data.glyphs !== 'object' || Array.isArray(data.glyphs) || !Array.isArray(data.records)) {
    throw new Error('字库索引资源格式无效。');
  }
  return data as unknown as RawCharacterIndex;
}

export async function parseCharacterSearchOrder(response: Response): Promise<number[]> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('字库资源缺失或无效，请重新构建静态资源。');
  }
  const value = await response.json();
  if (!Array.isArray(value)) {
    throw new Error('字库排序索引格式无效。');
  }
  return value as number[];
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

let browserIndexPromise: Promise<CharacterIndexData> | undefined;
export const browserCharacterIndex: CharacterIndexLoader = async () => {
  if (!browserIndexPromise) {
    const pending = Promise.all([
      fetch(`/character-data/${characterDataVersion}/index.json`).then(parseCharacterIndex),
      fetch(`/character-data/${characterDataVersion}/search-order.json`).then(parseCharacterSearchOrder),
    ]).then(([index, searchOrder]) => ({ index, searchOrder }));
    browserIndexPromise = pending;
  }
  const active = browserIndexPromise;
  try { return await active; }
  catch (error) { if (browserIndexPromise === active) browserIndexPromise = undefined; throw error; }
};
