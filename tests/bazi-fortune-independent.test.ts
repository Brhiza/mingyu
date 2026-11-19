import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';
import { calculateBaziFortune, locateBaziFortune } from '../src/systems/bazi/fortune';
import { calculateDecadalTimeline } from '../src/systems/luck';

const inputs = [
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' as const },
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'female' as const },
  { year: 2000, month: 2, day: 29, hour: 23, minute: 59, second: 59, gender: 'male' as const },
  { year: 2024, month: 2, day: 4, hour: 16, minute: 27, second: 7, gender: 'female' as const },
];

test('不同出生资料的大运连续，交运前一秒与交运时落在相邻运程', async () => {
  for (const { year, month, day, hour, minute, second, gender } of inputs) {
    const chart = await calculateBaziPillars({ year, month, day, clock: { kind: 'exact', hour, minute, second }, timezone: 8 });
    const fortune = calculateBaziFortune(chart, gender);
    assert.equal(fortune.cycles.length, 12); assert.equal(fortune.firstTimestamp, fortune.cycles[0].startTimestamp);
    for (let index = 1; index < fortune.cycles.length; index++) {
      const boundary = fortune.cycles[index].startTimestamp;
      assert.equal(fortune.cycles[index - 1].endTimestamp, boundary);
      assert.equal(locateBaziFortune(chart, fortune, boundary - 1000).cycle?.index, index - 1);
      assert.equal(locateBaziFortune(chart, fortune, boundary).cycle?.index, index);
    }
    assert.throws(() => locateBaziFortune(chart, fortune, fortune.birthTimestamp - 1000));
    assert.throws(() => locateBaziFortune(chart, fortune, fortune.cycles.at(-1)!.endTimestamp));
  }
});

test('时辰中点不能伪装精确起运；同一瞬时在不同时区有相同起运轴', async () => {
  const partial = await calculateBaziPillars({ year: 1990, month: 5, day: 15, clock: { kind: 'shichen', index: 7 } });
  assert.throws(() => calculateBaziFortune(partial, 'male'), /明确出生时分秒/);
  const china = await calculateBaziPillars({ year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 });
  const london = await calculateBaziPillars({ year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 7, minute: 30, second: 0 }, timeZoneId: 'Europe/London' });
  assert.equal(china.basis.utcTimestamp, london.basis.utcTimestamp);
  const a = calculateBaziFortune(china, 'male'), b = calculateBaziFortune(london, 'male');
  assert.equal(a.firstTimestamp, b.firstTimestamp);
  assert.deepEqual(a.cycles.map((item) => item.ganZhi), b.cycles.map((item) => item.ganZhi));
  assert.deepEqual(calculateDecadalTimeline(a.birthTimestamp, 'male').cycles.map((cycle) => cycle.startTimestamp), a.cycles.map((cycle) => cycle.startTimestamp));
});
