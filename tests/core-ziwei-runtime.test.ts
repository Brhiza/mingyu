import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildZiweiChartInput,
  calculateZiweiChart,
  calculateZiweiPayloadByScope,
} from 'mingyu-core/ziwei/runtime';
import { buildSerializableZiweiResult } from 'mingyu-core/ziwei';
import { buildZiweiFortuneOptions } from 'mingyu-core/ziwei/fortune';

const baseDraft = {
  name: '核心包紫微运行时样例',
  gender: 'female' as const,
  dateType: 'solar' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 4,
  isLeapMonth: false,
};

test('npm 紫微运行时应接受数字输入并生成严格 ChartInput', () => {
  const input = buildZiweiChartInput(baseDraft);

  assert.deepEqual(input, {
    name: '核心包紫微运行时样例',
    gender: '女',
    dateType: 'solar',
    birthDate: '1990-05-15',
    birthTimeIndex: 4,
    isLeapMonth: false,
    fixLeap: true,
    algorithm: 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
    dayDivide: 'forward',
  });
});

test('npm 紫微运行时应支持固定运限时刻和指定范围', async () => {
  const input = buildZiweiChartInput(baseDraft);
  const options = {
    scopes: ['origin', 'yearly'] as const,
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
  };
  const first = await calculateZiweiChart(input, options);
  const second = await calculateZiweiChart(input, options);

  assert.deepEqual(Object.keys(first.payloadByScope), ['origin', 'yearly']);
  assert.deepEqual(first.horoscopeContext, { dateStr: '2026-08-06', hourIndex: 4 });
  assert.deepEqual(first.payloadByScope, second.payloadByScope);
  assert.equal(first.payloadByScope.origin.evidence_pool.length, 0);
  assert.equal(first.payloadByScope.yearly.active_scope.scope, 'yearly');
  assert.equal(first.decadalTimeline.length > 0, true);

  const serializable = buildSerializableZiweiResult(first);
  assert.equal(serializable.scopeNames.includes('origin'), true);
  assert.equal(serializable.gongList.length, 12);
  assert.equal(serializable.五行局, first.payloadByScope.origin.basic_info.five_elements_class);
  assert.equal(typeof serializable.命宫, 'string');
  assert.equal(typeof serializable.身宫, 'string');
  assert.deepEqual(serializable.四化, serializable.fourMutagens);
});

test('npm 紫微资料便捷入口应保留指定范围并返回结构化 payload', async () => {
  const input = buildZiweiChartInput({ ...baseDraft, timeIndex: 5 });
  const payloadByScope = await calculateZiweiPayloadByScope(input, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 5 },
  });

  assert.deepEqual(Object.keys(payloadByScope), ['origin']);
  assert.equal(payloadByScope.origin.payload_version, 'analysis_payload_v1');
  assert.equal(payloadByScope.origin.active_scope.scope, 'origin');
});

test('npm 紫微运行时应将真太阳时结果转换为公历日期和时辰', () => {
  const input = buildZiweiChartInput({
    ...baseDraft,
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: '',
    useTrueSolarTime: true,
    birthHour: '0',
    birthMinute: '5',
    birthLongitude: '75',
    timezone: 8,
  });

  assert.equal(input.dateType, 'solar');
  assert.equal(input.isLeapMonth, false);
  assert.equal(input.trueSolarEvidence?.summaryFact.status, '证据链完整');
  assert.equal(Number.isInteger(input.birthTimeIndex), true);
});

test('npm 紫微运限便捷入口应一次生成流年、流月和流日选项', async () => {
  const input = buildZiweiChartInput(baseDraft);
  const options = await buildZiweiFortuneOptions(input, { startAge: 1, endAge: 1 });

  assert.equal(options.yearOptions.length, 1);
  assert.equal(options.yearOptions[0]?.age, 1);
  assert.equal(options.yearOptions[0]?.ganZhi.length, 2);
  assert.equal(options.monthOptions.length, 12);
  assert.equal(options.dayOptions.length, 31);
  assert.equal(options.effectiveYearDateStr, options.yearOptions[0]?.dateStr);
  assert.equal(options.effectiveMonthDateStr, options.monthOptions[0]?.dateStr);
});
