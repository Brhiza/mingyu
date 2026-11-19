import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const asteroidNames = ['ceres', 'pallas', 'juno', 'vesta'];
export function asteroidAssets(directory) {
  const hash = createHash('sha256'), assets = {};
  for (const name of asteroidNames) {
    const file = `${name}_cheb.js`, source = readFileSync(join(directory, file), 'utf8');
    const match = /^\/\/[^\n]*\nexport default ([\s\S]*);\s*$/.exec(source);
    if (!match) throw new Error(`星历资源格式无效：${file}`);
    JSON.parse(match[1]);
    hash.update(file).update('\0').update(match[1]);
    assets[`${name}.json`] = match[1];
  }
  return { version: hash.digest('hex'), assets };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src/systems/astrology/data');
  const { version } = asteroidAssets(directory), path = join(directory, 'version.json');
  if (process.argv[2] === '--write') { writeFileSync(path, JSON.stringify({ version })); console.log(`小行星星历版本已更新：${version}`); }
  else if (JSON.parse(readFileSync(path, 'utf8')).version !== version) throw new Error('小行星星历版本与内容不一致；运行 node scripts/asteroid-version.mjs --write。');
  else console.log(`小行星星历版本一致：${version}`);
}
