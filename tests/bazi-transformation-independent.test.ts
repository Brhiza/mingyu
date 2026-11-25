import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildTransformation } from '../src/systems/bazi/transformation';

const positions = ['year', 'month', 'day', 'hour'] as const;
const chart = (names: readonly string[]) => buildPillarFacts(Object.fromEntries(positions.map((key, i) => [key, names[i]])) as Record<typeof positions[number], string>);
const evaluate = (names: readonly string[]) => { const pillars = chart(names); return buildTransformation(pillars, buildDayMasterStrength(pillars, pillars.month.hiddenStems[0].stem)); };

test('五合化气明确裁定成化、假化与合绊并给出理由与反证', () => {
  const cases = [
    [['戊辰', '己未', '甲午', '丁酉'], '土', '成化'],
    [['己酉', '癸酉', '乙丑', '庚戌'], '金', '成化'],
    [['癸酉', '甲子', '丙申', '辛酉'], '水', '成化'],
    [['甲戌', '丁卯', '壬寅', '甲辰'], '木', '成化'],
    [['甲午', '庚午', '癸未', '戊午'], '火', '成化'],
    [['丁酉', '己丑', '甲午', '丁酉'], '土', '假化（合而不化偏化气）'],
    [['己酉', '丙午', '甲子', '丁巳'], '土', '合绊（合而不化）'],
    [['乙巳', '己丑', '甲子', '丙寅'], '土', '合绊（合而不化）'],
    [['庚申', '己丑', '甲子', '丁卯'], '土', '合绊（合而不化）'],
  ] as const;
  for (const [names, element, status] of cases) {
    const result = evaluate(names)!;
    assert.equal(result.element, element, names.join(' '));
    assert.equal(result.status, status, names.join(' '));
    assert.ok(result.verdictReason.length > 0, names.join(' '));
    assert.ok(result.limitation.includes('模型'));
  }
  const fakeTransform = evaluate(['丁酉', '己丑', '甲午', '丁酉'])!;
  assert.match(fakeTransform.verdictReason, /假化偏化气/);
  assert.ok(evaluate(['己酉', '丙午', '甲子', '丁巳'])!.blockers.includes('日干与配干隔位'));
  assert.ok(evaluate(['乙巳', '己丑', '甲子', '丙寅'])!.jealous.some((item) => item.stem === '乙'));
  assert.ok(evaluate(['庚申', '己丑', '甲子', '丁卯'])!.clashes.some((item) => item.stem === '庚'));
});

test('根气受冲按旺衰对比细化为具体减力裁定，不再笼统标为待核', () => {
  // 午月火旺水囚，日支子水受月支午火冲 → 衰逢旺冲，根气大损
  const weakHit = buildDayMasterStrength(chart(['庚申', '壬午', '壬子', '丙午']), '丁');
  const ziRoot = weakHit.roots.find((root) => root.branch === '子');
  assert.ok(ziRoot);
  assert.equal(ziRoot.clashStatus, '受冲减力（衰逢旺冲，根气大损）');

  // 酉月金旺木死，年支寅木受日支申金冲 → 衰逢旺冲，根气大损
  const woodHit = buildDayMasterStrength(chart(['甲寅', '癸酉', '甲申', '丁卯']), '辛');
  const yinRoot = woodHit.roots.find((root) => root.branch === '寅');
  assert.ok(yinRoot);
  assert.equal(yinRoot.clashStatus, '受冲减力（衰逢旺冲，根气大损）');
});

