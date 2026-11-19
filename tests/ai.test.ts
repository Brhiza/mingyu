import assert from 'node:assert/strict';
import test from 'node:test';
import { listModels, streamChat } from '../src/ai';

const config = { baseUrl: 'https://provider.example/v1/', apiKey: 'test-token', model: 'example' };
const messages = [{ role: 'user', content: '盘面和问题' }] as const;

function streamFrom(text: string, split = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let index = 0; index < bytes.length; index += split) controller.enqueue(bytes.slice(index, index + split));
    controller.close();
  } });
}
const mock = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) =>
  (async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {})) as typeof fetch;

test('自配模型列表使用指定地址和凭据，结果去重并允许手工输入', async () => {
  const fetcher = mock((url, init) => {
    assert.equal(url, 'https://provider.example/v1/models');
    assert.equal((init.headers as Record<string, string>).authorization, 'Bearer test-token');
    assert.equal((init.headers as Record<string, string>)['content-type'], undefined);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    return Response.json({ data: [{ id: 'z' }, { id: 'a' }, { id: 'a' }, { id: 4 }] });
  });
  assert.deepEqual(await listModels(config, fetcher), ['a', 'z']);
  await listModels({ ...config, apiKey: '' }, mock((_url, init) => {
    assert.deepEqual(init.headers, {});
    return Response.json({ data: [] });
  }));
  await assert.rejects(() => listModels({ ...config, baseUrl: 'https://user:secret@provider.example/v1' }, fetcher), /接口地址/);
  await assert.rejects(() => listModels({ ...config, baseUrl: 'https://provider.example/v1?token=secret' }, fetcher), /接口地址/);
  await assert.rejects(() => listModels(config, mock(() => Response.json({ error: { message: 'secret' } }, { status: 401 }))), /HTTP 401/);
  await assert.rejects(() => listModels(config, mock(() => Response.json({ unexpected: true }))), /手动填写/);
});

test('模型列表请求可取消并向底层 fetch 传递取消信号', async () => {
  const controller = new AbortController();
  const fetcher = mock((_url, init) => new Promise<Response>((_resolve, reject) => {
    assert.equal(init.signal, controller.signal);
    init.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  }));
  const pending = listModels(config, fetcher, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error: Error) => error.name === 'AbortError');
});

test('逐字节分块的 SSE 流保留多轮消息、中文字符和完成状态', async () => {
  const events = ': keepalive\r\ndata: {"choices":[{"delta":{"role":"assistant"}}]}\r\n\r\n' +
    'data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\n' +
    'data: {"choices":[{"delta":{"content":"，世界"},"finish_reason":"stop"}]}\r\n\r\n' +
    'data: [DONE]\r\n\r\n';
  const history = [...messages, { role: 'assistant' as const, content: '之前的回答' }, { role: 'user' as const, content: '继续问' }];
  const pieces: string[] = [];
  const fetcher = mock((url, init) => {
    assert.equal(url, 'https://provider.example/v1/chat/completions');
    assert.equal((init.headers as Record<string, string>)['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(String(init.body)), { model: 'example', messages: history, stream: true });
    return new Response(streamFrom(events), { headers: { 'content-type': 'text/event-stream' } });
  });
  const result = await streamChat(config, history, (piece) => pieces.push(piece), undefined, fetcher);
  assert.deepEqual(result, { content: '你好，世界', finishReason: 'stop' });
  assert.deepEqual(pieces, ['你好', '，世界']);
});

test('每条已记录的提问时间只附加在发给模型的对应用户消息，不改变对话文本', async () => {
  const history = [
    { role: 'user' as const, content: '原盘和问题', submittedAt: '2025-01-01T00:00:00.000Z' },
    { role: 'assistant' as const, content: '原回答' },
    { role: 'user' as const, content: '接下来呢？', submittedAt: '2026-11-17T00:00:00.000Z' },
  ];
  const original = structuredClone(history);
  const fetcher = mock((_url, init) => {
    const sent = JSON.parse(String(init.body)).messages;
    assert.deepEqual(sent, [
      { role: 'user', content: '原盘和问题\n\n【本次发送时间（UTC）】\n2025-01-01T00:00:00.000Z' },
      { role: 'assistant', content: '原回答' },
      { role: 'user', content: '接下来呢？\n\n【本次发送时间（UTC）】\n2026-11-17T00:00:00.000Z' },
    ]);
    return new Response(streamFrom('data: {"choices":[{"delta":{"content":"答复"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));
  });
  assert.equal((await streamChat(config, history, () => {}, undefined, fetcher)).content, '答复');
  assert.deepEqual(history, original);
});

test('流中断、错误及被截断回复不会伪装为完整答案', async () => {
  let partial = '';
  await assert.rejects(() => streamChat(config, messages, (piece) => { partial += piece; }, undefined,
    mock(() => new Response(streamFrom('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n', 3)))), /提前中断/);
  assert.equal(partial, '部分');
  await assert.rejects(() => streamChat(config, messages, () => {}, undefined, mock(() => new Response(streamFrom('data: {bad}\n\n')))), /无法解析/);
  await assert.rejects(() => streamChat(config, messages, () => {}, undefined, mock(() => new Response(streamFrom('data: [DONE]\n\n')))), /未返回文本/);
  await assert.rejects(() => streamChat(config, messages, () => {}, undefined, mock(() => new Response('secret', { status: 403 }))), /HTTP 403/);
  const incomplete = await streamChat(config, messages, () => {}, undefined, mock(() => new Response(streamFrom('data: {"choices":[{"delta":{"content":"部分"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'))));
  assert.equal(incomplete.finishReason, 'length');
  assert.equal(incomplete.content, '部分');
});

test('取消请求会终止模型流，且无需强制使用密钥', async () => {
  const controller = new AbortController();
  const fetcher = mock((_url, init) => {
    assert.equal((init.headers as Record<string, string>).authorization, undefined);
    return new Response(new ReadableStream<Uint8Array>({ start(stream) {
      init.signal?.addEventListener('abort', () => stream.error(new DOMException('Cancelled', 'AbortError')), { once: true });
    } }));
  });
  const pending = streamChat({ ...config, apiKey: '' }, messages, () => {}, controller.signal, fetcher);
  controller.abort();
  await assert.rejects(pending, (error: Error) => error.name === 'AbortError');
});
