import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInputSearch,
  buildResultSearch,
  defaultInputState,
  defaultPromptState,
  parseInputState,
} from '../src/lib/query-state';

test('输入页默认状态不应预填生日与时辰', () => {
  assert.equal(defaultInputState.year, '');
  assert.equal(defaultInputState.month, '');
  assert.equal(defaultInputState.day, '');
  assert.equal(defaultInputState.timeIndex, '');
  assert.equal(defaultInputState.birthHour, '');
  assert.equal(defaultInputState.birthMinute, '');

  assert.equal(defaultInputState.partnerYear, '');
  assert.equal(defaultInputState.partnerMonth, '');
  assert.equal(defaultInputState.partnerDay, '');
  assert.equal(defaultInputState.partnerTimeIndex, '');
  assert.equal(defaultInputState.partnerBirthHour, '');
  assert.equal(defaultInputState.partnerBirthMinute, '');
});

test('空查询参数不应把空时辰解析成 0', () => {
  const inputState = parseInputState(new URLSearchParams('timeIndex=&partnerTimeIndex='));

  assert.equal(inputState.timeIndex, '');
  assert.equal(inputState.partnerTimeIndex, '');
});

test('结果页默认应直接打开提示词页', () => {
  assert.equal(defaultPromptState.tab, 'prompt');
});

test('仅切换 AI 提示词参数时，输入参数快照应保持不变', () => {
  const baseParams = new URLSearchParams({
    analysisMode: 'single',
    name: '张三',
    gender: 'male',
    year: '1990',
    month: '08',
    day: '16',
    timeIndex: '5',
    tab: 'prompt',
    promptSource: 'bazi',
    baziQuickQuestion: '先看整体',
  });
  const nextParams = new URLSearchParams(baseParams);

  nextParams.set('baziQuickQuestion', '重点看事业');
  nextParams.set('baziPresetId', 'ai-career');
  nextParams.set('ziweiTopic', 'career-wealth');

  assert.equal(buildInputSearch(baseParams), buildInputSearch(nextParams));
});

test('结果页地址栏不应写入自定义问题正文，但会保留快捷模式', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    baziShortcutMode: '事业',
    baziQuickQuestion: '我今年适合跳槽吗',
    ziweiShortcutMode: '自定义',
    ziweiQuickQuestion: '我最近要不要主动推进关系',
  });

  assert.doesNotMatch(search, /baziQuickQuestion=/);
  assert.doesNotMatch(search, /ziweiQuickQuestion=/);
  assert.match(search, /baziShortcutMode=/);
  assert.match(search, /ziweiShortcutMode=/);
});
