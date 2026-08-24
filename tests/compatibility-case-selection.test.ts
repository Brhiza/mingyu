import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPersonalCaseToCompatibilityPerson } from '../src/lib/compatibility-case-selection';
import { defaultInputState } from '../src/lib/query-state';
import type { PersonalHistoryRecord } from '../src/lib/history-records';

const selectedCase: PersonalHistoryRecord = {
  id: 'case-a',
  type: 'single',
  name: '案例甲',
  gender: 'female',
  chartType: 'bazi',
  birthText: '农历 1998-08-18 酉时',
  input: {
    ...defaultInputState,
    name: '',
    gender: 'female',
    dateType: 'lunar',
    year: '1998',
    month: '8',
    day: '18',
    timeIndex: 9,
    isLeapMonth: true,
    useTrueSolarTime: true,
    birthHour: '18',
    birthMinute: '25',
    birthPlace: '广东省深圳市',
    birthLongitude: '114.0579',
    birthLatitude: '22.5431',
  },
  updatedAt: '2026-08-24T00:00:00.000Z',
};

test('选择本人案例只替换合盘中的本人资料', () => {
  const current = {
    ...defaultInputState,
    analysisMode: 'compatibility' as const,
    chartType: 'ziwei' as const,
    partnerName: '保留的对方',
    partnerYear: '2001',
    partnerMonth: '2',
    partnerDay: '3',
  };
  const result = applyPersonalCaseToCompatibilityPerson(current, selectedCase, 'self');

  assert.equal(result.name, '案例甲');
  assert.equal(result.dateType, 'lunar');
  assert.equal(result.isLeapMonth, true);
  assert.equal(result.birthLongitude, '114.0579');
  assert.equal(result.partnerName, '保留的对方');
  assert.equal(result.partnerYear, '2001');
  assert.equal(result.analysisMode, 'compatibility');
  assert.equal(result.chartType, 'ziwei');
});

test('选择对方案例只替换合盘中的对方资料', () => {
  const current = {
    ...defaultInputState,
    analysisMode: 'compatibility' as const,
    name: '保留的本人',
    year: '2000',
    month: '1',
    day: '2',
  };
  const result = applyPersonalCaseToCompatibilityPerson(current, selectedCase, 'partner');

  assert.equal(result.partnerName, '案例甲');
  assert.equal(result.partnerGender, 'female');
  assert.equal(result.partnerDateType, 'lunar');
  assert.equal(result.partnerIsLeapMonth, true);
  assert.equal(result.partnerBirthPlace, '广东省深圳市');
  assert.equal(result.name, '保留的本人');
  assert.equal(result.year, '2000');
});
