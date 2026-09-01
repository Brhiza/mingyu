import test from 'node:test';
import assert from 'node:assert/strict';
import { getTenGod } from '../packages/core/src/bazi/baziUtils.ts';

/**
 * 十神 8 项断言黄金集
 *
 * 十神由日主（出生日天干）与目标天干的五行生克 + 阴阳关系推导：
 *   - 同我者：比肩（同阴阳）/ 劫财（异阴阳）
 *   - 我生者：食神（同阴阳）/ 伤官（异阴阳）
 *   - 我克者：偏财（同阴阳）/ 正财（异阴阳）
 *   - 克我者：七杀（同阴阳）/ 正官（异阴阳）
 *   - 生我者：偏印（同阴阳）/ 正印（异阴阳）
 *
 * 十神矩阵（日主 × 天干）：
 * 天干序: 甲0 乙1 丙2 丁3 戊4 己5 庚6 辛7 壬8 癸9
 */

// 完整十神矩阵（日主行 × 10 天干列）
const TEN_GOD_MATRIX: Record<string, string[]> = {
  甲: ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'],
  乙: ['劫财', '比肩', '伤官', '食神', '正财', '偏财', '正官', '七杀', '正印', '偏印'],
  丙: ['偏印', '正印', '比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官'],
  丁: ['正印', '偏印', '劫财', '比肩', '伤官', '食神', '正财', '偏财', '正官', '七杀'],
  戊: ['七杀', '正官', '偏印', '正印', '比肩', '劫财', '食神', '伤官', '偏财', '正财'],
  己: ['正官', '七杀', '正印', '偏印', '劫财', '比肩', '伤官', '食神', '正财', '偏财'],
  庚: ['偏财', '正财', '七杀', '正官', '偏印', '正印', '比肩', '劫财', '食神', '伤官'],
  辛: ['正财', '偏财', '正官', '七杀', '正印', '偏印', '劫财', '比肩', '伤官', '食神'],
  壬: ['食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印', '比肩', '劫财'],
  癸: ['伤官', '食神', '正财', '偏财', '正官', '七杀', '正印', '偏印', '劫财', '比肩'],
};

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// --- 断言 1：甲日主全十神 ---
test('十神断言 1：甲日主对应全部十神正确', () => {
  const expected = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
  STEMS.forEach((stem, i) => {
    assert.equal(getTenGod(stem, '甲'), expected[i], `甲见${stem}应为${expected[i]}`);
  });
});

// --- 断言 2：乙日主全十神 ---
test('十神断言 2：乙日主对应全部十神正确', () => {
  const expected = ['劫财', '比肩', '伤官', '食神', '正财', '偏财', '正官', '七杀', '正印', '偏印'];
  STEMS.forEach((stem, i) => {
    assert.equal(getTenGod(stem, '乙'), expected[i], `乙见${stem}应为${expected[i]}`);
  });
});

// --- 断言 3：丙日主全十神 ---
test('十神断言 3：丙日主对应全部十神正确', () => {
  const expected = ['偏印', '正印', '比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官'];
  STEMS.forEach((stem, i) => {
    assert.equal(getTenGod(stem, '丙'), expected[i], `丙见${stem}应为${expected[i]}`);
  });
});

// --- 断言 4：戊日主全十神 ---
test('十神断言 4：戊日主对应全部十神正确', () => {
  const expected = ['七杀', '正官', '偏印', '正印', '比肩', '劫财', '食神', '伤官', '偏财', '正财'];
  STEMS.forEach((stem, i) => {
    assert.equal(getTenGod(stem, '戊'), expected[i], `戊见${stem}应为${expected[i]}`);
  });
});

// --- 断言 5：庚日主全十神 ---
test('十神断言 5：庚日主对应全部十神正确', () => {
  const expected = ['偏财', '正财', '七杀', '正官', '偏印', '正印', '比肩', '劫财', '食神', '伤官'];
  STEMS.forEach((stem, i) => {
    assert.equal(getTenGod(stem, '庚'), expected[i], `庚见${stem}应为${expected[i]}`);
  });
});

// --- 断言 6：壬日主全十神 ---
test('十神断言 6：壬日主对应全部十神正确', () => {
  const expected = ['食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印', '比肩', '劫财'];
  STEMS.forEach((stem, i) => {
    assert.equal(getTenGod(stem, '壬'), expected[i], `壬见${stem}应为${expected[i]}`);
  });
});

// --- 断言 7：全矩阵对称性（10×10 完整核对）---
test('十神断言 7：完整 10×10 矩阵与权威矩阵一致', () => {
  for (const dayMaster of STEMS) {
    const expectedRow = TEN_GOD_MATRIX[dayMaster];
    assert.ok(expectedRow, `矩阵缺少日主 ${dayMaster} 行`);
    STEMS.forEach((stem, i) => {
      assert.equal(
        getTenGod(stem, dayMaster),
        expectedRow[i],
        `${dayMaster}日主见${stem}应=${expectedRow[i]}`,
      );
    });
  }
});

// --- 断言 8：十神关系对称性（反向生克关系成立）---
test('十神断言 8：生克关系对称性（我克者见我为财，克我者见我为官杀）', () => {
  // 甲（阳木）：戊己土为我所克 → 甲见戊=偏财，戊见甲=七杀（克我者）
  assert.equal(getTenGod('戊', '甲'), '偏财', '甲见戊应=偏财（我克，同阴阳）');
  assert.equal(getTenGod('甲', '戊'), '七杀', '戊见甲应=七杀（克我，同阴阳）');
  // 甲（阳木）：壬癸水为我所生 → 甲见壬=偏印，壬见甲=食神（我生者被我生）
  assert.equal(getTenGod('壬', '甲'), '偏印', '甲见壬应=偏印（生我，同阴阳）');
  assert.equal(getTenGod('甲', '壬'), '食神', '壬见甲应=食神（我生，同阴阳）');
  // 甲（阳木）：庚辛金克我 → 甲见庚=七杀，庚见甲=偏财（我克者）
  assert.equal(getTenGod('庚', '甲'), '七杀', '甲见庚应=七杀（克我，同阴阳）');
  assert.equal(getTenGod('甲', '庚'), '偏财', '庚见甲应=偏财（我克，同阴阳）');
  // 阴阳反转：甲见乙=劫财（异阴阳），乙见甲=劫财
  assert.equal(getTenGod('乙', '甲'), '劫财');
  assert.equal(getTenGod('甲', '乙'), '劫财');
});

// --- 补充：非法输入返回未知 ---
test('十神断言补充：非法天干返回未知', () => {
  assert.equal(getTenGod('X', '甲'), '未知');
  assert.equal(getTenGod('甲', 'Y'), '未知');
  assert.equal(getTenGod('', '甲'), '未知');
});
