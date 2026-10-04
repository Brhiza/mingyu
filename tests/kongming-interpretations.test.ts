import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateZhugeNumber,
  castKongmingHexagram,
  getKongmingInterpretation,
} from '../packages/core/src/name-number/index.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import { buildDivinationPrompt } from '../packages/core/src/prompt/divination.ts';

test('孔明恢复签谱按本卦重取解释并核对卦象所指的签谱', () => {
  const first = castKongmingHexagram('●●●●●');
  const second = castKongmingHexagram('●○○○○');
  assert.equal(first.number, 1);
  assert.equal(first.name, '星震卦');
  const formatters = [
    (data: typeof first) => formatEnhancedDivinationInfo('kongming', data),
    (data: typeof first) =>
      buildDivinationPrompt({ method: 'kongming', data, question: '这件事如何推进？' }),
  ];
  for (const format of formatters) {
    const prompt = format({ ...first, interpretation: second.interpretation });
    assert.equal(prompt, format(first));
    assert.match(prompt, /签题：星震卦/u);
    assert.match(prompt, /彩凤呈祥瑞，麒麟降帝都，祸除迎福到，喜气自然生/u);
    assert.doesNotMatch(prompt, /金曰从革|龙门鱼跃过/u);
    const legacy = { ...first };
    Reflect.deleteProperty(legacy, 'interpretation');
    assert.equal(format(legacy), prompt);
    const missingSymbol = { ...first };
    Reflect.deleteProperty(missingSymbol, 'symbol');
    assert.throws(() => format(missingSymbol), /孔明卦象与签谱资料不一致/u);
    for (const conflicting of [
      { ...first, number: 2 },
      { ...first, name: second.name },
      { ...first, grade: second.grade },
      { ...first, poem: second.poem },
    ]) {
      assert.throws(() => format(conflicting), /孔明卦象与签谱资料不一致/u);
    }
  }
});

test('孔明32卦均有与本卦诗句对应的独立释义及转机条件', () => {
  const readings = new Set<string>();
  const numbers = new Set<number>();
  for (let bits = 0; bits < 32; bits += 1) {
    const pattern = bits.toString(2).padStart(5, '0');
    const result = castKongmingHexagram(pattern);
    const reading = result.interpretation;
    assert.ok(result.poem.includes(reading.quote), `${result.name}引文应来自本卦`);
    assert.ok(reading.imageMeaning.length > 15, `${result.name}意象`);
    assert.ok(reading.interpretation.length > 30, `${result.name}基础解释`);
    assert.ok(reading.condition.length > 20, `${result.name}转机条件`);
    readings.add(reading.interpretation);
    numbers.add(result.number);
    assert.deepEqual(
      result.draws.map((item) => item.index),
      [1, 2, 3, 4, 5],
    );
    assert.equal(
      result.draws.map((item) => (item.polarity === '阳' ? '1' : '0')).join(''),
      pattern,
    );
    const prompt = formatEnhancedDivinationInfo('kongming', result);
    assert.ok(prompt.includes(reading.imageMeaning));
    assert.ok(prompt.includes(reading.interpretation));
    assert.ok(prompt.includes(reading.condition));
    assert.doesNotMatch(prompt, /undefined|null|imageMeaning|interpretation|待校|签谱状态/);
  }
  assert.equal(readings.size, 32);
  assert.equal(numbers.size, 32);
});

test('孔明阴阳输入按硬币摆放顺序保留而非逆序或排序', () => {
  assert.throws(() => castKongmingHexagram(''), /卦象需由五个阴阳结果组成/);
  assert.throws(() => castKongmingHexagram('  \t  '), /卦象需由五个阴阳结果组成/);
  for (const [pattern, number, name] of [
    ['●●●●●', 1, '星震卦'],
    ['●○○○○', 2, '从革卦'],
    ['○●○○○', 3, '曲直卦'],
    ['●○●●●', 31, '后吉卦'],
    ['○○○○○', 32, '无数卦'],
  ] as const) {
    const result = castKongmingHexagram(pattern);
    assert.equal(result.number, number, pattern);
    assert.equal(result.name, name, pattern);
  }
  const first = castKongmingHexagram('10000');
  const last = castKongmingHexagram('00001');
  assert.equal(first.number, 2);
  assert.equal(last.number, 6);
  assert.equal(first.name, '从革卦');
  assert.equal(last.name, '稼穑卦');
  assert.equal(first.draws[0].polarity, '阳');
  assert.equal(last.draws[4].polarity, '阳');
  assert.deepEqual(castKongmingHexagram('阳阴阴阴阴').interpretation, first.interpretation);
});

test('五行卦名对应洪范词义且只在相关卦出现', () => {
  const fixtures = [
    ['10000', '从革卦', '金', '金曰从革'],
    ['01000', '曲直卦', '木', '木曰曲直'],
    ['00100', '润下卦', '水', '水曰润下'],
    ['00010', '炎上卦', '火', '火曰炎上'],
    ['00001', '稼穑卦', '土', '土爰稼穑'],
  ];
  for (const [symbol, name, element, quote] of fixtures) {
    const result = castKongmingHexagram(symbol);
    assert.equal(result.name, name);
    assert.equal(result.interpretation.classicalImage?.element, element);
    assert.equal(result.interpretation.classicalImage?.quote, quote);
    assert.match(formatEnhancedDivinationInfo('kongming', result), /《尚书·洪范》/);
  }
  assert.equal(castKongmingHexagram('11111').interpretation.classicalImage, null);
  assert.equal(castKongmingHexagram('00000').interpretation.classicalImage, null);
});

test('旧孔明结果可由既有卦象恢复释义且随机重放一致', () => {
  const first = castKongmingHexagram(undefined, { seed: '孔明释义回归' });
  const replay = castKongmingHexagram(undefined, { replay: first.random!.samples });
  assert.deepEqual(replay.interpretation, first.interpretation);
  assert.deepEqual(replay.draws, first.draws);
  assert.deepEqual(replay.random!.samples, first.random!.samples);
  assert.throws(() => castKongmingHexagram(undefined, { replay: [...first.random!.samples, 0] }), {
    code: 'RANDOM_REPLAY_UNUSED',
  });
  assert.throws(
    () => castKongmingHexagram(undefined, { replay: first.random!.samples.slice(0, -1) }),
    { code: 'RANDOM_REPLAY_EXHAUSTED' },
  );
  const oldResult = { ...first };
  Reflect.deleteProperty(oldResult, 'interpretation');
  const prompt = formatEnhancedDivinationInfo('kongming', oldResult);
  assert.ok(prompt.includes(first.interpretation.interpretation));
  assert.throws(() => getKongmingInterpretation('constructor'), /未找到/);
  assert.throws(() => getKongmingInterpretation('●○'), /未找到/);
});

test('孔明提示词只保留签谱资料字段', () => {
  const prompt = formatEnhancedDivinationInfo('kongming', castKongmingHexagram('●○○○○'));
  assert.match(prompt, /签号：第2签/);
  assert.match(prompt, /签题：从革卦/);
  assert.match(prompt, /签诗：/);
  assert.match(prompt, /吉凶级别：/);
  assert.match(prompt, /典故：/);
  assert.match(prompt, /基础解签：/);
  assert.match(prompt, /补充解释：/);
  assert.doesNotMatch(
    prompt,
    /占法：|五枚硬币：|卦序：|卦名：|等第：|卦诗：|诗句取象：|基础解卦：|卦名取象：/,
  );
});

test('诸葛与孔明完整提示词不重复任务或加入当前时间', () => {
  const cases = [
    { method: 'zhuge' as const, data: { text: '顺其然' } },
    { method: 'kongming' as const, data: castKongmingHexagram('●○○○○') },
  ];
  for (const item of cases) {
    const data = item.method === 'zhuge' ? calculateZhugeNumber(item.data.text) : item.data;
    const prompt = buildDivinationPrompt({
      method: item.method,
      data,
      question: '这件事如何推进？',
    });
    assert.doesNotMatch(prompt, /【当前时间】|占法：|所写三字|康熙笔画|五枚硬币|取数过程/u);
    const task = /【任务】\n([\s\S]*?)(?=\n\n【问题】)/u.exec(prompt)?.[1] ?? '';
    assert.equal((task.match(/依据/gu) ?? []).length, 1);
    if (item.method === 'zhuge') {
      assert.match(task, /本签签号、签诗、基础解签和补充解释/u);
      assert.doesNotMatch(task, /签题|典故/u);
    } else {
      assert.match(task, /本次签题、卦诗与等第/u);
    }
  }
});
