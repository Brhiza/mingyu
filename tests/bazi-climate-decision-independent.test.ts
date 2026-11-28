import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildClimateCandidates, ensureClimateRulesLoaded } from '../src/systems/bazi/climate';

await ensureClimateRulesLoaded();
import { resolveClimate } from '../src/systems/bazi/climate-decision';
import { buildUsefulBaseline } from '../src/systems/bazi/useful-baseline';

const pattern = { pattern: '正官格', source: '普通月令取格候选', limitation: '' };
test('同权限不同作用冲突时不采用，互不冲突的主干并列', () => {
  const sample = buildPillarFacts({ year: '壬子', month: '戊子', day: '甲子', hour: '壬申' });
  const baseline = buildUsefulBaseline(sample, buildDayMasterStrength(sample, '癸'), pattern, null);
  const original = buildClimateCandidates(sample, buildDayMasterStrength(sample, '癸'), pattern, '冬至').candidates.find((item) => item.id === 'jia-zi-ren-repeated-no-fire')!;
  const conflict = structuredClone(original); conflict.id = 'conflict'; conflict.effects![0].role = '冲突';
  const outcome = resolveClimate([original, conflict], baseline);
  assert.deepEqual(outcome.conflicts, [original.id, 'conflict']); assert.deepEqual(outcome.applied, []);
  const other = structuredClone(original); other.id = 'other'; other.effects![0].stem = '丁';
  const both = resolveClimate([original, other], baseline);
  assert.deepEqual(both.applied, [original.id, 'other']); assert.deepEqual(both.conditionalFavorableStems, ['丙', '丁']);
});
