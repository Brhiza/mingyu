import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildTransformation } from '../src/systems/bazi/transformation';

const positions = ['year', 'month', 'day', 'hour'] as const;
const chart = (names: readonly string[]) => buildPillarFacts(Object.fromEntries(positions.map((key, i) => [key, names[i]])) as Record<typeof positions[number], string>);
const evaluate = (names: readonly string[]) => { const pillars = chart(names); return buildTransformation(pillars, buildDayMasterStrength(pillars, pillars.month.hiddenStems[0].stem)); };

test('五合化气保留五组条件、待核及反证', () => {
  const cases = [
    [['戊辰', '己未', '甲午', '丁酉'], '土', '成化'],
    [['己酉', '癸酉', '乙丑', '庚戌'], '金', '成化'],
    [['癸酉', '甲子', '丙申', '辛酉'], '水', '成化'],
    [['甲戌', '丁卯', '壬寅', '甲辰'], '木', '成化'],
    [['甲午', '庚午', '癸未', '戊午'], '火', '成化'],
    [['丁酉', '己丑', '甲午', '丁酉'], '土', '待核验'],
    [['己酉', '丙午', '甲子', '丁巳'], '土', '存在反证'],
    [['乙巳', '己丑', '甲子', '丙寅'], '土', '存在反证'],
    [['庚申', '己丑', '甲子', '丁卯'], '土', '存在反证'],
  ] as const;
  for (const [names, element, status] of cases) {
    const result = evaluate(names)!;
    assert.equal(result.element, element, names.join(' '));
    assert.equal(result.status, status, names.join(' '));
    assert.ok(result.limitation.includes('模型'));
  }
  assert.ok(evaluate(['己酉', '丙午', '甲子', '丁巳'])!.blockers.includes('日干与配干隔位'));
  assert.ok(evaluate(['乙巳', '己丑', '甲子', '丙寅'])!.jealous.some((item) => item.stem === '乙'));
  assert.ok(evaluate(['庚申', '己丑', '甲子', '丁卯'])!.clashes.some((item) => item.stem === '庚'));
});

