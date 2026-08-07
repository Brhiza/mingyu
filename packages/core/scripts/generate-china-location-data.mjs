import assert from 'node:assert/strict';
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

function assertSupportedKeys(node, supportedKeys, path) {
  const unexpectedKeys = Object.keys(node).filter((key) => !supportedKeys.includes(key));
  assert.deepEqual(unexpectedKeys, [], `${path} 出现尚未纳入紧凑编码的字段`);
}

function joinDisplayName(parentLabel, label) {
  return parentLabel === label ? parentLabel : `${parentLabel} ${label}`;
}

const compactTree = tree.map((province) => {
  assertSupportedKeys(
    province,
    ['id', 'label', 'pinyin', 'longitude', 'latitude', 'cities'],
    `省级节点 ${province.id}`,
  );
  return [
    province.id,
    province.label,
    province.pinyin ?? null,
    province.longitude,
    province.latitude ?? null,
    province.cities.map((city) => {
      assertSupportedKeys(
        city,
        ['id', 'label', 'displayName', 'pinyin', 'longitude', 'latitude', 'districts'],
        `市级节点 ${city.id}`,
      );
      const cityDisplayName = joinDisplayName(province.label, city.label);
      assert.equal(city.displayName, cityDisplayName, `市级节点 ${city.id} 的完整名称无法安全重建`);
      return [
        city.id,
        city.label,
        city.pinyin ?? null,
        city.longitude,
        city.latitude ?? null,
        city.districts.map((district) => {
          assertSupportedKeys(
            district,
            ['id', 'label', 'displayName', 'pinyin', 'longitude', 'latitude'],
            `区县节点 ${district.id}`,
          );
          assert.equal(
            district.displayName,
            district.label === city.label
              ? cityDisplayName
              : joinDisplayName(cityDisplayName, district.label),
            `区县节点 ${district.id} 的完整名称无法安全重建`,
          );
          return [
            district.id,
            district.label,
            district.pinyin ?? null,
            district.longitude,
            district.latitude ?? null,
          ];
        }),
      ];
    }),
  ];
});

const generatedSource = `// 由 data/chinaBirthPlaceTree.json 生成，请勿直接编辑。
const COMPACT_CHINA_BIRTH_PLACE_TREE_DATA = ${JSON.stringify(compactTree)};

const optionalValue = (key, value) => (value === null ? {} : { [key]: value });
const joinDisplayName = (parentLabel, label) =>
  parentLabel === label ? parentLabel : parentLabel + ' ' + label;

const decodeDistrict = ([id, label, pinyin, longitude, latitude], cityLabel, cityDisplayName) => ({
  id,
  label,
  displayName: label === cityLabel ? cityDisplayName : joinDisplayName(cityDisplayName, label),
  ...optionalValue('pinyin', pinyin),
  longitude,
  ...optionalValue('latitude', latitude),
});

const decodeCity = ([id, label, pinyin, longitude, latitude, districts], provinceLabel) => {
  const displayName = joinDisplayName(provinceLabel, label);
  return {
    id,
    label,
    displayName,
    ...optionalValue('pinyin', pinyin),
    longitude,
    districts: districts.map((district) => decodeDistrict(district, label, displayName)),
    ...optionalValue('latitude', latitude),
  };
};

export const CHINA_BIRTH_PLACE_TREE_DATA = COMPACT_CHINA_BIRTH_PLACE_TREE_DATA.map(
  ([id, label, pinyin, longitude, latitude, cities]) => ({
    id,
    label,
    ...optionalValue('pinyin', pinyin),
    longitude,
    cities: cities.map((city) => decodeCity(city, label)),
    ...optionalValue('latitude', latitude),
  }),
);
`;

for (const targetPath of targetPaths) {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, generatedSource, 'utf8');
}
