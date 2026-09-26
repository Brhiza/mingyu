import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { getBaziQiongtongAdvice } from 'mingyu-core/classics';

test('《穷通宝鉴》调候资料按原文校正取用先后', () => {
  assert.deepEqual(getBaziQiongtongAdvice('乙', '卯')?.primaryGods, ['丙', '癸']);
  assert.deepEqual(getBaziQiongtongAdvice('辛', '亥')?.primaryGods, ['壬', '丙']);
  assert.deepEqual(getBaziQiongtongAdvice('壬', '午')?.primaryGods, ['癸', '庚']);
  assert.deepEqual(getBaziQiongtongAdvice('癸', '卯')?.primaryGods, ['庚', '辛']);
  assert.deepEqual(getBaziQiongtongAdvice('癸', '巳')?.primaryGods, ['辛', '庚']);
});

test('乙酉条保留白露与秋分后的不同取用条件', () => {
  const entry = getBaziQiongtongAdvice('乙', '酉');
  assert.ok(entry);
  assert.match(entry.classicVerse, /白露之后.*耑用癸水/u);
  assert.match(entry.classicVerse, /秋分后.*宜用丙，癸水次之/u);
  assert.match(entry.seasonSummary, /秋分前.*秋分后/u);
  assert.match(entry.modernExplanation, /白露后.*秋分后/u);
  assert.equal(getBaziQiongtongAdvice('乙', '申'), undefined);
});

test('丙子引文保留壬戊原文且不再列甲为通用取用', () => {
  const entry = getBaziQiongtongAdvice('丙', '子');
  assert.ok(entry);
  assert.equal(entry.classicVerse, '十一月丙火，冬至一阳生，弱中复强，壬水为最，戊土佐之。');
  assert.deepEqual(entry.primaryGods, ['壬', '戊']);
});
