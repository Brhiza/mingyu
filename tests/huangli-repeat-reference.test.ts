import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('五离与复日按申酉及逐月单干起例覆盖完整月日组合', () => {
  // 《协纪》所引《地理新书》复日单干表；五离为申酉日。
  // https://www.shidianguji.com/ens/book/SK1619/chapter/1l9llq0wzokdf
  const targets = [...'甲乙戊丙丁己庚辛戊壬癸己'];
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      assert.equal(
        names.includes('五离'),
        '申酉'.includes(branches[day % 12]),
        `${month + 1}月/${pillar(day)}/五离`,
      );
      assert.equal(
        names.includes('复日'),
        targets[month] === stems[day % 10],
        `${month + 1}月/${pillar(day)}/复日`,
      );
    }
});

test('四耗四废四忌四穷按四季固定日覆盖完整月日组合', () => {
  // 《协纪辨方书》四耗、四废、四忌、四穷。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llq0wznv37
  const tables = {
    四耗: [['壬子'], ['乙卯'], ['戊午'], ['辛酉']],
    四废: [
      ['庚申', '辛酉'],
      ['壬子', '癸亥'],
      ['甲寅', '乙卯'],
      ['丙午', '丁巳'],
    ],
    四忌: [['甲子'], ['丙子'], ['庚子'], ['壬子']],
    四穷: [['乙亥'], ['丁亥'], ['辛亥'], ['癸亥']],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[Math.floor(month / 3)].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});
