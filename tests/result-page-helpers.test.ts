import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaziZiweiEnhancedPrompt,
  buildAstrolabeFullScopePromptText,
  getZiweiDisplaySurroundedPalaces,
  buildZiweiMonthAnchorDate,
  findZiweiDayOptionDate,
  findZiweiDecadalIndexByDate,
  findZiweiMonthOptionDate,
  findZiweiYearOptionDate,
  formatBaziFullFortuneText,
  formatZiweiFullScopeText,
  formatZiweiPromptScopeSummary,
  mapBaziFortuneToZiweiScope,
  parseOptionalNumber,
  parseZiweiDateParts,
  readPromptDraft,
  resolveZiweiTopicByBaziShortcutMode,
  resolveCompatType,
  writePromptDraft,
} from '../src/pages/ResultPage/ResultPage.helpers';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { buildZiweiChartInput, calculateFullZiweiChart } from '../src/lib/full-chart-engine/ziwei';
import type { AnalysisPayloadV1 } from '../src/types/analysis';
import { PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT } from '../src/lib/prompt-guidance';
import { assertPromptHasSingleRole } from './prompt-assertions';

test('parseZiweiDateParts 正确解析合法日期', () => {
  assert.deepEqual(parseZiweiDateParts('2024-05-13'), { year: 2024, month: 5, day: 13 });
  assert.deepEqual(parseZiweiDateParts('1990-12-01'), { year: 1990, month: 12, day: 1 });
  assert.deepEqual(parseZiweiDateParts('2101-02-28'), { year: 2101, month: 2, day: 28 });
});

test('八字排盘入口应拒绝空白数字文本而不是宽松转成 0', () => {
  assert.throws(
    () =>
      buildPersonFromInput({
        gender: 'male',
        dateType: 'solar',
        year: ' ',
        month: '5',
        day: '15',
        timeIndex: 1,
        isLeapMonth: false,
        useTrueSolarTime: false,
        birthHour: '',
        birthMinute: '',
        birthPlace: '',
        birthLongitude: '',
      }),
    /出生年份必须是整数/,
  );

  assert.throws(
    () =>
      buildPersonFromInput({
        gender: 'male',
        dateType: 'solar',
        year: '1990',
        month: '5',
        day: '15',
        timeIndex: ' ' as unknown as number,
        isLeapMonth: false,
        useTrueSolarTime: false,
        birthHour: '',
        birthMinute: '',
        birthPlace: '',
        birthLongitude: '',
      }),
    /出生时辰必须是整数/,
  );
});

test('parseZiweiDateParts 对非法日期返回 null', () => {
  assert.equal(parseZiweiDateParts(''), null);
  assert.equal(parseZiweiDateParts('invalid'), null);
  assert.equal(parseZiweiDateParts('2024--01'), null);
  assert.equal(parseZiweiDateParts('2024-2-01'), null);
  assert.equal(parseZiweiDateParts('2024-13-01'), null);
  assert.equal(parseZiweiDateParts('2024-02-31'), null);
  assert.equal(parseZiweiDateParts('1899-01-01'), null);
  assert.equal(parseZiweiDateParts('2201-01-01'), null);
});

test('buildZiweiMonthAnchorDate 返回月中日期', () => {
  assert.equal(buildZiweiMonthAnchorDate('2024-05-13'), '2024-05-15');
  assert.equal(buildZiweiMonthAnchorDate('2024-01-01'), '2024-01-15');
  assert.equal(buildZiweiMonthAnchorDate('2101-02-28'), '2101-02-15');
  assert.equal(buildZiweiMonthAnchorDate('invalid'), '');
  assert.equal(buildZiweiMonthAnchorDate('2024-02-31'), '');
});

test('findZiweiDecadalIndexByDate 按日期范围查找大限索引', () => {
  const options = [
    { dateStr: '2000-01-01', label: '0-9' },
    { dateStr: '2010-01-01', label: '10-19' },
    { dateStr: '2020-01-01', label: '20-29' },
  ] as Parameters<typeof findZiweiDecadalIndexByDate>[0];

  assert.equal(findZiweiDecadalIndexByDate(options, '2005-06-01', 0), 0);
  assert.equal(findZiweiDecadalIndexByDate(options, '2015-06-01', 0), 1);
  assert.equal(findZiweiDecadalIndexByDate(options, '2025-06-01', 0), 2);
  assert.equal(findZiweiDecadalIndexByDate(options, '1990-01-01', 0), 0);
  assert.equal(findZiweiDecadalIndexByDate(options, '1990-01-01', -1), -1);
  assert.equal(findZiweiDecadalIndexByDate([], '2024-01-01', 3), 3);
  assert.equal(findZiweiDecadalIndexByDate(options, '', 1), 1);
});

test('findZiweiYearOptionDate 按年份匹配', () => {
  const options = [
    { year: 2022, dateStr: '2022-01-01' },
    { year: 2023, dateStr: '2023-01-01' },
    { year: 2024, dateStr: '2024-01-01' },
    { year: 2101, dateStr: '2101-02-28' },
  ];

  assert.equal(findZiweiYearOptionDate(options, '2023-06-15'), '2023-01-01');
  assert.equal(findZiweiYearOptionDate(options, '2101-05-15'), '2101-02-28');
  assert.equal(findZiweiYearOptionDate(options, 'invalid'), '2022-01-01');
  assert.equal(findZiweiYearOptionDate([], '2023-01-01'), '');
});

test('findZiweiMonthOptionDate 按年月匹配', () => {
  const options = [
    { dateStr: '2023-01-01', label: '1月' },
    { dateStr: '2023-05-01', label: '5月' },
    { dateStr: '2024-03-01', label: '3月' },
    { dateStr: '2101-02-15', label: '2月' },
  ] as Parameters<typeof findZiweiMonthOptionDate>[0];

  assert.equal(findZiweiMonthOptionDate(options, '2023-05-15'), '2023-05-01');
  assert.equal(findZiweiMonthOptionDate(options, '2024-03-10'), '2024-03-01');
  assert.equal(findZiweiMonthOptionDate(options, '2101-02-28'), '2101-02-15');
  assert.equal(findZiweiMonthOptionDate(options, 'invalid'), '2023-01-01');
});

test('findZiweiDayOptionDate 按日匹配', () => {
  const options = [
    { day: 1, dateStr: '2024-05-01' },
    { day: 15, dateStr: '2024-05-15' },
    { day: 28, dateStr: '2101-02-28' },
  ];

  assert.equal(findZiweiDayOptionDate(options, '2024-05-15'), '2024-05-15');
  assert.equal(findZiweiDayOptionDate(options, '2101-02-28'), '2101-02-28');
  assert.equal(findZiweiDayOptionDate(options, '2024-05-20'), '2024-05-01');
  assert.equal(findZiweiDayOptionDate(options, '2024-06-15'), '2024-05-01');
  assert.equal(findZiweiDayOptionDate(options, 'invalid'), '2024-05-01');
});

test('formatZiweiPromptScopeSummary 根据范围和日期格式化摘要', () => {
  assert.equal(formatZiweiPromptScopeSummary('origin', '2024-05-13'), '本命');
  assert.equal(formatZiweiPromptScopeSummary('origin', ''), '本命');
  assert.equal(formatZiweiPromptScopeSummary('decadal', '2024-05-13'), '大限 · 2024-05-13');
  assert.equal(formatZiweiPromptScopeSummary('yearly', '2024-05-13', '流年'), '流年 · 2024-05-13');
  assert.equal(formatZiweiPromptScopeSummary('daily', '2024-05-13'), '流日 · 2024-05-13');
});

test('八字年限可映射为统一的紫微范围', () => {
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'natal' }), {
    scope: 'origin',
    dateStr: '',
  });
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'full' }), {
    scope: 'full',
    dateStr: '',
  });
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'dayun', year: 2028 }), {
    scope: 'decadal',
    dateStr: '2028-07-01',
  });
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'year', year: 2028 }), {
    scope: 'yearly',
    dateStr: '2028-07-01',
  });
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'month', year: 2028, month: 6 }), {
    scope: 'monthly',
    dateStr: '2028-06-15',
  });
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'day', year: 2028, month: 6, day: 9 }), {
    scope: 'daily',
    dateStr: '2028-06-09',
  });
});

test('parseOptionalNumber 解析可选数字', () => {
  assert.equal(parseOptionalNumber('42'), 42);
  assert.equal(parseOptionalNumber('0'), 0);
  assert.equal(parseOptionalNumber('0x10'), undefined);
  assert.equal(parseOptionalNumber('1e2'), undefined);
  assert.equal(parseOptionalNumber(''), undefined);
  assert.equal(parseOptionalNumber('  '), undefined);
  assert.equal(parseOptionalNumber('invalid'), undefined);
});

test('紫微页面展示三方四正时应排除本宫并保留 payload 顺序', () => {
  const palaces = ['命宫', '迁移', '财帛', '官禄'].map((name, index) => ({
    index,
    name,
    surrounded_palace_indexes: index === 0 ? [0, 1, 2, 3, 1] : [],
  }));
  const payload = { palaces } as AnalysisPayloadV1;

  assert.deepEqual(
    getZiweiDisplaySurroundedPalaces(payload, payload.palaces[0]).map((palace) => palace.name),
    ['迁移', '财帛', '官禄'],
  );
});

test('resolveCompatType 解析合盘类型', () => {
  assert.equal(resolveCompatType('ai-compat-marriage'), 'marriage');
  assert.equal(resolveCompatType('ai-compat-career'), 'career');
  assert.equal(resolveCompatType('ai-compat-friendship'), 'friendship');
  assert.equal(resolveCompatType('ai-compat-children'), 'children');
  assert.equal(resolveCompatType('ai-compat-parents'), 'parents');
  assert.equal(resolveCompatType('ai-compat-siblings'), 'siblings');
  assert.equal(resolveCompatType('ai-mingge-zonglun'), undefined);
});

test('八字快捷按钮会映射到对应紫微专题', () => {
  assert.equal(resolveZiweiTopicByBaziShortcutMode('事业'), 'career-wealth');
  assert.equal(resolveZiweiTopicByBaziShortcutMode('婚恋'), 'relationship');
  assert.equal(resolveZiweiTopicByBaziShortcutMode('健康'), 'health');
  assert.equal(resolveZiweiTopicByBaziShortcutMode('综合'), 'life');
  assert.equal(resolveZiweiTopicByBaziShortcutMode('问题灵感'), 'life');
});

test('单人增强提示词会保留 section 结构并强调双体系交叉校验', async () => {
  const baziPerson = buildPersonFromInput({
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: '',
    birthMinute: '',
    birthPlace: '',
    birthLongitude: '',
  });
  const baziResult = calculateFullBaziChart(baziPerson);
  const ziweiRuntime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '本人',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '5',
      day: '15',
      timeIndex: 1,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildBaziZiweiEnhancedPrompt({
    baziResult,
    ziweiText: `【分析背景】\n${ziweiRuntime.payloadByScope.origin.report_type || '紫微摘要'}`,
    question: '请重点分析我的事业方向和当前突破口。',
    questionScopeLabel: '事业',
    baziFortuneSummary: '八字分析对象：当前大运',
    ziweiScopeSummary: '紫微分析范围：流年 · 2028-01-01',
  });

  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT['bazi-ziwei']);
  assert.match(prompt, /【当前时间】/);
  assert.match(prompt, /【分析对象】\n八字分析对象：当前大运\n紫微分析范围：流年 · 2028-01-01/);
  assert.match(prompt, /【八字排盘信息】/);
  assert.match(prompt, /【紫微盘面信息】/);
  assert.match(prompt, /【问题范围】\n事业/);
  assert.match(prompt, /【问题】\n请重点分析我的事业方向和当前突破口。/);
  assert.match(
    prompt,
    /先用八字判断命局主线、结构强弱、喜忌取用与当前触发，再用紫微校验对应宫位主轴、四化牵动、三方四正和运限落点/,
  );
  assert.doesNotMatch(prompt, /【断盘要点】/);
  assert.doesNotMatch(prompt, /【八字分析思路】/);
  assert.doesNotMatch(prompt, /【输出要求】|现实建议/);
});

test('八字紫微合参提示词可写入完整大运流年资料', () => {
  const baziPerson = buildPersonFromInput({
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: '',
    birthMinute: '',
    birthPlace: '',
    birthLongitude: '',
  });
  const baziResult = calculateFullBaziChart(baziPerson);
  const fullFortuneText = formatBaziFullFortuneText(baziResult);

  const prompt = buildBaziZiweiEnhancedPrompt({
    baziResult,
    baziText: `八字基础资料\n\n【命限资料】\n${fullFortuneText}`,
    ziweiText: '紫微基础资料',
    question: '整体事业阶段怎么判断？',
    baziFortuneSummary: '八字分析对象：本命盘与完整大运流年',
  });

  assert.match(prompt, /【分析对象】\n八字分析对象：本命盘与完整大运流年/);
  assert.match(prompt, /【八字排盘信息】[\s\S]*【命限资料】/);
  assert.match(prompt, /完整大运流年：/);
  assert.match(prompt, /\d+\. .+：\d{4}年起，约\d+岁交运/);
  assert.match(prompt, /  - \d{4}年（\d+岁）.+/);
});

test('紫微完整输出版会整理本命与各层运限资料', async () => {
  const ziweiRuntime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '本人',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '5',
      day: '15',
      timeIndex: 1,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const text = formatZiweiFullScopeText(ziweiRuntime.payloadByScope);

  assert.match(text, /完整紫微运限资料：/);
  assert.match(text, /本命：分析对象：/);
  assert.match(text, /大限：分析对象：/);
  assert.match(text, /流年：分析对象：/);
  assert.match(text, /流月：分析对象：/);
  assert.match(text, /流日：分析对象：/);
  assert.match(text, /当前四化：/);
  assert.match(text, /运限命中：/);
});

test('星盘完整输出版会整理本命与行运资料', () => {
  const text = buildAstrolabeFullScopePromptText({
    natal: {
      scope: 'natal',
      dateStr: '',
      displayText: '仅使用本命信息',
      displayLabel: '本命盘',
      promptText: '分析对象：本命盘。',
    },
    yearly: {
      scope: 'yearly',
      dateStr: '2028',
      displayText: '流年 · 2028',
      displayLabel: '流年2028',
      promptText: '分析对象：流年2028。',
    },
    monthly: {
      scope: 'monthly',
      dateStr: '2028-06',
      displayText: '流月 · 2028-06',
      displayLabel: '流月2028-06',
      promptText: '分析对象：流月2028-06。',
    },
    daily: {
      scope: 'daily',
      dateStr: '2028-06-12',
      displayText: '流日 · 2028-06-12',
      displayLabel: '流日2028-06-12',
      promptText: '分析对象：流日2028-06-12。',
    },
  });

  assert.match(text, /分析对象：本命盘与完整行运资料。/);
  assert.match(text, /完整星盘行运资料：/);
  assert.match(text, /分析对象：本命盘。/);
  assert.match(text, /分析对象：流年2028。/);
  assert.match(text, /分析对象：流月2028-06。/);
  assert.match(text, /分析对象：流日2028-06-12。/);
});

test('问题灵感草稿应与自定义草稿分开存储，避免互相覆盖', () => {
  const storage = new Map<string, string>();
  const originalWindow = globalThis.window;

  const localStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  } as Storage;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  });

  try {
    writePromptDraft('result-prompt-draft:test', '我想自己提问');
    writePromptDraft('result-prompt-draft:test', '我现在适合换工作吗？', 'inspiration');

    assert.equal(readPromptDraft('result-prompt-draft:test'), '我想自己提问');
    assert.equal(
      readPromptDraft('result-prompt-draft:test', 'inspiration'),
      '我现在适合换工作吗？',
    );

    writePromptDraft('result-prompt-draft:test', '', 'inspiration');
    assert.equal(readPromptDraft('result-prompt-draft:test'), '我想自己提问');
    assert.equal(readPromptDraft('result-prompt-draft:test', 'inspiration'), '');
  } finally {
    if (originalWindow === undefined) {
      // @ts-expect-error Node 测试环境下允许删除临时挂载的 window
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});
