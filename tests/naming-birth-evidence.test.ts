import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  calculateNamingBirthContext,
  generateChineseNames,
} from '../packages/core/src/name-number/index.ts';
import { calculateBaziChartFromInput } from '../packages/core/src/bazi/input.ts';

test('起名出生依据逐柱保留藏干十神并复用八字月令旺衰调候', () => {
  for (const month of [1, 4, 7, 10]) {
    const input = { gender: 'male' as const, year: 2000, month, day: 15, timeIndex: 6 };
    const chart = calculateBaziChartFromInput(input);
    const context = calculateNamingBirthContext(input);
    assert.equal(context.monthContext.branch, chart.pillars.month.zhi);
    assert.equal(context.monthContext.commander, chart.monthCommander);
    assert.equal(context.monthContext.term, chart.seasonInfo.currentJieqi);
    assert.equal(context.strength.status, chart.analysis.dayMasterStrength.status);
    assert.ok(
      context.strength.basis.includes(
        `月令作用：${chart.analysis.dayMasterStrength.details.seasonalEffect}`,
      ),
    );
    assert.ok(
      context.strength.basis.includes(
        `司令作用：${chart.analysis.dayMasterStrength.details.commanderEffect}`,
      ),
    );
    assert.deepEqual(context.climate, chart.climate ?? null);
    for (const [index, key] of (['year', 'month', 'day', 'hour'] as const).entries()) {
      assert.equal(context.pillarDetails[index].ganZhi, chart.pillars[key].ganZhi);
      assert.deepEqual(
        context.pillarDetails[index].hiddenStems.map((item) => item.stem),
        chart.hiddenStems[key],
      );
      assert.deepEqual(
        context.pillarDetails[index].hiddenStems.map((item) => item.tenGod),
        chart.hiddenTenGods[key],
      );
    }
    const analysis = analyzeChineseName({ fullName: '李清和', birth: input });
    const candidates = generateChineseNames({ surname: '李', birth: input, limit: 2 });
    for (const prompt of [
      buildChineseNameAnalysisPrompt({ analysis }),
      buildChineseNamingPrompt({ surname: '李', candidates }),
    ]) {
      assert.ok(prompt.includes(`月令：${context.monthContext.branch}月`));
      assert.ok(prompt.includes(`旺衰：${context.strength.status}`));
      for (const pillar of context.pillarDetails)
        assert.ok(prompt.includes(`${pillar.label}${pillar.ganZhi}藏干：`));
      for (const basis of context.strength.basis) assert.ok(prompt.includes(basis));
      for (const warning of context.warnings) assert.ok(prompt.includes(warning));
      assert.doesNotMatch(prompt, /小数总分|ruleBasis|seasonalEffect/);
    }
  }
});
