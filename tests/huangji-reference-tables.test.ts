import assert from 'node:assert/strict';
import test from 'node:test';
import { getHuangjiHistoricalEraBlock, queryHuangjiReference } from 'mingyu-core/huangji-jingshi';

test('皇极声音律吕表返回固定数目、分类和四象次序', () => {
  const result = queryHuangjiReference({ table: 'sound-rhythm' });

  assert.equal(result.table, 'sound-rhythm');
  assert.deepEqual(result.bodyCounts, {
    heavenlyBody: 160,
    earthlyBody: 192,
    heavenlyUseSound: 112,
    earthlyUseTone: 152,
  });
  assert.deepEqual(result.soundCategories, ['平', '上', '去', '入']);
  assert.deepEqual(result.toneCategories, ['开', '发', '收', '闭']);
  assert.deepEqual(
    result.pairings.map((item) => [item.image, item.element]),
    [
      ['日', '水'],
      ['月', '火'],
      ['星', '土'],
      ['辰', '石'],
    ],
  );
  assert.equal(result.source[0]?.revision, '789545');
});

test('皇极动植物数表保留可复算数目与校勘边界', () => {
  const result = queryHuangjiReference({ table: 'animal-plant' });
  const values = Object.fromEntries(result.counts.map((item) => [item.name, item.value]));

  assert.equal(values['动植之全数'], 160 * 192);
  assert.equal(values['动物之用数'], 112 * 152);
  assert.equal(values['植物之用数'], 152 * 112);
  assert.equal(values['动物通数'], 17024 * 17024);
  assert.match(result.limitations.join('\n'), /一百二十二/);
});

test('皇极历史纪年原表按经辰区块返回三十个甲子并保留原文支字', () => {
  const first = getHuangjiHistoricalEraBlock(2156);
  assert.equal(first.source.revision, '789511');
  assert.equal(first.branch, '未');
  assert.equal(first.sourceBranch, '未');
  assert.equal(first.rows.length, 30);
  assert.equal(first.rows[0]?.ganzhi, '甲午');
  assert.deepEqual(first.namedEntries, [{ rowIndex: 11, ganzhi: '甲辰', label: '唐堯' }]);

  const corrected = getHuangjiHistoricalEraBlock(2190);
  assert.equal(corrected.source.revision, '789512');
  assert.equal(corrected.sourceBranch, '己');
  assert.equal(corrected.branch, '巳');
  assert.equal(corrected.sourceBranchNote !== undefined, true);
  assert.deepEqual(corrected.namedEntries, [{ rowIndex: 28, ganzhi: '丁巳', label: '商武丁' }]);
  assert.throws(() => getHuangjiHistoricalEraBlock(2148), /2149至2208/);
});
