import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeChineseCharacters,
  analyzeChineseName,
  buildChineseCharacterPrompt,
  buildChineseNameAnalysisPrompt,
  calculateZhugeNumber,
  selectChineseCharacters,
} from '../packages/core/src/name-number/index.ts';

const VERIFIED_READINGS = {
  重: ['zhòng', 'chóng'],
  行: ['xíng', 'xìng', 'háng', 'hàng'],
  长: ['cháng', 'zhǎng'],
  分: ['fēn', 'fèn'],
  份: ['fèn'],
  吩: ['fēn'],
  氛: ['fēn'],
  汾: ['fén'],
  忿: ['fèn'],
  纷: ['fēn'],
  芬: ['fēn'],
  粉: ['fěn'],
  焚: ['fén'],
  坟: ['fén'],
  愤: ['fèn'],
  粪: ['fèn'],
  为: ['wéi', 'wèi'],
} as const;

test('常用多音字解析和提示词保留辞典列出的全部读音', () => {
  for (const [char, readings] of Object.entries(VERIFIED_READINGS)) {
    const analysis = analyzeChineseCharacters(char);
    const detail = analysis.characters[0]?.detail;

    assert.deepEqual(detail?.pinyin?.split('、'), readings, char);
    assert.match(
      buildChineseCharacterPrompt({ analysis }),
      new RegExp(`读音：${readings.join('、')}`),
    );
  }
});

test('姓名分析支持常用字“分”“为”并保留其康熙取数和多音资料', () => {
  const fen = analyzeChineseCharacters('分');
  const wei = analyzeChineseCharacters('为');
  const traditionalWei = analyzeChineseCharacters('為');

  assert.deepEqual(fen.unknownCharacters, []);
  assert.deepEqual(wei.unknownCharacters, []);
  assert.deepEqual(traditionalWei.unknownCharacters, []);
  assert.equal(fen.characters[0]?.detail?.kangxiStrokes, 4);
  assert.equal(wei.characters[0]?.detail?.kangxiStrokes, 12);
  assert.equal(traditionalWei.characters[0]?.detail?.kangxiStrokes, 12);
  assert.equal(wei.characters[0]?.detail?.traditional, '為');
  assert.ok(selectChineseCharacters({ pinyin: 'fèn' }).some((item) => item.char === '分'));
  assert.ok(selectChineseCharacters({ pinyin: 'wèi' }).some((item) => item.char === '为'));

  const fenName = analyzeChineseName({ fullName: '李分' });
  assert.equal(fenName.chars[1]?.pinyin, 'fēn、fèn');

  const analysis = analyzeChineseName({ fullName: '李为' });
  assert.equal(analysis.chars[1]?.pinyin, 'wéi、wèi');
  assert.equal(analyzeChineseName({ fullName: '李為' }).chars[1]?.kangxiStrokes, 12);
  assert.match(buildChineseNameAnalysisPrompt({ analysis }), /为（康熙12画、五行未定、wéi、wèi）/);
});

test('为的汉字、姓名、诸葛取数入口使用同一康熙笔画资料', () => {
  const result = calculateZhugeNumber('为為为');

  assert.deepEqual(result.strokes, [12, 12, 12]);
  assert.deepEqual(result.digits, [2, 2, 2]);
  assert.equal(result.rawNumber, 222);
  assert.equal(result.number, 222);
});
