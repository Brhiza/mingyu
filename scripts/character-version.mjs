import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function characterVersion(directory) {
  const files = ['index.json', 'search-order.json', ...['definitions', 'references'].flatMap((kind) => Array.from({ length: 32 }, (_, index) => `${kind}-${String(index).padStart(2, '0')}.json`))];
  const hash = createHash('sha256');
  for (const name of files) { hash.update(name); hash.update('\0'); hash.update(readFileSync(join(directory, name))); }
  return hash.digest('hex');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src/data/characters');
  const version = characterVersion(directory), path = join(directory, 'version.json');
  if (process.argv[2] === '--write') { writeFileSync(path, JSON.stringify({ version })); console.log(`字库版本已更新：${version}`); }
  else if (JSON.parse(readFileSync(path, 'utf8')).version !== version) throw new Error('字库版本与内容不一致；运行 pnpm data:character-version 更新。');
  else console.log(`字库版本一致：${version}`);
}
