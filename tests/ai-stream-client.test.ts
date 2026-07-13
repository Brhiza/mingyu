import test from 'node:test';
import assert from 'node:assert/strict';
import { streamAiChat } from '@/lib/ai/stream-client';

test('AI 流式请求正常结束但没有内容时应显示错误', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response('data: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

  let done = false;
  let error = '';
  await streamAiChat([{ role: 'user', content: '测试问题' }], {
    onChunk: () => {},
    onDone: () => {
      done = true;
    },
    onError: (message) => {
      error = message;
    },
  });

  assert.equal(done, false);
  assert.match(error, /未返回任何内容/);
});

test('AI 流式请求网络失败时应返回中文提示', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  let error = '';
  await streamAiChat([{ role: 'user', content: '测试问题' }], {
    onChunk: () => {},
    onDone: () => {},
    onError: (message) => {
      error = message;
    },
  });

  assert.equal(error, '网络连接失败，请检查网络后重试。');
});

test('AI 流式请求收到内容后应正常完成', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response('data: {"content":"回复内容"}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

  let content = '';
  let done = false;
  let error = '';
  await streamAiChat([{ role: 'user', content: '测试问题' }], {
    onChunk: (chunk) => {
      content += chunk;
    },
    onDone: () => {
      done = true;
    },
    onError: (message) => {
      error = message;
    },
  });

  assert.equal(content, '回复内容');
  assert.equal(done, true);
  assert.equal(error, '');
});
