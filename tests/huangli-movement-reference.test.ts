import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('五富驿马天马天喜生死气按既定起例覆盖十二月六十日', () => {
  // 《大清会典》五富，《星历考原》天马驿马，《黄帝宅经》生死气。
  // https://www.shidianguji.com/zh/book/CADAL01021280/chapter/1lmtiwd6bv5e1
  // https://www.shidianguji.com/zh/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // https://www.shidianguji.com/zh/book/NGJ892411999023143141460/chapter/1loyv18ouqckz
  // 天喜沿用成日起例；《协纪》天狗条并载四季、成日、逆行三种，不混用。
  // https://www.shidianguji.com/zh/book/SK1619/chapter/1l9lm21xfma6n
  const tables = {
    五富: [...'亥寅巳申亥寅巳申亥寅巳申'],
    驿马: [...'申巳寅亥申巳寅亥申巳寅亥'],
    天马: [...'午申戌子寅辰午申戌子寅辰'],
    天喜: [...'戌亥子丑寅卯辰巳午未申酉'],
    生气: [...'子丑寅卯辰巳午未申酉戌亥'],
    死气: [...'午未申酉戌亥子丑寅卯辰巳'],
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
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});
