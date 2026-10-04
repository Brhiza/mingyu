import assert from 'node:assert/strict';
import test from 'node:test';
import { BaziAnalyzer } from '../packages/core/src/bazi/baziAnalysis';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { discoverUnknownTimeCandidates } from '../packages/core/src/bazi/baziUnknownTime';
import type { BaziChartResult, Person } from '../packages/core/src/bazi/baziTypes';
import { LuckCalculator } from '../packages/core/src/bazi/LuckCalculator';

function normalizeBatchScopeText(result: BaziChartResult): BaziChartResult {
  const copy = structuredClone(result);
  const summary = copy.unknownTimeAnalysis?.summary;
  if (!summary) return copy;
  const replace = (value: unknown): unknown => {
    if (typeof value === 'string' && value.includes(summary)) {
      return value.replace(summary, '<UNKNOWN_TIME_SCOPE>');
    }
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        (value as Record<string, unknown>)[key] = replace(child);
      }
    }
    return value;
  };
  replace(copy);
  if (copy.unknownTimeAnalysis) delete copy.unknownTimeAnalysis.batch;
  return copy;
}

function compareAllPagesWithLegacy(person: Person): void {
  const full = baziCalculator.calculateBazi(person);
  const expected = full.unknownTimeAnalysis?.scenarios ?? [];
  assert.ok(expected.length >= 15);
  assert.equal(full.unknownTimeAnalysis?.batch, undefined);

  let request: { startIndex: number; contextKey?: string } = { startIndex: 0 };
  const actual = [];
  while (true) {
    const page = baziCalculator.calculateBaziUnknownTimeBatch(person, request);
    const scenario = page.result.unknownTimeAnalysis?.scenarios[0];
    assert.ok(scenario);
    actual.push(scenario);
    assert.equal(page.batch.unit, 'candidate');
    assert.equal(page.batch.startIndex, request.startIndex);
    assert.equal(page.batch.endIndexExclusive, request.startIndex + 1);
    assert.equal(page.batch.totalCandidates, expected.length);
    assert.equal(page.batch.candidateKey, scenario.scenarioKey);
    assert.equal(page.result.unknownTimeAnalysis?.batch, page.batch);
    assert.equal(page.result.unknownTimeAnalysis?.scenarios.length, 1);
    assert.match(
      page.result.unknownTimeAnalysis?.summary ?? '',
      new RegExp(`第 ${request.startIndex + 1}/${expected.length} 个候选`),
    );

    const expectedPage = structuredClone(full);
    expectedPage.unknownTimeAnalysis!.scenarios = [expected[request.startIndex]!];
    assert.deepEqual(normalizeBatchScopeText(page.result), normalizeBatchScopeText(expectedPage));

    if (!page.batch.next) break;
    assert.equal(page.batch.next.startIndex, request.startIndex + 1);
    assert.equal(page.batch.next.contextKey, page.batch.contextKey);
    request = page.batch.next;
  }
  assert.deepEqual(actual, expected);
}

test('未知时辰候选批次穷尽普通日与全部真实历法临界且逐场景等于完整模式', () => {
  const cases: Person[] = [
    { year: 2000, month: 1, day: 7, gender: 'male' },
    { year: 2024, month: 2, day: 4, gender: 'female' },
    { year: 1924, month: 9, day: 23, gender: 'female' },
    { year: 2024, month: 2, day: 11, gender: 'female' },
    {
      year: 2023,
      month: 2,
      day: 15,
      isLunar: true,
      isLeapMonth: true,
      gender: 'female',
    },
    { year: 1990, month: 5, day: 15, gender: 'female', applyChinaDst: true },
  ];
  for (const person of cases) compareAllPagesWithLegacy(person);
});

test('中国历史夏令时未知时辰候选跳过不存在时刻并展开回拨重复时段', () => {
  const summer: Person = {
    year: 1990,
    month: 5,
    day: 15,
    gender: 'female',
    applyChinaDst: true,
  };
  const summerResult = baziCalculator.calculateBazi(summer);
  assert.equal(summerResult.isThreePillars, true);
  assert.ok(!summerResult.unknownTimeAnalysis?.uncertainPillars.includes('day'));
  const lateZi = discoverUnknownTimeCandidates(summer).find(
    ({ point }) => point.source === 'shichen-representative' && point.hour === 23,
  );
  assert.equal(lateZi?.person.birthHour, 22);
  assert.deepEqual(
    baziCalculator.calculateBazi(lateZi!.person).pillars,
    baziCalculator.calculateBazi({
      ...summer,
      birthHour: 23,
      birthMinute: 30,
      birthSecond: 0,
    }).pillars,
  );

  const spring: Person = {
    year: 1988,
    month: 4,
    day: 17,
    gender: 'female',
    applyChinaDst: true,
  };
  const springCandidates = discoverUnknownTimeCandidates(spring);
  assert.ok(springCandidates.every(({ point }) => point.hour !== 2));
  const springAfter = springCandidates.find(
    ({ point }) => point.source === 'dst-boundary' && point.hour === 3,
  );
  assert.ok(springAfter);
  assert.deepEqual(
    [
      springAfter.person.year,
      springAfter.person.month,
      springAfter.person.day,
      springAfter.person.birthHour,
    ],
    [1988, 4, 17, 2],
  );

  const autumn: Person = {
    year: 1988,
    month: 9,
    day: 11,
    gender: 'female',
    applyChinaDst: true,
  };
  const autumnCandidates = discoverUnknownTimeCandidates(autumn);
  const repeated = autumnCandidates.filter(
    ({ point }) => point.source === 'dst-boundary' && point.hour === 1 && point.minute === 0,
  );
  assert.deepEqual(
    repeated.map(({ point }) => point.dstInterpretation),
    ['daylight', 'standard'],
  );
  assert.deepEqual(
    repeated.map(({ person }) => person.birthHour),
    [0, 1],
  );
  assert.notEqual(repeated[0]?.scenarioKey, repeated[1]?.scenarioKey);

  for (const [person, candidates] of [
    [spring, springCandidates],
    [autumn, autumnCandidates],
  ] as const) {
    const full = baziCalculator.calculateBazi(person);
    assert.equal(full.isThreePillars, true);
    for (const index of candidates.flatMap((candidate, index) =>
      candidate.point.source === 'dst-boundary' ? [index] : [],
    )) {
      const page = baziCalculator.calculateBaziUnknownTimeBatch(person, { startIndex: index });
      assert.deepEqual(
        page.result.unknownTimeAnalysis?.scenarios[0],
        full.unknownTimeAnalysis?.scenarios[index],
      );
      assert.deepEqual(
        page.result.unknownTimeAnalysis?.uncertainPillars,
        full.unknownTimeAnalysis?.uncertainPillars,
      );
    }
  }
});

test('夏令时跨标准日期的分页仍标明全日历日待定，并保留当前候选的实际历日', () => {
  const person: Person = {
    year: 1988,
    month: 5,
    day: 1,
    gender: 'female',
    applyChinaDst: true,
  };
  const full = baziCalculator.calculateBazi(person);
  const scenarios = full.unknownTimeAnalysis?.scenarios ?? [];
  for (const index of [
    scenarios.findIndex((scenario) => scenario.source === 'day-start'),
    scenarios.findIndex((scenario) => scenario.inputClockTime === '12:00:00'),
  ]) {
    assert.ok(index >= 0);
    const page = baziCalculator.calculateBaziUnknownTimeBatch(person, { startIndex: index });
    assert.deepEqual(page.result.unknownTimeAnalysis?.uncertainCalendarDates, ['solar', 'lunar']);
    assert.deepEqual(page.result.unknownTimeAnalysis?.scenarios, [scenarios[index]]);
    assert.deepEqual(page.result.solarDate, full.solarDate);
    assert.deepEqual(page.result.lunarDate, full.lunarDate);
  }
});

test('重复民用日的未知时辰先选有效占位，保留两个偏移的午时候选与分页身份', () => {
  const person: Person = {
    year: 1969,
    month: 9,
    day: 30,
    gender: 'female',
    timeZoneId: 'Pacific/Kwajalein',
  };
  const full = baziCalculator.calculateBazi(person);
  const scenarios = full.unknownTimeAnalysis?.scenarios ?? [];
  const noon = scenarios.flatMap((scenario, index) =>
    scenario.inputClockTime === '12:00:00' && scenario.source === 'shichen-representative'
      ? [{ scenario, index }]
      : [],
  );
  assert.equal(noon.length, 2);
  assert.deepEqual(
    noon.map(({ scenario }) => scenario.timeName),
    ['午时候选（UTC+11）', '午时候选（UTC-12）'],
  );
  assert.notEqual(noon[0]!.scenario.scenarioKey, noon[1]!.scenario.scenarioKey);
  assert.ok(full.unknownTimeAnalysis?.uncertainPillars.includes('day'));
  assert.equal(full.pillars.day.ganZhi, '');

  for (const { scenario, index } of noon) {
    const timezone = scenario.timeName.includes('UTC+11') ? 11 : -12;
    const explicit = baziCalculator.calculateBazi({
      ...person,
      timezone,
      birthHour: 12,
      birthMinute: 0,
      birthSecond: 0,
    });
    assert.deepEqual(scenario.pillars, explicit.pillars);
    const page = baziCalculator.calculateBaziUnknownTimeBatch(person, { startIndex: index });
    assert.deepEqual(page.result.unknownTimeAnalysis?.scenarios, [scenario]);
    assert.equal(page.batch.candidateKey, scenario.scenarioKey);
    assert.equal(page.result.pillars.day.ganZhi, '');
  }
  assert.throws(
    () =>
      baziCalculator.calculateBazi({
        year: 2011,
        month: 12,
        day: 30,
        gender: 'female',
        timeZoneId: 'Pacific/Apia',
      }),
    /没有有效的出生钟表时刻/,
  );
  assert.throws(
    () =>
      baziCalculator.calculateBaziUnknownTimeBatch(
        {
          year: 2011,
          month: 12,
          day: 30,
          gender: 'female',
          timeZoneId: 'Pacific/Apia',
        },
        { startIndex: 0 },
      ),
    /没有有效的出生钟表时刻/,
  );
});

test('未知时辰候选页仅展开当前候选一次本命分析且不生成完整命限', () => {
  const originalFull = LuckCalculator.prototype.calculateLuckInfo;
  const originalNatal = LuckCalculator.prototype.calculateNatalLuckInfo;
  const originalFortuneBatch = LuckCalculator.prototype.calculateLuckInfoBatch;
  const originalAnalyze = BaziAnalyzer.prototype.analyzeBaziChart;
  let fullCalls = 0;
  let natalCalls = 0;
  let fortuneBatchCalls = 0;
  let analysisCalls = 0;
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
  LuckCalculator.prototype.calculateLuckInfoBatch = function (
    ...args: Parameters<typeof originalFortuneBatch>
  ) {
    fortuneBatchCalls += 1;
    return originalFortuneBatch.apply(this, args);
  };
  BaziAnalyzer.prototype.analyzeBaziChart = function (...args: Parameters<typeof originalAnalyze>) {
    analysisCalls += 1;
    return originalAnalyze.apply(this, args);
  };
  try {
    const page = baziCalculator.calculateBaziUnknownTimeBatch(
      { year: 2024, month: 2, day: 4, gender: 'female' },
      { startIndex: 15 },
    );
    assert.equal(page.result.unknownTimeAnalysis?.scenarios.length, 1);
  } finally {
    LuckCalculator.prototype.calculateLuckInfo = originalFull;
    LuckCalculator.prototype.calculateNatalLuckInfo = originalNatal;
    LuckCalculator.prototype.calculateLuckInfoBatch = originalFortuneBatch;
    BaziAnalyzer.prototype.analyzeBaziChart = originalAnalyze;
  }
  assert.equal(fullCalls, 0);
  assert.equal(fortuneBatchCalls, 0);
  assert.equal(natalCalls, 1);
  assert.equal(analysisCalls, 1);
});

test('未知时辰候选上下文键规范化日期、默认时区与未知输入别名', () => {
  const base: Person = { year: 2024, month: 2, day: 4, gender: 'female', timeIndex: -1 };
  const http = baziCalculator.calculateBaziUnknownTimeBatch(base, { startIndex: 0 });
  const mcp = baziCalculator.calculateBaziUnknownTimeBatch(
    { ...base, timeIndex: 6, isThreePillars: true },
    { startIndex: 0 },
  );
  const explicitDefault = baziCalculator.calculateBaziUnknownTimeBatch(
    { ...base, timezone: 8 },
    { startIndex: 0 },
  );
  const lunar = baziCalculator.calculateBaziUnknownTimeBatch(
    { year: 2023, month: 12, day: 25, isLunar: true, gender: 'female' },
    { startIndex: 0 },
  );
  assert.equal(http.batch.contextKey, mcp.batch.contextKey);
  assert.equal(http.batch.contextKey, explicitDefault.batch.contextKey);
  assert.equal(http.batch.contextKey, lunar.batch.contextKey);

  const anotherTimezone = baziCalculator.calculateBaziUnknownTimeBatch(
    { ...base, timezone: 9 },
    { startIndex: 0 },
  );
  const zoneId = baziCalculator.calculateBaziUnknownTimeBatch(
    { ...base, timeZoneId: ' Asia/Shanghai ' },
    { startIndex: 0 },
  );
  const normalizedZoneId = baziCalculator.calculateBaziUnknownTimeBatch(
    { ...base, timeZoneId: 'Asia/Shanghai' },
    { startIndex: 0 },
  );
  const anotherAge = baziCalculator.calculateBaziUnknownTimeBatch(
    { ...base, age: 31 },
    { startIndex: 0 },
  );
  assert.notEqual(http.batch.contextKey, anotherTimezone.batch.contextKey);
  assert.notEqual(http.batch.contextKey, zoneId.batch.contextKey);
  assert.equal(zoneId.batch.contextKey, normalizedZoneId.batch.contextKey);
  assert.notEqual(http.batch.contextKey, anotherAge.batch.contextKey);
});

test('未知时辰候选批次以 RangeError 拒绝非法游标和不匹配上下文', () => {
  const person: Person = { year: 2000, month: 1, day: 7, gender: 'male' };
  const first = baziCalculator.calculateBaziUnknownTimeBatch(person, { startIndex: 0 });
  for (const startIndex of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, first.batch.totalCandidates]) {
    assert.throws(
      () => baziCalculator.calculateBaziUnknownTimeBatch(person, { startIndex }),
      RangeError,
    );
  }
  assert.throws(
    () =>
      baziCalculator.calculateBaziUnknownTimeBatch(person, {
        startIndex: 1,
        contextKey: `${first.batch.contextKey}-changed`,
      }),
    RangeError,
  );
  assert.throws(
    () =>
      baziCalculator.calculateBaziUnknownTimeBatch({ ...person, timeIndex: 6 }, { startIndex: 0 }),
    RangeError,
  );
  assert.throws(
    () =>
      baziCalculator.calculateBaziUnknownTimeBatch(
        {
          ...person,
          timeIndex: -1,
          isThreePillars: true,
          birthHour: 12,
          birthMinute: 0,
          birthSecond: 0,
        },
        { startIndex: 0 },
      ),
    RangeError,
  );
  assert.throws(
    () =>
      baziCalculator.calculateBaziUnknownTimeBatch(
        {
          ...person,
          isThreePillars: true,
          useTrueSolarTime: true,
          birthHour: 12,
          birthMinute: 0,
          birthLongitude: 116.4,
        },
        { startIndex: 0 },
      ),
    RangeError,
  );
});
