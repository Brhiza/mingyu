import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiChatInitialPrompt,
  createAiChatSessionId,
  createAiChatTitle,
  extractPromptQuestion,
  normalizeAiChatHistory,
  upsertAiChatSession,
} from '@/lib/ai/chat-history';
import type { AiChatSession } from '@/lib/ai/chat-history';

function createSession(id: string, updatedAt: string): AiChatSession {
  return {
    id,
    title: `对话 ${id}`,
    initialQuestion: '我的事业走势如何？',
    promptMode: 'context-question',
    turns: [{ role: 'assistant', content: '这是回复' }],
    createdAt: updatedAt,
    updatedAt,
  };
}

test('AI 对话历史应自动迁移旧版单条记录', () => {
  const state = normalizeAiChatHistory({
    turns: [{ role: 'assistant', content: '旧版回复' }],
    updatedAt: '2026-07-13T08:00:00.000Z',
  });

  assert.equal(state.sessions.length, 1);
  assert.equal(state.activeSessionId, 'legacy');
  assert.equal(state.sessions[0]?.title, '最近一次解析');
  assert.deepEqual(state.sessions[0]?.turns, [{ role: 'assistant', content: '旧版回复' }]);
});

test('AI 对话历史应修正失效的当前会话标识', () => {
  const first = createSession('first', '2026-07-13T08:00:00.000Z');
  const state = normalizeAiChatHistory({
    version: 2,
    sessions: [first],
    activeSessionId: 'missing',
  });

  assert.equal(state.activeSessionId, 'first');
  assert.deepEqual(state.sessions, [first]);
});

test('AI 对话标题与自动解析问题应保持简洁', () => {
  const prompt = `【当前时间】\n2026-07-13\n\n【问题】\n我未来三年的事业发展如何？\n\n【任务】\n请给出分析。`;

  assert.equal(extractPromptQuestion(prompt), '我未来三年的事业发展如何？');
  assert.equal(createAiChatTitle('  事业   和   财运  '), '事业 和 财运');
});

test('AI 对话标识应使用系统级安全随机且不重复', () => {
  const first = createAiChatSessionId();
  const second = createAiChatSessionId();

  assert.ok(first.length >= 32);
  assert.notEqual(first, second);
});

test('AI 历史会话恢复时应重建首轮完整提示词', () => {
  const session = createSession('career', '2026-07-13T08:00:00.000Z');
  assert.equal(
    buildAiChatInitialPrompt('【排盘资料】\n内容', session),
    '【排盘资料】\n内容\n\n我的事业走势如何？',
  );
});

test('AI 历史会话更新后应移到列表首位', () => {
  const first = createSession('first', '2026-07-13T08:00:00.000Z');
  const second = createSession('second', '2026-07-13T09:00:00.000Z');
  const updatedFirst = { ...first, updatedAt: '2026-07-13T10:00:00.000Z' };

  assert.deepEqual(
    upsertAiChatSession([second, first], updatedFirst).map((session) => session.id),
    ['first', 'second'],
  );
});
