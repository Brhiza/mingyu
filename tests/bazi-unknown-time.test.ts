import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { LuckCalculator } from '../packages/core/src/bazi/LuckCalculator';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { analyzeBaziCompatibility } from '../packages/core/src/bazi/compatibilityEvidence';

test('缺时辰不把午时当成出生事实，完整判断只出现在候选中', () => {
  const result = baziCalculator.calculateBazi({ year: 2000, month: 1, day: 7, gender: 'male' });
  assert.equal(result.isThreePillars, true);
  assert.equal(result.pillars.hour.ganZhi, '');
  assert.equal(result.timeInfo.index, -1);
  assert.equal(result.analysis.dayMasterStrength.status, '未知');
  assert.equal(result.analysis.mingGe.pattern, '待补时');
  assert.equal(result.warningSummaryFact.status, '存在需核验事项');
  assert.deepEqual(result.analysis.usefulGod.favorableWuxing, []);
  assert.deepEqual(result.luckInfo.cycles, []);
  assert.equal(result.mingGong, '');
  assert.deepEqual(result.shenShaAnalysis.hour, []);
  assert.equal(result.unknownTimeAnalysis?.scenarios.length, 15);
  const chou = result.unknownTimeAnalysis?.scenarios.find((scenario) => scenario.timeIndex === 1);
  assert.equal(chou?.pillars.hour.ganZhi, '乙丑');
  const explicit = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 1,
    gender: 'male',
  });
  assert.equal(chou?.strength, explicit.analysis.dayMasterStrength.status);
  assert.deepEqual(chou?.favorableWuxing, explicit.analysis.usefulGod.favorableWuxing);
  assert.equal(result.evidenceAnalysis?.status, '存在资料缺口');
  assert.ok(result.evidenceAnalysis?.analysisFacts.every((fact) => fact.status === '资料缺口'));
  assert.doesNotMatch(result.evidenceAnalysis?.calculationChain.join('\n') ?? '', /明确选择的.*午/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /时辰未知/);
  assert.match(prompt, /丑时候选/);
  assert.doesNotMatch(prompt, /【核心判断】|【大运】|命宫:/);
  assert.throws(() => analyzeBaziCompatibility(result, result), /先补齐双方出生时分/);
});

test('未知时辰基础盘和候选只构造本命起运资料，不生成未返回的大运流年', () => {
  const originalFull = LuckCalculator.prototype.calculateLuckInfo;
  const originalNatal = LuckCalculator.prototype.calculateNatalLuckInfo;
  let fullCalls = 0;
  let natalCalls = 0;
  LuckCalculator.prototype.calculateLuckInfo = function (...args: Parameters<typeof originalFull>) {
    fullCalls += 1;
    return originalFull.apply(this, args);
  };
  LuckCalculator.prototype.calculateNatalLuckInfo = function (
    ...args: Parameters<typeof originalNatal>
  ) {
    natalCalls += 1;
    return originalNatal.apply(this, args);
  };
  try {
    const result = baziCalculator.calculateBazi({
      year: 2000,
      month: 1,
      day: 7,
      gender: 'male',
    });
    assert.equal(result.unknownTimeAnalysis?.scenarios.length, 15);
  } finally {
    LuckCalculator.prototype.calculateLuckInfo = originalFull;
    LuckCalculator.prototype.calculateNatalLuckInfo = originalNatal;
  }
  assert.equal(fullCalls, 0);
  assert.equal(natalCalls, 16);
});

test('未知时辰的晚子日柱与立春交界柱保留为待定', () => {
  const result = baziCalculator.calculateBazi({ year: 2024, month: 2, day: 4, gender: 'female' });
  assert.deepEqual(result.unknownTimeAnalysis?.uncertainPillars, ['year', 'month', 'day']);
  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['', '', '', ''],
  );
  assert.equal(result.mingGua, undefined);
  const years = new Set(
    result.unknownTimeAnalysis?.scenarios.map((scenario) => scenario.pillars.year.ganZhi),
  );
  assert.deepEqual([...years].sort(), ['甲辰', '癸卯'].sort());
});

test('明确丑时仍返回唯一完整命盘，不产生缺时辰候选', () => {
  const result = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 1,
    gender: 'male',
  });
  assert.equal(result.isThreePillars, false);
  assert.equal(result.unknownTimeAnalysis, undefined);
  assert.equal(result.pillars.hour.ganZhi, '乙丑');
  assert.ok(result.luckInfo.cycles.length > 0);
});

test('日初交立春不能因早子代表在00:30就误认全年柱已确定', () => {
  // 2013年立春为2月4日00:13:25，位于日初与早子代表时刻之间。
  const result = baziCalculator.calculateBazi({ year: 2013, month: 2, day: 4, gender: 'male' });
  assert.equal(result.pillars.year.ganZhi, '');
  assert.equal(result.pillars.month.ganZhi, '');
  assert.equal(result.unknownTimeAnalysis?.scenarios[0].pillars.year.ganZhi, '壬辰');
  assert.equal(result.unknownTimeAnalysis?.scenarios[1].pillars.year.ganZhi, '癸巳');
});

test('申时内部交立春保留临界前后两个具体时刻而不以申时代表点代替', () => {
  const result = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 4,
    gender: 'female',
  });
  const scenarios = result.unknownTimeAnalysis?.scenarios ?? [];
  const before = scenarios.find(
    (scenario) => scenario.boundary?.name === '立春' && scenario.boundary.side === 'before',
  );
  const at = scenarios.find(
    (scenario) => scenario.boundary?.name === '立春' && scenario.boundary.side === 'at',
  );
  assert.ok(before);
  assert.ok(at);
  assert.equal(before.timeIndex, 8);
  assert.equal(at.timeIndex, 8);
  assert.notEqual(before.inputClockTime, at.inputClockTime);
  assert.notEqual(before.scenarioKey, at.scenarioKey);
  assert.match(before.timeName, /立春临界前一秒\d{2}:\d{2}:\d{2}候选/u);
  assert.match(at.timeName, /立春临界时刻\d{2}:\d{2}:\d{2}候选/u);
  assert.equal(before.pillars.year.ganZhi, '癸卯');
  assert.equal(before.pillars.month.ganZhi, '乙丑');
  assert.equal(at.pillars.year.ganZhi, '甲辰');
  assert.equal(at.pillars.month.ganZhi, '丙寅');
  assert.ok(
    scenarios.some(
      (scenario) =>
        scenario.pillars.year.ganZhi === '甲辰' &&
        scenario.pillars.month.ganZhi === '丙寅' &&
        scenario.pillars.hour.ganZhi === '庚申',
    ),
  );

  for (const scenario of [before, at]) {
    const [hour, minute, second] = scenario.inputClockTime.split(':').map(Number);
    const explicit = baziCalculator.calculateBazi({
      year: 2024,
      month: 2,
      day: 4,
      birthHour: hour,
      birthMinute: minute,
      birthSecond: second,
      gender: 'female',
    });
    assert.deepEqual(scenario.pillars, explicit.pillars);
    assert.equal(scenario.strength, explicit.analysis.dayMasterStrength.status);
    assert.equal(scenario.pattern, explicit.analysis.mingGe.pattern);
    assert.deepEqual(scenario.favorableWuxing, explicit.analysis.usefulGod.favorableWuxing ?? []);
    assert.deepEqual(
      scenario.unfavorableWuxing,
      explicit.analysis.usefulGod.unfavorableWuxing ?? [],
    );
  }
});

test('农历未知时辰先沿用实际历法换算再检查同一公历日的交节边界', () => {
  const solar = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 4,
    gender: 'female',
  });
  const lunar = baziCalculator.calculateBazi({
    year: 2023,
    month: 12,
    day: 25,
    isLunar: true,
    gender: 'female',
  });
  const selectBoundary = (result: typeof solar) =>
    result.unknownTimeAnalysis?.scenarios
      .filter((scenario) => scenario.boundary?.name === '立春')
      .map((scenario) => ({
        inputClockTime: scenario.inputClockTime,
        side: scenario.boundary!.side,
        pillars: scenario.pillars,
      }));
  assert.deepEqual(selectBoundary(lunar), selectBoundary(solar));
});

test('闰月未知时辰沿用实际历法换算且不丢同日节气边界', () => {
  const solar = baziCalculator.calculateBazi({
    year: 2023,
    month: 4,
    day: 5,
    gender: 'female',
  });
  const leapLunar = baziCalculator.calculateBazi({
    year: 2023,
    month: 2,
    day: 15,
    isLunar: true,
    isLeapMonth: true,
    gender: 'female',
  });
  const selectQingming = (result: typeof solar) =>
    result.unknownTimeAnalysis?.scenarios
      .filter((scenario) => scenario.boundary?.name === '清明')
      .map((scenario) => ({
        inputClockTime: scenario.inputClockTime,
        side: scenario.boundary!.side,
        pillars: scenario.pillars,
      }));
  assert.deepEqual(selectQingming(leapLunar), selectQingming(solar));
});

test('月令司权在同一时辰内交接时保留临界前后具体时刻', () => {
  const result = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 11,
    gender: 'female',
  });
  const boundaries =
    result.unknownTimeAnalysis?.scenarios.filter(
      (scenario) => scenario.source === 'month-commander-boundary',
    ) ?? [];
  assert.equal(boundaries.length, 2);
  assert.equal(boundaries[0]?.boundary?.side, 'before');
  assert.equal(boundaries[1]?.boundary?.side, 'at');
  assert.equal(boundaries[0]?.timeIndex, boundaries[1]?.timeIndex);
  assert.notEqual(boundaries[0]?.inputClockTime, boundaries[1]?.inputClockTime);
  for (const scenario of boundaries) {
    const [hour, minute, second] = scenario.inputClockTime.split(':').map(Number);
    const explicit = baziCalculator.calculateBazi({
      year: 2024,
      month: 2,
      day: 11,
      birthHour: hour,
      birthMinute: minute,
      birthSecond: second,
      gender: 'female',
    });
    assert.equal(scenario.strength, explicit.analysis.dayMasterStrength.status);
    assert.equal(scenario.pattern, explicit.analysis.mingGe.pattern);
    assert.deepEqual(scenario.favorableWuxing, explicit.analysis.usefulGod.favorableWuxing ?? []);
  }
});

test('节气整秒舍入早于原始儒略日时分别保留换柱秒与司令生效秒', () => {
  const result = baziCalculator.calculateBazi({
    year: 1900,
    month: 1,
    day: 6,
    gender: 'female',
  });
  const scenarios = result.unknownTimeAnalysis?.scenarios ?? [];
  const pillarBoundary = scenarios.find(
    (scenario) =>
      scenario.source === 'solar-term-boundary' &&
      scenario.boundary?.name === '小寒' &&
      scenario.boundary.side === 'at',
  );
  const commanderBoundary = scenarios.find(
    (scenario) =>
      scenario.source === 'month-commander-boundary' &&
      scenario.boundary?.name === '小寒月令司权起始' &&
      scenario.boundary.side === 'at',
  );
  assert.equal(pillarBoundary?.inputClockTime, '02:03:57');
  assert.equal(commanderBoundary?.inputClockTime, '02:03:58');
  assert.equal(pillarBoundary?.pillars.month.ganZhi, '丁丑');
  assert.equal(commanderBoundary?.pillars.month.ganZhi, '丁丑');
  for (const scenario of [pillarBoundary, commanderBoundary]) {
    assert.ok(scenario);
    const [hour, minute, second] = scenario.inputClockTime.split(':').map(Number);
    const explicit = baziCalculator.calculateBazi({
      year: 1900,
      month: 1,
      day: 6,
      birthHour: hour,
      birthMinute: minute,
      birthSecond: second,
      gender: 'female',
    });
    assert.equal(scenario.pattern, explicit.analysis.mingGe.pattern);
    assert.deepEqual(scenario.favorableWuxing, explicit.analysis.usefulGod.favorableWuxing ?? []);
  }
});

test('非节节气的原始儒略日生效秒不被显示整秒候选覆盖', () => {
  const result = baziCalculator.calculateBazi({
    year: 1924,
    month: 9,
    day: 23,
    gender: 'female',
  });
  const scenarios = result.unknownTimeAnalysis?.scenarios ?? [];
  const displayAt = scenarios.find(
    (scenario) =>
      scenario.source === 'solar-term-boundary' &&
      scenario.boundary?.name === '秋分' &&
      scenario.boundary.side === 'at',
  );
  const rawBefore = scenarios.find(
    (scenario) =>
      scenario.source === 'solar-term-boundary' &&
      scenario.boundary?.name === '秋分原始节气生效' &&
      scenario.boundary.side === 'before',
  );
  const rawAt = scenarios.find(
    (scenario) =>
      scenario.source === 'solar-term-boundary' &&
      scenario.boundary?.name === '秋分原始节气生效' &&
      scenario.boundary.side === 'at',
  );
  assert.equal(displayAt?.inputClockTime, '15:58:13');
  assert.equal(rawBefore?.inputClockTime, '15:58:13');
  assert.equal(rawAt?.inputClockTime, '15:58:14');
  assert.notEqual(displayAt?.scenarioKey, rawBefore?.scenarioKey);
  assert.notEqual(rawBefore?.scenarioKey, rawAt?.scenarioKey);

  const explicitBefore = baziCalculator.calculateBazi({
    year: 1924,
    month: 9,
    day: 23,
    birthHour: 15,
    birthMinute: 58,
    birthSecond: 13,
    gender: 'female',
  });
  const explicitAt = baziCalculator.calculateBazi({
    year: 1924,
    month: 9,
    day: 23,
    birthHour: 15,
    birthMinute: 58,
    birthSecond: 14,
    gender: 'female',
  });
  const hasQiufenRule = (chart: typeof explicitBefore) =>
    chart.analysis.usefulGod.matchedRules?.some(
      (rule) => rule.id === 'you-month-yi-qiufen-gui-no-bing',
    ) ?? false;
  assert.equal(hasQiufenRule(explicitBefore), false);
  assert.equal(hasQiufenRule(explicitAt), true);
  assert.equal(rawBefore?.pattern, explicitBefore.analysis.mingGe.pattern);
  assert.equal(rawAt?.pattern, explicitAt.analysis.mingGe.pattern);
  assert.deepEqual(rawBefore?.favorableWuxing, explicitBefore.analysis.usefulGod.favorableWuxing);
  assert.deepEqual(rawAt?.favorableWuxing, explicitAt.analysis.usefulGod.favorableWuxing);
});

test('未知时辰仍显式拒绝缺少精确钟表时刻的真太阳时，不静默按北京时间候选', () => {
  assert.throws(
    () =>
      baziCalculator.calculateBazi({
        year: 2024,
        month: 2,
        day: 4,
        gender: 'female',
        useTrueSolarTime: true,
        birthLongitude: 116.4,
        timeZoneId: 'Asia/Shanghai',
      }),
    /真太阳时缺少精准时间|补齐出生时分/u,
  );
});

test('标准时未知时辰保留中国历史夏令时资料条件但不擅自校正候选钟表时刻', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    gender: 'female',
    applyChinaDst: true,
  });
  assert.ok(result.warnings.some((warning) => warning.includes('中国夏令时期间')));
  assert.ok(
    result.warningFacts.some(
      (fact) => fact.type === '历史夏令时边界' && fact.promptText.includes('时辰可能需前移'),
    ),
  );
  assert.match(result.warningSummaryFact.promptText, /夏令时|边界预警/u);
  assert.equal(result.unknownTimeAnalysis?.scenarios[0]?.inputClockTime, '00:00:00');
});

test('公开基础排盘入口不返回缺时辰的午时占位资料', () => {
  assert.throws(
    () => baziCalculator.calculateCoreBazi({ year: 2000, month: 1, day: 7, gender: 'male' }),
    /出生时辰未知.*calculateBazi/,
  );
});

test('非法时辰资料不能静默转成缺时辰模式', () => {
  const person = { year: 2000, month: 1, day: 7, gender: 'male' as const };
  for (const timeIndex of [-2, -0.5, 13, Number.NaN, '1', null]) {
    assert.throws(
      () => baziCalculator.calculateBazi({ ...person, timeIndex: timeIndex as number }),
      /无效的时辰索引/,
    );
  }
  assert.throws(
    () =>
      baziCalculator.calculateBazi({ ...person, isThreePillars: 'false' as unknown as boolean }),
    /时辰未知标志必须是布尔值/,
  );
});
