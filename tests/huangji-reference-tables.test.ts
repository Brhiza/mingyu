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
  assert.deepEqual(result.diagramCounts, [
    { name: '辰星声入辟图音数', value: 1064, formula: '7×152' },
    { name: '石土音闭清图声数', value: 560, formula: '5×112' },
  ]);
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
  assert.equal(values['动植之通数'], 17024 * 17024);
  assert.match(result.limitations.join('\n'), /一百二十二/);
});

test('皇极历史纪年原表按经辰区块返回三十个甲子并保留原文支字', () => {
  const first = getHuangjiHistoricalEraBlock(2156);
  assert.equal(first.source.revision, '789511');
  assert.equal(first.branch, '未');
  assert.equal(first.sourceBranch, '未');
  assert.equal(first.rows.length, 30);
  assert.equal(first.rows[0]?.ganzhi, '甲午');
  assert.equal(
    first.rows.every((row) => typeof row.sourceText === 'string'),
    true,
  );
  assert.deepEqual(first.namedEntries, [
    { rowIndex: 11, ganzhi: '甲辰', label: '唐堯', sourceText: '唐堯' },
  ]);

  const corrected = getHuangjiHistoricalEraBlock(2190);
  assert.equal(corrected.source.revision, '789512');
  assert.equal(corrected.sourceBranch, '己');
  assert.equal(corrected.branch, '巳');
  assert.equal(corrected.sourceBranchNote !== undefined, true);
  assert.equal(corrected.rows[22]?.sourceText, '二十八');
  assert.equal(corrected.rows[23]?.sourceText, '商武丁');
  assert.deepEqual(corrected.namedEntries, [
    { rowIndex: 24, ganzhi: '丁巳', label: '商武丁', sourceText: '商武丁' },
  ]);
  assert.throws(() => getHuangjiHistoricalEraBlock(2148), /2149至2208/);
});

test('皇极历史纪年原表逐区块保留三十行原文标记和固定卷页版本', () => {
  // 《皇极经世书》卷三上固定修订789511：经辰2149、2150各明列三十行。
  // https://zh.wikisource.org/w/index.php?oldid=789511
  // 两组原文逐行转录；卷三上下2149至2208区块均依此交替，未由生产干支表生成。
  const jiaziRows = [
    '甲子',
    '乙丑',
    '丙寅',
    '丁卯',
    '戊辰',
    '己巳',
    '庚午',
    '辛未',
    '壬申',
    '癸酉',
    '甲戌',
    '乙亥',
    '丙子',
    '丁丑',
    '戊寅',
    '己卯',
    '庚辰',
    '辛巳',
    '壬午',
    '癸未',
    '甲申',
    '乙酉',
    '丙戌',
    '丁亥',
    '戊子',
    '己丑',
    '庚寅',
    '辛卯',
    '壬辰',
    '癸巳',
  ] as const;
  const jiawuRows = [
    '甲午',
    '乙未',
    '丙申',
    '丁酉',
    '戊戌',
    '己亥',
    '庚子',
    '辛丑',
    '壬寅',
    '癸卯',
    '甲辰',
    '乙巳',
    '丙午',
    '丁未',
    '戊申',
    '己酉',
    '庚戌',
    '辛亥',
    '壬子',
    '癸丑',
    '甲寅',
    '乙卯',
    '丙辰',
    '丁巳',
    '戊午',
    '己未',
    '庚申',
    '辛酉',
    '壬戌',
    '癸亥',
  ] as const;
  let namedEntryCount = 0;

  for (let shiIndex = 2149; shiIndex <= 2208; shiIndex += 1) {
    const reference = getHuangjiHistoricalEraBlock(shiIndex);
    assert.equal(reference.rows.length, 30);
    assert.equal(reference.source.revision, shiIndex <= 2184 ? '789511' : '789512');
    assert.deepEqual(
      reference.rows.map((row) => row.ganzhi),
      (shiIndex - 2149) % 2 === 0 ? jiaziRows : jiawuRows,
    );
    assert.equal(
      reference.rows.every((row) => typeof row.sourceText === 'string'),
      true,
    );
    for (const entry of reference.namedEntries) {
      namedEntryCount += 1;
      assert.equal(reference.rows[entry.rowIndex - 1]?.sourceText, entry.sourceText);
    }
  }

  assert.equal(namedEntryCount, 60);
});
