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

const latitudeByRegionId = new Map();
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
  const latitude = Number(geo?.trim().split(/\s+/)[1]);
  if (id && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90) {
    latitudeByRegionId.set(id, latitude);
  }
}

const tree = JSON.parse(readFileSync(targetPath, 'utf8'));
let matched = 0;
let missing = 0;

function enrich(item) {
  const latitude = latitudeByRegionId.get(item.id);
  if (latitude === undefined) {
    delete item.latitude;
    missing += 1;
  } else {
    item.latitude = latitude;
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
console.log(`已写入 ${matched} 个行政区纬度，${missing} 个节点保留省级近似回退。`);
