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
    new Response('data: {"content":"回复内容"}\r\n\r\ndata: [DONE]\r\n\r\n', {
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

test('AI 流有正文但普通 EOF 未收到完成标记时不得当作成功', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response('data: {"content":"部分回答"}\n\n', {
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

  assert.equal(content, '部分回答');
  assert.equal(done, false);
  assert.match(error, /中断/);
});

test('AI 流收到损坏事件时不得忽略并继续完成', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response('data: {"content":"部分回答"}\n\ndata: {"content":\n\ndata: [DONE]\n\n', {
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
  assert.match(error, /无法解析/);
});

test('AI 流被 AbortSignal 取消时不得调用完成或错误回调', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) {
        reject(new DOMException('已取消', 'AbortError'));
        return;
      }
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('已取消', 'AbortError')),
        { once: true },
      );
    });

  const controller = new AbortController();
  let done = false;
  let error = '';
  const request = streamAiChat([{ role: 'user', content: '测试问题' }], {
    signal: controller.signal,
    onChunk: () => {},
    onDone: () => {
      done = true;
    },
    onError: (message) => {
      error = message;
    },
  });
  controller.abort();
  await request;

  assert.equal(done, false);
  assert.equal(error, '');
});
