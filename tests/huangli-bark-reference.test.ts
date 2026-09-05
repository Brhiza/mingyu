import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('鸣吠十三日与鸣吠对十一日按协纪最终校正覆盖全部月日组合', () => {
  // 《协纪》先引十四日、十日旧表，末按语及图明确改为十三日、十一日。
  // https://www.shidianguji.com/ens/book/SK1619/chapter/1l9llq0wzokdf
  const tables = {
    鸣吠: [
      '甲午',
      '丙午',
      '庚午',
      '壬午',
      '甲申',
      '丙申',
      '庚申',
      '壬申',
      '乙酉',
      '丁酉',
      '己酉',
      '辛酉',
      '癸酉',
    ],
    鸣吠对: [
      '甲寅',
      '丙寅',
      '庚寅',
      '壬寅',
      '乙卯',
      '丁卯',
      '辛卯',
      '癸卯',
      '丙子',
      '庚子',
      '壬子',
    ],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const names = getHuangliDayGods(pillar(month + 2), dayPillar).map((god) => god.getName());
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets.includes(dayPillar),
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});
