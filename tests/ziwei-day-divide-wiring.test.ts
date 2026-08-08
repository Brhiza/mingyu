/**
 * §16 收敛：draft 路径 dayDivide 透传（Commit B 三层联证）。
 *
 * 此前只测了 BirthProfile 路径（birthProfileToZiweiChartInput），draft 路径
 * （buildZiweiChartInput 经 handler / MCP 紫微独立入口）是流量最大的主路，
 * 必须同时打三层，否则等于没测，会被打回：
 *
 *   1) 单元级   —— @core/ziwei/runtime 的 buildZiweiChartInput 直接透传 dayDivide。
 *   2) MCP 级    —— mcp/src/tools/ziwei.ts 的 buildMcpZiweiChartInput 透传 dayDivide。
 *   3) 端到端级 —— handler.ts:2641 的 calculateZiweiRuntime 从请求读 dayDivide，
 *                 命例：2024-03-15 23:30 晚子时 current→命宫主星[太阴]，默认→空宫[]。
 *
 * 金标准命宫主星基准来自 team-lead 实测（与 tests/day-divide.test.ts profile 路径一致）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildZiweiChartInput } from '@core/ziwei/runtime';
import { buildSerializableZiweiResult } from '@core/prompt/ziwei';
import { buildMcpZiweiChartInput } from '../mcp/src/tools/ziwei';
import { calculateZiweiRuntime } from '../src/lib/public-api/handler';

// 晚子时样例：2024-03-15 23:30，男。dateType=solar、timeIndex=12（晚子时）。
const LATE_ZI = {
  name: '',
  gender: 'male' as const,
  dateType: 'solar' as const,
  year: '2024',
  month: '3',
  day: '15',
  timeIndex: 12,
  isLeapMonth: false,
  useTrueSolarTime: false,
  birthHour: '',
  birthMinute: '',
  birthLongitude: '',
};

test('B-单元级 runtime.buildZiweiChartInput 透传 dayDivide（ziwei/runtime.ts:281 核心修复）', () => {
  const def = buildZiweiChartInput({ ...LATE_ZI });
  assert.equal(def.dayDivide, 'forward'); // 缺省放行
  const cur = buildZiweiChartInput({ ...LATE_ZI, dayDivide: 'current' });
  assert.equal(cur.dayDivide, 'current');
  const fwd = buildZiweiChartInput({ ...LATE_ZI, dayDivide: 'forward' });
  assert.equal(fwd.dayDivide, 'forward');
});

test('B-MCP 级 buildMcpZiweiChartInput 透传 dayDivide（mcp/src/tools/ziwei.ts:124）', () => {
  const args = {
    year: '2024',
    month: '3',
    day: '15',
    gender: 'male' as const,
    dateType: 'solar' as const,
    timeIndex: 12,
  };
  const def = buildMcpZiweiChartInput(args);
  assert.equal(def.dayDivide, 'forward');
  const cur = buildMcpZiweiChartInput({ ...args, dayDivide: 'current' });
  assert.equal(cur.dayDivide, 'current');
});

test('B-端到端级 calculateZiweiRuntime 命例：current→[太阴] 默认→[]（handler.ts:2641）', async () => {
  const current = await calculateZiweiRuntime({ ...LATE_ZI, dayDivide: 'current' }, ['origin']);
  const defaulted = await calculateZiweiRuntime({ ...LATE_ZI }, ['origin']);

  const soulMajorStars = (runtime: any) => {
    const serial = buildSerializableZiweiResult(runtime);
    const soul = serial.gongList.find((g: any) => g.name === '命宫');
    return soul ? soul.majorStars : null;
  };

  // 默认（未传 dayDivide）与显式 forward 都走 next-day，命宫空宫。
  assert.deepEqual(soulMajorStars(defaulted), []);
  // current 让紫微农历日归当日，命宫主星随 dayDivide 切换为[太阴]。
  assert.deepEqual(soulMajorStars(current), ['太阴']);
});
