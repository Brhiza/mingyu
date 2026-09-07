import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('大会小会覆盖校正后的完整月日组合', () => {
  // 《协纪辨方书》大会八日；小会依后按语改正二月、八月互误。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuifck
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuqi44
  const tables = {
    大会: ['甲戌', '乙酉', '', '', '丙午', '丁巳', '庚辰', '辛卯', '', '', '壬子', '癸亥'],
    小会: ['', '己卯', '戊辰', '己巳', '戊午', '', '', '己酉', '戊戌', '己亥', '戊子', ''],
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
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});
