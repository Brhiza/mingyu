import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../data/chinaBirthPlaceTree.json', import.meta.url));
const targetPath = fileURLToPath(new URL('../dist/china-data.js', import.meta.url));
const tree = JSON.parse(readFileSync(sourcePath, 'utf8'));

if (!Array.isArray(tree) || tree.length === 0) {
  throw new Error('中国出生地点树必须是非空数组。');
}

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(
  targetPath,
  `// 由 data/chinaBirthPlaceTree.json 生成，请勿直接编辑。\nexport const CHINA_BIRTH_PLACE_TREE_DATA = ${JSON.stringify(tree)};\n`,
  'utf8',
);
