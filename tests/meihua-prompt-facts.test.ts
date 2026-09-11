import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMeihua } from '@core/divination/algorithms/meihua';
import { formatMeihuaFacts } from '@core/prompt/meihua-facts';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { ZHOUYI_HEXAGRAMS_TEXT } from '@core/classics/zhouyi';

test('梅花字占保留原字及分笔，方位取象使用中文资料', () => {
  const date = new Date('2026-09-11T05:27:00+08:00');
  const character = generateMeihua(date, {
    method: 'character',
    characterText: '明',
    characterLeftStrokes: 4,
    characterRightStrokes: 4,
  });
  assert.match(formatMeihuaFacts(character).join('\n'), /文字「明」，字数1，左右分笔数为4、4/u);
  const direction = generateMeihua(date, {
    method: 'direction',
    direction: 'north',
    objectType: 'earth',
  });
  const facts = formatMeihuaFacts(direction).join('\n');
  assert.match(facts, /所见物类地（坤）取上卦数8，方位正北（坎）取下卦数6/u);
  assert.doesNotMatch(facts, /earth|north|objectType|direction/u);
  assert.doesNotMatch(direction.evidenceAnalysis?.promptText ?? '', /所见物类earth|方位north/u);
});

test('梅花比和判辞保留同盘在五种月令中的实际旺衰', () => {
  const settings = { method: 'number' as const, number: 42 };
  for (const [date, state] of [
    ['2026-01-19', '相'],
    ['2026-02-19', '囚'],
    ['2026-05-19', '死'],
    ['2026-08-19', '旺'],
    ['2026-11-19', '休'],
  ]) {
    const data = generateMeihua(new Date(`${date}T12:30:00+08:00`), settings);
    assert.equal(data.originalName, '泽天夬');
    assert.equal(data.analysis.tiSeasonState, state);
    assert.equal(data.analysis.yongSeasonState, state);
    const prompt = buildDivinationPrompt('meihua', '请做整体解读。', data, {
      meihuaSettings: settings,
    });
    assert.ok(prompt.includes(`体用同五行，比和相应；体卦${state}、用卦${state}`));
    assert.doesNotMatch(prompt, /百事顺遂无逆/);
  }
});

test('履六三动爻原文保留咥人凶与对应小象，卦辞和动爻辞分别输出', () => {
  const settings = { method: 'random' as const, seed: '梅花原生边界20260909' };
  const data = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), settings);
  assert.equal(data.originalName, '天泽履');
  assert.equal(data.movingYao.position, 3);
  const prompt = buildDivinationPrompt('meihua', '请做整体解读。', data, {
    meihuaSettings: settings,
  });
  const fullText = '眇能视，跛能履，履虎尾，咥人，凶。武人为于大君';
  assert.ok(prompt.includes(`动爻爻辞：第3爻，${fullText}`));
  assert.match(prompt, /主卦卦辞：天泽履，履虎尾，不咥人，亨/);
  assert.equal(ZHOUYI_HEXAGRAMS_TEXT[10].yaos[2].yaoCi, fullText);
  assert.match(ZHOUYI_HEXAGRAMS_TEXT[10].yaos[2].xiaoXiang, /咥人之凶，位不当也/);
});

test('梅花年月日时原生提示词保留初三取数、屯二爻阴变阳及互卦上下身份', () => {
  const settings = { method: 'time' as const };
  const data = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), settings);
  const prompt = buildDivinationPrompt('meihua', '请做整体解读。', data, {
    meihuaSettings: settings,
  });
  assert.match(prompt, /农历年支午序数7、农历月数4、农历日数3、时支巳序数6/);
  assert.match(prompt, /上卦数6.*下卦数4.*动爻2/);
  assert.match(prompt, /主卦第2爻阴变阳.*变卦上卦坎、下卦兑，合为水泽节/);
  assert.match(prompt, /第2至4爻阴阴阴为下卦坤；第3至5爻阴阴阳为上卦艮，合为山地剥/);
});

test('梅花午时数字卦明确变后巽木生月火为休，上卦动与余零保留实际结果', () => {
  const noon = generateMeihua(new Date('2026-05-19T12:30:00+08:00'), {
    method: 'number',
    number: 42,
  });
  const prompt = formatMeihuaFacts(noon).join('\n');
  assert.match(prompt, /变后用卦巽木生巳月令火，卦气泄出，变后用卦为休/);
  assert.match(prompt, /主卦第1爻阳变阴；动爻位于下卦/);
  const morning = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'number',
    number: 42,
  });
  assert.match(formatMeihuaFacts(morning).join('\n'), /主卦第6爻阴变阳；动爻位于上卦/);
  const zero = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'number',
    number: 8,
  });
  assert.match(formatMeihuaFacts(zero).join('\n'), /数字8除8取余得上卦数8/);
});

test('梅花各卦月令作用覆盖火令下五种关系，随机法保留自身起卦身份', () => {
  const cases = [
    ['离', '火', '与巳月令火同类', '旺'],
    ['坤', '土', '巳月令火生原体坤土', '相'],
    ['震', '木', '原体震木生巳月令火，卦气泄出', '休'],
    ['坎', '水', '原体坎水克巳月令火，卦气耗用', '囚'],
    ['兑', '金', '巳月令火克原体兑金', '死'],
  ];
  for (const [name, element, relation, state] of cases) {
    const data = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
      method: 'random',
      seed: '梅花月令关系',
    });
    data.tiGua = { ...data.tiGua, name, element };
    const facts = formatMeihuaFacts(data).join('\n');
    assert.ok(facts.includes(relation), facts);
    assert.ok(facts.includes(`原体为${state}`), facts);
    assert.doesNotMatch(facts, /起卦取数：/);
  }
});
