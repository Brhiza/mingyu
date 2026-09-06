import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('血支顺行与血忌隔月相冲覆盖完整月日组合', () => {
  // 《历事明原》血支正月丑顺行；血忌阳月丑至午、阴月未至子。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    血支: [...'丑寅卯辰巳午未申酉戌亥子'],
    血忌: [...'丑未寅申卯酉辰戌巳亥午子'],
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
