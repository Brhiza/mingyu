import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaziCustomPromptPatch,
  buildZiweiCustomPromptPatch,
} from '../src/lib/prompt-page-rules';
import { shouldUsePhoneLayout } from '../src/lib/responsive-layout';

test('折叠屏展开时使用桌面布局，普通手机和矮横屏使用手机布局', () => {
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 390, viewportHeight: 844 }), true);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 673, viewportHeight: 841 }), false);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 720, viewportHeight: 900 }), false);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 844, viewportHeight: 390 }), true);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 1024, viewportHeight: 500 }), false);
});

test('八字与紫微切换到自定义时都会清空旧快捷状态', () => {
  assert.deepEqual(
    {
      bazi: buildBaziCustomPromptPatch(),
      ziwei: buildZiweiCustomPromptPatch(),
    },
    {
      bazi: {
        baziShortcutMode: '自定义',
        baziPresetId: 'ai-mingge-zonglun',
        baziTopicId: '',
        baziSubtopicId: '',
        baziQuickQuestion: '',
      },
      ziwei: {
        ziweiShortcutMode: '自定义',
        ziweiTopic: 'chat',
        ziweiTopicId: '',
        ziweiSubtopicId: '',
        ziweiQuickQuestion: '',
      },
    },
  );
});
