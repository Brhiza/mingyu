import test from 'node:test';
import assert from 'node:assert/strict';
import { charDetail } from 'shunshi-kangxi-core';
import { normalizeCharacterDefinition } from '../scripts/name-definition-normalization.mjs';
import { CHARACTER_TUPLES } from '../packages/core/src/name-number/generated-data.ts';
import { CHARACTER_STROKE_TUPLES } from '../packages/core/src/name-number/generated-character-strokes.ts';
import { KANGXI_TEXT_BY_CHARACTER } from '../packages/core/src/name-number/generated-character-references.ts';
import {
  analyzeChineseCharacters,
  analyzeChineseCharactersWithReferences,
  buildChineseCharacterPrompt,
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  calculateZhugeNumber,
  selectChineseCharacters,
} from '../packages/core/src/name-number/index.ts';

test('占问笔画表与完整字典逐字保持一致', () => {
  assert.deepEqual(
    CHARACTER_STROKE_TUPLES,
    CHARACTER_TUPLES.map((row) => [row[0], row[1], row[2]]),
  );
});

test('字典逐条保留完整释义、繁简笔画及康熙原文', () => {
  // 上游 shunshi-kangxi-core 的“简”康熙原文错挂“耕”字条目，
  // 生成层已按缺文置空处理（见 scripts/generate-name-data.mjs 的 KANGXI_REFERENCE_OVERRIDES）。
  const kangxiReferenceCorrections = new Set(['简']);
  assert.ok(CHARACTER_TUPLES.length > 3700);
  for (const row of CHARACTER_TUPLES) {
    const source = charDetail(row[0]);
    assert.ok(source, row[0]);
    assert.equal(row[6], normalizeCharacterDefinition(row[0], source.释义), `${row[0]}释义`);
    assert.equal(row[7], source.简体笔画 ?? null, `${row[0]}简体笔画`);
    assert.equal(row[8], source.繁体笔画 ?? null, `${row[0]}繁体笔画`);
    assert.equal(row[9], source.结构 ?? null, `${row[0]}结构`);
    if (kangxiReferenceCorrections.has(row[0])) {
      assert.equal(KANGXI_TEXT_BY_CHARACTER[row[0]], null, `${row[0]}错配原文应按缺文置空`);
      assert.equal(row[10], null, `${row[0]}错配部居应按缺文置空`);
      assert.equal(row[11], null, `${row[0]}错配字部应按缺文置空`);
      continue;
    }
    assert.equal(KANGXI_TEXT_BY_CHARACTER[row[0]], source.康熙原文 ?? null, `${row[0]}康熙原文`);
    assert.equal(row[10], source.康熙部居 ?? null, `${row[0]}康熙部居`);
    assert.equal(row[11], source.康熙字部 ?? null, `${row[0]}康熙字部`);
  }
});

test('现代释义不夹带损坏注音、英译元数据或残缺标点', () => {
  const definitions = CHARACTER_TUPLES.flatMap((row) => (row[6] ? [[row[0], row[6]]] : []));
  const corruptedPatterns = [
    /\?/u,
    /[A-Za-zɑ][A-Za-zɑ '’-]{4,}/u,
    /[（(“]；/u,
    /^(?:[a-z]+<[^；]*|[a-z]+[\p{Script=Han}][a-z]*)；/u,
    /[ａ-ｚＡ-Ｚ][\p{Script=Han}]{2,}[^；]{0,80}[ａ-ｚＡ-Ｚ]/u,
  ];
  for (const [char, definition] of definitions) {
    for (const pattern of corruptedPatterns) assert.doesNotMatch(definition, pattern, char);
    for (const [open, close] of [
      ['（', '）'],
      ['(', ')'],
      ['〔', '〕'],
      ['“', '”'],
    ]) {
      let depth = 0;
      for (const symbol of definition) {
        if (symbol === open) depth += 1;
        if (symbol === close) depth -= 1;
        assert.ok(depth >= 0, `${char}出现残缺的${open}${close}`);
      }
      assert.equal(depth, 0, `${char}出现残缺的${open}${close}`);
    }
  }
  const withoutModernDefinition = CHARACTER_TUPLES.filter((row) => row[6] === null);
  assert.ok(withoutModernDefinition.length <= 80);
  for (const row of withoutModernDefinition) {
    assert.ok(KANGXI_TEXT_BY_CHARACTER[row[0]], `${row[0]}应保留康熙原文`);
  }
});

test('常用字筛选按GB2312一级字生效且保留补充用字查询', () => {
  const common = new Set<string>();
  const decoder = new TextDecoder('gb18030', { fatal: true });
  for (let offset = 0; offset < 3755; offset++) {
    common.add(decoder.decode(Uint8Array.of(0xb0 + Math.floor(offset / 94), 0xa1 + (offset % 94))));
  }
  assert.equal(common.size, 3755);
  const uncommon = CHARACTER_TUPLES.filter((row) => !common.has(row[0]));
  assert.ok(uncommon.length > 0);
  for (const row of CHARACTER_TUPLES) assert.equal(row[12], common.has(row[0]), row[0]);
  assert.equal(analyzeChineseCharacters('清').characters[0].detail!.common, true);
  for (const row of uncommon) {
    const filter = { strokes: row[2], pinyin: row[5] ?? undefined, limit: 200 };
    assert.ok(
      selectChineseCharacters({ ...filter, commonOnly: false }).some(
        (item) => item.char === row[0],
      ),
      row[0],
    );
    assert.ok(
      !selectChineseCharacters({ ...filter, commonOnly: true }).some(
        (item) => item.char === row[0],
      ),
      row[0],
    );
    assert.ok(analyzeChineseCharacters(row[0]).characters[0].detail, row[0]);
  }
});

test('万和萬保持同一姓名取数并区分字形与字书笔画', async () => {
  const analysis = await analyzeChineseCharactersWithReferences('万萬');
  const [simplified, traditional] = analysis.characters.map((item) => item.detail!);
  assert.equal(simplified.kangxiStrokes, 15);
  assert.deepEqual(traditional, simplified);
  assert.equal(simplified.simplifiedStrokes, 3);
  assert.equal(simplified.traditionalStrokes, 12);
  assert.match(simplified.strokeNote!, /一部为3画/);
  assert.match(simplified.strokeNote!, /《汉语大字典》“萬”为12画/);
  assert.match(simplified.strokeNote!, /《重编国语辞典修订本》为13画/);
  assert.match(simplified.strokeNote!, /6画加部外9画，共15画/);
  assert.match(simplified.kangxiText!, /康熙筆画：3/);
  const prompt = buildChineseCharacterPrompt({ analysis });
  assert.ok(prompt.includes(simplified.strokeNote!));
  assert.doesNotMatch(prompt, /strokeNote|https?:|undefined|null/);
  const first = analyzeChineseName({ fullName: '万学' });
  const second = analyzeChineseName({ fullName: '萬學' });
  assert.deepEqual(first.rawGrids, second.rawGrids);
  assert.deepEqual(first.rawGrids, { tian: 16, ren: 31, di: 17, wai: 2, zong: 31 });
  const namePrompt = buildChineseNameAnalysisPrompt({ analysis: second });
  assert.ok(namePrompt.includes(simplified.strokeNote!));
  assert.deepEqual(calculateZhugeNumber('万学一').strokes, [15, 16, 1]);
  assert.equal(calculateZhugeNumber('万学一').number, calculateZhugeNumber('萬學一').number);
  assert.ok(
    selectChineseCharacters({ strokes: 15, pinyin: 'wan', limit: 200 }).some(
      (item) => item.char === '万',
    ),
  );
  assert.ok(
    !selectChineseCharacters({ strokes: 13, pinyin: 'wan', limit: 200 }).some(
      (item) => item.char === '万',
    ),
  );
});

test('汉字提示词使用完整字义且区分繁简与姓名学笔画', async () => {
  const analysis = await analyzeChineseCharactersWithReferences('灵学李');
  assert.ok(analysis.characters[0].detail?.definition?.includes('灵感'));
  const learning = analysis.characters[1].detail!;
  assert.equal(learning.simplifiedStrokes, 8);
  assert.equal(learning.traditionalStrokes, 16);
  const prompt = buildChineseCharacterPrompt({ analysis });
  assert.ok(prompt.includes(learning.kangxiText!));
  assert.match(prompt, /简体笔画：8；繁体笔画：16；姓名学康熙笔画：16/);
  assert.doesNotMatch(prompt, /undefined|null|kangxiText|API|MCP/);
  const unknown = buildChineseCharacterPrompt({ analysis: analyzeChineseCharacters('😀') });
  assert.match(unknown, /字典资料暂缺/);
});

test('详细字典按需补充原文且保持基础查字结果独立', async () => {
  const basic = analyzeChineseCharacters('学');
  assert.equal(basic.characters[0].detail?.kangxiText, undefined);
  const enriched = await analyzeChineseCharactersWithReferences('学');
  assert.ok(enriched.characters[0].detail?.kangxiText?.includes('【說文】'));
  assert.equal(basic.characters[0].detail?.kangxiText, undefined);
  assert.equal(analyzeChineseCharacters('学').characters[0].detail?.kangxiText, undefined);
  await assert.rejects(analyzeChineseCharactersWithReferences(''), /请输入/);
});
