import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChineseCharacters,
  analyzeChineseName,
  buildChineseCharacterPrompt,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  generateChineseNames,
  selectChineseCharacters,
} from '../packages/core/src/name-number/index.ts';

test('已核实的多音字按各读音参与筛选且繁简资料一致', () => {
  for (const [char, traditional, readings] of [
    ['乐', '樂', ['le', 'yue', 'yao']],
    ['单', '單', ['dan', 'shan', 'chan']],
    ['解', '解', ['jie', 'xie']],
    ['曾', '曾', ['ceng', 'zeng']],
    ['仇', '仇', ['chou', 'qiu']],
    ['朴', '朴', ['po', 'pu', 'piao']],
    ['柏', '柏', ['bo', 'bai']],
    ['查', '查', ['cha', 'zha']],
    ['区', '區', ['qu', 'ou', 'gou']],
    ['翟', '翟', ['zhai', 'di']],
  ] as const) {
    const detail = analyzeChineseCharacters(char).characters[0].detail!;
    assert.ok(detail.readingNote);
    assert.deepEqual(analyzeChineseCharacters(traditional).characters[0].detail, detail);
    for (const pinyin of readings) {
      assert.ok(
        selectChineseCharacters({ pinyin, strokes: detail.kangxiStrokes, limit: 200 }).some(
          (item) => item.char === char,
        ),
        `${char}:${pinyin}`,
      );
    }
    assert.match(
      buildChineseCharacterPrompt({ analysis: analyzeChineseCharacters(char) }),
      /音义用法/,
    );
  }
});

test('姓氏读法与名字多音参考分开并保持字典查询不受上下文污染', () => {
  for (const [surname, expected] of [
    ['乐', 'yuè'],
    ['单', 'shàn'],
    ['解', 'xiè'],
    ['曾', 'zēng'],
    ['仇', 'qiú'],
    ['朴', 'pú、piáo'],
    ['柏', 'bó、bǎi'],
    ['查', 'zhā'],
    ['区', 'ōu'],
    ['翟', 'zhái'],
  ]) {
    const before = analyzeChineseCharacters(surname);
    const result = analyzeChineseName({ fullName: `${surname}清和` });
    assert.equal(result.chars[0].surnameReading, expected);
    assert.ok(result.chars.slice(1).every((item) => item.surnameReading === undefined));
    assert.ok(
      buildChineseNameAnalysisPrompt({ analysis: result }).includes(
        `${surname}姓氏读音参考：${expected}`,
      ),
    );
    assert.deepEqual(analyzeChineseCharacters(surname), before);
    assert.equal(
      analyzeChineseName({ fullName: `李${surname}` }).chars[1].surnameReading,
      undefined,
    );
  }
  for (const [surname, expected] of [
    ['单于', ['chán', 'yú']],
    ['單于', ['chán', 'yú']],
    ['万俟', ['mò', 'qí']],
    ['萬俟', ['mò', 'qí']],
    ['长孙', ['zhǎng', 'sūn']],
    ['長孫', ['zhǎng', 'sūn']],
    ['令狐', ['lìng', 'hú']],
  ] as const) {
    const compound = analyzeChineseName({ fullName: `${surname}清`, surnameLength: 2 });
    assert.deepEqual(
      compound.chars.slice(0, 2).map((item) => item.surnameReading),
      expected,
    );
    const prompt = buildChineseNameAnalysisPrompt({ analysis: compound });
    assert.ok(expected.every((reading) => prompt.includes(reading)));
  }
});

test('起名提示词携带候选和适配字的音义条件', () => {
  const candidates = generateChineseNames({ surname: '曾', generationCharacter: '乐', limit: 2 });
  assert.ok(candidates.length);
  const prompt = buildChineseNamingPrompt({
    surname: '曾',
    candidates,
    generationCharacter: '乐',
    suitableCharacters: [analyzeChineseCharacters('单').characters[0].detail!],
  });
  assert.match(prompt, /曾姓氏读音参考：zēng/);
  assert.match(prompt, /乐音义用法/);
  assert.match(prompt, /shàn 用于单姓/);
  assert.doesNotMatch(prompt, /readingNote|surnameReading|https?:\/\/|undefined/);
});
