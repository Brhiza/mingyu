import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { formatEnhancedDivinationInfo } from 'mingyu-core/prompt';

test('六爻事业用神与世爻不同五行时保留原忌仇神的作用对象', () => {
  const data = generateLiuyao(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'manual',
    yaos: [6, 8, 8, 8, 8, 6],
  });
  const text = formatEnhancedDivinationInfo('liuyao', data, '', undefined, {
    liuyaoTemplate: 'shiye',
  });
  assert.match(text, /世爻第6爻子孙酉金/);
  assert.match(text, /生克参照：本次所选用神第3爻官鬼卯木/);
  assert.match(text, /原神水（水生木）见第5爻妻财亥水/);
  assert.match(text, /忌神金（金克木）见第6爻子孙酉金/);
  assert.match(text, /仇神土（土生金并克水）/);
  assert.doesNotMatch(text, /原神水（水生金）/);
  assert.match(text, /动变五行：本爻未土克变爻子水/);
  assert.match(text, /动变五行：本爻酉金克变爻寅木/);
  assert.doesNotMatch(text, /变爻寅木克本爻酉金|变爻子水生本爻未土/);
});

test('六爻有实际伏神时保留伏藏位置和飞神资料', () => {
  const data = generateLiuyao(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'manual',
    yaos: [7, 8, 8, 8, 7, 8],
  });
  const text = formatEnhancedDivinationInfo('liuyao', data);
  assert.equal(data.hiddenSpirits?.length, 1);
  assert.match(text, /伏神1爻：妻财伏第3爻午火/);
  assert.match(text, /伏于官鬼辰土下/);
});

test('六爻静卦按实际世应和空爻给出月日生克及冲空对象', () => {
  const data = generateLiuyao(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'manual',
    yaos: [8, 8, 7, 8, 8, 7],
  });
  const text = formatEnhancedDivinationInfo('liuyao', data, '', undefined, {
    liuyaoTemplate: 'shiye',
  });
  assert.match(text, /世应五行：应爻第3爻子孙申金克世爻第6爻官鬼寅木/);
  assert.match(text, /第5爻妻财子水克月建、日辰巳火/);
  assert.match(text, /第6爻官鬼寅木生月建、日辰巳火/);
  assert.match(text, /第2爻父母午火（本爻空亡；本爻午逢值，子冲午）/);
  assert.doesNotMatch(text, /动变五行：/);
  assert.match(text, /明伏分布：本卦明爻6爻，六亲为兄弟、父母、子孙、妻财、官鬼；伏神0爻/);
});
