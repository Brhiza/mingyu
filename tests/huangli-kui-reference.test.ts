import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('重日天罡河魁覆盖完整月日组合', () => {
  // 《选择历书》巳亥重日；《协纪辨方书》阳月罡前三魁后三，阴月反之。
  // https://www.shidianguji.com/mid-page/7589028950699130890
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuhq2c
  const tables = {
    重日: Array<string>(12).fill('巳亥'),
    天罡: [...'巳子未寅酉辰亥午丑申卯戌'],
    河魁: [...'亥午丑申卯戌巳子未寅酉辰'],
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
          targets[month].includes(branches[day % 12]),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});
