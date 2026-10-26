import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAiAnalyze } from '@/lib/ai/proxy';
import { streamAiChat } from '@/lib/ai/stream-client';

const aiConfig = {
  mode: 'custom' as const,
  apiKey: 'test-key',
  baseUrl: 'https://provider.example/v1',
  model: 'test-model',
};

async function readProxiedStream(upstream: string | ReadableStream<Uint8Array>) {
  const originalFetch = globalThis.fetch;
  const observed = { content: '', done: 0, errors: [] as string[], upstreamCalls: 0 };
  try {
    globalThis.fetch = async (_input, init) =>
      handleAiAnalyze(
        new Request('https://app.example/api/v1/ai/analyze', {
          method: 'POST',
          headers: init?.headers,
          body: init?.body,
          signal: init?.signal,
        }),
        {},
        {
          fetch: async () => {
            observed.upstreamCalls += 1;
            return new Response(upstream);
          },
        },
      );
    await streamAiChat([{ role: 'user', content: '测试流式回答' }], {
      aiConfig,
      onChunk: (chunk) => {
        observed.content += chunk;
      },
      onDone: () => {
        observed.done += 1;
      },
      onError: (message) => {
        observed.errors.push(message);
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(observed.upstreamCalls, 1);
  return observed;
}

const opening = 'data: {"choices":[{"delta":{"content":"半段正文"}}]}\n\n';

test('代理后的损坏上游事件只报告一次失败，不能由后续 DONE 改判成功', async (t) => {
  for (const malformed of ['{"choices":', 'null', '[]']) {
    await t.test(malformed, async () => {
      const observed = await readProxiedStream(`${opening}data: ${malformed}\n\ndata: [DONE]\n\n`);
      assert.equal(observed.content, '半段正文');
      assert.equal(observed.done, 0);
      assert.equal(observed.errors.length, 1);
      assert.match(observed.errors[0], /无法解析/);
      assert.match(observed.errors[0], /AI_UPSTREAM_MALFORMED/);
    });
  }
});

test('代理 flush 的残缺 JSON 与事件循环使用相同失败契约', async () => {
  const observed = await readProxiedStream(`${opening}data: {"choices":`);
  assert.equal(observed.content, '半段正文');
  assert.equal(observed.done, 0);
  assert.equal(observed.errors.length, 1);
  assert.match(observed.errors[0], /AI_UPSTREAM_MALFORMED/);
});

test('代理按完整 SSE 事件拼接多行 data，并跨字节分片解码和处理末尾 DONE', async () => {
  const bytes = new TextEncoder().encode(
    ': heartbeat\r\n\r\nevent: message\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"完整回答"}}]}\r\n\r\ndata: [DONE]',
  );
  let offset = 0;
  const upstream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, ++offset));
    },
  });
  const observed = await readProxiedStream(upstream);
  assert.equal(observed.content, '完整回答');
  assert.equal(observed.done, 1);
  assert.deepEqual(observed.errors, []);
});

test('代理后 EOF 和上游显式错误都保留部分正文，且没有成功终态', async (t) => {
  for (const [tail, code] of [
    ['', 'AI_UPSTREAM_INCOMPLETE'],
    [
      'data: {"error":{"code":"provider_error","message":"上游停止"}}\n\ndata: [DONE]\n\n',
      'provider_error',
    ],
  ]) {
    await t.test(code, async () => {
      const observed = await readProxiedStream(opening + tail);
      assert.equal(observed.content, '半段正文');
      assert.equal(observed.done, 0);
      assert.equal(observed.errors.length, 1);
      assert.ok(observed.errors[0].includes(code));
    });
  }
});
