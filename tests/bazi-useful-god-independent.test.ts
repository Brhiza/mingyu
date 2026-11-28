import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildOrdinaryPattern, summarizePattern } from '../src/systems/bazi/pattern';
import { buildTransformation } from '../src/systems/bazi/transformation';
import { buildQuzhi } from '../src/systems/bazi/quzhi';
import { buildCongEr } from '../src/systems/bazi/conger';
import { buildExtremePattern } from '../src/systems/bazi/extreme';
import { buildUsefulBaseline } from '../src/systems/bazi/useful-baseline';
import { buildClimateCandidates, ensureClimateRulesLoaded } from '../src/systems/bazi/climate';

await ensureClimateRulesLoaded();
import { resolveClimate } from '../src/systems/bazi/climate-decision';
import { buildPatternEvidence } from '../src/systems/bazi/pattern-evidence';
import { analyzeUsefulGodPlacement, determineUsefulGod } from '../src/systems/bazi/useful-god';

function runDetermine(
  names: { year: string; month: string; day: string; hour: string },
  commanderStem: string,
  overrides?: {
    strengthStatus?: string;
    patternOverview?: ReturnType<typeof summarizePattern>;
    transformation?: ReturnType<typeof buildTransformation>;
  },
) {
  const pillars = buildPillarFacts(names);
  const strength = {
    ...buildDayMasterStrength(pillars, commanderStem),
    ...(overrides?.strengthStatus ? { status: overrides.strengthStatus } : {}),
  };
  const ordinaryPattern = buildOrdinaryPattern(pillars, commanderStem);
  const transformation = overrides?.transformation ?? buildTransformation(pillars, strength);
  const quzhi = buildQuzhi(pillars);
  const conger = buildCongEr(pillars, strength, commanderStem);
  const extreme = buildExtremePattern(pillars, strength, commanderStem, quzhi, conger);
  const patternOverview = overrides?.patternOverview ?? summarizePattern(ordinaryPattern, transformation, quzhi, conger, extreme);
  const patternEvidence = buildPatternEvidence(pillars, patternOverview, commanderStem, strength.status);
  const usefulBaseline = buildUsefulBaseline(pillars, strength, patternOverview, transformation);
  const climate = buildClimateCandidates(pillars, strength, patternOverview);
  const climateDecision = resolveClimate(climate.candidates, usefulBaseline);
  return determineUsefulGod({
    pillars,
    strength,
    patternOverview,
    patternEvidence,
    transformation,
    climate,
    climateDecision,
    monthCommander: { stem: commanderStem },
  });
}

test('普通身强、身弱与中和分别裁定扶抑用神与中和流通调候方向', () => {
  const names = { year: '甲寅', month: '丙寅', day: '甲寅', hour: '丁卯' };
  const strong = runDetermine(names, '甲', {
    strengthStatus: '身强',
    patternOverview: { pattern: '比肩格', source: '普通月令取格候选', limitation: '' },
  });
  assert.deepEqual(strong.favorableWuxing, ['火', '土', '金']);
  assert.deepEqual(strong.unfavorableWuxing, ['水', '木']);
  assert.equal(strong.incrementStatus, '已判定');
  assert.equal(strong.useful, '食伤');
  assert.equal(strong.avoid, '印星');

  const weak = runDetermine(names, '甲', {
    strengthStatus: '身弱',
    patternOverview: { pattern: '比肩格', source: '普通月令取格候选', limitation: '' },
  });
  assert.deepEqual(weak.favorableWuxing, ['木', '水']);
  assert.deepEqual(weak.unfavorableWuxing, ['火', '土', '金']);
  assert.equal(weak.incrementStatus, '已判定');
  assert.equal(weak.primaryReason, '司令');
  assert.equal(weak.useful, '比劫');
  assert.equal(weak.avoid, '食伤');

  const neutral = runDetermine(names, '甲', {
    strengthStatus: '中和',
    patternOverview: { pattern: '比肩格', source: '普通月令取格候选', limitation: '' },
  });
  assert.ok(neutral.favorableWuxing.length > 0);
  assert.equal(neutral.incrementStatus, '部分判定');
  assert.equal(neutral.primaryReason, '中和调候');
  assert.equal(neutral.useful, '食伤');
  assert.ok(neutral.tradeoffAnalysis?.neutralGuidance?.dynamicTrigger);

  // 冬月中和命局优先取火暖局调候
  const winterNeutral = runDetermine(
    { year: '戊戌', month: '癸亥', day: '丙午', hour: '己丑' },
    '壬',
    {
      strengthStatus: '中和',
      patternOverview: { pattern: '正官格', source: '普通月令取格候选', limitation: '' },
    },
  );
  assert.ok(winterNeutral.favorableWuxing.length > 0);
  assert.equal(winterNeutral.incrementStatus, '部分判定');
  assert.match(winterNeutral.primaryReason, /中和调候|调候/);
});

test('特殊格局与成化化气分别按顺势规则裁定用神', () => {
  const names = { year: '甲寅', month: '丙寅', day: '甲寅', hour: '丁卯' };
  const quzhi = runDetermine(names, '甲', {
    patternOverview: { pattern: '曲直格', source: '曲直条件模型', limitation: '' },
  });
  assert.deepEqual(quzhi.favorableWuxing, ['水', '木', '火']);
  assert.deepEqual(quzhi.unfavorableWuxing, ['金']);
  assert.equal(quzhi.primaryReason, '曲直顺势泄秀');
  assert.equal(quzhi.incrementStatus, '部分判定');

  const conger = runDetermine(names, '甲', {
    patternOverview: { pattern: '从儿格', source: '从儿条件模型', limitation: '' },
  });
  assert.deepEqual(conger.favorableWuxing, ['土', '火']);
  assert.deepEqual(conger.unfavorableWuxing, ['水', '金']);
  assert.equal(conger.primaryReason, '从儿顺局');

  const transformed = runDetermine(
    { year: '甲子', month: '丙子', day: '甲子', hour: '己巳' },
    '癸',
    {
      patternOverview: { pattern: '甲己化土格', source: '五合化气条件模型', limitation: '' },
      transformation: {
        pattern: '甲己化土格',
        pair: ['甲', '己'],
        dayStem: '甲',
        partner: '己',
        partnerPosition: 'hour',
        element: '土',
        status: '成化',
        verdictReason: '化气真纯成格',
        adjacent: false,
        monthSupported: false,
        formations: [],
        visibleTransform: [],
        transformRoots: [],
        dayRoots: [],
        resourceElement: '水',
        resourceApplicable: true,
        resourceRoots: [],
        controlsFound: [],
        repetition: [],
        jealous: [],
        clashes: [],
        blockers: [],
        pending: [],
        limitation: '',
      },
    },
  );
  assert.deepEqual(transformed.favorableWuxing, ['火', '土']);
  assert.deepEqual(transformed.unfavorableWuxing, ['木']);
  assert.equal(transformed.primaryReason, '化神顺势');
});

test('用神落位登记四柱透藏喜忌、中性与喜忌冲突', () => {
  const pillars = buildPillarFacts({ year: '甲子', month: '丙寅', day: '庚辰', hour: '辛巳' });
  const normal = analyzeUsefulGodPlacement(pillars, ['火', '土'], ['水', '木']);
  assert.equal(normal.summary, '用神落点分析');
  assert.ok(normal.favorableCount > 0);
  assert.ok(normal.unfavorableCount > 0);
  assert.ok(normal.items.some((item) => item.pillar === 'month' && item.stem === '丙' && item.status === '喜用五行透出'));
  assert.ok(normal.items.some((item) => item.pillar === 'year' && item.stem === '甲' && item.status === '忌神五行透出'));
  assert.ok(normal.items.some((item) => item.pillar === 'day' && item.stem === '庚' && item.status === '中性'));

  const conflict = analyzeUsefulGodPlacement(pillars, ['火'], ['火']);
  assert.ok(conflict.items.some((item) => item.pillar === 'month' && item.stem === '丙' && item.status === '喜忌冲突'));
});

test('独立八字输出【用神裁定与落位】，追问校验并拒绝篡改 usefulGod', async () => {
  const input = {
    question: '事业与用神如何？',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male' as const,
  };
  const result = await calculate('bazi', input);
  assert.ok(result.data.chart.usefulGod);
  assert.match(result.prompt.text, /【用神裁定与落位】/);
  assert.ok(result.prompt.text.includes(result.data.chart.usefulGod.primaryReason));

  const saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'bazi', result: saved, question: '补充看财运' });
  assert.match(next.prompt.text, /【用神裁定与落位】/);

  const tamperedReason = structuredClone(saved);
  tamperedReason.data.chart.usefulGod.primaryReason = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi', result: tamperedReason, question: '继续问' }), /不一致/);

  const tamperedPlacement = structuredClone(saved);
  tamperedPlacement.data.chart.usefulGod.placement.favorableCount = 99;
  await assert.rejects(() => reprompt({ method: 'bazi', result: tamperedPlacement, question: '继续问' }), /不一致/);
});
