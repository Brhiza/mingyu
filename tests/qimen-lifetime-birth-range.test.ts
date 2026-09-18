import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQimenLifetime,
  buildLifetimePrompt,
} from '../packages/core/src/divination/algorithms/qimen/lifetime';
import type { QimenLifetimeInput } from '../packages/core/src/types/divination';

const input: QimenLifetimeInput = {
  birthDateTime: '2024-02-19T11:00:00',
  timezone: 8,
  gender: 'male',
  birthTimeRange: {
    startTimestamp: Date.parse('2024-02-19T11:00:00+08:00'),
    endTimestamp: Date.parse('2024-02-19T13:00:00+08:00'),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  },
};

test('奇门终身局保留完整出生区间并按候选秒跨越雨水边界', () => {
  const first = calculateQimenLifetime(input);
  const transition = calculateQimenLifetime({ ...input, birthRangeIndex: 4392 });
  assert.equal(first.birthRange?.totalSamples, 7200);
  assert.equal(first.birthRange?.nextIndex, 1);
  assert.deepEqual(first.birthRange?.source, input.birthTimeRange);
  assert.equal(first.basis.solarTerm, '立春');
  assert.equal(transition.basis.solarTerm, '雨水');
  assert.notEqual(first.baseChart.zhiShi, transition.baseChart.zhiShi);
  const { birthTimeRange: _range, ...point } = input;
  const expected = calculateQimenLifetime({ ...point, birthDateTime: '2024-02-19T12:13:12' });
  assert.deepEqual(transition.baseChart, expected.baseChart);
  assert.deepEqual(transition.stages, expected.stages);
  assert.deepEqual(transition.personalMarkers, expected.personalMarkers);
  assert.equal(transition.input.birthDateTime, input.birthDateTime);
  const prompt = buildLifetimePrompt(transition, undefined, { includeCurrentTime: false });
  assert.match(prompt, /11:00:00.*13:00:00/);
  assert.match(prompt, /本册候选时刻：北京时间 2024-02-19 12:13:12/);
  assert.match(prompt, /第4393个整秒，共7200个整秒/);
});

test('奇门终身局末秒排除终点且非法范围参数显式拒绝', () => {
  const last = calculateQimenLifetime({ ...input, birthRangeIndex: 7199 });
  assert.equal(last.birthRange?.timestamp, input.birthTimeRange!.endTimestamp - 1000);
  assert.equal(last.birthRange?.nextIndex, null);
  for (const birthRangeIndex of [-1, 0.5, 7200, NaN]) {
    assert.throws(() => calculateQimenLifetime({ ...input, birthRangeIndex }), /索引/);
  }
  assert.throws(
    () => calculateQimenLifetime({ ...input, birthDateTime: '2024-02-19T11:00:01' }),
    /起点/,
  );
  assert.throws(
    () => calculateQimenLifetime({ ...input, birthTimeRange: undefined, birthRangeIndex: 0 }),
    /完整出生区间/,
  );
  assert.throws(() => calculateQimenLifetime({ ...input, applyChinaDst: true }), /夏令时/);
});
