import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPillarFact, buildPillarFacts, calculateBaziPillars } from '../src/systems/bazi/pillars';
import { buildFortuneEvidence } from '../src/systems/bazi/fortune-evidence';
import { calculateBaziFortune, locateBaziFortune } from '../src/systems/bazi/fortune';

test('大运与各流层逐对比较，保留岁运并临和岁运补全三支的来源', () => {
  const pillars = buildPillarFacts({ year: '甲申', month: '丙子', day: '戊寅', hour: '庚寅' });
  const layer = (id: 'dayun' | 'year' | 'month' | 'day' | 'hour', ganZhi: string) => ({ id, ganZhi, pillar: buildPillarFact(ganZhi, pillars.day.gan) });
  const active = [layer('dayun', '壬辰'), layer('year', '壬辰'), layer('month', '甲午'), layer('day', '丙戌'), layer('hour', '戊子')];
  const current = buildFortuneEvidence(pillars, active);
  assert.equal(current.comparisons.length, 30);
  assert.ok(current.comparisons.find((x) => x.source === 'year' && x.target === 'dayun')!.relations.some((x) => x.name === '岁运并临'));
  const water = current.formations.find((x) => x.name === '三合局' && x.element === '水')!;
  assert.deepEqual(water.triggers.map((x) => x.layer), ['dayun', 'year']);
  assert.ok(water.participants.some((x) => x.layer === 'natal-year' && x.branch === '申'));
  assert.match(current.limitation, /不等于成化/);
});

test('实际定位在童限和交运后分别只比较存在的岁运层级', async () => {
  const chart = await calculateBaziPillars({ year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 } });
  const fortune = calculateBaziFortune(chart, 'male');
  const childhood = locateBaziFortune(chart, fortune, fortune.birthTimestamp);
  assert.equal(childhood.evidence.comparisons.length, 22);
  assert.ok(childhood.evidence.comparisons.every((x) => x.source !== 'dayun' && x.target !== 'dayun'));
  const adulthood = locateBaziFortune(chart, fortune, fortune.firstTimestamp);
  assert.equal(adulthood.evidence.comparisons.length, 30);
  assert.ok(adulthood.evidence.comparisons.some((x) => x.source === 'dayun'));
});
