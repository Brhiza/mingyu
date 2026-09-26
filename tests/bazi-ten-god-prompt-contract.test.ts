import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { buildEnhancedTenGodsSection } from '../packages/core/src/minglu/bazi-enhancer';
import { formatBaziSchoolFacts } from '../packages/core/src/prompt/bazi-school';

test('真实命盘的流派十神统计与命录一致，日主自身不虚增比肩', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 19,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    useTrueSolarTime: false,
  });
  assert.equal(chart.pillars.day.ganZhi, '甲申');
  const section = buildEnhancedTenGodsSection(chart);
  assert.equal(section.godsList.find((item) => item.tenGod === '比肩')?.count, 0);

  for (const school of ['mangpai', 'xinpai'] as const) {
    const prompt = formatBaziSchoolFacts(chart, school);
    const line = prompt.split('\n').find((item) => /^十神(?:显隐|结构)：/.test(item));
    assert.ok(line);
    assert.match(line, /原局未见[^；\n]*比肩/);
    assert.doesNotMatch(line, /比肩(?:透出|透藏并见|仅藏)/);
    assert.doesNotMatch(line, /劫财(?:透出|透藏并见|仅藏)/);
  }
});

test('盲派柱位阶段取象与实际岁运分开，保留出生盘及起运资料', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 19,
    timeIndex: 5,
    gender: 'male',
  });
  const prompt = formatBaziSchoolFacts(chart, 'mangpai');
  assert.match(prompt, /柱位阶段取象：年柱早年、月柱青年、日柱中年、时柱晚年/);
  assert.doesNotMatch(
    prompt,
    /年柱约对应1至16岁|月柱约对应17至32岁|日柱约对应33至48岁|时柱约对应49岁以后/,
  );
  assert.ok(prompt.includes(chart.pillars.day.ganZhi));
  assert.match(prompt, /起运/);
});
