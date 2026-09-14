import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBaziHourPillarOptions,
  getBaziMonthPillarOptions,
  getSixtyCycle,
  isValidBaziPillarCombination,
  isValidGanZhi,
} from '../packages/core/src/ganzhi';
import { reverseBaziDates } from '../packages/core/src/calendar/bazi-reverse';

test('四柱选择项按五虎遁和五鼠遁生成合法六十甲子', () => {
  assert.deepEqual(getBaziMonthPillarOptions('甲子'), [
    '丙寅',
    '丁卯',
    '戊辰',
    '己巳',
    '庚午',
    '辛未',
    '壬申',
    '癸酉',
    '甲戌',
    '乙亥',
    '丙子',
    '丁丑',
  ]);
  assert.deepEqual(getBaziHourPillarOptions('甲子'), [
    '甲子',
    '乙丑',
    '丙寅',
    '丁卯',
    '戊辰',
    '己巳',
    '庚午',
    '辛未',
    '壬申',
    '癸酉',
    '甲戌',
    '乙亥',
  ]);

  for (const pillar of getSixtyCycle()) {
    assert.equal(getBaziMonthPillarOptions(pillar).length, 12);
    assert.equal(getBaziHourPillarOptions(pillar).length, 12);
    assert.ok(getBaziMonthPillarOptions(pillar).every(isValidGanZhi));
    assert.ok(getBaziHourPillarOptions(pillar).every(isValidGanZhi));
  }
});

test('四柱选择项会拒绝五虎遁或五鼠遁关系不成立的组合', () => {
  const valid = {
    year: '甲辰',
    month: '丙寅',
    day: '甲子',
    hour: '甲子',
  };
  assert.equal(isValidBaziPillarCombination(valid), true);
  assert.equal(isValidBaziPillarCombination({ ...valid, month: '甲子' }), false);
  assert.equal(isValidBaziPillarCombination({ ...valid, hour: '丙子' }), false);

  assert.throws(() => reverseBaziDates({ pillars: { ...valid, month: '甲子' } }), /五虎遁排月规则/);
  assert.throws(() => reverseBaziDates({ pillars: { ...valid, hour: '丙子' } }), /五鼠遁排时规则/);
});

test('结构合法但查询年份没有对应年柱时返回空候选', () => {
  const result = reverseBaziDates({
    pillars: {
      year: '甲子',
      month: '丙寅',
      day: '甲子',
      hour: '甲子',
    },
    startYear: 2024,
    endYear: 2024,
  });
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.candidates, []);
});
