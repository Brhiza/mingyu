import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const staticDataSpecs = [
  { name: 'yilin', fileName: 'yilin.json', relativePath: 'src/data/yilin.json' },
  { name: 'zhuge-signs', fileName: 'zhuge-signs.json', relativePath: 'src/systems/zhuge-signs.json' },
  { name: 'ssgw-data', fileName: 'ssgw-data.json', relativePath: 'src/systems/ssgw-data.json' },
  { name: 'bazi-climate-rules', fileName: 'bazi-climate-rules.json', relativePath: 'src/systems/bazi/climate-rules.json' },
  { name: 'bazi-climate-details', fileName: 'bazi-climate-details.json', relativePath: 'src/systems/bazi/climate-details.json' },
  { name: 'zhouyi-texts', fileName: 'zhouyi-texts.json', relativePath: 'src/data/zhouyi/texts.json' },
  { name: 'zhouyi-wings', fileName: 'zhouyi-wings.json', relativePath: 'src/data/zhouyi/wings.json' },
];

export function staticDataAssets(rootDir) {
  const hash = createHash('sha256');
  const files = {};
  for (const spec of staticDataSpecs) {
    const raw = readFileSync(join(rootDir, spec.relativePath));
    JSON.parse(raw.toString('utf8'));
    hash.update(spec.fileName).update('\0').update(raw);
    files[spec.fileName] = raw;
  }
  return { version: hash.digest('hex'), files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const { version } = staticDataAssets(rootDir);
  const versionPath = join(rootDir, 'src/data/static-data-version.json');
  if (process.argv[2] === '--write') {
    writeFileSync(versionPath, `${JSON.stringify({ version })}\n`, 'utf8');
    console.log(`静态典籍资源版本已更新：${version}`);
  } else if (JSON.parse(readFileSync(versionPath, 'utf8')).version !== version) {
    throw new Error('静态典籍资源版本与内容不一致；运行 node scripts/static-data-version.mjs --write。');
  } else {
    console.log(`静态典籍资源版本一致：${version}`);
  }
}
