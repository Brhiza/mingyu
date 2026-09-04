import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChineseCharacters,
  selectChineseCharacters,
  analyzeChineseName,
  generateChineseNames,
  analyzeNumber,
  buildNumberEnergyPrompt,
  calculateZhugeNumber,
  castKongmingHexagram,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  selectNamingCharacters,
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

test('起名与姓名解析可结合出生喜用并生成完整提示词', () => {
  const birth = {
    gender: 'male' as const,
    year: 2000,
    month: 1,
    day: 1,
    timeIndex: 6,
    dateType: 'solar' as const,
  };
  const names = generateChineseNames({
    surname: '李',
    gender: '通用',
    birth,
    preferredCharacters: '清宁',
    forbiddenCharacters: '乐',
    limit: 3,
  });
  assert.equal(names.length, 3);
  assert.ok(names.every((item) => item.analysis.birthContext?.pillars.length === 4));
  assert.ok(names.every((item) => !item.fullName.includes('乐')));
  const suitableCharacters = selectNamingCharacters({
    gender: '通用',
    birth,
    preferredCharacters: '清宁',
    forbiddenCharacters: '乐',
    limit: 12,
  });
  assert.equal(suitableCharacters[0]?.char, '清');
  const namingPrompt = buildChineseNamingPrompt({
    surname: '李',
    candidates: names,
    suitableCharacters,
    preferredCharacters: '清宁',
    forbiddenCharacters: '乐',
  });
  assert.match(namingPrompt, /【出生资料】/);
  assert.match(namingPrompt, /四柱：/);
  assert.match(namingPrompt, /偏好字：清、宁/);
  assert.match(namingPrompt, /回避用字：乐/);
  assert.match(namingPrompt, /可以重新组合适配字/);

  const analysis = analyzeChineseName({ fullName: '李清和', birth });
  const prompt = buildChineseNameAnalysisPrompt({ analysis, question: '适合长期使用吗？' });
  assert.match(prompt, /适合长期使用吗？/);
  assert.match(prompt, /【传统依据】/);
});

test('汉字选字同时支持康熙笔画与五行过滤', () => {
  const result = selectChineseCharacters({ strokes: 8, wuxing: '木', limit: 20 });
  assert.ok(result.length > 0);
  assert.ok(result.every((item) => item.kangxiStrokes === 8 && item.wuxing === '木'));
});

test('姓名解析不返回数值评分，起名规则实际约束候选用字', () => {
  const analysis = analyzeChineseName({ fullName: '李清和' });
  assert.equal(analysis.surname, '李');
  assert.equal(analysis.given, '清和');
  assert.equal(Object.keys(analysis.grids).length, 5);
  assert.equal(analysis.sancai.combo.length, 3);
  assert.equal('scores' in analysis, false);

  const names = generateChineseNames({
    surname: '李',
    gender: '通用',
    preferredCharacters: '清',
    forbiddenCharacters: '乐',
    generationCharacter: '承',
    generationPosition: 'second',
    limit: 10,
  });
  assert.equal(names.length, 10);
  assert.equal(new Set(names.map((item) => item.fullName)).size, names.length);
  assert.ok(names.every((item) => item.fullName.startsWith('李')));
  assert.ok(names.every((item) => item.givenName.endsWith('承')));
  assert.ok(names.every((item) => !item.givenName.includes('乐')));
  assert.ok(names.every((item) => !('scores' in item.analysis)));
});

test('数字能量覆盖手机号、车牌字母换算、八星磁场与0和5作用', () => {
  const phone = analyzeNumber('138-0013-8000', 'phone');
  assert.equal(phone.normalized, '13800138000');
  assert.equal(phone.primaryIndex, Number(13800138000n % 80n) || 80);
  assert.ok(phone.repeatedGroups.includes('00'));
  assert.equal(phone.energySequence, '13800138000');
  assert.deepEqual(
    phone.energyPairs.slice(0, 3).map((item) => [item.span, item.pair, item.name]),
    [
      ['13', '13', '天医'],
      ['38', '38', '六煞'],
      ['8001', '81', '五鬼'],
    ],
  );
  assert.deepEqual(phone.energyPairs[2]?.modifiers, [
    { digit: 0, effect: '隐藏' },
    { digit: 0, effect: '隐藏' },
  ]);

  const plate = analyzeNumber('粤B·12345', 'plate');
  assert.equal(plate.normalized, '粤B·12345');
  assert.equal(plate.letterCount, 1);
  assert.equal(plate.alphanumericSum, 17);
  assert.equal(plate.primaryIndex, 17);
  assert.equal(plate.alphanumeric, 'B12345');
  assert.equal(plate.energySequence, '212345');
  assert.deepEqual(plate.letterConversions, [{ letter: 'B', value: 2, digits: '2' }]);
  assert.deepEqual(
    plate.energyPairs.map((item) => item.name),
    ['绝命', '绝命', '祸害', '延年'],
  );

  const mixed = analyzeNumber('Z5A', 'general');
  assert.equal(mixed.energySequence, '2651');
  assert.equal(mixed.energyPairs[0]?.name, '延年');
  assert.deepEqual(mixed.energyPairs[1]?.modifiers, [{ digit: 5, effect: '增强' }]);
  assert.equal(mixed.energyPairs[1]?.pair, '61');

  const prompt = buildNumberEnergyPrompt({ analysis: mixed, question: '适合工作使用吗？' });
  assert.match(prompt, /【磁场组合】/);
  assert.match(prompt, /Z=26/);
  assert.match(prompt, /2651/);
  assert.match(prompt, /延年/);
  assert.match(prompt, /5（增强）/);
  assert.match(prompt, /适合工作使用吗？/);
});

test('八星磁场完整覆盖八卦数字的全部相邻组合', () => {
  const baguaDigits = ['1', '2', '3', '4', '6', '7', '8', '9'];
  const names = new Set<string>();
  for (const left of baguaDigits) {
    for (const right of baguaDigits) {
      const result = analyzeNumber(`${left}${right}`);
      assert.equal(result.energyPairs.length, 1);
      names.add(result.energyPairs[0]!.name);
    }
  }
  assert.deepEqual(
    [...names].sort(),
    ['天医', '生气', '延年', '伏位', '绝命', '五鬼', '六煞', '祸害'].sort(),
  );

  const modifiersOnly = analyzeNumber('050');
  assert.equal(modifiersOnly.energyPairs.length, 0);
  assert.deepEqual(modifiersOnly.dominantFields, []);
  assert.equal(modifiersOnly.modifiers.length, 3);
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
