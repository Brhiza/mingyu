import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkspaceLaunchQuestion,
  buildWorkspaceLaunchState,
  readWorkspaceLaunchState,
} from '../src/lib/workspace-launch';

test('首页启动状态会整理问题、补充信息并保留自动开始标记', () => {
  assert.deepEqual(
    buildWorkspaceLaunchState('  想了解今年事业  ', {
      autoSubmit: true,
      supplementaryInfo: '  已经拿到一个新机会  ',
    }),
    {
      workspaceNew: true,
      initialQuestion: '想了解今年事业',
      initialSupplementaryInfo: '已经拿到一个新机会',
      autoSubmit: true,
    },
  );
});

test('页面只读取有效的首页启动字段', () => {
  assert.deepEqual(
    readWorkspaceLaunchState({
      workspaceNew: 'true',
      initialQuestion: 123,
      initialSupplementaryInfo: 123,
      autoSubmit: 1,
    }),
    {
      workspaceNew: false,
      initialQuestion: '',
      initialSupplementaryInfo: '',
      autoSubmit: false,
    },
  );
  assert.deepEqual(readWorkspaceLaunchState(null), {
    workspaceNew: false,
    initialQuestion: '',
    initialSupplementaryInfo: '',
    autoSubmit: false,
  });
});

test('排盘与即时盘会把问题和补充信息合并成可直接解读的输入', () => {
  assert.equal(
    buildWorkspaceLaunchQuestion('我该不该换工作？', '已经拿到新工作的书面邀约。'),
    '我该不该换工作？\n\n补充信息：已经拿到新工作的书面邀约。',
  );
  assert.equal(buildWorkspaceLaunchQuestion('我该不该换工作？', '  '), '我该不该换工作？');
});
