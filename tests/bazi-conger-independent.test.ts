import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildCongEr } from '../src/systems/bazi/conger';

const positions = ['year', 'month', 'day', 'hour'] as const;
const chart = (names: readonly string[]) => buildPillarFacts(Object.fromEntries(positions.map((p, i) => [p, names[i]])) as Record<typeof positions[number], string>);
const evaluate = (names: readonly string[], commander = '甲') => { const pillars = chart(names); return buildCongEr(pillars, buildDayMasterStrength(pillars, commander), commander); };

test('顺局及从财优先案例分别保留路线、根气与反证', () => {
  const examples = [
    [['丁卯', '壬寅', '癸卯', '丙辰'], '三会食伤成气'],
    [['丁巳', '癸卯', '癸卯', '丙辰'], '月建食伤当权'],
    [['己未', '丁丑', '丙戌', '戊戌'], '月建食伤当权'],
    [['己未', '辛未', '丙戌', '戊戌'], '月建食伤当权'],
    [['甲午', '丁丑', '甲午', '丙寅'], '食伤并透坐支同气'],
    [['辛丑', '辛丑', '戊申', '壬子'], '食伤并透坐支同气'],
    [['庚子', '庚辰', '戊申', '辛酉'], '食伤并透坐支同气'],
    [['壬寅', '辛亥', '辛亥', '壬辰'], '月建食伤当权'],
    [['壬子', '辛亥', '辛卯', '辛卯'], '月建食伤当权'],
  ] as const;
  for (const [names, route] of examples) { const result = evaluate(names)!; assert.equal(result.route, route, names.join(' ')); assert.equal(result.status, '条件成立', names.join(' ')); }
  assert.equal(evaluate(['戊戌', '丙辰', '乙未', '丙戌'])?.competingWealth, '四支本气皆财');
  assert.equal(evaluate(['壬寅', '壬寅', '庚寅', '戊寅'])?.competingWealth, '四支本气皆财');
  assert.equal(evaluate(['丙寅', '庚寅', '壬午', '乙巳'])?.competingWealth, '食伤当令而财归日时');
  const rescued = evaluate(['丁巳', '辛卯', '癸卯', '乙巳'])!;
  assert.equal(rescued.status, '条件成立');
  assert.ok(rescued.resolutions?.some((item) => item.includes('财星有根')));
  assert.equal(evaluate(['丁丑', '辛卯', '癸卯', '乙亥'])?.status, '存在反证');
  assert.equal(evaluate(['丙午', '辛卯', '癸丑', '乙卯'])?.status, '条件成立');
  assert.equal(evaluate(['丙午', '辛卯', '癸丑', '甲寅'])?.status, '存在反证');
});

