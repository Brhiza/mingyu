import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('土符土府地火大败天吏覆盖完整月日组合', () => {
  // 《历事明原》土符逐月表，土府随月建，地火戌逆十二，大败卯逆四仲，天吏酉逆四仲。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    土符: [...'丑巳酉寅午戌卯未亥辰申子'],
    土府: [...'寅卯辰巳午未申酉戌亥子丑'],
    地火: [...'戌酉申未午巳辰卯寅丑子亥'],
    大败: [...'卯子酉午卯子酉午卯子酉午'],
    天吏: [...'酉午卯子酉午卯子酉午卯子'],
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
