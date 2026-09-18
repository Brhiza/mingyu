import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { charDetail, searchChars } from 'shunshi-kangxi-core';
import { sancai, shuliEntry } from 'shunshi-naming-core';
import { normalizeCharacterDefinition } from './name-definition-normalization.mjs';

const allHits = searchChars({ commonOnly: true, limit: 10000 });
const definitionChars = new Set([
  ...'宇宸泽轩睿浩博彦辰昊铭骏承远航嘉瑞景安宁朗修文哲谦毅恒翊晨旭恺峻川源柏森楷钧锦熙煜昭曜清和弘允卓凡',
  ...'宁悦欣妍涵瑶琪琳玥璇诗雅舒婉晴萱芷若依然语桐清欢知夏念安嘉怡可馨慧敏灵韵昭月星澜雪柔梦竹云舒锦书沐瑾',
  ...'安宁嘉瑞清和知远明轩景行言希思齐书言亦辰予墨乐川星野云舟望舒怀瑾若水之恒以沫允和卓然修远闻溪',
]);
const surnameChars = new Set(
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万俟支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲台从鄂索咸籍赖卓蔺屠蒙池乔阴郁胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍郤璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公仉督岳帅缑亢况郈有琴归海晋楚闫法汝鄢涂钦商牟佘佴伯赏墨哈谯笪年爱阳佟第五言福',
);
const primaryChars = new Set();
const decoder = new TextDecoder('gb18030');
for (let lead = 0xb0; lead <= 0xd7; lead += 1) {
  for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
    if (lead === 0xd7 && trail > 0xf9) continue;
    const char = decoder.decode(Uint8Array.of(lead, trail));
    if (char !== '�') primaryChars.add(char);
  }
}
const commonCharacters = new Set(primaryChars);
for (const char of definitionChars) primaryChars.add(char);
for (const char of surnameChars) primaryChars.add(char);
const characters = new Map();
const selectedChars = new Set(
  allHits.filter((hit) => primaryChars.has(hit.字)).map((hit) => hit.字),
);
for (const char of definitionChars) selectedChars.add(char);
for (const char of surnameChars) selectedChars.add(char);

// “万”条目在项目姓名学口径中明确按“萬”的康熙部首数 15 取数；保留该既有业务约定，
// 不因上游直接查询“萬”得到 13 画而拆成另一条姓名取数。其他明确输入的异体按实际字形保留。
const PRESERVED_STROKE_ALIAS_PAIRS = new Set(['万\u0000萬']);

// 生成表按“输入的实际字形”保留上游可直接解析到的简体、繁体和异体身份。
// 不能只用一次 charDetail(简体) 的简繁配对，否则“後/后”“鍾/钟/锺”“檯/台”
// 会在运行时共用简体条目的康熙笔画；也不能把所有普通笔画差异抹成同一个数。
const pendingChars = [...selectedChars];
for (let index = 0; index < pendingChars.length; index += 1) {
  const detail = charDetail(pendingChars[index]);
  if (!detail) continue;
  for (const variant of [detail.char, detail.简体, detail.繁体]) {
    if (!variant || selectedChars.has(variant)) continue;
    if (PRESERVED_STROKE_ALIAS_PAIRS.has(`${detail.简体}\u0000${variant}`)) continue;
    selectedChars.add(variant);
    pendingChars.push(variant);
  }
}

// 上游 shunshi-kangxi-core 个别字的康熙原文与字部存在错配，例如“简”的原文错挂“耕”字条目。
// 在依据核验底本补录之前，先按缺文处理（置空），不得把其他字的原文当作该字的原文输出。
const KANGXI_REFERENCE_OVERRIDES = {
  简: { kangxiText: null, kangxiVolume: null, kangxiSection: null },
};

// 姓名取数采用已核对的实际字形笔画。上游字典把“松”“姜”挂在康熙部首展开数，
// 但姓名用字的独立字书依据分别为木部四画、女部六画；只修正这两个已确认的源条目，
// 保留清(12/11)、万/萬等有明确字形或版本差异的数值。
const KANGXI_NAME_STROKE_CORRECTIONS = {
  松: 8,
  姜: 9,
};

for (const char of selectedChars) {
  const detail = charDetail(char);
  if (!detail) continue;
  const kangxiStrokes =
    detail.char === char
      ? (KANGXI_NAME_STROKE_CORRECTIONS[char] ?? detail.康熙笔画)
      : detail.康熙笔画;
  const value = {
    char: detail.char,
    simplified: detail.简体,
    traditional: detail.繁体,
    kangxiStrokes,
    radical: detail.部首,
    wuxing: detail.五行,
    pinyin: detail.拼音,
    definition: normalizeCharacterDefinition(detail.简体, detail.释义),
    simplifiedStrokes: detail.简体笔画,
    traditionalStrokes: detail.繁体笔画,
    structure: detail.结构,
    kangxiText: detail.康熙原文,
    kangxiVolume: detail.康熙部居,
    kangxiSection: detail.康熙字部,
    common: commonCharacters.has(detail.简体),
    sourceChars: [char],
    ...(KANGXI_REFERENCE_OVERRIDES[detail.简体] ?? {}),
  };
  const key = `${detail.简体}\u0000${detail.繁体}`;
  const existing = characters.get(key);
  if (existing) {
    if (!existing.sourceChars.includes(char)) existing.sourceChars.push(char);
  } else {
    characters.set(key, value);
  }
}

const representative = { 木: 1, 火: 3, 土: 5, 金: 7, 水: 9 };
const sancaiTable = {};
for (const first of Object.keys(representative)) {
  for (const second of Object.keys(representative)) {
    for (const third of Object.keys(representative)) {
      const result = sancai(representative[first], representative[second], representative[third]);
      sancaiTable[result.combo] = result;
    }
  }
}
const characterList = [...characters.values()];
const characterTuples = characterList.map((item) => [
  item.simplified,
  item.traditional,
  item.kangxiStrokes,
  item.radical,
  item.wuxing,
  item.pinyin,
  item.definition,
  item.simplifiedStrokes,
  item.traditionalStrokes,
  item.structure,
  item.kangxiVolume,
  item.kangxiSection,
  item.common,
  item.sourceChars,
]);
// 取数表与查字入口采用相同优先级：实际输入字形优先，简繁别名只补空缺。
const strokeByCharacter = new Map();
for (const item of characterList) {
  for (const char of item.sourceChars) strokeByCharacter.set(char, item.kangxiStrokes);
}
for (const item of characterList) {
  for (const char of [item.simplified, item.traditional]) {
    if (!strokeByCharacter.has(char)) strokeByCharacter.set(char, item.kangxiStrokes);
  }
}
const characterTupleShardCount = 32;
const characterTupleShardSize = Math.ceil(characterTuples.length / characterTupleShardCount);
const characterTupleShards = Array.from({ length: characterTupleShardCount }, (_, index) =>
  characterTuples.slice(index * characterTupleShardSize, (index + 1) * characterTupleShardSize),
);
const generatedDataOutput = `export interface GeneratedCharacterData {
  char: string;
  simplified: string;
  traditional: string;
  kangxiStrokes: number;
  radical?: string;
  wuxing: string | null;
  pinyin?: string;
  definition?: string | null;
  common: boolean;
  simplifiedStrokes: number | null;
  traditionalStrokes: number | null;
  structure: string | null;
  kangxiVolume: string | null;
  kangxiSection: string | null;
}

export type GeneratedCharacterTuple = readonly [string, string, number, string | null, string | null, string | null, string | null, number | null, number | null, string | null, string | null, string | null, boolean, readonly string[]];

export interface GeneratedShuliData { level: string; poem: string; text: string; keywords: string; level_note?: string }

export { CHARACTER_TUPLES } from './generated-character-tuples.js';
export { SANCAI_DATA, SHULI_DATA } from './generated-numerology-data.js';
`;
const outputUrl = new URL('../packages/core/src/name-number/generated-data.ts', import.meta.url);
const numerologyOutput = `import type { GeneratedShuliData } from './generated-data.js';

export const SHULI_DATA: readonly GeneratedShuliData[] = ${JSON.stringify(Array.from({ length: 81 }, (_, index) => shuliEntry(index + 1)))};

export const SANCAI_DATA: Record<string, { combo: string; tian_ren: string; ren_di: string; level: string; text: string }> = ${JSON.stringify(sancaiTable)};
`;
const tupleAggregatorOutput = `import type { GeneratedCharacterTuple } from './generated-data.js';
${characterTupleShards.map((_, index) => `import { CHARACTER_TUPLES_${String(index).padStart(2, '0')} } from './generated-character-tuples-${String(index).padStart(2, '0')}.js';`).join('\n')}

export const CHARACTER_TUPLES: readonly GeneratedCharacterTuple[] = [
${characterTupleShards.map((_, index) => `  ...CHARACTER_TUPLES_${String(index).padStart(2, '0')},`).join('\n')}
];
`;
await writeFile(
  new URL('../packages/core/src/name-number/generated-numerology-data.ts', import.meta.url),
  numerologyOutput,
  'utf8',
);
await writeFile(
  new URL('../packages/core/src/name-number/generated-character-tuples.ts', import.meta.url),
  tupleAggregatorOutput,
  'utf8',
);
await Promise.all(
  characterTupleShards.map((shard, index) => {
    const shardName = String(index).padStart(2, '0');
    return writeFile(
      new URL(
        `../packages/core/src/name-number/generated-character-tuples-${shardName}.ts`,
        import.meta.url,
      ),
      `import type { GeneratedCharacterTuple } from './generated-data.js';\nexport const CHARACTER_TUPLES_${shardName}: readonly GeneratedCharacterTuple[] = ${JSON.stringify(shard)};\n`,
      'utf8',
    );
  }),
);
await writeFile(
  new URL('../packages/core/src/name-number/generated-character-strokes.ts', import.meta.url),
  `const packed = ${JSON.stringify([...strokeByCharacter].map(([char, strokes]) => `${char}${String.fromCharCode(33 + strokes)}`).join(''))};
export const CHARACTER_STROKE_TUPLES: readonly (readonly [string, string, number])[] = Array.from(
  packed.matchAll(/([^!-~])([!-~])/gu),
  (match) => [match[1], match[1], match[2].charCodeAt(0) - 33] as const,
);\n`,
  'utf8',
);
await writeFile(fileURLToPath(outputUrl), generatedDataOutput, 'utf8');
const referenceUrl = new URL(
  '../packages/core/src/name-number/generated-character-references.ts',
  import.meta.url,
);
const references = Object.fromEntries(
  characterList.map((item) => [item.simplified, item.kangxiText]),
);
const referenceShardCount = 32;
const referenceShards = Array.from({ length: referenceShardCount }, () => ({}));
for (const [char, text] of Object.entries(references)) {
  const shardIndex = (char.codePointAt(0) ?? 0) % referenceShardCount;
  referenceShards[shardIndex][char] = text;
}
const referenceAggregator = `import { KANGXI_TEXT_BY_CHARACTER as KANGXI_TEXT_BY_CHARACTER_00 } from './generated-character-references-00.js';
${referenceShards
  .map(
    (_, index) =>
      `import { KANGXI_TEXT_BY_CHARACTER as KANGXI_TEXT_BY_CHARACTER_${String(index).padStart(2, '0')} } from './generated-character-references-${String(index).padStart(2, '0')}.js';`,
  )
  .slice(1)
  .join('\n')}

export const KANGXI_TEXT_BY_CHARACTER: Readonly<Record<string, string | null>> = {
${referenceShards.map((_, index) => `  ...KANGXI_TEXT_BY_CHARACTER_${String(index).padStart(2, '0')},`).join('\n')}
};
`;
await Promise.all(
  referenceShards.map((shard, index) => {
    const shardName = String(index).padStart(2, '0');
    return writeFile(
      new URL(
        `../packages/core/src/name-number/generated-character-references-${shardName}.ts`,
        import.meta.url,
      ),
      `export const KANGXI_TEXT_BY_CHARACTER: Readonly<Record<string, string | null>> = ${JSON.stringify(shard)};\n`,
      'utf8',
    );
  }),
);
await writeFile(fileURLToPath(referenceUrl), referenceAggregator, 'utf8');
console.log(`已生成 ${characterList.length} 条字形资料、81 数理与 125 三才配置`);
