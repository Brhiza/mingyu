import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAndroidDirectCustomAi,
  normalizeAndroidDirectAiConfig,
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
