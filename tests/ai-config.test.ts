import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAiAnalyze, handleAiModels } from '../src/lib/ai/proxy';
import {
  getDefaultAiSettings,
  getServerBuiltinAiLabel,
  isServerBuiltinAiEnabled,
  isServerDefaultAiEnabled,
} from '../src/lib/ai/settings';
import { getAiRuntimeConfig, getAiRuntimeConfigScript } from '../src/lib/ai/runtime-config';
import { onRequest as handleRuntimeConfigRequest } from '../functions/_middleware';

type RuntimeConfigGlobal = typeof globalThis & {
  __MINGYU_RUNTIME_CONFIG__?: {
    aiBuiltinEnabled?: boolean;
    aiDefaultEnabled?: boolean;
    aiProviderName?: string;
  };
};

test('内置 AI 可显示但默认仍保持提示词模式', (t) => {
  const target = globalThis as RuntimeConfigGlobal;
  const originalConfig = target.__MINGYU_RUNTIME_CONFIG__;
  t.after(() => {
    target.__MINGYU_RUNTIME_CONFIG__ = originalConfig;
  });

  target.__MINGYU_RUNTIME_CONFIG__ = {
    aiBuiltinEnabled: true,
    aiDefaultEnabled: false,
    aiProviderName: '内置（不稳定）',
  };

  assert.equal(isServerBuiltinAiEnabled(), true);
  assert.equal(isServerDefaultAiEnabled(), false);
  assert.equal(getServerBuiltinAiLabel(), '内置（不稳定）');
  assert.deepEqual(
    {
      enabled: getDefaultAiSettings().enabled,
      mode: getDefaultAiSettings().mode,
    },
    {
      enabled: false,
      mode: 'builtin',
    },
  );
});

test('运行时 AI 配置需要同时配置密钥和开启开关', () => {
  assert.deepEqual(
    getAiRuntimeConfig({
      AI_API_KEY: 'test-key',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
      AI_PROVIDER_NAME: 'DeepSeek',
    }),
    {
      aiBuiltinEnabled: true,
      aiDefaultEnabled: false,
      aiProviderName: 'DeepSeek',
    },
  );

  assert.equal(
    getAiRuntimeConfig({
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'true',
      AI_PROVIDER_NAME: 'DeepSeek',
    }).aiBuiltinEnabled,
    false,
  );
});

test('运行时 AI 配置脚本可被页面直接加载', () => {
  assert.equal(
    getAiRuntimeConfigScript({
      AI_API_KEY: 'test-key',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
      AI_PROVIDER_NAME: 'DeepSeek',
    }),
    'window.__MINGYU_RUNTIME_CONFIG__ = {"aiBuiltinEnabled":true,"aiDefaultEnabled":false,"aiProviderName":"DeepSeek"};\n',
  );
});

test('Pages 运行时配置入口返回不缓存脚本', async () => {
  const response = await handleRuntimeConfigRequest({
    request: new Request('https://aov.cc/mingyu-runtime-config.js'),
    next: () => new Response('next'),
    env: {
      AI_API_KEY: 'test-key',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
      AI_PROVIDER_NAME: 'DeepSeek',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(
    await response.text(),
    'window.__MINGYU_RUNTIME_CONFIG__ = {"aiBuiltinEnabled":true,"aiDefaultEnabled":false,"aiProviderName":"DeepSeek"};\n',
  );
});

test('Pages middleware 不拦截其他路径', async () => {
  const response = await handleRuntimeConfigRequest({
    request: new Request('https://aov.cc/api/v1/manifest'),
    next: () => new Response('next'),
  });

  assert.equal(await response.text(), 'next');
});

test('主动选择内置 AI 时不受默认关闭影响', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.equal(String(url), 'https://example.com/v1/models');
    return new Response(JSON.stringify({ data: [{ id: 'free/cc' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }) as typeof fetch;

  const response = await handleAiModels(
    new Request('https://example.com/api/v1/ai/models', {
      method: 'POST',
      body: JSON.stringify({ aiConfig: { mode: 'builtin' } }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
    },
  );

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, models: ['free/cc'] });
});

test('未开启内置 AI 时拒绝服务端 AI 调用', async () => {
  const response = await handleAiModels(
    new Request('https://example.com/api/v1/ai/models', {
      method: 'POST',
      body: JSON.stringify({ aiConfig: { mode: 'builtin' } }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_DEFAULT_ENABLED: 'false',
    },
  );

  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'AI_SERVER_NOT_ENABLED');
});

test('AI 代理应拒绝过大的请求体', async () => {
  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        prompt: '测'.repeat(512 * 1024),
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
    },
  );

  const body = await response.json();
  assert.equal(response.status, 413);
  assert.equal(body.error.code, 'REQUEST_BODY_TOO_LARGE');
});

test('AI 代理应允许单条 prompt 超过 20000 字符并完整转发', async (t) => {
  const originalFetch = globalThis.fetch;
  const longPrompt = '测'.repeat(25000);
  let upstreamBody = '';
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async (_input, init) => {
    upstreamBody = typeof init?.body === 'string' ? init.body : '';
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  }) as typeof fetch;

  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        prompt: longPrompt,
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
    },
  );

  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /"content":"ok"/);

  const body = JSON.parse(upstreamBody) as { messages: Array<{ role: string; content: string }> };
  assert.equal(body.messages[1]?.role, 'user');
  assert.equal(body.messages[1]?.content.length, longPrompt.length);
  assert.equal(body.messages[1]?.content, longPrompt);
});

test('AI 代理应允许多轮消息中单条内容超过 20000 字符并完整转发', async (t) => {
  const originalFetch = globalThis.fetch;
  const longMessage = '测'.repeat(25000);
  let upstreamBody = '';
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async (_input, init) => {
    upstreamBody = typeof init?.body === 'string' ? init.body : '';
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  }) as typeof fetch;

  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: '正常问题' },
          { role: 'assistant', content: '正常回答' },
          { role: 'user', content: longMessage },
        ],
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
    },
  );

  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /"content":"ok"/);

  const body = JSON.parse(upstreamBody) as { messages: Array<{ role: string; content: string }> };
  assert.equal(body.messages[3]?.role, 'user');
  assert.equal(body.messages[3]?.content.length, longMessage.length);
  assert.equal(body.messages[3]?.content, longMessage);
});

test('AI 代理仍应拒绝总内容超过 50000 字符', async (t) => {
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async () => {
    upstreamCalled = true;
    throw new Error('总内容超限时不应调用上游');
  }) as typeof fetch;

  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'a'.repeat(50001),
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
    },
  );

  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'PROMPT_TOO_LONG');
  assert.equal(upstreamCalled, false);
});

test('AI 代理应拒绝过多消息，不应静默截断上下文', async () => {
  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        messages: Array.from({ length: 31 }, (_, index) => ({
          role: 'user',
          content: `第 ${index + 1} 条`,
        })),
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
    },
  );

  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'TOO_MANY_MESSAGES');
});

test('自定义 AI 应拒绝非 HTTPS、本机和内网接口地址', async () => {
  const unsafeBaseUrls = [
    'http://api.openai.com/v1',
    'https://localhost:11434/v1',
    'https://127.0.0.1:11434/v1',
    'https://10.0.0.2/v1',
    'https://172.16.0.2/v1',
    'https://192.168.1.2/v1',
    'https://169.254.169.254/latest',
    'https://[::1]/v1',
    'https://[::ffff:7f00:1]/v1',
    'https://[0:0:0:0:0:ffff:c0a8:0101]/v1',
    'https://[::ffff:a9fe:a9fe]/v1',
    'https://metadata.google.internal/v1',
    'https://ollama/v1',
  ];

  for (const baseUrl of unsafeBaseUrls) {
    const response = await handleAiModels(
      new Request('https://example.com/api/v1/ai/models', {
        method: 'POST',
        body: JSON.stringify({
          aiConfig: {
            mode: 'custom',
            apiKey: 'test-key',
            baseUrl,
          },
        }),
      }),
    );

    const body = await response.json();
    assert.equal(response.status, 400, baseUrl);
    assert.equal(body.error.code, 'AI_CUSTOM_BASE_URL_UNSAFE', baseUrl);
  }
});

test('自定义 AI 应允许 HTTPS 公网接口地址', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.equal(String(url), 'https://api.example.com/v1/models');
    return new Response(JSON.stringify({ data: [{ id: 'public-model' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }) as typeof fetch;

  const response = await handleAiModels(
    new Request('https://example.com/api/v1/ai/models', {
      method: 'POST',
      body: JSON.stringify({
        aiConfig: {
          mode: 'custom',
          apiKey: 'test-key',
          baseUrl: 'https://api.example.com/v1/',
        },
      }),
    }),
  );

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, models: ['public-model'] });
});

test('AI 解析遇到上游临时错误时会自动重试', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls < 3) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'server error',
            code: 'bad_response_status_code',
          },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '0',
          },
        },
      );
    }

    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  }) as typeof fetch;

  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: '测试' }],
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
    },
  );

  const text = await response.text();
  assert.equal(calls, 3);
  assert.equal(response.status, 200);
  assert.match(text, /"content":"ok"/);
});

test('AI 解析连续遇到上游错误时返回明确错误码', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        error: {
          message: 'server error',
          code: 'bad_response_status_code',
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': '0',
        },
      },
    );
  }) as typeof fetch;

  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: '测试' }],
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
    },
  );

  const body = await response.json();
  assert.equal(calls, 3);
  assert.equal(response.status, 500);
  assert.equal(body.error.code, 'AI_UPSTREAM_UNSTABLE');
  assert.equal(body.error.upstreamCode, 'bad_response_status_code');
  assert.equal(body.error.attempts, 3);
  assert.match(body.error.message, /已自动重试 2 次仍未成功/);
});

test('AI 解析连接上游超时时返回 504 而不是泛化为 502', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async () => {
    calls += 1;
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  }) as typeof fetch;

  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: '测试' }],
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
    },
  );

  const body = await response.json();
  assert.equal(calls, 1);
  assert.equal(response.status, 504);
  assert.equal(body.error.code, 'AI_UPSTREAM_TIMEOUT');
});

test('AI 流式响应中断时返回明确错误码', async (t) => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  let pulls = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          pulls += 1;
          if (pulls === 1) {
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"开头"}}]}\n\n'),
            );
            return;
          }
          throw new Error('upstream stream aborted');
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
      },
    )) as typeof fetch;

  const response = await handleAiAnalyze(
    new Request('https://example.com/api/v1/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: '测试' }],
        aiConfig: { mode: 'builtin' },
      }),
    }),
    {
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://example.com/v1',
      AI_MODEL: 'free/cc',
      AI_BUILTIN_ENABLED: 'true',
      AI_DEFAULT_ENABLED: 'false',
    },
  );

  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /"content":"开头"/);
  assert.match(text, /"code":"AI_UPSTREAM_STREAM_ERROR"/);
  assert.match(text, /"detail":"upstream stream aborted"/);
});
