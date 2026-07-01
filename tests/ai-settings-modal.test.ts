import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiSettingsModal } from '../src/components/AiSettingsModal';
import type { AiSettings } from '../src/lib/ai/settings';

type RuntimeConfigGlobal = typeof globalThis & {
  __MINGYU_RUNTIME_CONFIG__?: {
    aiBuiltinEnabled?: boolean;
    aiDefaultEnabled?: boolean;
    aiProviderName?: string;
  };
};

const baseSettings: AiSettings = {
  enabled: true,
  mode: 'builtin',
  providerId: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
};

function withBuiltinAiConfig(t: TestContext) {
  const target = globalThis as RuntimeConfigGlobal;
  const originalConfig = target.__MINGYU_RUNTIME_CONFIG__;
  t.after(() => {
    target.__MINGYU_RUNTIME_CONFIG__ = originalConfig;
  });

  target.__MINGYU_RUNTIME_CONFIG__ = {
    aiBuiltinEnabled: true,
    aiDefaultEnabled: false,
    aiProviderName: '内置 AI',
  };
}

test('AI 设置选择内置时不渲染自定义 API 配置内容', (t) => {
  withBuiltinAiConfig(t);

  const html = renderToStaticMarkup(
    createElement(AiSettingsModal, {
      settings: baseSettings,
      onApply: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /内置 AI/);
  assert.match(html, /自行配置/);
  assert.doesNotMatch(html, /服务商/);
  assert.doesNotMatch(html, /接口地址/);
  assert.doesNotMatch(html, /API Key/);
  assert.doesNotMatch(html, /获取模型/);
});

test('AI 设置选择自行配置时仍渲染自定义 API 配置内容', (t) => {
  withBuiltinAiConfig(t);

  const html = renderToStaticMarkup(
    createElement(AiSettingsModal, {
      settings: { ...baseSettings, mode: 'custom' },
      onApply: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /服务商/);
  assert.match(html, /接口地址/);
  assert.match(html, /API Key/);
  assert.match(html, /获取模型/);
});
