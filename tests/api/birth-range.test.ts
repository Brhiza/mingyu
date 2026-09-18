import assert from 'node:assert/strict';
import test from 'node:test';

import { getZiweiPromptCalculationScopes } from 'mingyu-core/prompt/public-api';

import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const SECOND = 1_000;

function beijingTimestamp(value: string): number {
  return Date.parse(value.replace(' ', 'T') + '+08:00');
}

async function callApi(path: string, payload: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  const text = await response.text();
  return {
    response,
    body: JSON.parse(text) as Record<string, any>,
    bytes: new TextEncoder().encode(text).byteLength,
  };
}

function range(start: string, end: string) {
  return {
    startTimestamp: beijingTimestamp(start),
    endTimestamp: beijingTimestamp(end),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

const BAZI_RANGE = range('1990-06-14 10:59:59', '1990-06-14 11:00:02');

test('公开八字接口范围模式默认逐秒分页并保留完整事实', async () => {
  const input = {
    gender: 'female',
    year: 1990,
    month: 6,
    day: 14,
    birthHour: 10,
    birthMinute: 59,
    birthSecond: 59,
    timeIndex: 5,
    dateType: 'solar',
    birthPlace: '公开合成地点',
    birthLongitude: 120.5,
    birthLatitude: 30.25,
    birthTimeRange: BAZI_RANGE,
    rangeBatch: { limit: 2 },
    detailMode: 'compact',
  };

  const first = await callApi('bazi/calculate', input);
  assert.equal(first.response.status, 200);
  assert.equal(first.body.ok, true);
  assert.deepEqual(
    first.body.data.range.samples.map((sample: any) => sample.index),
    [0, 1],
  );
  assert.deepEqual(
    first.body.data.range.samples.map((sample: any) => sample.bundle.profile.second),
    [59, 0],
  );
  assert.equal(first.body.data.range.totalSamples, 3);
  assert.equal(first.body.data.range.nextIndex, 2);
  assert.ok(first.body.data.range.samples[0].bundle.bazi);
  assert.ok(first.body.data.range.samples[0].bundle.normalized.timeEvidence);
  assert.deepEqual(first.body.data.range.samples[0].bundle.profile.location, {
    name: '公开合成地点',
    longitude: 120.5,
    latitude: 30.25,
    timezone: 8,
  });

  const defaultPage = await callApi('bazi/calculate', { ...input, rangeBatch: undefined });
  assert.equal(defaultPage.response.status, 200);
  assert.deepEqual(
    defaultPage.body.data.range.samples.map((sample: any) => sample.index),
    [0],
  );
  assert.equal(defaultPage.body.data.range.nextIndex, 1);

  const tail = await callApi('bazi/calculate', {
    ...input,
    rangeBatch: { startIndex: first.body.data.range.nextIndex, limit: 60 },
  });
  assert.equal(tail.response.status, 200);
  assert.deepEqual(
    tail.body.data.range.samples.map((sample: any) => sample.index),
    [2],
  );
  assert.equal(tail.body.data.range.samples[0].bundle.profile.second, 1);
  assert.equal(tail.body.data.range.nextIndex, null);
});

test('公开紫微接口范围模式按 scope 与运限游标分页并保留完整事实', async () => {
  const input = {
    name: '公开合成紫微区间',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '6',
    day: '14',
    birthHour: '10',
    birthMinute: '59',
    birthSecond: 59,
    timeIndex: 5,
    promptScope: 'full',
    scopeDate: '2025-01-01',
    scopeHourIndex: 6,
    algorithm: 'default',
    birthPlace: '公开合成地点',
    birthLongitude: '120.5',
    birthLatitude: 30.25,
    birthTimeRange: BAZI_RANGE,
  };

  const first = await callApi('ziwei/calculate', input);
  const { response, body } = first;

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(first.bytes < 1024 * 1024);
  assert.deepEqual(
    body.data.range.samples.map((sample: any) => sample.index),
    [0],
  );
  assert.deepEqual(
    body.data.range.samples.map((sample: any) => sample.bundle.profile.second),
    [59],
  );
  const sample = body.data.range.samples[0].bundle;
  assert.deepEqual(body.data.range.scopeBatch, {
    requestedScope: 'full',
    scopes: ['origin'],
    startIndex: 0,
    endIndexExclusive: 1,
    totalScopes: 6,
    nextIndex: 1,
  });
  assert.deepEqual(sample.ziwei.scopeNames, ['origin']);
  assert.deepEqual(Object.keys(sample.ziwei.payloadByScope), body.data.range.scopeBatch.scopes);
  assert.equal(sample.ziwei.fortuneTimeline, undefined);
  assert.ok(sample.ziwei.payloadByScope.origin);
  assert.equal(sample.ziwei.payloadByScope.decadal, undefined);
  assert.equal(sample.ziwei.payloadByScope.yearly, undefined);
  assert.deepEqual(body.data.range.batch.scopeContext, {
    dateStr: '2025-01-01',
    hourIndex: 6,
  });
  assert.deepEqual(sample.profile.location, {
    name: '公开合成地点',
    longitude: 120.5,
    latitude: 30.25,
    timezone: 8,
  });
  assert.equal(sample.ziwei.astrolabe, undefined);

  const nextScope = await callApi('ziwei/calculate', {
    ...input,
    scopeBatch: { startIndex: body.data.range.scopeBatch.nextIndex },
  });
  assert.equal(nextScope.response.status, 200);
  assert.ok(nextScope.bytes < 1024 * 1024);
  assert.deepEqual(nextScope.body.data.range.scopeBatch, {
    requestedScope: 'full',
    scopes: ['decadal'],
    startIndex: 1,
    endIndexExclusive: 2,
    totalScopes: 6,
    nextIndex: 2,
  });
  assert.deepEqual(
    Object.keys(nextScope.body.data.range.samples[0].bundle.ziwei.payloadByScope),
    nextScope.body.data.range.scopeBatch.scopes,
  );
  assert.ok(nextScope.body.data.range.samples[0].bundle.ziwei.payloadByScope.decadal);
  assert.equal(nextScope.body.data.range.samples[0].bundle.ziwei.payloadByScope.origin, undefined);

  const expectedScopePages = getZiweiPromptCalculationScopes('full');
  const collectedScopes = [
    body.data.range.scopeBatch.scopes[0],
    nextScope.body.data.range.scopeBatch.scopes[0],
  ];
  let scopeIndex = nextScope.body.data.range.scopeBatch.nextIndex;
  while (scopeIndex !== null) {
    const page = await callApi('ziwei/calculate', {
      ...input,
      scopeBatch: { startIndex: scopeIndex },
    });
    assert.equal(page.response.status, 200);
    assert.ok(page.bytes < 1024 * 1024);
    const metadata = page.body.data.range.scopeBatch;
    assert.deepEqual(metadata.scopes, [expectedScopePages[metadata.startIndex]]);
    assert.deepEqual(
      Object.keys(page.body.data.range.samples[0].bundle.ziwei.payloadByScope),
      metadata.scopes,
    );
    collectedScopes.push(metadata.scopes[0]);
    scopeIndex = metadata.nextIndex;
  }
  assert.deepEqual(collectedScopes, getZiweiPromptCalculationScopes('full'));

  const nextFortune = await callApi('ziwei/calculate', {
    ...input,
    fortuneBatch: { startIndex: 1, limit: 1 },
  });
  assert.equal(nextFortune.response.status, 200);
  const nextTimeline = nextFortune.body.data.range.samples[0].bundle.ziwei.fortuneTimeline;
  assert.equal(nextTimeline.batch.startIndex, 1);
  assert.equal(nextTimeline.batch.endIndexExclusive, 2);
  assert.equal(nextTimeline.batch.nextIndex, 2);
  assert.deepEqual(nextFortune.body.data.range.samples[0].bundle.ziwei.scopeNames, []);
  assert.equal(nextFortune.body.data.range.samples[0].bundle.ziwei.natalFacts.kind, 'natal-facts');
  assert.equal(nextFortune.body.data.range.batch.fortuneBatch.startIndex, 1);

  const { birthTimeRange: _birthTimeRange, ...pointInput } = input;
  const [rangeFortune, pointFortune] = await Promise.all([
    callApi('ziwei/calculate', {
      ...input,
      fortuneBatch: { startIndex: 81 },
    }),
    callApi('ziwei/calculate', {
      ...pointInput,
      fortuneBatch: { startIndex: 81 },
    }),
  ]);
  assert.equal(rangeFortune.response.status, 200, JSON.stringify(rangeFortune.body));
  assert.equal(pointFortune.response.status, 200, JSON.stringify(pointFortune.body));
  const { batch: pointBatch, ...pointZiwei } = pointFortune.body.data;
  assert.deepEqual(rangeFortune.body.data.range.samples[0].bundle.ziwei, pointZiwei);
  assert.deepEqual(rangeFortune.body.data.range.batch, pointBatch);
});

test('范围模式拒绝起点冲突、冲突时区和非法游标，点输入保持原路径', async () => {
  const point = await callApi('bazi/calculate', {
    gender: 'male',
    year: 1990,
    month: 6,
    day: 14,
    timeIndex: 5,
    dateType: 'solar',
  });
  assert.equal(point.response.status, 200);
  assert.equal(point.body.data.range, undefined);

  const mismatch = await callApi('bazi/calculate', {
    gender: 'male',
    year: 1990,
    month: 6,
    day: 14,
    birthHour: 10,
    birthMinute: 59,
    birthSecond: 58,
    timeIndex: 5,
    dateType: 'solar',
    birthTimeRange: BAZI_RANGE,
  });
  assert.equal(mismatch.response.status, 400);
  assert.equal(mismatch.body.error.code, 'BAD_REQUEST');

  const timezone = await callApi('bazi/calculate', {
    gender: 'male',
    year: 1990,
    month: 6,
    day: 14,
    birthHour: 10,
    birthMinute: 59,
    birthSecond: 59,
    dateType: 'solar',
    timezone: 7,
    birthTimeRange: BAZI_RANGE,
  });
  assert.equal(timezone.response.status, 400);

  const cursor = await callApi('bazi/calculate', {
    gender: 'male',
    year: 1990,
    month: 6,
    day: 14,
    birthHour: 10,
    birthMinute: 59,
    birthSecond: 59,
    dateType: 'solar',
    birthTimeRange: BAZI_RANGE,
    rangeBatch: { limit: 61 },
  });
  assert.equal(cursor.response.status, 400);

  const ziweiBase = {
    name: '游标反例',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '6',
    day: '14',
    birthHour: '10',
    birthMinute: '59',
    birthSecond: 59,
    promptScope: 'full',
    scopeDate: '2025-01-01',
    scopeHourIndex: 6,
    birthTimeRange: BAZI_RANGE,
  };
  for (const payload of [
    { ...ziweiBase, rangeBatch: { limit: 2 } },
    { ...ziweiBase, scopeBatch: { limit: 2 } },
    { ...ziweiBase, scopeBatch: { startIndex: 6 } },
    { ...ziweiBase, scopeBatch: {}, fortuneBatch: {} },
    { ...ziweiBase, fortuneBatch: { limit: 2 } },
    { ...ziweiBase, fortuneBatch: { limit: 11 } },
    { ...ziweiBase, promptScope: 'yearly', fortuneBatch: {} },
    { ...ziweiBase, promptScope: 'yearly', scopeBatch: {} },
  ]) {
    const invalid = await callApi('ziwei/calculate', payload);
    assert.equal(invalid.response.status, 400);
  }
});

test('公开 API OpenAPI 声明范围字段而不新增端点', async () => {
  const response = await handlePublicApiRequest(
    new Request('https://example.test/api/v1/openapi.json', { method: 'GET' }),
  );
  const body = (await response.json()) as any;
  assert.equal(response.status, 200);
  assert.ok(body.data.components.schemas.BirthTimeRange);
  assert.equal(body.data.components.schemas.BirthRangeBatch.properties.limit.maximum, 60);
  assert.equal(body.data.components.schemas.ZiweiBirthRangeBatch.properties.limit.const, 1);
  assert.equal(body.data.components.schemas.ZiweiScopeBatch.properties.limit.const, 1);
  assert.equal(body.data.components.schemas.ZiweiFortuneBatch.properties.limit.const, 1);
  assert.ok(body.data.components.schemas.BaziRequest.properties.birthTimeRange);
  assert.ok(body.data.components.schemas.BaziRequest.properties.birthLatitude);
  assert.ok(body.data.components.schemas.ZiweiRequest.properties.birthTimeRange);
  assert.ok(body.data.components.schemas.ZiweiRequest.properties.birthLatitude);
  assert.equal(body.data.paths['/bazi/range'], undefined);
  assert.equal(body.data.paths['/ziwei/range'], undefined);
});
