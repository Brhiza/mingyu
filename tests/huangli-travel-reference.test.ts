import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('归忌招摇往亡覆盖完整月日组合', () => {
  // 《历事明原》归忌孟丑仲寅季子，招摇辰逆十二支，往亡逐月历四孟、四仲、四季。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    归忌: [...'丑寅子丑寅子丑寅子丑寅子'],
    招摇: [...'辰卯寅丑子亥戌酉申未午巳'],
    往亡: [...'寅巳申亥卯午酉子辰未戌丑'],
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
