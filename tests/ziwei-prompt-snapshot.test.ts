import test from 'node:test';
import assert from 'node:assert/strict';

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
  detectPatterns,
  DEFAULT_ZIWEI_CALCULATION_CONFIG,
} from '@core/ziwei/iztro';
import { buildEvidenceSummary, buildPalaceSummary } from '../src/lib/ziwei-prompts/builders';
import { buildZiweiReadableSnapshot } from '../src/lib/ziwei-prompts/snapshot';
import type { PromptContext } from '../src/lib/ziwei-prompts/types';
import {
  assertPromptCurrentTimeHasGanzhiCalendar,
  assertPromptHasSingleRole,
} from './prompt-assertions';
import type { AnalysisPayloadV1, PalaceFact } from '../src/types/analysis';
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
    earthly_branch: '子',
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
  assert.match(snapshot, /命中条件：紫微与天府同坐命宫/);
  assert.match(snapshot, /古籍依据：《紫微斗数全书》卷一/);
  assert.doesNotMatch(snapshot, /因此必然|命盘总分|保证实现/);
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
  assert.match(snapshot, /命中条件：紫微与天府同坐命宫/);
  assert.match(snapshot, /古籍依据：《紫微斗数全书》卷一/);
  assert.doesNotMatch(snapshot, /篡改格局|篡改条件|篡改宫位|篡改星曜|篡改来源/);
});

test('紫微重点宫位资料展示三方四正时应排除本宫', () => {
  const payload = createPayload();
  const summary = buildPalaceSummary(payload, payload.palaces[0]);

  assert.equal(summary.对宫, '迁移宫');
  assert.deepEqual(summary.三方四正, ['迁移宫', '财帛宫', '官禄宫']);
});

test('紫微输出提示词应是可复制给在线 AI 的独立任务书，不暴露工程提示词', () => {
  const prompt = buildCombinedZiweiPrompt(createPayload(), 'destiny', '请分析命局主线。');

  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.ziwei);
  assertNoEngineeringPromptText(prompt);
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

test('紫微重点宫位资料应输出星曜亮度四化与空宫传统辅证', () => {
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
  assert.match(snapshot, /太阴\(陷\/当前运限化忌\)/);
  assert.match(snapshot, /文昌\(流耀化科\)/);
  assert.match(snapshot, /空宫，需借对宫官禄宫共同判断/);
  assert.match(snapshot, /传统辅证：/);
  assert.match(snapshot, /博士十二神:博士/);
  assert.match(snapshot, /流年将前十二神:岁驿/);
  assert.match(snapshot, /流年岁前十二神:太岁/);
});

test('紫微提示词快照应单独输出运限落宫与当前四化飞入结构', () => {
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

  assert.match(snapshot, /【运限资料】/);
  assert.match(snapshot, /【运限重点】/);
  assert.match(snapshot, /类型：运限落宫/);
  assert.match(snapshot, /运限：流年/);
  assert.match(snapshot, /本命落宫：财帛宫/);
  assert.match(snapshot, /当前动态宫名：流年命宫/);
  assert.match(snapshot, /类型：当前四化飞入/);
  assert.match(snapshot, /天同/);
  assert.match(snapshot, /飞入宫位：财帛宫/);
  assert.match(snapshot, /动态飞入宫位：命宫/);
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

test('紫微本命完整提示词应输出本命分析对象且不输出空运限重点', () => {
  const prompt = buildCombinedZiweiPrompt(createPayload(), 'destiny', '请分析命局主线。', {
    isCustomQuestion: false,
  });

  assert.match(prompt, /【分析对象】/);
  assert.match(prompt, /分析对象：本命盘（2026-05-16）。/);
  assert.doesNotMatch(prompt, /【运限重点】/);
  assert.doesNotMatch(prompt, /【运限命中摘要】/);
  assert.doesNotMatch(prompt, /【当前运限】/);
  assert.doesNotMatch(prompt, /【当前报告任务】/);
  assert.doesNotMatch(prompt, /【解读目标】|【解读范围】|【解读方法】|应期范围|本次只提供/);
});

test('紫微合盘内嵌盘面资料不应重复使用顶层 section 标题', () => {
  const prompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: createPayload(),
    partnerPayload: createPayload(),
    topic: 'career-wealth',
    question: '我们适合长期合作吗？',
  });

  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT['ziwei-compatibility']);
  assert.match(prompt, /【双盘关系资料】/);
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
  assert.ok(prompt.includes(`【甲方出生时间校正】\n${primaryCorrection}`));
  assert.ok(prompt.includes(`【乙方出生时间校正】\n${partnerCorrection}`));
  assert.ok(prompt.indexOf('【甲方出生时间校正】') < prompt.indexOf('【甲方盘面】'));
  assert.ok(prompt.indexOf('【乙方出生时间校正】') < prompt.indexOf('【乙方盘面】'));
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
  assert.equal(analysis.key, 'ziwei:evidence');
  assert.equal(analysis.status, '存在资料缺口');
  assert.equal(analysis.calculationSteps.length, 4);
  assert.ok(
    analysis.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) =>
        analysis.calculationSteps.some((candidate) => candidate.key === key),
      ),
    ),
  );
  assert.equal(analysis.counterEvidenceFacts.length, 3);
  assert.equal(analysis.summaryFact.evidenceFactCount, evidence.length);
  assert.equal(analysis.summaryFact.counterEvidenceCount, analysis.counterEvidenceFacts.length);
  assert.equal(analysis.summaryFact.limitationFactCount, analysis.limitationFacts.length);
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
  assert.match(analysis.promptText, /计算链：[\s\S]*反证核验：[\s\S]*证据汇总：[\s\S]*解释限制：/);
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
  assert.match(snapshot, /【关键判断线索】/);
  assert.match(snapshot, /流年（丙午流年）天同化禄入本命财帛宫/);
  assert.match(snapshot, /流年（丙午流年）落入本命财帛宫/);
  assert.doesNotMatch(snapshot, /【证据汇总】|证据状态|资料缺口：|解释边界/);
  assert.doesNotMatch(snapshot, /命语|iztro|本项目|项目统一|工程|接口|API|MCP/);
});

test('紫微关键判断线索在原始资料缺少关联星曜与关联四化时应自动补全', () => {
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
      title: '命宫三方四正见化忌',
      scope: 'yearly',
      palace_indexes: [0],
      palace_names: ['命宫'],
      star_names: [],
      mutagens: [],
      description: '命宫在当前阶段受四化牵动。',
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

  assert.deepEqual(summary[0]?.关联星曜, ['天机', '太阴', '文昌']);
  assert.deepEqual(summary[0]?.关联四化, ['禄', '科', '忌']);
  assert.equal(summary[0]?.判断线索, '命宫三方四正见化忌');
  assert.equal(summary[0]?.适用范围, '流年');
  assert.equal(summary[0]?.说明, '命宫在当前阶段受四化牵动。');
  assert.ok(!('证据等级' in (summary[0] ?? {})));
  assert.ok(!('数据来源' in (summary[0] ?? {})));
  assert.ok(!('计算依据' in (summary[0] ?? {})));
  assert.ok(!('适用边界' in (summary[0] ?? {})));
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

  assert.match(snapshot, /【运限资料】\n- 无/);
  assert.match(snapshot, /【运限重点】\n- 无/);
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
  const scopeSection = snapshot.match(/【分析对象】([\s\S]*?)\n\n【运限重点】/)?.[1] || '';

  assert.doesNotMatch(scopeSection, /当前落宫：未标注/);
  assert.doesNotMatch(scopeSection, /当前四化：无/);
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
