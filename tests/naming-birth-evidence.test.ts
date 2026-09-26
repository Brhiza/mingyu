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

test('起名出生依据逐柱保留藏干十神并复用八字月令旺衰与水火参考', () => {
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
      if (context.climate && context.climate.nature !== '未见明显偏向') {
        assert.ok(
          prompt.includes(
            `水火分布参考：${context.climate.nature}；${context.climate.summary}；${context.climate.medicine}`,
          ),
        );
        assert.doesNotMatch(prompt, /寒暖分布：(?:寒局|燥局|中和)/);
      } else {
        assert.doesNotMatch(prompt, /水火分布参考：|寒暖分布：/);
      }
      for (const pillar of context.pillarDetails)
        assert.ok(prompt.includes(`${pillar.label}${pillar.ganZhi}藏干：`));
      for (const basis of context.strength.basis) assert.ok(prompt.includes(basis));
      for (const warning of context.warnings) assert.ok(prompt.includes(warning));
      assert.doesNotMatch(prompt, /小数总分|ruleBasis|seasonalEffect/);
    }
  }
});

test('起名与姓名解析只在摘要未包含格局依据时单列依据', () => {
  const birth = { gender: 'male' as const, year: 2000, month: 1, day: 15, timeIndex: 6 };
  const analysis = analyzeChineseName({ fullName: '李清和', birth });
  const candidates = generateChineseNames({ surname: '李', birth, limit: 1 });
  const contexts = [analysis.birthContext, candidates[0]?.analysis.birthContext];
  for (const context of contexts) {
    assert.ok(context?.pattern.fulfillment);
    context.pattern.fulfillment.basis = '身杀两停，制化相济';
    context.pattern.fulfillment.summary = `格局成立；${context.pattern.fulfillment.basis}`;
  }
  for (const prompt of [
    buildChineseNameAnalysisPrompt({ analysis }),
    buildChineseNamingPrompt({ surname: '李', candidates }),
  ]) {
    assert.equal(prompt.split('身杀两停，制化相济').length - 1, 1);
    assert.doesNotMatch(prompt, /格局判定依据：身杀两停，制化相济/);
  }
  analysis.birthContext!.pattern.fulfillment!.summary = '格局成立';
  assert.match(buildChineseNameAnalysisPrompt({ analysis }), /格局判定依据：身杀两停，制化相济/);
});

test('命名提示词只展开格局结论与关键反证，完整格局事实仍留在分析结果', () => {
  const birth = {
    gender: 'male' as const,
    year: 2000,
    month: 1,
    day: 1,
    timeIndex: 0,
    dateType: 'solar' as const,
    useTrueSolarTime: true,
    birthHour: 0,
    birthMinute: 30,
    birthLongitude: 75,
    birthPlace: '喀什',
  };
  const analysis = analyzeChineseName({ fullName: '曾清和', birth });
  const candidates = generateChineseNames({ surname: '曾', birth, limit: 1 });
  assert.equal(candidates.length, 1);
  for (const [context, buildPrompt] of [
    [analysis.birthContext, () => buildChineseNameAnalysisPrompt({ analysis })],
    [
      candidates[0].analysis.birthContext,
      () => buildChineseNamingPrompt({ surname: '曾', candidates }),
    ],
  ] as const) {
    assert.ok(context?.pattern.fulfillment);
    const before = structuredClone(context);
    const fulfillment = context.pattern.fulfillment;
    assert.ok(fulfillment.conditions.length);
    assert.ok(fulfillment.conditionFacts.length);
    assert.ok(fulfillment.pathEvaluations.length);
    assert.ok(fulfillment.contradiction);
    const prompt = buildPrompt();
    assert.ok(prompt.includes(`四柱：${context.pillars.join(' ')}`));
    assert.ok(prompt.includes(`旺衰：${context.strength.status}`));
    assert.ok(prompt.includes(`格局成败：${fulfillment.status}；${fulfillment.summary}`));
    assert.ok(prompt.includes(`格局反证：${fulfillment.contradiction}`));
    assert.ok(prompt.includes(`增补喜用五行：${context.favorableElements.join('、')}`));
    assert.ok(prompt.includes(`取用依据：${context.usefulGodReason}`));
    assert.doesNotMatch(prompt, /^成立条件：|^格局条件（|^制化路径：/m);
    assert.deepEqual(context, before);
  }
});
