import test from 'node:test';
import assert from 'node:assert/strict';
import { getStemWuxing, getBranchWuxing, isLiuhe } from '../packages/core/src/ganzhi/index.ts';
import { isValidGanZhi } from '../packages/core/src/ganzhi/validation.ts';

test('干支五行与六合逐项对应《渊海子平》基础表', () => {
  const groups = {
    木: '甲乙寅卯',
    火: '丙丁巳午',
    土: '戊己辰戌丑未',
    金: '庚辛申酉',
    水: '壬癸亥子',
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  for (const [element, characters] of Object.entries(groups))
    for (const character of characters) {
      assert.equal(
        stems.includes(character) ? getStemWuxing(character) : getBranchWuxing(character),
        element,
      );
    }
  const pairs = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
  for (const a of branches)
    for (const b of branches) {
      assert.equal(isLiuhe(a, b), pairs.includes(a + b) || pairs.includes(b + a), a + b);
    }
  let valid = 0;
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 12; j++) {
      const expected = i % 2 === j % 2;
      assert.equal(isValidGanZhi(stems[i] + branches[j]), expected);
      if (expected) valid++;
    }
  assert.equal(valid, 60);
});
