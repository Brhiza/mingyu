import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../../functions/api/v1/[[path]]';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

async function callApi(path: string, input: Record<string, unknown>, online: boolean) {
  const request = new Request(`https://aov.cc/api/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const response = online ? await onRequest({ request }) : await handlePublicApiRequest(request);
  return { status: response.status, body: await response.json() };
}

test('在线四柱反推先限制显式年份与十年区间，本地保留原入口', async () => {
  const invalidPillars = { pillars: {} };
  const missingYears = await callApi('calendar/bazi-reverse', invalidPillars, true);
  assert.equal(missingYears.status, 400);
  assert.equal(missingYears.body.error.code, 'RESOURCE_LIMIT');
  assert.match(missingYears.body.error.message, /startYear 和 endYear/);

  const overLimit = await callApi(
    'calendar/bazi-reverse',
    { ...invalidPillars, startYear: 2000, endYear: 2010, limit: 1 },
    true,
  );
  assert.equal(overLimit.body.error.code, 'RESOURCE_LIMIT');

  const atLimit = await callApi(
    'calendar/bazi-reverse',
    { ...invalidPillars, startYear: 2000, endYear: 2009 },
    true,
  );
  assert.equal(atLimit.body.error.code, 'BAD_REQUEST');
  assert.equal(
    (await callApi('calendar/bazi-reverse', invalidPillars, false)).body.error.code,
    'BAD_REQUEST',
  );
});

test('在线黄历计算和提示词均在计算前限制七天', async () => {
  for (const path of ['divination/almanac', 'divination/almanac/prompt']) {
    const input = { startDate: '2025-01-01', endDate: '2025-01-08', topic: 'invalid' };
    const overLimit = await callApi(path, input, true);
    assert.equal(overLimit.status, 400);
    assert.equal(overLimit.body.error.code, 'RESOURCE_LIMIT');
    assert.match(overLimit.body.error.message, /最多 7 天/);
    assert.equal((await callApi(path, input, false)).body.error.code, 'BAD_REQUEST');

    const atLimit = await callApi(path, { ...input, endDate: '2025-01-07' }, true);
    assert.equal(atLimit.body.error.code, 'BAD_REQUEST');
  }
});

test('在线奇门终身局仅限制动态扫描年份，缺少范围不受该预算阻断', async () => {
  for (const path of ['divination/qimen/lifetime', 'divination/qimen/lifetime/prompt']) {
    const input = { periodRange: { startDate: '2020-01-01', endDate: '2030-12-31' } };
    const overLimit = await callApi(path, input, true);
    assert.equal(overLimit.status, 400);
    assert.equal(overLimit.body.error.code, 'RESOURCE_LIMIT');
    assert.match(overLimit.body.error.message, /最多 10 个公历年份/);
    assert.equal((await callApi(path, input, false)).body.error.code, 'BAD_REQUEST');

    const atLimit = await callApi(
      path,
      { periodRange: { startDate: '2020-01-01', endDate: '2029-12-31' } },
      true,
    );
    assert.equal(atLimit.body.error.code, 'BAD_REQUEST');
    assert.equal((await callApi(path, {}, true)).body.error.code, 'BAD_REQUEST');
  }
});

test('在线紫微仅要求显式 full 单点分页，默认 decadal 与范围入口保持原校验', async () => {
  for (const path of ['ziwei/calculate', 'ziwei/prompt']) {
    const full = await callApi(path, { promptScope: 'full' }, true);
    assert.equal(full.status, 400);
    assert.equal(full.body.error.code, 'RESOURCE_LIMIT');
    assert.match(full.body.error.message, /scopeBatch/);
    assert.equal(
      (await callApi(path, { promptScope: 'full' }, false)).body.error.code,
      'BAD_REQUEST',
    );

    for (const extra of [
      { scopeBatch: { startIndex: 0, limit: 1 } },
      { fortuneBatch: { startIndex: 0, limit: 1 } },
    ]) {
      const allowed = await callApi(path, { promptScope: 'full', ...extra }, true);
      assert.equal(allowed.body.error.code, 'BAD_REQUEST');
    }
    const rangeInput = await callApi(path, { promptScope: 'full', birthTimeRange: {} }, true);
    assert.equal(
      rangeInput.body.error.code,
      path === 'ziwei/calculate' ? 'BAD_REQUEST' : 'RESOURCE_LIMIT',
    );
    assert.equal((await callApi(path, {}, true)).body.error.code, 'BAD_REQUEST');
  }
  const sharedFull = await callApi('ziwei/prompt', { scope: 'full' }, true);
  assert.equal(sharedFull.body.error.code, 'RESOURCE_LIMIT');
});
