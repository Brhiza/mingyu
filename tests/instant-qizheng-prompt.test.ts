import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQizheng } from '../packages/core/src/qi_zheng';
import { buildInstantQizhengPrompt } from '../src/lib/instant-prompt';

test('结果页七政即时提示词沿用起盘用语且不重复说明盘面范围', () => {
  const result = generateQizheng({
    year: 2026,
    month: 5,
    day: 19,
    hour: 10,
    minute: 30,
    latitude: 39.9,
    longitude: 116.4,
    timezone: 8,
  });
  const prompt = buildInstantQizhengPrompt(result, '此刻的问题如何判断？', '北京时间');
  assert.match(prompt, /起盘时间：2026年5月19日 10:30/);
  assert.match(prompt, /起盘地点：纬度39\.9°，经度116\.4°/);
  assert.match(prompt, /按起盘时刻与当地太阳高度阈值/);
  assert.doesNotMatch(prompt, /正常交点|全天高于阈值|全天低于阈值/);
  assert.match(prompt, /命宫主宰星：月（水）；恩星：太白\(金\)/u);
  assert.equal(prompt.match(/太阴与太白\(金\)：合相/gu)?.length, 1);
  assert.doesNotMatch(prompt, /出生|昼生|夜生|命主|命宫主星|本盘记录起盘时刻的星曜位置/);
});
