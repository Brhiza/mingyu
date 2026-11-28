import versionData from './data/static-data-version.json';

export const staticDataVersion = versionData.version;

export type StaticDatasetName =
  | 'yilin'
  | 'zhuge-signs'
  | 'ssgw-data'
  | 'bazi-climate-rules'
  | 'bazi-climate-details'
  | 'zhouyi-texts'
  | 'zhouyi-wings';

export type StaticDatasetLoader = (name: StaticDatasetName) => Promise<unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function parseStaticDataset(response: Response, name: StaticDatasetName): Promise<unknown> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('静态典籍资源缺失或无效，请重新构建静态资源。');
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('静态典籍资源格式无效。');
  }
  if (name === 'yilin') {
    if (!isPlainObject(data) || !Array.isArray(data.hexagrams) || !Array.isArray(data.entries)) {
      throw new Error('静态典籍资源格式无效。');
    }
    return data;
  }
  if (name === 'bazi-climate-details') {
    if (!isPlainObject(data)) {
      throw new Error('静态典籍资源格式无效。');
    }
    return data;
  }
  if (!Array.isArray(data)) {
    throw new Error('静态典籍资源格式无效。');
  }
  return data;
}

const browserStaticCache = new Map<StaticDatasetName, Promise<unknown>>();

export const browserStaticDataset: StaticDatasetLoader = async (name) => {
  let pending = browserStaticCache.get(name);
  if (!pending) {
    pending = (async () =>
      parseStaticDataset(await fetch(`/static-data/${staticDataVersion}/${name}.json`), name))();
    browserStaticCache.set(name, pending);
  }
  try {
    return await pending;
  } catch (error) {
    if (browserStaticCache.get(name) === pending) {
      browserStaticCache.delete(name);
    }
    throw error;
  }
};
