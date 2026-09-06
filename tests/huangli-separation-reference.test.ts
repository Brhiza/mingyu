import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods, getHuangliShensha } from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('四离按香港天文台分至日期前一日覆盖全年', () => {
  // 《协纪辨方书》四离为二分二至各前一日。
  // https://www.shidianguji.com/mid-page/7430936675339223090
  // https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
  const expected = new Set(['2026-03-19', '2026-06-20', '2026-09-22', '2026-12-21']);
  for (let offset = 0; offset < 365; offset++) {
    const date = new Date(Date.UTC(2026, 0, 1) + offset * 86400000);
    const actual = getHuangliShensha(2026, date.getUTCMonth() + 1, date.getUTCDate());
    const iso = date.toISOString().slice(0, 10);
    assert.equal(
      actual.shensha.some((god) => god.name === '四离'),
      expected.has(iso),
      iso,
    );
  }
});

test('四离需具体日期且择日入口保留凶神分类', () => {
  assert.equal(
    getHuangliDayGods('甲子', '己丑').some((god) => god.getName() === '四离'),
    false,
  );
  const day = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-03-19',
    endDate: '2026-03-19',
  }).days[0];
  assert.equal(day.godFacts?.find((fact) => fact.name === '四离')?.classification, '凶神');
});
