import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error('请传入 AreaCity ok_geo.csv 的文件路径。');
}

const targetPath = fileURLToPath(new URL('../data/chinaBirthPlaceTree.json', import.meta.url));

function readCsvPrefix(line, fieldCount) {
  const fields = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
      continue;
    }
    if (character === ',') {
      fields.push(field);
      field = '';
      if (fields.length === fieldCount) return fields;
      continue;
    }
    field += character;
  }

  fields.push(field);
  return fields;
}

const coordinatesByRegionId = new Map();
const reader = createInterface({
  input: createReadStream(sourcePath, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

let isHeader = true;
for await (const line of reader) {
  if (isHeader) {
    isHeader = false;
    continue;
  }
  const [id, , , , , geo] = readCsvPrefix(line, 6);
  const [longitude, latitude] = (geo ?? '').trim().split(/\s+/).map(Number);
  if (
    id &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  ) {
    coordinatesByRegionId.set(id, { longitude, latitude });
  }
}

const tree = JSON.parse(readFileSync(targetPath, 'utf8'));
let matched = 0;
let missing = 0;
let updatedLongitudes = 0;

function enrich(item) {
  const coordinates = coordinatesByRegionId.get(item.id);
  if (coordinates === undefined) {
    delete item.latitude;
    missing += 1;
  } else {
    if (item.longitude !== coordinates.longitude) updatedLongitudes += 1;
    item.longitude = coordinates.longitude;
    item.latitude = coordinates.latitude;
    matched += 1;
  }
}

for (const province of tree) {
  enrich(province);
  for (const city of province.cities) {
    enrich(city);
    for (const district of city.districts) enrich(district);
  }
}

writeFileSync(targetPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');
console.log(
  `已写入 ${matched} 组行政区经纬度（其中 ${updatedLongitudes} 个经度更新），${missing} 个节点保留原经度及省级近似纬度回退。`,
);
