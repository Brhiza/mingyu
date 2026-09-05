import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('八龙七鸟九虎六蛇八专触水龙覆盖完整月日组合', () => {
  // 《协纪辨方书》四季八龙等起例、八专五日及触水龙三日。
  // https://www.shidianguji.com/mid-page/7430936675263742002
  // https://www.shidianguji.com/mid-page/7430936675339223090
  const tables = {
    八龙: ['甲子乙亥', '甲子乙亥', '甲子乙亥', '', '', '', '', '', '', '', '', ''],
    七鸟: ['', '', '', '丙子丁亥', '丙子丁亥', '丙子丁亥', '', '', '', '', '', ''],
    九虎: ['', '', '', '', '', '', '庚子辛亥', '庚子辛亥', '庚子辛亥', '', '', ''],
    六蛇: ['', '', '', '', '', '', '', '', '', '壬子癸亥', '壬子癸亥', '壬子癸亥'],
    八专: Array(12).fill('甲寅丁未己未庚申癸丑'),
    触水龙: Array(12).fill('丙子癸未癸丑'),
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
