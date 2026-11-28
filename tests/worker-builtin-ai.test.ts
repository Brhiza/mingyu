import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker';

const baseEnv = {
  ASSETS: {
    async fetch() {
      return new Response('ok', { status: 200 });
    },
  },
};

test('内置 AI 默认关闭并返回 403 中文提示', async () => {
  const statusRes = await worker.fetch(new Request('https://sydf.cc/api/ai/status'), baseEnv);
  assert.equal(statusRes.status, 200);
  const statusJson = (await statusRes.json()) as { builtinEnabled: boolean };
  assert.equal(statusJson.builtinEnabled, false);

  const chatRes = await worker.fetch(
    new Request('https://sydf.cc/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }] }),
    }),
    baseEnv,
  );
  assert.equal(chatRes.status, 403);
  const chatJson = (await chatRes.json()) as { error: string };
  assert.ok(chatJson.error.includes('未开启'));
});

test('内置 AI 开启且携带来源校验时返回状态并在来源不符时拒绝', async () => {
  const enabledEnv = {
    ...baseEnv,
    AI_BUILTIN_ENABLED: 'true',
    AI_API_KEY: 'sk-test-token',
    AI_MODEL: 'deepseek-chat',
    AI_TRUSTED_ORIGINS: 'https://sydf.cc',
  };

  const statusRes = await worker.fetch(new Request('https://sydf.cc/api/ai/status'), enabledEnv);
  const statusJson = (await statusRes.json()) as { builtinEnabled: boolean; model?: string };
  assert.equal(statusJson.builtinEnabled, true);
  assert.equal(statusJson.model, 'deepseek-chat');

  const blockedRes = await worker.fetch(
    new Request('https://sydf.cc/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }] }),
    }),
    enabledEnv,
  );
  assert.equal(blockedRes.status, 403);
});
