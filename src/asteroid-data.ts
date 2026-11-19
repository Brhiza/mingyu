import versionData from './systems/astrology/data/version.json';
import type { AsteroidName } from './runtime-context';
import { parseJsonObjectAsset } from './json-asset';

export const asteroidDataVersion = versionData.version;
export async function parseAsteroidData(response: Response) {
  const data = await parseJsonObjectAsset(
    response,
    '小行星星历资源缺失或无效，请重新构建静态资源。',
    '小行星星历资源格式无效。',
  );
  if (!Array.isArray(data.segments)) throw new Error('小行星星历资源格式无效。');
  return data;
}
export async function browserAsteroidData(name: AsteroidName) {
  return parseAsteroidData(await fetch(`/asteroid-data/${asteroidDataVersion}/${name}.json`));
}
