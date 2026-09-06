import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('行狠了戾孤辰灾煞天狗覆盖完整月日组合', () => {
  // 《协纪辨方书》四月建孤辰起例、灾煞逆四仲及天狗仅申建戌满。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtujtx0
  // https://www.shidianguji.com/mid-page/7430936675293003786
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuhq2c
  const pillarTables = {
    行狠: ['', '', '甲申', '乙未', '', '', '', '', '庚寅', '辛丑', '', ''],
    了戾: ['', '', '丙申', '丁未', '', '', '', '', '壬寅', '癸丑', '', ''],
    孤辰: [
      '',
      '',
      '戊申庚申壬申',
      '己未辛未癸未',
      '',
      '',
      '',
      '',
      '甲寅丙寅戊寅',
      '乙丑丁丑己丑',
      '',
      '',
    ],
  };
  const branchTables = {
    灾煞: [...'子酉午卯子酉午卯子酉午卯'],
    天狗: ['', '', '', '', '', '', '戌', '', '', '', '', ''],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      for (const [tables, input] of [
        [pillarTables, pillar(day)],
        [branchTables, branches[day % 12]],
      ] as const)
        for (const [name, targets] of Object.entries(tables))
          assert.equal(
            names.includes(name),
            targets[month].includes(input),
            `${month + 1}月/${pillar(day)}/${name}`,
          );
    }
});
