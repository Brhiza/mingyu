import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { charDetail } from '../../node_modules/shunshi-kangxi-core/dist/index.js';
import { chars, tradIndex } from '../../node_modules/shunshi-kangxi-core/dist/lib/store.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const charDir = join(root, 'src/data/characters');

const REQUIRED_MODERN_CHARS = new Set([
  '梓', '瑜', '皓', '熠', '焓', '煊', '垚', '淼', '焱', '鑫',
  '笙', '珩', '珝', '栀', '柚', '姝', '妤', '婧', '婷', '娴',
  '你', '邰',
]);

const WUXING_OVERRIDES = {
  '珝': '土',
  '你': '火',
};

const MANUAL_ENTRIES = [
  {
    row: ['嗯', '嗯', '嗯', 13, '口', '土', 'ēn', 13, 13, '左右', null, null, true],
    definition: '叹词，表示疑问、答应或满意。',
    reference: null,
  },
];

const index = JSON.parse(readFileSync(join(charDir, 'index.json'), 'utf8'));
const searchOrder = JSON.parse(readFileSync(join(charDir, 'search-order.json'), 'utf8'));

const defShards = Array.from({ length: 32 }, (_, i) =>
  JSON.parse(readFileSync(join(charDir, `definitions-${String(i).padStart(2, '0')}.json`), 'utf8'))
);
const refShards = Array.from({ length: 32 }, (_, i) =>
  JSON.parse(readFileSync(join(charDir, `references-${String(i).padStart(2, '0')}.json`), 'utf8'))
);

const cMap = chars();
const tMap = tradIndex();

// Reverse map: simplified -> [traditional...]
const simpToTrads = new Map();
for (const [trad, simp] of Object.entries(tMap)) {
  if (trad === simp) continue;
  let list = simpToTrads.get(simp);
  if (!list) {
    list = [];
    simpToTrads.set(simp, list);
  }
  list.push(trad);
}

let filledWuxing = 0;
let filledDefs = 0;
let filledRefs = 0;

// 1. Backfill missing fields on existing 0..3812 records without changing IDs or glyph mappings
for (let id = 0; id < index.records.length; id++) {
  const row = index.records[id];
  const ch = row[0];
  const detail = charDetail(ch);
  if (!detail) continue;

  const shard = id % 32;
  const idKey = String(id);

  if (row[5] === null && detail.五行) {
    row[5] = detail.五行;
    filledWuxing++;
  }
  if (row[10] === null && detail.康熙部居) {
    row[10] = detail.康熙部居;
  }
  if (row[11] === null && detail.康熙字部) {
    row[11] = detail.康熙字部;
  }
  if (!defShards[shard][idKey] && detail.释义) {
    defShards[shard][idKey] = detail.释义;
    filledDefs++;
  }
  if (!refShards[shard][idKey] && detail.康熙原文) {
    refShards[shard][idKey] = detail.康熙原文;
    filledRefs++;
  }
}

// 2. Collect new characters from shunshi-kangxi-core
const candidates = [];
for (const [ch, entry] of Object.entries(cMap)) {
  if (Object.hasOwn(tMap, ch) && tMap[ch] !== ch) continue; // skip mirror traditional entry
  if (Object.hasOwn(index.glyphs, ch)) continue;

  const detail = charDetail(ch);
  if (!detail) continue;

  const isCommon = entry.src === 'b' || REQUIRED_MODERN_CHARS.has(ch);
  const isComplete = Boolean(detail.康熙原文 && detail.五行 && detail.释义);
  if (!isCommon && !isComplete) continue;

  candidates.push({ ch, entry, detail, isCommon });
}

candidates.sort((a, b) => {
  if (a.detail.康熙笔画 !== b.detail.康熙笔画) return a.detail.康熙笔画 - b.detail.康熙笔画;
  return (a.ch.codePointAt(0) ?? 0) - (b.ch.codePointAt(0) ?? 0);
});

let addedRecords = 0;
for (const { ch, detail, isCommon } of candidates) {
  const wuxing = detail.五行 ?? WUXING_OVERRIDES[ch] ?? null;
  const row = [
    ch,
    detail.简体,
    detail.繁体,
    detail.康熙笔画,
    detail.部首 || null,
    wuxing,
    detail.拼音 || null,
    detail.简体笔画,
    detail.繁体笔画,
    detail.结构 || null,
    detail.康熙部居 || null,
    detail.康熙字部 || null,
    isCommon,
  ];
  const id = index.records.length;
  index.records.push(row);
  index.glyphs[ch] = id;

  if (detail.繁体 && detail.繁体 !== ch && !Object.hasOwn(index.glyphs, detail.繁体)) {
    const tradEntry = cMap[detail.繁体];
    if (!tradEntry || tradEntry.kx === detail.康熙笔画) {
      index.glyphs[detail.繁体] = id;
    }
  }
  for (const trad of simpToTrads.get(ch) ?? []) {
    if (!Object.hasOwn(index.glyphs, trad)) {
      index.glyphs[trad] = id;
    }
  }

  const shard = id % 32;
  const idKey = String(id);
  if (detail.释义) defShards[shard][idKey] = detail.释义;
  if (detail.康熙原文) refShards[shard][idKey] = detail.康熙原文;
  searchOrder.push(id);
  addedRecords++;
}

// 3. Add manual modern entries not in shunshi-kangxi-core
for (const manual of MANUAL_ENTRIES) {
  const ch = manual.row[0];
  if (Object.hasOwn(index.glyphs, ch)) continue;
  const id = index.records.length;
  index.records.push(manual.row);
  index.glyphs[ch] = id;
  const shard = id % 32;
  const idKey = String(id);
  if (manual.definition) defShards[shard][idKey] = manual.definition;
  if (manual.reference) refShards[shard][idKey] = manual.reference;
  searchOrder.push(id);
  addedRecords++;
}

writeFileSync(join(charDir, 'index.json'), JSON.stringify(index));
writeFileSync(join(charDir, 'search-order.json'), JSON.stringify(searchOrder));
for (let i = 0; i < 32; i++) {
  const s = String(i).padStart(2, '0');
  writeFileSync(join(charDir, `definitions-${s}.json`), JSON.stringify(defShards[i]));
  writeFileSync(join(charDir, `references-${s}.json`), JSON.stringify(refShards[i]));
}

const indexSize = statSync(join(charDir, 'index.json')).size;
console.log(JSON.stringify({
  filledWuxing,
  filledDefs,
  filledRefs,
  addedRecords,
  totalRecords: index.records.length,
  totalGlyphs: Object.keys(index.glyphs).length,
  searchOrderLength: searchOrder.length,
  indexJsonBytes: indexSize,
}, null, 2));
