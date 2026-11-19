import assert from 'node:assert/strict';
import test from 'node:test';
import { mountains } from '../src/systems/compass';
import { calculateXuanKongPlate, flyStars, resolvePeriod } from '../src/systems/xuankong/foundation';
import { dayFlyingStar, hourFlyingStar, monthFlyingStar } from '../src/systems/xuankong/flow';
import { castleGate } from '../src/systems/xuankong/castle-gate';


test('九星顺逆飞布、三元运期和城门结构保持完整', () => {
  assert.deepEqual(flyStars(5, '顺飞'), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(flyStars(5, '逆飞'), [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  for (let star = 1; star <= 9; star++) for (const direction of ['顺飞', '逆飞'] as const) {
    assert.deepEqual([...flyStars(star, direction)].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  assert.deepEqual([resolvePeriod(2023).yun, resolvePeriod(2024).yun, resolvePeriod(2043).yun, resolvePeriod(2044).yun], [8, 9, 9, 1]);
  assert.equal(resolvePeriod(2024).boundaryUncertain, true);
  for (let yun = 1; yun <= 9; yun++) for (const mountain of mountains) {
    const gate = castleGate(yun, mountain);
    assert.equal(gate.candidates.length, 2);
    assert.equal(gate.hasWangStarGate, gate.candidates.some((item) => item.arrivalStar === yun));
  }
  assert.throws(() => castleGate(9, '错'));
  assert.throws(() => calculateXuanKongPlate(2024, '错', '下卦'));
  assert.throws(() => flyStars(0, '顺飞'));
  assert.throws(() => monthFlyingStar(2024, 2, 30));
});

test('自研玄空下卦与替卦排盘覆盖全部九运二十四山且格局检测准确', () => {
  const formations = new Set<string>();
  const combinationNames = new Set<string>();
  for (let yun = 1; yun <= 9; yun++) {
    const year = 1864 + (yun - 1) * 20 + 5;
    for (const sit of mountains) {
      for (const mode of ['下卦', '替卦'] as const) {
        const plate = calculateXuanKongPlate(year, sit, mode);
        assert.equal(plate.period.yun, yun);
        assert.equal(plate.palaces.length, 9);
        assert.deepEqual(plate.palaces.map((p) => p.earth), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        if (mode === '下卦') formations.add(plate.formation);
        for (const c of plate.combinations) combinationNames.add(c.name);
      }
    }
  }
  assert.deepEqual(
    [...formations].sort(),
    ['上山下水', '双星到向', '双星到坐', '旺山旺向'],
  );
  assert.ok(combinationNames.has('父母三般卦'));
  assert.ok(combinationNames.has('连珠三般卦'));
  assert.ok(combinationNames.has('山星合十'));
  assert.ok(combinationNames.has('向星合十'));
  assert.ok(combinationNames.has('七星真打劫'));
  assert.ok(combinationNames.has('七星假打劫'));
  assert.ok(combinationNames.has('山星入囚'));
  assert.ok(combinationNames.has('向星入囚'));

  const eightZiWu = calculateXuanKongPlate(2008, '子', '下卦');
  assert.equal(eightZiWu.formation, '双星到向');
  assert.ok(eightZiWu.combinations.some((c) => c.name === '七星真打劫' && c.kind === 'auspicious'));

  const eightWeiChou = calculateXuanKongPlate(2008, '未', '下卦');
  assert.equal(eightWeiChou.formation, '旺山旺向');
  assert.deepEqual(eightWeiChou.arrival, { shanToMountain: true, xiangToFacing: true });

  const yangDay = dayFlyingStar(2024, 12, 25);
  assert.equal(yangDay.direction, '顺飞');
  assert.equal(yangDay.plate.length, 9);
  const yinDay = dayFlyingStar(2024, 6, 25);
  assert.equal(yinDay.direction, '逆飞');
  const yangHour = hourFlyingStar(2024, 12, 25, 10);
  assert.equal(yangHour.direction, '顺飞');
  const yinHour = hourFlyingStar(2024, 6, 25, 10);
  assert.equal(yinHour.direction, '逆飞');
});
