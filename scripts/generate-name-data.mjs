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
for (const char of selectedChars) {
  const detail = charDetail(char);
  if (!detail) continue;
  const value = {
    char: detail.char,
    simplified: detail.简体,
    traditional: detail.繁体,
    kangxiStrokes: detail.康熙笔画,
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
  };
  characters.set(`${detail.简体}\u0000${detail.繁体}`, value);
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
]);
const output = `export interface GeneratedCharacterData {
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

export type GeneratedCharacterTuple = readonly [string, string, number, string | null, string | null, string | null, string | null, number | null, number | null, string | null, string | null, string | null, boolean];

export interface GeneratedShuliData { level: string; poem: string; text: string; keywords: string; level_note?: string }

export const CHARACTER_TUPLES: readonly GeneratedCharacterTuple[] = ${JSON.stringify(characterTuples)};

export const SHULI_DATA: readonly GeneratedShuliData[] = ${JSON.stringify(Array.from({ length: 81 }, (_, index) => shuliEntry(index + 1)))};

export const SANCAI_DATA: Record<string, { combo: string; tian_ren: string; ren_di: string; level: string; text: string }> = ${JSON.stringify(sancaiTable)};
`;
const outputUrl = new URL('../packages/core/src/name-number/generated-data.ts', import.meta.url);
await writeFile(
  new URL('../packages/core/src/name-number/generated-character-strokes.ts', import.meta.url),
  `const packed = ${JSON.stringify(characterList.map((item) => `${item.simplified}${item.traditional === item.simplified ? '' : item.traditional}${String.fromCharCode(33 + item.kangxiStrokes)}`).join(''))};
export const CHARACTER_STROKE_TUPLES: readonly (readonly [string, string, number])[] = Array.from(
  packed.matchAll(/([^!-~])([^!-~]?)([!-~])/gu),
  (match) => [match[1], match[2] || match[1], match[3].charCodeAt(0) - 33] as const,
);\n`,
  'utf8',
);
await writeFile(fileURLToPath(outputUrl), output, 'utf8');
const referenceUrl = new URL(
  '../packages/core/src/name-number/generated-character-references.ts',
  import.meta.url,
);
const references = Object.fromEntries(
  characterList.map((item) => [item.simplified, item.kangxiText]),
);
await writeFile(
  fileURLToPath(referenceUrl),
  `export const KANGXI_TEXT_BY_CHARACTER: Readonly<Record<string, string | null>> = ${JSON.stringify(references)};\n`,
  'utf8',
);
console.log(`已生成 ${characterList.length} 条字形资料、81 数理与 125 三才配置`);
