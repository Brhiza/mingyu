import test from 'node:test';
import assert from 'node:assert/strict';
import {
  castKongmingHexagram,
  getKongmingInterpretation,
} from '../packages/core/src/name-number/index.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';

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
  const oldResult = { ...first };
  Reflect.deleteProperty(oldResult, 'interpretation');
  const prompt = formatEnhancedDivinationInfo('kongming', oldResult);
  assert.ok(prompt.includes(first.interpretation.interpretation));
  assert.throws(() => getKongmingInterpretation('constructor'), /未找到/);
  assert.throws(() => getKongmingInterpretation('●○'), /未找到/);
});
