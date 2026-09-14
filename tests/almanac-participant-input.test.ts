import assert from 'node:assert/strict';
import test from 'node:test';

import type { AlmanacParticipantInput } from '@core/types/divination';
import { updateAlmanacParticipantField } from '../src/lib/divination/almanac-participants';

const PARTICIPANT: AlmanacParticipantInput = {
  id: 'case:1',
  name: '本人',
  gender: '男',
  year: '1990',
  month: '1',
  day: '2',
  timeIndex: '4',
  dateType: 'solar',
  birthHour: '09',
  birthMinute: '18',
  birthSecond: '27',
  birthPlace: '上海',
  birthLongitude: '121.47',
  useTrueSolarTime: true,
};

test('参与人改选时辰后应清除案例遗留的精确时刻与真太阳时来源', () => {
  const updated = updateAlmanacParticipantField(PARTICIPANT, 'timeIndex', '8');

  assert.equal(updated.timeIndex, '8');
  assert.equal(updated.birthHour, undefined);
  assert.equal(updated.birthMinute, undefined);
  assert.equal(updated.birthSecond, undefined);
  assert.equal(updated.useTrueSolarTime, undefined);
  assert.equal(updated.birthPlace, '上海');
  assert.equal(updated.birthLongitude, '121.47');
});

test('参与人修改出生日期时保留精确时刻并交给新日期重新计算', () => {
  const updated = updateAlmanacParticipantField(PARTICIPANT, 'day', '3');

  assert.equal(updated.day, '3');
  assert.equal(updated.birthHour, '09');
  assert.equal(updated.birthMinute, '18');
  assert.equal(updated.birthSecond, '27');
  assert.equal(updated.useTrueSolarTime, true);
});
