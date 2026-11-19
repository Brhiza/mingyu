import assert from 'node:assert/strict';
import test from 'node:test';
import { ChildLimit, China95ChildLimitProvider, SolarTerm } from 'tyme4ts';
import { generateQimen } from '../src/systems/qimen/chart';
import { computeQimen } from '../src/systems/qimen/compute';
import { buildDecadalLifetimeStages } from '../src/systems/qimen/lifetime/decadal';

const input = { birthTimestamp: Date.parse('1990-05-15T06:30:00Z'), gender: 'male' as const, timezone: 8 };

test('时间轴按精确瞬时相接，不同时区和真太阳时不改变起运', async () => {
  const birth = new Date(input.birthTimestamp), chart = generateQimen(birth);
  const male = buildDecadalLifetimeStages(chart, input);
  const female = buildDecadalLifetimeStages(chart, { ...input, gender: 'female' });
  assert.equal(male.basis.direction, 'forward');
  assert.equal(female.basis.direction, 'backward');
  assert.deepEqual(male.stages.slice(1, 4).map((s) => s.ganzhi), ['壬午', '癸未', '甲申']);
  assert.deepEqual(female.stages.slice(1, 4).map((s) => s.ganzhi), ['庚辰', '己卯', '戊寅']);
  assert.equal(male.stages[2].startDateTime, '2007-08-05T23:06:00+08:00');
  for (const result of [male, female]) {
    assert.equal(result.stages.length, 13);
    for (let i = 0; i < result.stages.length - 1; i++) assert.equal(result.stages[i].endDateTimeExclusive, result.stages[i + 1].startDateTime);
    assert.ok(result.stages[3].associatedMarkers.some((item) => item.includes('甲遁庚')) || result === female);
  }
  const london = buildDecadalLifetimeStages(chart, { ...input, timezone: 1, timeZoneId: 'Europe/London' });
  const solarChart = await computeQimen(birth, { timeStandard: 'true-solar', longitude: 105 });
  const solar = buildDecadalLifetimeStages(solarChart, input);
  for (const result of [london, solar]) {
    assert.equal(Date.parse(result.basis.startDateTime), Date.parse(male.basis.startDateTime));
    assert.deepEqual(result.stages.map((s) => s.ganzhi), male.stages.map((s) => s.ganzhi));
  }
});

test('固定起运规则不受可变全局 provider 影响，也不改变它', () => {
  const chart = generateQimen(new Date(input.birthTimestamp));
  const expected = buildDecadalLifetimeStages(chart, input);
  const saved = ChildLimit.provider, alternate = new China95ChildLimitProvider();
  try {
    ChildLimit.provider = alternate;
    assert.deepEqual(buildDecadalLifetimeStages(chart, input), expected);
    assert.equal(ChildLimit.provider, alternate);
  } finally { ChildLimit.provider = saved; }
});

test('拒绝缺失取法、错误时间及不一致的本命盘或时区', () => {
  const chart = generateQimen(new Date(input.birthTimestamp));
  assert.throws(() => buildDecadalLifetimeStages(chart, { ...input, gender: undefined as any }), /性别/);
  assert.throws(() => buildDecadalLifetimeStages(chart, { ...input, birthTimestamp: input.birthTimestamp + 1 }), /整秒/);
  assert.throws(() => buildDecadalLifetimeStages(chart, { ...input, birthTimestamp: input.birthTimestamp + 1000 }), /不一致/);
  assert.throws(() => buildDecadalLifetimeStages(chart, { ...input, timezone: 8, timeZoneId: 'Europe/London' }), /不一致/);
});
