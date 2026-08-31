import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const asteroidNames = ['ceres', 'juno', 'pallas', 'vesta'];
const require = createRequire(import.meta.url);
const caelusRoot = dirname(require.resolve('caelus/package.json'));

const embeddedFiles = {
  mercury: 'vsop87d_mercury.embedded.json',
  venus: 'vsop87d_venus.embedded.json',
  earth: 'vsop87d_earth.embedded.json',
  mars: 'vsop87d_mars.embedded.json',
  jupiter: 'vsop87d_jupiter.embedded.json',
  saturn: 'vsop87d_saturn.embedded.json',
  uranus: 'vsop87d_uranus.embedded.json',
  neptune: 'vsop87d_neptune.embedded.json',
  nutation: 'nutation_iau1980.json',
  moonMeeus: 'moon_meeus47.json',
  pluto: 'pluto_meeus37.json',
  chiron: 'chiron_cheb.json',
  fixedStars: 'fixed_stars.json',
  constellations: 'constellations.json',
};

const embeddedEntries = Object.fromEntries(
  Object.entries(embeddedFiles).map(([key, filename]) => [
    key,
    JSON.parse(readFileSync(`${caelusRoot}/dist/data/${filename}`, 'utf8')),
  ]),
);
const embeddedData = {
  vsop: Object.fromEntries(
    ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].map((key) => [
      key,
      embeddedEntries[key],
    ]),
  ),
  nutation: embeddedEntries.nutation,
  moonMeeus: embeddedEntries.moonMeeus,
  pluto: embeddedEntries.pluto,
  chiron: embeddedEntries.chiron,
  fixedStars: embeddedEntries.fixedStars,
  constellations: embeddedEntries.constellations,
};

assert.ok(Object.keys(embeddedData.vsop).length === 8, 'Caelus 基础行星数据必须完整。');

const embeddedSource = `// 由固定版本的 caelus 数据生成，请勿直接编辑。\nexport const embeddedData = ${JSON.stringify(embeddedData)};\n`;
for (const targetPath of [
  fileURLToPath(new URL('../src/astrology/vendor/caelus/embedded-data.js', import.meta.url)),
  fileURLToPath(new URL('../dist/astrology/vendor/caelus/embedded-data.js', import.meta.url)),
]) {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, embeddedSource, 'utf8');
}

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
