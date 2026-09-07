import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods, listHuangliShenshaNames } from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('解除为择日事项而非独立吉神', () => {
  // 《御定星历考原》解除事项另以解神、除神、建除等判断。
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstvfxeof9
  const catalog = listHuangliShenshaNames();
  assert.equal(catalog.includes('解除'), false);
  assert.equal(catalog.includes('解神'), true);
  assert.equal(catalog.includes('除神'), true);
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++)
      assert.equal(
        getHuangliDayGods(pillar(month + 2), pillar(day)).some((god) => god.getName() === '解除'),
        false,
      );
  for (const date of ['2020-12-17', '2021-12-12', '2022-12-07', '2029-12-30', '2030-12-25']) {
    const day = generateAlmanacSelection({ topic: 'travel', startDate: date, endDate: date })
      .days[0];
    assert.equal(day.ganzhi.day, '甲午');
    assert.equal(day.gods.includes('解除'), false);
    assert.equal(
      day.godFacts?.some((fact) => fact.name === '解除'),
      false,
    );
    assert.deepEqual(day.recommends, ['祭祀', '求医', '破屋', '坏垣', '馀事勿取']);
    assert.deepEqual(day.avoids, ['诸事不宜']);
  }
});
