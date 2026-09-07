import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('八风地囊覆盖完整月日组合', () => {
  // 《协纪辨方书》八风与地囊校正表。
  // https://www.shidianguji.com/zh/mid-page/7430936655495921691
  const tables = {
    八风: [
      '丁丑丁巳',
      '丁丑丁巳',
      '丁丑丁巳',
      '甲申甲辰',
      '甲申甲辰',
      '甲申甲辰',
      '丁亥丁未',
      '丁亥丁未',
      '丁亥丁未',
      '甲寅甲戌',
      '甲寅甲戌',
      '甲寅甲戌',
    ],
    地囊: [
      '庚子庚午',
      '乙未癸丑',
      '甲子壬午',
      '己卯己酉',
      '壬戌甲辰',
      '丙辰丙戌',
      '丁巳丁亥',
      '丙寅丙申',
      '辛丑辛未',
      '戊寅戊申',
      '辛卯辛酉',
      '癸酉乙卯',
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
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});
