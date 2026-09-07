import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWuxing, isSheng, isKe, getSeasonState } from '../packages/core/src/wuxing/index.ts';

test('五行生克二十五组合与传统相生相克次序一致', () => {
  const sheng = ['木火', '火土', '土金', '金水', '水木'];
  const ke = ['木土', '土水', '水火', '火金', '金木'];
  for (const source of ['木', '火', '土', '金', '水']) {
    for (const target of ['木', '火', '土', '金', '水']) {
      assert.equal(isSheng(source, target), sheng.includes(source + target));
      assert.equal(isKe(source, target), ke.includes(source + target));
    }
  }
  for (const invalid of ['风', '', 'toString', null, 1]) {
    for (const relation of [isSheng, isKe]) {
      assert.throws(() => relation('木', invalid as never), /五行无效/);
      assert.throws(() => relation(invalid as never, '木'), /五行无效/);
    }
  }
});

test('月建本气旺相休囚死与三命通会五行表一致', () => {
  const rows = [
    { months: ['寅', '卯'], states: ['旺', '相', '死', '囚', '休'] },
    { months: ['巳', '午'], states: ['休', '旺', '相', '死', '囚'] },
    { months: ['辰', '戌', '丑', '未'], states: ['囚', '休', '旺', '相', '死'] },
    { months: ['申', '酉'], states: ['死', '囚', '休', '旺', '相'] },
    { months: ['亥', '子'], states: ['相', '死', '囚', '休', '旺'] },
  ];
  const elements = ['木', '火', '土', '金', '水'];
  for (const row of rows)
    for (const month of row.months) {
      for (let i = 0; i < elements.length; i++) {
        assert.equal(getSeasonState(elements[i], month), row.states[i], `${month}月${elements[i]}`);
      }
    }
});

test('五行统计拒绝缺项和非法权重选项，提示词只保留任务和统计资料', () => {
  for (const items of [new Array(2), ['甲', ''], ['甲', undefined], '甲', null]) {
    assert.throws(() => analyzeWuxing(items as never), /输入/);
  }
  assert.throws(() => analyzeWuxing(['甲'], { weightHidden: 'false' as never }), /布尔值/);
  const result = analyzeWuxing(['甲', '子']);
  assert.deepEqual(result.counts, { 木: 1, 火: 0, 土: 0, 金: 0, 水: 2 });
  assert.match(result.promptText, /【任务】[\s\S]*【资料】[\s\S]*【结果】/);
  assert.doesNotMatch(
    result.promptText,
    /证据汇总|证据链完整|单一真相源|来源：|限制：|dominantElements/,
  );
  const surface = analyzeWuxing(['甲', '子'], { weightHidden: false });
  assert.deepEqual(surface.counts, { 木: 1, 火: 0, 土: 0, 金: 0, 水: 1 });
  assert.deepEqual(surface.dominantElements, ['木', '水']);
});
