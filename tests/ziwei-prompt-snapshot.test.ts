import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFullZiweiChart, buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';
import { EARTHLY_BRANCHES } from '../packages/core/src/ganzhi/data';
import { buildZiweiPrompt, formatZiweiPayloadForPrompt } from '../packages/core/src/prompt/ziwei';
import {
  buildPublicZiweiPromptForRuntime,
  formatZiweiEvidenceText,
} from '../packages/core/src/prompt/public-api';
import { buildFocusTaskBundle } from '../packages/core/src/ziwei/prompt/focus';
import {
  isRepeatedZiweiCoLocationCondition,
  isZiweiConditionRestatedByPalaces,
} from '../packages/core/src/ziwei/prompt/pattern-condition-visibility';
import { buildZiweiMatchedPatternSummary } from '../packages/core/src/ziwei/prompt/snapshot';

import {
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
  formatZiweiTrueSolarEvidence,
} from 'mingyu-core/ziwei/prompt';
import { resolveZiweiTrueSolarBirth } from 'mingyu-core/ziwei/true-solar-input';
import {
  buildEvidenceAnalysis,
  buildEvidencePool,
  buildPatternAnalysis,
  calculateZiweiChart,
  detectPatterns,
  DEFAULT_ZIWEI_CALCULATION_CONFIG,
} from '@core/ziwei/iztro';
import { buildEvidenceSummary, buildPalaceSummary } from '../src/lib/ziwei-prompts/builders';
import {
  buildZiweiReadableSnapshot,
  buildZiweiTaskBookSnapshot,
} from '../src/lib/ziwei-prompts/snapshot';
import type { PromptContext } from '../src/lib/ziwei-prompts/types';
import {
  assertPromptCurrentTimeHasGanzhiCalendar,
  assertPromptHasSingleRole,
} from './prompt-assertions';
import type { AnalysisPayloadV1, PalaceFact } from '../src/types/analysis';
import type { ZiweiRuntimeFacts } from '../packages/core/src/ziwei/runtime';
import { PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT } from '../src/lib/prompt-guidance';

function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(
    prompt,
    /本项目|当前项目|项目统一|本地|技术限制|未计算|资料包|提示词规则|系统提示词|在线\s*AI|工程|算法(?:结果|返回|生成|实际)|本模块|当前数据|实际返回|用户补充：/,
  );
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|已写入|未写入/);
  assert.doesNotMatch(prompt, /用户(?:未|没有|选择|所选|已选|填写|提供|补充|问题)/);
  assert.doesNotMatch(prompt, /需要补充|请补充|再选择/);
  assert.doesNotMatch(prompt, /预设|模板|接口|API|MCP|调试/);
}

function createPalace(index: number, name: string, stars: string[] = []): PalaceFact {
  return {
    index,
    name,
    is_body_palace: name === '身宫',
    is_original_palace: false,
    heavenly_stem: '甲',
    earthly_branch: EARTHLY_BRANCHES[index],
    major_stars: stars.map((star) => ({ name: star, kind: 'major' })),
    minor_stars: [],
    other_stars: [],
    scope_stars: [],
    changsheng12: '长生',
    boshi12: '博士',
    base_jiangqian12: '岁建',
    base_suiqian12: '将星',
    decadal_range: [1, 10],
    ages: [],
    scope_hits: [],
    empty_state: false,
    opposite_palace_index: (index + 6) % 12,
    surrounded_palace_indexes: [index, (index + 6) % 12, (index + 4) % 12, (index + 8) % 12],
    summary_tags: stars,
  };
}

function createPayload(): AnalysisPayloadV1 {
  const palaceNames = [
    '命宫',
    '兄弟',
    '夫妻',
    '子女',
    '财帛',
    '疾厄',
    '迁移',
    '交友',
    '官禄',
    '田宅',
    '福德',
    '父母',
  ];

  return {
    payload_version: 'analysis_payload_v1',
    language: 'zh-CN',
    calculation_config: DEFAULT_ZIWEI_CALCULATION_CONFIG,
    basic_info: {
      gender: '男',
      solar_date: '1990-05-15',
      lunar_date: '庚午年四月廿一',
      chinese_date: '庚午年四月廿一',
      birth_time_label: '丑时',
      birth_time_range: '01:00-03:00',
      zodiac: '马',
      sign: '金牛座',
      five_elements_class: '水二局',
      soul: '破军',
      body: '天相',
      soul_palace_branch: '子',
      body_palace_branch: '丑',
      hidden_palaces: {
        body_palace_name: '福德',
      },
    },
    active_scope: {
      scope: 'origin',
      label: '本命',
      solar_date: '2026-05-16',
      lunar_date: '丙午年四月',
      nominal_age: 37,
      palace_index: 0,
      mutagen_map: [],
    },
    palaces: palaceNames.map((name, index) =>
      createPalace(index, name, index === 0 ? ['紫微', '天府'] : []),
    ),
    evidence_pool: [],
    patterns: [
      {
        id: 'P1',
        name: '紫府同宫',
        kind: 'auspicious',
        description: '紫微与天府同坐命宫，主格局稳重。',
        palace_indexes: [0],
        palace_names: ['命宫'],
        star_names: ['紫微', '天府'],
      },
    ],
  };
}

function createReportContext(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    report_key: 'life:origin:2026-05-16',
    report_title: '人生解析报告',
    report_type: 'life',
    selected_topic: 'life',
    scope_type: 'origin',
    scope_label: '本命',
    focus_notes: [],
    ...overrides,
  };
}

let repeatedOriginChart: ReturnType<typeof calculateZiweiChart> | undefined;

function getRepeatedOriginChart() {
  return (repeatedOriginChart ??= calculateZiweiChart(
    {
      name: '紫微资料去重核验',
      gender: '女',
      dateType: 'solar',
      birthDate: '1990-05-15',
      birthTimeIndex: 4,
      algorithm: 'default',
    },
    { scopes: ['origin'] },
  ));
}

test('紫微宫位专题遇到盘上不存在的宫名时只采用已定位宫位', () => {
  const payload = createPayload();
  const focus = buildFocusTaskBundle(payload, {
    scope: 'origin',
    reportType: 'palace',
    palaceName: '不存在的宫位',
  });
  assert.match(focus.focusSummary, /围绕命宫及其对宫、三方四正/);
  assert.ok(focus.focusPalaces.some((palace) => palace.name === '命宫'));
  assert.doesNotMatch(focus.focusSummary, /不存在的宫位/);
});

test('紫微提示词快照不得重新接入未校勘的旧格局数据', () => {
  const payload = createPayload();
  payload.pattern_analysis = buildPatternAnalysis({
    patterns: payload.patterns ?? [],
    palaces: payload.palaces,
  });
  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext({
      report_key: 'destiny:origin:2026-05-16',
      report_title: '命局综述',
      report_type: 'destiny-overview',
      selected_topic: 'destiny',
    }),
  });

  assert.doesNotMatch(snapshot, /【命盘格局】/);
  assert.doesNotMatch(snapshot, /紫府同宫/);
  assert.doesNotMatch(snapshot, /紫微与天府同坐命宫/);
  assert.doesNotMatch(snapshot, /证据状态|已检格局规则|未命中规则|解释边界|非事实结论/);
  assert.doesNotMatch(snapshot, /命语|iztro|本项目|项目统一|工程|接口|API|MCP/);
  assert.doesNotMatch(snapshot, /星座|金牛座/);
  assert.match(snapshot, /【十二宫资料】/);
  assert.doesNotMatch(formatZiweiPayloadForPrompt(payload), /命盘格局：|格局：紫府同宫/);
});

test('紫微提示词快照应输出已校勘格局的条件与古籍依据', () => {
  const payload = createPayload();
  payload.patterns = detectPatterns({ palaces: payload.palaces });
  payload.pattern_analysis = buildPatternAnalysis({
    patterns: payload.patterns,
    palaces: payload.palaces,
  });
  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext(),
  });

  assert.match(snapshot, /【命盘格局】/);
  assert.match(snapshot, /格局：紫府同宫/);
  assert.doesNotMatch(snapshot, /命中条件：紫微与天府同坐命宫/);
  assert.match(snapshot, /古籍依据：《紫微斗数全书》卷一/);
  assert.doesNotMatch(snapshot, /涉及宫位：命宫|涉及星曜：紫微、天府/);
  const taskBook = buildZiweiTaskBookSnapshot({
    payload,
    reportContext: createReportContext(),
  });
  assert.doesNotMatch(taskBook, /命中条件：紫微与天府同坐命宫/);
  assert.match(taskBook, /古籍依据：《紫微斗数全书》卷一/);
  assert.doesNotMatch(taskBook, /涉及宫位：命宫|涉及星曜：紫微、天府/);
  assert.doesNotMatch(snapshot, /因此必然|命盘总分|保证实现/);
  const onlinePromptFacts = formatZiweiPayloadForPrompt(payload);
  assert.match(onlinePromptFacts, /命盘格局：\n格局：紫府同宫/);
  assert.doesNotMatch(onlinePromptFacts, /命中条件：紫微与天府同坐命宫/);
  assert.match(onlinePromptFacts, /古籍依据：《紫微斗数全书》卷一/);
  assert.match(onlinePromptFacts, /命宫；[^\n]*主星：紫微、天府/);
  assert.doesNotMatch(
    onlinePromptFacts,
    /涉及宫位：命宫|涉及星曜：紫微、天府|传统目录|未命中规则|不可唯一复算/,
  );
});

test('紫微在线提示词省略完整十二宫已列明的同宫命中条件', () => {
  const payload = createPayload();
  const spousePalace = payload.palaces.find((palace) => palace.name === '夫妻');
  assert.ok(spousePalace);
  spousePalace.major_stars.push({ name: '太阴', kind: 'major' });
  spousePalace.minor_stars.push({ name: '文曲', kind: 'minor' });
  payload.patterns = detectPatterns({ palaces: payload.palaces });

  const prompt = formatZiweiPayloadForPrompt(payload);
  assert.match(prompt, /夫妻宫；[^\n]*主星：太阴/u);
  assert.match(prompt, /夫妻宫；[^\n]*辅曜：文曲/u);
  assert.match(prompt, /格局：蟾宫折桂/u);
  assert.doesNotMatch(prompt, /命中条件：太阴与文曲同守夫妻宫/u);
  assert.match(prompt, /古籍依据：《紫微斗数全书》卷三·太阴/u);

  const focusedPrompt = formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['命宫'] });
  assert.match(focusedPrompt, /命中条件：太阴与文曲同守夫妻宫/u);

  for (const item of [
    {
      name: '风流彩杖',
      branch: '寅',
      stem: '庚',
      stars: ['贪狼', '陀罗'],
      condition: '贪狼、陀罗同守寅宫命宫',
    },
    {
      name: '巨机居卯',
      branch: '卯',
      stem: '乙',
      stars: ['巨门', '天机'],
      condition: '巨门、天机同守卯宫命宫',
    },
  ]) {
    const complete = createPayload();
    complete.basic_info.chinese_date = `${item.stem}午年四月廿一`;
    complete.palaces[0].earthly_branch = item.branch;
    complete.palaces[0].major_stars = item.stars.map((name) => ({ name, kind: 'major' }));
    complete.patterns = detectPatterns({
      palaces: complete.palaces,
      birthYearHeavenlyStem: item.stem,
    });
    const before = structuredClone(complete);
    for (const text of [
      formatZiweiPayloadForPrompt(complete),
      buildZiweiReadableSnapshot({ payload: complete, reportContext: createReportContext() }),
      buildZiweiTaskBookSnapshot({ payload: complete, reportContext: createReportContext() }),
    ]) {
      assert.ok(text.includes(`格局：${item.name}`));
      assert.ok(
        text.includes(`宫干支甲${item.branch}`) || text.includes(`宫干支：甲${item.branch}`),
      );
      assert.ok(item.stars.every((star) => text.includes(star)));
      assert.ok(!text.includes(item.condition));
      if (item.name === '巨机居卯') assert.match(text, /命中条件：生年天干为乙/);
    }
    const focused = formatZiweiPayloadForPrompt(complete, { focusPalaceNames: ['夫妻'] });
    assert.ok(focused.includes(item.condition));
    assert.deepEqual(complete, before);
  }
});

test('紫微同宫去重保留含独立限定的复合条件', () => {
  const spousePalace = createPalace(2, '夫妻', ['太阴']);
  spousePalace.minor_stars.push({ name: '文曲', kind: 'minor' });
  const pattern = {
    palace_indexes: [2],
    palace_names: ['夫妻'],
    star_names: ['太阴', '文曲'],
  };

  assert.equal(
    isRepeatedZiweiCoLocationCondition(pattern, '太阴与文曲同守夫妻宫', [spousePalace]),
    true,
  );
  assert.equal(
    isRepeatedZiweiCoLocationCondition(pattern, '太阴与文曲同守夫妻宫，太阴另见生年化忌', [
      spousePalace,
    ]),
    false,
  );

  const travelPalace = createPalace(6, '迁移', ['天马', '旬空']);
  const voidPattern = {
    palace_indexes: [6],
    palace_names: ['迁移'],
    star_names: ['天马', '旬空'],
  };
  assert.equal(
    isRepeatedZiweiCoLocationCondition(voidPattern, '天马与旬空同宫', [travelPalace]),
    true,
  );
  assert.equal(isRepeatedZiweiCoLocationCondition(voidPattern, '天马与旬空同宫', []), false);
  assert.equal(
    isRepeatedZiweiCoLocationCondition(voidPattern, '天马与旬空同宫', [
      { ...travelPalace, major_stars: travelPalace.major_stars.slice(0, 1) },
    ]),
    false,
  );
  assert.equal(
    isRepeatedZiweiCoLocationCondition(voidPattern, '天马与旬空同宫', [
      { ...travelPalace, index: 7 },
    ]),
    false,
  );
  assert.equal(
    isRepeatedZiweiCoLocationCondition(voidPattern, '天马与旬空同宫，禄曜会照', [travelPalace]),
    false,
  );
  assert.equal(
    isRepeatedZiweiCoLocationCondition(
      { ...voidPattern, palace_indexes: [6, 0], palace_names: ['迁移', '命宫'] },
      '天马与旬空同宫',
      [travelPalace],
    ),
    false,
  );

  const branchPalace = createPalace(0, '命宫', ['贪狼', '陀罗']);
  branchPalace.earthly_branch = '寅';
  const branchPattern = {
    palace_indexes: [0],
    palace_names: ['命宫'],
    star_names: ['贪狼', '陀罗'],
  };
  assert.equal(
    isRepeatedZiweiCoLocationCondition(branchPattern, '贪狼、陀罗同守寅宫命宫', [branchPalace]),
    true,
  );
  for (const displayed of [
    [],
    [{ ...branchPalace, earthly_branch: '卯' }],
    [{ ...branchPalace, index: 1 }],
    [{ ...branchPalace, major_stars: [], scope_stars: branchPalace.major_stars }],
  ]) {
    assert.equal(
      isRepeatedZiweiCoLocationCondition(branchPattern, '贪狼、陀罗同守寅宫命宫', displayed),
      false,
    );
  }
  assert.equal(
    isRepeatedZiweiCoLocationCondition(branchPattern, '贪狼、陀罗同守寅宫命宫，另见生年化忌', [
      branchPalace,
    ]),
    false,
  );
});

test('紫微身宫格局只借用同一实际宫位已展示的星曜事实', () => {
  const payload = createPayload();
  const bodyPalace = payload.palaces[4]!;
  bodyPalace.is_body_palace = true;
  bodyPalace.major_stars.push({ name: '武曲', kind: 'major' });
  bodyPalace.minor_stars.push({ name: '文曲', kind: 'minor' });
  payload.basic_info.hidden_palaces!.body_palace_name = bodyPalace.name;
  payload.patterns = detectPatterns({ palaces: payload.palaces });

  const pattern = payload.patterns.find((item) => item.name === '兼文武');
  assert.deepEqual(pattern?.palace_indexes, [bodyPalace.index]);
  assert.deepEqual(pattern?.palace_names, [bodyPalace.name]);
  assert.deepEqual(pattern?.matched_conditions, ['文曲、武曲同坐身宫']);
  assert.equal(
    isRepeatedZiweiCoLocationCondition(pattern!, '文曲、武曲同坐身宫', [bodyPalace]),
    true,
  );
  assert.equal(
    isRepeatedZiweiCoLocationCondition(pattern!, '文曲、武曲同坐身宫', [
      { ...bodyPalace, is_body_palace: false },
    ]),
    false,
  );
  assert.equal(
    isRepeatedZiweiCoLocationCondition(pattern!, '文曲、武曲同坐身宫', [
      {
        ...bodyPalace,
        major_stars: [],
        minor_stars: [],
        scope_stars: [...bodyPalace.major_stars, ...bodyPalace.minor_stars],
      },
    ]),
    false,
  );

  const fullPrompt = formatZiweiPayloadForPrompt(payload);
  assert.match(fullPrompt, /财帛宫（身宫）；[^\n]*主星：武曲；辅曜：文曲/u);
  assert.match(fullPrompt, /格局：兼文武/u);
  assert.doesNotMatch(fullPrompt, /命中条件：文曲、武曲同坐身宫/u);

  const focusedPrompt = formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['命宫'] });
  assert.match(focusedPrompt, /格局：兼文武[\s\S]*?命中条件：文曲、武曲同坐身宫/u);
});

test('真实空曜与生年化曜盘在完整宫位已列事实时不重复格局条件', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '格局条件核验',
      gender: 'male',
      dateType: 'solar',
      year: '1993',
      month: '4',
      day: '8',
      timeIndex: '',
      isLeapMonth: false,
      useTrueSolarTime: true,
      birthHour: '23',
      birthMinute: '34',
      birthLongitude: '103.8198',
    }),
  );
  const payload = runtime.payloadByScope.origin;
  const pattern = payload.patterns.find((item) => item.name === '马落空亡');
  assert.deepEqual(pattern?.palace_names, ['迁移']);
  assert.deepEqual(pattern?.star_names, ['天马', '旬空']);

  const prompt = formatZiweiPayloadForPrompt(payload);
  assert.match(prompt, /迁移宫（来因宫）；[^\n]*辅曜：[^\n]*天马[^\n]*旬空/u);
  const patternText = prompt.split('格局：马落空亡\n')[1]?.split('\n\n')[0] ?? '';
  assert.match(patternText, /涉及宫位：迁移/u);
  assert.match(patternText, /古籍依据：《紫微斗数全书》卷一/u);
  assert.doesNotMatch(patternText, /命中条件：天马与旬空同宫/u);

  const focused = formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['命宫'] });
  assert.match(focused, /格局：马落空亡[\s\S]*?命中条件：天马与旬空同宫/u);

  const natalRuntime = await calculateZiweiChart(
    {
      name: '格局条件实际消费',
      gender: '女',
      dateType: 'lunar',
      birthDate: '1994-10-26',
      birthTimeIndex: 9,
      algorithm: 'default',
    },
    { scopes: ['origin'], horoscopeContext: { dateStr: '2026-09-18', hourIndex: 6 } },
  );
  const natalPayload = natalRuntime.payloadByScope.origin;
  const natalPattern = natalPayload.patterns.find((item) => item.name === '两重华盖');
  const lifePalace = natalPayload.palaces.find((item) => item.name === '命宫');
  assert.ok(natalPattern);
  assert.ok(lifePalace);
  assert.equal(lifePalace.index, 0);
  assert.equal(lifePalace.earthly_branch, '寅');
  assert.deepEqual(natalPattern.star_names, ['禄存', '廉贞化禄', '地空']);
  assert.deepEqual(natalPattern.matched_conditions, ['禄存与生年化禄同坐命宫', '命宫见地空']);
  assert.equal(lifePalace.major_stars.find((star) => star.name === '廉贞')?.birth_mutagen, '禄');
  const natalBefore = structuredClone(natalPayload);
  for (const [text, identity] of [
    [
      formatZiweiPayloadForPrompt(natalPayload),
      /命宫；[^\n]*廉贞，亮度：庙，生年化禄；辅曜：禄存、地空/u,
    ],
    [
      buildZiweiReadableSnapshot({ payload: natalPayload, reportContext: createReportContext() }),
      /宫位：命宫\n宫干支：丙寅\n[^\n]*\n主星：廉贞\(庙\/生年化禄\)\n辅星：禄存、地空/u,
    ],
    [
      buildZiweiTaskBookSnapshot({ payload: natalPayload, reportContext: createReportContext() }),
      /宫位：命宫｜宫干支：丙寅｜[^\n]*主星：廉贞\(庙\/生年化禄\)｜辅星：禄存、地空/u,
    ],
    [
      buildZiweiPrompt({
        runtime: natalRuntime,
        scope: 'origin',
        currentTime: new Date('2026-10-03T00:00:00Z'),
      }),
      /命宫；[^\n]*廉贞，亮度：庙，生年化禄；辅曜：禄存、地空/u,
    ],
    [
      buildCombinedZiweiPrompt(natalPayload, 'life', '请分析命局结构。', {
        currentTime: new Date('2026-10-03T00:00:00Z'),
      }),
      /宫位：命宫｜宫干支：丙寅｜[^\n]*主星：廉贞\(庙\/生年化禄\)｜辅星：禄存、地空/u,
    ],
  ] as const) {
    assert.match(text, identity);
    assert.match(text, /格局：两重华盖/u);
    assert.match(text, /两重华盖，谓禄存化禄坐命遇空劫是也。/u);
    assert.doesNotMatch(text, /禄存与生年化禄同坐命宫|命宫见地空/u);
    const targetPattern = text.split('格局：两重华盖\n')[1]?.split('\n\n')[0];
    assert.ok(targetPattern);
    assert.doesNotMatch(targetPattern, /涉及星曜：/u);
  }
  const natalFocused = formatZiweiPayloadForPrompt(natalPayload, {
    focusPalaceNames: ['夫妻宫'],
  });
  assert.match(natalFocused, /命中条件：禄存与生年化禄同坐命宫；命宫见地空/u);
  assert.match(natalFocused, /涉及星曜：廉贞化禄/u);
  assert.doesNotMatch(natalFocused, /^\s*命宫(?:（[^）]+）)?；/mu);
  for (const condition of natalPattern.matched_conditions) {
    assert.equal(isZiweiConditionRestatedByPalaces(natalPattern, condition, [lifePalace]), true);
    for (const displayed of [
      [],
      [{ ...lifePalace, index: 1 }],
      [{ ...lifePalace, name: '夫妻宫' }],
      [
        {
          ...lifePalace,
          major_stars: [],
          minor_stars: [],
          other_stars: [],
          scope_stars: [
            ...lifePalace.major_stars,
            ...lifePalace.minor_stars,
            ...lifePalace.other_stars,
          ],
        },
      ],
    ]) {
      assert.equal(isZiweiConditionRestatedByPalaces(natalPattern, condition, displayed), false);
      const summary = buildZiweiMatchedPatternSummary(natalPayload, {
        displayedPalaces: displayed,
      }).find((item) => item.格局 === '两重华盖');
      assert.ok(summary?.命中条件?.includes(condition));
      assert.equal(summary?.涉及星曜, '廉贞化禄');
    }
    assert.equal(
      isZiweiConditionRestatedByPalaces(natalPattern, `${condition}，且不见化忌`, [lifePalace]),
      false,
    );
  }
  assert.equal(
    isZiweiConditionRestatedByPalaces(natalPattern, '命宫见地空', [
      {
        ...lifePalace,
        minor_stars: lifePalace.minor_stars.filter((star) => star.name !== '地空'),
        other_stars: lifePalace.other_stars.filter((star) => star.name !== '地空'),
      },
    ]),
    false,
  );
  for (const birthMutagen of [undefined, '权'] as const) {
    assert.equal(
      isZiweiConditionRestatedByPalaces(natalPattern, '禄存与生年化禄同坐命宫', [
        {
          ...lifePalace,
          major_stars: lifePalace.major_stars.map((star) => ({
            ...star,
            birth_mutagen: birthMutagen,
            active_scope_mutagen: '禄' as const,
            horoscope_mutagen: '禄' as const,
          })),
        },
      ]),
      false,
    );
    const summary = buildZiweiMatchedPatternSummary(natalPayload, {
      displayedPalaces: [
        {
          ...lifePalace,
          major_stars: lifePalace.major_stars.map((star) => ({
            ...star,
            birth_mutagen: birthMutagen,
            active_scope_mutagen: '禄' as const,
            horoscope_mutagen: '禄' as const,
          })),
        },
      ],
    }).find((item) => item.格局 === '两重华盖');
    assert.ok(summary?.命中条件?.includes('禄存与生年化禄同坐命宫'));
    assert.equal(summary?.涉及星曜, '廉贞化禄');
  }
  assert.equal(
    isZiweiConditionRestatedByPalaces(
      { ...natalPattern, star_names: ['禄存', '太阴化禄', '地空'] },
      '禄存与生年化禄同坐命宫',
      [lifePalace],
    ),
    false,
  );
  assert.deepEqual(natalPayload, natalBefore);
});

test('紫微单宫定位条件仅在宫位中已有同一星曜事实时省略', () => {
  const palace = createPalace(2, '夫妻', ['太阴']);
  palace.earthly_branch = '亥';
  palace.major_stars[0]!.brightness = '陷';
  const pattern = {
    palace_indexes: [2],
    palace_names: ['夫妻'],
    star_names: ['太阴'],
  };

  assert.equal(isZiweiConditionRestatedByPalaces(pattern, '太阴在亥宫守夫妻宫', [palace]), true);
  assert.equal(
    isZiweiConditionRestatedByPalaces(pattern, '太阴以“陷”亮度守夫妻宫', [palace]),
    true,
  );
  assert.equal(isZiweiConditionRestatedByPalaces(pattern, '太阴在子宫守夫妻宫', [palace]), false);
  assert.equal(
    isZiweiConditionRestatedByPalaces(pattern, '太阴以“庙”亮度守夫妻宫', [palace]),
    false,
  );
  assert.equal(
    isZiweiConditionRestatedByPalaces(pattern, '太阴守夫妻宫，且不见火铃', [palace]),
    false,
  );
  assert.equal(isZiweiConditionRestatedByPalaces(pattern, '太阴守夫妻宫', []), false);
  assert.equal(
    isZiweiConditionRestatedByPalaces(pattern, '太阴守夫妻宫', [{ ...palace, index: 3 }]),
    false,
  );
  palace.major_stars[0]!.brightness = undefined;
  assert.equal(
    isZiweiConditionRestatedByPalaces(pattern, '太阴以“陷”亮度守夫妻宫', [palace]),
    false,
  );

  assert.equal(isZiweiConditionRestatedByPalaces(pattern, '夫妻宫在亥宫', [palace]), true);
  for (const displayed of [
    [],
    [{ ...palace, index: 3 }],
    [{ ...palace, name: '官禄' }],
    [{ ...palace, earthly_branch: '子' }],
  ]) {
    assert.equal(isZiweiConditionRestatedByPalaces(pattern, '夫妻宫在亥宫', displayed), false);
  }
  assert.equal(
    isZiweiConditionRestatedByPalaces(pattern, '夫妻宫在亥宫，属于古籍附加条件', [palace]),
    false,
  );

  const branchPayload = createPayload();
  branchPayload.palaces[0] = createPalace(0, '命宫');
  branchPayload.palaces[0].earthly_branch = '寅';
  branchPayload.basic_info.soul_palace_branch = '寅';
  branchPayload.palaces[4] = createPalace(4, '财帛', ['天府']);
  branchPayload.palaces[8] = createPalace(8, '官禄', ['天相']);
  branchPayload.patterns = detectPatterns({ palaces: branchPayload.palaces });
  const branchBefore = structuredClone(branchPayload);
  const branchPattern = branchPayload.patterns.find((item) => item.name === '府相朝垣');
  assert.deepEqual(branchPattern?.matched_conditions, [
    '命宫在寅宫',
    '天府、天相分别坐财帛宫与官禄宫',
  ]);
  for (const text of [
    formatZiweiPayloadForPrompt(branchPayload),
    buildZiweiTaskBookSnapshot({ payload: branchPayload, reportContext: createReportContext() }),
  ]) {
    assert.match(text, /命宫[；｜][^\n]*宫干支：?甲寅/u);
    const patternText = text.split('格局：府相朝垣\n')[1]?.split('\n\n')[0];
    assert.ok(patternText);
    assert.match(text, /财帛宫[；｜][^\n]*天府/u);
    assert.match(text, /官禄宫[；｜][^\n]*天相/u);
    assert.doesNotMatch(patternText, /命中条件：/u);
    assert.match(text, /古籍依据：《紫微斗数全书》卷三/u);
    assert.doesNotMatch(text, /命中条件：命宫在寅宫/u);
  }
  assert.match(
    formatZiweiPayloadForPrompt(branchPayload, { focusPalaceNames: ['财帛'] }),
    /格局：府相朝垣[\s\S]*?命中条件：命宫在寅宫；天府、天相分别坐财帛宫与官禄宫/u,
  );
  assert.deepEqual(branchPayload, branchBefore);

  const separatedPayload = structuredClone(branchPayload);
  const separatedSoul = separatedPayload.palaces[0];
  separatedSoul.major_stars = [{ name: '廉贞', kind: 'major' }];
  separatedSoul.summary_tags = ['廉贞'];
  const separatedBody = separatedPayload.palaces[10];
  separatedBody.major_stars = [{ name: '武曲', kind: 'major' }];
  separatedBody.summary_tags = ['武曲'];
  separatedBody.is_body_palace = true;
  separatedPayload.basic_info.body_palace_branch = separatedBody.earthly_branch;
  separatedPayload.patterns = detectPatterns({ palaces: separatedPayload.palaces });
  const separatedPattern = separatedPayload.patterns.find((item) => item.name === '财与囚仇');
  assert.ok(separatedPattern);
  assert.deepEqual(separatedPattern.matched_conditions, ['武曲、廉贞分守命宫与身宫']);
  const separatedBefore = structuredClone(separatedPayload);
  for (const text of [
    formatZiweiPayloadForPrompt(separatedPayload),
    buildZiweiTaskBookSnapshot({ payload: separatedPayload, reportContext: createReportContext() }),
  ]) {
    const patternText = text.split('格局：财与囚仇\n')[1]?.split('\n\n')[0];
    assert.ok(patternText);
    assert.match(text, /命宫[；｜][^\n]*廉贞/u);
    assert.match(text, /福德宫(?:（身宫）)?[；｜][^\n]*武曲/u);
    assert.match(text, /福德宫（身宫）|身宫：福德宫/u);
    assert.ok(patternText.includes(separatedPattern.sources![0]));
    assert.doesNotMatch(patternText, /命中条件：/u);
  }
  assert.match(
    formatZiweiPayloadForPrompt(separatedPayload, { focusPalaceNames: ['命宫'] }),
    /格局：财与囚仇[\s\S]*?命中条件：武曲、廉贞分守命宫与身宫/u,
  );
  const missingBodyStar = buildZiweiMatchedPatternSummary(separatedPayload, {
    displayedPalaces: [separatedSoul, { ...separatedBody, major_stars: [] }],
  }).find((item) => item.格局 === '财与囚仇');
  assert.equal(missingBodyStar?.命中条件, '武曲、廉贞分守命宫与身宫');
  assert.deepEqual(separatedPayload, separatedBefore);

  const brightPalace = createPalace(0, '命宫', ['贪狼']);
  brightPalace.major_stars[0].brightness = '庙';
  brightPalace.other_stars = [{ name: '火星', kind: 'other', brightness: '旺' }];
  const brightPattern = {
    palace_indexes: [0],
    palace_names: ['命宫'],
    star_names: ['贪狼', '火星'],
  };
  assert.equal(
    isZiweiConditionRestatedByPalaces(brightPattern, '贪狼、火星亮度均为庙或旺', [brightPalace]),
    true,
  );
  for (const displayed of [
    [],
    [{ ...brightPalace, index: 1 }],
    [{ ...brightPalace, other_stars: [{ ...brightPalace.other_stars[0], brightness: undefined }] }],
    [{ ...brightPalace, other_stars: [{ ...brightPalace.other_stars[0], brightness: '陷' }] }],
    [{ ...brightPalace, other_stars: [], scope_stars: brightPalace.other_stars }],
  ]) {
    assert.equal(
      isZiweiConditionRestatedByPalaces(brightPattern, '贪狼、火星亮度均为庙或旺', displayed),
      false,
    );
  }
  assert.equal(
    isZiweiConditionRestatedByPalaces(brightPattern, '贪狼、火星亮度均为庙或旺，且不见化忌', [
      brightPalace,
    ]),
    false,
  );
  assert.equal(
    isZiweiConditionRestatedByPalaces(brightPattern, '两颗化曜亮度均为庙或旺', [brightPalace]),
    false,
  );

  const splitPalace = createPalace(1, '兄弟宫', []);
  splitPalace.other_stars = brightPalace.other_stars;
  const splitPattern = {
    ...brightPattern,
    palace_indexes: [0, 1],
    palace_names: ['命宫', '兄弟宫'],
  };
  const firstPalace = { ...brightPalace, other_stars: [] };
  assert.equal(
    isZiweiConditionRestatedByPalaces(splitPattern, '贪狼、火星亮度均为庙或旺', [
      firstPalace,
      splitPalace,
    ]),
    true,
  );
  assert.equal(
    isZiweiConditionRestatedByPalaces(splitPattern, '贪狼、火星亮度均为庙或旺', [firstPalace]),
    false,
  );

  const complete = createPayload();
  complete.palaces[0] = brightPalace;
  complete.patterns = detectPatterns({ palaces: complete.palaces });
  const before = structuredClone(complete);
  for (const [text, starText, fireText] of [
    [formatZiweiPayloadForPrompt(complete), '贪狼，亮度：庙', '火星，亮度：旺'],
    [
      buildZiweiReadableSnapshot({ payload: complete, reportContext: createReportContext() }),
      '贪狼(庙)',
      '火星(旺)',
    ],
    [
      buildZiweiTaskBookSnapshot({ payload: complete, reportContext: createReportContext() }),
      '贪狼(庙)',
      '火星(旺)',
    ],
  ]) {
    assert.match(text, /格局：贪火相逢/);
    assert.ok(text.includes(starText));
    assert.ok(text.includes(fireText));
    assert.doesNotMatch(text, /贪狼、火星亮度均为庙或旺/);
  }
  assert.match(
    formatZiweiPayloadForPrompt(complete, { focusPalaceNames: ['夫妻'] }),
    /贪狼、火星亮度均为庙或旺/,
  );
  assert.deepEqual(complete, before);

  const singleSunPalace = createPalace(0, '命宫', ['太阳']);
  singleSunPalace.earthly_branch = '午';
  const voidPalace = createPalace(0, '命宫', ['廉贞']);
  voidPalace.other_stars = [
    { name: '旬空', kind: 'other' },
    { name: '天空', kind: 'other' },
  ];
  for (const [name, condition, shownPalace] of [
    ['金灿光辉', '太阳单守午宫命宫', singleSunPalace],
    ['生不逢时', '廉贞守命并同见旬空、天空', voidPalace],
  ] as const) {
    const payload = createPayload();
    payload.palaces[0] = shownPalace;
    payload.patterns = detectPatterns({ palaces: payload.palaces });
    const actualPattern = payload.patterns.find((item) => item.name === name);
    assert.ok(actualPattern);
    assert.deepEqual(actualPattern.matched_conditions, [condition]);
    assert.equal(isZiweiConditionRestatedByPalaces(actualPattern, condition, [shownPalace]), true);
    for (const displayed of [
      [],
      [{ ...shownPalace, index: 1 }],
      [{ ...shownPalace, name: '兄弟' }],
      [{ ...shownPalace, major_stars: [], scope_stars: shownPalace.major_stars }],
    ]) {
      assert.equal(isZiweiConditionRestatedByPalaces(actualPattern, condition, displayed), false);
    }
    assert.equal(
      isZiweiConditionRestatedByPalaces(actualPattern, `${condition}，且不见化忌`, [shownPalace]),
      false,
    );
    const original = structuredClone(payload);
    for (const text of [
      formatZiweiPayloadForPrompt(payload),
      buildZiweiReadableSnapshot({ payload, reportContext: createReportContext() }),
      buildZiweiTaskBookSnapshot({ payload, reportContext: createReportContext() }),
    ]) {
      assert.ok(text.includes(`格局：${name}`));
      assert.ok(text.includes('古籍依据：'));
      for (const star of [...shownPalace.major_stars, ...shownPalace.other_stars]) {
        assert.ok(text.includes(star.name));
      }
      assert.equal(text.includes(condition), false);
    }
    assert.ok(
      formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['夫妻'] }).includes(condition),
    );
    assert.deepEqual(payload, original);
  }
  const singlePattern = { palace_indexes: [0], palace_names: ['命宫'], star_names: ['太阳'] };
  for (const invalidPalace of [
    { ...singleSunPalace, earthly_branch: '巳' },
    { ...singleSunPalace, major_stars: [{ name: '太阴', kind: 'major' as const }] },
    {
      ...singleSunPalace,
      major_stars: [...singleSunPalace.major_stars, { name: '太阴', kind: 'major' as const }],
    },
  ]) {
    assert.equal(
      isZiweiConditionRestatedByPalaces(singlePattern, '太阳单守午宫命宫', [invalidPalace]),
      false,
    );
  }
  assert.equal(
    isZiweiConditionRestatedByPalaces(
      { palace_indexes: [0], palace_names: ['命宫'], star_names: ['廉贞', '旬空', '天空'] },
      '廉贞守命并同见旬空、天空',
      [{ ...voidPalace, other_stars: [voidPalace.other_stars[0]] }],
    ),
    false,
  );

  const mutagenPalace = createPalace(0, '命宫', ['贪狼', '武曲']);
  mutagenPalace.major_stars[0].birth_mutagen = '权';
  mutagenPalace.major_stars[1].birth_mutagen = '禄';
  const mutagenPattern = {
    palace_indexes: [0],
    palace_names: ['命宫'],
    star_names: ['贪狼化权', '武曲化禄'],
  };
  assert.equal(
    isZiweiConditionRestatedByPalaces(mutagenPattern, '生年化权、生年化禄同守命宫', [
      mutagenPalace,
    ]),
    true,
  );
  assert.equal(
    isZiweiConditionRestatedByPalaces(mutagenPattern, '两颗化曜亮度均为庙或旺', [mutagenPalace]),
    false,
  );
  assert.equal(
    isZiweiConditionRestatedByPalaces(mutagenPattern, '生年化权、生年化禄同守命宫', [
      {
        ...mutagenPalace,
        major_stars: [mutagenPalace.major_stars[0]],
      },
    ]),
    false,
  );
});

test('紫微在线提示词省略未出现的可选格局加强条件', () => {
  const payload = createPayload();
  const fudePalace = payload.palaces.find((palace) => palace.name === '福德');
  assert.ok(fudePalace);
  fudePalace.minor_stars.push({ name: '文昌', kind: 'minor' }, { name: '文曲', kind: 'minor' });
  payload.patterns = detectPatterns({ palaces: payload.palaces });

  const promptWithoutEnhancer = formatZiweiPayloadForPrompt(payload);
  assert.match(promptWithoutEnhancer, /格局：玉袖天香/);
  assert.doesNotMatch(promptWithoutEnhancer, /命中条件：文昌与文曲同守福德宫/);
  assert.doesNotMatch(promptWithoutEnhancer, /未附加紫微加强条件/);

  fudePalace.major_stars.push({ name: '紫微', kind: 'major' });
  payload.patterns = detectPatterns({ palaces: payload.palaces });
  const promptWithEnhancer = formatZiweiPayloadForPrompt(payload);
  assert.match(promptWithEnhancer, /福德宫同时见紫微加强条件/);
  assert.doesNotMatch(promptWithEnhancer, /文昌与文曲同守福德宫/);

  const focusedPrompt = formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['命宫'] });
  assert.match(focusedPrompt, /命中条件：文昌与文曲同守福德宫/);
});

test('真实紫微盘的重点宫星只在详细资料列出一次，十二宫索引保留完整宫位', async () => {
  const runtime = await getRepeatedOriginChart();
  const snapshot = buildZiweiReadableSnapshot({
    payload: runtime.payloadByScope.origin,
    reportContext: createReportContext(),
  });
  const focusSection = snapshot.split('【重点宫位资料】\n')[1]?.split('\n【十二宫资料】')[0] ?? '';
  const indexSection = snapshot.split('【十二宫资料】\n')[1] ?? '';
  const focusPalace = focusSection.match(/宫位：([^\n]+)/u)?.[1];
  assert.ok(focusPalace);
  assert.match(focusSection, /主星：/u);
  const palaceIndex = indexSection.split('\n\n');
  assert.equal(palaceIndex.length, 12);
  assert.equal(
    palaceIndex.find(
      (item) => item.startsWith(`宫位：${focusPalace}\n`) || item === `宫位：${focusPalace}`,
    ),
    `宫位：${focusPalace}`,
  );
  assert.ok(palaceIndex.some((item) => item.includes('主星：')));
});

test('真实紫微盘将已列在宫位资料中的证据去重并忠实标注星曜亮度', async () => {
  const runtime = await getRepeatedOriginChart();
  const payload = runtime.payloadByScope.origin;
  const prompt = formatZiweiPayloadForPrompt(payload);

  assert.ok(payload.evidence_pool.length > 0);
  assert.match(prompt, /命宫；[^\n]*主星：天机/);
  assert.match(prompt, /福德宫；[^\n]*太阴，亮度：陷，生年化科/);
  assert.match(prompt, /福德宫；[^\n]*标签：[^\n]*三方四正见化忌/);
  assert.match(prompt, /父母宫；[^\n]*宫干飞化：[^\n]*化忌入命宫/);
  assert.match(prompt, /财帛宫（身宫）；[^\n]*辅曜：[^\n]*擎羊，亮度：陷/);
  assert.match(prompt, /格局：君子在野/);
  assert.doesNotMatch(prompt, /命中条件：擎羊以“陷”亮度守财帛/);
  assert.match(prompt, /命中条件：天魁、天钺一曜坐命，另一曜在对宫/);
  assert.match(prompt, /命中条件：左辅、右弼分别从命宫三方会照/);
  assert.match(prompt, /身宫落宫：财帛宫/);
  assert.doesNotMatch(prompt, /庙旺陷|庙旺平|命身主轴：|重现实利禄与财富运作/);
  assert.doesNotMatch(
    prompt,
    /【主证】命宫主星为天机|【主证】福德三方四正见化忌|【主证】父母化忌入命宫/,
  );
  assert.doesNotMatch(prompt, /证据资料：|证据附录：/);
  assert.match(prompt, /田宅宫（来因宫）；[^\n]*主星：贪狼，亮度：庙/);
  assert.match(prompt, /官禄宫；[^\n]*自化：自化禄/);
  assert.doesNotMatch(prompt, /标签：[^\n]*(?:身宫|来因宫|自化禄|有生年四化)/);
  const missingIdentities = structuredClone(payload);
  missingIdentities.palaces.find((palace) => palace.name === '财帛')!.is_body_palace = false;
  missingIdentities.palaces.find((palace) => palace.name === '田宅')!.is_original_palace = false;
  missingIdentities.palaces.find((palace) => palace.name === '官禄')!.self_mutagens = [];
  delete missingIdentities.palaces.find((palace) => palace.name === '福德')!.major_stars[0]
    .birth_mutagen;
  const missingIdentityPrompt = formatZiweiPayloadForPrompt(missingIdentities);
  assert.match(missingIdentityPrompt, /财帛宫；[^\n]*标签：[^\n]*身宫/);
  assert.match(missingIdentityPrompt, /田宅宫；[^\n]*标签：[^\n]*来因宫/);
  assert.match(missingIdentityPrompt, /官禄宫；[^\n]*标签：[^\n]*自化禄/);
  assert.match(missingIdentityPrompt, /福德宫；[^\n]*标签：[^\n]*有生年四化/);
  assert.doesNotMatch(prompt, /运限曜：/);

  const focusedPrompt = formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['命宫'] });
  assert.match(focusedPrompt, /【主证】父母化忌入命宫/);
  assert.doesNotMatch(focusedPrompt, /【主证】命宫主星为天机/);
  assert.match(focusedPrompt, /命中条件：擎羊以“陷”亮度守财帛/);

  const reportContext = createReportContext();
  const readableSnapshot = buildZiweiReadableSnapshot({ payload, reportContext });
  const taskBookSnapshot = buildZiweiTaskBookSnapshot({ payload, reportContext });
  for (const snapshot of [readableSnapshot, taskBookSnapshot]) {
    assert.match(snapshot, /格局：君子在野/);
    assert.doesNotMatch(snapshot, /命中条件：擎羊以“陷”亮度守财帛/);
  }

  const scopeCases = [
    {
      birthDate: '1990-05-15',
      algorithm: 'default',
      yearlyLanding: '仆役',
      monthlyLanding: '兄弟',
      yearly: [
        ['廉贞', '忌', '仆役', '命宫'],
        ['天同', '禄', '财帛', '田宅'],
        ['天机', '权', '命宫', '疾厄'],
        ['文昌', '科', '仆役', '命宫'],
      ],
      monthly: [
        ['太阴', '忌', '福德', '田宅'],
        ['天机', '禄', '命宫', '父母'],
        ['天梁', '权', '迁移', '疾厄'],
        ['紫微', '科', '父母', '福德'],
      ],
    },
    {
      birthDate: '1992-08-21',
      algorithm: 'zhongzhou',
      yearlyLanding: '福德',
      monthlyLanding: '仆役',
      yearly: [
        ['廉贞', '忌', '官禄', '福德'],
        ['天同', '禄', '疾厄', '仆役'],
        ['天机', '权', '兄弟', '子女'],
        ['文昌', '科', '福德', '命宫'],
      ],
      monthly: [
        ['太阴', '忌', '子女', '官禄'],
        ['天机', '禄', '兄弟', '迁移'],
        ['天梁', '权', '父母', '财帛'],
        ['紫微', '科', '命宫', '疾厄'],
      ],
    },
  ] as const;
  for (const expected of scopeCases) {
    const scopedRuntime = await calculateZiweiChart(
      {
        name: '运限四化显示核验',
        gender: '女',
        dateType: 'solar',
        birthDate: expected.birthDate,
        birthTimeIndex: 4,
        algorithm: expected.algorithm,
      },
      {
        scopes: ['origin', 'yearly', 'monthly'],
        horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
      },
    );
    const structuredBefore = structuredClone(scopedRuntime.payloadByScope);
    for (const scope of ['yearly', 'monthly'] as const) {
      const scopePayload = scopedRuntime.payloadByScope[scope]!;
      const scopeLabel = scope === 'yearly' ? '流年' : '流月';
      const landing = scope === 'yearly' ? expected.yearlyLanding : expected.monthlyLanding;
      const stemBranch = scope === 'yearly' ? '丙午' : '乙未';
      for (const text of [
        formatZiweiPayloadForPrompt(scopePayload),
        buildZiweiPrompt({
          runtime: scopedRuntime,
          scope,
          currentTime: new Date('2026-10-03T00:00:00Z'),
          schools: ['sanhe', 'feixing'],
        }),
      ]) {
        for (const [star, mutagen, nativePalace, dynamicPalace] of expected[scope]) {
          const nativeName = nativePalace.endsWith('宫') ? nativePalace : `${nativePalace}宫`;
          const palaceLine = text
            .split('\n')
            .find(
              (line) =>
                line.trimStart().startsWith(`${nativeName}；`) ||
                line.trimStart().startsWith(`${nativeName}（`),
            );
          assert.ok(palaceLine, `${expected.birthDate}${scopeLabel}${nativeName}`);
          assert.match(palaceLine, new RegExp(`${star}，[^、\\n]*当前化${mutagen}`));
          assert.ok(palaceLine.includes(`动态宫名：${dynamicPalace}`));
          assert.ok(
            !text.includes(`${scopeLabel}${star}化${mutagen}入本命${nativeName}`),
            `${scopeLabel}${star}化${mutagen}只由实际宫位表达`,
          );
        }
        assert.ok(
          text.includes(`${scopeLabel}干支为${stemBranch}，命宫由运限对象定位到本命${landing}宫。`),
        );
        assert.doesNotMatch(
          text,
          /标签：[^\n]*(?:身宫|来因宫|自化[禄权科忌]|流年落宫|流月落宫|有生年四化|有当前运限四化)/,
        );
        assert.match(text, /运限命中：(?:流年|流月)落宫/);
        if (expected.birthDate === '1990-05-15' && scope === 'yearly') {
          const propertyLine = text
            .split('\n')
            .find((line) => line.trimStart().startsWith('田宅宫（来因宫）'));
          assert.ok(propertyLine);
          assert.match(propertyLine, /辅曜：天姚、凤阁、寡宿、年解；/);
          assert.match(propertyLine, /运限曜：年解（流年）、流陀（流年）；/);
        }
      }
    }
    for (const scope of ['yearly', 'monthly'] as const) {
      const scopePayload = scopedRuntime.payloadByScope[scope]!;
      const taskBook = buildCombinedZiweiPrompt(scopePayload, 'life', '解读本命与运限关系。');
      for (const [star, mutagen, nativePalace, dynamicPalace] of expected[scope]) {
        const nativeName = nativePalace.endsWith('宫') ? nativePalace : `${nativePalace}宫`;
        const palaceLine = taskBook
          .split('\n')
          .find((line) => line.startsWith(`宫位：${nativeName}｜`));
        assert.ok(palaceLine, `${expected.birthDate}${scope}${nativeName}`);
        assert.match(palaceLine, new RegExp(`${star}\\([^)、]*当前运限化${mutagen}\\)`));
        assert.doesNotMatch(palaceLine, /当前运限四化：/);
        const dynamicName = dynamicPalace.endsWith('宫') ? dynamicPalace : `${dynamicPalace}宫`;
        assert.ok(taskBook.includes(`（动态${dynamicName}）`));
      }
      if (expected.birthDate === '1990-05-15' && scope === 'yearly') {
        const financeLine = taskBook.split('\n').find((line) => line.startsWith('宫位：财帛宫｜'))!;
        assert.match(financeLine, /天同\(平\/生年化忌\/当前运限化禄\)/);
        assert.match(taskBook, /飞星走向：/);
        assert.match(taskBook, /自化情况：自化禄/);
      }
    }
    assert.deepEqual(scopedRuntime.payloadByScope, structuredBefore);

    if (expected.birthDate !== '1990-05-15') continue;
    const yearlyPayload = scopedRuntime.payloadByScope.yearly!;
    const title = '流年廉贞化忌入本命仆役宫（当前流年命宫）';
    assert.ok(
      formatZiweiPayloadForPrompt(yearlyPayload, { focusPalaceNames: ['命宫'] }).includes(title),
    );
    assert.ok(
      !formatZiweiPayloadForPrompt(yearlyPayload, { focusPalaceNames: ['仆役'] }).includes(title),
    );
    const preservedCases = [
      '缺星曜',
      '缺当前化',
      '缺动态宫名',
      '资料缺口',
      '额外说明',
      '额外正文',
    ] as const;
    for (const condition of preservedCases) {
      const changed = structuredClone(yearlyPayload);
      const target = changed.palaces.find((palace) => palace.name === '仆役')!;
      const evidence = changed.evidence_pool.find((item) => item.title === title)!;
      assert.ok(evidence);
      if (condition === '缺星曜') {
        target.major_stars = target.major_stars.filter((star) => star.name !== '廉贞');
      } else if (condition === '缺当前化') {
        const star = target.major_stars.find((item) => item.name === '廉贞')!;
        delete star.active_scope_mutagen;
      } else if (condition === '缺动态宫名') {
        delete target.dynamic_scope_name;
      } else if (condition === '资料缺口') {
        evidence.status = '资料缺口';
      } else if (condition === '额外说明') {
        evidence.description += '该宫另见独立条件。';
        evidence.promptText = `${evidence.title}：${evidence.description}`;
      } else {
        evidence.promptText = `${evidence.title}：另见独立条件。`;
      }
      const changedPrompt = formatZiweiPayloadForPrompt(changed);
      assert.ok(changedPrompt.includes(title), `${condition}须保留证据`);
      if (condition === '缺星曜' || condition === '缺当前化') {
        const changedTaskBook = buildCombinedZiweiPrompt(changed, 'life', '解读本命与运限关系。');
        assert.ok(changedTaskBook.includes('廉贞化忌→仆役宫（动态命宫）'));
      }
      if (condition === '额外说明' || condition === '额外正文') {
        assert.ok(changedPrompt.includes('独立条件'));
      }
    }
    assert.deepEqual(scopedRuntime.payloadByScope, structuredBefore);
  }
});

test('真实紫微本命公共入口与内嵌资料只在宫内展示生年四化', async () => {
  const runtime = await getRepeatedOriginChart();
  assert.equal(runtime.natalSnapshot, undefined);
  const payload = runtime.payloadByScope.origin;
  const mutagenStars = payload.palaces.flatMap((palace) =>
    [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars]
      .filter((star) => star.birth_mutagen)
      .map((star) => ({ palace: palace.name, star })),
  );
  assert.equal(mutagenStars.length, 4);
  for (const prompt of [
    buildPublicZiweiPromptForRuntime({
      result: runtime,
      scope: 'origin',
      question: '解读本命结构。',
    }),
    formatZiweiEvidenceText(runtime, 'origin'),
  ]) {
    assert.doesNotMatch(prompt, /生年四化：|未标出生年四化/u);
    for (const { palace, star } of mutagenStars) {
      const line = prompt.split('\n').find((item) => item.trimStart().startsWith(`${palace}（`));
      assert.ok(line, `${palace}须保留宫位资料`);
      assert.ok(line.includes(`${star.name}(`));
      assert.ok(line.includes(`生年化${star.birth_mutagen}`));
    }
    assert.match(prompt, /福德(?:宫)?（[^\n]*太阴\(陷，生年化科\)/u);
  }
});

test('紫微私有公共资料复用四化去重并保留额外动态落点', async () => {
  const runtime = await getRepeatedOriginChart();
  const payload = createPayload();
  payload.palaces[4].major_stars = [
    { name: '天同', kind: 'major', birth_mutagen: '禄', active_scope_mutagen: '科' },
  ];
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'yearly',
    label: '流年',
    mutagen_map: [
      {
        star: '天同',
        mutagen: '科',
        palace_index: 4,
        palace_name: '财帛',
        dynamic_palace_name: '流年命宫',
      },
      { star: '文昌', mutagen: '忌', palace_index: 11, palace_name: '兄弟' },
    ],
  };
  const selectedRuntime = {
    ...runtime,
    payloadByScope: { ...runtime.payloadByScope, yearly: payload },
  };
  const texts = () => [
    buildPublicZiweiPromptForRuntime({
      result: selectedRuntime,
      scope: 'yearly',
      question: '解读流年。',
    }),
    formatZiweiEvidenceText(selectedRuntime, 'yearly'),
  ];
  for (const prompt of texts()) {
    assert.match(prompt, /财帛（[^\n]*天同\(生年化禄，当前化科\)/u);
    assert.match(prompt, /当前四化：天同化科入本命财帛（动态流年命宫）；文昌化忌入本命兄弟/u);
  }
  payload.palaces[4].dynamic_scope_name = '流年命宫';
  for (const prompt of texts()) {
    assert.match(prompt, /当前四化：文昌化忌入本命兄弟/u);
    assert.doesNotMatch(prompt, /天同化科入本命财帛/u);
    assert.match(prompt, /动态宫名：流年命宫/u);
  }
});

test('紫微在线提示词无四化事实时不输出资料状态占位', () => {
  const prompt = formatZiweiPayloadForPrompt(createPayload());
  assert.doesNotMatch(prompt, /生年四化：|当前四化：|未记录生年四化|未记录当前四化/);
});

test('紫微宫位证据仅省标准复述，附加条件与未展示运限事实继续进入完整任务书', () => {
  const payload = createPayload();
  const life = payload.palaces[0];
  life.major_stars[0].birth_mutagen = '禄';
  life.major_stars[0].active_scope_mutagen = '科';
  life.summary_tags.push('三方四正见化禄');
  life.self_mutagens = ['忌'];
  life.mutaged_palaces = [{ mutagen: '权', palace_index: 4, palace_name: '财帛' }];
  life.scope_hits = ['流年落宫', '流月落宫'];
  life.dynamic_scope_name = '财帛';
  payload.palaces[1].empty_state = true;
  payload.active_scope = { ...payload.active_scope, scope: 'yearly', label: '流年' };

  const facts = [
    ['palace_major_stars', 0, '命宫主星为紫微、天府', '命宫登记主星紫微、天府。'],
    [
      'palace_empty',
      1,
      '兄弟为空宫',
      '兄弟的主星列表为空；对宫及三方四正索引另行保留，供传统空宫合参。',
    ],
    ['palace_birth_mutagen', 0, '命宫见生年化禄', '紫微在命宫带有生年化禄。'],
    ['palace_scope_mutagen', 0, '命宫见流年化科', '紫微在当前运限下带有化科。'],
    ['surrounded_mutagen', 0, '命宫三方四正见化禄', '命宫及其三方四正宫位中可见化禄信息。'],
    ['palace_self_mutaged', 0, '命宫出现自化忌', '命宫的自化列表包含化忌。'],
    ['palace_mutaged_place', 0, '命宫化权入财帛', '命宫化权落财帛宫。'],
    ['palace_scope_hit', 0, '流年落宫位于命宫', '本命命宫的宫干支为甲子。'],
    ['scope_dynamic_name', 0, '流年视角下命宫转为财帛', '在流年视角下，命宫对应的动态宫名为财帛。'],
  ] as const;
  payload.evidence_pool = facts.map(([type, index, title, description]) => ({
    id: type,
    stable_key: type,
    type,
    title,
    description,
    scope: 'yearly',
    palace_indexes: [index],
    palace_names: [payload.palaces[index].name],
    star_names: ['紫微'],
    mutagens: [],
  }));
  const runtime = { payloadByScope: { yearly: payload } } as ZiweiRuntimeFacts;
  const options = {
    runtime,
    scope: 'yearly' as const,
    currentTime: new Date('2026-10-03T00:00:00Z'),
  };
  assert.doesNotMatch(buildZiweiPrompt(options), /证据资料：/);

  for (const item of payload.evidence_pool) {
    item.description += '；会照宫有化忌时需合参';
    item.promptText = `${item.title}：${item.description}`;
  }
  const extended = buildZiweiPrompt(options);
  assert.equal(extended.match(/会照宫有化忌时需合参/gu)?.length, 9);
  for (const item of payload.evidence_pool) assert.ok(extended.includes(item.promptText!));

  payload.evidence_pool = [
    {
      ...payload.evidence_pool[7],
      title: '流月落宫位于命宫',
      description: '本命命宫的宫干支为甲子。',
      promptText: undefined,
    },
  ];
  const otherScope = buildZiweiPrompt(options);
  assert.match(otherScope, /证据资料：\n\s+流月落宫位于命宫：本命命宫的宫干支为甲子。/u);
  assert.doesNotMatch(otherScope, /运限命中：流年落宫、流月落宫/u);
});

test('紫微公共提示词只省略已由所展示宫位表达的四化落点', () => {
  const payload = createPayload();
  payload.palaces[4].major_stars = [
    { name: '天同', kind: 'major', birth_mutagen: '禄', active_scope_mutagen: '科' },
  ];
  const natal = formatZiweiPayloadForPrompt(payload);
  assert.match(natal, /财帛宫；[^\n]*天同，生年化禄/);
  assert.doesNotMatch(natal, /生年四化：/);
  assert.match(
    formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['命宫'] }),
    /生年四化：天同化禄入财帛宫/,
  );

  payload.active_scope = {
    ...payload.active_scope,
    scope: 'yearly',
    label: '流年',
    mutagen_map: [{ star: '天同', mutagen: '科', palace_index: 4, palace_name: '财帛' }],
  };
  const yearly = formatZiweiPayloadForPrompt(payload);
  assert.match(yearly, /财帛宫；[^\n]*天同，生年化禄，当前化科/);
  assert.doesNotMatch(yearly, /当前四化：/);
  assert.match(
    formatZiweiPayloadForPrompt(payload, { focusPalaceNames: ['命宫'] }),
    /当前四化：天同化科入财帛宫/,
  );

  payload.active_scope.mutagen_map[0].dynamic_palace_name = '流年命宫';
  assert.match(formatZiweiPayloadForPrompt(payload), /当前四化：天同化科入财帛宫（动态流年命宫）/);
  payload.palaces[4].dynamic_scope_name = '流年命宫';
  assert.doesNotMatch(formatZiweiPayloadForPrompt(payload), /当前四化：/);
});

test('格局条件未列出具体宫位时保留必要的宫位资料', () => {
  const payload = createPayload();
  payload.palaces[1].minor_stars.push({ name: '左辅', kind: 'minor' });
  payload.palaces[11].minor_stars.push({ name: '右弼', kind: 'minor' });
  payload.patterns = detectPatterns({ palaces: payload.palaces });

  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext(),
  });

  assert.match(snapshot, /格局：辅弼拱主[\s\S]*?涉及宫位：父母、兄弟/);
  assert.doesNotMatch(snapshot, /涉及星曜：紫微、左辅、右弼/);
});

test('紫微提示词快照不得接受只伪造登记前缀的格局', () => {
  const payload = createPayload();
  payload.patterns = [
    {
      id: 'forged',
      stable_key: 'ziwei:verified-pattern:not-registered',
      key: 'ziwei:verified-pattern:not-registered',
      status: '已命中',
      name: '伪造格局',
      kind: 'auspicious',
      description: '不应进入提示词',
      palace_indexes: [0],
      palace_names: ['命宫'],
      star_names: ['紫微'],
      matched_conditions: ['伪造条件'],
      sources: ['伪造来源'],
    },
  ];

  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext(),
  });

  assert.doesNotMatch(snapshot, /【命盘格局】|伪造格局|伪造条件|伪造来源/);
  assert.doesNotMatch(
    formatZiweiPayloadForPrompt(payload),
    /命盘格局：|伪造格局|伪造条件|伪造来源/,
  );
});

test('紫微提示词快照应按登记稳定键去重', () => {
  const payload = createPayload();
  const verified = detectPatterns({ palaces: payload.palaces })[0];
  payload.patterns = [verified, { ...verified }];

  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext(),
  });

  assert.equal(snapshot.match(/格局：紫府同宫/g)?.length, 1);
  assert.equal(formatZiweiPayloadForPrompt(payload).match(/格局：紫府同宫/g)?.length, 1);
});

test('紫微提示词快照应从十二宫重建登记内容，不信任带合法键的篡改字段', () => {
  const payload = createPayload();
  const verified = detectPatterns({ palaces: payload.palaces })[0];
  payload.patterns = [
    {
      ...verified,
      name: '篡改格局',
      matched_conditions: ['篡改条件'],
      palace_names: ['篡改宫位'],
      star_names: ['篡改星曜'],
      sources: ['篡改来源'],
    },
  ];

  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext(),
  });

  assert.match(snapshot, /格局：紫府同宫/);
  assert.doesNotMatch(snapshot, /命中条件：紫微与天府同坐命宫/);
  assert.match(snapshot, /古籍依据：《紫微斗数全书》卷一/);
  assert.doesNotMatch(snapshot, /篡改格局|篡改条件|篡改宫位|篡改星曜|篡改来源/);
});

test('紫微重点宫位资料展示三方四正时应排除本宫', () => {
  const payload = createPayload();
  const summary = buildPalaceSummary(payload, payload.palaces[0]);

  assert.equal(summary.对宫, '迁移宫');
  assert.deepEqual(summary.三方四正, ['迁移宫', '财帛宫', '官禄宫']);
});

test('紫微提示词仅省略已在宫内星曜注记中表达的生年四化项目', () => {
  const payload = createPayload();
  const palace = payload.palaces[0];
  palace.major_stars = [{ name: '紫微', kind: 'major', birth_mutagen: '禄' }];
  palace.minor_stars = [{ name: '文昌', kind: 'minor', birth_mutagen: '科' }];

  const coveredPrompt = buildZiweiTaskBookSnapshot({
    payload,
    reportContext: createReportContext(),
  });
  const coveredPalaceLine = coveredPrompt
    .split('\n')
    .find((line) => line.startsWith('宫位：命宫｜'));
  assert.ok(coveredPalaceLine);
  assert.match(coveredPalaceLine, /主星：紫微\(生年化禄\)/);
  assert.match(coveredPalaceLine, /辅星：文昌\(生年化科\)/);
  assert.doesNotMatch(coveredPalaceLine, /生年四化：/);
  const coveredReadableSnapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext(),
  });
  assert.doesNotMatch(coveredReadableSnapshot, /生年四化：紫微化禄|生年四化：文昌化科/);

  palace.other_stars = [{ name: '天巫', kind: 'other', birth_mutagen: '忌' }];
  const retainedPrompt = buildZiweiTaskBookSnapshot({
    payload,
    reportContext: createReportContext(),
  });
  const retainedPalaceLine = retainedPrompt
    .split('\n')
    .find((line) => line.startsWith('宫位：命宫｜'));
  assert.ok(retainedPalaceLine);
  assert.match(retainedPalaceLine, /主星：紫微\(生年化禄\)/);
  assert.match(retainedPalaceLine, /辅星：文昌\(生年化科\)/);
  assert.match(retainedPalaceLine, /杂曜：天巫\(生年化忌\)/);
  assert.doesNotMatch(retainedPalaceLine, /生年四化：/);
  const retainedReadableSnapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext(),
  });
  assert.match(retainedReadableSnapshot, /杂曜：天巫\(生年化忌\)/);
  assert.doesNotMatch(retainedReadableSnapshot, /生年四化：/);

  payload.active_scope.scope = 'yearly';
  palace.major_stars[0].horoscope_mutagen = '权';
  palace.major_stars[0].active_scope_mutagen = '忌';
  const scopedSnapshot = buildZiweiTaskBookSnapshot({
    payload,
    reportContext: { ...createReportContext(), scope: 'yearly' },
  });
  const scopedLine = scopedSnapshot.split('\n').find((line) => line.startsWith('宫位：命宫｜'))!;
  assert.match(scopedLine, /紫微\(生年化禄\/流曜化权\/当前运限化忌\)/);
  assert.doesNotMatch(scopedLine, /生年四化：|流曜四化：|当前运限四化：/);
});

test('紫微输出提示词应是可复制给在线 AI 的独立任务书，不暴露工程提示词', () => {
  const prompt = buildCombinedZiweiPrompt(createPayload(), 'destiny', '请分析命局主线。');

  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.ziwei);
  assertNoEngineeringPromptText(prompt);
  assert.match(prompt, /【分析对象】/);
  assert.match(prompt, /分析对象：本命盘（出生日期1990-05-15）。/);
  assert.doesNotMatch(prompt, /本命盘（2026-05-16）/);
  assert.doesNotMatch(prompt, /【运限重点】/);
  assert.doesNotMatch(prompt, /【运限命中摘要】/);
  assert.doesNotMatch(prompt, /【当前运限】/);
  assert.doesNotMatch(prompt, /【当前报告任务】/);
  assert.doesNotMatch(prompt, /【解读目标】|【解读范围】|【解读方法】|应期范围|本次只提供/);
});

test('紫微提示词快照只保留分析背景和盘面资料', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext({
      report_key: 'career-wealth:origin:2026-05-16',
      report_title: '事业财运报告',
      report_type: 'career-wealth',
      selected_topic: 'career-wealth',
      focus_notes: ['优先看事业与财帛联动', '若证据不足要明确保守表达', '不要复述全盘'],
    }),
  });
  assert.match(snapshot, /【分析背景】/);
  assert.match(snapshot, /分析主题：事业财运/);
  assert.match(snapshot, /分析范围：本命/);
  assert.doesNotMatch(snapshot, /【解读目标】|严格边界|推荐追问|输出重点|焦点提示|不要复述全盘/);
});

test('紫微提示词快照不再回退到专题焦点话术', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext({
      report_key: 'relationship:origin:2026-05-16',
      report_title: '婚姻感情报告',
      report_type: 'relationship',
      selected_topic: 'relationship',
    }),
  });
  assert.match(snapshot, /分析主题：婚姻感情/);
  assert.doesNotMatch(snapshot, /【解读目标】|焦点提示|主题只作为问题范围/);
});

test('紫微分析背景不再重复输出报告标题，只保留主题与范围', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext(),
  });
  const backgroundSection = snapshot.match(/【分析背景】([\s\S]*?)\n\n【本命资料】/)?.[1] || '';

  assert.match(backgroundSection, /分析主题：人生解析/);
  assert.match(backgroundSection, /分析范围：本命/);
  assert.doesNotMatch(backgroundSection, /报告标题：/);
});

test('紫微近期专题快照保留主题和盘面资料', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext({
      report_key: 'recent:origin:2026-05-16',
      report_title: '近期趋势报告',
      report_type: 'recent',
      selected_topic: 'recent',
    }),
  });
  assert.match(snapshot, /分析主题：近期趋势/);
  assert.match(snapshot, /【本命资料】/);
  assert.doesNotMatch(snapshot, /【解读目标】|焦点提示|主题只作为问题范围/);
});

test('紫微本命重点宫位资料保留亮度生年四化与原局辅证', () => {
  const payload = createPayload();
  payload.palaces[0] = {
    ...payload.palaces[0],
    major_stars: [
      { name: '天机', kind: 'major', brightness: '庙', birth_mutagen: '禄' },
      { name: '太阴', kind: 'major', brightness: '陷', active_scope_mutagen: '忌' },
    ],
    minor_stars: [{ name: '文昌', kind: 'minor', horoscope_mutagen: '科' }],
    yearly_jiangqian12: '岁驿',
    yearly_suiqian12: '太岁',
  };
  payload.palaces[2] = {
    ...payload.palaces[2],
    empty_state: true,
    major_stars: [],
    summary_tags: ['空宫'],
  };
  payload.active_scope = {
    ...payload.active_scope,
    palace_index: payload.palaces[2].index,
  };

  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext({
      report_key: 'relationship:origin:2026-05-16',
      report_title: '感情分析',
      report_type: 'topic-reading',
      selected_topic: 'relationship',
    }),
  });

  assert.match(snapshot, /天机\(庙\/生年化禄\)/);
  assert.match(snapshot, /太阴\(陷\)/);
  assert.match(snapshot, /文昌/);
  assert.doesNotMatch(snapshot, /当前运限化忌|流耀化科/);
  assert.match(snapshot, /空宫，需借对宫官禄宫共同判断/);
  assert.match(snapshot, /传统辅证：/);
  assert.match(snapshot, /博士十二神:博士/);
  assert.match(snapshot, /原局将前十二神:岁建/);
  assert.match(snapshot, /原局岁前十二神:将星/);
  assert.doesNotMatch(snapshot, /流年将前十二神:岁驿|流年岁前十二神:太岁/);
});

test('紫微提示词快照将运限落宫与当前四化各集中列示一次', () => {
  const payload = createPayload();
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'yearly',
    label: '丙午流年',
    palace_index: 4,
    heavenly_stem: '丙',
    earthly_branch: '午',
    mutagen_map: [
      {
        star: '天同',
        mutagen: '禄',
        palace_index: 4,
        palace_name: '财帛',
        dynamic_palace_name: '命宫',
      },
      {
        star: '文昌',
        mutagen: '科',
        palace_index: 8,
        palace_name: '官禄',
      },
    ],
  };
  payload.palaces[4] = {
    ...payload.palaces[4],
    major_stars: [{ name: '天同', kind: 'major', brightness: '旺' }],
    dynamic_scope_name: '流年命宫',
    scope_hits: ['流年落宫'],
    summary_tags: ['流年落宫', '有当前运限四化'],
  };

  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext({
      report_key: 'career-wealth:yearly:2026-05-16',
      report_title: '事业财运',
      report_type: 'career-wealth',
      selected_topic: 'career-wealth',
      scope_type: 'yearly',
      scope_label: '流年',
    }),
  });

  assert.doesNotMatch(snapshot, /【运限资料】/);
  assert.match(snapshot, /【运限重点】/);
  const scopeFacts = snapshot.match(/【运限重点】\n([\s\S]*?)(?=\n\n【|$)/)?.[1] ?? '';
  assert.match(scopeFacts, /流年落宫→本命财帛宫，动态宫名：流年命宫，主星：天同\(旺\)/);
  assert.equal(scopeFacts.match(/本命财帛宫/g)?.length, 1);
  assert.equal(scopeFacts.match(/天同化禄→财帛宫（动态命宫）/g)?.length, 1);
  assert.equal(scopeFacts.match(/文昌化科→官禄宫/g)?.length, 1);
  assert.doesNotMatch(snapshot, /【主证】|【辅证】|【应期】|【限制】|证据汇总|解释边界/);
});

test('紫微运限提示词应保留分析对象和简短任务', () => {
  const payload = createPayload();
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'yearly',
    label: '丙午流年',
    solar_date: '2026-05-16',
    palace_index: 4,
  };

  const prompt = buildCombinedZiweiPrompt(payload, 'career-wealth', '今年事业财运怎么判断？', {
    isCustomQuestion: false,
  });

  assert.match(prompt, /【本命资料】/);
  assert.match(prompt, /【分析对象】/);
  assertPromptCurrentTimeHasGanzhiCalendar(prompt);
  assert.match(prompt, /【运限重点】/);
  assert.doesNotMatch(prompt, /【运限资料】/);
  assert.doesNotMatch(prompt, /【十二宫资料】/);
  assert.doesNotMatch(prompt, /类型：运限落宫/);
  assert.doesNotMatch(prompt, /【当前报告任务】/);
  assert.doesNotMatch(prompt, /【当前运限】/);
  assert.doesNotMatch(prompt, /【运限命中摘要】/);
  assert.doesNotMatch(prompt, /【分析对象优先级】/);
  assert.doesNotMatch(prompt, /【运限解读规则】/);
  assert.doesNotMatch(prompt, /【分析框架】/);
  assert.match(prompt, /【任务】\n请结合宫位、星曜、四化和三方四正直接回答【问题】。/);
  assert.doesNotMatch(prompt, /【输出要求】|现实建议|使用简体中文/);
  assert.doesNotMatch(
    prompt,
    /【解读目标】|【解读范围】|【解读方法】|【断盘要点】|证据汇总|解释边界/,
  );
});

test('紫微大限提示词只呈现本命与所选大限的落宫和判断线索', () => {
  const payload = createPayload();
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'decadal',
    label: '36-45岁',
    palace_index: 4,
  };
  payload.palaces[4] = {
    ...payload.palaces[4],
    scope_hits: ['36-45岁落宫', '流年落宫', '流月落宫'],
    yearly_jiangqian12: '岁驿',
    yearly_suiqian12: '太岁',
  };
  payload.palaces[8] = {
    ...payload.palaces[8],
    scope_hits: ['小限落宫', '流日落宫', '流时落宫'],
  };
  payload.evidence_pool = [
    ...(['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age'] as const).map(
      (scope, index) => ({
        id: `E${index}`,
        stable_key: `scope-${scope}`,
        type: scope === 'origin' ? 'surrounded_mutagen' : 'scope_dynamic_name',
        title: `${scope}判断线索`,
        scope,
        palace_indexes: [4],
        palace_names: ['财帛'],
        star_names: [],
        mutagens: [],
        description: `${scope}宫位事实`,
      }),
    ),
    {
      id: 'E7',
      stable_key: 'scope-hit-all-levels',
      type: 'palace_scope_hit',
      title: '36-45岁落宫、流年落宫、流月落宫位于财帛',
      scope: 'decadal',
      palace_indexes: [4],
      palace_names: ['财帛'],
      star_names: [],
      mutagens: [],
      description: '财帛宫被多个运限命中。',
    },
  ];
  const reportContext = createReportContext({
    report_key: 'life:decadal:2026-05-16',
    scope_type: 'decadal',
    scope_label: '大限',
  });

  for (const prompt of [
    buildZiweiReadableSnapshot({ payload, reportContext }),
    buildZiweiTaskBookSnapshot({ payload, reportContext }),
    buildCombinedZiweiPrompt(payload, 'life', '请分析此大限。'),
  ]) {
    assert.match(prompt, /36-45岁落宫→本命财帛宫/);
    assert.match(prompt, /origin判断线索/);
    assert.match(prompt, /decadal判断线索/);
    assert.doesNotMatch(prompt, /流年落宫|流月落宫|流日落宫|流时落宫|小限落宫/);
    assert.doesNotMatch(
      prompt,
      /yearly判断线索|monthly判断线索|daily判断线索|hourly判断线索|age判断线索/,
    );
    assert.doesNotMatch(prompt, /流年将前十二神|流年岁前十二神/);
  }
});

test('紫微单层盘面任务书只收录本命与所选运限层的证据和落宫', () => {
  const payload = createPayload();
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'decadal',
    label: '大限',
    palace_index: 4,
  };
  payload.palaces[4] = {
    ...payload.palaces[4],
    scope_hits: ['大限落宫', '流年落宫', '流日落宫'],
    summary_tags: ['大限落宫', '流年落宫', '流日落宫'],
  };
  const scopeLabels = { origin: '本命', decadal: '大限', yearly: '流年', daily: '流日' };
  payload.evidence_pool = [
    ...(['origin', 'decadal', 'yearly', 'daily'] as const).map((scope, index) => ({
      id: `E${index}`,
      stable_key: `scope-${scope}`,
      type: 'scope_mutagen_destination' as const,
      title: `${scopeLabels[scope]}独立证据`,
      scope,
      palace_indexes: [4],
      palace_names: ['财帛'],
      star_names: [],
      mutagens: [],
      description: '宫位资料',
    })),
  ];

  const prompt = formatZiweiPayloadForPrompt(payload);
  assert.match(prompt, /本命独立证据/);
  assert.match(prompt, /大限独立证据/);
  assert.match(prompt, /运限命中：大限落宫/);
  assert.doesNotMatch(prompt, /流年独立证据|流日独立证据|流年落宫|流日落宫/);
});

test('紫微合盘内嵌盘面资料不应重复使用顶层 section 标题', () => {
  const prompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: createPayload(),
    partnerPayload: createPayload(),
    topic: 'career-wealth',
    question: '我们适合长期合作吗？',
  });

  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT['ziwei-compatibility']);
  assert.match(prompt, /^【双盘关系资料】$/m);
  assert.match(prompt, /宫位对应：/);
  assert.doesNotMatch(
    prompt,
    /紫微双盘结构化证据|【限制】|证据汇总|计算链概览|解释限制|反证与应期边界/,
  );

  assert.equal((prompt.match(/^【第一人盘面】$/gm) ?? []).length, 1);
  assert.equal((prompt.match(/^【第二人盘面】$/gm) ?? []).length, 1);
  assert.doesNotMatch(prompt, /^【分析背景】$/m);
  assert.doesNotMatch(prompt, /^【解读目标】$/m);
  assert.doesNotMatch(prompt, /^【重点宫位资料】$/m);
  assert.match(prompt, /分析背景：\n/);
  assert.match(prompt, /重点宫位资料：\n/);
});

test('紫微双盘提示词应分别输出双方真实计算的真太阳时校正资料', () => {
  const primaryBirth = resolveZiweiTrueSolarBirth({
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '18',
    isLeapMonth: false,
    birthHour: '12',
    birthMinute: '0',
    birthLongitude: '116.4',
    timezone: 8,
  });
  const partnerBirth = resolveZiweiTrueSolarBirth({
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '12',
    isLeapMonth: false,
    birthHour: '23',
    birthMinute: '50',
    birthLongitude: '87.6',
    timezone: 8,
  });
  const primaryCorrection = formatZiweiTrueSolarEvidence(primaryBirth.trueSolarEvidence);
  const partnerCorrection = formatZiweiTrueSolarEvidence(partnerBirth.trueSolarEvidence);

  const prompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: createPayload(),
    partnerPayload: createPayload(),
    topic: 'relationship',
    question: '请分析双方互动。',
    primaryName: '甲方',
    partnerName: '乙方',
    primaryTrueSolarEvidence: primaryBirth.trueSolarEvidence,
    partnerTrueSolarEvidence: partnerBirth.trueSolarEvidence,
  });

  assert.ok(primaryCorrection);
  assert.ok(partnerCorrection);
  assert.notEqual(primaryCorrection, partnerCorrection);
  assert.match(
    primaryCorrection,
    /当地钟表时间：1992-08-18T12:00:00；法定时区：UTC\+08:00；出生经度：116\.4°；真太阳时：/,
  );
  assert.match(
    partnerCorrection,
    /当地钟表时间：1990-05-12T23:50:00；法定时区：UTC\+08:00；出生经度：87\.6°；真太阳时：/,
  );
  assert.match(partnerCorrection, /；时辰：/);
  assert.ok(prompt.includes(`【甲方出生时间校正】\n${primaryCorrection}`));
  assert.ok(prompt.includes(`【乙方出生时间校正】\n${partnerCorrection}`));
  assert.ok(prompt.indexOf('【甲方出生时间校正】') < prompt.indexOf('【甲方盘面】'));
  assert.ok(prompt.indexOf('【乙方出生时间校正】') < prompt.indexOf('【乙方盘面】'));
});

test('紫微时间校正任务书保留历史时区消歧和已执行的夏令时还原', () => {
  const newYork = resolveZiweiTrueSolarBirth({
    dateType: 'solar',
    year: '2024',
    month: '11',
    day: '3',
    isLeapMonth: false,
    birthHour: '1',
    birthMinute: '30',
    birthLongitude: '-74',
    timezone: -4,
    timeZoneId: 'America/New_York',
  });
  const chinaDst = resolveZiweiTrueSolarBirth({
    dateType: 'solar',
    year: '1988',
    month: '6',
    day: '1',
    isLeapMonth: false,
    birthHour: '12',
    birthMinute: '0',
    birthLongitude: '116.4',
    timezone: 8,
    applyChinaDst: true,
  });

  assert.match(
    formatZiweiTrueSolarEvidence(newYork.trueSolarEvidence),
    /当地钟表时间：2024-11-03T01:30:00；法定时区：America\/New_York，UTC-04:00/,
  );
  assert.match(formatZiweiTrueSolarEvidence(chinaDst.trueSolarEvidence), /夏令时还原：回拨60分钟/);
});

test('紫微证据池应输出大限流年流月流日落宫与运限四化飞入证据', () => {
  const palaces = createPayload().palaces;
  palaces[1] = {
    ...palaces[1],
    scope_stars: [{ name: '天同', kind: 'major', scope: 'yearly' }],
  };
  palaces[4] = {
    ...palaces[4],
    major_stars: [{ name: '天同', kind: 'major' }],
  };
  palaces[8] = {
    ...palaces[8],
    major_stars: [{ name: '文昌', kind: 'major' }],
  };

  const astrolabe = {
    palace: (nameOrIndex: string | number) =>
      typeof nameOrIndex === 'number'
        ? palaces[nameOrIndex]
        : palaces.find((item) => item.name === nameOrIndex),
    star: (starName: string) => ({
      palace: () =>
        palaces.find((item) =>
          [...item.major_stars, ...item.minor_stars, ...item.other_stars].some(
            (star) => star.name === starName,
          ),
        ),
    }),
    surroundedPalaces: (name: string) => {
      const palace = palaces.find((item) => item.name === name) ?? palaces[0];
      return {
        haveMutagen: () => false,
        target: palace,
        opposite: palaces[(palace.index + 6) % 12],
        wealth: palaces[(palace.index + 4) % 12],
        career: palaces[(palace.index + 8) % 12],
      };
    },
  } as never;

  const horoscope = {
    decadal: {
      index: 8,
      name: '壬申大限',
      heavenlyStem: '壬',
      earthlyBranch: '申',
      palaceNames: [],
      mutagen: ['天梁', '紫微', '左辅', '武曲'],
    },
    yearly: {
      index: 4,
      name: '丙午流年',
      heavenlyStem: '丙',
      earthlyBranch: '午',
      palaceNames: palaces.map((_, index) => palaces[(index + 8) % 12].name),
      mutagen: ['天同', '天机', '文昌', '廉贞'],
      yearlyDecStar: {
        jiangqian12: [],
        suiqian12: [],
      },
    },
    monthly: {
      index: 2,
      name: '甲午流月',
      heavenlyStem: '甲',
      earthlyBranch: '午',
      palaceNames: [],
      mutagen: [],
    },
    daily: {
      index: 6,
      name: '乙丑流日',
      heavenlyStem: '乙',
      earthlyBranch: '丑',
      palaceNames: [],
      mutagen: [],
    },
    hourly: {
      index: 1,
      name: '丙子流时',
      heavenlyStem: '丙',
      earthlyBranch: '子',
      palaceNames: [],
      mutagen: [],
    },
    age: {
      index: 0,
      name: '小限',
      heavenlyStem: '丁',
      earthlyBranch: '卯',
      palaceNames: [],
      mutagen: [],
      nominalAge: 37,
    },
    palace: (_palaceName: string, scope: 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly') =>
      palaces[
        {
          decadal: 8,
          yearly: 4,
          monthly: 2,
          daily: 6,
          hourly: 1,
        }[scope]
      ],
    agePalace: () => palaces[0],
  } as never;

  const legacyTarget = palaces.find((palace) =>
    [
      ...palace.major_stars,
      ...palace.minor_stars,
      ...palace.other_stars,
      ...palace.scope_stars,
    ].some((star) => star.name === '天同'),
  );
  assert.equal(legacyTarget?.index, 1, '旧遍历会先命中兄弟宫的同名流耀');
  assert.equal(astrolabe.star('天同').palace()?.index, 4, '原生星曜对象应定位本命财帛宫');

  const evidence = buildEvidencePool({
    astrolabe,
    horoscope,
    currentScope: 'yearly',
    palaces,
  });
  const titles = evidence.map((item) => item.title).join('\n');
  const descriptions = evidence.map((item) => item.description).join('\n');

  assert.match(titles, /大限（壬申大限）落入本命官禄宫/);
  assert.match(titles, /流年（丙午流年）落入本命财帛宫/);
  assert.match(titles, /流月（甲午流月）落入本命夫妻宫/);
  assert.match(titles, /流日（乙丑流日）落入本命迁移宫/);
  assert.match(titles, /流年（丙午流年）天同化禄入本命财帛宫（当前流年（丙午流年）命宫）/);
  assert.match(titles, /流年（丙午流年）文昌化科入本命官禄宫/);
  assert.doesNotMatch(titles, /天同化禄入本命兄弟宫/);
  assert.match(descriptions, /流年（丙午流年）干支为丙午/);
  assert.match(descriptions, /运限命宫落于本命财帛宫/);
  assert.ok(evidence.every((item) => item.level === '主证' || item.level === '辅证'));
  assert.ok(evidence.every((item) => item.source?.includes('紫微')));
  assert.ok(evidence.every((item) => item.calculation));
  assert.ok(
    evidence.every(
      (item) =>
        item.key?.startsWith('ziwei:evidence:') &&
        (item.status === '已记录' || item.status === '资料缺口') &&
        item.sources?.length &&
        item.calculationStepKey &&
        item.dependsOnStepKeys?.includes(item.calculationStepKey) &&
        item.promptText &&
        item.limitation,
    ),
  );
  assert.ok(
    evidence.every((item) => item.limitations?.some((text) => text.includes('不直接证明'))),
  );
  assert.ok(evidence.every((item) => !('priority' in item)));

  const analysis = buildEvidenceAnalysis({
    evidencePool: evidence,
    currentScope: 'yearly',
    palaces,
  });
  const factKeys = new Set([analysis.summaryFact.key, ...analysis.summaryFact.factKeys]);
  assert.equal(analysis.status, '存在资料缺口');
  const stepKeys = new Set(analysis.calculationSteps.map((item) => item.key));
  assert.ok(
    analysis.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.ok(evidence.every((item) => stepKeys.has(item.calculationStepKey ?? '')));
  assert.ok(
    analysis.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    analysis.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.doesNotMatch(
    analysis.promptText,
    /命语|iztro|本项目|项目统一|工程|接口|API|MCP|ziwei:evidence:/,
  );

  const payload = createPayload();
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'yearly',
    label: '丙午流年',
    palace_index: 4,
    mutagen_map: [{ star: '天同', mutagen: '禄', palace_index: 4, palace_name: '财帛' }],
  };
  payload.evidence_pool = evidence;
  payload.evidence_analysis = analysis;
  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext({
      report_key: 'life:yearly:2026-05-16',
      scope_type: 'yearly',
      scope_label: '流年',
    }),
  });
  assert.match(snapshot, /丙午流年当前落宫为本命财帛宫/);
  assert.match(snapshot, /天同化禄→财帛宫/);
  assert.doesNotMatch(snapshot, /【关键判断线索】/);
  assert.doesNotMatch(snapshot, /【证据汇总】|证据状态|资料缺口：|解释边界/);
  assert.doesNotMatch(snapshot, /命语|iztro|本项目|项目统一|工程|接口|API|MCP/);
});

test('紫微本命三方四正线索只从生年四化补全关联星曜与四化', () => {
  const payload = createPayload();
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'yearly',
    label: '丙午流年',
    palace_index: 0,
    mutagen_map: [
      {
        star: '太阴',
        mutagen: '忌',
        palace_index: 0,
        palace_name: '命宫',
      },
      {
        star: '文昌',
        mutagen: '科',
        palace_index: 0,
        palace_name: '命宫',
      },
    ],
  };
  payload.palaces[0] = {
    ...payload.palaces[0],
    major_stars: [
      { name: '天机', kind: 'major', birth_mutagen: '禄' },
      { name: '太阴', kind: 'major', active_scope_mutagen: '忌' },
    ],
    minor_stars: [{ name: '文昌', kind: 'minor', horoscope_mutagen: '科' }],
    self_mutagens: ['忌'],
    summary_tags: ['命宫', '有生年四化', '有当前运限四化'],
  };
  payload.evidence_pool = [
    {
      id: 'E1',
      stable_key: 'derived-evidence',
      type: 'surrounded_mutagen',
      title: '命宫三方四正见化禄',
      scope: 'origin',
      palace_indexes: [0],
      palace_names: ['命宫'],
      star_names: [],
      mutagens: [],
      description: '命宫三方四正见生年化禄。',
    },
  ];

  const summary = buildEvidenceSummary(
    payload,
    [payload.palaces[0]],
    createReportContext({
      report_key: 'life:yearly:2026-05-16',
      scope_type: 'yearly',
      scope_label: '流年',
    }),
  );

  assert.deepEqual(summary[0]?.关联星曜, ['天机']);
  assert.deepEqual(summary[0]?.关联四化, ['禄']);
  assert.equal(summary[0]?.判断线索, '命宫三方四正见化禄');
  assert.equal(summary[0]?.适用范围, '本命');
  assert.ok(!('证据等级' in (summary[0] ?? {})));
  assert.ok(!('数据来源' in (summary[0] ?? {})));
  assert.ok(!('计算依据' in (summary[0] ?? {})));
  assert.ok(!('适用边界' in (summary[0] ?? {})));
});

test('大限提示词只选当前焦点宫的三方四正化曜，保留各宫独立线索', async () => {
  const runtime = await calculateZiweiChart(
    {
      name: '三方四正焦点核对',
      gender: '男',
      dateType: 'solar',
      birthDate: '1991-05-15',
      birthTimeIndex: 5,
      algorithm: 'default',
    },
    { scopes: ['decadal'], horoscopeContext: { dateStr: '2026-09-27', hourIndex: 5 } },
  );
  const payload = runtime.payloadByScope.decadal;
  const reportContext = { scope: 'decadal' as const, selectedTopic: 'chat' };
  const snapshot = buildZiweiTaskBookSnapshot({ payload, reportContext });
  const analysisObject = snapshot.split('【分析对象】\n')[1]?.split('\n\n【运限重点】')[0] ?? '';
  const scopeFacts = snapshot.split('【运限重点】\n')[1]?.split('\n\n【关键判断线索】')[0] ?? '';
  assert.match(analysisObject, /分析对象：大限/);
  assert.doesNotMatch(analysisObject, /对象类型：大限|当前落宫：|当前四化：/);
  assert.match(scopeFacts, /大限落宫→本命子女宫/);
  assert.doesNotMatch(scopeFacts, /大限当前落宫为本命子女宫/);
  assert.match(scopeFacts, /太阴化禄→迁移宫/);
  assert.match(scopeFacts, /天同化权→迁移宫/);
  assert.match(scopeFacts, /天机化科→夫妻宫/);
  assert.match(scopeFacts, /巨门化忌→财帛宫/);
  const evidenceFacts =
    snapshot.split('【关键判断线索】\n')[1]?.split('\n\n【重点宫位资料】')[0] ?? '';
  assert.doesNotMatch(
    evidenceFacts,
    /大限落入本命|大限.+化[禄权科忌]入本命|见大限化|主星为|为空宫|见生年化|出现自化|化[禄权科忌]入/,
  );
  assert.doesNotMatch(evidenceFacts, /宫位中可见化|对应的动态宫名为/);
  const readable = buildZiweiReadableSnapshot({ payload, reportContext });
  const readableObject = readable.match(/【分析对象】\n([\s\S]*?)(?=\n\n【)/)?.[1] ?? '';
  assert.match(readableObject, /分析对象：大限/);
  assert.doesNotMatch(readableObject, /对象类型：大限|当前落宫：|当前四化：/);
  const labeledSnapshot = buildZiweiTaskBookSnapshot({
    payload: { ...payload, active_scope: { ...payload.active_scope, label: '2026年大限' } },
    reportContext,
  });
  assert.match(labeledSnapshot, /分析对象：2026年大限/);
  assert.doesNotMatch(labeledSnapshot, /对象类型：大限/);
  const lines = snapshot
    .split('\n')
    .filter((line) => line.startsWith('本命｜') && line.includes('三方四正见化'));

  assert.deepEqual(
    lines.map((line) => line.split('｜')[1]),
    [
      '子女三方四正见化忌',
      '命宫三方四正见化禄',
      '田宅三方四正见化科',
      '子女三方四正见化科',
      '命宫三方四正见化权',
    ],
  );
  assert.ok(payload.evidence_pool.some((item) => item.title === '仆役三方四正见化忌'));
  assert.match(snapshot, /文昌.*生年化忌/);
  assert.match(snapshot, /巨门.*生年化禄/);
  assert.match(snapshot, /太阳.*生年化权/);
  assert.match(snapshot, /文曲.*生年化科/);
});

test('紫微线索只从自身关联宫位补全星曜与四化', () => {
  const payload = createPayload();
  payload.palaces[0].major_stars = [{ name: '紫微', kind: 'major', birth_mutagen: '禄' }];
  payload.palaces[4].minor_stars = [{ name: '文昌', kind: 'minor', birth_mutagen: '忌' }];
  payload.evidence_pool = [
    {
      id: 'E1',
      stable_key: 'wealth-mutagen',
      type: 'surrounded_mutagen',
      title: '财帛见化忌',
      scope: 'origin',
      palace_indexes: [4],
      palace_names: ['财帛'],
      star_names: [],
      mutagens: [],
      description: '财帛宫见文昌化忌。',
    },
  ];

  const summary = buildEvidenceSummary(payload, [payload.palaces[4]], createReportContext());
  assert.deepEqual(summary[0]?.关联星曜, ['文昌']);
  assert.deepEqual(summary[0]?.关联四化, ['忌']);

  payload.evidence_pool[0].star_names = ['文昌'];
  assert.deepEqual(
    buildEvidenceSummary(payload, [payload.palaces[4]], createReportContext())[0]?.关联星曜,
    ['文昌'],
  );

  payload.evidence_pool = [
    {
      ...payload.evidence_pool[0],
      type: 'scope_landing',
      title: '流年命宫落在财帛宫',
      star_names: [],
      description: '流年命宫落在本命财帛宫。',
    },
  ];
  assert.deepEqual(buildEvidenceSummary(payload, [payload.palaces[4]], createReportContext()), []);
});

test('本命三方四正化曜线索不引用仅在流年出现的化曜', () => {
  const payload = createPayload();
  payload.palaces[0].major_stars = [{ name: '天机', kind: 'major', birth_mutagen: '忌' }];
  payload.palaces[4].minor_stars = [{ name: '文昌', kind: 'minor', active_scope_mutagen: '忌' }];
  payload.evidence_pool = [
    {
      id: 'E2',
      stable_key: 'origin-surrounding-ji',
      type: 'surrounded_mutagen',
      title: '财帛三方见生年化忌',
      scope: 'origin',
      palace_indexes: [0, 4],
      palace_names: ['命宫', '财帛'],
      star_names: [],
      mutagens: ['忌'],
      description: '财帛三方见生年化忌。',
    },
  ];

  const summary = buildEvidenceSummary(payload, [payload.palaces[0]], createReportContext());
  assert.deepEqual(summary[0]?.关联星曜, ['天机']);
  assert.deepEqual(summary[0]?.关联四化, ['忌']);
});

test('紫微专题无焦点证据时不回退展示全盘线索', () => {
  const payload = createPayload();
  payload.evidence_pool = [
    {
      id: 'E-off-topic',
      stable_key: 'off-topic-sibling',
      type: 'surrounded_mutagen',
      title: '兄弟宫见化禄',
      scope: 'origin',
      palace_indexes: [1],
      palace_names: ['兄弟'],
      star_names: ['文昌'],
      mutagens: ['禄'],
      description: '兄弟宫见化禄。',
    },
    {
      id: 'E-risk',
      stable_key: 'off-topic-risk',
      type: 'surrounded_mutagen',
      title: '兄弟宫见化忌',
      scope: 'origin',
      palace_indexes: [1],
      palace_names: ['兄弟'],
      star_names: ['文昌'],
      mutagens: ['忌'],
      description: '兄弟宫见化忌。',
    },
  ];

  assert.deepEqual(buildEvidenceSummary(payload, [payload.palaces[0]], createReportContext()), []);
  assert.doesNotMatch(
    buildZiweiTaskBookSnapshot({ payload, reportContext: createReportContext() }),
    /【关键判断线索】/,
  );
  assert.deepEqual(
    buildEvidenceSummary(
      payload,
      [payload.palaces[0]],
      createReportContext({ selected_topic: 'risk' }),
    ).map((item) => item.判断线索),
    ['兄弟宫见化忌'],
  );
});

test('流年四化飞入由运限重点承载，不在判断线索重复展示', () => {
  const payload = createPayload();
  payload.active_scope.scope = 'yearly';
  payload.active_scope.mutagen_map = [
    { star: '太阴', mutagen: '科', palace_index: 4, palace_name: '财帛' },
  ];
  payload.palaces[0].major_stars = [{ name: '天机', kind: 'major', birth_mutagen: '禄' }];
  payload.palaces[4].minor_stars = [{ name: '太阴', kind: 'minor', active_scope_mutagen: '科' }];
  payload.evidence_pool = [
    {
      id: 'E3',
      stable_key: 'yearly-mutagen-destination',
      type: 'scope_mutagen_destination',
      title: '流年太阴化科入财帛宫',
      scope: 'yearly',
      palace_indexes: [0, 4],
      palace_names: ['命宫', '财帛'],
      star_names: ['太阴'],
      mutagens: ['科'],
      description: '太阴流年化科对应本命财帛宫。',
    },
  ];

  const reportContext = createReportContext({ scope_type: 'yearly', scope_label: '流年' });
  assert.deepEqual(buildEvidenceSummary(payload, [payload.palaces[0]], reportContext), []);
  const snapshot = buildZiweiTaskBookSnapshot({ payload, reportContext });
  assert.match(snapshot, /太阴化科→财帛宫/);
  assert.doesNotMatch(snapshot, /流年太阴化科入财帛宫/);
});

test('紫微本命提示词不应混入大限流年流月流日运限结构', () => {
  const payload = createPayload();
  payload.palaces[4] = {
    ...payload.palaces[4],
    major_stars: [{ name: '天同', kind: 'major', active_scope_mutagen: '禄' }],
    dynamic_scope_name: '流年命宫',
    scope_hits: ['流年落宫'],
    summary_tags: ['流年落宫', '有当前运限四化', '三方四正见化禄'],
  };
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'origin',
    label: '本命',
    palace_index: undefined,
    mutagen_map: [
      {
        star: '天同',
        mutagen: '禄',
        palace_index: 4,
        palace_name: '财帛',
      },
    ],
  };

  const snapshot = buildZiweiReadableSnapshot({
    payload,
    reportContext: createReportContext({
      report_key: 'destiny:origin:2026-05-16',
      report_title: '命局综述',
      report_type: 'destiny-overview',
      selected_topic: 'destiny',
    }),
  });

  assert.doesNotMatch(snapshot, /【运限资料】|【运限重点】/);
  assert.doesNotMatch(snapshot, /类型：当前四化飞入/);
  assert.doesNotMatch(snapshot, /【主证】运限命中宫位/);
  assert.doesNotMatch(snapshot, /当前动态宫名：流年命宫/);
  assert.doesNotMatch(snapshot, /运限命中：流年落宫/);
  assert.doesNotMatch(snapshot, /关键词：流年落宫/);
});

test('紫微提示词快照不应输出无意义占位的当前落宫与当前四化', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext(),
  });
  const scopeSection = snapshot.match(/【分析对象】([\s\S]*?)(?=\n\n【|$)/)?.[1] || '';
  assert.match(scopeSection, /分析对象：本命盘/);

  assert.doesNotMatch(scopeSection, /当前落宫：未标注/);
  assert.doesNotMatch(scopeSection, /当前四化：无/);
});

test('紫微运限没有可列落宫或四化时省略空运限段', () => {
  const payload = createPayload();
  payload.active_scope = {
    ...payload.active_scope,
    scope: 'yearly',
    label: '流年',
    palace_index: undefined,
    mutagen_map: [],
  };
  const reportContext = createReportContext({ scope_type: 'yearly', scope_label: '流年' });
  for (const build of [buildZiweiReadableSnapshot, buildZiweiTaskBookSnapshot]) {
    const snapshot = build({ payload, reportContext });
    assert.match(snapshot, /分析对象：流年/);
    assert.doesNotMatch(snapshot, /【运限资料】|【运限重点】/);
  }
});

test('紫微本命证据池不应生成运限落宫证据', () => {
  const palaces = createPayload().palaces.map((palace) => ({
    ...palace,
    scope_hits: palace.index === 4 ? ['流年落宫'] : [],
  }));
  const astrolabe = {
    palace: () => ({}),
    surroundedPalaces: (name: string) => {
      const palace = palaces.find((item) => item.name === name) ?? palaces[0];
      return {
        haveMutagen: () => false,
        target: palace,
        opposite: palaces[(palace.index + 6) % 12],
        wealth: palaces[(palace.index + 4) % 12],
        career: palaces[(palace.index + 8) % 12],
      };
    },
  } as never;
  const horoscope = {
    decadal: {
      index: 8,
      name: '壬申大限',
      heavenlyStem: '壬',
      earthlyBranch: '申',
      palaceNames: [],
      mutagen: [],
    },
    yearly: {
      index: 4,
      name: '丙午流年',
      heavenlyStem: '丙',
      earthlyBranch: '午',
      palaceNames: [],
      mutagen: ['天同', '天机', '文昌', '廉贞'],
      yearlyDecStar: {
        jiangqian12: [],
        suiqian12: [],
      },
    },
    monthly: {
      index: 2,
      name: '甲午流月',
      heavenlyStem: '甲',
      earthlyBranch: '午',
      palaceNames: [],
      mutagen: [],
    },
    daily: {
      index: 6,
      name: '乙丑流日',
      heavenlyStem: '乙',
      earthlyBranch: '丑',
      palaceNames: [],
      mutagen: [],
    },
    hourly: {
      index: 1,
      name: '丙子流时',
      heavenlyStem: '丙',
      earthlyBranch: '子',
      palaceNames: [],
      mutagen: [],
    },
    age: {
      index: 0,
      name: '小限',
      heavenlyStem: '丁',
      earthlyBranch: '卯',
      palaceNames: [],
      mutagen: [],
      nominalAge: 37,
    },
  } as never;

  const evidence = buildEvidencePool({
    astrolabe,
    horoscope,
    currentScope: 'origin',
    palaces,
  });
  const titles = evidence.map((item) => item.title).join('\n');

  assert.doesNotMatch(titles, /大限（壬申大限）落入/);
  assert.doesNotMatch(titles, /流年（丙午流年）落入/);
  assert.doesNotMatch(titles, /流年落宫位于/);
  assert.doesNotMatch(titles, /天同化禄/);

  const analysis = buildEvidenceAnalysis({
    evidencePool: evidence,
    currentScope: 'origin',
    palaces,
  });
  assert.equal(
    analysis.counterEvidenceFacts.find((item) => item.type === '运限资料覆盖')?.status,
    '不适用',
  );
  assert.equal(
    analysis.counterEvidenceFacts.find((item) => item.type === '四化定位覆盖')?.status,
    '不适用',
  );
  assert.match(analysis.promptText, /当前为本命范围，不生成运限落宫/);
});
