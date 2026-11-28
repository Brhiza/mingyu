import {
  browserStaticDataset,
  type StaticDatasetLoader,
  type StaticDatasetName,
} from '../static-data';

const resolvedStaticCache = new Map<StaticDatasetName, unknown>();

/**
 * 按运行环境按需读取或拉取大型静态典籍与规则集：
 * - Cloudflare Worker：通过 env.ASSETS 按需读取并在实例内复用；
 * - 浏览器前端/Worker：通过 /static-data/<version>/ 按需请求；
 * - 本地 Node / MCP / CLI：通过动态导入读取本地分片，保持单包自包含。
 */
export async function loadStaticDataset<T = unknown>(
  name: StaticDatasetName,
  load?: StaticDatasetLoader,
): Promise<T> {
  const isWorkerAssets = typeof __MINGYU_WORKER_ASSETS__ !== 'undefined' && __MINGYU_WORKER_ASSETS__;
  if (resolvedStaticCache.has(name)) {
    return resolvedStaticCache.get(name) as T;
  }

  let loader: StaticDatasetLoader;
  if (isWorkerAssets) {
    if (!load) throw new Error('静态典籍资源加载器未配置。');
    loader = load;
  } else if (typeof __MINGYU_BROWSER_ASSETS__ !== 'undefined' && __MINGYU_BROWSER_ASSETS__) {
    loader = browserStaticDataset;
  } else {
    loader = (await import('./static-data-local')).localStaticDataset;
  }

  const value = await loader(name);
  resolvedStaticCache.set(name, value);
  return value as T;
}
