import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fitReadingMessages,
  getReadingGuide,
  parseReadingPlan,
  runReadingWorkflow,
  type ReadingMemory,
  type ReadingOptions,
  type ReadingDependencies,
  type ReadingResource,
} from '../src/lib/ai/reading-workflow';
import { executeReadingAction, lookupReadingClassics } from '../src/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { ChatMessage } from '../src/lib/ai/stream-client';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { generateDivinationSession } from '../src/lib/divination/engine';
import { buildDivinationReadingSubject } from '../src/lib/ai/reading-subject';
import {
  buildSerializableZiweiResult,
  buildZiweiChartInput,
  calculatePublicZiweiChartForScopes,
} from 'mingyu-core/ziwei';
import { formatPublicZiweiFullScopeText } from 'mingyu-core/prompt/public-api';

function harness(responses: string[]) {
  const sent: Parameters<ReadingDependencies['stream']>[0][] = [];
  const progress: string[] = [],
    notices: string[] = [],
    errors: string[] = [],
    chunks: string[] = [];
  const memory: ReadingMemory = { resources: [] };
  let done = 0;
  const options: ReadingOptions = {
    memory,
    onProgress: (item) => progress.push(item.text),
    onNotice: (text) => notices.push(text),
    onError: (text) => errors.push(text),
    onChunk: (text) => chunks.push(text),
    onDone: () => {
      done += 1;
    },
  };
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    sent.push(messages);
    callbacks.onChunk(responses.shift() ?? '最终解读');
    callbacks.onDone();
  };
  return { sent, progress, notices, errors, chunks, options, stream, done: () => done };
}

const baziSubject: ReadingSubjectSnapshot = {
  id: 'subject-test',
  source: 'bazi',
  lockedInputs: {
    bazi: {
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 8,
      dateType: 'solar',
      isLeapMonth: false,
      useTrueSolarTime: false,
    },
  },
  allowedMethods: ['bazi'],
  range: { baziFortuneScope: 'year' },
};

function makeZiweiLayer(seed: string, starCount = 1) {
  return {
    name: `流年${seed}`,
    heavenlyStem: '甲',
    earthlyBranch: '子',
    palaceNames: ['命宫'],
    palaceTargets: ['命宫'],
    mutagen: [''],
    stars: [Array.from({ length: starCount }, (_, index) => `星曜${seed}-${index}`)],
    yearlyDecStars: { jiangqian12: [], suiqian12: [] },
  };
}

function makeZiweiFullResource(yearCount = 2, starCount = 1, text = '紫微完整资料') {
  const years = Array.from({ length: yearCount }, (_, index) => ({
    age: index + 1,
    year: 2000 + index,
    dateStr: `${2000 + index}-01-01`,
    endDateStr: `${2000 + index}-12-31`,
    label: `流年${2000 + index}`,
    ganZhi: '甲子',
    layer: makeZiweiLayer(String(2000 + index), starCount),
  }));
  const payload = {
    basic_info: {
      gender: '男',
      solar_date: '1999-01-01',
      lunar_date: '己卯年腊月十五',
      birth_time_label: '子时',
      zodiac: '兔',
      soul_palace_branch: '子',
      body_palace_branch: '午',
      soul: '贪狼',
      body: '天相',
      hidden_palaces: { body_palace_name: '身宫' },
      four_pillars: {
        year_pillar: '己卯',
        month_pillar: '丙子',
        day_pillar: '甲子',
        hour_pillar: '甲子',
      },
    },
    active_scope: {
      scope: 'origin',
      label: '本命',
      solar_date: '1999-01-01',
      lunar_date: '己卯年腊月十五',
      nominal_age: 1,
      palace_name: '命宫',
      mutagen_map: [],
    },
    palaces: [],
    evidence_pool: [],
  };
  const timeline = {
    scope: 'all',
    targetDateStr: '2000-06-01',
    targetHourIndex: 0,
    targetAge: 1,
    targetYear: 2000,
    actualStartDateStr: '2000-01-01',
    actualEndDateStr: `${1999 + yearCount}-12-31`,
    selectedPeriodIndex: 0,
    periods: [
      {
        kind: 'decadal' as const,
        label: '第一大限',
        startAge: 1,
        endAge: yearCount,
        dateStr: '2000-01-01',
        endDateStr: `${1999 + yearCount}-12-31`,
        source: 'iztro-horoscope' as const,
        years,
        layer: makeZiweiLayer('大限'),
      },
    ],
  };
  const payloadByScope = Object.fromEntries(
    ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'].map((scope) => [
      scope,
      {
        ...payload,
        active_scope: {
          ...payload.active_scope,
          scope,
          label: scope,
        },
      },
    ]),
  );
  const structured = {
    basicInfo: payload.basic_info,
    calculationConfig: { algorithm: 'default' },
    scopeNames: ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'],
    payloadByScope,
    fortuneTimeline: timeline,
    fourMutagens: {},
    birthMutagens: {},
    gongList: [],
    命宫: '子',
    身宫: '身宫',
    五行局: '水二局',
    四化: {},
  };
  return {
    key: 'ziwei-full',
    title: '紫微完整运限资料',
    text,
    usable: true,
    structured,
  } satisfies ReadingResource;
}

async function makeCanonicalZiweiFullResource(
  name: string,
  gender: 'male' | 'female',
  birth: { year: string; month: string; day: string },
  key: string,
) {
  const input = buildZiweiChartInput({
    name,
    gender,
    dateType: 'solar',
    ...birth,
    timeIndex: 4,
    isLeapMonth: false,
    algorithm: 'default',
  });
  const runtime = await calculatePublicZiweiChartForScopes(
    input,
    ['decadal', 'yearly', 'monthly', 'daily', 'hourly'],
    {
      skipAnalysis: true,
      horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
      fortuneRange: { scope: 'all', dateStr: '2026-08-06', hourIndex: 4 },
    },
  );
  return {
    key,
    title: `${name}紫微完整运限资料`,
    text: formatPublicZiweiFullScopeText(runtime),
    usable: true,
    structured: buildSerializableZiweiResult(runtime),
  } satisfies ReadingResource;
}

const ziweiSubject: ReadingSubjectSnapshot = {
  id: 'subject-ziwei-test',
  source: 'ziwei',
  lockedInputs: { ziwei: { name: '测试者', gender: 'male' } },
  allowedMethods: ['ziwei'],
  range: { ziweiScope: 'full', ziweiScopeDate: '2000-06-01', scopeHourIndex: 0 },
};

test('解读加载分术式路线并与可下载 Skill 同源', () => {
  assert.equal(
    readFileSync('skills/mingyu/references/reading-workflow.json', 'utf8'),
    readFileSync('public/skills/mingyu/references/reading-workflow.json', 'utf8'),
  );
  const bazi = getReadingGuide('八字排盘：甲子日');
  assert.match(bazi, /透干、藏干、通根/);
  assert.doesNotMatch(bazi, /紫微斗数：|六爻：/);
  assert.match(getReadingGuide('八字紫微合参'), /八字：.*\n紫微斗数：/);
});

test('解读 Skill 按资料自适应，排盘时段优先于古籍查询', () => {
  const skill = readFileSync('skills/mingyu/SKILL.md', 'utf8');
  assert.match(skill, /按资料与问题自适应/);
  assert.doesNotMatch(skill, /严格遵循以下固定生命周期/);
  const source = readFileSync('src/lib/ai/reading-workflow.ts', 'utf8');
  assert.match(source, /排盘类优先补齐当前阶段/);
  assert.ok(source.indexOf('kind":"schema') < source.indexOf('kind":"classic'));
});

test('准备结果只接受有限的查询与补算动作', () => {
  assert.deepEqual(parseReadingPlan('```json\n{"actions":[]}\n```'), []);
  for (const action of [
    { kind: 'shell', method: 'bazi' },
    { kind: 'calculate', method: '../../ai/analyze', input: {} },
    { kind: 'classic', method: '__proto__', query: '甲' },
  ]) {
    assert.throws(() => parseReadingPlan(JSON.stringify({ actions: [action] })));
  }
});

test('补查条文进入解读并复用于追问，准备结果与参数格式不进入正文', async () => {
  const h = harness([
    '{"actions":[{"kind":"classic","method":"bazi","query":"甲"}]}',
    '第一次解读',
    '{"actions":[{"kind":"classic","method":"bazi","query":"甲"}]}',
    '追问解读',
  ]);
  let calls = 0;
  const execute: ReadingDependencies['execute'] = async () => {
    calls += 1;
    return { key: '', title: '十干体象', text: '甲木参天', usable: true };
  };
  await runReadingWorkflow([{ role: 'user', content: '八字：甲子日，问事业' }], h.options, {
    stream: h.stream,
    execute,
  });
  assert.equal(h.done(), 1);
  assert.deepEqual(h.chunks, ['第一次解读']);
  assert.ok(h.sent[1][0].content.includes('甲木参天'));
  await runReadingWorkflow(
    [
      { role: 'user', content: '八字：甲子日，问事业' },
      { role: 'assistant', content: '第一次解读' },
      { role: 'user', content: '再看今年' },
    ],
    h.options,
    { stream: h.stream, execute },
  );
  assert.equal(calls, 1);
  assert.deepEqual(h.errors, []);
});

test('读取参数后补算，原始盘面与补充盘面同时保留', async () => {
  const h = harness([
    '{"actions":[{"kind":"schema","method":"bazi"}]}',
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1990}}]}',
    '解读',
  ]);
  const actions: string[] = [];
  h.options.subject = baziSubject;
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], h.options, {
    stream: h.stream,
    execute: async (action) => {
      actions.push(action.kind);
      return {
        key: '',
        title: action.kind === 'schema' ? '参数' : '补充盘面',
        text: action.kind === 'schema' ? 'SCHEMA_SENTINEL_出生年份整数' : '目标流年丙午',
        usable: action.kind !== 'schema',
      };
    },
  });
  assert.deepEqual(actions, ['schema', 'calculate']);
  assert.match(h.sent[1][0].content, /SCHEMA_SENTINEL_出生年份整数/);
  const final = h.sent[2][0].content;
  assert.match(final, /八字原始盘面/);
  assert.match(final, /目标流年丙午/);
  assert.doesNotMatch(final, /SCHEMA_SENTINEL_出生年份整数/);
});

test('准备格式错误后在剩余轮次读取真实参数并补算目标', async (t) => {
  const h = harness([
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1990}',
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1990,"question":"分析2027年事业","baziFortuneScope":"year","baziFortuneYear":2027}}]}',
    '格式恢复后的解读',
  ]);
  h.options.subject = baziSubject;
  const executed: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) =>
    handlePublicApiRequest(
      new Request(new URL(String(input), 'https://aov.cc'), init),
    )) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], h.options, {
    stream: h.stream,
    execute: async (action, signal, subject) => {
      executed.push(action.kind);
      return executeReadingAction(action, signal, subject);
    },
  });
  assert.deepEqual(executed, ['schema', 'calculate']);
  assert.match(h.sent[1][0].content, /properties/);
  assert.match(h.sent[1].at(-1)!.content, /可解析的 JSON 对象/);
  assert.match(h.sent[2][0].content, /1990|庚午/);
  assert.equal(h.options.memory.resources.length, 1);
  assert.equal(h.options.memory.resources[0].usable, true);
  assert.deepEqual(h.chunks, ['格式恢复后的解读']);
});

test('缺少补算参数时先读取真实 schema 再在下一轮补算', async () => {
  const h = harness([
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1990}}]}',
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1990}}]}',
    '读取参数后的解读',
  ]);
  h.options.subject = baziSubject;
  const executed: string[] = [];
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], h.options, {
    stream: h.stream,
    execute: async (action) => {
      executed.push(action.kind);
      return action.kind === 'schema'
        ? { key: '', title: '八字参数', text: 'SCHEMA_AUTO', usable: false }
        : { key: '', title: '目标流年', text: 'TARGET_AUTO', usable: true };
    },
  });
  assert.deepEqual(executed, ['schema', 'calculate']);
  assert.match(h.sent[1][0].content, /SCHEMA_AUTO/);
  assert.match(h.sent[2][0].content, /TARGET_AUTO/);
  assert.deepEqual(h.chunks, ['读取参数后的解读']);
});

test('连续两次准备格式错误时最终上下文说明资料状态', async () => {
  const h = harness(['不是JSON', '仍不是JSON', '已有资料解读']);
  await runReadingWorkflow([{ role: 'user', content: '塔罗：星星正位' }], h.options, {
    stream: h.stream,
    execute: async () => {
      throw new Error('不应执行');
    },
  });
  const final = h.sent.at(-1)![0].content;
  assert.match(final, /本轮资料准备未取得可执行的补充动作/);
  assert.doesNotMatch(final, /资料准备修正/);
  assert.deepEqual(h.chunks, ['已有资料解读']);
});

test('补算执行安全校验失败后带纠错反馈并成功重试', async (t) => {
  const h = harness([
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1991,"baziFortuneYear":2027,"question":"分析2027年事业","baziFortuneScope":"year"}}]}',
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1990,"baziFortuneYear":2027,"question":"分析2027年事业","baziFortuneScope":"year"}}]}',
    '重试后的解读',
  ]);
  h.options.subject = baziSubject;
  h.options.memory.schemas = [
    {
      key: JSON.stringify({ kind: 'schema', method: 'bazi' }),
      title: '八字补算参数',
      text: '{"properties":{"baziFortuneYear":{"type":"integer"}}}',
      usable: false,
      kind: 'schema',
    },
  ];
  const executed: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) =>
    handlePublicApiRequest(
      new Request(new URL(String(input), 'https://aov.cc'), init),
    )) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], h.options, {
    stream: h.stream,
    execute: async (action, signal, subject) => {
      executed.push(action.kind);
      return executeReadingAction(action, signal, subject);
    },
  });
  assert.deepEqual(executed, ['calculate', 'calculate']);
  assert.match(h.sent[1].at(-1)!.content, /补算主体与当前命盘不一致：year/);
  const final = h.sent[2][0].content;
  assert.doesNotMatch(final, /bazi补充资料未取得/);
  assert.equal(h.options.memory.resources.length, 1);
  assert.match(final, /1990|庚午/);
  assert.deepEqual(h.chunks, ['重试后的解读']);
});

test('不同目标时段的补算成功不清除另一个失败状态', async () => {
  const h = harness([
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"baziFortuneYear":2027}},{"kind":"calculate","method":"bazi","input":{"baziFortuneYear":2028}}]}',
    '{"actions":[]}',
    '保留失败状态的解读',
  ]);
  h.options.subject = baziSubject;
  h.options.memory.schemas = [
    {
      key: JSON.stringify({ kind: 'schema', method: 'bazi' }),
      title: '八字补算参数',
      text: '{"properties":{"baziFortuneYear":{"type":"integer"}}}',
      usable: false,
      kind: 'schema',
    },
  ];
  const executed: string[] = [];
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], h.options, {
    stream: h.stream,
    execute: async (action) => {
      executed.push(action.kind);
      if (action.kind === 'calculate' && action.input.baziFortuneYear === 2027)
        throw new Error('2027目标暂未取得');
      return { key: '', title: '2028目标', text: 'TARGET_2028', usable: true };
    },
  });
  assert.deepEqual(executed, ['calculate', 'calculate']);
  const final = h.sent[2][0].content;
  assert.match(final, /bazi补充资料未取得：2027目标暂未取得/);
  assert.match(final, /TARGET_2028/);
  assert.deepEqual(h.chunks, ['保留失败状态的解读']);
});

test('皇极真实规划先列古籍时仍优先补算目标时点并保留纠错额度', async (t) => {
  const question = '比较2026年8月24日15:30与2027年1月5日09:00的皇极变化';
  const draft = {
    ...defaultDraft,
    method: 'huangji' as const,
    question,
    questionSource: 'custom' as const,
    divinationTimeMode: 'custom' as const,
    customDivinationDate: '2026-08-24',
    customDivinationTime: '15:30',
    divinationTimeStandard: 'beijing' as const,
    huangjiMethod: 'standard' as const,
  };
  const session = await generateDivinationSession(draft);
  const h = harness([
    JSON.stringify({
      actions: [
        {
          kind: 'calculate',
          method: 'huangji',
          target: 'primary',
          input: { time: '2027-01-05 09:00:00', timezone: 'UTC+8' },
        },
        {
          kind: 'classic',
          method: 'huangji',
          query: '跨冬至换年时皇极经世月经卦、旬纬卦的统辖规则',
        },
        {
          kind: 'classic',
          method: 'huangji',
          query: '六十年统卦火风鼎范围内2027年的值年卦取序规则',
        },
        { kind: 'schema', method: 'huangji' },
      ],
    }),
    JSON.stringify({
      actions: [
        { kind: 'classic', method: 'huangji', query: '跨冬至换年时皇极经世月经卦、旬纬卦统辖规则' },
        {
          kind: 'classic',
          method: 'huangji',
          query: '六十年统卦火风鼎范围内2027年的值年卦取序规则',
        },
        {
          kind: 'calculate',
          method: 'huangji',
          target: 'primary',
          input: { customDate: '2027-01-05T09:00:00+08:00' },
        },
        { kind: 'classic', method: 'huangji', query: '皇极经世冬至换年的具体时点与卦象变易规则' },
      ],
    }),
    '根据实际目标盘解读',
  ]);
  h.options.subject = buildDivinationReadingSubject(draft, session);
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) =>
    handlePublicApiRequest(
      new Request(new URL(String(input), 'https://aov.cc'), init),
    )) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const actions: string[] = [];
  await runReadingWorkflow([{ role: 'user', content: session.prompt }], h.options, {
    stream: h.stream,
    execute: async (action, signal, subject) => {
      actions.push(action.kind);
      return executeReadingAction(action, signal, subject);
    },
  });
  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  assert.deepEqual(actions.slice(0, 3), ['schema', 'calculate', 'calculate']);
  assert.ok(actions.length <= 4);
  const target = h.options.memory.resources.find((item) => item.structured?.dateTimeForecast);
  assert.ok(target?.usable);
  const forecast = target.structured!.dateTimeForecast as { civilTime: { dateTime: string } };
  assert.match(forecast.civilTime.dateTime, /^2027-01-05[ T]09:00/);
  assert.match(h.sent.at(-1)![0].content, /2027/);
});

test('没有主体快照时跳过自动补算并明确提示', async () => {
  const h = harness([
    '{"actions":[{"kind":"calculate","method":"bazi","input":{"year":1990}}]}',
    '已有盘面解读',
  ]);
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], h.options, {
    stream: h.stream,
    execute: async () => {
      throw new Error('不应执行');
    },
  });
  assert.ok(h.notices.some((item) => item.includes('主体快照')));
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.chunks, ['已有盘面解读']);
});

test('准备格式不兼容时明确提示并继续已有资料解读，网络失败保留重试', async () => {
  const h = harness(['不是JSON', '仍不是JSON', '已有资料解读']);
  await runReadingWorkflow([{ role: 'user', content: '塔罗：星星正位' }], h.options, {
    stream: h.stream,
    execute: async () => {
      throw new Error('不应执行');
    },
  });
  assert.equal(h.notices.length, 1);
  assert.deepEqual(h.chunks, ['已有资料解读']);
  const failed = harness([]);
  await runReadingWorkflow([{ role: 'user', content: '原始盘面' }], failed.options, {
    stream: async (_messages, callbacks) => callbacks.onError('网络失败'),
    execute: async () => {
      throw new Error('不应执行');
    },
  });
  assert.deepEqual(failed.errors, ['网络失败']);
  assert.equal(failed.done(), 0);
});

test('查询失败保留盘面且明确说明', async () => {
  const h = harness(['{"actions":[{"kind":"classic","method":"bazi","query":"甲"}]}', '解读']);
  await runReadingWorkflow([{ role: 'user', content: '八字原始资料' }], h.options, {
    stream: h.stream,
    execute: async () => {
      throw new Error('资料暂不可用');
    },
  });
  assert.ok(h.notices.length);
  assert.match(h.sent[1][0].content, /八字原始资料/);
  assert.match(h.sent.at(-1)![0].content, /“甲”条文未取得：资料暂不可用/);
  assert.equal(h.done(), 1);
});

test('补算成功后后续资料准备失败仍保留已取得资料', async () => {
  const memory: ReadingMemory = { resources: [] };
  const errors: string[] = [];
  const executed: string[] = [];
  let planningCalls = 0;
  const options: ReadingOptions = {
    memory,
    subject: baziSubject,
    onProgress: () => {},
    onNotice: () => {},
    onError: (message) => errors.push(message),
    onChunk: () => {},
    onDone: () => {},
  };
  const stream: ReadingDependencies['stream'] = async (_messages, callbacks) => {
    planningCalls += 1;
    if (planningCalls === 1) {
      callbacks.onChunk(
        JSON.stringify({
          actions: [
            { kind: 'schema', method: 'bazi' },
            { kind: 'calculate', method: 'bazi', input: { year: 1990 } },
          ],
        }),
      );
      callbacks.onDone();
      return;
    }
    callbacks.onError('后续准备失败');
  };
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], options, {
    stream,
    execute: async (action) => {
      executed.push(action.kind);
      return action.kind === 'schema'
        ? { key: '', title: '八字参数', text: '参数格式', usable: false }
        : { key: '', title: '目标流年', text: '补算事实', usable: true };
    },
  });

  assert.deepEqual(executed, ['schema', 'calculate']);
  assert.equal(memory.resources[0]?.text, '补算事实');
  assert.equal(memory.schemas?.[0]?.text, '参数格式');
  assert.deepEqual(errors, ['后续准备失败']);
});

test('补算返回后立即取消仍保留成功资料', async () => {
  const controller = new AbortController();
  const schema: ReadingResource = {
    key: JSON.stringify({ kind: 'schema', method: 'bazi' }),
    title: '八字参数',
    text: '参数格式',
    usable: false,
    kind: 'schema',
  };
  const memory: ReadingMemory = { resources: [], schemas: [schema] };
  const errors: string[] = [];
  const options: ReadingOptions = {
    memory,
    subject: baziSubject,
    signal: controller.signal,
    onProgress: () => {},
    onNotice: () => {},
    onError: (message) => errors.push(message),
    onChunk: () => {},
    onDone: () => {},
  };
  const stream: ReadingDependencies['stream'] = async (_messages, callbacks) => {
    callbacks.onChunk(
      JSON.stringify({
        actions: [{ kind: 'calculate', method: 'bazi', input: { year: 1990 } }],
      }),
    );
    callbacks.onDone();
  };
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], options, {
    stream,
    execute: async () => {
      controller.abort();
      return { key: '', title: '目标流年', text: '取消前已取得', usable: true };
    },
  });

  assert.equal(memory.resources[0]?.text, '取消前已取得');
  assert.deepEqual(errors, []);
});

test('未命中的古籍查询不会占用已见键并可在下一轮重试', async () => {
  const h = harness([
    '{"actions":[{"kind":"schema","method":"bazi"},{"kind":"classic","method":"bazi","query":"不存在的条文"}]}',
    '{"actions":[{"kind":"classic","method":"bazi","query":"不存在的条文"}]}',
    '重试后的解读',
  ]);
  h.options.memory.resources = [
    {
      key: JSON.stringify({ kind: 'classic', method: 'bazi', query: '不存在的条文' }),
      title: '历史未命中条文',
      text: '',
      usable: false,
    },
  ];
  let attempts = 0;
  await runReadingWorkflow([{ role: 'user', content: '八字原始资料' }], h.options, {
    stream: h.stream,
    execute: async (action) => {
      if (action.kind === 'schema')
        return { key: '', title: '八字参数', text: '参数格式', usable: false };
      attempts += 1;
      return attempts === 1
        ? { key: '', title: '未命中条文', text: '', usable: false }
        : { key: '', title: '补充条文', text: '甲木参天', usable: true };
    },
  });

  assert.equal(attempts, 2);
  assert.equal(h.options.memory.resources.length, 1);
  assert.equal(h.options.memory.resources[0]?.text, '甲木参天');
  assert.deepEqual(h.chunks, ['重试后的解读']);
});

test('失败的古籍查询不会占用已见键并可在下一轮重试', async () => {
  const h = harness([
    '{"actions":[{"kind":"schema","method":"bazi"},{"kind":"classic","method":"bazi","query":"甲木"}]}',
    '{"actions":[{"kind":"classic","method":"bazi","query":"甲木"}]}',
    '失败后重试的解读',
  ]);
  let attempts = 0;
  await runReadingWorkflow([{ role: 'user', content: '八字原始资料' }], h.options, {
    stream: h.stream,
    execute: async (action) => {
      if (action.kind === 'schema')
        return { key: '', title: '八字参数', text: '参数格式', usable: false };
      attempts += 1;
      if (attempts === 1) throw new Error('条文服务暂时失败');
      return { key: '', title: '补充条文', text: '甲木参天', usable: true };
    },
  });

  assert.equal(attempts, 2);
  assert.equal(h.options.memory.resources[0]?.text, '甲木参天');
  assert.deepEqual(h.chunks, ['失败后重试的解读']);
});

test('取消准备后不执行补查或最终解读，也不写入其他会话资料', async () => {
  const h = harness([]),
    controller = new AbortController();
  const existing = {
    key: 'existing',
    title: '既有资料',
    text: '既有事实'.repeat(6000),
    usable: true,
  };
  h.options.memory.resources = [existing];
  h.options.signal = controller.signal;
  await runReadingWorkflow([{ role: 'user', content: '八字盘面' }], h.options, {
    stream: async (_messages, callbacks) => {
      controller.abort();
      callbacks.onChunk('{"actions":[]}');
      callbacks.onDone();
    },
    execute: async () => {
      throw new Error('不应执行');
    },
  });
  assert.equal(h.done(), 0);
  assert.deepEqual(h.options.memory.resources, [existing]);
  assert.deepEqual(h.errors, []);
});

test('长对话保持原始盘面与最近问答，超大原始资料明确报错', () => {
  const original = { role: 'user' as const, content: '原始盘面'.repeat(1000) };
  const messages = [
    original,
    ...Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 ? ('user' as const) : ('assistant' as const),
      content: `第${index}条` + '内容'.repeat(1200),
    })),
  ];
  const result = fitReadingMessages(messages, '解读方法');
  assert.ok(result[0].content.startsWith(original.content));
  assert.deepEqual(result.at(-1), messages.at(-1));
  assert.ok(result.reduce((sum, item) => sum + item.content.length, 0) <= 49000);
  assert.throws(
    () => fitReadingMessages([{ role: 'user', content: '盘'.repeat(50000) }], ''),
    /容量/,
  );
});

test('古籍查询读取真实条文并限定术式', async () => {
  const item = await lookupReadingClassics('bazi', '甲');
  assert.ok(item.usable);
  assert.match(item.text, /甲木/);
  assert.doesNotMatch(item.text, /classicVerse|modernExplanation|sourceBook/);
  const absent = await lookupReadingClassics('tarot', '甲');
  assert.equal(absent.usable, false);
});

test('古籍查询支持自然语言日主与月令，并返回稳定条文来源编号', async () => {
  const ditiansui = await lookupReadingClassics('bazi', '滴天髓论甲木');
  assert.equal(ditiansui.usable, true);
  assert.match(ditiansui.text, /甲木参天/u);
  assert.deepEqual(ditiansui.sourceIds, ['BAZI_DITIANSUI_TABLE:甲']);

  const qiongtong = await lookupReadingClassics('bazi', '甲木生于卯月');
  assert.equal(qiongtong.usable, true);
  assert.match(qiongtong.text, /仲春甲木/u);
  assert.ok(qiongtong.sourceIds?.some((id) => id.startsWith('BAZI_QIONGTONG_TABLE:')));
});

test('补算使用真实公开契约且只返回完整提示词', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) =>
    handlePublicApiRequest(
      new Request(new URL(String(input), 'https://aov.cc'), init),
    )) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const method of ['bazi', 'ziwei', 'astrolabe', 'qi-zheng']) {
    const schema = await executeReadingAction({ kind: 'schema', method });
    assert.equal(schema.usable, false);
    assert.match(schema.text, /properties/);
    assert.doesNotMatch(schema.text, /\$ref/);
  }
  const data = await executeReadingAction(
    {
      kind: 'calculate',
      method: 'bazi',
      input: {
        year: 1990,
        month: 5,
        day: 15,
        timeIndex: 8,
        dateType: 'solar',
        gender: 'male',
        question: '整体解读',
      },
    },
    undefined,
    baziSubject,
  );
  assert.ok(data.usable);
  assert.match(data.text, /1990|庚午/);
  const structured = data.structured as { calculationIdentity?: { method?: string } } | undefined;
  assert.equal(structured?.calculationIdentity?.method, 'bazi');
});

test('自动补算拒绝更换主体并保留当前主体字段', async (t) => {
  const original = globalThis.fetch;
  let request: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input, init) => {
    request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          result: {
            gender: request.gender,
            solarDate: { year: request.year, month: request.month, day: request.day },
            lunarDate: { year: request.year, month: request.month, day: request.day },
            timeInfo: { index: request.timeIndex },
            calculationIdentity: {
              method: 'bazi',
              birth: {
                gender: request.gender,
                year: request.year,
                month: request.month,
                day: request.day,
                dateType: request.dateType,
                isLeapMonth: request.isLeapMonth,
                useTrueSolarTime: request.useTrueSolarTime,
                timeIndex: request.timeIndex,
              },
              target: { baziFortuneYear: request.baziFortuneYear },
            },
          },
          prompt: '目标流年',
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  await assert.rejects(
    () =>
      executeReadingAction(
        { kind: 'calculate', method: 'bazi', input: { year: 1991, baziFortuneYear: 2026 } },
        undefined,
        baziSubject,
      ),
    /主体与当前命盘不一致/u,
  );
  await executeReadingAction(
    { kind: 'calculate', method: 'bazi', input: { year: 1990, baziFortuneYear: 2026 } },
    undefined,
    baziSubject,
  );
  assert.equal(request?.year, 1990);
  assert.equal(request?.baziFortuneYear, 2026);
});

test('超过18000但低于最终上下文的完整资料仍进入解读', async () => {
  const h = harness(['{"actions":[{"kind":"classic","method":"bazi","query":"甲"}]}', '解读']);
  const text = '精确完整事实'.repeat(3500);
  await runReadingWorkflow([{ role: 'user', content: '完整原盘' }], h.options, {
    stream: h.stream,
    execute: async () => ({ key: '', title: '精确完整资料', text, usable: true }),
  });
  assert.equal(h.options.memory.resources.length, 1);
  assert.equal(h.options.memory.resources[0].text, text);
  assert.match(h.sent.at(-1)![0].content, /精确完整资料/);
  assert.match(h.sent.at(-1)![0].content, /精确完整事实/);
  assert.doesNotMatch(h.sent.at(-1)![0].content, /资料覆盖/);
});

test('两份合计超过18000的完整资料同时保留', async () => {
  const h = harness([
    '{"actions":[{"kind":"classic","method":"bazi","query":"甲"},{"kind":"classic","method":"bazi","query":"乙"}]}',
    '解读',
  ]);
  const first = '第一完整事实'.repeat(1900);
  const second = '第二完整事实'.repeat(1900);
  await runReadingWorkflow([{ role: 'user', content: '完整原盘' }], h.options, {
    stream: h.stream,
    execute: async (action) => ({
      key: '',
      title: action.kind === 'classic' && action.query === '甲' ? '第一资料' : '第二资料',
      text: action.kind === 'classic' && action.query === '甲' ? first : second,
      usable: true,
    }),
  });
  assert.equal(h.options.memory.resources.length, 2);
  assert.match(h.sent.at(-1)![0].content, /第一完整事实/);
  assert.match(h.sent.at(-1)![0].content, /第二完整事实/);
  assert.doesNotMatch(h.sent.at(-1)![0].content, /资料覆盖/);
});

test('真实超出最终上下文时不静默丢弃成功资料并明确覆盖范围', async () => {
  const h = harness([
    '{"actions":[{"kind":"classic","method":"bazi","query":"甲"},{"kind":"classic","method":"bazi","query":"乙"}]}',
    '解读',
  ]);
  const first = '第一阶段完整事实'.repeat(5000);
  const second = '第二阶段完整事实'.repeat(4000);
  await runReadingWorkflow([{ role: 'user', content: '完整原盘' }], h.options, {
    stream: h.stream,
    execute: async (action) => ({
      key: '',
      title: action.kind === 'classic' && action.query === '甲' ? '第一阶段' : '第二阶段',
      text: action.kind === 'classic' && action.query === '甲' ? first : second,
      usable: true,
    }),
  });
  assert.equal(h.options.memory.resources.length, 2);
  assert.match(h.sent.at(-1)![0].content, /第一阶段完整事实/);
  assert.match(h.sent.at(-1)![0].content, /【资料状态】/);
  assert.match(h.sent.at(-1)![0].content, /第二阶段/);
  assert.match(h.sent.at(-1)![0].content, /待后续补足/);
  assert.ok(h.notices.some((text) => text.includes('未纳入本轮判断')));
  assert.doesNotMatch(h.sent.at(-1)![0].content, /第二阶段完整事实/);
});

test('紫微完整结构化资料未超限时零额外阶段调用', async () => {
  const h = harness(['最终解读']);
  const resource = makeZiweiFullResource(2, 1);
  h.options.memory.resources = [resource];
  h.options.subject = ziweiSubject;
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], h.options, {
    stream: h.stream,
    execute: async () => {
      throw new Error('未预期的补算');
    },
  });
  assert.equal(h.sent.length, 1);
  assert.equal(h.options.memory.ziweiPhaseReading, undefined);
  assert.match(h.sent[0]![0]!.content, /紫微完整资料/);
});

test('真实完整紫微规范正文未超限时进入最终stream', async () => {
  const h = harness(['最终解读']);
  const resource = await makeCanonicalZiweiFullResource(
    '真实主体',
    'female',
    { year: '1992', month: '8', day: '21' },
    'ziwei-full-real-text',
  );
  h.options.memory.resources = [resource];
  h.options.subject = ziweiSubject;
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], h.options, {
    stream: h.stream,
    execute: async () => {
      throw new Error('未预期的补算');
    },
  });
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0]![0]!.content, /完整紫微运限资料/);
  assert.match(h.sent[0]![0]!.content, /真实主体紫微完整运限资料/);
});

test('紫微结构化时间线超限时按完整阶段事实逐段解读并汇总', async () => {
  const h = harness(['第一阶段判断', '第二阶段判断', '全部阶段汇总']);
  const resource = makeZiweiFullResource(2, 1500, '完整原始资料'.repeat(16000));
  h.options.memory.resources = [resource];
  h.options.subject = ziweiSubject;
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], h.options, {
    stream: h.stream,
    execute: async () => {
      throw new Error('未预期的补算');
    },
  });
  assert.equal(h.sent.length, 3, JSON.stringify(h.errors));
  assert.match(h.sent[0]![0]!.content, /阶段 1\/2/);
  assert.match(h.sent[0]![0]!.content, /主体：紫微完整运限资料/);
  assert.match(h.sent[0]![0]!.content, /安星口径：传统通行安星法/);
  assert.match(h.sent[0]![0]!.content, /流年2000/);
  assert.match(h.sent[1]![0]!.content, /阶段 2\/2/);
  assert.match(h.sent[1]![0]!.content, /流年2001/);
  assert.match(h.sent[2]![0]!.content, /1\/2、2\/2/);
  assert.equal(h.options.memory.resources[0], resource);
  assert.equal(
    h.options.memory.ziweiPhaseReading?.phases.every((item) => item.status === 'succeeded'),
    true,
  );
});

test('紫微单年事实仍超容量时保留原始资料并明确失败', async () => {
  const h = harness([]);
  const resource = makeZiweiFullResource(1, 4000, '完整原始资料'.repeat(16000));
  h.options.memory.resources = [resource];
  h.options.subject = ziweiSubject;
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], h.options, {
    stream: h.stream,
    execute: async () => resource,
  });
  assert.equal(h.sent.length, 0);
  assert.deepEqual(h.errors, ['紫微完整资料的第1个大限仍超出单阶段容量。']);
  assert.equal(h.options.memory.resources[0], resource);
  assert.equal(h.done(), 0);
});

test('紫微阶段空回答标记失败并可重试', async () => {
  const resource = makeZiweiFullResource(2, 1500, '完整原始资料'.repeat(16000));
  const first = harness([]);
  first.options.memory.resources = [resource];
  first.options.subject = ziweiSubject;
  let calls = 0;
  const emptyStream: ReadingDependencies['stream'] = async (_messages, callbacks) => {
    calls += 1;
    callbacks.onDone();
  };
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], first.options, {
    stream: emptyStream,
    execute: async () => resource,
  });
  assert.equal(calls, 1);
  assert.deepEqual(first.errors, ['紫微阶段1/2返回空结果，请重试。']);
  assert.equal(first.done(), 0);
  assert.equal(first.options.memory.ziweiPhaseReading?.phases[0]?.status, 'failed');

  const retry = harness(['第一阶段重试', '第二阶段重试', '重试汇总']);
  retry.options.memory = first.options.memory;
  retry.options.subject = ziweiSubject;
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], retry.options, {
    stream: retry.stream,
    execute: async () => resource,
  });
  assert.equal(retry.done(), 1);
  assert.deepEqual(
    retry.options.memory.ziweiPhaseReading?.phases.map((item) => item.status),
    ['succeeded', 'succeeded'],
  );
});

test('紫微阶段归并空回答不形成全覆盖', async () => {
  const resource = makeZiweiFullResource(2, 1500, '完整原始资料'.repeat(16000));
  const h = harness([]);
  h.options.memory.resources = [resource];
  h.options.subject = ziweiSubject;
  let calls = 0;
  const stream: ReadingDependencies['stream'] = async (_messages, callbacks) => {
    calls += 1;
    if (calls <= 2) callbacks.onChunk('答'.repeat(25_000));
    callbacks.onDone();
  };
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], h.options, {
    stream,
    execute: async () => resource,
  });
  assert.equal(calls, 3);
  assert.ok(h.errors[0]?.includes('阶段归并'));
  assert.equal(h.done(), 0);
  assert.deepEqual(
    h.options.memory.ziweiPhaseReading?.phases.map((item) => item.status),
    ['succeeded', 'succeeded'],
  );
});

test('真实双人八字紫微全文自然超限时合并相邻运段且完整保留双方资料', async () => {
  const primary = await makeCanonicalZiweiFullResource(
    '甲主体',
    'female',
    { year: '1992', month: '8', day: '21' },
    'ziwei-full-primary',
  );
  const partner = await makeCanonicalZiweiFullResource(
    '乙主体',
    'male',
    { year: '1991', month: '3', day: '14' },
    'ziwei-full-partner',
  );
  const h = harness([]);
  h.options.memory.resources = [primary, partner];
  h.options.subject = ziweiSubject;
  const baziPrompts: string[] = [];
  for (const person of [
    { name: '甲主体', gender: 'female', year: 1992, month: 8, day: 21 },
    { name: '乙主体', gender: 'male', year: 1991, month: 3, day: 14 },
  ]) {
    const response = await handlePublicApiRequest(
      new Request('https://aov.cc/api/v1/bazi/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...person,
          dateType: 'solar',
          timeIndex: 4,
          timeZoneId: 'Asia/Shanghai',
          baziFortuneScope: 'full',
          responseMode: 'full',
          question: '结合双方完整运限分析关系的发展阶段。',
        }),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    baziPrompts.push(`【${person.name}八字资料】\n${body.data.prompt}`);
  }
  const initial = `${baziPrompts.join('\n\n')}\n\n【问题】结合双方完整运限分析关系的发展阶段。`;
  assert.ok(initial.length < 49_000);
  assert.ok(initial.length + primary.text.length + partner.text.length > 49_000);
  assert.deepEqual(structuredClone([primary, partner]), [primary, partner]);
  await runReadingWorkflow([{ role: 'user', content: initial }], h.options, {
    stream: h.stream,
    execute: async () => primary,
  });
  const phaseCount = h.options.memory.ziweiPhaseReading?.phases.length ?? 0;
  assert.deepEqual(h.errors, []);
  assert.equal(phaseCount, 2);
  assert.equal(h.sent.length, phaseCount + 1);
  for (const batch of h.sent) {
    assert.ok(batch.reduce((sum, message) => sum + message.content.length, 0) <= 49_000);
    assert.equal(batch[0]!.content.split(initial).length - 1, 1);
  }
  assert.ok(
    h.sent.slice(0, phaseCount).some((batch) => batch[0]!.content.includes('主体：甲主体')),
  );
  assert.ok(
    h.sent.slice(0, phaseCount).some((batch) => batch[0]!.content.includes('主体：乙主体')),
  );
  assert.ok(h.sent.at(-1)![0]!.content.includes('主体：甲主体'));
  assert.ok(h.sent.at(-1)![0]!.content.includes('主体：乙主体'));
  assert.ok(
    h.options.memory.ziweiPhaseReading?.phases.every((item) => item.status === 'succeeded'),
  );
  assert.deepEqual(
    new Set(h.options.memory.ziweiPhaseReading?.phases.map((item) => item.resourceKey)),
    new Set([primary.key, partner.key]),
  );
  assert.equal(h.options.memory.resources.length, 2);
});

test('紫微双主体中途失败后重试只补失败主体阶段', async () => {
  const primary = {
    ...makeZiweiFullResource(2, 1500, '第一主体完整资料'.repeat(16_000)),
    key: 'ziwei-full-primary',
    title: '甲主体紫微完整运限资料',
  };
  const partner = {
    ...makeZiweiFullResource(2, 1500, '第二主体完整资料'.repeat(16_000)),
    key: 'ziwei-full-partner',
    title: '乙主体紫微完整运限资料',
  };
  const h = harness([]);
  h.options.memory.resources = [primary, partner];
  h.options.subject = ziweiSubject;
  const sent: ChatMessage[][] = [];
  let calls = 0;
  let fail = true;
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    sent.push(messages);
    calls += 1;
    if (fail && calls === 3) {
      callbacks.onError('乙主体阶段暂时失败');
      return;
    }
    callbacks.onChunk(calls === 1 ? '甲主体阶段一成功' : '汇总成功');
    callbacks.onDone();
  };
  const input = [{ role: 'user' as const, content: '紫微双主体原盘，问关系' }];
  await runReadingWorkflow(input, h.options, { stream, execute: async () => primary });
  assert.deepEqual(
    h.options.memory.ziweiPhaseReading?.phases.map((item) => item.status),
    ['succeeded', 'succeeded', 'failed', 'pending'],
  );
  assert.deepEqual(
    h.options.memory.ziweiPhaseReading?.phases.map((item) => item.resourceKey),
    [primary.key, primary.key, partner.key, partner.key],
  );
  assert.deepEqual(h.errors, ['乙主体阶段暂时失败']);
  fail = false;
  await runReadingWorkflow(input, h.options, { stream, execute: async () => primary });
  assert.equal(calls, 6);
  assert.ok(sent[3]![0]!.content.includes('主体：乙主体'));
  assert.ok(sent[4]![0]!.content.includes('主体：乙主体'));
  assert.ok(sent[5]![0]!.content.includes('主体：甲主体'));
  assert.ok(sent[5]![0]!.content.includes('主体：乙主体'));
  assert.deepEqual(
    h.options.memory.ziweiPhaseReading?.phases.map((item) => item.status),
    ['succeeded', 'succeeded', 'succeeded', 'succeeded'],
  );
});

test('紫微阶段失败后同问题重试只补失败阶段并保留成功阶段', async () => {
  const h = harness([]);
  const resource = makeZiweiFullResource(2, 1500, '完整原始资料'.repeat(16000));
  h.options.memory.resources = [resource];
  h.options.subject = ziweiSubject;
  const sent: ChatMessage[][] = [];
  let calls = 0;
  let fail = true;
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    sent.push(messages);
    calls += 1;
    if (fail && calls === 2) {
      callbacks.onError('阶段暂时失败');
      return;
    }
    callbacks.onChunk(calls === 1 ? '第一阶段成功' : calls === 3 ? '第二阶段重试成功' : '最终汇总');
    callbacks.onDone();
  };
  const input = [{ role: 'user' as const, content: '紫微完整原盘，问事业' }];
  await runReadingWorkflow(input, h.options, { stream, execute: async () => resource });
  assert.deepEqual(
    h.options.memory.ziweiPhaseReading?.phases.map((item) => item.status),
    ['succeeded', 'failed'],
  );
  assert.deepEqual(h.errors, ['阶段暂时失败']);
  fail = false;
  await runReadingWorkflow(input, h.options, { stream, execute: async () => resource });
  assert.equal(calls, 4);
  assert.match(sent[2]![0]!.content, /阶段 2\/2/);
  assert.doesNotMatch(sent[2]![0]!.content, /第一阶段成功/);
  assert.deepEqual(
    h.options.memory.ziweiPhaseReading?.phases.map((item) => item.status),
    ['succeeded', 'succeeded'],
  );
});

test('紫微阶段取消后换问题不会复用旧摘要', async () => {
  const h = harness([]);
  const resource = makeZiweiFullResource(2, 1500, '完整原始资料'.repeat(16000));
  h.options.memory.resources = [resource];
  h.options.subject = ziweiSubject;
  const controller = new AbortController();
  h.options.signal = controller.signal;
  const cancelledStream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    void messages;
    callbacks.onChunk('取消前摘要');
    controller.abort();
  };
  await runReadingWorkflow([{ role: 'user', content: '紫微完整原盘，问事业' }], h.options, {
    stream: cancelledStream,
    execute: async () => resource,
  });
  assert.equal(h.options.memory.ziweiPhaseReading?.phases[0]?.status, 'cancelled');

  const retry = harness(['新问题阶段一', '新问题阶段二', '新问题汇总']);
  retry.options.memory = h.options.memory;
  retry.options.subject = ziweiSubject;
  await runReadingWorkflow(
    [
      { role: 'user', content: '紫微完整原盘，问事业' },
      { role: 'assistant', content: '上一轮未完成' },
      { role: 'user', content: '改问婚恋' },
    ],
    retry.options,
    { stream: retry.stream, execute: async () => resource },
  );
  assert.equal(retry.sent.length, 3);
  for (const batch of retry.sent) {
    assert.deepEqual(batch.at(-1), { role: 'user', content: '改问婚恋' });
    assert.equal(
      batch
        .map((message) => message.content)
        .join('\n')
        .split('改问婚恋').length - 1,
      1,
    );
    assert.ok(batch.every((message) => !message.content.includes('取消前摘要')));
  }
  assert.equal(retry.options.memory.ziweiPhaseReading?.question, '改问婚恋');
});

test('历史消息有余量时保留完整补充资料并按现有规则裁剪旧消息', async () => {
  const h = harness(['{"actions":[{"kind":"classic","method":"bazi","query":"甲"}]}', '解读']);
  const messages = [
    { role: 'user' as const, content: '原始盘面' },
    ...Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 ? ('user' as const) : ('assistant' as const),
      content: `历史第${index}条` + '历史内容'.repeat(1000),
    })),
  ];
  const text = '阶段完整事实'.repeat(3500);
  await runReadingWorkflow(messages, h.options, {
    stream: h.stream,
    execute: async () => ({ key: '', title: '阶段资料', text, usable: true }),
  });
  const final = h.sent.at(-1)!;
  assert.match(final[0].content, /原始盘面/);
  assert.match(final[0].content, /阶段完整事实/);
  assert.deepEqual(final.at(-1), messages.at(-1));
  assert.ok(final.reduce((sum, item) => sum + item.content.length, 0) <= 49000);
});

test('模型输出达到上限时返回可辨认的中断错误', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      'data: {"choices":[{"delta":{"content":"已有解读"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',
    )) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ prompt: '盘面资料' }),
    }),
    undefined,
    {
      AI_API_KEY: 'test',
      AI_MODEL: 'test',
      AI_BASE_URL: 'https://example.com/v1',
      AI_BUILTIN_ENABLED: 'true',
    },
  );
  const text = await response.text();
  assert.match(text, /已有解读/);
  assert.match(text, /AI_OUTPUT_LIMIT/);
  assert.doesNotMatch(text, /data: \[DONE\]/);
});

test('AI 宣称的每种古籍查询必须有真实非空资料表', async () => {
  const { READING_CLASSIC_TABLES } = await import('../src/lib/ai/reading-capabilities');
  const library: Record<string, unknown> = await import('mingyu-core/classics');
  for (const [method, tables] of Object.entries(READING_CLASSIC_TABLES)) {
    assert.ok(tables.length > 0, method);
    assert.equal(
      parseReadingPlan(JSON.stringify({ actions: [{ kind: 'classic', method, query: '条文' }] }))
        .length,
      1,
    );
    for (const table of tables) {
      const value = library[table];
      assert.ok(
        value && typeof value === 'object' && Object.keys(value).length > 0,
        `${method}/${table} 缺少实际资料`,
      );
    }
  }
  for (const method of ['tarot', 'lenormand', 'astrolabe', 'ssgw', 'name', 'zodiac']) {
    assert.throws(() =>
      parseReadingPlan(JSON.stringify({ actions: [{ kind: 'classic', method, query: '条文' }] })),
    );
  }
});
