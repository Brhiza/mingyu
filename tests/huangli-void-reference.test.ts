import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('九坎九焦逐月逆行与五虚四季表覆盖完整月日组合', () => {
  // 《协纪》九坎九焦正月辰逆四季、五月卯逆四仲、九月寅逆四孟。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llq0wznv37
  const monthly = [...'辰丑戌未卯子酉午寅亥申巳'];
  const seasonal = ['巳酉丑', '申子辰', '亥卯未', '寅午戌'];
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      for (const name of ['九坎', '九焦']) {
        assert.equal(
          names.includes(name),
          monthly[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
      assert.equal(
        names.includes('五虚'),
        seasonal[Math.floor(month / 3)].includes(branches[day % 12]),
        `${month + 1}月/${pillar(day)}/五虚`,
      );
    }
});
