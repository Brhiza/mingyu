import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBirthTimeSensitivity } from '../packages/core/src/bazi/birthTimeSensitivity.ts';

const basePerson = {
  gender: 'male' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 1,
  isLunar: false,
  useTrueSolarTime: true,
  birthLongitude: 120,
};

test('出生时间敏感性应通过候选盘识别时柱翻转', () => {
  const result = analyzeBirthTimeSensitivity(
    { ...basePerson, birthHour: 4, birthMinute: 0 },
    { uncertaintyMinutes: 5 },
  );

  assert.equal(result.samples.length, 3);
  assert.equal(result.isSensitive, true);
  assert.ok(result.changedPillars.includes('hour'));
  assert.equal(result.changes.find((item) => item.pillar === 'hour')?.candidates.length, 2);
  assert.match(result.baseline.nearestTimeBoundary, /^\d{2}:\d{2}$/);
  assert.ok(result.baseline.minutesToNearestTimeBoundary >= 0);
  assert.ok(result.baseline.minutesToNearestTimeBoundary <= 60);
  assert.match(result.promptText, /【八字出生时间敏感性结构化证据】/);
  assert.match(result.promptText, /最近时辰边界/);
  assert.match(result.promptText, /出生时间敏感性解释边界/);
});

test('出生时间远离边界时应明确四柱稳定且不生成总分', () => {
  const result = analyzeBirthTimeSensitivity(
    { ...basePerson, birthHour: 5, birthMinute: 0 },
    { uncertaintyMinutes: 5 },
  );

  assert.equal(result.isSensitive, false);
  assert.deepEqual(result.stablePillars, ['year', 'month', 'day', 'hour']);
  assert.doesNotMatch(result.promptText, /总分|稳定度：\d/);
});

test('出生时间敏感性应拒绝缺少精准时间或过大的误差范围', () => {
  assert.throws(
    () =>
      analyzeBirthTimeSensitivity({
        ...basePerson,
        useTrueSolarTime: false,
        birthHour: 3,
        birthMinute: 0,
      }),
    /需要启用真太阳时/,
  );
  assert.throws(
    () =>
      analyzeBirthTimeSensitivity(
        { ...basePerson, birthHour: 3, birthMinute: 0 },
        { uncertaintyMinutes: 121 },
      ),
    /1-120/,
  );
});
