import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('天符按正月戌顺行六阳辰覆盖完整月日组合', () => {
  // 《御定星历考原》天符正月起戌，与司命同起例。
  // https://www.shidianguji.com/mid-page/7352635351480975386
  const targets = [...'戌子寅辰午申戌子寅辰午申'];
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const gods = getHuangliDayGods(pillar(month + 2), pillar(day));
      const matches = gods.filter((god) => god.getName() === '天符');
      const expected = branches[day % 12] === targets[month];
      assert.equal(matches.length, expected ? 1 : 0, `${month + 1}月/${pillar(day)}`);
      assert.equal(
        gods.some((god) => god.getName() === '司命'),
        expected,
      );
      if (expected) assert.equal(matches[0].getLuck().getName(), '吉');
    }
});
