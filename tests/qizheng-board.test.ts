import test from 'node:test';
import assert from 'node:assert/strict';

import { generateQizheng } from '@core/qi_zheng';

test('七政四余页面不得收到未经校勘的近似盘', () => {
  assert.throws(
    () =>
      generateQizheng({
        year: 1990,
        month: 6,
        day: 15,
        hour: 10,
        minute: 30,
        latitude: 39.9042,
        longitude: 116.4074,
        timezone: 8,
      }),
    /角宿起点.*366\.5.*距星边界.*停止输出近似盘/,
  );
});
