import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WORKSPACE_NAVIGATION_ORDER,
  buildWorkspaceEntryPath,
  buildWorkspaceHomePath,
  normalizeWorkspaceNavigationOrder,
} from '../src/lib/workspace-navigation.ts';

test('排盘和占卜类目都能生成独立入口', () => {
  assert.equal(
    buildWorkspaceEntryPath('ziwei', 'new-case'),
    '/?mode=single&source=ziwei&draft=new-case',
  );
  assert.equal(buildWorkspaceEntryPath('liuyao'), '/divination?method=liuyao');
  assert.equal(buildWorkspaceEntryPath('almanac'), '/divination?method=almanac');
  assert.equal(
    buildWorkspaceHomePath('unspecified', 'blank'),
    '/?mode=single&source=bazi&draft=blank',
  );
});

test('侧栏顺序会去重、忽略无效项并自动补齐新增类目', () => {
  const order = normalizeWorkspaceNavigationOrder(['tarot', 'ziwei', 'tarot', 'unknown']);
  assert.deepEqual(order.slice(0, 2), ['tarot', 'ziwei']);
  assert.equal(order.length, DEFAULT_WORKSPACE_NAVIGATION_ORDER.length);
  assert.equal(new Set(order).size, order.length);
});
