import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  calculateNamingBirthContext,
  generateChineseNames,
  analyzeNumber,
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

test('起名与姓名解析保留本盘成格理由，摘要回退也不重复通用格局依据', () => {
  const birth = { gender: 'male' as const, year: 2000, month: 1, day: 15, timeIndex: 6 };
  const analysis = analyzeChineseName({ fullName: '李清和', birth });
  const candidates = generateChineseNames({ surname: '李', birth, limit: 1 });
  const decisionDetail = '格神已透干且有可用根气，当前未见有效明透破格项。';
  const decisionLine = `当前成败判定：成格；判定理由：${decisionDetail}`;
  for (const [context, buildPrompt] of [
    [analysis.birthContext, () => buildChineseNameAnalysisPrompt({ analysis })],
    [
      candidates[0]?.analysis.birthContext,
      () => buildChineseNamingPrompt({ surname: '李', candidates }),
    ],
  ] as const) {
    assert.ok(context?.pattern.fulfillment);
    const fulfillment = context.pattern.fulfillment;
    assert.deepEqual(context.pillars, ['己卯', '丁丑', '壬申', '丙午']);
    assert.equal(fulfillment.status, '成格');
    assert.equal(fulfillment.decisionDetail, decisionDetail);
    assert.ok(fulfillment.basis);
    const before = structuredClone(context);
    const prompt = buildPrompt();
    assert.equal(prompt.split(decisionLine).length - 1, 1);
    assert.equal(prompt.includes(fulfillment.basis), false);
    assert.doesNotMatch(prompt, /格局判定依据：/);
    assert.ok(prompt.includes('月柱丁丑藏干：己（正官）、癸（劫财）、辛（正印）'));
    assert.ok(prompt.includes('原局格神作用：己正官（年柱）已参与成格'));
    assert.deepEqual(context, before);

    fulfillment.decisionDetail = undefined;
    fulfillment.summary = `${decisionDetail} ${fulfillment.basis}`;
    const fallbackBefore = structuredClone(context);
    const fallbackPrompt = buildPrompt();
    assert.equal(fallbackPrompt.split(decisionLine).length - 1, 1);
    assert.equal(fallbackPrompt.includes(fulfillment.basis), false);
    assert.deepEqual(context, fallbackBefore);
  }
});

test('历史夏令时跨日出生的起名事实和提示词采用回拨后的北京时间', () => {
  const birth = {
    gender: 'male' as const,
    year: 1990,
    month: 5,
    day: 15,
    dateType: 'solar' as const,
    timeIndex: '',
    useTrueSolarTime: false,
    birthHour: '0',
    birthMinute: '20',
    birthSecond: '17',
    applyChinaDst: true,
  };
  const context = calculateNamingBirthContext(birth);
  assert.equal(context.timeBasis.inputDate, '公历1990年5月15日');
  assert.equal(context.timeBasis.inputTime, '00:20:17');
  assert.equal(context.timeBasis.calculatedTime, '23:20:17');
  assert.equal(context.solarDate, '1990-05-14');
  assert.match(context.timeBasis.mode, /已回拨为标准北京时间/);
  for (const prompt of [
    buildChineseNameAnalysisPrompt({ analysis: analyzeChineseName({ fullName: '李清和', birth }) }),
    buildChineseNamingPrompt({
      surname: '李',
      candidates: generateChineseNames({ surname: '李', birth, limit: 1 }),
    }),
  ]) {
    assert.match(prompt, /出生记录：公历1990年5月15日 00:20:17/);
    assert.match(prompt, /排盘公历：1990-05-14 23:20:17/);
    assert.match(prompt, /中国历史夏令时钟表时间（已回拨为标准北京时间）/);
  }

  const standard = calculateNamingBirthContext({ ...birth, applyChinaDst: false });
  assert.equal(standard.timeBasis.calculatedTime, '00:20:17');
  assert.equal(standard.solarDate, '1990-05-15');

  const lunar = calculateNamingBirthContext({ ...birth, dateType: 'lunar', isLeapMonth: false });
  assert.equal(lunar.timeBasis.inputDate, '农历1990年5月15日');
  assert.equal(lunar.solarDate, '1990-06-06');
  assert.equal(lunar.timeBasis.calculatedTime, '23:20:17');
});

test('辈分字和号码类型在核心入口拒绝无效值', () => {
  for (const generationCharacter of ['A', '承A', '承明']) {
    assert.throws(
      () => generateChineseNames({ surname: '李', generationCharacter }),
      /辈分字只能填写一个汉字/,
    );
  }
  assert.equal(
    generateChineseNames({ surname: '李', generationCharacter: ' 承 ', limit: 1 })[0]?.givenName[0],
    '承',
  );
  assert.throws(() => analyzeNumber('1234', 'unknown' as never), /号码类型必须为/);
});

test('命名提示词保留七杀未透的本盘判定与藏干依据，完整格局事实仍留在分析结果', () => {
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
    assert.deepEqual(context.pillars, ['己卯', '丙子', '丁巳', '辛亥']);
    assert.equal(fulfillment.status, '未判定');
    assert.equal(
      prompt.split(
        '当前成败判定：未判定；判定理由：七杀仅见于月柱藏干癸（七杀），未透干，不能按明示格神直接定成败。',
      ).length - 1,
      1,
    );
    assert.ok(prompt.includes('月柱丙子藏干：癸（七杀）'));
    assert.ok(prompt.includes('年柱己卯藏干：乙（偏印）'));
    assert.ok(prompt.includes('时柱辛亥藏干：壬（正官）、甲（正印）'));
    assert.equal(prompt.includes(fulfillment.contradiction), false);
    assert.equal(prompt.includes(fulfillment.basis), false);
    assert.ok(prompt.includes(`增补喜用五行：${context.favorableElements.join('、')}`));
    assert.ok(prompt.includes(`取用依据：${context.usefulGodReason}`));
    assert.doesNotMatch(prompt, /^成立条件：|^格局条件（|^制化路径：/m);
    assert.deepEqual(context, before);
  }
});
