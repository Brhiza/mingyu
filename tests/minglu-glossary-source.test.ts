import assert from 'node:assert/strict';
import test from 'node:test';
import { MINGLU_GLOSSARY_DATABASE } from '../packages/core/src/minglu/glossary-data';

test('十神词条的阴阳定义与十神关系一致', () => {
  const relations = new Map([
    ['正官', '克我而阴阳相配'],
    ['七杀', '克我而阴阳同性'],
    ['正印', '生我而阴阳相配'],
    ['偏印', '生我而阴阳同性'],
    ['正财', '我克而阴阳相配'],
    ['偏财', '我克而阴阳同性'],
    ['食神', '我生而阴阳同性'],
    ['伤官', '我生而阴阳相配'],
    ['比肩', '阴阳同性'],
    ['劫财', '阴阳相配'],
  ]);
  const tenGods = MINGLU_GLOSSARY_DATABASE.filter((entry) => entry.category === '十神');

  assert.equal(tenGods.length, relations.size);
  for (const entry of tenGods) {
    const relation = relations.get(entry.term);
    assert.ok(relation, `未登记的十神：${entry.term}`);
    assert.ok(entry.shortDesc.includes(relation), `${entry.term} 的阴阳关系应为 ${relation}`);
  }
});

test('典籍摘录不再包含原先的拼接韵文或伪书名', () => {
  const sourceText = MINGLU_GLOSSARY_DATABASE.map((entry) => entry.classicSource ?? '').join('\n');
  for (const fragment of [
    '顶天立地做高官',
    '正财以实劳致富',
    '强则分夺，弱则扶持',
    '才华如水润无声',
    '现代西方占星本命全书',
    '现代西方占星职业指南',
  ]) {
    assert.ok(!sourceText.includes(fragment), `仍含未经证实的引文：${fragment}`);
  }
  for (const entry of MINGLU_GLOSSARY_DATABASE) {
    if (entry.classicSource) {
      assert.match(entry.classicSource, /^《[^》]+》：“[^”]+。”$/);
    }
  }
});

test('占星轴点定义区分天文位置与分宫制', () => {
  const ascendant = MINGLU_GLOSSARY_DATABASE.find((entry) => entry.term === '上升星座');
  const midheaven = MINGLU_GLOSSARY_DATABASE.find((entry) => entry.term === '天顶');
  assert.ok(ascendant);
  assert.ok(midheaven);
  assert.ok(ascendant.fullDesc.includes('整宫制'));
  assert.ok(midheaven.fullDesc.includes('子午圈'));
  assert.ok(midheaven.fullDesc.includes('整宫制'));
  assert.ok(!midheaven.fullDesc.includes('太阳运动的最高点'));
});
