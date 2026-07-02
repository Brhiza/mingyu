import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaziZiweiEnhancedPrompt,
  buildCompatibilityPromptWithUnknownTime,
  buildZiweiMonthAnchorDate,
  resolveAstrolabeTopicByInspirationCategory,
  resolveAstrolabeTopicByInspirationIntent,
  findZiweiDayOptionDate,
  findZiweiDecadalIndexByDate,
  findZiweiMonthOptionDate,
  findZiweiYearOptionDate,
  formatZiweiPromptScopeSummary,
  mapBaziFortuneToZiweiScope,
  parseOptionalNumber,
  parseZiweiDateParts,
  readPromptDraft,
  resolveBaziPresetIdByInspirationCategory,
  resolveBaziPresetIdByInspirationIntent,
  resolveBaziQuestionSceneByInspirationIntent,
  resolveBaziQuestionSceneByShortcutMode,
  resolveZiweiTopicByBaziQuestionScene,
  resolveZiweiTopicByInspirationCategory,
  resolveZiweiTopicByInspirationIntent,
  resolveCompatType,
  writePromptDraft,
} from '../src/pages/ResultPage/ResultPage.helpers';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { buildZiweiChartInput, calculateFullZiweiChart } from '../src/lib/full-chart-engine/ziwei';

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
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'dayun', year: 2028 }), {
    scope: 'decadal',
    dateStr: '2028-01-01',
  });
  assert.deepEqual(mapBaziFortuneToZiweiScope({ scope: 'year', year: 2028 }), {
    scope: 'yearly',
    dateStr: '2028-01-01',
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

test('resolveCompatType 解析合盘类型', () => {
  assert.equal(resolveCompatType('ai-compat-marriage'), 'marriage');
  assert.equal(resolveCompatType('ai-compat-career'), 'career');
  assert.equal(resolveCompatType('ai-compat-friendship'), 'friendship');
  assert.equal(resolveCompatType('ai-compat-children'), 'children');
  assert.equal(resolveCompatType('ai-compat-parents'), 'parents');
  assert.equal(resolveCompatType('ai-compat-siblings'), 'siblings');
  assert.equal(resolveCompatType('ai-mingge-zonglun'), undefined);
});

test('八字问题场景会映射到对应紫微专题', () => {
  assert.equal(resolveZiweiTopicByBaziQuestionScene('career'), 'career-wealth');
  assert.equal(resolveZiweiTopicByBaziQuestionScene('marriage'), 'relationship');
  assert.equal(resolveZiweiTopicByBaziQuestionScene('health'), 'health');
  assert.equal(resolveZiweiTopicByBaziQuestionScene('general'), 'life');
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
    questionScene: 'career',
    baziFortuneSummary: '八字分析对象：当前大运',
    ziweiScopeSummary: '紫微分析范围：流年 · 2028-01-01',
  });

  assert.match(prompt, /【当前时间】/);
  assert.match(prompt, /【已选分析对象】\n八字分析对象：当前大运\n紫微分析范围：流年 · 2028-01-01/);
  assert.match(prompt, /【八字排盘信息】/);
  assert.match(prompt, /【紫微盘面信息】/);
  assert.match(prompt, /【问题】\n请重点分析我的事业方向和当前突破口。/);
  assert.match(
    prompt,
    /先用八字判断长期底色、用神喜忌、结构强弱和当前触发，再用紫微校验对应宫位、四化、三方四正和运限呼应/,
  );
  assert.match(
    prompt,
    /【输出要求】\n先直接回答【问题】，再按“八字主线”“紫微校验”“综合结论与建议”展开/,
  );
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

test('未知时辰合盘提示词应保持中性任务口径，不预设为婚恋问题', () => {
  const prompt = buildCompatibilityPromptWithUnknownTime({
    firstName: '第一人',
    firstText: '甲方三柱资料',
    secondName: '第二人',
    secondText: '乙方三柱资料',
    question: '',
  });

  assert.match(prompt, /【问题】\n请先从双方互动模式与现实建议开始分析。/);
  assert.match(prompt, /【第一人排盘信息】\n姓名：第一人\n甲方三柱资料/);
  assert.match(prompt, /【第二人排盘信息】\n姓名：第二人\n乙方三柱资料/);
  assert.match(prompt, /先直接回答【问题】，并区分当前能确认的主线与因时辰未知而待确认的部分/);
  assert.match(prompt, /凡是明显依赖时柱、子女宫或更细时限的判断，都要标记为待确认/);
  assert.match(prompt, /不得编造资料里没有给出的新盘面事实/);
  assert.match(prompt, /允许基于三柱和已知资料做保守推理/);
  assert.match(prompt, /先直接回答【问题】/);
  assert.doesNotMatch(prompt, /关系主线/);
  assert.doesNotMatch(prompt, /婚恋匹配角度/);
});

test('未知时辰合盘自定义问题不应额外拼接任务书', () => {
  const prompt = buildCompatibilityPromptWithUnknownTime({
    firstName: '第一人',
    firstText: '甲方三柱资料',
    secondName: '第二人',
    secondText: '乙方三柱资料',
    question: '我们现在更适合继续合作，还是先保持距离？',
    isCustomQuestion: true,
  });

  assert.match(prompt, /【问题】\n我们现在更适合继续合作，还是先保持距离？/);
  assert.match(prompt, /姓名：第一人/);
  assert.match(prompt, /姓名：第二人/);
  assert.doesNotMatch(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /【输出要求】/);
});

test('八字快捷按钮会同步到对应的问题类型选择', () => {
  assert.equal(resolveBaziQuestionSceneByShortcutMode('近期'), 'recent');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('事业'), 'career');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('换工作'), 'job-change');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('创业合作'), 'startup-partnership');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('投资合作'), 'investment-partnership');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('财运'), 'wealth');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('婚恋'), 'marriage');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('关系推进'), 'relationship-push');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('关系去留'), 'relationship-decision');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('复合判断'), 'reconciliation-decision');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('子女'), 'children');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('家庭'), 'family');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('搬家置业'), 'home-move');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('定居换城'), 'settle-relocate');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('人际'), 'social');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('情绪'), 'emotion');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('健康'), 'health');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('学业'), 'study');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('考证进修'), 'study-advance');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('考试上岸'), 'exam-landing');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('成长'), 'growth');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('天赋'), 'talent');
});

test('没有明确对应关系的快捷按钮会回到综合问题类型', () => {
  assert.equal(resolveBaziQuestionSceneByShortcutMode('综合'), 'general');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('自定义'), 'general');
  assert.equal(resolveBaziQuestionSceneByShortcutMode('问题灵感'), 'general');
});

test('问题灵感细粒度意图会优先映射到更具体的专项框架', () => {
  assert.equal(resolveBaziPresetIdByInspirationIntent('job-change'), 'ai-job-change');
  assert.equal(resolveBaziQuestionSceneByInspirationIntent('job-change'), 'job-change');
  assert.equal(resolveZiweiTopicByInspirationIntent('job-change'), 'job-change');
  assert.equal(resolveAstrolabeTopicByInspirationIntent('job-change'), 'job-change');

  assert.equal(resolveBaziPresetIdByInspirationIntent('relationship-push'), 'ai-relationship-push');
  assert.equal(
    resolveBaziQuestionSceneByInspirationIntent('relationship-push'),
    'relationship-push',
  );
  assert.equal(resolveZiweiTopicByInspirationIntent('relationship-push'), 'relationship-push');
  assert.equal(resolveAstrolabeTopicByInspirationIntent('relationship-push'), 'relationship-push');

  assert.equal(
    resolveBaziPresetIdByInspirationIntent('startup-partnership'),
    'ai-startup-partnership',
  );
  assert.equal(
    resolveBaziQuestionSceneByInspirationIntent('startup-partnership'),
    'startup-partnership',
  );
  assert.equal(resolveZiweiTopicByInspirationIntent('startup-partnership'), 'startup-partnership');
  assert.equal(
    resolveAstrolabeTopicByInspirationIntent('startup-partnership'),
    'startup-partnership',
  );

  assert.equal(
    resolveBaziPresetIdByInspirationIntent('relationship-decision'),
    'ai-relationship-decision',
  );
  assert.equal(
    resolveBaziQuestionSceneByInspirationIntent('relationship-decision'),
    'relationship-decision',
  );
  assert.equal(
    resolveZiweiTopicByInspirationIntent('relationship-decision'),
    'relationship-decision',
  );
  assert.equal(
    resolveAstrolabeTopicByInspirationIntent('relationship-decision'),
    'relationship-decision',
  );

  assert.equal(resolveBaziPresetIdByInspirationIntent('home-move'), 'ai-home-move');
  assert.equal(resolveBaziQuestionSceneByInspirationIntent('home-move'), 'home-move');
  assert.equal(resolveZiweiTopicByInspirationIntent('home-move'), 'home-move');
  assert.equal(resolveAstrolabeTopicByInspirationIntent('home-move'), 'home-move');

  assert.equal(
    resolveBaziPresetIdByInspirationIntent('investment-partnership'),
    'ai-investment-partnership',
  );
  assert.equal(
    resolveBaziQuestionSceneByInspirationIntent('investment-partnership'),
    'investment-partnership',
  );
  assert.equal(
    resolveZiweiTopicByInspirationIntent('investment-partnership'),
    'investment-partnership',
  );
  assert.equal(
    resolveAstrolabeTopicByInspirationIntent('investment-partnership'),
    'investment-partnership',
  );

  assert.equal(
    resolveBaziPresetIdByInspirationIntent('reconciliation-decision'),
    'ai-reconciliation-decision',
  );
  assert.equal(
    resolveBaziQuestionSceneByInspirationIntent('reconciliation-decision'),
    'reconciliation-decision',
  );
  assert.equal(
    resolveZiweiTopicByInspirationIntent('reconciliation-decision'),
    'reconciliation-decision',
  );
  assert.equal(
    resolveAstrolabeTopicByInspirationIntent('reconciliation-decision'),
    'reconciliation-decision',
  );

  assert.equal(resolveBaziPresetIdByInspirationIntent('settle-relocate'), 'ai-settle-relocate');
  assert.equal(resolveBaziQuestionSceneByInspirationIntent('settle-relocate'), 'settle-relocate');
  assert.equal(resolveZiweiTopicByInspirationIntent('settle-relocate'), 'settle-relocate');
  assert.equal(resolveAstrolabeTopicByInspirationIntent('settle-relocate'), 'settle-relocate');

  assert.equal(resolveBaziPresetIdByInspirationIntent('study-advance'), 'ai-study-advance');
  assert.equal(resolveBaziQuestionSceneByInspirationIntent('study-advance'), 'study-advance');
  assert.equal(resolveZiweiTopicByInspirationIntent('study-advance'), 'study-advance');
  assert.equal(resolveAstrolabeTopicByInspirationIntent('study-advance'), 'study-advance');

  assert.equal(resolveBaziPresetIdByInspirationIntent('exam-landing'), 'ai-exam-landing');
  assert.equal(resolveBaziQuestionSceneByInspirationIntent('exam-landing'), 'exam-landing');
  assert.equal(resolveZiweiTopicByInspirationIntent('exam-landing'), 'exam-landing');
  assert.equal(resolveAstrolabeTopicByInspirationIntent('exam-landing'), 'exam-landing');

  assert.equal(resolveBaziPresetIdByInspirationIntent('family-health'), 'ai-family');
  assert.equal(resolveBaziQuestionSceneByInspirationIntent('family-health'), 'parents');
  assert.equal(resolveZiweiTopicByInspirationIntent('family-health'), 'family');
  assert.equal(resolveAstrolabeTopicByInspirationIntent('family-health'), 'family');
});

test('问题灵感会按分类映射到对应的八字、紫微与星盘专项框架', () => {
  assert.equal(resolveBaziPresetIdByInspirationCategory('近期'), 'ai-recent');
  assert.equal(resolveBaziPresetIdByInspirationCategory('事业'), 'ai-career');
  assert.equal(resolveBaziPresetIdByInspirationCategory('财运'), 'ai-wealth-timing');
  assert.equal(resolveBaziPresetIdByInspirationCategory('婚恋'), 'ai-marriage');
  assert.equal(resolveBaziPresetIdByInspirationCategory('六亲'), 'ai-family');
  assert.equal(resolveBaziPresetIdByInspirationCategory('家庭'), 'ai-home');
  assert.equal(resolveBaziPresetIdByInspirationCategory('人际'), 'ai-social');
  assert.equal(resolveBaziPresetIdByInspirationCategory('情绪'), 'ai-emotion');
  assert.equal(resolveBaziPresetIdByInspirationCategory('健康'), 'ai-health');
  assert.equal(resolveBaziPresetIdByInspirationCategory('学业'), 'ai-study');
  assert.equal(resolveBaziPresetIdByInspirationCategory('成长'), 'ai-growth');
  assert.equal(resolveBaziPresetIdByInspirationCategory('天赋'), 'ai-talent');
  assert.equal(resolveBaziPresetIdByInspirationCategory(undefined), 'ai-mingge-zonglun');

  assert.equal(resolveZiweiTopicByInspirationCategory('近期'), 'recent');
  assert.equal(resolveZiweiTopicByInspirationCategory('事业'), 'career-wealth');
  assert.equal(resolveZiweiTopicByInspirationCategory('财运'), 'career-wealth');
  assert.equal(resolveZiweiTopicByInspirationCategory('婚恋'), 'relationship');
  assert.equal(resolveZiweiTopicByInspirationCategory('子女'), 'children');
  assert.equal(resolveZiweiTopicByInspirationCategory('六亲'), 'family');
  assert.equal(resolveZiweiTopicByInspirationCategory('家庭'), 'family');
  assert.equal(resolveZiweiTopicByInspirationCategory('人际'), 'social');
  assert.equal(resolveZiweiTopicByInspirationCategory('情绪'), 'emotion');
  assert.equal(resolveZiweiTopicByInspirationCategory('健康'), 'health');
  assert.equal(resolveZiweiTopicByInspirationCategory('学业'), 'study');
  assert.equal(resolveZiweiTopicByInspirationCategory('成长'), 'growth');
  assert.equal(resolveZiweiTopicByInspirationCategory('天赋'), 'talent');
  assert.equal(resolveZiweiTopicByInspirationCategory(undefined), 'life');

  assert.equal(resolveAstrolabeTopicByInspirationCategory('近期'), 'recent');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('事业'), 'career');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('财运'), 'wealth');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('婚恋'), 'relationship');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('子女'), 'children');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('六亲'), 'family');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('家庭'), 'family');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('人际'), 'social');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('情绪'), 'emotion');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('健康'), 'health');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('学业'), 'study');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('成长'), 'growth');
  assert.equal(resolveAstrolabeTopicByInspirationCategory('天赋'), 'talent');
  assert.equal(resolveAstrolabeTopicByInspirationCategory(undefined), 'life');
});
