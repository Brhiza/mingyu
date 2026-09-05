import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('六项黑道神与天贼致死覆盖完整月日组合', () => {
  // 《历事明原》逐月黑道起例；玄武在项目中称元武。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    天刑: [...'寅辰午申戌子寅辰午申戌子'],
    白虎: [...'午申戌子寅辰午申戌子寅辰'],
    天牢: [...'申戌子寅辰午申戌子寅辰午'],
    朱雀: [...'卯巳未酉亥丑卯巳未酉亥丑'],
    元武: [...'酉亥丑卯巳未酉亥丑卯巳未'],
    勾陈: [...'亥丑卯巳未酉亥丑卯巳未酉'],
    天贼: [...'丑子亥戌酉申未午巳辰卯寅'],
    致死: [...'酉午卯子酉午卯子酉午卯子'],
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
