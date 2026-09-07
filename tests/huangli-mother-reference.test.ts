import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliShensha } from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('母仓按四季生我之支及四立前十八日覆盖全年', () => {
  // 《协纪辨方书》母仓起例；《历事明原》卷五四立前十八日土王用事。
  // 2026年四立民用日期：2月4日、5月5日、8月7日、11月7日。
  // https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i4uxkra2
  const starts = [
    '2025-11-07',
    '2026-02-04',
    '2026-05-05',
    '2026-08-07',
    '2026-11-07',
    '2027-02-04',
  ].map(Date.parse);
  const branchesBySeason = ['申酉', '亥子', '寅卯', '辰戌丑未', '申酉'];
  const dayMs = 86400000;
  const anchor = Date.UTC(2000, 0, 7);
  for (let offset = 0; offset < 365; offset++) {
    const time = Date.UTC(2026, 0, 1) + offset * dayMs;
    const date = new Date(time);
    const season = starts.findIndex((start, index) => time >= start && time < starts[index + 1]);
    const earthPeriod = starts[season + 1] - time <= 18 * dayMs;
    const dayBranch = [...'子丑寅卯辰巳午未申酉戌亥'][((time - anchor) / dayMs) % 12];
    const expected = (earthPeriod ? '巳午' : branchesBySeason[season]).includes(dayBranch);
    const actual = getHuangliShensha(2026, date.getUTCMonth() + 1, date.getUTCDate()).shensha.some(
      (god) => god.name === '母仓',
    );
    assert.equal(actual, expected, date.toISOString().slice(0, 10));
  }
});

test('土王阶段母仓巳午日及原季节误列在择日结果中同步修正', () => {
  for (const [date, expected] of [
    ['2026-01-19', true],
    ['2026-01-20', true],
    ['2026-01-22', false],
    ['2026-04-20', false],
    ['2026-10-22', true],
    ['2027-01-17', false],
  ] as const) {
    const day = generateAlmanacSelection({ topic: 'travel', startDate: date, endDate: date })
      .days[0];
    assert.equal(day.gods.includes('母仓'), expected, date);
    assert.equal(
      day.godFacts?.some((fact) => fact.name === '母仓' && fact.classification === '吉神'),
      expected,
      date,
    );
  }
});
