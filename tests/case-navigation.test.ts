import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCompatibilityCaseResultPath,
  buildPersonalCaseResultPath,
} from '../src/lib/case-navigation.ts';
import { defaultInputState, parseInputState, parsePromptState } from '../src/lib/query-state.ts';

test('打开个人案例时直接生成结果页链接并保留案例标识', () => {
  const path = buildPersonalCaseResultPath({
    id: 'case|1',
    type: 'single',
    name: '测试案例',
    gender: 'male',
    chartType: 'bazi',
    birthText: '2000-1-1',
    input: {
      ...defaultInputState,
      name: '测试案例',
      year: '2000',
      month: '1',
      day: '1',
      timeIndex: '1',
    },
    updatedAt: '2026-08-23T00:00:00.000Z',
  });

  const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));
  assert.equal(path.startsWith('/result?'), true);
  assert.equal(params.get('caseId'), 'case|1');
  assert.equal(parseInputState(params).analysisMode, 'single');
});

test('打开合盘案例时直接进入合盘结果', () => {
  const path = buildCompatibilityCaseResultPath({
    id: 'pair-1',
    type: 'compatibility',
    name: '甲 和 乙',
    primaryName: '甲',
    partnerName: '乙',
    input: {
      ...defaultInputState,
      analysisMode: 'compatibility',
      name: '甲',
      year: '1990',
      month: '1',
      day: '1',
      timeIndex: '1',
      partnerName: '乙',
      partnerYear: '1992',
      partnerMonth: '2',
      partnerDay: '2',
      partnerTimeIndex: '2',
    },
    updatedAt: '2026-08-23T00:00:00.000Z',
  });

  const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));
  assert.equal(params.get('caseId'), 'pair-1');
  assert.equal(parseInputState(params).analysisMode, 'compatibility');
  assert.equal(parsePromptState(params).baziPresetId, 'ai-compat-marriage');
});

test('从侧栏打开个人案例时切换到指定排盘类目', () => {
  const path = buildPersonalCaseResultPath(
    {
      id: 'case-2',
      type: 'single',
      name: '星命案例',
      gender: 'male',
      chartType: 'bazi',
      birthText: '2000-1-1',
      input: {
        ...defaultInputState,
        name: '星命案例',
        year: '2000',
        month: '1',
        day: '1',
        timeIndex: '1',
      },
      updatedAt: '2026-08-23T00:00:00.000Z',
    },
    'qizheng',
  );

  const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));
  assert.equal(parsePromptState(params).promptSource, 'qizheng');
  assert.equal(parseInputState(params).chartType, 'astrolabe');
});
