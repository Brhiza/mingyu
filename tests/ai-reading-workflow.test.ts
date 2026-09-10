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
} from '../src/lib/ai/reading-workflow';
import { executeReadingAction, lookupReadingClassics } from '../src/lib/ai/reading-resources';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

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
  await runReadingWorkflow([{ role: 'user', content: '八字原始盘面' }], h.options, {
    stream: h.stream,
    execute: async (action) => {
      actions.push(action.kind);
      return {
        key: '',
        title: action.kind === 'schema' ? '参数' : '补充盘面',
        text: action.kind === 'schema' ? '{"properties":{}}' : '目标流年丙午',
        usable: action.kind !== 'schema',
      };
    },
  });
  assert.deepEqual(actions, ['schema', 'calculate']);
  const final = h.sent[2][0].content;
  assert.match(final, /八字原始盘面/);
  assert.match(final, /目标流年丙午/);
  assert.doesNotMatch(final, /properties/);
});

test('准备格式不兼容时明确提示并继续已有资料解读，网络失败保留重试', async () => {
  const h = harness(['不是JSON', '已有资料解读']);
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

test('取消准备后不执行补查或最终解读，也不写入其他会话资料', async () => {
  const h = harness([]),
    controller = new AbortController();
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
  assert.deepEqual(h.options.memory.resources, []);
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
  const data = await executeReadingAction({
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
  });
  assert.ok(data.usable);
  assert.match(data.text, /1990|庚午/);
});

test('过大的补充资料整项提示，原始盘面始终完整保留', async () => {
  const h = harness(['{"actions":[{"kind":"classic","method":"bazi","query":"甲"}]}', '解读']);
  await runReadingWorkflow([{ role: 'user', content: '完整原盘' }], h.options, {
    stream: h.stream,
    execute: async () => ({ key: '', title: '长条文', text: '长条文'.repeat(7000), usable: true }),
  });
  assert.deepEqual(h.options.memory.resources, []);
  assert.ok(h.notices.some((text) => text.includes('较多')));
  assert.ok(h.sent.at(-1)![0].content.startsWith('完整原盘'));
  assert.doesNotMatch(h.sent.at(-1)![0].content, /长条文/);
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
