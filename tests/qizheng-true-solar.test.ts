import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';

test('七政真太阳时不得绕过传统宿度坐标链失败关闭', () => {
  assert.throws(
    () =>
      generateQizheng({
        year: 1990,
        month: 5,
        day: 12,
        hour: 8,
        minute: 30,
        latitude: 31.2,
        longitude: 121.5,
        timezone: 8,
        useTrueSolarTime: true,
      }),
    /角宿起点.*366\.5.*距星边界.*停止输出近似盘/,
  );
});
