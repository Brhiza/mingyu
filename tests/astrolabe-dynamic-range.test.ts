import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import {
  buildAstrolabeScopeContext,
  buildAstrolabeFullScopeContexts,
} from 'mingyu-core/divination/astrolabe-scope';
import {
  generateAstrolabeDynamicRange,
  scanAstrolabeDynamicRange,
  projectAstrolabeDynamicSample,
  type AstrolabeDynamicRangeRequest,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import { buildDivinationPrompt } from 'mingyu-core/prompt';
import { julianDateToUnix } from '../packages/core/src/astrology/engine.ts';
import {
  AstrolabePeriodCalculationCache,
  buildAstrolabePeriodEvents,
  resolveAstrolabePeriodWindow,
} from 'mingyu-core/divination/astrolabe-scope';

const input: AstrolabeBirthInput = {
  name: '动态范围合成验证',
  gender: '男',
  year: '2024',
  month: '3',
  day: '20',
  hour: '11',
  minute: '0',
  second: '0',
  longitude: '116.416334',
  latitude: '39.9042',
  timezone: '8',
};
const start = Date.parse('2024-03-20T11:00:00+08:00');
const independentNatalCharts = [0, 1, 2].map((second) =>
  generateAstrolabe({ ...input, second: String(second) }),
);
const sharedFullContextsMarch2028: Array<
  ReturnType<typeof buildAstrolabeFullScopeContexts> | undefined
> = [];

function getIndependentFullContexts(secondIndex: number) {
  sharedFullContextsMarch2028[secondIndex] ??= buildAstrolabeFullScopeContexts(
    structuredClone(independentNatalCharts[secondIndex]!),
    '2028-03-20',
  );
  return structuredClone(sharedFullContextsMarch2028[secondIndex]!);
}

function getIndependentDailySample() {
  return {
    natal: structuredClone(independentNatalCharts[0]!),
    scopes: [getIndependentFullContexts(0).daily],
  };
}

test('精确周期缓存跨本命、经纬度和目标范围复用时保留逐项结果', () => {
  const calculationCache = new AstrolabePeriodCalculationCache();
  for (const natal of [
    structuredClone(independentNatalCharts[0]!),
    generateAstrolabe({
      ...input,
      year: '2022',
      month: '9',
      day: '1',
      hour: '18',
      latitude: '70',
      longitude: '-74.0060',
      timezone: '0',
    }),
  ]) {
    for (const scope of ['monthly', 'daily'] as const) {
      const target = { year: scope === 'monthly' ? 2028 : 2030, month: 3, day: 20 };
      assert.deepEqual(
        buildAstrolabePeriodEvents(natal, scope, target, { calculationCache }),
        buildAstrolabePeriodEvents(natal, scope, target),
      );
    }
  }

  const natal = structuredClone(independentNatalCharts[0]!);
  const target = { year: 2024, month: 4, day: 9 };
  const window = resolveAstrolabePeriodWindow(natal, 'daily', target);
  const lunarWindow = resolveAstrolabePeriodWindow(natal, 'daily', {
    year: 2024,
    month: 3,
    day: 25,
  });
  const normalScope = buildAstrolabeScopeContext(natal, 'daily', '2024-04-09', {
    periodCalculationCache: calculationCache,
  });
  const promptOptions = {
    method: 'astrolabe' as const,
    question: '分析本次流日的实际天象',
    data: natal,
    currentTime: new Date('2024-04-09T04:00:00.000Z'),
  };
  const normalPrompt = buildDivinationPrompt({
    ...promptOptions,
    astrolabeScopeText: normalScope.promptText,
  });
  assert.ok(normalPrompt.includes(normalScope.promptText));
  assert.match(normalPrompt, /【分析对象】/);
  assert.ok(normalPrompt.includes(`出生信息：${natal.birth.name}；男；2024-03-20 11:00`));
  assert.match(normalPrompt, /星体位置：/);
  const position = calculationCache.position('Sun', window.startJd);
  const solar = calculationCache.solar(window.startJd, window.endJd);
  const lunar = calculationCache.lunar(lunarWindow.startJd, lunarWindow.endJd);
  const original = structuredClone({ position, solar, lunar });
  assert.equal(solar[0]?.type, 'total');
  assert.equal(lunar[0]?.type, 'penumbral');
  const eclipse = normalScope.periodEvents!.events.find(
    (event) => event.kind === '交食' && event.eclipseName === '日全食',
  );
  assert.ok(eclipse);
  assert.equal(eclipse.dateTime.slice(0, 10), '2024-04-09');
  assert.equal(eclipse.julianDate, original.solar[0]!.julianDate);
  assert.ok(Number.isFinite(eclipse.julianDate));
  assert.ok(normalPrompt.includes(`${eclipse.dateTime} ${eclipse.promptText}`));
  assert.match(normalPrompt, /日全食/);

  const firstSolar = solar[0]!;
  const firstLunar = lunar[0]!;
  position.longitude = (position.longitude + 180) % 360;
  position.speed = -position.speed;
  firstSolar.type = 'partial';
  firstSolar.julianDate += 0.5;
  solar.push({ ...firstSolar });
  firstLunar.type = 'total';
  firstLunar.julianDate -= 0.5;
  lunar.splice(0, 1);
  const callerEdited = structuredClone({ position, solar, lunar });
  const freshPosition = calculationCache.position('Sun', window.startJd);
  const freshSolar = calculationCache.solar(window.startJd, window.endJd);
  const freshLunar = calculationCache.lunar(lunarWindow.startJd, lunarWindow.endJd);
  assert.deepEqual(freshPosition, original.position);
  assert.deepEqual(freshSolar, original.solar);
  assert.deepEqual(freshLunar, original.lunar);
  assert.notStrictEqual(freshPosition, position);
  assert.notStrictEqual(freshSolar, solar);
  assert.notStrictEqual(freshSolar[0], firstSolar);
  assert.notStrictEqual(freshLunar, lunar);
  assert.notStrictEqual(freshLunar[0], firstLunar);

  const freshScope = buildAstrolabeScopeContext(natal, 'daily', '2024-04-09', {
    periodCalculationCache: calculationCache,
  });
  const freshPrompt = buildDivinationPrompt({
    ...promptOptions,
    astrolabeScopeText: freshScope.promptText,
  });
  assert.deepEqual(freshScope, normalScope);
  assert.equal(freshPrompt, normalPrompt);
  assert.deepEqual({ position, solar, lunar }, callerEdited);
});

test('各动态范围锁定输入并逐秒等价，完整范围扫描一致且交付后可取消', () => {
  let whole: ReturnType<typeof generateAstrolabeDynamicRange> | undefined;
  for (const request of [
    { scope: 'yearly', referenceDate: '2028' },
    { scope: 'monthly', referenceDate: '2028-03' },
    { scope: 'daily', referenceDate: '2028-03-20' },
    { scope: 'full', referenceDate: '2028-03-20' },
  ] satisfies AstrolabeDynamicRangeRequest[]) {
    const progress: number[] = [];
    const mutableInput = { ...input };
    const mutableSource = { startTimestamp: start, endTimestamp: start + 3000 };
    const mutableRequest: AstrolabeDynamicRangeRequest = { ...request };
    const result = generateAstrolabeDynamicRange(mutableInput, mutableSource, mutableRequest, {
      onProgress: (completed) => {
        progress.push(completed);
        if (completed === 1) {
          mutableInput.longitude = '-74.0060';
          mutableSource.startTimestamp += 3_600_000;
          mutableSource.endTimestamp += 3_600_000;
          mutableRequest.scope = 'daily';
          mutableRequest.referenceDate = '2030-04-01';
        }
      },
    });
    assert.deepEqual(progress, [1, 2, 3]);
    assert.equal(result.coverage, 'natal+dynamic');
    assert.equal(result.sampleCount, 3);
    assert.equal(result.scope, request.scope);
    assert.equal(result.referenceDate, request.referenceDate);
    assert.equal(result.source.startTimestamp, start);
    assert.equal(result.source.endTimestamp, start + 3000);
    const independent = independentNatalCharts.map((birthChart, secondIndex) => {
      const natal = structuredClone(birthChart);
      return {
        natal,
        scopes:
          request.scope === 'full'
            ? Object.values(getIndependentFullContexts(secondIndex))
            : request.scope === 'monthly' || request.scope === 'daily'
              ? [getIndependentFullContexts(secondIndex)[request.scope]]
              : [buildAstrolabeScopeContext(natal, request.scope, request.referenceDate)],
      };
    });
    let cursor = start;
    let previousFingerprint: string | undefined;
    for (const branch of result.branches) {
      assert.equal(branch.startTimestamp, cursor);
      assert.equal(branch.sampleCount, (branch.endTimestamp - branch.startTimestamp) / 1000);
      const begin = (branch.startTimestamp - start) / 1000;
      const end = (branch.endTimestamp - start) / 1000;
      const samples = independent.slice(begin, end).map(projectAstrolabeDynamicSample);
      assert.notEqual(samples[0].fingerprint, previousFingerprint);
      assert.ok(samples.every((sample) => sample.fingerprint === samples[0].fingerprint));
      assert.equal(
        projectAstrolabeDynamicSample(branch.representative).fingerprint,
        samples[0].fingerprint,
      );
      assert.deepEqual(branch.representative.scopes, independent[begin].scopes);
      assert.deepEqual(branch.last.scopes, independent[end - 1].scopes);
      const yearly = branch.representative.scopes.find((scope) => scope.scope === 'yearly');
      if (yearly) {
        assert.equal(
          branch.continuous.find(
            (fact) => fact.path === 'dynamic.yearly.progression.progressedTime',
          )?.first,
          Date.parse(yearly.secondaryProgressionEvidence!.progressedDateTime!),
        );
        assert.equal(
          branch.continuous.find((fact) => fact.path === 'dynamic.yearly.progression.age')?.first,
          yearly.secondaryProgressionEvidence?.age,
        );
        assert.equal(
          branch.continuous.find((fact) => fact.path === 'dynamic.yearly.return.returnTime')?.first,
          yearly.solarReturnEvidence?.timeScale?.unixMilliseconds,
        );
        for (const period of yearly.solarReturnPeriods ?? []) {
          assert.equal(
            branch.continuous.find(
              (fact) =>
                fact.path === `dynamic.yearly.returnPeriods.${period.evidence.targetYear}.startUtc`,
            )?.first,
            Date.parse(period.startUtcDateTime),
          );
        }
      }
      assert.deepEqual(
        branch.representative.scopes.map((scope) => scope.scope),
        request.scope === 'full' ? ['natal', 'yearly', 'monthly', 'daily'] : [request.scope],
      );
      for (const scope of branch.representative.scopes.filter((scope) => scope.scope !== 'natal')) {
        assert.ok(scope.periodEvents);
        assert.ok(scope.transitFacts);
      }
      const byPath = samples.map(
        (sample) => new Map(sample.samples.map((fact) => [fact.path, fact.value])),
      );
      assert.equal(branch.continuous.length, byPath[0].size);
      for (const fact of branch.continuous) {
        const values = byPath.map((sample) => sample.get(fact.path)!);
        assert.equal(fact.sampleCount, branch.sampleCount);
        assert.equal(fact.first, values[0]);
        assert.equal(fact.last, values.at(-1));
        const period = fact.circular?.period;
        const observed = values.map((value) =>
          period
            ? values[0] +
              ((((value - values[0] + period / 2) % period) + period) % period) -
              period / 2
            : value,
        );
        assert.ok(Math.abs(fact.min - Math.min(...observed)) < 1e-8);
        assert.ok(Math.abs(fact.max - Math.max(...observed)) < 1e-8);
      }
      previousFingerprint = samples[0].fingerprint;
      cursor = branch.endTimestamp;
    }
    assert.equal(cursor, start + 3000);
    if (request.scope === 'full') whole = result;
  }
  assert.ok(whole);
  const range = { startTimestamp: start, endTimestamp: start + 3000 };
  const request = { scope: 'full', referenceDate: '2028-03-20' } as const;
  const mutableInput = { ...input };
  const mutableSource = { ...range };
  const mutableRequest: AstrolabeDynamicRangeRequest = { ...request };
  const scanner = scanAstrolabeDynamicRange(mutableInput, mutableSource, mutableRequest);
  const first = scanner.next();
  assert.equal(first.done, false);
  if (first.done) throw new Error('必须先交付分段');
  mutableInput.longitude = '-74.0060';
  mutableSource.startTimestamp += 3_600_000;
  mutableSource.endTimestamp += 3_600_000;
  mutableRequest.scope = 'daily';
  mutableRequest.referenceDate = '2030-04-01';
  const firstText = JSON.stringify(first.value);
  const branches = [first.value];
  for (;;) {
    const next = scanner.next();
    if (next.done) {
      assert.equal(next.value.branchCount, whole.branchCount);
      assert.equal(next.value.sampleCount, whole.sampleCount);
      assert.deepEqual(next.value.source, whole.source);
      assert.equal(next.value.scope, whole.scope);
      assert.equal(next.value.referenceDate, whole.referenceDate);
      break;
    }
    branches.push(next.value);
  }
  assert.equal(branches.length, whole.branches.length);
  assert.equal(JSON.stringify(branches[0]), firstText);
  for (const [index, branch] of branches.entries()) {
    assert.equal(branch.startTimestamp, whole.branches[index].startTimestamp);
    assert.equal(branch.endTimestamp, whole.branches[index].endTimestamp);
    assert.deepEqual(branch.continuous, whole.branches[index].continuous);
    assert.deepEqual(branch.representative.scopes, whole.branches[index].representative.scopes);
    assert.deepEqual(branch.last.scopes, whole.branches[index].last.scopes);
  }
  const controller = new AbortController();
  let progress = 0;
  const cancelled = scanAstrolabeDynamicRange(input, range, request, {
    signal: controller.signal,
    onProgress: (count) => {
      progress = count;
    },
  });
  assert.equal(cancelled.next().done, false);
  const deliveredProgress = progress;
  controller.abort();
  assert.throws(() => cancelled.next(), /取消/);
  assert.equal(progress, deliveredProgress);
});

test('动态离散变化独立于本命盘，事件时刻微移进入连续统计', () => {
  const sample = getIndependentDailySample();
  const baseline = projectAstrolabeDynamicSample(sample);
  const changed = structuredClone(sample);
  const aspect = changed.scopes[0].transitFacts!.facts[0];
  aspect.phase = aspect.phase === 'applying' ? 'separating' : 'applying';
  assert.notEqual(projectAstrolabeDynamicSample(changed).fingerprint, baseline.fingerprint);
  const numeric = structuredClone(sample);
  const event = numeric.scopes[0].periodEvents!.events[0];
  assert.ok(event);
  event.julianDate += 0.00001;
  const shifted = projectAstrolabeDynamicSample(numeric);
  assert.equal(shifted.fingerprint, baseline.fingerprint);
  assert.notDeepEqual(shifted.samples, baseline.samples);
});

test('返照盘宫头和盘内相位完整进入动态区间投影', () => {
  const natal = structuredClone(independentNatalCharts[0]!);
  const sample = {
    natal,
    scopes: [buildAstrolabeScopeContext(natal, 'yearly', '2028', { includePeriodEvents: false })],
  };
  const baseline = projectAstrolabeDynamicSample(sample);
  const chart = sample.scopes[0].solarReturnEvidence?.returnChart;
  assert.ok(chart);
  assert.ok(chart.internalAspectFacts.length > 0);
  assert.ok(
    baseline.samples.some(
      (fact) => fact.path === 'dynamic.yearly.return.houses.solar-return:house:1.longitude',
    ),
  );
  assert.ok(
    baseline.samples.some(
      (fact) =>
        fact.path.includes('.return.internalAspects.') && fact.path.endsWith('.actualAngle'),
    ),
  );

  const changedSign = structuredClone(sample);
  changedSign.scopes[0].solarReturnEvidence!.returnChart!.houses[0].signName = 'Taurus';
  assert.notEqual(projectAstrolabeDynamicSample(changedSign).fingerprint, baseline.fingerprint);

  const changedMembership = structuredClone(sample);
  changedMembership.scopes[0].solarReturnEvidence!.returnChart!.internalAspectFacts.pop();
  assert.notEqual(
    projectAstrolabeDynamicSample(changedMembership).fingerprint,
    baseline.fingerprint,
  );

  const changedLongitude = structuredClone(sample);
  changedLongitude.scopes[0].solarReturnEvidence!.returnChart!.houses[0].longitude += 0.001;
  const shifted = projectAstrolabeDynamicSample(changedLongitude);
  assert.equal(shifted.fingerprint, baseline.fingerprint);
  assert.notDeepEqual(shifted.samples, baseline.samples);
});

test('非东八区返照时刻与同一证据的 UTC 时间一致', () => {
  const natal = generateAstrolabe({
    name: '纽约返照动态区间验证',
    gender: '女',
    year: '2000',
    month: '3',
    day: '10',
    hour: '2',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  const scope = buildAstrolabeScopeContext(natal, 'yearly', '2024', {
    includePeriodEvents: false,
  });
  const evidence = scope.solarReturnEvidence;
  assert.ok(evidence?.timeScale && evidence.dateTime);
  assert.notEqual(evidence.timezone, 8);
  const projected = projectAstrolabeDynamicSample({ natal, scopes: [scope] });
  const returnTime = projected.samples.find(
    (fact) => fact.path === 'dynamic.yearly.return.returnTime',
  );
  assert.equal(returnTime?.value, evidence.timeScale.unixMilliseconds);
  assert.notEqual(returnTime?.value, Date.parse(`${evidence.dateTime.replace(' ', 'T')}+08:00`));
});

test('非东八区关键窗口投影沿用事件真实时刻而非东八区墙钟', () => {
  const natal = generateAstrolabe({
    ...input,
    year: '2000',
    month: '3',
    day: '10',
    hour: '2',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timezone: undefined,
    timeZoneId: 'America/New_York',
  });
  const scope = buildAstrolabeScopeContext(natal, 'monthly', '2024-07');
  const period = scope.periodEvents!;
  assert.ok(period.windows.length > 0);
  const projected = projectAstrolabeDynamicSample({ natal, scopes: [scope] });

  period.windows.forEach((window, index) => {
    const first = period.events.find((event) => event.key === window.eventKeys[0])!;
    const last = period.events.find(
      (event) => event.key === window.eventKeys[window.eventKeys.length - 1],
    )!;
    assert.equal(
      projected.samples.find(
        (fact) => fact.path === `dynamic.monthly.period.windows.${index}.start`,
      )?.value,
      julianDateToUnix(first.julianDate),
    );
    assert.equal(
      projected.samples.find((fact) => fact.path === `dynamic.monthly.period.windows.${index}.end`)
        ?.value,
      julianDateToUnix(last.julianDate),
    );
  });
  assert.notEqual(
    julianDateToUnix(
      period.events.find((event) => event.key === period.windows[0].eventKeys[0])!.julianDate,
    ),
    Date.parse(`${period.windows[0].startDateTime.replace(' ', 'T')}+08:00`),
  );
});

test('跨公历年保留正确推进年龄和完整出生秒', () => {
  const rangeStart = Date.parse('2024-12-31T23:59:59+08:00');
  const result = generateAstrolabeDynamicRange(
    { ...input, month: '12', day: '31', hour: '23', minute: '59', second: '59' },
    { startTimestamp: rangeStart, endTimestamp: rangeStart + 2000 },
    { scope: 'yearly', referenceDate: '2028' },
  );
  assert.equal(result.sampleCount, 2);
  assert.equal(result.branches.length, 2);
  const ages = result.branches.map(
    (branch) => branch.representative.scopes[0].secondaryProgressionEvidence!.age!,
  );
  assert.ok(ages.every((age) => age > 3 && age < 4));
  assert.ok(ages[0] > ages[1]);
  assert.equal(result.branches[1].startTimestamp, rangeStart + 1000);
});

test('动态范围沿用整秒来源校验，取消不返回部分结果', () => {
  const request = { scope: 'daily', referenceDate: '2028-03-20' } as const;
  assert.throws(
    () =>
      generateAstrolabeDynamicRange(
        { ...input, timezone: '0' },
        { startTimestamp: start, endTimestamp: start + 1000 },
        request,
      ),
    /timezone/,
  );
  assert.throws(
    () =>
      generateAstrolabeDynamicRange(
        input,
        { startTimestamp: start + 1, endTimestamp: start + 1000 },
        request,
      ),
    /整秒/,
  );
  const controller = new AbortController();
  let completed = 0;
  assert.throws(
    () =>
      generateAstrolabeDynamicRange(
        input,
        { startTimestamp: start, endTimestamp: start + 3000 },
        request,
        {
          signal: controller.signal,
          onProgress: (count) => {
            completed = count;
            controller.abort();
          },
        },
      ),
    /取消/,
  );
  assert.equal(completed, 1);
  const last = new AbortController();
  const lastOptions: {
    signal?: AbortSignal;
    onProgress: () => void;
  } = {
    signal: last.signal,
    onProgress: () => {
      lastOptions.signal = undefined;
      last.abort();
    },
  };
  assert.throws(
    () =>
      generateAstrolabeDynamicRange(
        input,
        { startTimestamp: start, endTimestamp: start + 1000 },
        request,
        lastOptions,
      ),
    /取消/,
  );
  assert.equal(last.signal.aborted, true);
  assert.equal(lastOptions.signal, undefined);
});
