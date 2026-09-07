import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('六项黄道神与五合除神覆盖十二月六十日起例', () => {
  // 《万年书》月吉神立成，五合寅卯日、除神申酉日。
  // https://www.shidianguji.com/book/HY1447/chapter/1l3wfewr9um1y
  const tables = {
    青龙: [...'子寅辰午申戌子寅辰午申戌'],
    明堂: [...'丑卯巳未酉亥丑卯巳未酉亥'],
    金匮: [...'辰午申戌子寅辰午申戌子寅'],
    宝光: [...'巳未酉亥丑卯巳未酉亥丑卯'],
    玉堂: [...'未酉亥丑卯巳未酉亥丑卯巳'],
    司命: [...'戌子寅辰午申戌子寅辰午申'],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const branch = branches[day % 12];
      const names = getHuangliDayGods(pillar(month + 2), dayPillar).map((god) => god.getName());
      assert.equal(
        names.includes('五合'),
        '寅卯'.includes(branch),
        `${month + 1}月/${dayPillar}/五合`,
      );
      assert.equal(
        names.includes('除神'),
        '申酉'.includes(branch),
        `${month + 1}月/${dayPillar}/除神`,
      );
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branch,
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});
