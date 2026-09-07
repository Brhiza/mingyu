import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('大耗小时大煞劫煞死神游祸天火覆盖完整月日组合', () => {
  // 《历事明原》六项月神起例；天火依《协纪辨方书》三合对冲校正。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  // https://www.shidianguji.com/zh/mid-page/7430936655495921691
  const tables = {
    大耗: [...'申酉戌亥子丑寅卯辰巳午未'],
    小时: [...'寅卯辰巳午未申酉戌亥子丑'],
    大煞: [...'戌巳午未寅卯辰亥子丑申酉'],
    劫煞: [...'亥申巳寅亥申巳寅亥申巳寅'],
    死神: [...'巳午未申酉戌亥子丑寅卯辰'],
    游祸: [...'巳寅亥申巳寅亥申巳寅亥申'],
    天火: [...'子酉午卯子酉午卯子酉午卯'],
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
