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
import {
  AstrolabePeriodCalculationCache,
  buildAstrolabePeriodEvents,
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

test('精确周期缓存跨本命、经纬度和目标范围复用时保留逐项结果', () => {
  const calculationCache = new AstrolabePeriodCalculationCache();
  for (const birth of [
    input,
    {
      ...input,
      year: '2022',
      month: '9',
      day: '1',
      hour: '18',
      latitude: '70',
      longitude: '-74.0060',
      timezone: '0',
    },
  ]) {
    const natal = generateAstrolabe(birth);
    for (const scope of ['monthly', 'daily'] as const) {
      const target = { year: scope === 'monthly' ? 2028 : 2030, month: 3, day: 20 };
      assert.deepEqual(
        buildAstrolabePeriodEvents(natal, scope, target, { calculationCache }),
        buildAstrolabePeriodEvents(natal, scope, target),
      );
    }
  }
});

test('流年、流月、流日和完整范围逐出生秒等价且连续统计不漏样本', () => {
  for (const request of [
    { scope: 'yearly', referenceDate: '2028' },
    { scope: 'monthly', referenceDate: '2028-03' },
    { scope: 'daily', referenceDate: '2028-03-20' },
    { scope: 'full', referenceDate: '2028-03-20' },
  ] satisfies AstrolabeDynamicRangeRequest[]) {
    const progress: number[] = [];
    const result = generateAstrolabeDynamicRange(
      input,
      { startTimestamp: start, endTimestamp: start + 3000 },
      request,
      { onProgress: (completed) => progress.push(completed) },
    );
    assert.deepEqual(progress, [1, 2, 3]);
    assert.equal(result.coverage, 'natal+dynamic');
    assert.equal(result.sampleCount, 3);
    const independent = [0, 1, 2].map((second) => {
      const natal = generateAstrolabe({ ...input, second: String(second) });
      return {
        natal,
        scopes:
          request.scope === 'full'
            ? Object.values(buildAstrolabeFullScopeContexts(natal, request.referenceDate))
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
  }
});

test('动态离散变化独立于本命盘，事件时刻微移进入连续统计', () => {
  const natal = generateAstrolabe(input);
  const sample = { natal, scopes: [buildAstrolabeScopeContext(natal, 'daily', '2028-03-20')] };
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
  const natal = generateAstrolabe(input);
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

test('分段扫描与整体结果一致，交付后取消不继续接收下一秒', () => {
  const range = { startTimestamp: start, endTimestamp: start + 3000 };
  const request = { scope: 'full', referenceDate: '2028-03-20' } as const;
  const whole = generateAstrolabeDynamicRange(input, range, request);
  const scanner = scanAstrolabeDynamicRange(input, range, request);
  const first = scanner.next();
  assert.equal(first.done, false);
  if (first.done) throw new Error('必须先交付分段');
  const firstText = JSON.stringify(first.value);
  const branches = [first.value];
  for (;;) {
    const next = scanner.next();
    if (next.done) {
      assert.equal(next.value.branchCount, whole.branchCount);
      assert.equal(next.value.sampleCount, whole.sampleCount);
      assert.deepEqual(next.value.source, whole.source);
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
  assert.throws(
    () =>
      generateAstrolabeDynamicRange(
        input,
        { startTimestamp: start, endTimestamp: start + 1000 },
        request,
        { signal: last.signal, onProgress: () => last.abort() },
      ),
    /取消/,
  );
});
