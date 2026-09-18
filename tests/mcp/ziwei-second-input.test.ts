import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMcpZiweiChartInput } from '../../mcp/src/tools/ziwei';

const birth = {
  gender: 'female' as const,
  dateType: 'solar' as const,
  year: '1992',
  month: '8',
  day: '21',
  birthHour: '8',
  birthMinute: '23',
  birthSecond: '47',
};

test('紫微 MCP 精准出生秒进入实际排盘输入且允许省略时辰索引', () => {
  const input = buildMcpZiweiChartInput(birth);
  assert.equal(input.birthTimeIndex, 4);
  assert.deepEqual(input.birthTime, { hour: 8, minute: 23, second: 47 });
});

test('紫微 MCP 不用无效秒数或不完整钟表时间代替实际出生输入', () => {
  assert.throws(() => buildMcpZiweiChartInput({ ...birth, birthSecond: '60' }));
  assert.throws(() => buildMcpZiweiChartInput({ ...birth, birthHour: undefined }));
  assert.throws(() => buildMcpZiweiChartInput({ ...birth, birthSecond: undefined }));
});
