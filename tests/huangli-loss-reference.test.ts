import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('月虚小耗大时咸池覆盖完整月日组合', () => {
  // 《历事明原》月虚丑逆四季，小耗月建前五辰，大时咸池卯逆四仲。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    月虚: [...'丑戌未辰丑戌未辰丑戌未辰'],
    小耗: [...'未申酉戌亥子丑寅卯辰巳午'],
    大时: [...'卯子酉午卯子酉午卯子酉午'],
    咸池: [...'卯子酉午卯子酉午卯子酉午'],
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
