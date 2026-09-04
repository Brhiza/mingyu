import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacterDefinition } from '../scripts/name-definition-normalization.mjs';
import { analyzeChineseCharacters, buildChineseCharacterPrompt } from 'mingyu-core/name-number';

test('损坏注音在完整括号内按声调字节还原并保留字义正文', () => {
  const examples = [
    ['丸', '弹（d刵 ）丸', '弹（dàn）丸'],
    ['丈', '丈量（li俷g ）', '丈量（liáng）'],
    ['比', '比兴（x宯g ）', '比兴（xìng）'],
    ['戈', '干（g乶 ）戈。倒（d僶 ）戈', '干（gān）戈。倒（dǎo）戈'],
    ['化', '教（ji刼 ）化', '教（jiào）化'],
    ['王', '王朝（ch俹 ）', '王朝（cháo）'],
    ['刊', '刊行（x妌g ）', '刊行（xíng）'],
    ['正', '正中（zh恘g ）下怀', '正中（zhòng）下怀'],
    ['尤', '尤为(w唅 )', '尤为(wéi)'],
  ];
  for (const [char, original, expected] of examples) {
    assert.equal(normalizeCharacterDefinition(char, original), expected, char);
    assert.equal(normalizeCharacterDefinition(char, expected), expected, char);
  }
  for (const text of ['刵为古字', '（a.一种用法；b.另一种用法）', '（古字刵）', '（x未知）'])
    assert.equal(normalizeCharacterDefinition('字', text), text);
  assert.equal(normalizeCharacterDefinition('字', '（q?）'), null);
  assert.equal(normalizeCharacterDefinition('字', '  字义  '), '字义');
  assert.equal(normalizeCharacterDefinition('字', undefined), null);
});

test('旧注音覆盖全部带调韵母并清理词典元数据碎片', () => {
  const decoder = new TextDecoder('gb18030', { fatal: true });
  for (const [index, vowel] of [...'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'].entries()) {
    const damaged = decoder.decode(Uint8Array.of(0x81 + index, 0x6e));
    assert.equal(normalizeCharacterDefinition('字', `例（x${damaged}）`), `例（x${vowel}n）`);
  }
  assert.equal(
    normalizeCharacterDefinition(
      '明',
      '亮，与暗相对：明亮。；姓。；brightclearclear-sighted；亮灭暗',
    ),
    '亮，与暗相对：明亮。；姓。',
  );
  assert.equal(
    normalizeCharacterDefinition('和', '相安：和美。；战；和谐地跟着唱：和声。；战'),
    '相安：和美。；和谐地跟着唱：和声。',
  );
  assert.equal(
    normalizeCharacterDefinition('单', '奇（j?）数的：单数。；〔单于〕古代称号。；双复'),
    '奇数的：单数。；〔单于〕古代称号。',
  );
  assert.equal(
    normalizeCharacterDefinition(
      '天',
      '在地面以上的高空：天空。；自然界：天时。；〔天干（；自然的、生成的：天然。g乶 ）〕古代纪日符号。；dayGodHeavennatureskyweather地',
    ),
    '在地面以上的高空：天空。；自然界：天时。',
  );
  assert.equal(
    normalizeCharacterDefinition('工', '从事劳动：工作。；labourman-dayprojectskillworkworker农'),
    '从事劳动：工作。',
  );
  assert.equal(
    normalizeCharacterDefinition('谁', 'sh唅；疑问人称代词：你是谁？'),
    '疑问人称代词：你是谁？',
  );
});

test('生成字典和汉字提示词使用还原后的注音并保留完整义项', () => {
  const analysis = analyzeChineseCharacters('万俟丸丈比戈化王刊正尤');
  const definitions = new Map(
    analysis.characters.map((item) => [item.char, item.detail!.definition!]),
  );
  assert.match(definitions.get('万')!, /〔万俟（mò qí）〕原为中国古代鲜卑族部落名；后为复姓/);
  assert.match(definitions.get('万')!, /万户侯.*日理万机.*万幸/);
  assert.match(definitions.get('俟')!, /等待.*万俟（mò qí）.*复姓/);
  assert.match(definitions.get('丸')!, /弹（dàn）丸.*吃两丸儿/);
  assert.match(definitions.get('丈')!, /丈量（liáng）/);
  assert.match(definitions.get('比')!, /比兴（xìng）/);
  assert.match(definitions.get('戈')!, /干（gān）戈。倒（dǎo）戈/);
  assert.match(definitions.get('化')!, /教（jiào）化/);
  assert.match(definitions.get('王')!, /王朝（cháo）/);
  assert.match(definitions.get('刊')!, /刊行（xíng）/);
  const prompt = buildChineseCharacterPrompt({ analysis });
  assert.match(prompt, /mò qí/);
  assert.doesNotMatch(prompt, /q\?|万2|d刵|li俷g|x宯g|g乶|d僶|ji刼|ch俹|x妌g/);
});

test('生成字典不夹带旧英译、同反义词元数据或损坏注音', () => {
  const analysis = analyzeChineseCharacters('明水和行思单工天谁');
  const definitions = analysis.characters.map((item) => item.detail?.definition ?? '').join('\n');
  assert.doesNotMatch(
    definitions,
    /brightclear|Adam's|labourman|dayGod|；战|念想|双复|亮灭暗|止言|sh唅|g乶|\?/u,
  );
  const prompt = buildChineseCharacterPrompt({ analysis });
  assert.doesNotMatch(prompt, /brightclear|Adam's|labourman|dayGod|sh唅|g乶/u);
});
