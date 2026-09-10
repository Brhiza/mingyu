import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiChatCompletionStatus } from '@/lib/ai/chat-history';
import {
  buildAiChatRequest,
  removeIncompleteChatTurns,
  resolveRestoredAiChatState,
} from '@/hooks/useAiChat';

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
