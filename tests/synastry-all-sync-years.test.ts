import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

test('ziwei-synastry 与 astrolabe-synastry 均支持多年流运同步 (syncYears)', async () => {
  const ziweiRes = await calculate('ziwei-synastry', {
    question: '这两年紫微运限是否同步？',
    relationship: 'marriage',
    syncYears: { startYear: 2025, endYear: 2026 },
    person1: {
      name: '甲方',
      gender: 'male',
      birth: { year: 1990, month: 1, day: 15, timezone: 8, clock: { kind: 'exact', hour: 8, minute: 0, second: 0 } },
    },
    person2: {
      name: '乙方',
      gender: 'female',
      birth: { year: 1993, month: 6, day: 20, timezone: 8, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 } },
    },
  });
  const zwSync = (ziweiRes.data as any).annualSync;
  assert.ok(zwSync && zwSync.years.length === 2);
  assert.match(ziweiRes.prompt.text, /【多年大限与流年同步（2025–2026）】/);
  const zwReprompt = await reprompt({ method: 'ziwei-synastry', result: ziweiRes, question: '看2026年' });
  assert.match(zwReprompt.prompt.text, /2026年：/);

  const astroRes = await calculate('astrolabe-synastry', {
    question: '这两年外行星行运是否同步引动？',
    syncYears: { startYear: 2025, endYear: 2026 },
    person1: { year: 1990, month: 1, day: 15, hour: 8, minute: 0, second: 0, latitude: 39.9, longitude: 116.4, timezone: 8 },
    person2: { year: 1993, month: 6, day: 20, hour: 14, minute: 30, second: 0, latitude: 31.23, longitude: 121.47, timezone: 8 },
  });
  const astroSync = (astroRes.data as any).annualSync;
  assert.ok(astroSync && astroSync.years.length === 2);
  assert.match(astroRes.prompt.text, /【多年外行星行运同步（2025–2026）】/);
  const astroReprompt = await reprompt({ method: 'astrolabe-synastry', result: astroRes, question: '看2026年' });
  assert.match(astroReprompt.prompt.text, /2026年/);
});
