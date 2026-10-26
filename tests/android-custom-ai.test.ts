import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { handleAiAnalyze } from '../src/lib/ai/proxy';
import {
  isAndroidDirectCustomAi,
  normalizeAndroidDirectAiConfig,
  streamAndroidDirectAi,
} from '../src/lib/ai/android-custom-ai';

test('Android 自定义 AI 应选择设备直连，内置 AI 仍走服务端', () => {
  assert.equal(isAndroidDirectCustomAi({ mode: 'custom' }, true), true);
  assert.equal(isAndroidDirectCustomAi({ mode: 'builtin' }, true), false);
  assert.equal(isAndroidDirectCustomAi({ mode: 'custom' }, false), false);
});

test('Android 自定义 AI 直连配置应规范化 HTTPS 公网地址', () => {
  assert.deepEqual(
    normalizeAndroidDirectAiConfig({
      mode: 'custom',
      apiKey: ' test-key ',
      baseUrl: 'https://api.example.com/v1/',
      model: ' example-model ',
    }),
    {
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com/v1',
      model: 'example-model',
    },
  );
});

test('Android 自定义 AI 直连应拒绝不安全地址和缺失配置', () => {
  const unsafeBaseUrls = [
    'http://api.example.com/v1',
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://10.0.0.2/v1',
    'https://172.16.0.2/v1',
    'https://192.168.1.2/v1',
    'https://metadata.google.internal/v1',
    'https://ollama/v1',
  ];

  for (const baseUrl of unsafeBaseUrls) {
    assert.throws(
      () =>
        normalizeAndroidDirectAiConfig({
          mode: 'custom',
          apiKey: 'test-key',
          baseUrl,
          model: 'test-model',
        }),
      /HTTPS 公网地址/,
      baseUrl,
    );
  }

  assert.throws(
    () =>
      normalizeAndroidDirectAiConfig({
        mode: 'custom',
        apiKey: '',
        baseUrl: 'https://api.example.com/v1',
        model: '',
      }),
    /接口、密钥和模型/,
  );
});

test('Android 直连取消后底层普通拒绝不触发失败回调', async () => {
  let started!: () => void;
  const streamStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let rejectStream!: (error: unknown) => void;
  let cancelCalls = 0;
  const plugin = {
    addListener: async (
      _eventName: 'streamEvent',
      _listener: (event: {
        requestId: string;
        type: 'chunk' | 'done' | 'error';
        content?: string;
        message?: string;
      }) => void,
    ) => ({ remove: async () => {} }),
    cancelStream: async (_options: { requestId: string }) => {
      cancelCalls += 1;
    },
    streamChat: async (_options: {
      requestId: string;
      apiKey: string;
      baseUrl: string;
      model: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => {
      started();
      await new Promise<void>((_resolve, reject) => {
        rejectStream = reject;
      });
    },
    fetchModels: async (_options: { apiKey: string; baseUrl: string }) => ({ models: [] }),
  };
  const controller = new AbortController();
  const errors: string[] = [];
  const request = streamAndroidDirectAi(
    [{ role: 'user', content: '测试问题' }],
    {
      mode: 'custom',
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com/v1',
      model: 'test-model',
    },
    {
      onChunk: () => {},
      onDone: () => {},
      onError: (message) => errors.push(message),
    },
    controller.signal,
    plugin,
  );
  await streamStarted;
  controller.abort();
  rejectStream(new Error('请求已取消'));
  await request;

  assert.equal(cancelCalls, 1);
  assert.deepEqual(errors, []);
});

test('Web 代理与真实 Android JVM 解析器共用五个审计流 fixture', async (t) => {
  const fixtures = JSON.parse(
    await readFile(
      new URL('../android/app/src/test/resources/ai-stream-fixtures.json', import.meta.url),
      'utf8',
    ),
  ) as Array<{
    name: string;
    body: string;
    content: string;
    done: number;
    errorCode: string;
    errorMessage: string;
  }>;
  assert.equal(fixtures.length, 5);
  for (const fixture of fixtures) {
    await t.test(fixture.name, async () => {
      const response = await handleAiAnalyze(
        new Request('https://app.example/api/v1/ai/analyze', {
          method: 'POST',
          body: JSON.stringify({
            prompt: '合成协议检查',
            aiConfig: {
              mode: 'custom',
              apiKey: 'test-key',
              baseUrl: 'https://provider.example/v1',
              model: 'test-model',
            },
          }),
        }),
        {},
        {
          fetch: async () =>
            new Response(fixture.body, { headers: { 'Content-Type': 'text/event-stream' } }),
        },
      );
      assert.equal(response.status, 200);
      const data = (await response.text())
        .split('\n\n')
        .filter((event) => event.startsWith('data:'))
        .map((event) => event.slice(5).trim());
      const payloads = data.filter((event) => event !== '[DONE]').map((event) => JSON.parse(event));
      assert.equal(payloads.map((event) => event.content ?? '').join(''), fixture.content);
      assert.equal(data.filter((event) => event === '[DONE]').length, fixture.done);
      assert.deepEqual(
        payloads.filter((event) => event.error).map((event) => event.error.message),
        fixture.errorMessage ? [fixture.errorMessage] : [],
      );
      assert.deepEqual(
        payloads.filter((event) => event.error).map((event) => event.error.code),
        fixture.errorCode ? [fixture.errorCode] : [],
      );
    });
  }
});

test('Web 与 Android JVM 共用严格 JSON token 样例', async (t) => {
  const fixtures = JSON.parse(
    await readFile(
      new URL('../android/app/src/test/resources/ai-json-token-fixtures.json', import.meta.url),
      'utf8',
    ),
  ) as { invalid: string[]; valid: string[] };
  for (const [group, tokens] of Object.entries(fixtures)) {
    for (const token of tokens) {
      await t.test(`${group}: ${token}`, async () => {
        const payload = `{"choices":[{"delta":{"content":"ok"}}],"unused":{"nested":[${token}]}}`;
        const response = await handleAiAnalyze(
          new Request('https://app.example/api/v1/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({
              prompt: '合成 token 检查',
              aiConfig: {
                mode: 'custom',
                apiKey: 'test-key',
                baseUrl: 'https://provider.example/v1',
                model: 'test-model',
              },
            }),
          }),
          {},
          {
            fetch: async () =>
              new Response(`data: ${payload}\n\ndata: [DONE]\n\n`, {
                headers: { 'Content-Type': 'text/event-stream' },
              }),
          },
        );
        assert.equal(response.status, 200);
        const data = (await response.text())
          .split('\n\n')
          .filter((event) => event.startsWith('data:'))
          .map((event) => event.slice(5).trim());
        if (group === 'invalid') {
          assert.throws(() => JSON.parse(payload), SyntaxError);
          assert.equal(data.length, 1);
          const event = JSON.parse(data[0]);
          assert.equal(event.error.code, 'AI_UPSTREAM_MALFORMED');
          assert.equal(event.content, undefined);
        } else {
          assert.doesNotThrow(() => JSON.parse(payload));
          assert.deepEqual(data, [JSON.stringify({ content: 'ok' }), '[DONE]']);
        }
      });
    }
  }
});
