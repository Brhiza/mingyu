import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspaceLaunchState, readWorkspaceLaunchState } from '../src/lib/workspace-launch';

test('首页启动状态会整理问题并保留自动开始标记', () => {
  assert.deepEqual(buildWorkspaceLaunchState('  想了解今年事业  ', { autoSubmit: true }), {
    workspaceNew: true,
    initialQuestion: '想了解今年事业',
    autoSubmit: true,
  });
});

test('页面只读取有效的首页启动字段', () => {
  assert.deepEqual(
    readWorkspaceLaunchState({
      workspaceNew: 'true',
      initialQuestion: 123,
      autoSubmit: 1,
    }),
    {
      workspaceNew: false,
      initialQuestion: '',
      autoSubmit: false,
    },
  );
  assert.deepEqual(readWorkspaceLaunchState(null), {
    workspaceNew: false,
    initialQuestion: '',
    autoSubmit: false,
  });
});
