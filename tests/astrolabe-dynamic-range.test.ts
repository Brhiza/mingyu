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
          start + 4 * 86400000 + begin * 1000,
        );
        assert.equal(
          branch.continuous.find((fact) => fact.path === 'dynamic.yearly.return.returnTime')?.first,
          yearly.solarReturnEvidence?.timeScale?.unixMilliseconds,
        );
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

test('跨公历年保留正确推进年龄和完整出生秒', () => {
  const rangeStart = Date.parse('2024-12-31T23:59:59+08:00');
  const result = generateAstrolabeDynamicRange(
    { ...input, month: '12', day: '31', hour: '23', minute: '59', second: '59' },
    { startTimestamp: rangeStart, endTimestamp: rangeStart + 2000 },
    { scope: 'yearly', referenceDate: '2028' },
  );
  assert.equal(result.sampleCount, 2);
  assert.equal(result.branches.length, 2);
  assert.deepEqual(
    result.branches.map(
      (branch) => branch.representative.scopes[0].secondaryProgressionEvidence?.age,
    ),
    [4, 3],
  );
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
