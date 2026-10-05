import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChineseCharacters,
  analyzeChineseCharactersWithReferences,
  analyzeChineseName,
  buildChineseCharacterPrompt,
  buildChineseNameAnalysisPrompt,
  calculateZhugeNumber,
  selectChineseCharacters,
  selectNamingCharacters,
} from 'mingyu-core/name-number';

const variants = [
  {
    char: '纔',
    simplified: '才',
    radical: '糸',
    kangxiStrokes: 23,
    simplifiedStrokes: 3,
    traditionalStrokes: 23,
    kangxiVolume: '未集中',
    kangxiSection: '糸字部',
    kangxiPhrase: '帛雀頭色',
    pinyin: 'cái、shān',
    meaning: /刚刚.*仅/u,
  },
  {
    char: '隻',
    simplified: '只',
    radical: '隹',
    kangxiStrokes: 10,
    simplifiedStrokes: 5,
    traditionalStrokes: 10,
    kangxiVolume: '戌集中',
    kangxiSection: '隹字部',
    kangxiPhrase: '鳥一枚也',
    pinyin: 'zhī',
    meaning: /单独.*量词/u,
  },
  {
    char: '穀',
    simplified: '谷',
    radical: '禾',
    kangxiStrokes: 15,
    simplifiedStrokes: 7,
    traditionalStrokes: 15,
    kangxiVolume: '午集下',
    kangxiSection: '禾字部',
    kangxiPhrase: '百穀之總名',
    pinyin: 'gǔ',
    meaning: /粮食作物/u,
  },
  {
    char: '佔',
    simplified: '占',
    radical: '人',
    kangxiStrokes: 7,
    simplifiedStrokes: 5,
    traditionalStrokes: 7,
    kangxiVolume: '子集中',
    kangxiSection: '人字部',
    kangxiPhrase: '佔，視也',
    pinyin: 'zhàn、zhān',
    meaning: /据有.*占据/u,
  },
  {
    char: '鬆',
    simplified: '松',
    radical: '髟',
    kangxiStrokes: 18,
    simplifiedStrokes: 8,
    traditionalStrokes: 18,
    kangxiVolume: '亥集上',
    kangxiSection: '髟字部',
    kangxiPhrase: '髼鬆，髮亂',
    pinyin: 'sōng',
    meaning: /鬓发蓬乱.*松弛/u,
  },
  {
    char: '硃',
    simplified: '朱',
    radical: '石',
    kangxiStrokes: 11,
    simplifiedStrokes: 6,
    traditionalStrokes: 11,
    kangxiVolume: '午集下',
    kangxiSection: '石字部',
    kangxiPhrase: '丹砂也',
    pinyin: 'zhū',
    meaning: /丹砂/u,
  },
  {
    char: '製',
    simplified: '制',
    radical: '衣',
    kangxiStrokes: 14,
    simplifiedStrokes: 8,
    traditionalStrokes: 14,
    kangxiVolume: '申集下',
    kangxiSection: '衣字部',
    kangxiPhrase: '裁也',
    pinyin: 'zhì',
    meaning: /剪裁.*造作/u,
  },
  {
    char: '遊',
    simplified: '游',
    radical: '辵',
    kangxiStrokes: 16,
    simplifiedStrokes: 12,
    traditionalStrokes: 12,
    kangxiVolume: '酉集下',
    kangxiSection: '辵字部',
    kangxiPhrase: '遨遊也',
    pinyin: 'yóu',
    meaning: /遨游.*游览.*旅行/u,
  },
] as const;

const originalCharacters = [
  { char: '才', kangxiStrokes: 4, simplifiedStrokes: 3, traditionalStrokes: 3 },
  { char: '只', kangxiStrokes: 5, simplifiedStrokes: 5, traditionalStrokes: 5 },
  { char: '谷', kangxiStrokes: 7, simplifiedStrokes: 7, traditionalStrokes: 7 },
  { char: '占', kangxiStrokes: 5, simplifiedStrokes: 5, traditionalStrokes: 5 },
  { char: '松', kangxiStrokes: 8, simplifiedStrokes: 8, traditionalStrokes: 8 },
  { char: '朱', kangxiStrokes: 6, simplifiedStrokes: 6, traditionalStrokes: 6 },
  { char: '制', kangxiStrokes: 8, simplifiedStrokes: 8, traditionalStrokes: 8 },
  { char: '游', kangxiStrokes: 13, simplifiedStrokes: 12, traditionalStrokes: 12 },
] as const;

test('八个明确原字形在字符、姓名候选、姓名数理和诸葛取数入口保持各自资料', () => {
  for (const item of variants) {
    const analysis = analyzeChineseCharacters(item.char);
    const detail = analysis.characters[0].detail;
    assert.ok(detail, item.char);
    assert.equal(detail.char, item.char);
    assert.equal(detail.simplified, item.simplified);
    assert.equal(detail.traditional, item.char);
    assert.equal(detail.radical, item.radical);
    assert.equal(detail.kangxiStrokes, item.kangxiStrokes);
    assert.equal(detail.simplifiedStrokes, item.simplifiedStrokes);
    assert.equal(detail.traditionalStrokes, item.traditionalStrokes);
    assert.equal(detail.kangxiVolume, item.kangxiVolume);
    assert.equal(detail.kangxiSection, item.kangxiSection);
    assert.equal(detail.pinyin, item.pinyin);
    assert.match(detail.definition, item.meaning, item.char);
    assert.equal(detail.wuxing, null, item.char);
    assert.equal(detail.structure, null, item.char);
    assert.equal(detail.common, false, item.char);

    const name = analyzeChineseName({ fullName: `李${item.char}` });
    assert.equal(name.chars[1].char, item.char);
    assert.equal(name.chars[1].kangxiStrokes, item.kangxiStrokes);
    assert.equal(name.chars[1].wuxing, null);

    const selected = selectNamingCharacters({ preferredCharacters: item.char, limit: 1 });
    assert.equal(selected[0]?.char, item.char);
    assert.equal(selected[0]?.kangxiStrokes, item.kangxiStrokes);

    const searchable = selectChineseCharacters({
      commonOnly: false,
      radical: item.radical,
      strokes: item.kangxiStrokes,
      limit: 200,
    });
    assert.ok(
      searchable.some((candidate) => candidate.char === item.char),
      item.char,
    );

    const namePrompt = buildChineseNameAnalysisPrompt({ analysis: name });
    assert.ok(
      namePrompt.includes(`${item.char}（康熙${item.kangxiStrokes}画、五行未定`),
      item.char,
    );

    const divination = calculateZhugeNumber(item.char.repeat(3));
    assert.deepEqual(divination.strokes, Array(3).fill(item.kangxiStrokes), item.char);
  }
});

test('新增繁体字形不改简体本字的现有笔画与康熙取数', () => {
  for (const item of originalCharacters) {
    const detail = analyzeChineseCharacters(item.char).characters[0].detail;
    assert.ok(detail, item.char);
    assert.equal(detail.char, item.char);
    assert.equal(detail.traditional, item.char);
    assert.equal(detail.kangxiStrokes, item.kangxiStrokes);
    assert.equal(detail.simplifiedStrokes, item.simplifiedStrokes);
    assert.equal(detail.traditionalStrokes, item.traditionalStrokes);
  }
});

test('八个原字形的康熙字头、义项和笔画口径进入可复制字形任务书', async () => {
  const analysis = await analyzeChineseCharactersWithReferences(
    variants.map((item) => item.char).join(''),
  );
  for (const [index, item] of variants.entries()) {
    const character = analysis.characters[index];
    const detail = character.detail;
    const kangxiText = detail?.kangxiText;
    assert.ok(detail && kangxiText, item.char);
    assert.match(kangxiText, new RegExp(`】 ${item.char}`), item.char);
    assert.ok(kangxiText.includes(item.kangxiPhrase), item.char);

    const prompt = buildChineseCharacterPrompt({
      analysis: { ...analysis, characters: [character] },
    });
    assert.ok(prompt.includes(`【${item.char}】`), item.char);
    assert.ok(prompt.includes(kangxiText), item.char);
    assert.ok(prompt.includes('康熙字典原文：'), item.char);
    assert.equal(detail.wuxing, null, item.char);
    if (detail.strokeNote) assert.ok(prompt.includes(detail.strokeNote), item.char);
  }

  const youPrompt = buildChineseCharacterPrompt({
    analysis: { ...analysis, characters: [analysis.characters.at(-1)!] },
  });
  assert.ok(youPrompt.includes('现代笔画按辶三画计12画；《康熙字典》辵部计16画。'));
});
