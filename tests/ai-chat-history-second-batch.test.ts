import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAiChatCompletionStatus,
  loadAiChatHistory,
  normalizeAiChatHistory,
  saveAiChatHistory,
} from '../src/lib/ai/chat-history';

test('历史状态只依据最新回答，旧的截断回答不覆盖后续完整回答', () => {
  const turns = [
    { role: 'assistant' as const, content: '旧截断', incomplete: true },
    { role: 'user' as const, content: '新的问题' },
    { role: 'assistant' as const, content: '新的完整回答' },
  ];
  const state = normalizeAiChatHistory({
    sessions: [{ id: 'one', turns }],
  });

  assert.notEqual(state.sessions[0]?.completionStatus, 'partial');
  assert.equal(getAiChatCompletionStatus('error', turns), 'error');
});

test('历史尾部新问题恢复为待完成状态', () => {
  const state = normalizeAiChatHistory({
    sessions: [
      {
        id: 'pending',
        turns: [
          { role: 'assistant', content: '旧回答' },
          { role: 'user', content: '刷新前的新问题' },
        ],
      },
    ],
  });

  assert.equal(state.sessions[0]?.completionStatus, 'pending');
});

test('历史会话保留独立的占卜术式字段', () => {
  const state = normalizeAiChatHistory({
    sessions: [{ id: 'taiyi', readingMethod: ' taiyi ', turns: [] }],
  });

  assert.equal(state.sessions[0]?.readingMethod, 'taiyi');
});

test('历史写入失败时保留原始存储内容', () => {
  const oldValue = '{"version":2,"sessions":[{"id":"old"}],"activeSessionId":"old"}';
  const storage = {
    getItem: () => oldValue,
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => undefined,
  };
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  try {
    assert.equal(
      saveAiChatHistory('history-key', {
        sessions: [
          {
            id: 'new',
            title: '新对话',
            initialQuestion: '',
            promptMode: 'context',
            turns: [],
            createdAt: '',
            updatedAt: '',
          },
        ],
        activeSessionId: 'new',
      }),
      false,
    );
    assert.equal(storage.getItem(), oldValue);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
  }
});

test('最后一条历史删除失败时返回失败并保留刷新后记录', () => {
  const oldValue = JSON.stringify({
    version: 2,
    sessions: [
      {
        id: 'old',
        title: '旧对话',
        initialQuestion: '',
        promptMode: 'context',
        turns: [{ role: 'user', content: '旧问题' }],
        createdAt: '',
        updatedAt: '',
      },
    ],
    activeSessionId: 'old',
  });
  const storage = {
    getItem: () => oldValue,
    setItem: () => undefined,
    removeItem: () => {
      throw new Error('denied');
    },
  };
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  try {
    assert.equal(saveAiChatHistory('history-key', { sessions: [], activeSessionId: '' }), false);
    assert.equal(loadAiChatHistory('history-key').sessions[0]?.id, 'old');
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
  }
});
