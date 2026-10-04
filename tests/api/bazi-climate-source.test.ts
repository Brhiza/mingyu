import assert from 'node:assert/strict';
import test from 'node:test';
import type { BaziChartResult } from '../../packages/core/src/bazi/baziTypes';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

async function post(path: string, input: object) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return { status: response.status, body: await response.json() };
}

test('公开八字排盘与完整提示词沿用己申、戊巳本盘调候顺序', async () => {
  const samples = [
    {
      year: 2024,
      month: 8,
      day: 13,
      dayStem: '己',
      monthPillar: '壬申',
      dayPillar: '己酉',
      ruleId: 'shen-month-ji-bing-jia-first',
      order: ['水', '火', '金'],
    },
    {
      year: 2024,
      month: 5,
      day: 14,
      dayStem: '戊',
      monthPillar: '己巳',
      dayPillar: '戊寅',
      ruleId: 'si-month-wu-gui-bing-first',
      order: ['木', '火', '水'],
    },
  ] as const;

  for (const sample of samples) {
    const person = {
      dateType: 'solar',
      gender: 'male',
      year: sample.year,
      month: sample.month,
      day: sample.day,
      timeIndex: 6,
      useTrueSolarTime: false,
      detailMode: 'full',
    };
    const calculated = await post('bazi/calculate', person);
    assert.equal(calculated.status, 200, JSON.stringify(calculated.body));
    const chart = (calculated.body as { data: BaziChartResult }).data;

    assert.equal(chart.dayMaster.gan, sample.dayStem);
    assert.equal(chart.pillars.month.ganZhi, sample.monthPillar);
    assert.equal(chart.pillars.day.ganZhi, sample.dayPillar);

    const candidate = chart.analysis.usefulGod.decisionEvidence?.climateCandidates.find(
      (item) => item.ruleId === sample.ruleId,
    );
    assert.ok(candidate, sample.ruleId);
    assert.equal(candidate.mode, 'reference');
    assert.equal(candidate.status, '满足');
    assert.equal(candidate.adopted, false);
    assert.deepEqual(candidate.requestedOrder, sample.order);
    assert.deepEqual(
      chart.analysis.usefulGod.decisionEvidence?.climateReferenceOrder,
      sample.order,
    );

    const prompted = await post('bazi/prompt', {
      ...person,
      question: '核对本命调候取用顺序。',
      baziFortuneScope: 'natal',
      responseMode: 'full',
    });
    assert.equal(prompted.status, 200, JSON.stringify(prompted.body));
    const promptData = (prompted.body as { data: { result: BaziChartResult; prompt: string } })
      .data;
    assert.deepEqual(promptData.result.pillars, chart.pillars);
    assert.deepEqual(
      promptData.result.analysis.usefulGod.decisionEvidence?.climateReferenceOrder,
      sample.order,
    );
    assert.ok(promptData.prompt.includes(`日元本命: ${sample.dayStem}土`));
    assert.ok(promptData.prompt.includes(`月柱: ${sample.monthPillar}`));
    assert.ok(promptData.prompt.includes(`日柱: ${sample.dayPillar}`));
    assert.match(promptData.prompt, /【任务】[\s\S]*旺衰、格局、调候各明依据/u);
    assert.match(promptData.prompt, /【问题】[\s\S]*核对本命调候取用顺序。/u);
  }
});

test('公开八字丙戌月庚戊困木水按真实透藏命中，缺木盘不命中', async () => {
  const ruleId = 'xu-month-bing-geng-wu-trap-jia-ren';
  const assertClimateResult = (
    result: BaziChartResult,
    status: '满足' | '不满足',
    matched: boolean,
  ) => {
    const candidate = result.analysis.usefulGod.decisionEvidence?.climateCandidates.find(
      (item) => item.ruleId === ruleId,
    );
    assert.ok(candidate, ruleId);
    assert.equal(candidate.status, status);
    assert.equal(candidate.mode, 'reference');
    assert.equal(candidate.adopted, false);
    assert.equal(
      result.analysis.usefulGod.matchedRules?.some((item) => item.id === ruleId) ?? false,
      matched,
    );
  };
  const samples = [
    {
      day: 10,
      pillars: ['壬戌', '庚戌', '丙寅', '戊子'],
      matched: true,
      status: '满足',
    },
    {
      day: 20,
      pillars: ['壬戌', '庚戌', '丙子', '戊子'],
      matched: false,
      status: '不满足',
    },
  ] as const;

  for (const sample of samples) {
    const person = {
      dateType: 'solar',
      gender: 'male',
      year: 1982,
      month: 10,
      day: sample.day,
      timeIndex: 0,
      useTrueSolarTime: false,
      detailMode: 'full',
    };
    const calculated = await post('bazi/calculate', person);
    assert.equal(calculated.status, 200, JSON.stringify(calculated.body));
    const chart = (calculated.body as { data: BaziChartResult }).data;
    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      sample.pillars,
    );

    assertClimateResult(chart, sample.status, sample.matched);

    const prompted = await post('bazi/prompt', {
      ...person,
      question: '核对本命四柱与调候依据。',
      baziFortuneScope: 'natal',
      responseMode: 'full',
    });
    assert.equal(prompted.status, 200, JSON.stringify(prompted.body));
    const promptData = (prompted.body as { data: { result: BaziChartResult; prompt: string } })
      .data;
    assert.deepEqual(promptData.result.pillars, chart.pillars);
    assertClimateResult(promptData.result, sample.status, sample.matched);
    assert.ok(promptData.prompt.includes(`时柱: ${sample.pillars[3]}`));
    assert.match(promptData.prompt, /【任务】[\s\S]*调候/u);
  }
});

test('公开八字癸酉日两时辰神煞与完整提示词保持同一时柱事实', async () => {
  const samples = [
    { timeIndex: 10, hourPillar: '壬戌', hourShenSha: ['禄九地'] },
    { timeIndex: 11, hourPillar: '癸亥', hourShenSha: ['禄九天', '离祖杀'] },
  ] as const;

  for (const sample of samples) {
    const person = {
      dateType: 'solar',
      gender: 'male',
      year: 2024,
      month: 1,
      day: 10,
      timeIndex: sample.timeIndex,
      useTrueSolarTime: false,
      shenShaScope: 'all',
      detailMode: 'full',
    };
    const calculated = await post('bazi/calculate', person);
    assert.equal(calculated.status, 200, JSON.stringify(calculated.body));
    const chart = (calculated.body as { data: BaziChartResult }).data;
    assert.equal(chart.pillars.year.ganZhi, '癸卯');
    assert.equal(chart.pillars.day.ganZhi, '癸酉');
    assert.equal(chart.pillars.hour.ganZhi, sample.hourPillar);
    for (const name of sample.hourShenSha) {
      assert.ok(chart.shensha.hour.includes(name), `${sample.hourPillar} 应列出${name}`);
    }

    const prompted = await post('bazi/prompt', {
      ...person,
      question: '核对本命时柱与神煞。',
      baziFortuneScope: 'natal',
      responseMode: 'full',
    });
    assert.equal(prompted.status, 200, JSON.stringify(prompted.body));
    const promptData = (prompted.body as { data: { result: BaziChartResult; prompt: string } })
      .data;
    assert.deepEqual(promptData.result.pillars, chart.pillars);
    const promptLines = promptData.prompt.split('\n');
    const hourLineIndex = promptLines.findIndex((line) =>
      line.startsWith(`时柱: ${sample.hourPillar}`),
    );
    assert.notEqual(hourLineIndex, -1);
    const hourFacts = promptLines.slice(hourLineIndex + 1, hourLineIndex + 5).join('\n');
    for (const name of sample.hourShenSha) {
      assert.ok(hourFacts.includes(name), `提示词时柱事实应列出${name}`);
    }
  }
});
