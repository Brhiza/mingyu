import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChineseCharacters,
  selectChineseCharacters,
  analyzeChineseName,
  generateChineseNames,
  analyzeNumber,
  calculateZhugeNumber,
  castKongmingHexagram,
} from 'mingyu-core/name-number';

test('汉字解析区分现代笔画与康熙笔画并报告未知字', () => {
  const result = analyzeChineseCharacters('万学');
  assert.equal(result.characters.length, 2);
  assert.equal(result.characters[0].detail?.traditional, '萬');
  assert.equal(result.characters[0].detail?.kangxiStrokes, 15);
  assert.equal(result.characters[1].detail?.kangxiStrokes, 16);
  assert.equal(result.totalKangxiStrokes, 31);
  assert.deepEqual(result.unknownCharacters, []);
});

test('汉字选字同时支持康熙笔画与五行过滤', () => {
  const result = selectChineseCharacters({ strokes: 8, wuxing: '木', limit: 20 });
  assert.ok(result.length > 0);
  assert.ok(result.every((item) => item.kangxiStrokes === 8 && item.wuxing === '木'));
});

test('姓名解析与起名候选返回完整五格三才并稳定排序', () => {
  const analysis = analyzeChineseName({ fullName: '李清和' });
  assert.equal(analysis.surname, '李');
  assert.equal(analysis.given, '清和');
  assert.equal(Object.keys(analysis.grids).length, 5);
  assert.equal(analysis.sancai.combo.length, 3);

  const names = generateChineseNames({ surname: '李', gender: '通用', limit: 10 });
  assert.equal(names.length, 10);
  assert.equal(new Set(names.map((item) => item.fullName)).size, names.length);
  assert.ok(names.every((item) => item.fullName.startsWith('李')));
  assert.ok(
    names.every(
      (item, index) =>
        index === 0 || names[index - 1].score.scores.total >= item.score.scores.total,
    ),
  );
});

test('号码解析覆盖手机号、车牌字母换算与一般编号', () => {
  const phone = analyzeNumber('138-0013-8000', 'phone');
  assert.equal(phone.normalized, '13800138000');
  assert.equal(phone.primaryIndex, Number(13800138000n % 80n) || 80);
  assert.ok(phone.repeatedGroups.includes('00'));

  const plate = analyzeNumber('粤B·12345', 'plate');
  assert.equal(plate.normalized, '粤B·12345');
  assert.equal(plate.letterCount, 1);
  assert.equal(plate.alphanumericSum, 17);
  assert.equal(plate.primaryIndex, 17);
});

test('诸葛神数按三个康熙笔画尾数组合并落入完整384签', () => {
  const result = calculateZhugeNumber('顺其然');
  assert.equal(result.strokes.length, 3);
  assert.equal(result.rawNumber, result.digits[0] * 100 + result.digits[1] * 10 + result.digits[2]);
  assert.ok(result.number >= 1 && result.number <= 384);
  assert.equal(result.sign.number, result.number);
  assert.ok(result.sign.poem.length > 0);
});

test('孔明神卦完整覆盖32种五钱阴阳组合并支持随机重放', () => {
  const numbers = new Set<number>();
  for (let value = 0; value < 32; value += 1) {
    const pattern = value.toString(2).padStart(5, '0').replaceAll('0', '○').replaceAll('1', '●');
    numbers.add(castKongmingHexagram(pattern).number);
  }
  assert.equal(numbers.size, 32);

  const first = castKongmingHexagram(undefined, { seed: '孔明神卦回归' });
  const replay = castKongmingHexagram(undefined, { replay: first.random?.samples });
  assert.equal(replay.symbol, first.symbol);
  assert.equal(replay.number, first.number);
});
