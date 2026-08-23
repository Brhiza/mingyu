import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChartFeaturePathForCase,
  buildPersonalRecordPath,
  CHART_RECORD_PARAM,
  normalizeChartInputForSource,
  preserveChartRecordId,
  resolvePersonalRecordSource,
} from '../src/lib/case-navigation';
import type { PersonalHistoryRecord } from '../src/lib/history-records';
import { defaultInputState, parseInputState, parsePromptState } from '../src/lib/query-state';

function createPersonalRecord(
  overrides: Partial<PersonalHistoryRecord> = {},
): PersonalHistoryRecord {
  const input = {
    ...defaultInputState,
    chartType: 'astrolabe' as const,
    name: '测试',
    year: '2000',
    month: '1',
    day: '1',
    timeIndex: 0 as const,
  };
  return {
    id: 'case-1',
    type: 'single',
    name: '测试',
    gender: 'male',
    chartType: 'astrolabe',
    workspaceSource: 'astrolabe',
    birthText: '2000-1-1',
    input,
    updatedAt: '2026-08-23T00:00:00.000Z',
    ...overrides,
  };
}

test('不完整的旧星盘案例应直接打开可生成的八字结果', () => {
  const record = createPersonalRecord();
  assert.equal(resolvePersonalRecordSource(record), 'bazi');

  const path = buildPersonalRecordPath(record);
  const params = new URLSearchParams(path.split('?')[1]);
  assert.equal(params.get(CHART_RECORD_PARAM), record.id);
  assert.equal(parseInputState(params).chartType, 'bazi');
  assert.deepEqual(parsePromptState(params), {
    ...parsePromptState(new URLSearchParams()),
    tab: 'bazi',
    promptSource: 'bazi',
  });
});

test('完整星盘案例应保留来源并携带稳定案例标识', () => {
  const record = createPersonalRecord({
    input: {
      ...createPersonalRecord().input,
      useTrueSolarTime: true,
      birthHour: '12',
      birthMinute: '30',
      birthPlace: '北京',
      birthLongitude: '116.4',
      birthLatitude: '39.9',
    },
  });
  assert.equal(resolvePersonalRecordSource(record), 'astrolabe');

  const params = new URLSearchParams(buildPersonalRecordPath(record).split('?')[1]);
  const prompt = parsePromptState(params);
  assert.equal(prompt.tab, 'astrolabe');
  assert.equal(prompt.promptSource, 'astrolabe');
  assert.equal(params.get(CHART_RECORD_PARAM), record.id);
});

test('切换盘面或解读时应保留当前案例标识', () => {
  const current = new URLSearchParams('rid=case-1&t=bazi');
  const next = preserveChartRecordId('t=prompt', current);
  assert.equal(next.get(CHART_RECORD_PARAM), 'case-1');
  assert.equal(next.get('t'), 'prompt');
});

test('按实际工具归一化旧案例中的内部排盘类型', () => {
  const legacyInput = createPersonalRecord().input;
  assert.equal(normalizeChartInputForSource(legacyInput, 'bazi').chartType, 'bazi');
  assert.equal(normalizeChartInputForSource(legacyInput, 'ziwei').chartType, 'ziwei');
  assert.deepEqual(normalizeChartInputForSource(legacyInput, 'qizheng'), {
    ...legacyInput,
    chartType: 'astrolabe',
    useTrueSolarTime: true,
  });
  assert.equal(
    normalizeChartInputForSource({ ...legacyInput, useTrueSolarTime: true }, 'bazi')
      .useTrueSolarTime,
    false,
  );
});

test('全局案例应按所选命盘直接打开结果', () => {
  const params = new URLSearchParams(
    buildChartFeaturePathForCase(createPersonalRecord(), 'ziwei').split('?')[1],
  );
  assert.equal(params.get(CHART_RECORD_PARAM), 'case-1');
  assert.equal(parsePromptState(params).promptSource, 'ziwei');
  assert.equal(parseInputState(params).chartType, 'ziwei');
});

test('资料不足的精准命盘应打开已预填的输入页', () => {
  const path = buildChartFeaturePathForCase(createPersonalRecord(), 'astrolabe');
  assert.equal(path.startsWith('/chart/astrolabe?'), true);
  const params = new URLSearchParams(path.split('?')[1]);
  assert.equal(params.get(CHART_RECORD_PARAM), 'case-1');
  assert.equal(parseInputState(params).name, '测试');
});

test('合盘应把全局案例预填为第一人', () => {
  const path = buildChartFeaturePathForCase(createPersonalRecord(), 'compatibility');
  assert.equal(path.startsWith('/chart/compatibility?'), true);
  const params = new URLSearchParams(path.split('?')[1]);
  assert.equal(parseInputState(params).analysisMode, 'compatibility');
  assert.equal(parseInputState(params).name, '测试');
});
