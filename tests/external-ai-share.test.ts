import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXTERNAL_AI_CLIENTS,
  EXTERNAL_AI_JUMP_STORAGE_KEY,
  createDefaultExternalAiQuickJumpSettings,
  getVisibleExternalAiClients,
  isSafeExternalAppUrl,
  isSafeExternalClientUrl,
  isSafeExternalWebUrl,
  loadExternalAiQuickJumpSettings,
  resolveExternalAiLaunchPlan,
  saveExternalAiQuickJumpSettings,
} from '../src/external-ai-share';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

test('内置外部 AI 跳转以国内客户端优先且全部具备 APP 原生链接与网页链接', () => {
  assert.deepEqual(
    DEFAULT_EXTERNAL_AI_CLIENTS.map((c) => c.id),
    ['doubao', 'deepseek', 'yuanbao', 'kimi', 'qwen', 'chatgpt', 'claude', 'gemini'],
  );
  for (const client of DEFAULT_EXTERNAL_AI_CLIENTS) {
    assert.ok(client.appUrl && isSafeExternalAppUrl(client.appUrl), `${client.id} missing appUrl`);
    assert.ok(client.webUrl && isSafeExternalWebUrl(client.webUrl), `${client.id} missing webUrl`);
    const plan = resolveExternalAiLaunchPlan(client);
    assert.equal(plan?.primaryKind, 'app');
    assert.equal(plan?.primaryUrl, client.appUrl);
    assert.equal(plan?.fallbackWebUrl, client.webUrl);
  }
});

test('resolveExternalAiLaunchPlan 优先 APP 原生链接并支持纯网页或纯 APP 配置', () => {
  assert.deepEqual(
    resolveExternalAiLaunchPlan({
      appUrl: 'kimi://',
      webUrl: 'https://kimi.moonshot.cn/',
      url: 'kimi://',
    }),
    {
      primaryKind: 'app',
      primaryUrl: 'kimi://',
      fallbackWebUrl: 'https://kimi.moonshot.cn/',
    },
  );
  assert.deepEqual(
    resolveExternalAiLaunchPlan({
      webUrl: 'https://chatglm.cn/',
      url: 'https://chatglm.cn/',
    }),
    {
      primaryKind: 'web',
      primaryUrl: 'https://chatglm.cn/',
    },
  );
  assert.deepEqual(
    resolveExternalAiLaunchPlan({
      appUrl: 'chatglm://',
      url: 'chatglm://',
    }),
    {
      primaryKind: 'app',
      primaryUrl: 'chatglm://',
    },
  );
});

test('外部 AI 快速跳转默认预设、全局开关、旧缓存双链接迁移与自定义持久化可用', () => {
  const storage = createMemoryStorage();
  const initial = loadExternalAiQuickJumpSettings(storage);
  assert.equal(initial.enabled, true);
  assert.deepEqual(
    getVisibleExternalAiClients(initial).map((c) => c.id),
    ['doubao', 'deepseek'],
  );

  // 模拟旧版仅保存单 url 的记录：内置客户端应自动补全原生 appUrl
  storage.setItem(
    EXTERNAL_AI_JUMP_STORAGE_KEY,
    JSON.stringify({
      enabled: true,
      clients: [{ id: 'kimi', label: 'Kimi', url: 'https://kimi.moonshot.cn/', enabled: true }],
    }),
  );
  const migrated = loadExternalAiQuickJumpSettings(storage);
  const migratedKimi = migrated.clients.find((c) => c.id === 'kimi');
  assert.equal(migratedKimi?.appUrl, 'kimi://');
  assert.equal(migratedKimi?.webUrl, 'https://kimi.moonshot.cn/');

  const next = {
    enabled: true,
    clients: [
      ...initial.clients.map((c) =>
        c.id === 'doubao'
          ? { ...c, enabled: false }
          : c.id === 'chatgpt'
            ? { ...c, enabled: true, appUrl: '', webUrl: 'https://chatgpt.com/' }
            : c,
      ),
      {
        id: 'custom-zhipu',
        label: '智谱清言',
        appUrl: 'chatglm://',
        webUrl: 'https://chatglm.cn/',
        url: 'chatglm://',
        enabled: true,
      },
      {
        id: 'unsafe-entry',
        label: 'Bad',
        url: 'javascript:alert(1)',
        enabled: true,
      },
    ],
  };

  saveExternalAiQuickJumpSettings(next, storage);
  assert.ok(storage.getItem(EXTERNAL_AI_JUMP_STORAGE_KEY));

  const reloaded = loadExternalAiQuickJumpSettings(storage);
  assert.deepEqual(
    getVisibleExternalAiClients(reloaded).map((c) => c.id),
    ['deepseek', 'chatgpt', 'custom-zhipu'],
  );
  // 显式清空 appUrl 后仅走网页链接
  const chatgpt = reloaded.clients.find((c) => c.id === 'chatgpt');
  assert.equal(chatgpt?.appUrl, undefined);
  assert.equal(chatgpt?.webUrl, 'https://chatgpt.com/');
  assert.equal(resolveExternalAiLaunchPlan(chatgpt!)?.primaryKind, 'web');

  saveExternalAiQuickJumpSettings({ ...reloaded, enabled: false }, storage);
  const disabledState = loadExternalAiQuickJumpSettings(storage);
  assert.equal(disabledState.enabled, false);
  assert.deepEqual(getVisibleExternalAiClients(disabledState), []);

  const reset = createDefaultExternalAiQuickJumpSettings();
  assert.equal(reset.enabled, true);
  assert.equal(getVisibleExternalAiClients(reset).length, 2);
});

test('URL 安全校验准确区分 APP 协议、网页链接与危险协议', () => {
  assert.equal(isSafeExternalClientUrl('https://chatgpt.com/'), true);
  assert.equal(isSafeExternalWebUrl('https://chatgpt.com/'), true);
  assert.equal(isSafeExternalAppUrl('https://chatgpt.com/'), false);

  assert.equal(isSafeExternalClientUrl('doubao://'), true);
  assert.equal(isSafeExternalAppUrl('doubao://'), true);
  assert.equal(isSafeExternalWebUrl('doubao://'), false);

  assert.equal(isSafeExternalClientUrl('dpsk://chat/new'), true);
  assert.equal(isSafeExternalClientUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalClientUrl('data:text/html,<script>'), false);
  assert.equal(isSafeExternalClientUrl('not a url'), false);
});
