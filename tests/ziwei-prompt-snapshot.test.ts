import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
} from '../src/lib/full-chart-engine/ziwei';
import { buildEvidencePool } from '../src/lib/iztro/build-evidence-pool';
import { buildEvidenceSummary } from '../src/lib/ziwei-prompts/builders';
import { buildZiweiReadableSnapshot } from '../src/lib/ziwei-prompts/snapshot';
import type { PromptContext } from '../src/lib/ziwei-prompts/types';
import type { AnalysisPayloadV1, PalaceFact } from '../src/types/analysis';

function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(prompt, /当前项目|本地算法|技术限制|未计算|资料包|提示词规则/);
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|未写入/);
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
    surrounded_palace_indexes: [(index + 4) % 12, (index + 8) % 12, (index + 6) % 12],
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
        priority: 92,
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

test('紫微提示词快照应输出已检测出的命盘格局', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext({
      report_key: 'destiny:origin:2026-05-16',
      report_title: '命局综述',
      report_type: 'destiny-overview',
      selected_topic: 'destiny',
    }),
  });

  assert.match(snapshot, /【命盘格局】/);
  assert.match(snapshot, /紫府同宫/);
  assert.match(snapshot, /紫微与天府同坐命宫/);
  assert.doesNotMatch(snapshot, /星座|金牛座/);
  assert.match(snapshot, /【十二宫资料】/);
});

test('紫微输出提示词应是可复制给在线 AI 的独立任务书，不暴露工程提示词', () => {
  const prompt = buildCombinedZiweiPrompt(createPayload(), 'destiny', '请分析命局主线。');

  assertNoEngineeringPromptText(prompt);
});

test('紫微提示词快照应输出解读目标，明确范围与边界', () => {
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
  const taskSection = snapshot.match(/【解读目标】([\s\S]*?)\n\n【本命资料】/)?.[1] || '';

  assert.match(snapshot, /【解读目标】/);
  assert.match(taskSection, /解读目标：只解读事业路径、财运抓手、资源配置与执行节奏。/);
  assert.match(taskSection, /重点参考宫位：官禄宫、财帛宫、命宫、福德宫/);
  assert.match(taskSection, /严格边界：围绕事业与财务议题作答，财务判断用趋势与条件表述。/);
  assert.match(taskSection, /焦点提示：优先看事业与财帛联动；若证据不足要明确保守表达/);
  assert.doesNotMatch(taskSection, /报告标题：|解读主题：|报告类型：/);
  assert.doesNotMatch(taskSection, /推荐追问：/);
  assert.doesNotMatch(taskSection, /输出重点：/);
  assert.doesNotMatch(taskSection, /不要复述全盘/);
});

test('紫微提示词快照在没有额外焦点备注时应回退到专题输出重点', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext({
      report_key: 'relationship:origin:2026-05-16',
      report_title: '婚姻感情报告',
      report_type: 'relationship',
      selected_topic: 'relationship',
    }),
  });
  const taskSection = snapshot.match(/【解读目标】([\s\S]*?)\n\n【本命资料】/)?.[1] || '';

  assert.match(
    taskSection,
    /焦点提示：优先判断关系模式、推进阻力与情绪互动；说明哪些结论来自夫妻宫、命宫、福德宫、子女宫或当前运限触发/,
  );
  assert.doesNotMatch(taskSection, /。、/);
});

test('紫微分析背景不再重复输出报告标题，只保留主题与范围', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext(),
  });
  const backgroundSection = snapshot.match(/【分析背景】([\s\S]*?)\n\n【解读目标】/)?.[1] || '';

  assert.match(backgroundSection, /分析主题：人生解析/);
  assert.match(backgroundSection, /分析范围：本命/);
  assert.doesNotMatch(backgroundSection, /报告标题：/);
});

test('紫微近期专题快照应输出近期趋势主题与阶段动作焦点', () => {
  const snapshot = buildZiweiReadableSnapshot({
    payload: createPayload(),
    reportContext: createReportContext({
      report_key: 'recent:origin:2026-05-16',
      report_title: '近期趋势报告',
      report_type: 'recent',
      selected_topic: 'recent',
    }),
  });
  const taskSection = snapshot.match(/【解读目标】([\s\S]*?)\n\n【本命资料】/)?.[1] || '';

  assert.match(snapshot, /分析主题：近期趋势/);
  assert.match(
    taskSection,
    /解读目标：只解读当前阶段主线、近期推进节奏、风险提醒与下一步动作优先级。/,
  );
  assert.match(
    taskSection,
    /焦点提示：先判断当前阶段最强触发点与近期主线；区分适合主动推进的事项、应该暂缓的风险和节奏变化点/,
  );
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
  assert.match(snapshot, /【主证】所选运限落宫/);
  assert.match(snapshot, /【主证】运限命中宫位/);
  assert.match(snapshot, /【主证】当前运限四化飞入/);
  assert.match(snapshot, /【应期】应期层级/);
  assert.match(snapshot, /【限制】本命与运限边界/);
  assert.match(snapshot, /类型：运限落宫/);
  assert.match(snapshot, /运限：流年/);
  assert.match(snapshot, /本命落宫：财帛宫/);
  assert.match(snapshot, /当前动态宫名：流年命宫/);
  assert.match(snapshot, /类型：当前四化飞入/);
  assert.match(snapshot, /天同/);
  assert.match(snapshot, /飞入宫位：财帛宫/);
});

test('紫微完整提示词应补充完整运限任务书', () => {
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

  assert.match(prompt, /【解读目标】/);
  assert.match(prompt, /【本命资料】/);
  assert.match(prompt, /【分析对象】/);
  assert.match(prompt, /【运限重点】/);
  assert.match(prompt, /【主证】所选运限落宫/);
  assert.doesNotMatch(prompt, /【运限资料】/);
  assert.doesNotMatch(prompt, /【十二宫资料】/);
  assert.doesNotMatch(prompt, /类型：运限落宫/);
  assert.doesNotMatch(prompt, /【当前报告任务】/);
  assert.doesNotMatch(prompt, /【当前运限】/);
  assert.doesNotMatch(prompt, /【运限命中摘要】/);
  assert.doesNotMatch(prompt, /【分析对象优先级】/);
  assert.doesNotMatch(prompt, /【运限解读规则】/);
  assert.doesNotMatch(prompt, /【分析框架】/);
  assert.match(prompt, /【解读范围】/);
  assert.match(prompt, /【解读方法】/);
  assert.match(prompt, /【分析思路】/);
  assert.match(prompt, /当前已选流年：以该年年度触发、四化飞入、流年命宫落点和年度事件类别为主/);
  assert.match(prompt, /大限层：看十年阶段的主环境、角色变化、资源压力和机会方向/);
  assert.match(prompt, /流月层：看月内窗口、推进节奏和短期反复/);
  assert.match(prompt, /流日\/流时层：看当日或当时执行、沟通、出行、签约、冲突与避险/);
  assert.ok(prompt.indexOf('【解读范围】') < prompt.indexOf('【解读方法】'));
  assert.ok(prompt.indexOf('【解读方法】') < prompt.indexOf('【问题】\n今年事业财运怎么判断？'));
});

test('紫微本命完整提示词应输出本命分析对象且不输出空运限重点', () => {
  const prompt = buildCombinedZiweiPrompt(createPayload(), 'destiny', '请分析命局主线。', {
    isCustomQuestion: false,
  });

  assert.match(prompt, /【分析对象】/);
  assert.match(prompt, /分析对象：本命盘/);
  assert.match(prompt, /资料说明：本次没有提供大限、流年、流月、流日或流时/);
  assert.match(prompt, /【解读范围】/);
  assert.match(prompt, /本次只提供本命盘/);
  assert.match(prompt, /【解读方法】/);
  assert.match(prompt, /当前为本命范围：只判断宫位结构、星曜组合、格局层次/);
  assert.doesNotMatch(prompt, /【运限重点】/);
  assert.doesNotMatch(prompt, /【运限命中摘要】/);
  assert.doesNotMatch(prompt, /【当前运限】/);
  assert.doesNotMatch(prompt, /【当前报告任务】/);
});

test('紫微合盘内嵌盘面资料不应重复使用顶层 section 标题', () => {
  const prompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: createPayload(),
    partnerPayload: createPayload(),
    topic: 'career-wealth',
    question: '我们适合长期合作吗？',
  });

  assert.equal((prompt.match(/^【第一人盘面】$/gm) ?? []).length, 1);
  assert.equal((prompt.match(/^【第二人盘面】$/gm) ?? []).length, 1);
  assert.doesNotMatch(prompt, /^【分析背景】$/m);
  assert.doesNotMatch(prompt, /^【解读目标】$/m);
  assert.doesNotMatch(prompt, /^【重点宫位资料】$/m);
  assert.match(prompt, /分析背景：\n/);
  assert.match(prompt, /解读目标：\n/);
  assert.match(prompt, /重点宫位资料：\n/);
});

test('紫微证据池应输出大限流年流月流日落宫与运限四化飞入证据', () => {
  const palaces = createPayload().palaces;
  palaces[4] = {
    ...palaces[4],
    major_stars: [{ name: '天同', kind: 'major' }],
  };
  palaces[8] = {
    ...palaces[8],
    major_stars: [{ name: '文昌', kind: 'major' }],
  };

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
      mutagen: ['天梁', '紫微', '左辅', '武曲'],
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
    currentScope: 'yearly',
    palaces,
  });
  const titles = evidence.map((item) => item.title).join('\n');
  const descriptions = evidence.map((item) => item.description).join('\n');

  assert.match(titles, /大限（壬申大限）落入官禄/);
  assert.match(titles, /流年（丙午流年）落入财帛/);
  assert.match(titles, /流月（甲午流月）落入夫妻/);
  assert.match(titles, /流日（乙丑流日）落入迁移/);
  assert.match(titles, /流年（丙午流年）天同化禄入财帛/);
  assert.match(titles, /流年（丙午流年）文昌化科入官禄/);
  assert.match(descriptions, /流年（丙午流年）干支为丙午/);
  assert.match(descriptions, /结合财帛的运限落宫一起判断触发路径/);
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
      priority: 95,
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

  assert.match(snapshot, /【运限资料】\n- 暂无/);
  assert.match(snapshot, /【运限重点】\n- 暂无/);
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
  assert.doesNotMatch(scopeSection, /当前四化：暂无/);
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
});
