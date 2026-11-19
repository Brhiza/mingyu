import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildOrdinaryPattern } from '../src/systems/bazi/pattern';

const positions = ['year', 'month', 'day', 'hour'] as const;
const from = (...names: string[]) => buildPillarFacts(Object.fromEntries(positions.map((key, i) => [key, names[i]])) as Record<typeof positions[number], string>);

test('月令藏干、司权透干和禄刃优先级保留各自依据', () => {
  for (const [names, commander, expected] of [
    [['壬午', '庚戌', '壬子', '辛亥'], '戊', '杂气正印格'],
    [['壬午', '庚戌', '癸丑', '辛酉'], '戊', '杂气偏印格'],
    [['壬申', '壬寅', '壬子', '丙午'], '甲', '偏财格'],
    [['辛酉', '戊戌', '壬子', '辛亥'], '戊', '七杀格'],
    [['戊辰', '丙寅', '甲子', '庚午'], '戊', '建禄格'],
    [['庚辰', '辛巳', '丁酉', '庚子'], '庚', '劫财格'],
    [['戊辰', '乙卯', '丙子', '庚午'], '甲', '正印格'],
  ] as const) {
    const pillars = from(...names), result = buildOrdinaryPattern(pillars, commander);
    assert.equal(result.candidate, expected);
    assert.ok(result.limitation.includes('候选'));
    assert.deepEqual(result.monthHiddenStems.map((item) => item.stem), pillars.month.hiddenStems.map((item) => item.stem));
    assert.ok(result.monthHiddenStems.every((item) => item.positions.every((position) => pillars[position].gan === item.stem)));
  }
  const seasonal = buildOrdinaryPattern(from('戊辰', '乙卯', '丙子', '庚午'), '甲');
  assert.equal(seasonal.commander.isMonthHidden, false);
  assert.equal(seasonal.monthPrincipal.stem, '乙');
});

