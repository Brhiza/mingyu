import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPersonalRecordPath,
  CHART_RECORD_PARAM,
  findRecentPersonalRecordForSource,
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

test('继续最近只打开当前工具自己的案例', () => {
  const baziRecord = createPersonalRecord({
    id: 'bazi-case',
    chartType: 'bazi',
    workspaceSource: 'bazi',
    input: {
      ...createPersonalRecord().input,
      chartType: 'bazi',
    },
  });
  const ziweiRecord = createPersonalRecord({
    id: 'ziwei-case',
    chartType: 'ziwei',
    workspaceSource: 'ziwei',
    pinned: true,
    input: {
      ...createPersonalRecord().input,
      chartType: 'ziwei',
    },
  });

  assert.equal(
    findRecentPersonalRecordForSource([ziweiRecord, baziRecord], 'bazi')?.id,
    'bazi-case',
  );
  assert.equal(findRecentPersonalRecordForSource([baziRecord], 'ziwei'), undefined);
});
