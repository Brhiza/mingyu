import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import surnameReadings from '../src/data/characters/surname-readings.json';
import { COMPOUND_SURNAMES, evaluateStrokeScore, splitSurname } from '../src/systems/naming-foundation';

const question = '请说明姓名结构与用字参考。';
const CURATED_POOL_CHARS = new Set([
  ...'宇宸泽轩睿浩博彦辰昊铭骏承远航嘉瑞景安宁朗修文哲谦毅恒翊晨旭恺峻川源柏森楷钧锦熙煜昭曜清和弘允卓凡',
  ...'宁悦欣妍涵瑶琪琳玥璇诗雅舒婉晴萱芷若依然语桐清欢知夏念安嘉怡可馨慧敏灵韵昭月星澜雪柔梦竹云舒锦书沐瑾',
  ...'安宁嘉瑞清和知远明轩景行言希思齐书言亦辰予墨乐川星野云舟望舒怀瑾若水之恒以沫允和卓然修远闻溪',
]);

test('百家姓多音姓氏保留原有条目并扩充常见特殊读音', async () => {
  const readings = surnameReadings as Record<string, string>;
  const expected: Record<string, string> = {
    万: 'wàn', 俟: 'sì', 乐: 'yuè', 单: 'shàn', 解: 'xiè', 曾: 'zēng',
    仇: 'qiú', 朴: 'pú、piáo', 柏: 'bó、bǎi', 查: 'zhā', 区: 'ōu', 翟: 'zhái',
    盖: 'gě', 种: 'chóng', 繁: 'pó', 华: 'huà', 燕: 'yān', 员: 'yùn',
    折: 'shé', 任: 'rén', 过: 'guō', 都: 'dū', 句: 'gōu', 黑: 'hè',
    祭: 'zhài', 洗: 'xiǎn', 冼: 'xiǎn', 秘: 'bì', 缪: 'miào', 盛: 'shèng',
    宿: 'sù', 谌: 'shén、chén',
  };
  for (const [char, reading] of Object.entries(expected)) {
    assert.equal(readings[char], reading, `姓氏「${char}」读音应为 ${reading}`);
  }

  for (const [fullName, expectedReading] of [
    ['盖安', 'gě'],
    ['种明', 'chóng'],
    ['繁清', 'pó'],
    ['冼悦', 'xiǎn'],
    ['缪知', 'miào'],
    ['谌远', 'shén、chén'],
  ] as const) {
    const result = await calculate('chinese-name', { fullName, question });
    const surnameChar = result.data.analysis.chars[0] as { surnameReading?: string };
    assert.equal(surnameChar.surnameReading, expectedReading);
  }
});

test('常见复姓列表完整且支持自动拆分与读音标注', async () => {
  const required = [
    '欧阳', '太史', '端木', '上官', '司马', '东方', '独孤', '南宫', '万俟', '闻人',
    '夏侯', '诸葛', '尉迟', '公羊', '赫连', '澹台', '皇甫', '宗政', '濮阳', '公冶',
    '太叔', '申屠', '公孙', '慕容', '仲孙', '钟离', '长孙', '宇文', '司徒', '鲜于',
    '司空', '闾丘', '子车', '亓官', '司寇', '巫马', '公西', '颛孙', '壤驷', '公良',
    '漆雕', '乐正', '宰父', '谷梁', '拓跋', '夹谷', '轩辕', '令狐', '段干', '百里',
    '呼延', '东郭', '南门', '羊舌', '微生', '公户', '公玉', '公仪', '梁丘', '公仲',
    '公上', '公门', '公山', '公坚', '左丘', '公伯', '西门', '公祖', '第五', '公乘',
    '贯丘', '公皙', '南荣', '东里', '东宫', '仲长', '子书', '子桑', '即墨', '达奚',
    '褚师', '单于',
  ];
  for (const surname of required) {
    assert.ok(COMPOUND_SURNAMES.includes(surname), `缺少复姓：${surname}`);
  }

  assert.deepEqual(splitSurname('诸葛亮'), {
    chars: ['诸', '葛', '亮'], surnameLength: 2, surname: '诸葛', given: '亮',
  });
  assert.deepEqual(splitSurname('歐陽修'), {
    chars: ['歐', '陽', '修'], surnameLength: 2, surname: '歐陽', given: '修',
  });
  assert.deepEqual(splitSurname('欧阳'), {
    chars: ['欧', '阳'], surnameLength: 1, surname: '欧', given: '阳',
  });

  for (const [fullName, surname, given, readings] of [
    ['尉迟恭', '尉迟', '恭', ['yù', 'chí']],
    ['万俟明', '万俟', '明', ['mò', 'qí']],
    ['单于安', '单于', '安', ['chán', 'yú']],
    ['长孙宁', '长孙', '宁', ['zhǎng', 'sūn']],
    ['乐正清', '乐正', '清', ['yuè', 'zhèng']],
  ] as const) {
    const result = await calculate('chinese-name', { fullName, question });
    assert.equal(result.data.analysis.surname, surname);
    assert.equal(result.data.analysis.given, given);
    assert.equal((result.data.analysis.chars[0] as { surnameReading?: string }).surnameReading, readings[0]);
    assert.equal((result.data.analysis.chars[1] as { surnameReading?: string }).surnameReading, readings[1]);
  }
});

test('全库起名筛选引擎结合五行、三才五格吉数与性别结构动态选字', async () => {
  const maleResult = await calculate('chinese-naming', {
    surname: '李',
    gender: 'male',
    preferredElements: ['木', '火'],
    limit: 15,
    question,
  });

  assert.equal(maleResult.data.candidates.length, 15);
  const nonCurated = maleResult.data.selectedCharacters.filter((char) => !CURATED_POOL_CHARS.has(char));
  assert.ok(nonCurated.length > 0, '候选字池应包含从全库动态筛选出的非小字池汉字');

  for (const candidate of maleResult.data.candidates) {
    const chars = [...candidate.givenName];
    assert.equal(chars.length, 2);
    assert.notEqual(chars[0], chars[1]);
    assert.ok(candidate.analysis.elementMatches.length > 0, `候选「${candidate.fullName}」应匹配偏好五行`);
    const surnameStrokes = candidate.analysis.chars.filter((c) => c.isSurname).map((c) => c.kangxiStrokes);
    const givenStrokes = candidate.analysis.chars.filter((c) => !c.isSurname).map((c) => c.kangxiStrokes);
    assert.ok(evaluateStrokeScore(surnameStrokes, givenStrokes) > 0, `候选「${candidate.fullName}」三才五格综合分应为正值`);
  }

  const compoundFemale = await calculate('chinese-naming', {
    surname: '欧阳',
    gender: 'female',
    preferredElements: ['水'],
    limit: 10,
    question,
  });
  assert.equal(compoundFemale.data.candidates.length, 10);
  assert.ok(compoundFemale.data.candidates.every((item) => item.fullName.startsWith('欧阳') && item.analysis.elementMatches.length > 0));
});
