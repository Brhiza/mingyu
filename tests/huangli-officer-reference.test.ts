import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHuangliDayGods,
  getHuangliShensha,
  listHuangliShenshaNames,
} from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('成日归入十二建除而非独立凶神', () => {
  // 《协纪辨方书》从月建起建，十二日顺行，成居第九位。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuhq2c
  assert.equal(listHuangliShenshaNames().includes('成日'), false);
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++)
      assert.equal(
        getHuangliDayGods(pillar(month + 2), pillar(day)).some((god) => god.getName() === '成日'),
        false,
      );
  for (const [year, date] of [
    [2020, 23],
    [2021, 18],
    [2022, 13],
    [2023, 8],
  ]) {
    const info = getHuangliShensha(year, 9, date);
    assert.equal(info.duty, '成');
    assert.equal(
      info.shensha.some((god) => god.name === '成日'),
      false,
    );
    const dateKey = `${year}-09-${String(date).padStart(2, '0')}`;
    const day = generateAlmanacSelection({ topic: 'travel', startDate: dateKey, endDate: dateKey })
      .days[0];
    assert.equal(day.ganzhi.day, '己巳');
    assert.equal(day.gods.includes('成日'), false);
    assert.equal(
      day.godFacts?.some((fact) => fact.name === '成日'),
      false,
    );
  }
});
