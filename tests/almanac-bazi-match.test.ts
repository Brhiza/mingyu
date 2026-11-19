import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';

test('almanac includeBaziMatch 结合精确出生八字喜用五行比对候选日与时辰并参与排序', async () => {
  const result = await calculate('almanac', {
    topic: 'opening',
    startDate: '2026-11-10',
    endDate: '2026-11-14',
    includeBaziMatch: true,
    participants: [
      {
        name: '甲方',
        gender: 'male',
        birth: {
          year: 1990,
          month: 1,
          day: 15,
          timezone: 8,
          clock: { kind: 'exact', hour: 8, minute: 0, second: 0 },
        },
      },
      {
        name: '乙方',
        birth: {
          year: 1994,
          month: 8,
          day: 20,
          timezone: 8,
          clock: { kind: 'unknown' },
        },
      },
    ],
    question: '这几天哪天更适合开业？',
  });

  const data = result.data as {
    participants: Array<{
      name: string;
      baziUsefulGod?: { favorable: string[]; primaryUnfavorable: string[]; unfavorable: string[] };
      baziUsefulGodNote?: string;
    }>;
    days: Array<{
      date: string;
      baziMatch?: { scoreDelta: number; summary: string };
      hours: Array<{ baziMatch?: { scoreDelta: number; summary: string } }>;
    }>;
    recommendations: { ranked: Array<{ date: string; baziMatchSummary?: string }> };
  };

  assert.ok(data.participants[0].baziUsefulGod, '精确出生参与人应计算八字喜用五行');
  assert.ok(data.participants[0].baziUsefulGod!.favorable.length > 0, '应包含喜用五行');
  assert.equal(data.participants[1].baziUsefulGod, undefined, '未知时辰不应强行定喜用');
  assert.ok(data.participants[1].baziUsefulGodNote?.includes('出生时刻未精确'));

  assert.equal(data.days.length, 5);
  for (const day of data.days) {
    assert.ok(day.baziMatch, `${day.date} 应包含八字喜忌比对结果`);
    assert.equal(typeof day.baziMatch!.scoreDelta, 'number');
    assert.ok(day.hours.every((h) => h.baziMatch !== undefined), '每个时辰也应包含八字喜忌比对');
  }
  assert.ok(data.recommendations.ranked.some((r) => typeof r.baziMatchSummary === 'string'));
  assert.match(result.prompt.text, /八字喜忌/);
});
