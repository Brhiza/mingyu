import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('阳德阴德解神六仪时阳时阴覆盖十二月六十日起例', () => {
  // 《御定星历考原》卷三，六仪以标点本补全正月起辰。
  // https://www.shidianguji.com/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7fxut
  const tables = {
    阳德: [...'戌子寅辰午申戌子寅辰午申'],
    阴德: [...'酉未巳卯丑亥酉未巳卯丑亥'],
    解神: [...'申申戌戌子子寅寅辰辰午午'],
    六仪: [...'辰卯寅丑子亥戌酉申未午巳'],
    时阳: [...'子丑寅卯辰巳午未申酉戌亥'],
    时阴: [...'午未申酉戌亥子丑寅卯辰巳'],
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
