import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('天愿采用协纪校正表，临日天医覆盖十二月六十日', () => {
  // 《协纪辨方书》先引天愿旧表，后按语明确校正传抄错误。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llq0wznv37
  // 《万年书》月吉神立成互证天愿，天医取成日，临日另列逐月表。
  // https://www.shidianguji.com/book/HY1447/chapter/1l3wfewr9um1y
  const wishes = [
    '乙亥',
    '甲戌',
    '乙酉',
    '丙申',
    '丁未',
    '戊午',
    '己巳',
    '庚辰',
    '辛卯',
    '壬寅',
    '癸丑',
    '甲子',
  ];
  const tables = {
    临日: [...'午亥申丑戌卯子巳寅未辰酉'],
    天医: [...'戌亥子丑寅卯辰巳午未申酉'],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const names = getHuangliDayGods(pillar(month + 2), dayPillar).map((god) => god.getName());
      assert.equal(
        names.includes('天愿'),
        wishes[month] === dayPillar,
        `${month + 1}月/${dayPillar}/天愿`,
      );
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});
