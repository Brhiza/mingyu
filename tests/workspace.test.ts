import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_FEATURE_GROUPS,
  WORKSPACE_FEATURE_IDS,
  WORKSPACE_FEATURES,
  buildWorkspaceFeaturePath,
  normalizeNavigationOrder,
  resolvePersonalWorkspaceSource,
} from '../src/lib/workspace';

test('工作区应为每个排盘和占问工具提供独立入口', () => {
  assert.equal(buildWorkspaceFeaturePath('bazi'), '/chart/bazi');
  assert.equal(buildWorkspaceFeaturePath('compatibility'), '/chart/compatibility');
  assert.equal(buildWorkspaceFeaturePath('liuyao'), '/divination/liuyao');
  assert.equal(buildWorkspaceFeaturePath('almanac'), '/divination/almanac');
  assert.equal(new Set(WORKSPACE_FEATURE_IDS).size, WORKSPACE_FEATURE_IDS.length);
});

test('侧栏顺序应去重、忽略无效项并补齐新增工具', () => {
  const order = normalizeNavigationOrder(['tarot', 'bazi', 'tarot', 'invalid']);
  assert.deepEqual(order.slice(0, 2), ['tarot', 'bazi']);
  assert.equal(order.length, WORKSPACE_FEATURE_IDS.length);
  assert.equal(new Set(order).size, WORKSPACE_FEATURE_IDS.length);
});

test('侧栏分组应覆盖全部工具且不产生重复入口', () => {
  const groupIds = new Set(WORKSPACE_FEATURE_GROUPS.map((group) => group.id));
  assert.deepEqual([...groupIds], ['chart', 'divination', 'timing']);
  assert.equal(
    WORKSPACE_FEATURES.every((feature) => groupIds.has(feature.group)),
    true,
  );
});

test('旧案例的盘面来源应以真实录入类型为准', () => {
  assert.equal(resolvePersonalWorkspaceSource('astrolabe', 'bazi'), 'astrolabe');
  assert.equal(resolvePersonalWorkspaceSource('astrolabe', 'qizheng'), 'qizheng');
  assert.equal(resolvePersonalWorkspaceSource('ziwei', 'bazi'), 'ziwei');
  assert.equal(resolvePersonalWorkspaceSource('bazi', 'bazhai'), 'bazhai');
});
