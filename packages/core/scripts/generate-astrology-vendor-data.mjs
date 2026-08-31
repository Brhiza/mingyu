import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const asteroidNames = ['ceres', 'juno', 'pallas', 'vesta'];

for (const asteroidName of asteroidNames) {
  const sourcePath = fileURLToPath(
    new URL(`../data/astrology/caelus/${asteroidName}_cheb.json`, import.meta.url),
  );
  const targetPaths = [
    fileURLToPath(
      new URL(`../src/astrology/vendor/caelus/${asteroidName}_cheb.js`, import.meta.url),
    ),
    fileURLToPath(
      new URL(`../dist/astrology/vendor/caelus/${asteroidName}_cheb.js`, import.meta.url),
    ),
  ];
  const pack = JSON.parse(readFileSync(sourcePath, 'utf8'));

  assert.equal(typeof pack, 'object', `${asteroidName} 星历数据必须是对象。`);
  assert.ok(pack !== null, `${asteroidName} 星历数据不能为空。`);
  assert.ok(Array.isArray(pack.segments), `${asteroidName} 星历数据必须包含分段系数。`);
  assert.ok(pack.segments.length > 0, `${asteroidName} 星历数据分段不能为空。`);

  const generatedSource = `// 由 data/astrology/caelus/${asteroidName}_cheb.json 生成，请勿直接编辑。\nexport default ${JSON.stringify(pack)};\n`;

  for (const targetPath of targetPaths) {
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, generatedSource, 'utf8');
  }
}
