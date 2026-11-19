import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildBaziCompatibility } from '../src/systems/bazi/compatibility';

test('双盘逐柱交叉比较保留双向十神、合局来源和取用限制', () => {
  const a = buildPillarFacts({ year: '甲申', month: '丙子', day: '甲寅', hour: '壬午' });
  const b = buildPillarFacts({ year: '壬辰', month: '甲申', day: '丙子', hour: '戊午' });
  const result = buildBaziCompatibility(a, b);
  assert.equal(result.comparisons.length, 16);
  assert.equal(new Set(result.comparisons.map((item) => `${item.person1Pillar}/${item.person2Pillar}`)).size, 16);
  assert.deepEqual(result.dayMasterRelation, {
    person1Stem: '甲', person1Element: '木', person2Stem: '丙', person2Element: '火',
    person1ToPerson2: '生对方', person2ToPerson1: '受对方生', person2AsPerson1TenGod: '食神', person1AsPerson2TenGod: '偏印',
  });
  const water = result.combinations.find((item) => item.name === '三合局' && item.element === '水');
  assert.ok(water);
  assert.deepEqual(water.members.map((member) => [member.branch, member.sources]), [
    ['申', [{ person: 'person1', pillar: 'year' }, { person: 'person2', pillar: 'month' }]],
    ['子', [{ person: 'person1', pillar: 'month' }, { person: 'person2', pillar: 'day' }]],
    ['辰', [{ person: 'person2', pillar: 'year' }]],
  ]);
  assert.equal(result.tenGodMappings.length, 8);
  assert.equal(result.usefulGodCoverage.status, '待计算');
  assert.match(result.limitation, /不证明成化/);
  const reversed = buildBaziCompatibility(b, a);
  assert.equal(reversed.dayMasterRelation.person1ToPerson2, result.dayMasterRelation.person2ToPerson1);
  assert.equal(reversed.dayMasterRelation.person2AsPerson1TenGod, result.dayMasterRelation.person1AsPerson2TenGod);
});
