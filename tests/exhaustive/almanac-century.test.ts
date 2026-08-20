import assert from 'node:assert/strict';
import test from 'node:test';

import { generateAlmanacSelection } from '../../packages/core/src/divination/algorithms/almanac.ts';

const HOUR_BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
  '子',
];

test('黄历择日：1900 至 2100 每年四个关键日期的日课资料链不得断裂', () => {
  for (let year = 1900; year <= 2100; year += 1) {
    for (const monthDay of ['01-01', '02-04', '07-01', '12-31']) {
      const date = `${year}-${monthDay}`;
      const result = generateAlmanacSelection({
        topic: 'custom',
        startDate: date,
        endDate: date,
      });
      const candidate = result.days[0];
      const calendarFact = result.evidenceAnalysis?.candidates[0]?.calendarFact;

      assert.equal(candidate.date, date);
      assert.match(candidate.ganzhi.year, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      assert.match(candidate.ganzhi.month, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      assert.match(candidate.ganzhi.day, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      assert.ok(candidate.lunarDate);
      assert.equal(candidate.hours?.length, 13);
      assert.deepEqual(
        candidate.hours?.map((hour) => hour.branch),
        HOUR_BRANCHES,
      );
      assert.equal(candidate.annualDirectionGods?.length, 12);
      assert.equal(
        candidate.annualDirectionGods?.find((item) => item.god === '太岁')?.branch,
        candidate.ganzhi.year[1],
      );
      assert.match(calendarFact?.promptText || '', new RegExp(`年柱${candidate.ganzhi.year}`));
      assert.match(calendarFact?.promptText || '', new RegExp(`月柱${candidate.ganzhi.month}`));
      assert.match(calendarFact?.promptText || '', new RegExp(`日柱${candidate.ganzhi.day}`));
    }
  }
});
