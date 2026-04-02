import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResultPage.tsx', import.meta.url), 'utf8');

test('结果页不应渲染开发参考说明文案', () => {
  assert.doesNotMatch(source, /参考 `bz` 项目的专业盘表结构，按年、月、日、时展开。/);
  assert.doesNotMatch(source, /参考 `zw` 项目的传统盘布局，按 4x4 盘面集中展示十二宫。/);
  assert.doesNotMatch(source, /参考 `zw` 项目的结果页，先看时限与四化，再看宫位。/);
});
