import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { getAiChatCompletionStatus } from '@/lib/ai/chat-history';
import {
  buildAiChatRequest,
  getReadingResourceRestoreError,
  isReadingResourceSeedCompatible,
  removeIncompleteChatTurns,
  resolveReadingResourceSeed,
  resolveRestoredAiChatState,
  useAiChat,
  type UseAiChat,
} from '@/hooks/useAiChat';
import { formatReadingCurrentTime, type ReadingMemorySeed } from '@/lib/ai/reading-workflow';
import type { ChatMessage } from '@/lib/ai/stream-client';

// Only this hook's slots and effects: real callbacks/refs, synchronous rerenders, no mounted DOM
// or React scheduler/StrictMode coverage. Do not generalize this into a renderer.
function aiChatHost() {
  type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
  const slots: Slot[] = [];
  let index = 0;
  let effects: Array<() => void> = [];
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const changed = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !a || !b || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const dispatcher = {
    useState(initial: unknown) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[i].value,
        (value: unknown) => {
          slots[i].value = typeof value === 'function' ? value(slots[i].value) : value;
        },
      ];
    },
    useRef(initial: unknown) {
      const i = index++;
      slots[i] ??= { value: { current: initial } };
      return slots[i].value;
    },
    useCallback(callback: unknown, deps: readonly unknown[]) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: callback, deps };
      return slots[i].value;
    },
    useEffect(create: () => void | (() => void), deps?: readonly unknown[]) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const previous = slots[i];
        const slot: Slot = { deps };
        slots[i] = slot;
        effects.push(() => {
          previous?.cleanup?.();
          slot.cleanup = create() || undefined;
        });
      }
    },
  };
  return {
    render(): UseAiChat {
      index = 0;
      effects = [];
      const previous = internals.H;
      internals.H = dispatcher;
      let chat: UseAiChat;
      try {
        chat = useAiChat();
      } finally {
        internals.H = previous;
      }
      for (const effect of effects) effect();
      return chat;
    },
    cleanup() {
      for (const slot of slots) slot.cleanup?.();
    },
  };
}

function localSse(content: string, complete = true) {
  return new Response(
    `data: ${JSON.stringify({ content })}\n\n${complete ? 'data: [DONE]\n\n' : ''}`,
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function localAiFetch(
  context: TestContext,
  answer: (init: RequestInit) => Response | Promise<Response> = () => localSse('完整回答'),
) {
  const sent: ChatMessage[][] = [];
  context.mock.method(globalThis, 'fetch', async (input: unknown, init: RequestInit) => {
    assert.equal(input, '/api/v1/ai/analyze', 'all requests must stay in the local stub');
    assert.equal(init.method, 'POST');
    const body = JSON.parse(String(init.body)) as { messages: ChatMessage[]; aiConfig?: unknown };
    assert.equal(body.aiConfig, undefined);
    sent.push(body.messages);
    return body.messages.at(-1)?.content.includes('【当前任务：准备解读资料】')
      ? localSse('{"actions":[]}')
      : answer(init);
  });
  return sent;
}

// The hook returns void; yield bounded event-loop turns until its real asynchronous callbacks run.
async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (check()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.ok(check(), 'hook callbacks did not settle within 20 event-loop turns');
}

function assertRequestTime(sent: ChatMessage[][], timestamp: number) {
  assert.equal(sent.length, 2, 'one logical request sends a preparation and a final stream');
  const expected = formatReadingCurrentTime(new Date(timestamp));
  for (const messages of sent) {
    assert.ok(
      messages[0].content.includes(`【本轮当前时间】${expected}；`),
      `expected logical request time ${expected}`,
    );
  }
}

test('实际 hook 的 analyze/ask 取得新时间，跨年 retry 保留原时间和问题', async (context) => {
  const beforeYear = Date.parse('2026-12-31T15:59:00Z');
  const afterYear = Date.parse('2026-12-31T16:01:00Z');
  context.mock.timers.enable({ apis: ['Date'], now: beforeYear });
  const now = context.mock.method(Date, 'now');
  let complete = true;
  const sent = localAiFetch(context, () => localSse(complete ? '完整回答' : '部分回答', complete));
  const host = aiChatHost();
  context.after(() => host.cleanup());
  let chat = host.render();

  now.mock.resetCalls();
  chat.analyze('原始盘面');
  assert.equal(now.mock.callCount(), 1, 'analyze captures a fresh logical request time');
  assert.equal(now.mock.calls[0].result, beforeYear);
  await waitFor(() => (chat = host.render()).status === 'done');
  assert.deepEqual(chat.turns, [{ role: 'assistant', content: '完整回答' }]);

  complete = false;
  const askStart = sent.length;
  chat.ask('今年事业如何？');
  await waitFor(() => (chat = host.render()).status === 'error');
  const failedRequest = sent.slice(askStart);
  assertRequestTime(failedRequest, beforeYear);
  assert.equal(chat.canRetry, true);
  assert.equal(chat.turns.at(-1)?.incomplete, true);

  context.mock.timers.setTime(afterYear);
  complete = true;
  const retryStart = sent.length;
  now.mock.resetCalls();
  chat.retry();
  assert.equal(now.mock.callCount(), 0, 'retry must reuse the captured time');
  await waitFor(() => (chat = host.render()).status === 'done');
  assertRequestTime(sent.slice(retryStart), beforeYear);
  assert.deepEqual(sent.slice(retryStart), failedRequest, 'retry resends the same complete turns');
  assert.equal(
    chat.turns.some((turn) => turn.incomplete),
    false,
  );

  const nextAskStart = sent.length;
  chat.ask('今年事业如何？');
  await waitFor(() => (chat = host.render()).status === 'done');
  assertRequestTime(sent.slice(nextAskStart), afterYear);
  assert.equal(chat.turns.filter((turn) => turn.role === 'user').length, 2);

  context.mock.timers.setTime(afterYear + 60_000);
  now.mock.resetCalls();
  chat.analyze('新的原始盘面');
  assert.equal(now.mock.callCount(), 1, 'a new analyze must replace the previous time');
  assert.equal(now.mock.calls[0].result, afterYear + 60_000);
  await waitFor(() => (chat = host.render()).status === 'done');
  assert.deepEqual(chat.turns, [{ role: 'assistant', content: '完整回答' }]);
});

test('实际 hook 的 restore 忘记旧时间，reset 清除可重试请求', async (context) => {
  const beforeYear = Date.parse('2026-12-31T15:59:00Z');
  const afterYear = Date.parse('2026-12-31T16:01:00Z');
  context.mock.timers.enable({ apis: ['Date'], now: beforeYear });
  const sent = localAiFetch(context, () => localSse('未完成回答', false));
  const host = aiChatHost();
  context.after(() => host.cleanup());
  let chat = host.render();
  const savedTurns = [
    { role: 'assistant' as const, content: '已保存的完整回答' },
    { role: 'user' as const, content: '今年事业如何？' },
  ];

  chat.restore(savedTurns, '保存的原始盘面', undefined, 'pending');
  chat = host.render();
  assert.equal(chat.canRetry, true);
  chat.retry();
  await waitFor(() => (chat = host.render()).status === 'error' && sent.length === 2);
  assertRequestTime(sent, beforeYear);

  context.mock.timers.setTime(afterYear);
  chat.restore(savedTurns, '保存的原始盘面', undefined, 'pending');
  chat = host.render();
  const restoreStart = sent.length;
  chat.retry();
  await waitFor(
    () => (chat = host.render()).status === 'error' && sent.length === restoreStart + 2,
  );
  assertRequestTime(sent.slice(restoreStart), afterYear);

  context.mock.timers.setTime(afterYear + 60_000);
  const retryStart = sent.length;
  chat.retry();
  await waitFor(() => (chat = host.render()).status === 'error' && sent.length === retryStart + 2);
  assertRequestTime(sent.slice(retryStart), afterYear);

  chat.reset();
  chat = host.render();
  assert.equal(chat.status, 'idle');
  assert.equal(chat.hasStarted, false);
  assert.equal(chat.canRetry, false);
  assert.deepEqual(chat.turns, []);
  assert.equal(chat.streamingContent, '');
  assert.equal(chat.error, '');
  const resetStart = sent.length;
  chat.retry();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(sent.length, resetStart, 'reset leaves no old request to retry');
});

test('实际 hook 取消后旧 SSE 响应晚到不能发布到新对话', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-12-31T15:59:00Z') });
  let releaseOld: ((response: Response) => void) | undefined;
  let oldSignal: AbortSignal | undefined;
  localAiFetch(context, (init) => {
    if (releaseOld) return localSse('新对话完整回答');
    oldSignal = init.signal ?? undefined;
    return new Promise<Response>((resolve) => {
      releaseOld = resolve;
    });
  });
  const host = aiChatHost();
  context.after(() => host.cleanup());
  let chat = host.render();
  chat.analyze('旧对话盘面');
  await waitFor(() => Boolean(releaseOld));
  chat.cancel();
  chat = host.render();
  assert.equal(oldSignal?.aborted, true);
  assert.equal(chat.status, 'cancelled');
  assert.equal(chat.canRetry, true);

  context.mock.timers.setTime(Date.parse('2026-12-31T16:01:00Z'));
  chat.analyze('新对话盘面');
  await waitFor(() => (chat = host.render()).status === 'done');
  assert.deepEqual(chat.turns, [{ role: 'assistant', content: '新对话完整回答' }]);
  const current = chat;
  let discarded = false;
  const lateResponse = new Response(
    new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(
          new TextEncoder().encode('data: {"content":"旧对话迟到回答"}\n\ndata: [DONE]\n\n'),
        );
      },
      cancel() {
        discarded = true;
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
  assert.ok(releaseOld);
  releaseOld(lateResponse);
  await waitFor(() => discarded);
  assert.deepEqual(host.render(), current, 'late chunks/completion must not change the new state');
});

test('重试和追问的消息应过滤未完成回答但保留原问题', () => {
  const turns = [
    { role: 'user' as const, content: '第一次问题' },
    { role: 'assistant' as const, content: '完整回答' },
    { role: 'user' as const, content: '第二次问题' },
    { role: 'assistant' as const, content: '截断回答', incomplete: true },
  ];

  assert.deepEqual(removeIncompleteChatTurns(turns), turns.slice(0, 3));
  assert.deepEqual(buildAiChatRequest('原始盘面', turns), [
    { role: 'user', content: '原始盘面' },
    { role: 'user', content: '第一次问题' },
    { role: 'assistant', content: '完整回答' },
    { role: 'user', content: '第二次问题' },
  ]);
});

test('恢复未完成的空消息会保留已开始状态和重新生成入口', () => {
  for (const completionStatus of ['partial', 'error', 'pending'] as const) {
    const state = resolveRestoredAiChatState([], '原始盘面提示词', completionStatus);

    assert.equal(state.status, 'error');
    assert.match(state.error, /可重新生成/);
    assert.equal(state.hasStarted, true);
    assert.equal(state.canRetry, true);
  }
});

test('恢复取消的空消息仍可重试且不会显示未开始占位', () => {
  const state = resolveRestoredAiChatState([], '原始盘面提示词', 'cancelled');

  assert.equal(state.status, 'cancelled');
  assert.equal(state.error, '');
  assert.equal(state.hasStarted, true);
  assert.equal(state.canRetry, true);
});

test('恢复完整回答保持完成状态，不显示重试错误', () => {
  const state = resolveRestoredAiChatState(
    [{ role: 'assistant', content: '完整回答' }],
    '原始盘面提示词',
    'complete',
  );

  assert.deepEqual(state, {
    status: 'done',
    error: '',
    hasStarted: true,
    canRetry: false,
  });
});

test('新追问开始生成时应持久化为待完成状态', () => {
  const turns = [
    { role: 'assistant' as const, content: '旧的完整回答' },
    { role: 'user' as const, content: '新的追问' },
  ];

  assert.equal(getAiChatCompletionStatus('loading', turns), 'pending');
  assert.equal(getAiChatCompletionStatus('streaming', turns), 'pending');
  assert.equal(getAiChatCompletionStatus('done', turns), 'complete');
});

test('恢复时旧未完成回答不应覆盖最新完整回答', () => {
  const state = resolveRestoredAiChatState(
    [
      { role: 'assistant', content: '旧截断回答', incomplete: true },
      { role: 'user', content: '新的追问' },
      { role: 'assistant', content: '新的完整回答' },
    ],
    '原始盘面提示词',
    'complete',
  );

  assert.deepEqual(state, {
    status: 'done',
    error: '',
    hasStarted: true,
    canRetry: false,
  });
});

test('恢复时尾部新问题应保持待完成并可重试', () => {
  const state = resolveRestoredAiChatState(
    [
      { role: 'assistant', content: '旧截断回答', incomplete: true },
      { role: 'user', content: '新的追问' },
    ],
    '原始盘面提示词',
    'complete',
  );

  assert.equal(state.status, 'error');
  assert.match(state.error, /可重新生成/);
  assert.equal(state.hasStarted, true);
  assert.equal(state.canRetry, true);
});

test('恢复时最新未完成回答仍应显示未完成状态', () => {
  const state = resolveRestoredAiChatState(
    [
      { role: 'assistant', content: '旧完整回答' },
      { role: 'user', content: '新的追问' },
      { role: 'assistant', content: '新的截断回答', incomplete: true },
    ],
    '原始盘面提示词',
    'partial',
  );

  assert.equal(state.status, 'error');
  assert.match(state.error, /未完整生成/);
  assert.equal(state.canRetry, true);
});

test('无新增消息时显式未完成状态仍按保存状态恢复', () => {
  const turns = [{ role: 'assistant' as const, content: '旧完整回答' }];

  assert.equal(resolveRestoredAiChatState(turns, '原始盘面提示词', 'pending').status, 'error');
  assert.equal(
    resolveRestoredAiChatState(turns, '原始盘面提示词', 'cancelled').status,
    'cancelled',
  );
  assert.equal(resolveRestoredAiChatState(turns, '原始盘面提示词', 'error').status, 'error');
});

test('历史完整资料应等待异步种子且拒绝不同范围或主体的种子', () => {
  const requirement = { subjectId: 'subject-old', key: 'ziwei-full-range-a' };
  const delayedSeed: ReadingMemorySeed = {
    subjectId: 'subject-old',
    key: 'ziwei-full-range-a',
    resources: [
      {
        key: 'ziwei-full-range-a',
        title: '旧主体紫微完整运限资料',
        text: '完整盘面资料',
        usable: true,
      },
    ],
  };

  assert.equal(resolveReadingResourceSeed(requirement, undefined), null);
  assert.equal(
    isReadingResourceSeedCompatible(
      { ...delayedSeed, key: 'ziwei-full-range-b' },
      requirement.subjectId,
      requirement.key,
    ),
    false,
  );
  assert.equal(
    isReadingResourceSeedCompatible(
      { ...delayedSeed, subjectId: 'subject-current' },
      requirement.subjectId,
      requirement.key,
    ),
    false,
  );
  assert.deepEqual(
    resolveReadingResourceSeed(requirement, delayedSeed)?.resources,
    delayedSeed.resources,
  );
  assert.match(
    getReadingResourceRestoreError(undefined, { subjectId: '', key: requirement.key }),
    /缺少锁定主体资料/,
  );
});
