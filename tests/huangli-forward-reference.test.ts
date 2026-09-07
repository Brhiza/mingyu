import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('天后天巫福德吉期天仓覆盖十二月六十日起例', () => {
  // 《御定星历考原》卷三：天仓正月寅逆行；福德天巫建前二辰；吉期建前一辰。
  // https://www.shidianguji.com/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // 天后正月申逆行四孟，与驿马同例。
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7d4px
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7dhd1
  const tables = {
    天后: [...'申巳寅亥申巳寅亥申巳寅亥'],
    天巫: [...'辰巳午未申酉戌亥子丑寅卯'],
    福德: [...'辰巳午未申酉戌亥子丑寅卯'],
    吉期: [...'卯辰巳午未申酉戌亥子丑寅'],
    天仓: [...'寅丑子亥戌酉申未午巳辰卯'],
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
