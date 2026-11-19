import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPillarFacts, calculateBaziPillars } from '../src/systems/bazi/pillars';
import { buildNatalFacts } from '../src/systems/bazi/natal-facts';

test('本命关系保留重复柱位、直接冲的来源和日主不计透出', async () => {
  const pillars = buildPillarFacts({ year: '甲子', month: '丙午', day: '甲子', hour: '庚午' });
  const facts = buildNatalFacts(pillars);
  assert.equal(facts.relations.filter((x) => x.name === '六冲').length, 4);
  assert.ok(facts.relations.some((x) => x.name === '天干相冲' && x.positions.join() === 'year,hour'));
  const source = facts.roots[1].sources.find((x) => x.position === 'month' && x.stem === '丁')!;
  assert.deepEqual(source.clashSources.map((x) => x.position), ['year', 'day']);
  assert.deepEqual(facts.tenGodDistribution.find((x) => x.tenGod === '比肩')!.visible, ['year']);
  const chart = await calculateBaziPillars({ year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 } });
  assert.deepEqual(chart.natalFacts, buildNatalFacts(chart.pillars, chart.monthCommander.stem));
  assert.match(chart.natalFacts.limitation, /须另行分析/);
});
