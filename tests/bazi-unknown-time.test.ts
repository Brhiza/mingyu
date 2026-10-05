import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { LuckCalculator } from '../packages/core/src/bazi/LuckCalculator';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { analyzeBaziCompatibility } from '../packages/core/src/bazi/compatibilityEvidence';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
} from '../packages/core/src/name-number/index';
import { buildBaziPrompt } from '../packages/core/src/prompt/bazi';
import { formatBaziSchoolPrompt } from '../packages/core/src/prompt/bazi-school';
import { MingluPatternUsefulGodSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPatternUsefulGodSection';

const EXPLICIT_CHOU_CHART = baziCalculator.calculateBazi({
  year: 2000,
  month: 1,
  day: 7,
  timeIndex: 1,
  gender: 'male',
});
const UNKNOWN_LICHUN_CHART = baziCalculator.calculateBazi({
  year: 2024,
  month: 2,
  day: 4,
  gender: 'female',
});

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
  assert.deepEqual(result.unknownTimeAnalysis?.uncertainCalendarDates, []);
  const chou = result.unknownTimeAnalysis?.scenarios.find((scenario) => scenario.timeIndex === 1);
  assert.equal(chou?.pillars.hour.ganZhi, '乙丑');
  const explicit = structuredClone(EXPLICIT_CHOU_CHART);
  assert.equal(chou?.strength, explicit.analysis.dayMasterStrength.status);
  assert.deepEqual(chou?.favorableWuxing, explicit.analysis.usefulGod.favorableWuxing);
  assert.equal(result.evidenceAnalysis?.status, '存在资料缺口');
  assert.ok(result.evidenceAnalysis?.analysisFacts.every((fact) => fact.status === '资料缺口'));
  assert.doesNotMatch(result.evidenceAnalysis?.calculationChain.join('\n') ?? '', /明确选择的.*午/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /时辰未知/);
  assert.match(prompt, /【已确定的柱】\n年柱：己卯\n月柱：丁丑/u);
  assert.doesNotMatch(prompt, /^日柱：/mu);
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
  const result = structuredClone(UNKNOWN_LICHUN_CHART);
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
  const prompt = formatBaziForPrompt(result);
  assert.doesNotMatch(prompt, /【已确定的柱】|^(?:年|月|日)柱：/mu);
  assert.match(prompt, /【待补时判断】/u);
  assert.equal(prompt.match(/候选喜用/g)?.length, result.unknownTimeAnalysis?.scenarios.length);
});

test('未知时辰同名格局的成格与破格按各候选实际盘分别呈现', () => {
  const input = { year: 2024, month: 2, day: 4, gender: 'male' as const };
  const result = baziCalculator.calculateBazi(input);
  const scenarios = result.unknownTimeAnalysis?.scenarios ?? [];
  const undecidedIndex = scenarios.findIndex((item) => item.inputClockTime === '00:30:00');
  const formedIndex = scenarios.findIndex((item) => item.inputClockTime === '10:00:00');
  const brokenIndex = scenarios.findIndex((item) => item.inputClockTime === '16:00:00');
  assert.ok(undecidedIndex >= 0 && formedIndex >= 0 && brokenIndex >= 0);
  assert.deepEqual(
    [scenarios[formedIndex]?.pillars.hour.ganZhi, scenarios[brokenIndex]?.pillars.hour.ganZhi],
    ['丁巳', '庚申'],
  );
  assert.deepEqual(
    [scenarios[formedIndex]?.pattern, scenarios[brokenIndex]?.pattern],
    ['劫财格', '劫财格'],
  );
  assert.deepEqual(
    [
      scenarios[undecidedIndex]?.patternStatus,
      scenarios[formedIndex]?.patternStatus,
      scenarios[brokenIndex]?.patternStatus,
    ],
    ['未判定', '成格', '破格'],
  );
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /早子时候选：癸卯 乙丑 戊戌 壬子；[^\n]*劫财格（未判定）/u);
  assert.match(prompt, /巳时候选：癸卯 乙丑 戊戌 丁巳；[^\n]*劫财格（成格）/u);
  assert.match(prompt, /申时候选：癸卯 乙丑 戊戌 庚申；[^\n]*劫财格（破格）/u);
  const fullTaskbook = buildBaziPrompt({ result, school: 'ziping' });
  const standaloneSchoolFacts = formatBaziSchoolPrompt(result, 'ziping');
  assert.match(fullTaskbook, /巳时候选：[^\n]*劫财格（成格）/u);
  assert.match(fullTaskbook, /申时候选：[^\n]*劫财格（破格）/u);
  assert.match(standaloneSchoolFacts, /巳时候选：[^\n]*格局劫财格（成格）/u);
  assert.match(standaloneSchoolFacts, /申时候选：[^\n]*格局劫财格（破格）/u);

  const html = renderToStaticMarkup(
    createElement(MingluPatternUsefulGodSection, {
      data: buildEnhancedPatternUsefulGodSection(result),
    }),
  );
  const candidateRows = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/gsu)].map((match) =>
    (match[1] ?? '')
      .replace(/<!--.*?-->|<[^>]+>/gu, '')
      .replace(/\s+/gu, ' ')
      .trim(),
  );
  const patternBlock =
    html.match(/id="bazi-pattern-detail"(.*?)id="bazi-useful-god-detail"/su)?.[1] ?? '';
  assert.equal(patternBlock.split(result.unknownTimeAnalysis!.summary).length - 1, 1);
  const siRow = candidateRows.find((row) => row.startsWith('巳时候选：'));
  const shenRow = candidateRows.find((row) => row.startsWith('申时候选：'));
  assert.ok(siRow);
  assert.ok(shenRow);
  assert.match(siRow, /癸卯 乙丑 戊戌 丁巳；[^\n]*格局劫财格（成格）/u);
  assert.match(shenRow, /癸卯 乙丑 戊戌 庚申；[^\n]*格局劫财格（破格）/u);

  const name = analyzeChineseName({
    fullName: '李明',
    birth: {
      ...input,
      timeIndex: '',
      dateType: 'solar',
      isThreePillars: true,
    },
  });
  const namingPrompt = buildChineseNameAnalysisPrompt({ analysis: name });
  assert.match(namingPrompt, /候选巳时候选：癸卯 乙丑 戊戌 丁巳；[^\n]*格局劫财格（成格）/u);
  assert.match(namingPrompt, /候选申时候选：癸卯 乙丑 戊戌 庚申；[^\n]*格局劫财格（破格）/u);

  const legacyResult = structuredClone(result);
  for (const scenario of legacyResult.unknownTimeAnalysis?.scenarios ?? []) {
    delete scenario.patternStatus;
  }
  assert.match(formatBaziForPrompt(legacyResult), /巳时候选：[^\n]*劫财格；候选喜用/u);
  assert.match(formatBaziSchoolPrompt(legacyResult, 'ziping'), /巳时候选：[^\n]*格局劫财格；喜用/u);

  for (const [index, status] of [
    [undecidedIndex, '未判定'],
    [formedIndex, '成格'],
    [brokenIndex, '破格'],
  ] as const) {
    const page = baziCalculator.calculateBaziUnknownTimeBatch(input, { startIndex: index });
    assert.equal(page.result.unknownTimeAnalysis?.scenarios[0]?.patternStatus, status);
    assert.match(formatBaziForPrompt(page.result), new RegExp(`劫财格（${status}）`, 'u'));
  }
});

test('未知时辰按候选保留冬癸取用的部分判定与所忌，已判定候选保持独立', () => {
  const input = { year: 1904, month: 1, day: 20, gender: 'male' as const };
  const result = baziCalculator.calculateBazi(input);
  const scenarios = result.unknownTimeAnalysis!.scenarios;
  const texts = [
    formatBaziForPrompt(result),
    buildBaziPrompt({ result }),
    ...(['ziping', 'mangpai', 'xinpai'] as const).map((school) =>
      formatBaziSchoolPrompt(result, school),
    ),
  ];
  const html = renderToStaticMarkup(
    createElement(MingluPatternUsefulGodSection, {
      data: buildEnhancedPatternUsefulGodSection(result),
    }),
  );
  const rows = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/gsu)].map((match) =>
    match[1]
      .replace(/<!--.*?-->|<[^>]+>/gu, '')
      .replace(/\s+/gu, ' ')
      .trim(),
  );
  const expected = [
    {
      name: '早子时候选',
      hour: '壬子',
      status: '部分判定',
      favorable: ['金', '水'],
      unfavorable: ['木', '土'],
    },
    { name: '酉时候选', hour: '辛酉', status: '部分判定', favorable: [], unfavorable: [] },
    {
      name: '寅时候选',
      hour: '甲寅',
      status: '已判定',
      favorable: ['金', '水'],
      unfavorable: ['木', '火', '土'],
    },
  ];
  for (const item of expected) {
    const scenario = scenarios.find((candidate) => candidate.timeName === item.name)!;
    assert.deepEqual(
      Object.values(scenario.pillars).map((pillar) => pillar.ganZhi),
      ['癸卯', '乙丑', '癸丑', item.hour],
    );
    assert.equal(scenario.incrementStatus, item.status);
    assert.deepEqual(scenario.favorableWuxing, item.favorable);
    assert.deepEqual(scenario.unfavorableWuxing, item.unfavorable);
    const candidateRows = texts.map((text) =>
      text.split('\n').find((line) => line.startsWith(`${item.name}：`)),
    );
    candidateRows.push(rows.find((row) => row.startsWith(`${item.name}：`)));
    for (const row of candidateRows) {
      assert.ok(row);
      assert.ok(row.includes(`癸卯 乙丑 癸丑 ${item.hour}；`));
      assert.equal(row.split('增补取用部分判定').length - 1, item.status === '部分判定' ? 1 : 0);
      if (item.unfavorable.length) assert.ok(row.includes(`所忌${item.unfavorable.join('、')}`));
    }
  }
  const roosterIndex = scenarios.findIndex((scenario) => scenario.timeName === '酉时候选');
  const page = baziCalculator.calculateBaziUnknownTimeBatch(input, { startIndex: roosterIndex });
  assert.deepEqual(page.result.unknownTimeAnalysis?.scenarios, [scenarios[roosterIndex]]);
  assert.match(
    formatBaziForPrompt(page.result),
    /^酉时候选：癸卯 乙丑 癸丑 辛酉；.*候选喜用待判，候选所忌待判；增补取用部分判定$/mu,
  );
  assert.match(
    formatBaziSchoolPrompt(page.result, 'ziping'),
    /^酉时候选：癸卯 乙丑 癸丑 辛酉；.*；增补取用部分判定$/mu,
  );
});

test('夏令时日初跨标准日期时农历历日随候选保留，不把午时占位日写成所有候选事实', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 5,
    day: 1,
    gender: 'female',
    applyChinaDst: true,
  });
  assert.deepEqual(result.solarDate, { year: 1988, month: 5, day: 1 });
  assert.equal(result.lunarDate.dayName, '十六');
  assert.deepEqual(result.unknownTimeAnalysis?.uncertainCalendarDates, ['solar', 'lunar']);
  const scenarios = result.unknownTimeAnalysis?.scenarios ?? [];
  const dayStart = scenarios.find((scenario) => scenario.source === 'day-start');
  const noon = scenarios.find((scenario) => scenario.inputClockTime === '12:00:00');
  assert.ok(dayStart);
  assert.ok(noon);
  assert.deepEqual(dayStart.solarDate, { year: 1988, month: 4, day: 30 });
  assert.equal(dayStart.lunarDate?.dayName, '十五');
  assert.deepEqual(noon.solarDate, { year: 1988, month: 5, day: 1 });
  assert.equal(noon.lunarDate?.dayName, '十六');
  assert.deepEqual(result.unknownTimeAnalysis?.uncertainPillars, []);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /输入日期对应公历1988年5月1日，参考农历1988年三月十六/u);
  assert.match(prompt, /日初00:00:00候选：排盘历日公历1988年4月30日、农历1988年三月十五/u);
  assert.doesNotMatch(prompt, /午时候选：排盘历日/u);
});

test('明确丑时仍返回唯一完整命盘，不产生缺时辰候选', () => {
  const result = structuredClone(EXPLICIT_CHOU_CHART);
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
  const result = structuredClone(UNKNOWN_LICHUN_CHART);
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

test('外地未知时辰按当地钟表时间列出立春临界候选', () => {
  for (const location of [
    { timezone: -5 },
    { timeZoneId: 'America/New_York' },
    { timezone: -5, timeZoneId: 'America/New_York' },
  ]) {
    const result = baziCalculator.calculateBazi({
      year: 2024,
      month: 2,
      day: 4,
      gender: 'female',
      ...location,
    });
    const scenarios = result.unknownTimeAnalysis?.scenarios ?? [];
    const before = scenarios.find(
      (scenario) => scenario.boundary?.name === '立春' && scenario.boundary.side === 'before',
    );
    const at = scenarios.find(
      (scenario) => scenario.boundary?.name === '立春' && scenario.boundary.side === 'at',
    );
    assert.equal(before?.inputClockTime, '03:27:06');
    assert.equal(at?.inputClockTime, '03:27:07');
    assert.equal(before?.pillars.year.ganZhi, '癸卯');
    assert.equal(before?.pillars.month.ganZhi, '乙丑');
    assert.equal(at?.pillars.year.ganZhi, '甲辰');
    assert.equal(at?.pillars.month.ganZhi, '丙寅');
    for (const scenario of [before, at]) {
      assert.ok(scenario);
      const [hour, minute, second] = scenario.inputClockTime.split(':').map(Number);
      const explicit = baziCalculator.calculateBazi({
        year: 2024,
        month: 2,
        day: 4,
        birthHour: hour,
        birthMinute: minute,
        birthSecond: second,
        gender: 'female',
        ...location,
      });
      assert.deepEqual(scenario.pillars, explicit.pillars);
    }
  }
  assert.throws(
    () =>
      baziCalculator.calculateBazi({
        year: 2024,
        month: 2,
        day: 4,
        gender: 'female',
        timezone: -4,
        timeZoneId: 'America/New_York',
      }),
    /历史偏移不一致/,
  );
});

test('IANA 跳时日未知时辰保留真实存在的丑时候选', () => {
  const input = {
    year: 2024,
    month: 3,
    day: 10,
    gender: 'female' as const,
    timeZoneId: 'America/New_York',
  };
  const result = baziCalculator.calculateBazi(input);
  const scenarios = result.unknownTimeAnalysis?.scenarios ?? [];
  const chou = scenarios.find((scenario) => scenario.timeName.includes('丑时'));
  assert.ok(chou);
  assert.equal(chou.inputClockTime, '01:30:00');
  assert.ok(!scenarios.some((scenario) => scenario.inputClockTime.startsWith('02:')));
  const explicit = baziCalculator.calculateBazi({
    ...input,
    birthHour: 1,
    birthMinute: 30,
    birthSecond: 0,
  });
  assert.deepEqual(chou.pillars, explicit.pillars);
  assert.equal(chou.timeIndex, explicit.timeInfo.index);
  const batch = baziCalculator.calculateBaziUnknownTimeBatch(input, {
    startIndex: scenarios.indexOf(chou),
  });
  assert.deepEqual(batch.result.unknownTimeAnalysis?.scenarios[0]?.pillars, explicit.pillars);
});

test('未知时辰在 IANA 跳时和回拨日按给定历史偏移保留有效时辰', () => {
  for (const { month, day, timezone, clock } of [
    { month: 3, day: 10, timezone: -5, clock: '01:30:00' },
    { month: 11, day: 3, timezone: -4, clock: '01:30:00' },
  ]) {
    const input = {
      year: 2024,
      month,
      day,
      gender: 'female' as const,
      timeZoneId: 'America/New_York',
      timezone,
    };
    const full = baziCalculator.calculateBazi(input);
    const scenarios = full.unknownTimeAnalysis?.scenarios ?? [];
    const index = scenarios.findIndex((scenario) => scenario.inputClockTime === clock);
    assert.ok(index >= 0, `${month}-${day} UTC${timezone} 应保留有效的丑时`);
    const scenario = scenarios[index]!;
    assert.match(scenario.timeName, /丑时/);
    const explicit = baziCalculator.calculateBazi({
      ...input,
      birthHour: 1,
      birthMinute: 30,
      birthSecond: 0,
    });
    assert.deepEqual(scenario.pillars, explicit.pillars);
    const page = baziCalculator.calculateBaziUnknownTimeBatch(input, { startIndex: index });
    assert.deepEqual(page.result.unknownTimeAnalysis?.scenarios[0], scenario);
    assert.equal(page.batch.totalCandidates, scenarios.length);
    for (const key of ['year', 'month', 'day'] as const) {
      if (full.unknownTimeAnalysis?.uncertainPillars.includes(key)) continue;
      assert.deepEqual(full.pillars[key], explicit.pillars[key]);
      assert.deepEqual(page.result.pillars[key], explicit.pillars[key]);
      assert.deepEqual(page.result.hiddenStems[key], full.hiddenStems[key]);
    }
  }
});

test('回拨日固定偏移仅覆盖交节前时段时不把正午占位月柱当成候选', () => {
  const input = {
    year: 2026,
    month: 4,
    day: 5,
    gender: 'female' as const,
    timeZoneId: 'Pacific/Auckland',
    timezone: 13,
  };
  const full = baziCalculator.calculateBazi(input);
  const scenarios = full.unknownTimeAnalysis?.scenarios ?? [];
  const midnight = baziCalculator.calculateBazi({
    ...input,
    birthHour: 0,
    birthMinute: 0,
    birthSecond: 0,
  });
  const noon = baziCalculator.calculateBazi({
    ...input,
    timezone: 12,
    birthHour: 12,
    birthMinute: 0,
    birthSecond: 0,
  });
  assert.notEqual(midnight.pillars.month.ganZhi, noon.pillars.month.ganZhi);
  assert.ok(scenarios.length > 0);
  assert.ok(
    scenarios.every((scenario) => scenario.pillars.month.ganZhi === midnight.pillars.month.ganZhi),
  );
  assert.deepEqual(full.unknownTimeAnalysis?.uncertainPillars, []);
  assert.deepEqual(full.pillars.month, midnight.pillars.month);
  assert.deepEqual(full.hiddenStems.month, midnight.hiddenStems.month);
  let cursor: { startIndex: number; contextKey?: string } = { startIndex: 0 };
  for (const scenario of scenarios) {
    const page = baziCalculator.calculateBaziUnknownTimeBatch(input, cursor);
    assert.deepEqual(page.result.unknownTimeAnalysis?.scenarios[0], scenario);
    assert.deepEqual(page.result.unknownTimeAnalysis?.uncertainPillars, []);
    assert.deepEqual(page.result.pillars.month, midnight.pillars.month);
    assert.deepEqual(page.result.hiddenStems.month, midnight.hiddenStems.month);
    if (page.batch.next) cursor = page.batch.next;
  }
});

test('农历未知时辰先沿用实际历法换算再检查同一公历日的交节边界', () => {
  const solar = structuredClone(UNKNOWN_LICHUN_CHART);
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
