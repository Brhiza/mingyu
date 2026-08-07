import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../data/chinaBirthPlaceTree.json', import.meta.url));
const targetPaths = [
  fileURLToPath(new URL('../src/location/china-data.js', import.meta.url)),
  fileURLToPath(new URL('../dist/location/china-data.js', import.meta.url)),
];
const tree = JSON.parse(readFileSync(sourcePath, 'utf8'));

if (!Array.isArray(tree) || tree.length === 0) {
  throw new Error('中国出生地点树必须是非空数组。');
}

const generatedSource = `// 由 data/chinaBirthPlaceTree.json 生成，请勿直接编辑。\nexport const CHINA_BIRTH_PLACE_TREE_DATA = ${JSON.stringify(tree)};\n`;

for (const targetPath of targetPaths) {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, generatedSource, 'utf8');
}
