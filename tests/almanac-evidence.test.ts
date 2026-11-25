import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { screenAlmanac } from '../src/systems/almanac/screening';

test('初筛保留明确和条件限制，不将缺少证据视为适宜', async () => {
  const empty = { support: [], caution: [], restriction: null };
  assert.equal(screenAlmanac(empty, '子', [], { scope: 'day' }).status, '需要核对');
  assert.equal(screenAlmanac(empty, '子', [], { scope: 'hour' }).status, '未见已列限制');
  assert.ok(screenAlmanac({ ...empty, support: ['入宅'] }, '子', [], { scope: 'day', noUsableHours: true }).reasons.some((reason) => reason.source === '时段限制'));
  assert.equal(screenAlmanac({ ...empty, caution: ['嫁娶'] }, '子', [], { scope: 'hour' }).status, '有明确限制');
  const result = await calculate('almanac', { question: '问题', topic: 'move', startDate: '2024-02-03', endDate: '2024-02-04', participants: [{ name: '甲', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'unknown' }, timezone: 8 } }] });
  const conditional = screenAlmanac(empty, '子', result.data.participants, { scope: 'hour' });
  assert.equal(conditional.status, '需要核对');
  assert.equal(conditional.reasons.find((reason) => reason.source === '参与人关系')?.strength, '条件提示');
  assert.equal(result.data.days[0].screening.reasons.some((reason: any) => reason.source === '四离四绝'), true);
  assert.equal(result.data.days[1].screening.reasons.some((reason: any) => reason.source === '交节'), true);
  assert.match(result.prompt.text, /逐时状态须与当日状态一并核对/);
  const saved = JSON.parse(JSON.stringify(result)); saved.data.days[0].gods[0].luck = '伪造';
  await assert.rejects(() => reprompt({ method: 'almanac', result: saved, question: '继续' }), /不一致/);
});

test('周末和时段偏好相互独立并明确标记', async () => {
  const base = { question: '问题', topic: 'move', startDate: '2024-02-03', endDate: '2024-02-05' };
  const result = await calculate('almanac', { ...base, weekendPreference: 'avoid', timePreferences: ['work-hours', 'morning'] });
  assert.equal(result.data.preferences.weekendPreference, 'avoid');
  assert.deepEqual(result.data.days.map((day: any) => day.preference.matchesWeekend), [false, false, true]);
  const hours = result.data.days[0].hours;
  assert.deepEqual(hours.filter((hour: any) => hour.preference.withinWorkHours).map((hour: any) => hour.name), ['巳时', '午时', '未时', '申时']);
  assert.deepEqual(hours.filter((hour: any) => hour.preference.preferredTime).map((hour: any) => hour.name), ['辰时', '巳时', '午时']);
  const weekendWork = await calculate('almanac', { ...base, weekendPreference: 'prefer', timePreferences: ['work-hours'] });
  assert.deepEqual(weekendWork.data.days.map((day: any) => day.preference.matchesWeekend), [true, true, false]);
  assert.equal(weekendWork.data.days[0].hours[5].preference.withinWorkHours, true);
});
