import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAstrolabeDynamicRange } from 'mingyu-core/divination/astrolabe-dynamic-range';
import {
  runAstrolabeDynamicReadingRound,
  type AstrolabeDynamicReadingSource,
  type AstrolabeDynamicReadingCheckpoint,
} from '../src/lib/ai/astrolabe-dynamic-reading';
import { runReadingWorkflow, type ReadingMemory } from '../src/lib/ai/reading-workflow';
import type { StreamOptions, ChatMessage } from '../src/lib/ai/stream-client';
import { getAiChatCompletionStatus, normalizeAiChatHistory } from '../src/lib/ai/chat-history';
import {
  getLatestDynamicReadingCheckpoint,
  resolveRestoredAiChatState,
  buildAiChatRequest,
  type ChatTurn,
} from '../src/hooks/useAiChat';

const start = Date.parse('2024-03-20T11:00:00+08:00');
const range = generateAstrolabeDynamicRange(
  {
    name: '公开合成分轮验证',
    gender: '男',
    year: '2024',
    month: '3',
    day: '20',
    hour: '11',
    minute: '0',
    second: '0',
    longitude: '116.416334',
    latitude: '39.9042',
    timezone: '8',
  },
  { startTimestamp: start, endTimestamp: start + 1000 },
  { scope: 'daily', referenceDate: '2028-03-20' },
);
const { branches, ...summary } = range;
const source: AstrolabeDynamicReadingSource = {
  key: '公开合成分轮验证',
  subjectId: 'synthetic-dynamic',
  summary,
  promptOptions: { question: '请分析学习安排。' },
  async readBranch(index) {
    return branches[index];
  },
};
const roundOptions = { question: '继续下一批', onChunk() {}, onProgress() {} };
const successfulStream = async (_messages: ChatMessage[], options: StreamOptions) => {
  options.onChunk('仅在当前已覆盖时段成立的合成解读与依据。');
  options.onDone();
};

test('动态解读每轮仅完成一页，全部页之后单独归纳才标记完成', async () => {
  let checkpoint: AstrolabeDynamicReadingCheckpoint | undefined;
  let rounds = 0;
  const calls: string[] = [];
  const stream = async (messages: ChatMessage[], options: StreamOptions) => {
    assert.equal(messages.length, 1);
    assert.ok(messages[0].content.length < 40000);
    calls.push(messages[0].content);
    await successfulStream(messages, options);
  };
  do {
    const previousPages = checkpoint?.completedPages ?? 0;
    checkpoint = await runAstrolabeDynamicReadingRound(source, checkpoint, roundOptions, stream);
    assert.equal(checkpoint.completedPages, previousPages + 1);
    assert.notEqual(checkpoint.stage, 'complete');
    assert.ok(++rounds < 100);
  } while (checkpoint.stage === 'pages');
  assert.equal(checkpoint.stage, 'summary');
  assert.equal(checkpoint.completedBranches, range.branchCount);
  assert.equal(calls.length, rounds * 2);
  assert.match(calls[2], /此前分段归纳/u);
  const restored = JSON.parse(JSON.stringify(checkpoint)) as AstrolabeDynamicReadingCheckpoint;
  const final = await runAstrolabeDynamicReadingRound(source, restored, roundOptions, stream);
  assert.equal(final.stage, 'complete');
  assert.equal(final.completedPages, rounds);
  assert.equal(calls.length, rounds * 2 + 1);
});

test('阶段归纳失败不推进页位置，重试仍读取同一页', async () => {
  const previous = await runAstrolabeDynamicReadingRound(
    source,
    undefined,
    roundOptions,
    successfulStream,
  );
  const before = structuredClone(previous);
  const failedPrompts: string[] = [];
  await assert.rejects(
    runAstrolabeDynamicReadingRound(source, previous, roundOptions, async (messages, options) => {
      failedPrompts.push(messages[0].content);
      if (failedPrompts.length === 2) options.onError('合成网络故障');
      else await successfulStream(messages, options);
    }),
    /合成网络故障/u,
  );
  assert.deepEqual(previous, before);
  const retried: string[] = [];
  const next = await runAstrolabeDynamicReadingRound(
    source,
    previous,
    roundOptions,
    async (messages, options) => {
      retried.push(messages[0].content);
      await successfulStream(messages, options);
    },
  );
  assert.equal(retried[0], failedPrompts[0]);
  assert.equal(next.completedPages, previous.completedPages + 1);
});

test('停止和超容量归纳不会产生可提交的下一页进度', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    runAstrolabeDynamicReadingRound(
      source,
      undefined,
      { ...roundOptions, signal: controller.signal },
      async (messages, options) => {
        if (++calls === 2) controller.abort();
        else await successfulStream(messages, options);
      },
    ),
    { name: 'AbortError' },
  );
  calls = 0;
  await assert.rejects(
    runAstrolabeDynamicReadingRound(source, undefined, roundOptions, async (messages, options) => {
      if (++calls === 2) {
        options.onChunk('字'.repeat(8001));
        options.onDone();
      } else await successfulStream(messages, options);
    }),
    /超过容量/u,
  );
});

test('恢复进度要求同一主体及范围，错误资料不发起模型请求', async () => {
  const checkpoint = await runAstrolabeDynamicReadingRound(
    source,
    undefined,
    roundOptions,
    successfulStream,
  );
  let called = false;
  await assert.rejects(
    runAstrolabeDynamicReadingRound(
      { ...source, subjectId: 'another' },
      checkpoint,
      roundOptions,
      async () => {
        called = true;
      },
    ),
    /不匹配/u,
  );
  assert.equal(called, false);
});

test('主解读流程走分轮资料入口，成功后通知当前覆盖而非全区间完成', async () => {
  const memory: ReadingMemory = {
    resources: [
      {
        key: source.key,
        title: '西占动态出生区间',
        text: '',
        usable: true,
        dynamicAstrolabe: source,
      },
    ],
  };
  const notices: string[] = [];
  let done = false;
  await runReadingWorkflow(
    [{ role: 'user', content: '请开始解读。' }],
    {
      memory,
      subject: {
        id: source.subjectId,
        source: 'astrolabe',
        allowedMethods: ['astrolabe'],
        lockedInputs: {},
      },
      readingMethod: 'astrolabe',
      onProgress() {},
      onNotice(text) {
        notices.push(text);
      },
      onChunk() {},
      onDone() {
        done = true;
      },
      onError(text) {
        assert.fail(text);
      },
      onAstrolabeDynamicCheckpoint(checkpoint) {
        assert.equal(checkpoint.completedPages, 1);
      },
    },
    {
      stream: successfulStream,
      async execute() {
        throw new Error('已有完整动态资料时不应补算代表秒。');
      },
    },
  );
  assert.equal(done, true);
  assert.equal(memory.astrolabeDynamicReading?.completedPages, 1);
  assert.match(notices.join('\n'), /整个区间尚未解读完成/u);
});

test('分轮会话保存续读状态，已完成本页保留在对话中而非当作中断丢弃', async () => {
  const checkpoint = await runAstrolabeDynamicReadingRound(
    source,
    undefined,
    roundOptions,
    successfulStream,
  );
  const turns: ChatTurn[] = [
    { role: 'assistant', content: '当前页解读', dynamicReading: checkpoint },
  ];
  assert.equal(getAiChatCompletionStatus('done', turns), 'continuable');
  assert.equal(resolveRestoredAiChatState(turns, '原问题', 'continuable').status, 'done');
  assert.equal(resolveRestoredAiChatState(turns, '原问题', 'continuable').error, '');
  assert.equal(buildAiChatRequest('原问题', turns).at(-1)?.content, '当前页解读');
  assert.deepEqual(
    buildAiChatRequest('原问题', [...turns, { role: 'user', content: '继续下一批' }], true),
    [{ role: 'user', content: '继续下一批' }],
  );
  assert.deepEqual(buildAiChatRequest('原问题', turns, true), [
    { role: 'user', content: '原问题' },
  ]);
  const history = normalizeAiChatHistory({
    version: 2,
    activeSessionId: 'synthetic',
    sessions: [
      {
        id: 'synthetic',
        title: '公开合成验证',
        turns,
        completionStatus: 'continuable',
        createdAt: '2024-03-20',
        updatedAt: '2024-03-20',
      },
    ],
  });
  assert.deepEqual(getLatestDynamicReadingCheckpoint(history.sessions[0].turns), checkpoint);
  assert.equal(history.sessions[0].completionStatus, 'continuable');
  assert.deepEqual(
    getLatestDynamicReadingCheckpoint([
      ...turns,
      { role: 'assistant', content: '下一页中断内容', incomplete: true },
    ]),
    checkpoint,
  );
});
