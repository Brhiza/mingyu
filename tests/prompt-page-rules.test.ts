import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaziCustomPromptPatch,
  buildZiweiCustomPromptPatch,
  shouldShowPromptShareButton,
} from '../src/lib/prompt-page-rules';
import { shouldUsePhoneLayout } from '../src/lib/responsive-layout';

test('折叠屏展开时使用桌面布局，普通手机和矮横屏使用手机布局', () => {
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 390, viewportHeight: 844 }), true);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 673, viewportHeight: 841 }), false);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 720, viewportHeight: 900 }), false);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 844, viewportHeight: 390 }), true);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 1024, viewportHeight: 500 }), false);
});

test('桌面端和折叠屏展开不显示提示词分享按钮，手机且支持分享时显示', () => {
  assert.equal(
    shouldShowPromptShareButton({ viewportWidth: 1280, hasNavigatorShare: true }),
    false,
  );
  assert.equal(
    shouldShowPromptShareButton({
      viewportWidth: 673,
      viewportHeight: 841,
      hasNavigatorShare: true,
    }),
    false,
  );
  assert.equal(
    shouldShowPromptShareButton({
      viewportWidth: 390,
      viewportHeight: 844,
      hasNavigatorShare: true,
    }),
    true,
  );
  assert.equal(
    shouldShowPromptShareButton({
      viewportWidth: 390,
      viewportHeight: 844,
      hasNavigatorShare: false,
    }),
    false,
  );
});

test('八字切换到自定义时会清空已有快捷问题', () => {
  assert.deepEqual(buildBaziCustomPromptPatch(), {
    baziShortcutMode: '自定义',
    baziPresetId: 'ai-mingge-zonglun',
    baziQuickQuestion: '',
  });
});

test('紫微切换到自定义时会清空已有快捷问题', () => {
  assert.deepEqual(buildZiweiCustomPromptPatch(), {
    ziweiShortcutMode: '自定义',
    ziweiTopic: 'chat',
    ziweiQuickQuestion: '',
  });
});
