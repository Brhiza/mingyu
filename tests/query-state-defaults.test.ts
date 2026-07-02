import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInputSearch,
  buildResultSearch,
  defaultInputState,
  defaultPromptState,
  UNKNOWN_TIME_INDEX,
  parseInputState,
  parsePromptState,
} from '../src/lib/query-state';

test('输入页默认状态不应预填生日与时辰', () => {
  assert.equal(defaultInputState.chartType, 'bazi');
  assert.equal(defaultInputState.year, '');
  assert.equal(defaultInputState.month, '');
  assert.equal(defaultInputState.day, '');
  assert.equal(defaultInputState.timeIndex, '');
  assert.equal(defaultInputState.birthHour, '');
  assert.equal(defaultInputState.birthMinute, '');
  assert.equal(defaultInputState.birthLatitude, '');

  assert.equal(defaultInputState.partnerYear, '');
  assert.equal(defaultInputState.partnerMonth, '');
  assert.equal(defaultInputState.partnerDay, '');
  assert.equal(defaultInputState.partnerTimeIndex, '');
  assert.equal(defaultInputState.partnerBirthHour, '');
  assert.equal(defaultInputState.partnerBirthMinute, '');
  assert.equal(defaultInputState.partnerBirthLatitude, '');
});

test('空查询参数不应把空时辰解析成 0', () => {
  const inputState = parseInputState(new URLSearchParams('timeIndex=&partnerTimeIndex='));

  assert.equal(inputState.timeIndex, '');
  assert.equal(inputState.partnerTimeIndex, '');
});

test('地址栏非法时辰索引应清空而不是继续恢复', () => {
  const inputState = parseInputState(new URLSearchParams('timeIndex=13&partnerTimeIndex=99'));

  assert.equal(inputState.timeIndex, '');
  assert.equal(inputState.partnerTimeIndex, '');
});

test('地址栏空白时辰索引不应被 Number 转成早子时', () => {
  const inputState = parseInputState(new URLSearchParams('timeIndex=+&partnerTimeIndex=%20'));

  assert.equal(inputState.timeIndex, '');
  assert.equal(inputState.partnerTimeIndex, '');
});

test('地址栏非法出生日期和真太阳时字段应清空', () => {
  const inputState = parseInputState(
    new URLSearchParams({
      dateType: 'solar',
      year: '2024',
      month: '02',
      day: '31',
      useTrueSolarTime: '1',
      birthHour: '24',
      birthMinute: '60',
      birthLongitude: '181',
      birthLatitude: '-91',
      partnerDateType: 'lunar',
      partnerYear: '1899',
      partnerMonth: '13',
      partnerDay: '31',
      partnerUseTrueSolarTime: '1',
      partnerBirthHour: '1.5',
      partnerBirthMinute: '20',
      partnerBirthLongitude: '116',
      partnerBirthLatitude: '39.9',
    }),
  );

  assert.equal(inputState.year, '2024');
  assert.equal(inputState.month, '02');
  assert.equal(inputState.day, '');
  assert.equal(inputState.birthHour, '');
  assert.equal(inputState.birthMinute, '');
  assert.equal(inputState.birthLongitude, '');
  assert.equal(inputState.birthLatitude, '');
  assert.equal(inputState.partnerYear, '');
  assert.equal(inputState.partnerMonth, '');
  assert.equal(inputState.partnerDay, '');
  assert.equal(inputState.partnerBirthHour, '');
  assert.equal(inputState.partnerBirthMinute, '20');
  assert.equal(inputState.partnerBirthLongitude, '116');
  assert.equal(inputState.partnerBirthLatitude, '39.9');
});

test('结果页默认应直接打开提示词页', () => {
  assert.equal(defaultPromptState.tab, 'prompt');
});

test('结果页默认紫微提示词状态应与自定义模式一致', () => {
  assert.equal(defaultPromptState.ziweiShortcutMode, '自定义');
  assert.equal(defaultPromptState.ziweiTopic, 'chat');
});

test('结果页默认星盘提示词状态应直接落到综合专项方案', () => {
  assert.equal(defaultPromptState.astrolabeShortcutMode, '综合');
  assert.equal(defaultPromptState.astrolabeTopic, 'life');
  assert.equal(defaultPromptState.astrolabeScope, 'natal');
  assert.equal(defaultPromptState.astrolabeScopeDate, '');
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
  assert.doesNotMatch(search, /bq=/);
  assert.doesNotMatch(search, /zq=/);
  assert.match(search, /bsm=/);
  assert.doesNotMatch(search, /zsm=/);
});

test('八字问题类型不再写入地址栏，但旧链接仍可恢复', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    baziQuestionScene: 'health',
  });

  assert.doesNotMatch(search, /baziQuestionScene=health/);

  const parsed = parsePromptState(new URLSearchParams('baziQuestionScene=health'));
  assert.equal(parsed.baziQuestionScene, 'health');
});

test('八字问题类型参数非法时回到综合', () => {
  const parsed = parsePromptState(new URLSearchParams('baziQuestionScene=unknown'));

  assert.equal(parsed.baziQuestionScene, 'general');
});

test('紫微提示词指定年限日期会写入并从地址栏恢复', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    promptSource: 'ziwei',
    ziweiScope: 'yearly',
    ziweiScopeDate: '2028-06-01',
  });

  assert.match(search, /zs=yearly/);
  assert.match(search, /zsd=2028-06-01/);
  assert.doesNotMatch(search, /ziweiScope=/);
  assert.doesNotMatch(search, /ziweiScopeDate=/);

  const parsed = parsePromptState(new URLSearchParams(search));
  assert.equal(parsed.ziweiScope, 'yearly');
  assert.equal(parsed.ziweiScopeDate, '2028-06-01');
});

test('紫微提示词范围日期非法时应清空日期参数', () => {
  const invalidCases = ['2028-02-31', '2028-13-01', '2028-06', '1899-01-01'];

  for (const dateStr of invalidCases) {
    const parsed = parsePromptState(
      new URLSearchParams({
        ziweiScope: 'daily',
        ziweiScopeDate: dateStr,
      }),
    );

    assert.equal(parsed.ziweiScope, 'daily');
    assert.equal(parsed.ziweiScopeDate, '');
  }
});

test('紫微提示词范围日期应保留合法运限推算出的 2100 年以后日期', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      ziweiScope: 'yearly',
      ziweiScopeDate: '2101-02-28',
    }),
  );

  assert.equal(parsed.ziweiScope, 'yearly');
  assert.equal(parsed.ziweiScopeDate, '2101-02-28');
});

test('八字加紫微增强来源可从地址栏恢复', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      promptSource: 'bazi-ziwei',
    }),
  );

  assert.equal(parsed.promptSource, 'bazi-ziwei');
});

test('紫微提示词参数非法时应回到稳定默认值', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      ziweiTopic: 'unknown-topic',
      ziweiScope: 'unknown-scope',
    }),
  );

  assert.equal(parsed.ziweiTopic, defaultPromptState.ziweiTopic);
  assert.equal(parsed.ziweiScope, defaultPromptState.ziweiScope);
});

test('八字运势范围参数非法时应回到默认范围', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      baziFortuneScope: 'unknown-scope',
    }),
  );

  assert.equal(parsed.baziFortuneScope, defaultPromptState.baziFortuneScope);
});

test('紫微自定义旧链接应强制回到自由问答主题，避免显示与生成逻辑冲突', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      ziweiShortcutMode: '自定义',
      ziweiTopic: 'life',
    }),
  );

  assert.equal(parsed.ziweiShortcutMode, '自定义');
  assert.equal(parsed.ziweiTopic, 'chat');
});

test('星盘自定义旧链接也应强制回到自由问答主题，避免误套专项框架', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      astrolabeShortcutMode: '自定义',
      astrolabeTopic: 'career',
    }),
  );

  assert.equal(parsed.astrolabeShortcutMode, '自定义');
  assert.equal(parsed.astrolabeTopic, 'chat');
});

test('紫微本命范围不应保留多余日期参数', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      ziweiScope: 'origin',
      ziweiScopeDate: '2028-06-01',
    }),
  );

  assert.equal(parsed.ziweiScope, 'origin');
  assert.equal(parsed.ziweiScopeDate, '');
});

test('八字本命范围不应保留更细的运势参数残留', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      baziFortuneScope: 'natal',
      baziFortuneCycleIndex: '3',
      baziFortuneYear: '2028',
      baziFortuneMonth: '6',
      baziFortuneDay: '12',
    }),
  );

  assert.equal(parsed.baziFortuneScope, 'natal');
  assert.equal(parsed.baziFortuneCycleIndex, '');
  assert.equal(parsed.baziFortuneYear, '');
  assert.equal(parsed.baziFortuneMonth, '');
  assert.equal(parsed.baziFortuneDay, '');
});

test('结果页地址回写紫微自定义状态时不应重新写回旧主题', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    promptSource: 'ziwei',
    ziweiShortcutMode: '自定义',
    ziweiTopic: 'life',
  });

  assert.match(search, /ps=ziwei/);
  assert.doesNotMatch(search, /zsm=/);
  assert.doesNotMatch(search, /zt=life/);
  assert.doesNotMatch(search, /zt=chat/);
  assert.doesNotMatch(search, /ziweiTopic=life/);
});

test('结果页地址回写紫微本命范围时不应重新写回旧日期', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    promptSource: 'ziwei',
    ziweiScope: 'origin',
    ziweiScopeDate: '2028-06-01',
  });

  assert.match(search, /ps=ziwei/);
  assert.doesNotMatch(search, /zs=origin/);
  assert.doesNotMatch(search, /zsd=2028-06-01/);
  assert.doesNotMatch(search, /ziweiScope=origin/);
  assert.doesNotMatch(search, /ziweiScopeDate=2028-06-01/);
  assert.equal(parsePromptState(new URLSearchParams(search)).ziweiScopeDate, '');
});

test('结果页地址回写八字本命范围时不应重新写回更细的运势参数', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    baziFortuneScope: 'natal',
    baziFortuneCycleIndex: '3',
    baziFortuneYear: '2028',
    baziFortuneMonth: '6',
    baziFortuneDay: '12',
  });

  assert.equal(search, '');
  assert.doesNotMatch(search, /bfs=natal/);
  assert.doesNotMatch(search, /bci=3/);
  assert.doesNotMatch(search, /bfy=2028/);
  assert.doesNotMatch(search, /bfm=6/);
  assert.doesNotMatch(search, /bfd=12/);
  assert.doesNotMatch(search, /baziFortuneScope=natal/);
  assert.doesNotMatch(search, /baziFortuneCycleIndex=3/);
  assert.doesNotMatch(search, /baziFortuneYear=2028/);
  assert.doesNotMatch(search, /baziFortuneMonth=6/);
  assert.doesNotMatch(search, /baziFortuneDay=12/);
  assert.deepEqual(parsePromptState(new URLSearchParams(search)), {
    ...defaultPromptState,
    baziFortuneScope: 'natal',
  });
});

test('星盘结果页参数会跟随真太阳时和出生地信息一起写入并从地址栏恢复', () => {
  const search = buildResultSearch(
    {
      ...defaultInputState,
      useTrueSolarTime: true,
      birthHour: '10',
      birthMinute: '30',
      birthPlace: '北京市 北京市 朝阳区',
      birthLongitude: '116.443136',
      birthLatitude: '39.9042',
    },
    {
      ...defaultPromptState,
      tab: 'astrolabe',
      promptSource: 'astrolabe',
    },
  );

  assert.match(search, /t=astrolabe/);
  assert.match(search, /ps=astrolabe/);
  assert.match(search, /la=39.9042/);
  assert.doesNotMatch(search, /tab=astrolabe/);
  assert.doesNotMatch(search, /promptSource=astrolabe/);
  assert.doesNotMatch(search, /birthLatitude=39.9042/);

  const parsedInput = parseInputState(new URLSearchParams(search));
  const parsedPrompt = parsePromptState(new URLSearchParams(search));
  assert.equal(parsedInput.useTrueSolarTime, true);
  assert.equal(parsedInput.birthHour, '10');
  assert.equal(parsedInput.birthLatitude, '39.9042');
  assert.equal(parsedPrompt.tab, 'astrolabe');
  assert.equal(parsedPrompt.promptSource, 'astrolabe');
});

test('星盘专项快捷模式会写入并从地址栏恢复，但不暴露问题正文', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    promptSource: 'astrolabe',
    astrolabeShortcutMode: '学业',
    astrolabeTopic: 'study',
    astrolabeQuickQuestion: '请重点分析我的学习吸收方式。',
  });

  assert.match(search, /ps=astrolabe/);
  assert.match(search, /asm=/);
  assert.match(search, /at=study/);
  assert.doesNotMatch(search, /aq=/);
  assert.doesNotMatch(search, /astrolabeQuickQuestion=/);

  const parsed = parsePromptState(new URLSearchParams(search));
  assert.equal(parsed.astrolabeShortcutMode, '学业');
  assert.equal(parsed.astrolabeTopic, 'study');
  assert.equal(parsed.astrolabeQuickQuestion, '');
});

test('星盘提示词指定年限日期会写入并从地址栏恢复', () => {
  const search = buildResultSearch(defaultInputState, {
    ...defaultPromptState,
    promptSource: 'astrolabe',
    astrolabeScope: 'monthly',
    astrolabeScopeDate: '2028-06',
  });

  assert.match(search, /ps=astrolabe/);
  assert.match(search, /as=monthly/);
  assert.match(search, /asd=2028-06/);
  assert.doesNotMatch(search, /astrolabeScope=/);
  assert.doesNotMatch(search, /astrolabeScopeDate=/);

  const parsed = parsePromptState(new URLSearchParams(search));
  assert.equal(parsed.astrolabeScope, 'monthly');
  assert.equal(parsed.astrolabeScopeDate, '2028-06');
});

test('星盘提示词范围日期应按范围校验并清空非法日期', () => {
  assert.equal(
    parsePromptState(new URLSearchParams({ astrolabeScope: 'yearly', astrolabeScopeDate: '2028' }))
      .astrolabeScopeDate,
    '2028',
  );
  assert.equal(
    parsePromptState(
      new URLSearchParams({ astrolabeScope: 'monthly', astrolabeScopeDate: '2028-06' }),
    ).astrolabeScopeDate,
    '2028-06',
  );
  assert.equal(
    parsePromptState(
      new URLSearchParams({ astrolabeScope: 'daily', astrolabeScopeDate: '2028-02-29' }),
    ).astrolabeScopeDate,
    '2028-02-29',
  );

  const invalidCases = [
    ['yearly', '2028-06'],
    ['monthly', '2028-02-31'],
    ['daily', '2028-02-31'],
    ['daily', '2028-06'],
    ['daily', '1899-01-01'],
  ] as const;

  for (const [scope, dateStr] of invalidCases) {
    const parsed = parsePromptState(
      new URLSearchParams({
        astrolabeScope: scope,
        astrolabeScopeDate: dateStr,
      }),
    );

    assert.equal(parsed.astrolabeScope, scope);
    assert.equal(parsed.astrolabeScopeDate, '');
  }
});

test('星盘提示词范围日期应保留 2100 年以后的合法行运日期', () => {
  assert.equal(
    parsePromptState(new URLSearchParams({ astrolabeScope: 'yearly', astrolabeScopeDate: '2101' }))
      .astrolabeScopeDate,
    '2101',
  );
  assert.equal(
    parsePromptState(
      new URLSearchParams({ astrolabeScope: 'monthly', astrolabeScopeDate: '2101-02' }),
    ).astrolabeScopeDate,
    '2101-02',
  );
  assert.equal(
    parsePromptState(
      new URLSearchParams({ astrolabeScope: 'daily', astrolabeScopeDate: '2101-02-28' }),
    ).astrolabeScopeDate,
    '2101-02-28',
  );
});

test('结果页解析只认当前页面使用的新版运势参数', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      baziYearMode: 'yearly',
      baziSelectedYear: '2030',
    }),
  );

  assert.equal(parsed.baziFortuneScope, defaultPromptState.baziFortuneScope);
  assert.equal(parsed.baziFortuneYear, defaultPromptState.baziFortuneYear);
});

test('星盘本命范围不应保留多余日期参数', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      astrolabeScope: 'natal',
      astrolabeScopeDate: '2028-06-01',
    }),
  );

  assert.equal(parsed.astrolabeScope, 'natal');
  assert.equal(parsed.astrolabeScopeDate, '');
});

test('星盘提示词范围参数非法时应回到默认范围', () => {
  const parsed = parsePromptState(
    new URLSearchParams({
      astrolabeScope: 'decadal',
      astrolabeScopeDate: '2028-06',
    }),
  );

  assert.equal(parsed.astrolabeScope, defaultPromptState.astrolabeScope);
  assert.equal(parsed.astrolabeScopeDate, '');
});

test('结果页地址会使用短参数并省略默认值和空值', () => {
  const input = {
    ...defaultInputState,
    name: '张三',
    year: '1990',
    month: '8',
    day: '16',
    timeIndex: 5,
  };
  const compactSearch = buildResultSearch(input, {
    ...defaultPromptState,
    tab: 'bazi',
    baziShortcutMode: '事业',
  });
  const legacySearch = new URLSearchParams({
    analysisMode: 'single',
    chartType: 'bazi',
    name: '张三',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '8',
    day: '16',
    timeIndex: '5',
    tab: 'bazi',
    promptSource: 'bazi',
    baziShortcutMode: '事业',
  }).toString();

  assert.match(compactSearch, /n=/);
  assert.match(compactSearch, /y=1990/);
  assert.match(compactSearch, /ti=5/);
  assert.match(compactSearch, /t=bazi/);
  assert.match(compactSearch, /bsm=/);
  assert.doesNotMatch(compactSearch, /analysisMode=/);
  assert.doesNotMatch(compactSearch, /chartType=/);
  assert.doesNotMatch(compactSearch, /gender=/);
  assert.doesNotMatch(compactSearch, /dateType=/);
  assert.doesNotMatch(compactSearch, /promptSource=/);
  assert.ok(compactSearch.length < legacySearch.length / 2);
});

test('短参数链接可以完整恢复输入与提示词状态', () => {
  const params = new URLSearchParams(
    'a=compatibility&c=ziwei&n=%E5%BC%A0%E4%B8%89&g=female&dt=lunar&y=1990&m=8&d=16&ti=-1&lm=1&pn=%E6%9D%8E%E5%9B%9B&py=1992&pm=9&pd=20&pti=6&t=prompt&ps=ziwei&zs=yearly&zsd=2028-06-01',
  );
  const parsedInput = parseInputState(params);
  const parsedPrompt = parsePromptState(params);

  assert.equal(parsedInput.analysisMode, 'compatibility');
  assert.equal(parsedInput.chartType, 'ziwei');
  assert.equal(parsedInput.name, '张三');
  assert.equal(parsedInput.gender, 'female');
  assert.equal(parsedInput.dateType, 'lunar');
  assert.equal(parsedInput.timeIndex, UNKNOWN_TIME_INDEX);
  assert.equal(parsedInput.isLeapMonth, true);
  assert.equal(parsedInput.partnerName, '李四');
  assert.equal(parsedInput.partnerTimeIndex, 6);
  assert.equal(parsedPrompt.promptSource, 'ziwei');
  assert.equal(parsedPrompt.ziweiScope, 'yearly');
  assert.equal(parsedPrompt.ziweiScopeDate, '2028-06-01');
});
