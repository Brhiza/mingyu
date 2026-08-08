import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveInputEntryMode } from '../src/pages/input-entry-mode';

test('输入页应在首屏直接采用链接中的模式', () => {
  assert.equal(resolveInputEntryMode(new URLSearchParams('mode=divination')), 'divination');
  assert.equal(resolveInputEntryMode(new URLSearchParams('mode=almanac')), 'almanac');
  assert.equal(resolveInputEntryMode(new URLSearchParams('mode=compatibility')), 'compatibility');
});

test('输入页遇到缺失或未知模式时应安全回到单盘', () => {
  assert.equal(resolveInputEntryMode(new URLSearchParams()), 'single');
  assert.equal(resolveInputEntryMode(new URLSearchParams('mode=unknown')), 'single');
});
