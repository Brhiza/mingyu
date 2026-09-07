import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('黄历建破刑害合覆盖十二月六十日原典关系', () => {
  // 《星历考原》月建月破、《协纪辨方书》三合、《选择天镜》月刑月害。
  // https://www.shidianguji.com/book/SK1618/chapter/1jursttoszeh6
  // https://www.shidianguji.com/book/SK1618/chapter/1jursttoszr4a
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llrodh22w8
  // https://www.shidianguji.com/mid-page/7460251407561932809
  // 六合仅对照地支配对，不采用六壬天将六合的含义。
  const tables = {
    月建: [...'寅卯辰巳午未申酉戌亥子丑'],
    月破: [...'申酉戌亥子丑寅卯辰巳午未'],
    月刑: [...'巳子辰申午丑寅酉未亥卯戌'],
    月害: [...'巳辰卯寅丑子亥戌酉申未午'],
    六合: [...'亥戌酉申未午巳辰卯寅丑子'],
    三合: [
      '午戌',
      '亥未',
      '申子',
      '酉丑',
      '寅戌',
      '亥卯',
      '子辰',
      '巳丑',
      '寅午',
      '卯未',
      '申辰',
      '巳酉',
    ],
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
