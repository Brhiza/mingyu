import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDivinationRange, partitionDivinationRange } from '../src/systems/divination-range';
import { divinationBoundaries } from '../src/systems/divination-boundaries';
import { createUtcTimestamp } from '../src/systems/huangji/civil-time';
import { SolarTerm } from 'tyme4ts';
import { generateLiurenRange } from '../src/systems/liuren';

test('分段同时保留首末代表值，相同盘面跨边界合并', async () => {
  const start = Date.parse('2024-02-19T02:59:59Z'), end = start + 2000;
  const segments = await partitionDivinationRange({ start, end }, {}, { label: '测试', calculate: (timestamp) => ({ timestamp, board: '相同' }), fingerprint: (item) => item.board });
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0], { startTimestamp: start, endTimestamp: end, endExclusive: true, first: { timestamp: start, board: '相同' }, last: { timestamp: end - 1000, board: '相同' } });
});

test('公元早期与历表末年的交节边界不被日期构造偏移', async () => {
  for (const [year, index] of [[1, 3], [50, 3], [99, 3], [9999, 23]] as const) {
    const term = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
    const instant = createUtcTimestamp(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
    assert.deepEqual(await divinationBoundaries(instant - 1000, instant + 1000, {}), [instant - 1000, instant, instant + 1000], `${year}/${index}`);
    const result = await generateLiurenRange({ start: new Date(instant - 1000).toISOString(), end: new Date(instant + 1000).toISOString() });
    assert.equal(result.branches.length, 2, `${year}/${index}`);
    assert.equal(result.branches[0].endTimestamp, instant, `${year}/${index}`);
  }
});

test('时辰边界分开不同盘面，未覆盖的盘面变化被拒绝', async () => {
  const start = Date.parse('2024-02-19T02:59:59Z'), end = start + 2000;
  const segments = await partitionDivinationRange({ start, end }, {}, { label: '测试', calculate: (timestamp) => timestamp, fingerprint: (timestamp) => timestamp < start + 1000 ? '前' : '后' });
  assert.deepEqual(segments.map((item) => [item.startTimestamp, item.endTimestamp]), [[start, start + 1000], [start + 1000, end]]);
  await assert.rejects(() => partitionDivinationRange({ start: start + 2000, end: start + 4000 }, {}, { label: '测试', calculate: (timestamp) => timestamp, fingerprint: String }), /未覆盖的盘面边界/);
  assert.throws(() => parseDivinationRange({ start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:01Z' }, '测试'), /不超过两小时/);
});
