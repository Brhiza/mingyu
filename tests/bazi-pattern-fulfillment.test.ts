import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import { getTenGod } from '../packages/core/src/bazi/baziUtils';
import type { Pillars } from '../packages/core/src/bazi/baziTypes';

test('子平真诠：正官格见伤官破格，透印绶制伤护官，破而复成', () => {
  // 假设：甲日主生酉月（正官格），天干透丁火（伤官欲破官），天干又透壬水（枭/印克丁火护酉金正官）
  // 年柱：壬申（印） 月柱：己酉（财/官） 日柱：甲子（日主） 时柱：丁卯（伤官）
  const pillars: Pillars = {
    year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    month: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  };

  const result = evaluatePatternFulfillment(pillars, '甲', '正官格', getTenGod);
  assert.equal(result.status, '破而复成');
  assert.ok(result.contradiction.includes('伤官见官'));
  assert.ok(result.remedies.length > 0);
  assert.equal(result.remedies[0].stem, '壬');
  assert.ok(result.remedies[0].effect.includes('护住正官'));
});

test('子平真诠：正官格官杀混杂，透食神去杀留官，格转清纯', () => {
  // 假设：甲日主生酉月（正官格），天干透庚金（七杀混杂），又透丙火（食神制庚金七杀）
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' }, // 食神
    month: { gan: '庚', zhi: '申', ganZhi: '庚申' }, // 七杀
    day: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    hour: { gan: '辛', zhi: '未', ganZhi: '辛未' }, // 正官
  };

  const result = evaluatePatternFulfillment(pillars, '甲', '正官格', getTenGod);
  assert.equal(result.status, '破而复成');
  assert.ok(result.contradiction.includes('官杀混杂'));
  assert.equal(result.remedies[0].tenGod, '食神');
});

test('子平真诠：财格逢比劫夺财破格，透食伤通关化劫生财，破而复成', () => {
  // 假设：乙日主生辰月（财格），天干透甲木（劫财争财），透丙火（伤官生财通关）
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' }, // 劫财
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' }, // 正财
    day: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    hour: { gan: '丙', zhi: '戌', ganZhi: '丙戌' }, // 伤官
  };

  const result = evaluatePatternFulfillment(pillars, '乙', '正财格', getTenGod);
  assert.equal(result.status, '破而复成');
  assert.ok(result.contradiction.includes('比劫分夺财星'));
  assert.equal(result.remedies[0].stem, '丙');
});

test('子平真诠：食神格逢偏印枭神夺食破格，透财星制枭护食，转破为成', () => {
  // 假设：丙日主生丑月己土透干（伤官/食神），透甲木（偏印夺食），透庚金（偏财制甲木偏印）
  const pillars: Pillars = {
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' }, // 偏财
    month: { gan: '甲', zhi: '申', ganZhi: '甲申' }, // 偏印
    day: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    hour: { gan: '戊', zhi: '子', ganZhi: '戊子' }, // 食神
  };

  const result = evaluatePatternFulfillment(pillars, '丙', '食神格', getTenGod);
  assert.equal(result.status, '破而复成');
  assert.ok(result.contradiction.includes('枭神夺食'));
  assert.equal(result.remedies[0].stem, '庚');
});

test('子平真诠：七杀格得食神制杀大成格', () => {
  // 甲日主生申月（七杀格），透丙火食神制杀
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '午', ganZhi: '丙午' }, // 食神
    month: { gan: '庚', zhi: '申', ganZhi: '庚申' }, // 七杀
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '乙', zhi: '亥', ganZhi: '乙亥' },
  };

  const result = evaluatePatternFulfillment(pillars, '甲', '七杀格', getTenGod);
  // console.log('DEBUG result:', result);
  assert.equal(result.status, '成格');
  assert.ok(result.summary.includes('食神制杀'));
});
