import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildOrdinaryPattern, summarizePattern } from '../src/systems/bazi/pattern';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildTransformation } from '../src/systems/bazi/transformation';
import { buildQuzhi, formatQuzhi } from '../src/systems/bazi/quzhi';

const positions = ['year', 'month', 'day', 'hour'] as const;
const chart = (names: readonly string[]) => buildPillarFacts(Object.fromEntries(positions.map((p, i) => [p, names[i]])) as Record<typeof positions[number], string>);

function overview(pillars: ReturnType<typeof chart>) {
  const commander = pillars.month.hiddenStems[0].stem;
  const strength = buildDayMasterStrength(pillars, commander);
  return summarizePattern(buildOrdinaryPattern(pillars, commander), buildTransformation(pillars, strength), buildQuzhi(pillars));
}

test('曲直两条路线、火土透出和庚辛冲局反证分开保留', () => {
  for (const [names, route, status] of [
    [['癸亥', '乙卯', '乙卯', '癸未'], '亥卯未木局', '条件成立'],
    [['癸亥', '戊午', '乙卯', '癸未'], '亥卯未木局', '条件成立'],
    [['甲寅', '戊辰', '乙卯', '癸亥'], '寅卯辰东方', '条件成立'],
    [['辛亥', '乙卯', '乙卯', '癸未'], '亥卯未木局', '存在反证'],
    [['甲戌', '乙卯', '乙亥', '癸未'], '亥卯未木局', '存在反证'],
    [['己酉', '乙卯', '乙亥', '癸未'], '亥卯未木局', '存在反证'],
  ] as const) {
    const pillars = chart(names), result = buildQuzhi(pillars)!;
    assert.equal(result.route, route); assert.equal(result.status, status);
    assert.ok(formatQuzhi(result).includes(result.route));
    if (status === '条件成立') assert.equal(overview(pillars).pattern, '曲直格');
    else assert.notEqual(overview(pillars).source, '曲直条件模型');
  }
  const fire = buildQuzhi(chart(['癸亥', '乙卯', '乙卯', '丁未']))!;
  assert.deepEqual(fire.visibleOutput.map((item) => item.stem), ['丁']);
  const earth = buildQuzhi(chart(['甲寅', '乙卯', '甲子', '戊辰']))!;
  assert.deepEqual(earth.visibleWealth.map((item) => item.stem), ['戊']);
  assert.ok(buildQuzhi(chart(['甲戌', '乙卯', '乙亥', '癸未']))!.hiddenMetal.some((item) => item.stem === '辛'));
  assert.ok(buildQuzhi(chart(['己酉', '乙卯', '乙亥', '癸未']))!.externalClashes.some((item) => item.branch === '酉' && item.targets.includes('卯')));
});

