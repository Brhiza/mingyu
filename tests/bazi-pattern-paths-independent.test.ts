import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildPatternEvidence, formatPatternEvidence } from '../src/systems/bazi/pattern-evidence';

const positions = ['year', 'month', 'day', 'hour'] as const;

test('特殊格不自动套用普通制化路径，提示词保留成败未裁定的边界', () => {
  const pillars = buildPillarFacts({ year: '壬申', month: '癸丑', day: '甲午', hour: '癸酉' });
  const value = buildPatternEvidence(pillars, { pattern: '从财格', source: '从财优先条件模型', limitation: '' }, '己');
  assert.deepEqual(value.paths, []);
  assert.match(formatPatternEvidence(value), /最终用神尚未裁定/);
});

test('印化杀须由同一柱位的印星承接，成立时保留中间干', () => {
  const check = (names: Record<typeof positions[number], string>) => {
    const pillars = buildPillarFacts(names);
    return buildPatternEvidence(pillars, { pattern: '七杀格', source: '普通月令取格候选', limitation: '' }, pillars.month.hiddenStems[0].stem);
  };
  const connected = check({ year: '丙子', month: '己酉', day: '庚戌', hour: '丙寅' });
  const chain = connected.paths.find((path) => path.key === '印化杀')!;
  assert.equal(chain.status, '满足');
  assert.deepEqual(chain.pairs[0].via, { position: 'month', stem: '己', tenGod: '正印' });
  assert.match(formatPatternEvidence(connected), /年柱丙→月柱己→日柱庚/);
  const disconnected = check({ year: '庚戌', month: '己卯', day: '癸丑', hour: '庚寅' });
  const broken = disconnected.paths.find((path) => path.key === '印化杀')!;
  assert.equal(broken.status, '不满足');
  assert.match(broken.reason, /未由同一柱位的中间干承接/);
});
