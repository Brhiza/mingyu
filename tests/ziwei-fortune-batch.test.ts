import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildZiweiChartInput,
  calculateZiweiChart,
  formatZiweiFortuneTimeline,
  type ZiweiFortuneRangeScope,
  type ZiweiFortuneTimeline,
} from 'mingyu-core/ziwei';
import { buildPublicZiweiPromptForRuntime } from 'mingyu-core/prompt/public-api';
import { buildThematicConsultationPrompt, buildZiweiPrompt } from 'mingyu-core/prompt';

const input = buildZiweiChartInput({
  name: '运限分页样本',
  gender: 'female',
  dateType: 'solar',
  year: '1992',
  month: '8',
  day: '21',
  timeIndex: 4,
  isLeapMonth: false,
  algorithm: 'default',
});

const currentContext = {
  dateStr: '2026-08-06',
  hourIndex: 4,
} as const;

const boundaryContext = {
  dateStr: '2026-02-10',
  hourIndex: 4,
} as const;

type TestHoroscopeContext = {
  dateStr: string;
  hourIndex: number;
};

type TimelineRows = Array<{
  period: Pick<
    ZiweiFortuneTimeline['periods'][number],
    'label' | 'startAge' | 'endAge' | 'dateStr' | 'endDateStr' | 'layer'
  >;
  year: ZiweiFortuneTimeline['periods'][number]['years'][number];
}>;

const runtimeCache = new Map<string, Promise<ZiweiFortuneTimeline>>();

function loadTimeline(
  chartInput: typeof input,
  scope: ZiweiFortuneRangeScope,
  context: TestHoroscopeContext,
  batch?: { startIndex?: number; limit?: number },
) {
  const options = {
    scopes: ['origin' as const],
    skipAnalysis: true,
    horoscopeContext: context,
    fortuneRange: {
      scope,
      ...context,
      ...(batch ? { batch } : {}),
    },
  };
  const key = JSON.stringify([chartInput, options]);
  const cached = runtimeCache.get(key);
  if (cached) return cached;
  const promise = calculateZiweiChart(chartInput, options).then((runtime) => {
    if (!runtime.fortuneTimeline) throw new Error('测试未生成紫微运限时间线。');
    return runtime.fortuneTimeline;
  });
  runtimeCache.set(key, promise);
  return promise;
}

function collectRows(timeline: ZiweiFortuneTimeline): TimelineRows {
  return timeline.periods.flatMap((period) =>
    period.years.map((year) => ({
      period: {
        label: period.label,
        startAge: period.startAge,
        endAge: period.endAge,
        dateStr: period.dateStr,
        endDateStr: period.endDateStr,
        layer: period.layer,
      },
      year,
    })),
  );
}

function assertRowsEqual(actual: TimelineRows, expected: TimelineRows, message: string) {
  assert.equal(actual.length, expected.length, message);
  for (const [index, row] of actual.entries()) {
    assert.deepEqual(row, expected[index], `${message}：第${index + 1}个年龄年`);
  }
}

test('紫微独立批次只计算一个资料 scope 或一个年龄年', async () => {
  const originBatch = await calculateZiweiChart(input, {
    scopes: ['origin'],
    horoscopeContext: currentContext,
    independentBatch: 'scope',
  });
  const scopeBatch = await calculateZiweiChart(input, {
    scopes: ['yearly'],
    horoscopeContext: currentContext,
    independentBatch: 'scope',
  });
  assert.deepEqual(Object.keys(scopeBatch.payloadByScope), ['yearly']);
  assert.equal(scopeBatch.payloadByScope.origin, undefined);
  assert.equal(scopeBatch.fortuneTimeline, undefined);
  assert.deepEqual(scopeBatch.decadalTimeline, []);

  const fortuneBatch = await calculateZiweiChart(input, {
    scopes: [],
    horoscopeContext: currentContext,
    independentBatch: 'fortune',
    fortuneRange: {
      scope: 'all',
      ...currentContext,
      batch: { startIndex: 0, limit: 1 },
    },
  });
  assert.deepEqual(fortuneBatch.payloadByScope, {});
  assert.equal(fortuneBatch.natalSnapshot?.kind, 'natal-facts');
  assert.equal(fortuneBatch.natalSnapshot?.palaces.length, 12);
  assert.ok(
    fortuneBatch.natalSnapshot?.palaces.every(
      (palace) =>
        palace.scope_stars.length === 0 &&
        palace.scope_hits.length === 0 &&
        palace.dynamic_scope_name === undefined &&
        palace.yearly_jiangqian12 === undefined &&
        palace.yearly_suiqian12 === undefined,
    ),
  );
  assert.ok(
    fortuneBatch.natalSnapshot?.palaces.some(
      (palace) =>
        palace.major_stars.length + palace.minor_stars.length + palace.other_stars.length > 0,
    ),
  );
  const staticStars = (palace: (typeof originBatch.payloadByScope.origin.palaces)[number]) =>
    [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars].map(
      ({ name, kind, scope, brightness, birth_mutagen }) => ({
        name,
        kind,
        scope,
        brightness,
        birth_mutagen,
      }),
    );
  assert.deepEqual(
    fortuneBatch.natalSnapshot?.palaces.map(staticStars),
    originBatch.payloadByScope.origin.palaces.map(staticStars),
  );
  assert.equal(fortuneBatch.fortuneTimeline?.batch?.endIndexExclusive, 1);
  assert.equal(fortuneBatch.fortuneTimeline?.periods.flatMap((period) => period.years).length, 1);
  assert.ok(
    fortuneBatch.fortuneTimeline?.periods.every(
      (period) => period.source === 'iztro-horoscope' && Boolean(period.endDateStr),
    ),
  );
});

test('紫微年龄年独立批次在生日分界下保留已验证精确边界', async () => {
  const chartInput = {
    ...input,
    horoscopeDivide: 'exact' as const,
    yearDivide: 'exact' as const,
    ageDivide: 'birthday' as const,
  };
  const full = await loadTimeline(chartInput, 'current', boundaryContext);
  const pageRuntime = await calculateZiweiChart(chartInput, {
    scopes: [],
    horoscopeContext: boundaryContext,
    independentBatch: 'fortune',
    fortuneRange: {
      scope: 'current',
      ...boundaryContext,
      batch: { startIndex: 0, limit: 1 },
    },
  });
  const page = pageRuntime.fortuneTimeline!;
  const pageRows = collectRows(page);
  const selectedAge = pageRows[0]?.year.age;
  assertRowsEqual(
    pageRows,
    collectRows(full).filter(({ year }) => year.age === selectedAge),
    '生日分界独立批次',
  );
  assert.equal(page.periods[0]?.source, 'iztro-horoscope');
  assert.ok(page.periods[0]?.dateStr);
  assert.ok(page.periods[0]?.endDateStr);
});

test('紫微年龄年独立批次限制单年且按运限目标时点选择当前阶段', async () => {
  await assert.rejects(
    calculateZiweiChart(input, {
      scopes: [],
      horoscopeContext: currentContext,
      independentBatch: 'fortune',
      fortuneRange: {
        scope: 'all',
        ...currentContext,
        batch: { startIndex: 0, limit: 2 },
      },
    }),
    /每次只能计算一个年龄年/,
  );

  const legacyBatch = await calculateZiweiChart(input, {
    scopes: ['origin'],
    horoscopeContext: currentContext,
    fortuneRange: {
      scope: 'all',
      ...currentContext,
      batch: { startIndex: 0, limit: 2 },
    },
  });
  assert.equal(legacyBatch.fortuneTimeline?.batch?.endIndexExclusive, 2);
  assert.equal(legacyBatch.fortuneTimeline?.periods.flatMap((period) => period.years).length, 2);

  const targetContext = { dateStr: '2046-08-06', hourIndex: 4 } as const;
  const targetBatch = await calculateZiweiChart(input, {
    scopes: [],
    horoscopeContext: currentContext,
    independentBatch: 'fortune',
    fortuneRange: {
      scope: 'current',
      ...targetContext,
      batch: { startIndex: 0, limit: 1 },
    },
  });
  assert.equal(targetBatch.horoscopeContext.dateStr, currentContext.dateStr);
  assert.equal(targetBatch.fortuneTimeline?.targetDateStr, targetContext.dateStr);
  assert.ok(
    targetBatch.fortuneTimeline?.periods.every(
      (period) =>
        targetBatch.fortuneTimeline!.targetAge >= period.startAge &&
        targetBatch.fortuneTimeline!.targetAge <= period.endAge,
    ),
  );
});

test('紫微旧运限分页任务书保持本次资料口径', async () => {
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin'],
    horoscopeContext: currentContext,
    fortuneRange: {
      scope: 'all',
      ...currentContext,
      batch: { startIndex: 0, limit: 1 },
    },
  });
  assert.equal(runtime.calculationBatch, undefined);
  assert.ok(runtime.fortuneTimeline?.batch);
  const prompt = buildPublicZiweiPromptForRuntime({ result: runtime, scope: 'full' });
  const corePrompt = buildZiweiPrompt({ runtime, scope: 'full' });
  const thematicPrompt = buildThematicConsultationPrompt({
    system: 'ziwei',
    methodId: 'ziwei',
    topic: 'career',
    scope: 'full',
    ziweiScope: 'full',
    ziweiResult: runtime,
  }).prompt;
  for (const text of [prompt, corePrompt, thematicPrompt]) {
    assert.match(text, /本次所列(?:紫微|运限)?资料/);
    assert.doesNotMatch(text, /分析范围：完整输出|所列完整运限|完整运限范围/);
  }
});

async function collectAllPages(
  chartInput: typeof input,
  scope: 'current' | 'all',
  context: TestHoroscopeContext,
  limit: number,
) {
  const pages: ZiweiFortuneTimeline[] = [];
  let startIndex = 0;
  while (true) {
    const page = await loadTimeline(chartInput, scope, context, { startIndex, limit });
    pages.push(page);
    assert.ok(page.batch, `${scope} 分页必须返回 batch 元数据`);
    if (page.batch.nextIndex === null) break;
    assert.equal(page.batch.nextIndex, page.batch.endIndexExclusive);
    startIndex = page.batch.nextIndex;
  }
  return pages;
}

test('紫微全部运限分页首段和末段保留原年龄年与层事实', async () => {
  const full = await loadTimeline(input, 'all', currentContext);
  const expectedRows = collectRows(full);
  assert.ok(expectedRows.length > 20);

  const first = await loadTimeline(input, 'all', currentContext, { startIndex: 0, limit: 10 });
  assert.deepEqual(first.batch, {
    unit: 'age-year',
    totalYears: expectedRows.length,
    startIndex: 0,
    endIndexExclusive: 10,
    nextIndex: 10,
  });
  assertRowsEqual(collectRows(first), expectedRows.slice(0, 10), '全部运限首段');
  assert.match(formatZiweiFortuneTimeline(first), /本段资料：第 1 至 10 个年龄年/);
  assert.doesNotMatch(formatZiweiFortuneTimeline(full), /本段资料/);

  const second = await loadTimeline(input, 'all', currentContext, { startIndex: 10, limit: 10 });
  assert.equal(second.batch?.startIndex, 10);
  assert.equal(second.batch?.endIndexExclusive, 20);
  assertRowsEqual(collectRows(second), expectedRows.slice(10, 20), '全部运限第二段');

  const tailStart = expectedRows.length - 5;
  const tail = await loadTimeline(input, 'all', currentContext, {
    startIndex: tailStart,
    limit: 10,
  });
  assert.deepEqual(tail.batch, {
    unit: 'age-year',
    totalYears: expectedRows.length,
    startIndex: tailStart,
    endIndexExclusive: expectedRows.length,
    nextIndex: null,
  });
  assertRowsEqual(collectRows(tail), expectedRows.slice(tailStart), '全部运限末段');
});

test('紫微当前阶段逐页拼合与完整结果一致且非目标年龄页不误报', async () => {
  const full = await loadTimeline(input, 'current', currentContext);
  const expectedRows = collectRows(full);
  assert.ok(expectedRows.length > 1);
  const defaultPage = await loadTimeline(input, 'current', currentContext, {});
  assert.equal(defaultPage.batch?.endIndexExclusive, 1);
  assert.equal(defaultPage.batch?.nextIndex, 1);
  assert.match(formatZiweiFortuneTimeline(defaultPage), /本段资料：第 1 至 1 个年龄年/);

  const pages = await collectAllPages(input, 'current', currentContext, 2);
  const actualRows = pages.flatMap(collectRows);
  assertRowsEqual(actualRows, expectedRows, '当前阶段分页拼合');
  assert.equal(pages.at(-1)?.batch?.nextIndex, null);

  const targetRowIndex = expectedRows.findIndex(
    ({ year }) =>
      year.age === full.targetAge &&
      year.dateStr <= currentContext.dateStr &&
      (year.endDateStr ?? year.dateStr) >= currentContext.dateStr,
  );
  assert.ok(targetRowIndex >= 0);
  const nonTargetIndex = targetRowIndex === 0 ? 1 : 0;
  const nonTargetPage = await loadTimeline(input, 'current', currentContext, {
    startIndex: nonTargetIndex,
    limit: 1,
  });
  assert.ok(
    collectRows(nonTargetPage).every(({ year }) => year.age !== full.targetAge),
    '当前阶段非目标年龄分页不应因缺少目标年而失败或附加错误资料',
  );
});

test('紫微节令精确分年与生日分界分页不丢切年片段和层事实', async () => {
  const cases = [
    {
      label: '节令精确分年',
      chartInput: {
        ...input,
        horoscopeDivide: 'exact' as const,
        yearDivide: 'exact' as const,
      },
    },
    {
      label: '生日分界',
      chartInput: {
        ...input,
        horoscopeDivide: 'exact' as const,
        yearDivide: 'exact' as const,
        ageDivide: 'birthday' as const,
      },
    },
  ];

  for (const item of cases) {
    const full = await loadTimeline(item.chartInput, 'current', boundaryContext);
    const expectedRows = collectRows(full);
    const pages = await collectAllPages(item.chartInput, 'current', boundaryContext, 2);
    const actualRows = pages.flatMap(collectRows);
    assertRowsEqual(actualRows, expectedRows, item.label);
    assert.ok(
      actualRows.some(({ year }) => year.age === full.targetAge && year.endDateStr !== undefined),
      `${item.label} 应保留目标年龄的完整切段边界`,
    );
  }
});

test('紫微运限分页拒绝越界起点、非法批大小和非当前或全部范围', async () => {
  const full = await loadTimeline(input, 'current', currentContext);
  const totalYears = full.periods.reduce(
    (sum, period) => sum + period.endAge - period.startAge + 1,
    0,
  );

  await assert.rejects(
    () => loadTimeline(input, 'current', currentContext, { startIndex: totalYears, limit: 1 }),
    RangeError,
  );
  await assert.rejects(
    () => loadTimeline(input, 'current', currentContext, { startIndex: -1, limit: 1 }),
    RangeError,
  );
  await assert.rejects(
    () => loadTimeline(input, 'current', currentContext, { startIndex: 0, limit: 11 }),
    RangeError,
  );
  await assert.rejects(
    () => loadTimeline(input, 'year', currentContext, { startIndex: 0, limit: 1 }),
    RangeError,
  );
});
