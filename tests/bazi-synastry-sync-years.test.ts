import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

test('bazi-synastry syncYears 支持双人多年流年同步对比与追问校验', async () => {
  const result = await calculate('bazi-synastry', {
    question: '这两三年两人流年节奏是否同步？',
    relationship: 'marriage',
    syncYears: { startYear: 2025, endYear: 2027 },
    person1: {
      name: '甲方',
      gender: 'male',
      year: 1990,
      month: 1,
      day: 15,
      timezone: 8,
      clock: { kind: 'exact', hour: 8, minute: 0, second: 0 },
    },
    person2: {
      name: '乙方',
      gender: 'female',
      year: 1993,
      month: 6,
      day: 20,
      timezone: 8,
      clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
    },
  });

  const sync = (result.data as any).compatibility.annualSync;
  assert.ok(sync, '应生成 annualSync');
  assert.equal(sync.years.length, 3);
  assert.deepEqual(sync.years.map((y: any) => y.year), [2025, 2026, 2027]);
  assert.ok(sync.years.every((y: any) => ['同向顺遂', '一方承压', '同步承压', '中性并行'].includes(y.syncAssessment)));
  assert.match(result.prompt.text, /【双方多年流年同步（2025–2027）】/);

  const reprompted = await reprompt({
    method: 'bazi-synastry',
    result,
    question: '重点看2026年',
  });
  assert.match(reprompted.prompt.text, /2026 丙午年/);
});
