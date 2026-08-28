import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAndroidAiAppTargetKey,
  isAndroidApp,
  listAndroidAiApps,
  normalizeAndroidAiAppTarget,
} from '../src/lib/android-ai-app';
import { shareText } from '../src/utils/share-text';
import { getAiApiEndpoint } from '../src/lib/ai/stream-client';

test('网页环境不应误判为 Android App', async () => {
  assert.equal(isAndroidApp(), false);
  assert.deepEqual(await listAndroidAiApps(), []);
  assert.equal(getAiApiEndpoint('/api/v1/ai/analyze'), '/api/v1/ai/analyze');
});

test('Android AI App 设置只接受完整且有界的原生目标', () => {
  const target = normalizeAndroidAiAppTarget({
    packageName: 'com.example.ai',
    activityName: 'com.example.ai.ShareActivity',
    label: '示例 AI',
  });
  assert.deepEqual(target, {
    packageName: 'com.example.ai',
    activityName: 'com.example.ai.ShareActivity',
    label: '示例 AI',
  });
  assert.equal(getAndroidAiAppTargetKey(target!), 'com.example.ai\ncom.example.ai.ShareActivity');
  assert.equal(normalizeAndroidAiAppTarget({ packageName: 'com.example.ai' }), null);
  assert.equal(
    normalizeAndroidAiAppTarget({
      packageName: 'a'.repeat(241),
      activityName: 'ShareActivity',
      label: '示例 AI',
    }),
    null,
  );
});

test('网页分享仍使用系统分享能力', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let sharedText = '';
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      share: async ({ text }: { text: string }) => {
        sharedText = text;
      },
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  assert.deepEqual(await shareText('完整提示词'), { type: 'system' });
  assert.equal(sharedText, '完整提示词');
});
